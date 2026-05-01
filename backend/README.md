# Backend Setup

## Install

```bash
cd backend
npm run functions:install
```

## Local server

The backend server serves the built frontend from `../frontend/dist` and exposes the local platform API used for auth sync, registrations, comments, admin actions, exports, and newsletters.

Build the frontend first:

```bash
cd ../frontend
npm run build
```

Then start the backend:

```bash
cd ../backend
npm run start
```

## Local `.env`

Create `backend/.env` from `backend/.env.example`.

Required local values:

- `FIREBASE_SERVICE_ACCOUNT_PATH`
- `BREVO_API_KEY`
- `BREVO_SENDER_EMAIL`
- `BREVO_SENDER_NAME`
- `BOOTSTRAP_ADMIN_EMAILS`

`FIREBASE_SERVICE_ACCOUNT_PATH` should point at a downloaded Firebase service account JSON inside `backend/`.

Generate it from:

- Firebase Console -> Project settings -> Service accounts -> Generate new private key

## Firebase configuration still in repo

The backend still includes:

- `firebase.json`
- `firestore.rules`
- `firestore.indexes.json`
- `functions/`

Those are kept for a future deploy path, but they are not required for free local testing.

## Where credentials come from

- `FIREBASE_SERVICE_ACCOUNT_PATH`
  Firebase Console -> Project settings -> Service accounts -> Generate new private key
- `BREVO_API_KEY`
  Brevo -> SMTP & API -> API keys
- `BREVO_SENDER_EMAIL`
  a verified sender configured in Brevo
- `BREVO_SENDER_NAME`
  your sender display name
- `BOOTSTRAP_ADMIN_EMAILS`
  your chosen trusted admin emails

## Deploy checklist

1. Frontend env created
2. Firebase Auth enabled for Email/Password and Google
3. Firestore created
4. Authorized domains added
5. `backend/.env` created
6. Firebase service account JSON downloaded into `backend/`
7. Brevo sender verified and API key added
8. Frontend build completed
9. Backend started locally
