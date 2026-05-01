# Frontend Setup

## Install

```bash
cd frontend
npm install
```

## Create env

Copy `.env.example` to `.env` and fill in the Firebase Web App values from:

Firebase Console -> Project settings -> General -> Your apps -> Web app

Required values:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_FUNCTIONS_REGION`

## Firebase console steps

1. Create a Firebase project.
2. Add a Web App.
3. Enable Firestore.
4. Enable Authentication:
   Email/Password
   Google
5. Add authorized domains:
   `localhost`
   your production domain

## Run

```bash
npm run dev
```

## Build

```bash
npm run build
```
