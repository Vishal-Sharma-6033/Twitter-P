"use client";

import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { auth } from "./firebase";
import axiosInstance from "../lib/axiosInstance";
import { normalizePhoneInput } from "@/lib/password-reset";
import {
  requestBrowserNotificationPermission,
  supportsBrowserNotifications,
} from "@/lib/tweetNotifications";

interface User {
  _id: string;
  username: string;
  displayName: string;
  avatar: string;
  bio?: string;
  joinedDate: string;
  email: string;
  phone?: string;
  subscriptionPlan?: string;
  subscriptionStatus?: string;
  subscriptionCycleStartedAt?: string;
  subscriptionCycleEndsAt?: string;
  subscriptionTweetCount?: number;
  subscriptionTweetLimit?: number;
  preferredLanguage?: string;
  website: string;
  location: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (
    email: string,
    password: string,
    username: string,
    displayName: string,
    phone?: string
  ) => Promise<void>;
  updateProfile: (profileData: {
    displayName: string;
    bio: string;
    location: string;
    website: string;
    avatar: string;
    phone: string;
  }) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  googlesignin: () => void;
  notificationsEnabled: boolean;
  notificationPermission: NotificationPermission | "unsupported";
  updateNotificationsEnabled: (enabled: boolean) => Promise<boolean>;
  refreshUser: () => Promise<User | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | "unsupported"
  >("unsupported");

  const getNotificationPreferenceKey = (email?: string) =>
    email ? `twitter-keyword-notifications:${email}` : null;

  const syncNotificationState = useCallback((email?: string) => {
    if (!supportsBrowserNotifications()) {
      setNotificationPermission("unsupported");
      setNotificationsEnabled(false);
      return;
    }

    setNotificationPermission(Notification.permission);

    const preferenceKey = getNotificationPreferenceKey(email);
    if (!preferenceKey) {
      setNotificationsEnabled(false);
      return;
    }

    const storedPreference = localStorage.getItem(preferenceKey) === "true";
    const isAllowed = Notification.permission === "granted";

    setNotificationsEnabled(storedPreference && isAllowed);

    if (!isAllowed && storedPreference) {
      localStorage.setItem(preferenceKey, "false");
    }
  }, []);

  const persistNotificationPreference = (email: string, enabled: boolean) => {
    const preferenceKey = getNotificationPreferenceKey(email);
    if (!preferenceKey) {
      return;
    }

    localStorage.setItem(preferenceKey, enabled ? "true" : "false");
  };

  const persistUser = useCallback((nextUser: User | null) => {
    setUser(nextUser);

    if (nextUser) {
      localStorage.setItem("twitter-user", JSON.stringify(nextUser));
      syncNotificationState(nextUser.email);
      return;
    }

    localStorage.removeItem("twitter-user");
    setNotificationsEnabled(false);
    setNotificationPermission(supportsBrowserNotifications() ? Notification.permission : "unsupported");
  }, [syncNotificationState]);

  const ensureAuthIsConfigured = () => {
    if (!auth) {
      throw new Error(
        "Firebase is not configured. Add NEXT_PUBLIC_FIREBASE_* values to .env.local."
      );
    }
    return auth;
  };

