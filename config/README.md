# Firebase Configuration

This directory contains Firebase configuration and TypeScript schema definitions for the Say It app.

## Setup Instructions

### 1. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" or select an existing project
3. Follow the setup wizard

### 2. Register Your App

1. In Firebase Console, go to Project Settings
2. Under "Your apps", click the Web icon (</>) to add a web app
3. Register your app with a nickname (e.g., "Say It")
4. Copy the Firebase configuration object

### 3. Configure Environment Variables

Create a `.env` file in the project root with your Firebase credentials:

```env
EXPO_PUBLIC_FIREBASE_API_KEY=your_api_key_here
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id
```

**⚠️ Never commit your `.env` file to version control!**

### 4. Enable Firestore Database

1. In Firebase Console, go to "Firestore Database"
2. Click "Create database"
3. Start in **production mode** (we'll deploy custom rules)
4. Choose a location close to your users

### 5. Enable Firebase Storage

1. In Firebase Console, go to "Storage"
2. Click "Get started"
3. Start in **production mode**
4. Use the same location as Firestore

### 6. Deploy Security Rules

Deploy the Firestore and Storage security rules:

```bash
# Install Firebase CLI if you haven't already
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firebase in your project
firebase init

# Select:
# - Firestore (database rules)
# - Storage (storage rules)
# - Use existing project
# - Use firestore.rules and storage.rules files

# Deploy rules
firebase deploy --only firestore:rules,storage:rules
```

### 7. Set Up Cloud Functions (Later Phase)

Cloud Functions will be configured in Phase 6 of the implementation plan for:
- Automatic cleanup of Drop It images
- Inactive room cleanup
- Auto-hiding reported content
- Capacity tracking

## Files in this Directory

- **`firebase.ts`**: Firebase SDK initialization and service exports
- **`firestore-schema.ts`**: TypeScript interfaces for all Firestore documents
- **`README.md`**: This file - setup instructions

## Schema Overview

### Collections

- `/global/capacity` - Tracks concurrent users (max 5,000)
- `/rooms/{roomCode}` - Individual game rooms
- `/rooms/{roomCode}/rounds/{roundId}` - Game rounds within rooms
- `/reports/{reportId}` - Content reports

### Key Interfaces

- `Room` - Main room document with players and game state
- `Round` - Individual round with submissions, reactions, and guesses
- `Submission` - Player submission (text or image)
- `Report` - Content report for moderation

## Security

The security rules enforce:

- ✅ Anyone can read rooms and rounds (needed for real-time updates)
- ✅ Max 12 players per room
- ✅ Reports are write-only (privacy)
- ✅ Images limited to 500KB
- ✅ Only Cloud Functions can modify global capacity
- ✅ Automatic cleanup via Cloud Functions

## Next Steps

After completing Firebase setup:

1. Test the connection by running the app
2. Verify Firestore and Storage are accessible
3. Continue with Phase 3: Core Services & Utilities
