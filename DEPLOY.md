# Deploying FleetFlow

One container runs the Express + Socket.io API **and** serves the built React
SPA, so the browser talks to a single origin: cookies stay first-party, the
realtime socket needs no CORS, and there is one URL to share.

```
browser ─── https://fleetflow.fly.dev ───┐
                                         ├── Express: /api, /socket.io
                                         └── static: frontend/dist (SPA)
                                                     │
                                          fleetflow-db.internal:27017 (MongoDB)
```

## What is in the repo

| File | Purpose |
|---|---|
| `Dockerfile` | Stage 1 builds the SPA, stage 2 runs the API and serves `frontend/dist` |
| `fly.toml` | Web + API app (`fleetflow`), port 8080, one warm machine |
| `deploy/mongo/fly.toml` | Private MongoDB app (`fleetflow-db`) with a persistent volume |
| `.dockerignore` | Keeps `node_modules`, build output, and `.env` files out of the image |

## 1. Apps and database

```bash
fly apps create fleetflow -o personal
fly apps create fleetflow-db -o personal
fly volumes create mongo_data --app fleetflow-db --region bom --size 1
```

## 2. Secrets

```bash
# database app: root password for the initialised volume
fly secrets set --app fleetflow-db MONGO_INITDB_ROOT_PASSWORD='<strong-password>'

# web + api app
fly secrets set --app fleetflow \
  MONGODB_URI='mongodb://fleetflow:<strong-password>@fleetflow-db.internal:27017/fleetflow?authSource=admin' \
  JWT_SECRET="$(openssl rand -hex 32)" \
  FRONTEND_URL='https://fleetflow.fly.dev' \
  CLERK_SECRET_KEY='sk_test_...' \
  CLERK_DEFAULT_ORG_SLUG='fleetflow-demo'
```

`NODE_ENV` and `PORT` come from `fly.toml`. Google/GitHub sign-in needs the
Clerk secret **and** the publishable key baked into the bundle at build time.

## 3. Deploy

```bash
fly deploy --app fleetflow-db --config deploy/mongo/fly.toml
fly deploy --app fleetflow \
  --build-arg VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
```

## 4. Seed the demo data

`seed-demo-data.js` bootstraps an empty database: it creates the demo
organization and users when they are missing, then generates eight months of
fleet history.

```bash
fly ssh console --app fleetflow -C "node seed-demo-data.js"
```

Demo logins (created by the seed):

- `admin@fleetflow.io` / `FleetFlow@2026` — fleet manager
- `dispatcher@fleetflow.io` / `FleetFlow@2026` — dispatcher

## Notes

- The Clerk instance in use is a **development** instance (`pk_test_`/`sk_test_`),
  so Clerk logs a usage-limit warning and its OAuth screens show the dev banner.
  Create a production instance and swap both keys for a public launch.
- Cookies are `HttpOnly; Secure; SameSite=Strict` in production, which is why the
  SPA is served from the API origin instead of a separate host.
- `MONGODB_URI` in `backend/.env` still points at local MongoDB for development;
  `npm run dev` + `npm run build` behave exactly as before.