  useEffect(() => {
    if (!auth) {
      setIsLoading(false);
      return;
    }

    // Check for existing session
    const unsubcribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser?.email) {
        try {
          const res = await axiosInstance.get("/loggedinuser", {
            params: { email: firebaseUser.email },
          });

          if (res.data) {
            persistUser(res.data);
          }
        } catch (err) {
          console.log("Failed to fetch user:", err);
        }
      } else {
        persistUser(null);
      }
      setIsLoading(false);
    });
    return () => unsubcribe();
  }, [persistUser]);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    // Mock authentication - in real app, this would call an API
    const usercred = await signInWithEmailAndPassword(
      ensureAuthIsConfigured(),
      email,
      password
    );
    const firebaseuser = usercred.user;
    const res = await axiosInstance.get("/loggedinuser", {
      params: { email: firebaseuser.email },
    });
    if (res.data) {
      persistUser(res.data);
    }
    // const mockUser: User = {
    //   id: '1',
    //   username: 'johndoe',
    //   displayName: 'John Doe',
    //   avatar: 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=400',
    //   bio: 'Software developer passionate about building great products',
    //   joinedDate: 'April 2024'
    // };
    setIsLoading(false);
  };

  const signup = async (
    email: string,
    password: string,
    username: string,
    displayName: string,
    phone = ""
  ) => {
    setIsLoading(true);
    // Mock authentication - in real app, this would call an API
    const usercred = await createUserWithEmailAndPassword(
      ensureAuthIsConfigured(),
      email,
      password
    );
    const user = usercred.user;
    const newuser = {
      username,
      displayName,
      avatar: user.photoURL || "https://images.pexels.com/photos/1139743/pexels-photo-1139743.jpeg?auto=compress&cs=tinysrgb&w=400",
      email: user.email ?? "",
      phone: normalizePhoneInput(phone),
    };
    const res = await axiosInstance.post("/register", newuser);
    if (res.data) {
      persistUser(res.data);
    }
    // const mockUser: User = {
    //   id: '1',
    //   username,
    //   displayName,
    //   avatar: 'https://images.pexels.com/photos/1139743/pexels-photo-1139743.jpeg?auto=compress&cs=tinysrgb&w=400',
    //   bio: '',
    //   joinedDate: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    // };
    setIsLoading(false);
  };

  const logout = async () => {
    setUser(null);
    const authInstance = ensureAuthIsConfigured();
    await signOut(authInstance);
    localStorage.removeItem("twitter-user");
  };

  const updateProfile = async (profileData: {
    displayName: string;
    bio: string;
    location: string;
    website: string;
    avatar: string;
    phone: string;
  }) => {
    if (!user) return;

    setIsLoading(true);
    // Mock API call - in real app, this would call an API
    // await new Promise((resolve) => setTimeout(resolve, 1000));

    const updatedUser: User = {
      ...user,
      ...profileData,
      phone: normalizePhoneInput(profileData.phone),
    };
    const res = await axiosInstance.patch(
      `/userupdate/${user.email}`,
      updatedUser
    );
    if (res.data) {
      persistUser(updatedUser);
    }

    setIsLoading(false);
  };
  const googlesignin = async () => {
    setIsLoading(true);

    try {
      const authInstance = ensureAuthIsConfigured();
      const googleauthprovider = new GoogleAuthProvider();
      const result = await signInWithPopup(authInstance, googleauthprovider);
      const firebaseuser = result.user;

      if (!firebaseuser?.email) {
        throw new Error("No email found in Google account");
      }

      let userData: User | null = null;

      try {
        const res = await axiosInstance.get("/loggedinuser", {
          params: { email: firebaseuser.email },
        });
        userData = res.data as User;
      } catch {
        const newuser = {
          username: firebaseuser.email.split("@")[0],
          displayName: firebaseuser.displayName || "User",
          avatar: firebaseuser.photoURL || "https://images.pexels.com/photos/1139743/pexels-photo-1139743.jpeg?auto=compress&cs=tinysrgb&w=400",
          email: firebaseuser.email,
        };

        const registerRes = await axiosInstance.post("/register", newuser);
        userData = registerRes.data as User;
      }

      if (userData) {
        setUser(userData);
        localStorage.setItem("twitter-user", JSON.stringify(userData));
        syncNotificationState(userData.email);
      } else {
        throw new Error("Login/Register failed: No user data returned");
      }
    } catch (error) {
      console.error("Google Sign-In Error:", error);
      alert("Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  const updateNotificationsEnabled = async (enabled: boolean) => {
    if (!user) {
      return false;
    }

    if (!supportsBrowserNotifications()) {
      setNotificationPermission("unsupported");
      setNotificationsEnabled(false);
      return false;
    }

    if (!enabled) {
      setNotificationsEnabled(false);
      persistNotificationPreference(user.email, false);
      return true;
    }

    const permission = await requestBrowserNotificationPermission();
    setNotificationPermission(permission);

    const isAllowed = permission === "granted";
    setNotificationsEnabled(isAllowed);
    persistNotificationPreference(user.email, isAllowed);

    return isAllowed;
  };

  const refreshUser = async () => {
    if (!user?.email) {
      return null;
    }

    const res = await axiosInstance.get("/loggedinuser", {
      params: { email: user.email },
    });

    if (res.data) {
      persistUser(res.data);
      return res.data as User;
    }

    return null;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        signup,
        updateProfile,
        logout,
        isLoading,
        googlesignin,
        notificationsEnabled,
        notificationPermission,
        updateNotificationsEnabled,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
