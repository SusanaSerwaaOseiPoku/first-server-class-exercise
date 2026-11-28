# Notes App Production Runbook

Operational guide for running, debugging, and recovering the live Notes API
(Render) and Notes React App (Vercel). **No secret values are stored in this
document—variable names only.**

---

## 1. Live Services & Architecture

- **Frontend (Vercel):** Static Vite/React bundle built from `client/` (`dist/`),
  using `client/vercel.json` to rewrite all routes to `/index.html`.
- **Backend API (Render):** Node 20+ Express + Mongoose service started with
  `npm start` (`node server.js`), calling `connectDB()` and `seedDefaultTags()`
  before listening on `PORT`.
- **Database (MongoDB Atlas):** Dedicated production database (`notes-prod`),
  kept strictly separate from local development (`notes-dev`).
- **Health Probe:** `GET /health` reports `mongoose.connection.readyState`
  (`1` = `connected`, HTTP `200`; otherwise HTTP `503`). Database-backed routes
  (`/auth`, `/notes`, `/tags`) are guarded by `requireDb` (`503` if disconnected).

---

## 2. Environment Variables (Names Only)

### Render (Backend API)

- `PORT` — Injected automatically by Render.
- `NODE_ENV` — Set to `production` (ensures 500 errors return a plain sentence
  with no internal details).
- `MONGO_URI` — MongoDB Atlas connection string pointing to the `notes-prod`
  database.
- `JWT_SECRET` — Dedicated production-only signing secret (never shared with
  local dev).
- `CLIENT_URL` — Allowed Vercel production and preview origin URL(s),
  comma-separated.

### Vercel (Frontend Client)

- `VITE_API_URL` — Public HTTPS base URL of the Render API (no trailing slash).
  Trigger a Vercel redeploy after changing any `VITE_*` variable.

---

## 3. Deployment & Seeding Procedure

1. Push tested changes to `main` on GitHub (`npm test` in API + `npm run build`
   in `client/`).
2. Confirm Render runs `npm install` (Build) and `npm start` (Start) and logs
   `Connected to MongoDB (.../notes-prod)` followed by `Notes API listening on port ...`.
3. Verify `GET <API_URL>/health` returns HTTP `200` with
   `database.status: "connected"` and `database.readyState: 1`.
4. To seed starter tags and the demo account into `notes-prod` once, run
   `npm run seed` with `MONGO_URI` targeting `notes-prod`.
5. Confirm Vercel finishes building `client/` and verify login, note creation,
   pin toggle, and refreshing a deep link on mobile.

---

## 4. Troubleshooting (Which Side to Check First)

1. **Hit `GET <API_URL>/health` first:**
   - **No response / 502 / 503:** Check **Render Logs** for startup failure
     (`Startup aborted: ...`). Most common causes: missing `MONGO_URI`, wrong
     Atlas DB credentials, or Atlas Network Access blocking Render IPs.
   - **200 with `database.status: "connected"`:** API and database are healthy;
     inspect the browser next.
2. **Inspect Browser DevTools (Network & Console):**
   - **15s Timeout banner + "Try again" button:** Render free-tier cold start
     took longer than 15 seconds; wait a few seconds and click **Try again**.
   - **CORS error:** Verify `CLIENT_URL` on Render matches the exact Vercel
     production or preview URL (including `https://`, no typo).
   - **503 JSON on `/notes` or `/auth`:** `requireDb` detected a dropped
     MongoDB connection; check Atlas cluster status and Render logs.
   - **404 on browser refresh:** Confirm `client/vercel.json` is present and
     Vercel Root Directory is `client`.
3. **Logging rule:** Request logs record only `METHOD URL STATUS TIMING_MS` and
   never log passwords, JWT tokens, or request bodies.

---

## 5. Rollback & Secret Rotation

- **Frontend rollback (Vercel):** Project → **Deployments** → last known-good
  production deploy → **Instant Rollback**.
- **Backend rollback (Render):** Service → **Events / Deploys** → last working
  deploy → **Rollback to this deploy**.
- **Git rollback:** Run `git revert <commit>` and push to `main` so both hosts
  redeploy cleanly without rewriting history.
- **Secret rotation:** If `JWT_SECRET` or `MONGO_URI` is ever exposed, generate
  a new secret/DB password immediately in Atlas and Render Environment Variables
  and redeploy Render (all existing tokens invalidate immediately).
