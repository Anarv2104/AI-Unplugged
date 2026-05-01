# AI Unplugged

The repo is split into a dedicated frontend and backend:

- [frontend](./frontend): React + Vite app
- [backend](./backend): Node server, Firebase config, Firestore rules, local platform API, and future deploy helpers

Additional setup guides:

- [frontend/README.md](./frontend/README.md)
- [backend/README.md](./backend/README.md)

## Structure

```text
AI Unplugged/
├── frontend/
│   ├── src/
│   ├── css/
│   ├── package.json
│   └── vite.config.mjs
├── backend/
│   ├── functions/
│   ├── data/
│   ├── server.js
│   ├── package.json
│   ├── firebase.json
│   └── firestore.rules
└── README.md
```

## Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend env vars live in:

```text
frontend/.env
```

Use `frontend/.env.example` as the template for Firebase client config.

You will get these values from:

Firebase Console -> Project Settings -> General -> Your apps -> Web app

## Backend

```bash
cd backend
npm run start
```

For local free testing, the backend reads its own `.env`:

```text
backend/.env
```

Use `backend/.env.example` as the template.

The backend also expects a Firebase service account JSON in `backend/`, referenced by `FIREBASE_SERVICE_ACCOUNT_PATH`.

Install the bundled Firebase/XLSX dependencies with:

```bash
cd backend
npm run functions:install
```

The old Functions directory is still present for a future deploy path, but it is not required for local testing.

Backend env values should not be committed. Use:

```text
backend/.env.example
```

Required backend values:

- `FIREBASE_SERVICE_ACCOUNT_PATH`
- `BREVO_API_KEY`
- `BREVO_SENDER_EMAIL`
- `BREVO_SENDER_NAME`
- `BOOTSTRAP_ADMIN_EMAILS`

## Production Build

Build the frontend first:

```bash
cd frontend
npm run build
```

Then serve it from the backend:

```bash
cd ../backend
npm run start
```

The backend server now serves:

```text
../frontend/dist
```

If that build output does not exist yet, the backend returns a clear build-required message.

## Platform Ready Checklist

1. Fill in `frontend/.env`
2. Enable Firebase Email/Password auth
3. Enable Firebase Google auth
4. Add `localhost` and production domains to Firebase Authorized Domains
5. Create `backend/.env`
6. Add a Firebase service account JSON to `backend/`
7. Add Brevo and bootstrap-admin values to `backend/.env`
8. Build `frontend`
9. Install `backend/functions` dependencies
10. Start the backend locally
