# Twiller Application - Comprehensive Architectural Overview

## 1. Project Structure & Organization

```
Twitter-P/
├── backend/                          # Express.js Backend (Node.js)
│   ├── index.js                      # Main server file
│   ├── package.json                  # Backend dependencies
│   ├── models/
│   │   ├── user.js                   # User schema (MongoDB)
│   │   └── tweet.js                  # Tweet schema (MongoDB)
│   └── .env                          # Backend environment variables
│
└── twiller/                          # Next.js Frontend (React)
    ├── package.json                  # Frontend dependencies
    ├── next.config.ts                # Next.js configuration
    ├── tsconfig.json                 # TypeScript configuration
    ├── tailwind.config.mjs            # Tailwind CSS config
    ├── postcss.config.mjs             # PostCSS config
    │
    ├── src/
    │   ├── app/
    │   │   ├── layout.tsx             # Root layout wrapper
    │   │   ├── page.tsx               # Main entry point
    │   │   └── globals.css            # Global styles
    │   │
    │   ├── components/                # React components
    │   │   ├── Authmodel.tsx          # Authentication modal
    │   │   ├── Landing.tsx            # Landing/auth page
    │   │   ├── Feed.tsx               # Main feed component
    │   │   ├── TweetCard.tsx          # Individual tweet display
    │   │   ├── TweetComposer.tsx      # Tweet creation component
    │   │   ├── ProfilePage.tsx        # User profile view
    │   │   ├── Editprofile.tsx        # Profile editing modal
    │   │   ├── Twitterlogo.tsx        # X/Twitter logo SVG
    │   │   ├── loading-spinner.tsx    # Loading animation
    │   │   │
    │   │   ├── layout/                # Layout components
    │   │   │   ├── Mainlayout.tsx     # Main app layout wrapper
    │   │   │   ├── Sidebar.tsx        # Left navigation sidebar
    │   │   │   └── Rightsidebar.tsx   # Right sidebar (search, suggestions)
    │   │   │
    │   │   └── ui/                    # Shadcn/Radix UI components
    │   │       ├── avatar.tsx
    │   │       ├── button.tsx
    │   │       ├── card.tsx
    │   │       ├── dropdown-menu.tsx
    │   │       ├── input.tsx
    │   │       ├── label.tsx
    │   │       ├── separator.tsx
    │   │       ├── tabs.tsx
    │   │       └── textarea.tsx
    │   │
    │   ├── context/                   # React Context (State Management)
    │   │   ├── AuthContext.tsx        # Authentication context & hooks
    │   │   └── firebase.tsx           # Firebase initialization
    │   │
    │   └── lib/
    │       ├── axiosInstance.js       # Axios API client
    │       └── utils.ts               # Utility functions
    │
    └── public/                        # Static assets
```

---

## 2. Key Entry Points

### Frontend Entry Point: [src/app/page.tsx](src/app/page.tsx)
```typescript
- Wraps app in AuthProvider (enables context globally)
- Renders Mainlayout wrapper
- Renders Landing component (conditional rendering based on auth)
```

### Root Layout: [src/app/layout.tsx](src/app/layout.tsx)
```typescript
- Sets metadata (title, description, favicon)
- Applies Geist fonts
- Provides HTML structure with global styles
```

### Backend Entry Point: [backend/index.js](backend/index.js)
```javascript
- Express.js server on port 5000 (configurable)
- MongoDB connection via Mongoose
- CORS enabled for frontend requests
- RESTful API endpoints for auth, tweets, profiles
```

---

## 3. Component Hierarchy & Relationships

