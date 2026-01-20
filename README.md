# Say It - Anonymous Party Game

Say It is a private, anonymous, round-based party game where friends can express themselves without filters. Play with 3-12 players (best with 6-10) in three different game modes.

## 🎮 Game Modes

1. **Finish the Sentence** - Complete prompts with text (60 char max)
2. **Drop It** - Share anonymous images (one round per game)
3. **No Context** - Single word or emoji responses only

## 🚀 Tech Stack

- **Frontend**: Expo (React Native) - iOS, Android, Web
- **Backend**: Firebase Firestore (real-time game state)
- **Storage**: Firebase Storage (temporary images only)
- **Functions**: Firebase Cloud Functions (cleanup & moderation)
- **Monetization**: Google AdMob

## 📋 Prerequisites

- Node.js 18 or higher
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- Firebase account
- Google AdMob account (optional for development)

## 🔧 Setup Instructions

### 1. Clone and Install Dependencies

```bash
cd say-it
npm install
```

### 2. Firebase Setup

1. Create a new Firebase project at [console.firebase.google.com](https://console.firebase.google.com)

2. Enable the following services:
   - **Firestore Database** (Native mode)
   - **Storage**
   - **Functions**

3. Get your Firebase configuration:
   - Go to Project Settings > General
   - Under "Your apps", add a web app
   - Copy the configuration values

4. Create a `.env` file in the project root (copy from `.env.example`):

```bash
cp .env.example .env
```

5. Fill in your Firebase credentials in `.env`

### 3. Firebase Security Rules

Deploy the Firestore and Storage security rules:

```bash
firebase deploy --only firestore:rules
firebase deploy --only storage:rules
```

### 4. Firebase Cloud Functions

```bash
cd functions
npm install
npm run build
firebase deploy --only functions
```

### 5. Initialize Firestore Capacity Document

After deploying functions, call the initialization function once:

```bash
firebase functions:call initializeCapacity
```

### 6. AdMob Setup (Optional)

For development, test ad IDs are used automatically. For production:

1. Create an AdMob account at [admob.google.com](https://admob.google.com)
2. Create ad units for:
   - Banner (Lobby & Summary screens)
   - Interstitial (Between rounds)
   - Rewarded (Skip waiting / bonus features)
3. Update `app.json` with your AdMob app IDs
4. Update ad unit IDs in:
   - `components/ads/BannerAd.tsx`
   - `components/ads/InterstitialAdManager.tsx`
   - `components/ads/RewardedAdManager.tsx`

## 🏃 Running the App

### Development

```bash
# Start Expo dev server
npm start

# iOS
npm run ios

# Android
npm run android

# Web
npm run web
```

### Testing with Firebase Emulators (Optional)

```bash
firebase emulators:start
```

## 🎯 Key Features

### Core Gameplay
- ✅ Private room codes (6 characters)
- ✅ 3-12 players per room
- ✅ 3 game modes with unique mechanics
- ✅ Anonymous submissions
- ✅ Emoji reactions (😭 👀 😬 🤯 😂)
- ✅ End-game summary with group insights

### Safety & Moderation
- ✅ Profanity filter (client-side)
- ✅ Report system for inappropriate content
- ✅ Auto-hide after 3 reports
- ✅ 18+ age gate
- ✅ No permanent content storage

### Technical Features
- ✅ 5,000 concurrent user capacity cap
- ✅ Real-time sync via Firestore
- ✅ Automatic image cleanup (15min or on round end)
- ✅ Inactive room cleanup (24 hours)
- ✅ Image compression (<500KB)

### Monetization
- ✅ Banner ads (lobby & summary)
- ✅ Interstitial ads (every 3 rounds)
- ✅ Rewarded ads (optional features)

## 📁 Project Structure

```
say-it/
├── app/                      # Screens (Expo Router)
│   ├── index.tsx            # Home screen
│   ├── lobby.tsx            # Lobby screen
│   ├── round.tsx            # Round input screen
│   ├── reveal.tsx           # Results/reveal screen
│   └── summary.tsx          # End game summary
├── components/
│   ├── game/                # Game-specific components
│   │   ├── AnswerTile.tsx
│   │   ├── EmojiReactions.tsx
│   │   ├── PlayerCounter.tsx
│   │   ├── PromptDisplay.tsx
│   │   └── RoomCode.tsx
│   ├── ads/                 # AdMob components
│   │   ├── BannerAd.tsx
│   │   ├── InterstitialAdManager.tsx
│   │   └── RewardedAdManager.tsx
│   └── modals/              # Modal dialogs
│       ├── ReportModal.tsx
│       └── CapacityWarningModal.tsx
├── config/
│   ├── firebase.ts          # Firebase initialization
│   └── firestore-schema.ts  # TypeScript types
├── constants/
│   ├── config.ts            # Game configuration
│   ├── prompts.ts           # Game prompts
│   └── theme.ts             # UI theme
├── services/                # Business logic
│   ├── capacityService.ts   # User capacity management
│   ├── gameService.ts       # Game state management
│   ├── imageService.ts      # Image handling
│   └── roomService.ts       # Room management
├── utils/
│   ├── anonymousId.ts       # Device ID generation
│   └── profanityFilter.ts   # Content filtering
├── functions/               # Firebase Cloud Functions
│   └── src/index.ts
├── firestore.rules          # Firestore security rules
├── storage.rules            # Storage security rules
└── app.json                 # Expo configuration
```

## 🔐 Security Rules

### Firestore
- Rooms: Anyone can read/create/update (with player limit validation)
- Rounds: Anyone can read/write (within game flow)
- Reports: Write-only (privacy)
- Global capacity: Read-only

### Storage
- Drop It images: Max 500KB
- Path: `/drop-it/{roomCode}/{fileName}`
- Auto-deleted after 15 minutes or round end

## 🎨 Game Configuration

All configurable values are in `constants/config.ts`:

```typescript
MAX_CONCURRENT_USERS: 5000
MIN_PLAYERS: 2
MAX_PLAYERS: 12
MODE1_MAX_CHARS: 60
DROP_IT_MAX_SIZE_KB: 500
DROP_IT_TIMEOUT_MINUTES: 15
AD_FREQUENCY_ROUNDS: 3
AUTO_HIDE_REPORT_THRESHOLD: 3
```

## 📊 Firestore Schema

### Collections

1. **`/global/capacity`**
   - `activeUsers: number`
   - `lastUpdated: timestamp`

2. **`/rooms/{roomCode}`**
   - Room metadata and player list
   - Status: waiting | playing | ended

3. **`/rooms/{roomCode}/rounds/{roundId}`**
   - Round data with anonymous submissions
   - Reactions and optional guesses

4. **`/reports/{reportId}`**
   - Content reports for moderation

## 🚀 Deployment

### iOS

1. Configure bundle identifier in `app.json`
2. Add AdMob app ID to iOS config
3. Build with EAS:
   ```bash
   eas build --platform ios
   ```
4. Submit to App Store via EAS Submit or manually

### Android

1. Configure package name in `app.json`
2. Add AdMob app ID to Android config
3. Build with EAS:
   ```bash
   eas build --platform android
   ```
4. Submit to Play Store via EAS Submit or manually

### Web

```bash
npm run web
# Then deploy the `dist` folder to your hosting service
```

## 🐛 Known Limitations

1. **No AI/LLM Integration** - By design for simplicity
2. **No User Accounts** - Anonymous by design
3. **No Content History** - Privacy-first approach
4. **5,000 User Cap** - To control Firebase costs
5. **Drop It Once Per Game** - Cost control measure

## 🧪 Testing Checklist

- [ ] Create room with 2 players (minimum)
- [ ] Create room with 12 players (maximum)
- [ ] Block 13th player from joining
- [ ] Test all 3 game modes
- [ ] Drop It image upload/compress/delete
- [ ] Emoji reactions increment correctly
- [ ] Reports auto-hide at 3 count
- [ ] Ads display at correct intervals
- [ ] Capacity warning at high load
- [ ] Room cleanup after inactivity
- [ ] Profanity filter blocks inappropriate content

## 📝 Environment Variables Needed

Create a `.env` file based on `.env.example`:

```bash
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
```

## 🤝 Contributing

This is an MVP. Future enhancements could include:
- Push notifications for game events
- Custom prompt submission
- Room passwords
- More game modes
- Enhanced analytics

## 📄 License

This project is private and not open source.

## 🆘 Troubleshooting

### Firebase Connection Issues
- Verify `.env` file has correct credentials
- Check Firebase project is active
- Ensure Firestore and Storage are enabled

### AdMob Not Showing Ads
- Test ads work automatically in development
- For production, verify AdMob account is approved
- Check ad unit IDs are correct in code

### Image Upload Failing
- Verify Storage security rules are deployed
- Check image size is under 500KB
- Ensure Firebase Storage is enabled

### Room Not Found
- Rooms auto-delete after 24 hours of inactivity
- Check room code is correct (6 characters, uppercase)

## 📞 Support

For issues or questions, refer to:
- [Firebase Documentation](https://firebase.google.com/docs)
- [Expo Documentation](https://docs.expo.dev)
- [AdMob Help Center](https://support.google.com/admob)

---

Built with ❤️ using Expo and Firebase
