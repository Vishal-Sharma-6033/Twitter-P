# Twiller Quick Reference Guide

## 🎯 Project Overview
**Type:** MERN Stack Twitter Clone  
**Frontend:** Next.js 15.5 + React 19 + TypeScript + Tailwind CSS  
**Backend:** Express.js + MongoDB + Mongoose  
**Auth:** Firebase (Email & Google OAuth)  
**Image Hosting:** imgbb.com API  

---

## 📁 Critical Files to Know

### Frontend Entry Points
| File | Purpose |
|------|---------|
| `src/app/page.tsx` | Main app entry, wraps with AuthProvider |
| `src/app/layout.tsx` | Root HTML layout, metadata |
| `src/context/AuthContext.tsx` | Global auth state management |
| `src/context/firebase.tsx` | Firebase initialization |

### Core Components
| File | Purpose |
|------|---------|
| `src/components/layout/Mainlayout.tsx` | 3-column layout wrapper, routing logic |
| `src/components/Landing.tsx` | Unauthenticated landing page |
| `src/components/Feed.tsx` | Main Twitter feed |
| `src/components/TweetComposer.tsx` | Tweet creation form |
| `src/components/TweetCard.tsx` | Individual tweet display |
| `src/components/ProfilePage.tsx` | User profile view |
| `src/components/Editprofile.tsx` | Profile edit modal |

### Backend Files
| File | Purpose |
|------|---------|
| `backend/index.js` | Express server, all API routes |
| `backend/models/user.js` | MongoDB User schema |
| `backend/models/tweet.js` | MongoDB Tweet schema |

---

## 🔐 Authentication Flow (Quick)

```
Sign Up:
  Landing → AuthModal → Firebase signup → POST /register → Feed

Login:
  Landing → AuthModal → Firebase login → GET /loggedinuser → Feed

Session Restore:
  App Load → onAuthStateChanged → GET /loggedinuser → Feed (if session exists)

Logout:
  Sidebar → logout() → Firebase signOut → Landing
```

---

## 📡 API Endpoints Quick Reference

### User Endpoints
```
POST   /register              Create new user
GET    /loggedinuser?email=x  Fetch user by email
PATCH  /userupdate/:email     Update user profile
```

### Tweet Endpoints
```
POST   /post                  Create tweet
GET    /post                  Get all tweets (sorted newest first)
POST   /like/:tweetid         Like a tweet
POST   /retweet/:tweetid      Retweet a tweet
```

---

## 🛠️ Component Hierarchy at a Glance

```
RootLayout
  ├─ AuthProvider (Context wrapper)
  │   └─ Mainlayout
  │       ├─ Sidebar
  │       │   ├─ Navigation items
  │       │   ├─ Post button
  │       │   └─ User dropdown (logout)
  │       │
  │       ├─ Main Content Area
  │       │   ├─ If user null → Landing
  │       │   │   ├─ Logo
  │       │   │   ├─ AuthModal (signup/login)
  │       │   │   └─ Sign up options
  │       │   │
  │       │   ├─ If currentPage='home' → Feed
  │       │   │   ├─ TweetComposer
  │       │   │   └─ TweetCard[] (list)
  │       │   │
  │       │   └─ If currentPage='profile' → ProfilePage
  │       │       ├─ Cover photo
  │       │       ├─ Avatar + edit button → Editprofile modal
  │       │       └─ TweetCard[] (user tweets only)
  │       │
  │       └─ RightSidebar
  │           ├─ Search
  │           ├─ Premium card
  │           └─ Suggestions
```

---

## 🔄 State Management Pattern

### Global State (AuthContext)
```typescript
const { user, isLoading, login, signup, logout, updateProfile, googlesignin } = useAuth();

user = {
  _id, username, displayName, avatar, email, 
  bio, website, location, joinedDate
}
```