### Component Tree Structure:
```
<RootLayout>
  ├── metadata & fonts
  └── <body> (globals.css)
      └── <page.tsx>
          └── <AuthProvider>
              └── <Mainlayout>
                  ├── <Sidebar>
                  │   ├── Navigation items (Home, Explore, etc.)
                  │   ├── Post button
                  │   └── User profile dropdown
                  │
                  ├── <main> (center area)
                  │   ├── if NOT logged in:
                  │   │   └── <Landing>
                  │   │       ├── Logo/Welcome message
                  │   │       ├── Sign up buttons (Google, Apple, Email)
                  │   │       ├── <AuthModal>
                  │   │       │   ├── Form validation
                  │   │       │   ├── Email/password input
                  │   │       │   ├── Display name (signup only)
                  │   │       │   └── Username (signup only)
                  │   │       └── Log in button
                  │   │
                  │   └── if logged in:
                  │       ├── currentPage === 'home'? <Feed>
                  │       │   ├── Tabs (For you, Following)
                  │       │   ├── <TweetComposer>
                  │       │   │   ├── Avatar display
                  │       │   │   ├── Textarea for content
                  │       │   │   ├── Image upload (via imgbb.com)
                  │       │   │   ├── Emoji/calendar/location buttons
                  │       │   │   └── Submit button
                  │       │   └── Tweets list
                  │       │       └── <TweetCard> (for each tweet)
                  │       │           ├── Author info (avatar, name, handle, date)
                  │       │           ├── Tweet content
                  │       │           ├── Tweet image (if exists)
                  │       │           ├── Action buttons:
                  │       │           │   ├── Comment
                  │       │           │   ├── Retweet (toggleable)
                  │       │           │   ├── Like (toggleable)
                  │       │           │   └── Share
                  │       │           └── Engagement counts
                  │       │
                  │       └── currentPage === 'profile'? <ProfilePage>
                  │           ├── Cover photo (gradient)
                  │           ├── User avatar (editable)
                  │           ├── User info section
                  │           ├── Edit profile button
                  │           │   └── <Editprofile> (modal)
                  │           │       ├── Cover photo upload
                  │           │       ├── Avatar upload
                  │           │       ├── Name input
                  │           │       ├── Bio input
                  │           │       ├── Location input
                  │           │       ├── Website input
                  │           │       └── Save button
                  │           ├── Tabs (Posts, Replies, Likes)
                  │           └── User's tweets list
                  │
                  └── <RightSidebar>
                      ├── Search input
                      ├── Premium subscription card
                      └── "You might like" suggestions
                          └── List of users with Follow buttons
```

---

## 4. Context & State Management

### Authentication Context: [src/context/AuthContext.tsx](src/context/AuthContext.tsx)

**AuthContext Provider** - Manages global auth state
- **State Variables:**
  - `user: User | null` - Current logged-in user object
  - `isLoading: boolean` - Loading state for async operations

**User Interface:**
```typescript
interface User {
  _id: string;              // MongoDB ID
  username: string;         // Unique username
  displayName: string;      // Display name (required)
  avatar: string;           // Avatar image URL
  bio?: string;             // User biography
  joinedDate: string;       // When user registered
  email: string;            // Email (Firebase auth)
  website: string;          // Personal website
  location: string;         // Location field
}
```

**Auth Methods Provided:**
1. **`login(email, password)`**
   - Uses Firebase: `signInWithEmailAndPassword()`
   - Fetches user from backend `/loggedinuser` endpoint
   - Stores user in state & localStorage

2. **`signup(email, password, username, displayName)`**
   - Uses Firebase: `createUserWithEmailAndPassword()`
   - Creates new user object with default avatar
   - POSTs to `/register` endpoint
   - Stores user in state & localStorage

3. **`logout()`**
   - Uses Firebase: `signOut()`
   - Clears user state & localStorage
   - Redirects to landing page

4. **`googlesignin()`**
   - Uses Firebase: `signInWithPopup()` with GoogleAuthProvider
   - (Implementation called from Landing component)

5. **`updateProfile(profileData)`**
   - PATCH request to `/userupdate/{email}`
   - Updates displayName, bio, location, website, avatar
   - Persists to localStorage

**Session Persistence:**
- `useEffect` hook with `onAuthStateChanged()` (Firebase listener)
- Automatically checks for logged-in user on app load
- Fetches user data if Firebase auth session exists

---

## 5. API Integration

### Axios Instance: [src/lib/axiosInstance.js](src/lib/axiosInstance.js)
```javascript
const baseURL = process.env.BACKEND_URL  // Set in .env.local
Headers: { "Content-Type": "application/json" }
```

### Backend Endpoints (Express):

