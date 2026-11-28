# Notes API (Owners, Tags, Search & Pagination)

An Express, CORS, and Mongoose API for the Notes App class exercise (Step 12).
Links `Note` documents to `User` (`ownerId` + `.populate("owner", "email")`)
and `Tag` (`tags: [ObjectId ref Tag]` + `.populate("tags", "name")`), enforces
`checkOwner` (`403`), and supports `GET /notes/mine`, `?search=`, `?tag=<tagId>`,
and `?page=` pagination (default limit 5).

## Setup with MongoDB Atlas

1. Copy `.env.example` to `.env` and fill in `JWT_SECRET` and `MONGO_URI`:

```sh
cp .env.example .env
```

2. Install dependencies and start the server (`connectDB()` and
   `seedDefaultTags()` run before `app.listen()`, seeding `Work`, `Personal`,
   and `Urgent` tags):

```sh
npm install
npm run dev
```

The server listens at `http://localhost:3002`. Run tests with `npm test`.

## Models & Relationships

- **`User`** (`models/User.js`): unique lowercase `email`, `passwordHash`
  (stripped in `toJSON`), timestamps.
- **`Tag`** (`models/Tag.js`): unique required `name` (`Work`, `Personal`,
  `Urgent` seeded automatically on startup).
- **`Note`** (`models/Note.js`): required `title` (min 3 chars), `body`,
  `pinned` (default `false`), `ownerId` (`ObjectId` ref `User`, with virtual
  `owner` for `.populate("owner", "email")`), and `tags` (`[ObjectId]` ref
  `Tag`, populated via `.populate("tags", "name")`).

## Endpoints

Protected routes require `Authorization: Bearer <token>`.

| Method   | Path             | Access                                       | Notes                                                                                                                                                                        |
| -------- | ---------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST`   | `/auth/register` | **Public**                                   | Hashes password with `bcrypt`; `409` for duplicate email                                                                                                                     |
| `POST`   | `/auth/login`    | **Public**                                   | Returns `{ token, user }`; `401` for wrong details                                                                                                                           |
| `GET`    | `/auth/me`       | **Protected** (`requireAuth`)                | Returns `{ _id, id, email }` (never password)                                                                                                                                |
| `GET`    | `/tags`          | **Public**                                   | Lists seeded tags (`Work`, `Personal`, `Urgent`)                                                                                                                             |
| `GET`    | `/notes`         | **Public**                                   | Populates `owner` (`email`) & `tags` (`name`); supports `?search=`, `?tag=<tagId>`, `?pinned=true`, `?page=` (limit 5); sorted pinned-first; returns `{ notes, pagination }` |
| `GET`    | `/notes/mine`    | **Protected** (`requireAuth`)                | Mounted **above** `/:id`; returns only the logged-in user's notes                                                                                                            |
| `GET`    | `/notes/:id`     | **Public**                                   | `findNote` (`Note.findById`); `400` bad ID, `404` missing                                                                                                                    |
| `POST`   | `/notes`         | **Protected** (`requireAuth`)                | Saves `ownerId: req.user.id` and optional `tags: [tagId]`                                                                                                                    |
| `PATCH`  | `/notes/:id`     | **Protected** (`requireAuth` + `checkOwner`) | Only the owner may update (`403` otherwise)                                                                                                                                  |
| `PATCH`  | `/notes/:id/pin` | **Protected** (`requireAuth` + `checkOwner`) | Toggles `pinned` (`403` for non-owners)                                                                                                                                      |
| `DELETE` | `/notes/:id`     | **Protected** (`requireAuth` + `checkOwner`) | Only the owner may delete (`403` otherwise)                                                                                                                                  |
| `GET`    | `/health`        | **Public**                                   | Reports server health & MongoDB `readyState` (`200` connected / `503` disconnected; zero secrets)                                                                            |
| `GET`    | `/stats`         | **Public**                                   | Request counts by HTTP method                                                                                                                                                |

## Deployment (Render + `notes-prod`)

- **Live API URL:** `https://<your-notes-api>.onrender.com` _(replace after Render deploys)_
- **Health check:** `GET /health` reports `mongoose.connection.readyState` (`1` = `connected`)

### Render Web Service Settings

See [render.yaml](./render.yaml) or configure manually on Render:

| Setting               | Value                                                                                  |
| --------------------- | -------------------------------------------------------------------------------------- |
| **Root Directory**    | `.` _(blank if pushed as its own repo; or the subfolder path if inside a parent repo)_ |
| **Runtime**           | Node (`>=20.0.0`, from `package.json` `engines`)                                       |
| **Build Command**     | `npm install`                                                                          |
| **Start Command**     | `npm start`                                                                            |
| **Health Check Path** | `/health`                                                                              |

### Environment Variables on Render

