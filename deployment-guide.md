# AI Unplugged Deployment Guide

## Architecture

AI Unplugged uses:

- React/Vite frontend built into `frontend/dist`.
- Node backend in `backend/server.js`.
- Postgres as the only application database, managed by Prisma.
- Firebase only for authentication. Do not store app submissions in Firebase/Firestore.
- Uploads use `STORAGE_DRIVER=local` by default under `backend/uploads`. Production must either mount persistent storage for `UPLOAD_DIR` or set `STORAGE_DRIVER=s3` with S3/object-storage config.

Homebrew Postgres is only for local development. Production needs a real Postgres service such as AWS RDS, Neon, Supabase Postgres, Railway Postgres, Render Postgres, or a managed Postgres attached to your server.

## Recommended Production Setup

Use one of these:

- VPS or AWS EC2 running Node + systemd + nginx/Caddy, with managed Postgres.
- Render/Railway/Fly for the Node web service, with their managed Postgres.
- AWS ECS/Elastic Beanstalk/App Runner with RDS Postgres.

Keep uploads persistent. On a VPS, mount/backup `backend/uploads`. On managed app platforms, configure a persistent disk or enable S3/object storage before production traffic.

Do not deploy `backend/functions` for production. It is a legacy Firebase Functions/Firestore implementation kept for reference; production uses `backend/server.js` with Postgres.

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
STORAGE_DRIVER=local
UPLOAD_DIR=./uploads
# Optional if STORAGE_DRIVER=s3:
# S3_BUCKET=your-bucket
# S3_REGION=ap-south-1
# S3_ACCESS_KEY_ID=...
# S3_SECRET_ACCESS_KEY=...
# S3_PUBLIC_BASE_URL=https://cdn.your-domain.com
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
- Configure persistent storage for `UPLOAD_DIR`, or set `STORAGE_DRIVER=s3` and configure durable object storage before production traffic.

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
- Back up `UPLOAD_DIR` if using local storage, or enable bucket lifecycle/versioning/backups if using S3.
- Monitor the `AppErrorLog` admin section for backend issues.
- Do not rely on local `brew services start postgresql@16` in production.

## Health Checks

- Backend: `GET /api/platform/health`
- Admin setup diagnostics: Admin dashboard “Local backend setup”
- Verify Firebase Admin status is `ready`.
- Verify database errors are not appearing in Admin → Errors after deploy.
- Verify the health response shows the expected storage driver and enabled production safeguards.

## Production Safeguards

- The backend applies basic security headers on API/static responses.
- The backend applies in-memory rate limits to public submissions, comments, uploads, auth/profile routes, newsletters, exports, and admin mutations.
- JSON API bodies are limited to roughly 1 MB.
- SkillDB Markdown uploads are limited to 2 MB.
- Update attachments and resource images are limited to 10 MB.
- File logs are written under `LOG_DIR`; in production, prefer provider logs or mount `LOG_DIR` on persistent storage.

## Launch Checklist

Use `PRODUCTION_CHECKLIST.md` for the final go-live checklist. It covers secrets, build commands, migrations, admin verification, Postgres persistence, email checks, invite-only flow, capacity/waitlist checks, uploads, backups, and monitoring.