#### Authentication Endpoints
| Method | Endpoint | Params | Purpose |
|--------|----------|--------|---------|
| POST | `/register` | `{ username, displayName, avatar, email }` | Register new user |
| GET | `/loggedinuser` | `?email=user@email.com` | Fetch user by email |
| PATCH | `/userupdate/:email` | Body: `{ displayName, bio, location, website, avatar }` | Update user profile |

#### Tweet Endpoints
| Method | Endpoint | Params | Purpose |
|--------|----------|--------|---------|
| POST | `/post` | `{ author, content, image }` | Create new tweet |
| GET | `/post` | None | Fetch all tweets (sorted by newest) |
| POST | `/like/:tweetid` | Body: `{ userId }` | Like a tweet |
| POST | `/retweet/:tweetid` | Body: `{ userId }` | Retweet a tweet |

### External API Integration
- **Image Upload:** imgbb.com API
  - Used in `TweetComposer` & `Editprofile`
  - POST multipart form data to: `https://api.imgbb.com/1/upload?key={API_KEY}`
  - Returns: `res.data.data.display_url` (public image URL)

---

## 6. UI Components & Their Purposes

### Layout Components

**Mainlayout** - [src/components/layout/Mainlayout.tsx](src/components/layout/Mainlayout.tsx)
- Three-column layout wrapper
- Shows loading spinner while `isLoading` is true
- Conditionally renders children (Landing) or authenticated content
- Manages navigation state (`currentPage`)

**Sidebar** - [src/components/layout/Sidebar.tsx](src/components/layout/Sidebar.tsx)
- Left navigation bar
- Navigation items: Home, Explore, Notifications, Messages, Bookmarks, Profile, More
- "Post" button at bottom
- User profile dropdown with Logout option
- Width: 64px (mobile) to 256px (desktop)

**RightSidebar** - [src/components/layout/Rightsidebar.tsx](src/components/layout/Rightsidebar.tsx)
- Search input at top
- Premium subscription card
- "You might like" section with follow suggestions
- Hidden on screens smaller than large (lg breakpoint)

### Feature Components

**Landing** - [src/components/Landing.tsx](src/components/Landing.tsx)
- Welcome page for unauthenticated users
- Shows X logo (hidden on mobile)
- Sign up options: Google, Apple, Email
- Log in button
- Opens AuthModal for manual sign up/login

**AuthModal** - [src/components/Authmodel.tsx](src/components/Authmodel.tsx)
- Modal dialog for login/signup forms
- **Login mode:**
  - Email input
  - Password input
  - Toggle password visibility
  - Form validation (email regex, min password 6 chars)
- **Signup mode:**
  - Display name input
  - Username input (alphanumeric + underscore, min 3 chars)
  - Email input
  - Password input
- Switching between modes (Sign up ↔ Sign in)
- Error messages display

**Feed** - [src/components/Feed.tsx](src/components/Feed.tsx)
- Main Twitter feed
- Sticky header with "Home" title
- Tab navigation: "For you" | "Following"
- `<TweetComposer>` at top
- Lists all tweets with `<TweetCard>` components
- Calls `/post` endpoint on mount
- Handles new tweets via callback

**TweetComposer** - [src/components/TweetComposer.tsx](src/components/TweetComposer.tsx)
- User avatar display
- Textarea for tweet content (max 200 chars, but not enforced)
- Toolbar buttons: Image, Bar chart, Emoji, Calendar, Location
- Image upload to imgbb API (displays URL preview)
- "Everyone can reply" indicator
- Character counter (circular progress)
- Post button submits to `/post` endpoint
- Calls `onTweetPosted` callback to update feed

**TweetCard** - [src/components/TweetCard.tsx](src/components/TweetCard.tsx)
- Displays individual tweet
- Author info: Avatar, name, handle, timestamp, verification badge
- Tweet content text
- Tweet image (if exists)
- Action buttons with counts:
  - Comment (displays count, non-functional button)
  - Retweet (toggleable, updates count, calls `/retweet/:tweetid`)
  - Like (toggleable, updates count, calls `/like/:tweetid`)
  - Share (non-functional)
- Color changes on hover for interactions
- Formats large numbers (e.g., 1,234 → 1.2K)