| Variable     | Value Guidance                                                                                           |
| ------------ | -------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`   | `production`                                                                                             |
| `MONGO_URI`  | Atlas URI using production database name **`notes-prod`** (`.../notes-prod?retryWrites=true&w=majority`) |
| `JWT_SECRET` | **Brand-new** random secret generated for production                                                     |
| `CLIENT_URL` | Deployed frontend origin(s) for CORS                                                                     |

_(Render sets `PORT` automatically; `.env` is ignored in `.gitignore`.)_

### Seed Production Data (`notes-prod`)

Run once with `MONGO_URI` pointing to `notes-prod` (default tags `Work`,
`Personal`, `Urgent` also auto-seed on startup):

```sh
npm run seed
```

Creates test login `demo@notes.test` / `notes1234` and a starter welcome note.

### Step 14 Checklist

- [x] `PORT` from `process.env`, `start` script, and `engines` in `package.json`
- [x] `.gitignore` excludes `.env`; `.env.example` lists every variable name
- [x] Smart `GET /health` reports `mongoose.connection.readyState` (`1` = connected)
- [x] `CLIENT_URL` CORS config, `seed.js`, and `render.yaml` ready
- [ ] Push to a GitHub repo and create the Render Web Service with `notes-prod` + new `JWT_SECRET`
- [ ] Test `/health`, register, login, and creating a note against the live URL (and share with your neighbour!)

## React Client & Vercel Deployment (Step 15)

The `client/` app uses `VITE_API_URL` (zero `localhost` in `client/src/`),
shows `Hello, <email>` via `GET /auth/me`, **All Notes** / **My Notes**, owner
email, tag pills, search, tag filters (`?tag=<tagId>`), and page buttons.

### Run Locally

```sh
cd client
cp .env.example .env
npm install
npm run dev
```

### Deploy Frontend to Vercel

| Setting                  | Value                                                    |
| ------------------------ | -------------------------------------------------------- |
| **Root Directory**       | `client`                                                 |
| **Framework Preset**     | `Vite`                                                   |
| **Build Command**        | `npm run build`                                          |
| **Output Directory**     | `dist`                                                   |
| **Environment Variable** | `VITE_API_URL` = `https://<your-notes-api>.onrender.com` |

`client/vercel.json` rewrites every route (`/(.*)`) to `/index.html` so
refreshing any deep link on Vercel works without a 404.

### Preview Branch CORS Challenge

1. Create a branch, update `<title>` in `client/index.html`, commit, and push:
   ```sh
   git checkout -b preview-title
   # update <title> in client/index.html, then commit
   git push -u origin preview-title
   ```
2. Open the Vercel Preview URL and inspect the CORS error in DevTools.
3. On Render, add the preview URL to `CLIENT_URL` (comma-separated, e.g.
   `https://<prod>.vercel.app,https://<preview>.vercel.app`), redeploy/save, and
   refresh the preview link to confirm CORS succeeds.

### Step 15 Checklist

- [x] Removed `localhost` from `client/src/`; uses `VITE_API_URL` everywhere (`client/.env.example`)
- [x] `npm run build` and `npm run preview` verified clean
- [x] Added `client/vercel.json` for SPA deep-link refreshes
- [x] `CLIENT_URL` CORS supports comma-separated production + preview URLs
- [x] Production hardening: plain 500s in production (`errorHandler`), `requireDb` (`503`), timing logger, 15s Axios timeout + `getErrorMessage` + **Try again**, and [RUNBOOK.md](./RUNBOOK.md)
- [ ] Create Vercel project (`Root Directory: client`, `VITE_API_URL`) and set `CLIENT_URL` on Render
- [ ] Test register, login, add note, and refresh on a deep link from your phone
- [ ] Push a preview branch with a changed page title, observe the CORS error, and fix it via `CLIENT_URL`

## Automated Test Suite (Step 17)

The API uses **Vitest** and **Supertest** (`vitest.config.js` + `test/setup.js`) with `app.js` split from `server.js` so tests run directly against Express without opening a permanent server port.

### Running the Tests

```sh
npm test
```

- Uses a dedicated **`notes-test`** database (`MONGO_URI_TEST` in `.env.example`) whose name is verified to end in `-test` before any test runs, and empties all collections after every test so tests never touch `notes-dev` or `notes-prod`.
- If `MONGO_URI_TEST` is not configured locally, `test/setup.js` automatically runs against an isolated in-memory `notes-test` database adapter with the same `-test` safety guard.

### What the Tests Cover

- **Shared `getToken` helper** (`test/helpers.js`) registers and logs in fresh test users.
- **Auth (`test/auth.test.js`):** register (`201`, hashed password, no `passwordHash` leaked), repeated email (`409`), wrong password (`401`), missing token on protected routes (`401`), and `GET /auth/me` (`200`).
- **Notes & Failure Paths (`test/notes.test.js`):** `GET /notes`, `POST /notes` (`201`) with populated owner & tags, `GET /notes/mine`, search/tag/pagination, missing or short title (`400`), updating/pinning/deleting another user's note (`403`), bad note ID (`400`), missing note ID (`404`), `/health`, `requireDb` (`503`), and production `errorHandler` (`500`).