### Local Component State
- **Feed:** `[tweets, setTweets]` - All tweets in feed
- **TweetComposer:** `[content, imageurl]` - Tweet being composed
- **TweetCard:** `[tweetstate, settweetstate]` - Individual tweet state
- **Mainlayout:** `[currentPage, setCurrentPage]` - Navigation state

---

## 🎨 Key Features Status

| Feature | Status | Notes |
|---------|--------|-------|
| Sign up | ✅ | Email/Google/Apple options |
| Login | ✅ | Email/password via Firebase |
| Logout | ✅ | Clears state & localStorage |
| Create Tweet | ✅ | Text + optional image upload |
| Like Tweet | ✅ | Toggleable, tracks likedBy array |
| Retweet | ✅ | Toggleable, tracks retweetedBy |
| View Feed | ✅ | Displays all tweets (newest first) |
| User Profile | ✅ | View and edit capability |
| Avatar Upload | ✅ | Via imgbb API |
| Session Restore | ✅ | On page reload |
| Search | 🔶 | UI only, non-functional |
| Notifications | 🔶 | Navigation only |
| Messages | ❌ | Not implemented |
| Explore | 🔶 | Navigation only |
| Bookmarks | 🔶 | Navigation only |

---

## 🔌 Image Upload Flow

### Tweet Image Upload
```
User clicks image icon in TweetComposer
  ↓
File input onChange handler
  ↓
Create FormData with image
  ↓
POST to imgbb API with API key
  ↓
Receive display_url
  ↓
setimageurl(url)
  ↓
Show preview in composer
  ↓
On tweet submit: Include image URL in POST /post
```

### Profile Avatar Upload
```
User clicks camera icon on profile
  ↓
Similar flow to above (same imgbb endpoint)
  ↓
Receive display_url
  ↓
Update avatar field in form
  ↓
On save: PATCH /userupdate with new avatar URL
```

---

## 📊 Database Schema at a Glance

### User Collection
```javascript
{
  _id: ObjectId,
  username: String (unique),
  displayName: String,
  avatar: String (URL),
  email: String (unique),
  bio: String,
  location: String,
  website: String,
  joinedDate: Date
}
```

### Tweet Collection
```javascript
{
  _id: ObjectId,
  author: ObjectId (ref: User),
  content: String,
  image: String (URL or null),
  likes: Number,
  retweets: Number,
  comments: Number (unused),
  likedBy: [ObjectId] (User IDs),
  retweetedBy: [ObjectId] (User IDs),
  timestamp: Date
}
```

---

## 🚀 Environment Variables Needed

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

## ⚙️ Common Hooks Usage

### useAuth() Hook
```typescript
const { user, isLoading, login, signup, logout, updateProfile, googlesignin } = useAuth();

// Check if authenticated
if (!user) {
  // Show landing page
}

// Call login
await login(email, password);

// Call signup
await signup(email, password, username, displayName);

// Call logout
logout();

// Update profile
await updateProfile({ displayName, bio, location, website, avatar });
```

---

## 🔧 How to Add a New Feature

### Example: Add "Follows" Feature

**Step 1: Backend**
```javascript
// models/user.js - Add to schema
following: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
followers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

// index.js - Add routes
app.post("/follow/:userId", async (req, res) => {
  const { followerId } = req.body;
  const user = await User.findById(req.params.userId);
  if (!user.followers.includes(followerId)) {
    user.followers.push(followerId);
    await user.save();
  }
  res.send(user);
});
```

**Step 2: Frontend**
```typescript
// AuthContext.tsx - Add method
const followUser = async (userId) => {
  await axiosInstance.post(`/follow/${userId}`, { followerId: user._id });
};

// Add to AuthContextType interface & return

// Component usage
<button onClick={() => followUser(otherUserId)}>Follow</button>
```

---

## 🎯 Navigation State Management

Currently uses string-based routing:
```typescript
currentPage = 'home' | 'explore' | 'notifications' | 'messages' | 'bookmarks' | 'profile' | 'more'

Only 'home' and 'profile' render actual components.
Others show placeholder navigation items.
```