**ProfilePage** - [src/components/ProfilePage.tsx](src/components/ProfilePage.tsx)
- User profile view
- Sticky header: Back button, user name, post count
- Cover photo (gradient from blue to purple)
- Profile picture (editable, opens Editprofile modal)
- User info section with Edit button
- Tabs: Posts | Replies | Likes (Replies/Likes non-functional)
- Displays only tweets by current user
- Fetches tweets on mount

**Editprofile** - [src/components/Editprofile.tsx](src/components/Editprofile.tsx)
- Modal for editing user profile
- Cover photo area (camera icon to change)
- Avatar upload (file input)
- Form fields:
  - Display name (max 50 chars)
  - Bio (max 160 chars)
  - Location (max 30 chars)
  - Website (max 100 chars)
- Image upload to imgbb API
- Form validation with error messages
- Save button calls `updateProfile()` context method

### Utility Components

**TwitterLogo** - [src/components/Twitterlogo.tsx](src/components/Twitterlogo.tsx)
- SVG X logo
- Size variants: sm (6px), md (8px), lg (12px), xl (16px)
- Used in Landing, AuthModal, Sidebar

**LoadingSpinner** - [src/components/loading-spinner.tsx](src/components/loading-spinner.tsx)
- Animated spinning circle
- Size variants: sm, md, lg
- Uses Tailwind's `animate-spin` utility
- Shows during async operations

---

## 7. Data Flow: User Interaction to API Calls

### Flow 1: User Signup/Registration

```
User clicks "Create account" on Landing
    ↓
Opens AuthModal (mode='signup')
    ↓
User fills: displayName, username, email, password
    ↓
Form validation in AuthModal
    ↓
User clicks "Create account" button
    ↓
AuthModal calls useAuth().signup(email, password, username, displayName)
    ↓
AuthContext → Firebase: createUserWithEmailAndPassword()
    ↓
IF Firebase signup success:
    ↓
    Create newUser object: { username, displayName, avatar, email }
    ↓
    POST /register (axiosInstance) → backend
    ↓
    Backend: User.findOne({email}) → if not exists → new User().save()
    ↓
    Response: User document from MongoDB
    ↓
    AuthContext:
      - setUser(res.data)
      - localStorage.setItem('twitter-user', JSON.stringify(res.data))
      - setIsLoading(false)
    ↓
AuthModal closes
    ↓
Mainlayout detects user !== null
    ↓
Renders Feed component (authenticated view)
```

### Flow 2: User Login

```
User clicks "Log in" on Landing
    ↓
Opens AuthModal (mode='login')
    ↓
User fills: email, password
    ↓
Form validation
    ↓
User clicks "Sign in" button
    ↓
AuthModal calls useAuth().login(email, password)
    ↓
AuthContext → Firebase: signInWithEmailAndPassword()
    ↓
IF Firebase login success:
    ↓
    GET /loggedinuser?email={user.email} (axiosInstance) → backend
    ↓
    Backend: User.findOne({email}) → returns User document
    ↓
    AuthContext:
      - setUser(res.data)
      - localStorage.setItem('twitter-user', JSON.stringify(res.data))
      - setIsLoading(false)
    ↓
AuthModal closes
    ↓
Mainlayout renders Feed
```

### Flow 3: Session Persistence on App Load

```
App initializes (RootLayout → page.tsx)
    ↓
AuthProvider mounted
    ↓
useEffect with onAuthStateChanged listener runs
    ↓
Firebase checks if user has active session
    ↓
IF session exists (firebaseUser?.email):
    ↓
    GET /loggedinuser?email={firebaseUser.email}
    ↓
    setUser(res.data)
    ↓
    localStorage.setItem('twitter-user', JSON.stringify(res.data))
    ↓
ELSE (no session):
    ↓
    setUser(null)
    ↓
    localStorage.removeItem('twitter-user')
    ↓
setIsLoading(false)
    ↓
If user exists → Feed shown | If user null → Landing shown
```

### Flow 4: Create Tweet

