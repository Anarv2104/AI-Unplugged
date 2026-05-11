# Production Checklist

Use this checklist before making AI Unplugged live. The app uses Postgres for all application data. Firebase is auth only.

## 1. Decide Hosting

- Choose one app host: Render, Railway, Fly, AWS EC2/VPS, or equivalent Node hosting.
- Choose hosted Postgres: Render/Railway/Fly Postgres, AWS RDS, Neon, Supabase Postgres, or equivalent.
- Confirm upload persistence:
  - VPS/EC2: persistent disk path for `UPLOAD_DIR`.
  - Managed host: persistent disk/volume, or migrate uploads to object storage before production traffic.
- Confirm the final domain and DNS access.

## 2. Prepare Secrets

Backend secrets:

- `DATABASE_URL`
- `PUBLIC_BASE_URL`
- `UPLOAD_DIR`
- `FIREBASE_SERVICE_ACCOUNT_PATH`
- `BREVO_API_KEY`
- `BREVO_SENDER_EMAIL`
- `BREVO_SENDER_NAME`
- `BOOTSTRAP_ADMIN_EMAILS`

Frontend build secrets:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

Reference templates:

- `backend/.env.production.example`
- `frontend/.env.production.example`

## 3. Build

From repo root:

```bash
cd frontend
npm ci
npm run build

cd ../backend
npm ci
npx prisma generate
npx prisma migrate deploy
```

## 4. Start Backend

Managed platform:

- Build command should run frontend build, backend install, Prisma generate, and Prisma migrate deploy.
- Start command should run from `backend`: `npm start`.
- Set env vars in the provider dashboard.
- Ensure the backend can serve `../frontend/dist`.

VPS/EC2:

- Use systemd or a process manager.
- Put nginx/Caddy in front of `localhost:8000`.
- Enable HTTPS.
- Keep `backend/uploads` on persistent disk.

## 5. Verify Health

- Open `https://your-domain.com/api/platform/health`.
- Confirm response has `"ok": true`.
- Log in with a bootstrap admin email.
- Open Admin dashboard.
- Confirm Firebase Admin status is `ready`.
- Confirm Admin -> Errors has no new critical startup errors.

## 6. Verify Core Flows

- Create a published test event.
- Submit an event registration and confirm it appears in Admin -> Events -> Registrations.
- Confirm registration row exists in Postgres.
- Test capacity:
  - Set capacity to `1`.
  - Submit two registrations.
  - Confirm second registration is `waitlisted`.
- Test invite-only:
  - Create Invite Only event.
  - Add invite in Admin.
  - Send invite email.
  - Open invite link and register.
- Test Host application.
- Test Node Lead application.
- Test resource/update publishing.
- Test upload persistence by uploading a resource image or attachment, restarting the service, and opening the uploaded file URL.

## 7. Email Verification

- Confirm Brevo sender is verified.
- Confirm event registration confirmation email sends.
- Confirm waitlist email sends.
- Confirm invite email sends.
- Confirm newsletter campaign sends to intended recipients only.

## 8. Launch

- Point DNS to the selected host.
- Set `PUBLIC_BASE_URL` to the final HTTPS domain.
- Rebuild/redeploy after changing production env vars.
- Run `npx prisma migrate deploy` on the production database.
- Monitor logs and Admin -> Errors during launch.

## 9. Backups And Operations

- Enable daily Postgres backups.
- Keep a backup/restore plan for uploaded files.
- Rotate Brevo and Firebase service account credentials if they were shared outside the deployment team.
- Keep `deployment-guide.md` updated with provider-specific final decisions.
