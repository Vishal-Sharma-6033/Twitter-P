"use client";
import { useAuth } from "@/context/AuthContext";
import React, { useState } from "react";
import LoadingSpinner from "../loading-spinner";
import Sidebar from "./Sidebar";
import RightSidebar from "./Rightsidebar";
import ProfilePage from "../ProfilePage";
import SubscriptionPlansPage from "../SubscriptionPlansPage";
import SettingsPage from "../SettingsPage";

const Mainlayout = ({
  children,
  currentPage: initialCurrentPage = "home",
}: {
  children: React.ReactNode;
  currentPage?: string;
}) => {
  const { user, isLoading } = useAuth();
  const [currentPage, setCurrentPage] = useState(initialCurrentPage);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="text-white text-4xl font-bold mb-4">X</div>
          <LoadingSpinner size="lg" />
        </div>
      </div>
    );
  }

  // If user is not logged in → show children (like login/signup pages)
  if (!user) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto grid min-h-screen w-full max-w-[1440px] grid-cols-[88px_minmax(0,1fr)] lg:grid-cols-[275px_minmax(0,1fr)_350px]">
        <div className="border-r border-gray-800 lg:sticky lg:top-0 lg:h-screen">
          <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />
        </div>
        <main className="min-w-0 overflow-hidden border-x border-gray-800">
          {currentPage === "profile" ? (
            <ProfilePage />
          ) : currentPage === "subscription" ? (
            <SubscriptionPlansPage />
          ) : currentPage === "settings" ? (
            <SettingsPage />
          ) : (
            children
          )}
        </main>
        <div className="hidden lg:block lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto">
          <RightSidebar />
        </div>
      </div>
    </div>
  );
};

export default Mainlayout;