```
User types tweet in TweetComposer
    ↓
User can click image icon to upload (optional)
    ↓
IF image selected:
    ↓
    FormData created with image file
    ↓
    POST https://api.imgbb.com/1/upload?key={API_KEY}
    ↓
    Axios response: res.data.data.display_url → setimageurl(url)
    ↓
User clicks "Post" button
    ↓
TweetComposer validates:
    - user exists
    - content.trim() not empty
    ↓
tweetdata = {
    author: user._id,
    content: textarea value,
    image: imageurl or ""
}
    ↓
POST /post (axiosInstance) with tweetdata
    ↓
Backend:
    ↓
    new Tweet(tweetdata).save()
    ↓
    Response: Saved tweet document (includes _id, timestamp, etc.)
    ↓
TweetComposer:
    - Calls onTweetPosted(res.data) callback
    - Clears content & imageurl state
    ↓
Feed component:
    ↓
    handlenewtweet() callback updates tweets state
    ↓
    setTweets([newtweet, ...prev]) (prepends to list)
    ↓
TweetCard renders new tweet at top of feed
```

### Flow 5: Like/Retweet Tweet

```
User clicks Like or Retweet button on TweetCard
    ↓
IF Like clicked:
    ↓
    POST /like/:tweetid { userId: user._id }
    ↓
    Backend:
        - Tweet.findById(tweetid)
        - IF userId not in tweet.likedBy array:
            - likes++
            - likedBy.push(userId)
            - tweet.save()
        - Return updated tweet
    ↓
IF Retweet clicked:
    ↓
    POST /retweet/:tweetid { userId: user._id }
    ↓
    Backend:
        - Tweet.findById(tweetid)
        - IF userId not in tweet.retweetedBy array:
            - retweets++
            - retweetedBy.push(userId)
            - tweet.save()
        - Return updated tweet
    ↓
TweetCard:
    ↓
    settweetstate(res.data) → updates local tweet state
    ↓
    Button color changes (green for retweet, red for like)
    ↓
    Count updates UI
```

### Flow 6: Edit Profile

```
User clicks avatar/profile button on ProfilePage
    ↓
Opens Editprofile modal (isopen=true)
    ↓
User modifies:
    - displayName
    - bio
    - location
    - website
    - avatar (via file upload)
    ↓
IF avatar file selected:
    ↓
    FormData created with image file
    ↓
    POST https://api.imgbb.com/1/upload?key={API_KEY}
    ↓
    res.data.data.display_url → setFormdata(prev => {...prev, avatar: url})
    ↓
User clicks "Save" button
    ↓
Form validation (name, bio, location, website length checks)
    ↓
Editprofile calls useAuth().updateProfile(formData)
    ↓
AuthContext:
    ↓
    PATCH /userupdate/{user.email} with updated user object
    ↓
    Backend:
        - User.findOneAndUpdate({email}, {$set: req.body}, {new: true})
        - Returns updated user document
    ↓
    setUser(updatedUser)
    ↓
    localStorage.setItem('twitter-user', JSON.stringify(updatedUser))
    ↓
Editprofile modal closes
    ↓
ProfilePage re-renders with updated user info
```

---

## 8. Authentication Flow (Complete)

