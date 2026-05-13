# Legacy Firebase Functions

This folder is retained only as a historical reference.

Production deployment for this project uses:

- `backend/server.js` as the Node/Postgres backend
- Postgres via Prisma for application data
- Firebase only for authentication

Do not deploy this `backend/functions` folder for production unless it is deliberately rewritten to match the current Postgres backend behavior.
