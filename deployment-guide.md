# AI Unplugged Deployment Guide

## Architecture

AI Unplugged uses:

- React/Vite frontend built into `frontend/dist`.
- Node backend in `backend/server.js`.
- Postgres as the only application database, managed by Prisma.
- Firebase only for authentication. Do not store app submissions in Firebase/Firestore.
- Local filesystem uploads under `backend/uploads` unless you replace storage with a persistent volume or object storage later.

Homebrew Postgres is only for local development. Production needs a real Postgres service such as AWS RDS, Neon, Supabase Postgres, Railway Postgres, Render Postgres, or a managed Postgres attached to your server.

## Recommended Production Setup

Use one of these:

- VPS or AWS EC2 running Node + systemd + nginx/Caddy, with managed Postgres.
- Render/Railway/Fly for the Node web service, with their managed Postgres.
- AWS ECS/Elastic Beanstalk/App Runner with RDS Postgres.

Keep uploads persistent. On a VPS, mount/backup `backend/uploads`. On managed app platforms, configure a persistent disk or move uploads to object storage before production traffic.

## Provider-Neutral Handoff

Give the deployment team these files first:

- `deployment-guide.md`
- `PRODUCTION_CHECKLIST.md`
- `backend/.env.production.example`
- `frontend/.env.production.example`
- `backend/prisma/schema.prisma`

The deployment team must provide:

- Final production domain, for example `https://aiunplugged.club`.
- DNS access for the domain.
- Hosted Postgres `DATABASE_URL`.
- Firebase Web App config for the frontend.
- Firebase Admin service account JSON for the backend.
- Brevo API key and verified sender email.
- Bootstrap admin email list.

Do not use `backend/.env`, `frontend/.env`, Homebrew Postgres, or local service account files as production defaults.

## Required Environment

Backend `.env`:

```bash
PORT=8000
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DBNAME?sslmode=require
FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccount.json
PUBLIC_BASE_URL=https://your-domain.com
UPLOAD_DIR=./uploads
BREVO_API_KEY=...
BREVO_SENDER_EMAIL=...
BREVO_SENDER_NAME=AI Unplugged
BOOTSTRAP_ADMIN_EMAILS=admin@example.com
```

Frontend `.env` needs only Firebase client auth values.

Production templates:

- Backend: `backend/.env.production.example`
- Frontend: `frontend/.env.production.example`

## Build And Deploy

```bash
git clone <repo-url>
cd <repo>

cd frontend
npm ci
npm run build

cd ../backend
npm ci
npx prisma generate
npx prisma migrate deploy
npm start
```

The backend serves both `/api/*` and the built frontend from `frontend/dist`.

## Managed App Hosts

For Render, Railway, Fly, or similar:

- Use the repo root as the deploy source.
- Build the frontend before starting the backend.
- Run Prisma migrations against hosted Postgres before app start.
- Start the backend from `backend` using `npm start`.
- Set all backend variables from `backend/.env.production.example` in the provider dashboard.
- Set frontend build variables from `frontend/.env.production.example` before `npm run build`.
- Configure persistent storage for `UPLOAD_DIR`, or move uploads to durable object storage before production traffic.

Generic command sequence:

```bash
cd frontend && npm ci && npm run build
cd ../backend && npm ci && npx prisma generate && npx prisma migrate deploy
cd backend && npm start
```

Some providers split build and start commands. In that case, keep migrations in the release/deploy phase and keep `npm start` as the runtime command.

## Process Manager

For a VPS, use systemd:

```ini
[Unit]
Description=AI Unplugged
After=network.target

[Service]
Type=simple
WorkingDirectory=/var/www/ai-unplugged/backend
EnvironmentFile=/var/www/ai-unplugged/backend/.env
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Then run:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now ai-unplugged
sudo journalctl -fu ai-unplugged
```

Put nginx or Caddy in front of `localhost:8000` with HTTPS.

## Domain And DNS

Use the final HTTPS domain in:

- `PUBLIC_BASE_URL`
- Firebase Authentication authorized domains
- Brevo sender/domain verification if sending from the production domain
- DNS records at the chosen hosting provider

After DNS is active, verify:

```bash
curl https://your-domain.com/api/platform/health
```

## Database Operations

- Run `npx prisma migrate deploy` on every deployment.
- Back up Postgres daily.
- Monitor the `AppErrorLog` admin section for backend issues.
- Do not rely on local `brew services start postgresql@16` in production.

## Health Checks

- Backend: `GET /api/platform/health`
- Admin setup diagnostics: Admin dashboard “Local backend setup”
- Verify Firebase Admin status is `ready`.
- Verify database errors are not appearing in Admin → Errors after deploy.

## Launch Checklist

Use `PRODUCTION_CHECKLIST.md` for the final go-live checklist. It covers secrets, build commands, migrations, admin verification, Postgres persistence, email checks, invite-only flow, capacity/waitlist checks, uploads, backups, and monitoring.