### Architecture Overview:

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Next.js/React)                  │
├─────────────────────────────────────────────────────────────┤
│
│  Landing Page (No Auth)
│    ├── Google Sign In ──────┐
│    ├── Apple Sign In        │
│    ├── Email/Password       ├──→ Firebase Auth ──────┐
│    │  (via AuthModal)       │                        │
│    └── Form Validation      │                        │
│                             │                        │
│                             └────────────────────────┴──→ ┌─────────────────┐
│                                                           │ Firebase Project│
│                             ┌─────────────────────────→  │ (Google Cloud)  │
│  Mainlayout                 │                            │                 │
│    ├── AuthProvider         │    Authenticates user      │ - Email/Password│
│    │   (useAuth hook)       │    Creates session         │ - Google OAuth  │
│    │   └── onAuthStateChanged (listens for session)      │ - Apple OAuth   │
│    │                        │                            │                 │
│    ├── Sidebar              │    Returns firebaseUser    │                 │
│    ├── Feed/Profile         │    (if logged in)          └─────────────────┘
│    └── RightSidebar         │
│                             │
│    Conditional Rendering    │
│    IF user === null:        │
│      → Show Landing         │
│    ELSE:                    │
│      → Show Feed/Profile    │
│
└─────────────────────────────────────────────────────────────┘
                               │
                               ↓
        ┌──────────────────────────────────────────┐
        │   AuthContext (React Context)            │
        ├──────────────────────────────────────────┤
        │ State:                                   │
        │   - user: User | null                    │
        │   - isLoading: boolean                   │
        │                                          │
        │ Methods:                                 │
        │   - login()                              │
        │   - signup()                             │
        │   - logout()                             │
        │   - updateProfile()                      │
        │   - googlesignin()                       │
        │                                          │
        │ Storage:                                 │
        │   - localStorage.getItem('twitter-user')│
        └──────────────────────────────────────────┘
                               │
                               ↓
        ┌──────────────────────────────────────────┐
        │   Axios Instance (API Client)            │
        │   baseURL: process.env.BACKEND_URL       │
        └──────────────────────────────────────────┘
                               │
                               ↓
        ┌──────────────────────────────────────────┐
        │   Backend (Express.js)                   │
        ├──────────────────────────────────────────┤
        │ Routes:                                  │
        │   POST /register                         │
        │   GET /loggedinuser                      │
        │   PATCH /userupdate/:email               │
        │   POST /post (create tweet)              │
        │   GET /post (fetch tweets)               │
        │   POST /like/:tweetid                    │
        │   POST /retweet/:tweetid                 │
        └──────────────────────────────────────────┘
                               │
                               ↓
        ┌──────────────────────────────────────────┐
        │   MongoDB (Data Persistence)             │
        ├──────────────────────────────────────────┤
        │ Collections:                             │
        │   - Users (email, username, profile)     │
        │   - Tweets (author, content, likes)      │
        └──────────────────────────────────────────┘
```

### Authentication Flows:

**1. Sign Up Flow:**
```
User → AuthModal (signup mode)
  → Firebase: createUserWithEmailAndPassword()
  → Backend: POST /register (create user in MongoDB)
  → AuthContext: setUser()
  → Feed
```

**2. Login Flow:**
```
User → AuthModal (login mode)
  → Firebase: signInWithEmailAndPassword()
  → Backend: GET /loggedinuser (fetch user from MongoDB)
  → AuthContext: setUser()
  → Feed
```

**3. Google Sign In:**
```
User → Landing (click Google Sign In)
  → Firebase: signInWithPopup(GoogleAuthProvider)
  → Backend: GET /loggedinuser (or POST /register if new)
  → AuthContext: setUser()
  → Feed
```

**4. Session Persistence:**
```
App Load
  → AuthProvider useEffect runs
  → Firebase: onAuthStateChanged() listener
  → IF firebaseUser exists:
      → Backend: GET /loggedinuser
      → AuthContext: setUser()
  → ELSE:
      → AuthContext: setUser(null)
  → Landing (if no user) or Feed (if user exists)
```

**5. Logout:**
```
User → Sidebar (click logout from dropdown)
  → Firebase: signOut()
  → AuthContext: setUser(null)
  → Clear localStorage
  → Landing