### To Add New Page:
```typescript
// Mainlayout.tsx
if (currentPage === 'newpage') {
  return <NewPageComponent />;
}

// Sidebar.tsx - Add navigation item
{ name: 'New Page', icon: IconName, current: currentPage === 'newpage', page: 'newpage' }
```

---

## 📦 Dependencies Summary

### Frontend Production
- react, react-dom (UI)
- next (framework)
- firebase (auth)
- axios (HTTP)
- @radix-ui/* (UI components)
- tailwindcss (styling)
- lucide-react (icons)

### Backend Production
- express (server)
- mongodb, mongoose (database)
- cors (cross-origin)
- dotenv (env vars)

---

## 🐛 Known Issues & Limitations

1. **Security:** imgbb API key exposed in frontend code
2. **Validation:** Limited backend input validation
3. **Rate Limiting:** No rate limiting on endpoints
4. **Error Handling:** Limited error messaging to users
5. **Testing:** No unit or integration tests
6. **Comments:** Not implemented (placeholder in schema)
7. **Search:** Non-functional search bar in UI
8. **Pagination:** No pagination for tweets feed
9. **Notifications:** UI only, not functional
10. **Direct Messages:** Not implemented

---

## 🚀 Quick Start Commands

```bash
# Frontend
cd twiller
npm install
npm run dev              # Start on http://localhost:3000

# Backend
cd backend
npm install
npm run dev              # or: node index.js (start on port 5000)

# Build for production
npm run build            # Frontend
npm start                # Frontend prod server
```

---

## 📝 File Organization Tips

**When adding new components:**
- Feature components → `src/components/`
- Layout components → `src/components/layout/`
- UI library components → `src/components/ui/`
- Hooks & utilities → `src/lib/` or `src/context/`

**When adding new routes:**
- All routes in `backend/index.js`
- Keep format: `app.METHOD('/route', handler)`
- Use async/await for readability

---

## 🔍 Debugging Tips

1. **Check localStorage:** `localStorage.getItem('twitter-user')`
2. **Firebase session:** Check browser DevTools Network tab for auth requests
3. **API errors:** Check browser console & backend terminal
4. **Image upload fails:** Check imgbb API response in Network tab
5. **Tweet not showing:** Check MongoDB for document creation
6. **State issues:** Use React DevTools to inspect context

---

## 📞 Key Contact Points

- **State Management:** `src/context/AuthContext.tsx`
- **API Calls:** `src/lib/axiosInstance.js` (all requests go through here)
- **Backend Logic:** `backend/index.js` (all routes defined here)
- **Database:** `backend/models/` (User & Tweet schemas)
- **Styling:** `src/app/globals.css` + Tailwind classes in components

---

## 💡 Next Steps for Enhancement

1. **Add Error Boundaries** for better error handling
2. **Implement React.memo()** to prevent unnecessary re-renders
3. **Add Loading Skeletons** instead of just spinners
4. **Implement Real-time Updates** using WebSockets
5. **Add Comments/Replies** feature (partially in schema)
6. **Implement Search** functionality
7. **Add Notifications** (real-time tweet reactions)
8. **Add Direct Messages** feature
9. **Implement Pagination/Infinite Scroll** for feed
10. **Add Unit Tests** using Jest + React Testing Library

---

## ✅ Testing Your Application

### Manual Testing Checklist
- [ ] Sign up with email
- [ ] Login with email
- [ ] Google login (requires Firebase setup)
- [ ] Session persists on page reload
- [ ] Create tweet with text
- [ ] Create tweet with image
- [ ] Like a tweet
- [ ] Retweet a tweet
- [ ] View profile
- [ ] Edit profile
- [ ] Logout
- [ ] Landing page shows when logged out

---

**Last Updated:** May 13, 2026  
**Framework Versions:** Next.js 15.5.0, React 19.1.0, Firebase 12.1.0
