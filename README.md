# AI Unplugged

The repo is split into a dedicated frontend and backend:

- [frontend](./frontend): React + Vite app
- [backend](./backend): Node server backed by **Postgres** (data) and the **local filesystem** (uploads). **Firebase is used only for authentication.**

## Stack

- Frontend: React 18 + Vite
- Backend: Node.js HTTP server + Prisma + Postgres
- File storage: local filesystem under `backend/uploads/`, served at `/uploads/...`
- Auth: Firebase Authentication (ID token verified server-side via `firebase-admin`)

## Frontend (dev)

```bash
cd frontend
npm install
npm run dev
```

Frontend env vars: copy `frontend/.env.example` to `frontend/.env` and fill in the Firebase client config.

## Backend (dev)

Prerequisites:

1. Postgres 14+ running on the same host (or wherever `DATABASE_URL` points).
2. A Firebase service account JSON saved at `backend/serviceAccount.json` (referenced by `FIREBASE_SERVICE_ACCOUNT_PATH`).

Initial setup:

```bash
# 1. Create the database (one time)
createdb aiunplugged
# or, in psql:  CREATE DATABASE aiunplugged;

# 2. Configure backend env
cp backend/.env.example backend/.env
# Edit backend/.env and set DATABASE_URL, BREVO_*, BOOTSTRAP_ADMIN_EMAILS, etc.

# 3. Install backend dependencies and generate the Prisma client
cd backend
npm install
npx prisma migrate dev --name init   # creates tables and the Prisma client

# 4. Start the backend
npm run start
```

The backend listens on `PORT` (default `8000`) and serves both the API (`/api/*`) and the built frontend (`../frontend/dist`).

## Production deploy (single server, no Docker)

On the production server (Ubuntu/Debian shown):

```bash
# 1. System packages
sudo apt update
sudo apt install -y nodejs npm postgresql

# 2. Postgres role + database
sudo -u postgres psql <<'SQL'
CREATE ROLE aiu WITH LOGIN PASSWORD 'CHANGE_ME';
CREATE DATABASE aiunplugged OWNER aiu;
SQL

# 3. App
git clone <your-repo> /var/www/ai-unplugged
cd /var/www/ai-unplugged

# 4. Frontend build
cd frontend
npm ci
npm run build
cd ..

# 5. Backend
cd backend
npm ci
# Place serviceAccount.json into backend/ and create backend/.env (see backend/.env.example)
npx prisma migrate deploy
npm run start
```

For a long-running process, use systemd. Sample unit at `/etc/systemd/system/ai-unplugged.service`:

```ini
[Unit]
Description=AI Unplugged
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/ai-unplugged/backend
EnvironmentFile=/var/www/ai-unplugged/backend/.env
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now ai-unplugged
sudo journalctl -fu ai-unplugged
```

Front it with nginx/Caddy as a reverse proxy to `localhost:8000`.

## Database & uploads

- All collections previously in Firestore now live as Postgres tables managed by Prisma. Schema: `backend/prisma/schema.prisma`.
- Uploaded files (skill `.md` files, update attachments, resource images) live under `backend/uploads/` and are served by the backend at `GET /uploads/<path>`.
- Firebase is **only** used to verify ID tokens (`firebase-admin` on the backend, `firebase/auth` on the frontend).

## Required env values

Backend (`backend/.env`):

- `DATABASE_URL`
- `FIREBASE_SERVICE_ACCOUNT_PATH`
- `PUBLIC_BASE_URL` (production only — origin used for absolute upload URLs)
- `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`
- `BOOTSTRAP_ADMIN_EMAILS`

Frontend (`frontend/.env`): only the Firebase Auth keys are needed.

## Bootstrap an admin

Set your email in `BOOTSTRAP_ADMIN_EMAILS`, restart the backend, and sign in. Your `users.role` is upserted to `ADMIN` on the first auth sync.