```

---

## 9. Key Features & Implementation

### Feature 1: User Authentication
**Files:** `AuthContext.tsx`, `firebase.tsx`, `Authmodel.tsx`
- **Status:** ✅ Fully implemented
- **Tech Stack:** Firebase Auth + Express backend
- **Methods:** Email/password, Google OAuth
- **Persistence:** Firebase sessions + localStorage backup

### Feature 2: Tweet Creation
**Files:** `TweetComposer.tsx`, `Feed.tsx`, Backend: `index.js`, `models/tweet.js`
- **Status:** ✅ Fully implemented
- **Flow:** Text input → Image upload (imgbb) → POST /post → Updated feed
- **Character limit:** 200 chars (UI counter, not enforced on submit)
- **Image hosting:** imgbb.com external API

### Feature 3: Like & Retweet
**Files:** `TweetCard.tsx`, Backend: `index.js`
- **Status:** ✅ Fully implemented
- **DB Logic:** Tracks userId in `likedBy` and `retweetedBy` arrays
- **Prevents duplicates:** Checks if userId already in array before incrementing
- **UI Feedback:** Color changes (red for like, green for retweet), count updates

### Feature 4: User Profiles
**Files:** `ProfilePage.tsx`, `Editprofile.tsx`, Backend routes
- **Status:** ✅ Fully implemented
- **View Profile:** Displays user info, post count, tweets by user
- **Edit Profile:** Modal to update displayName, bio, location, website, avatar
- **Avatar Upload:** Image upload to imgbb, displays on profile

### Feature 5: Feed (Tweet Timeline)
**Files:** `Feed.tsx`, `TweetCard.tsx`, `TweetComposer.tsx`
- **Status:** ✅ Fully implemented
- **Load:** Fetches all tweets sorted by newest (timestamp: -1)
- **Real-time updates:** Prepends new tweets to top of feed
- **Tabs:** "For you" and "Following" (Following tab non-functional)

### Feature 6: Navigation
**Files:** `Sidebar.tsx`, `Mainlayout.tsx`
- **Status:** ✅ Partially implemented
- **Active Pages:** Home (Feed), Profile
- **Unimplemented:** Explore, Notifications, Messages, Bookmarks, More
- **State:** Managed by `currentPage` in Mainlayout

### Feature 7: Search & Suggestions
**Files:** `Rightsidebar.tsx`
- **Status:** 🔶 UI only (non-functional)
- **Components:** Search input, user suggestions with Follow buttons
- **Backend Integration:** Not implemented

### Feature 8: Session Management
**Files:** `AuthContext.tsx`, `firebase.tsx`
- **Status:** ✅ Fully implemented
- **On App Load:** Checks Firebase session, fetches user data, restores state
- **Persistence:** localStorage stores user object for quick reload
- **Auto-logout:** If Firebase session expires, user cleared from context

---

## 10. Technology Stack Summary

### Frontend
| Technology | Version | Purpose |
|-----------|---------|---------|
| React | 19.1.0 | UI framework |
| Next.js | 15.5.0 | React framework, SSR/SSG |
| TypeScript | 5+ | Type safety |
| Tailwind CSS | 4+ | Utility-first styling |
| Firebase | 12.1.0 | Authentication, real-time database |
| Axios | 1.11.0 | HTTP client for API calls |
| Lucide React | 0.540.0 | Icon library |
| Radix UI | Latest | Headless UI components |

### Backend
| Technology | Purpose |
|-----------|---------|
| Express.js | Web framework |
| MongoDB | NoSQL database |
| Mongoose | MongoDB ODM |
| CORS | Cross-origin requests |
| dotenv | Environment variables |

### External Services
| Service | Purpose |
|---------|---------|
| Firebase (Google Cloud) | Authentication & session management |
| imgbb.com | Image hosting for tweets & avatars |

---

## 11. Environment Variables Required

### Frontend (.env.local)
```
NEXT_PUBLIC_FIREBASE_API_KEY=xxx
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=xxx
NEXT_PUBLIC_FIREBASE_PROJECT_ID=xxx
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=xxx
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=xxx
NEXT_PUBLIC_FIREBASE_APP_ID=xxx
BACKEND_URL=http://localhost:5000
```

### Backend (.env)
```
MONOGDB_URL=mongodb+srv://user:password@cluster.mongodb.net/dbname
PORT=5000
```

---

## 12. Data Models

### User Model (MongoDB)
```javascript
{
  _id: ObjectId,
  username: String (required, unique),
  displayName: String (required),
  avatar: String (required),
  email: String (required, unique),
  bio: String (default: ""),
  location: String (default: ""),
  website: String (default: ""),
  joinedDate: Date (default: Date.now)
}
```

### Tweet Model (MongoDB)
```javascript
{
  _id: ObjectId,
  author: ObjectId (ref: "User", required),
  content: String (required),
  image: String (default: null),
  likes: Number (default: 0),
  retweets: Number (default: 0),
  comments: Number (default: 0),
  likedBy: [ObjectId] (refs: "User"),
  retweetedBy: [ObjectId] (refs: "User"),
  timestamp: Date (default: Date.now)
}
```

---

## 13. Component Communication Flow

### State Lifting & Prop Drilling
```
AuthProvider (top-level)
  ├── useAuth() hook → provides user, login, signup, logout, updateProfile
  │
  └── Mainlayout
      ├── Sidebar → uses useAuth() to display user, logout
      ├── Feed → uses useAuth() for current user
      │   ├── TweetComposer → uses useAuth() for user._id, onTweetPosted callback
      │   └── TweetCard[] → uses useAuth() for user._id (likes/retweets)
      ├── ProfilePage → uses useAuth() for current user
      │   ├── Editprofile → uses useAuth() for updateProfile()
      │   └── TweetCard[] (filtered by user)
      └── RightSidebar → static suggestions
```

### Props & Callbacks
```
Landing → AuthModal
  Prop: isOpen, onClose, initialMode
  Callback: none (modal manages state internally)

Landing → openAuthModal()
  Triggers: AuthModal visibility & mode

Feed → TweetComposer
  Prop: onTweetPosted callback
  Callback: handlenewtweet() (prepends to feed)

Feed → TweetCard[]
  Prop: tweet object
  Callback: none (manages state internally)

ProfilePage → Editprofile
  Prop: isopen, onclose
  Callback: modal manages form state internally

TweetCard → Like/Retweet
  Callback: inline handlers call API, update local state
```

---

## 14. Error Handling & Edge Cases

### Current Implementation
- **Form Validation:** Email regex, password min length, username format in AuthModal & Editprofile
- **Firebase Errors:** Logged to console, shown to user
- **API Errors:** Logged to console, some error boundaries in place
- **Missing User:** Conditional rendering checks `if (!user) return null`

### Potential Issues
- **No error toast notifications** (users don't always see errors)
- **No retry logic** for failed API calls
- **Image upload failure** not handled gracefully
- **Duplicate like/retweet prevention** relies on frontend, not enforced on backend
- **No loading states** on like/retweet buttons

---

## 15. Performance Considerations

### Optimizations
- **Lazy component loading:** AuthModal only rendered when needed
- **Image optimization:** External images via URLs (not embedded)
- **Memoization:** None currently implemented (could memoize TweetCard, TweetComposer)

### Potential Improvements
- Pagination for tweets feed
- Infinite scroll instead of full load
- React.memo() for TweetCard to prevent unnecessary re-renders
- Caching user data in context instead of fetching every session
- WebSocket for real-time tweet updates instead of manual fetch

---

## 16. Security Considerations

### Current Measures
- Firebase Auth handles password hashing & security
- Environment variables for API keys (NEXT_PUBLIC_* only visible in client)
- MongoDB ObjectId prevents ID enumeration
- Email uniqueness enforced in database

### Potential Vulnerabilities
- **CORS:** All origins allowed (should whitelist frontend URL)
- **Rate limiting:** No rate limiting on API endpoints
- **XSS:** User content (tweets) rendered as plain text (safe)
- **CSRF:** No CSRF tokens (should add for production)
- **Input validation:** Minimal on backend (should validate tweet length, etc.)
- **Image hosting:** imgbb API key exposed in client-side code

---

## 17. File Size & Code Metrics

- **Frontend Components:** ~12 feature components + 8 UI components
- **Backend Routes:** 7 main endpoints (register, login, tweets CRUD, like, retweet)
- **Database Collections:** 2 (Users, Tweets)
- **Total Dependencies:** ~15 production npm packages + dev dependencies

---

## Summary

**Twiller** is a Twitter clone built with a modern MERN stack featuring:
- ✅ Firebase-based authentication (email, Google OAuth)
- ✅ Tweet creation with image uploads (via imgbb)
- ✅ Like & retweet functionality
- ✅ User profiles with edit capability
- ✅ Session persistence
- ✅ Responsive design (mobile-first with Tailwind)
- 🔶 Incomplete navigation (only Home & Profile functional)
- 🔶 Limited search/discovery features

The architecture is component-based with React Context for state management, Clear separation between frontend & backend, and integration with Firebase for authentication. The application is suitable for further feature development and scaling with proper production security measures.
