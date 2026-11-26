# Notes API (MongoDB + Mongoose)

An Express, CORS, and Mongoose API for the Notes App class exercise (Step 11).
Users and notes are stored in **MongoDB Atlas** so data persists across server
restarts, with `bcrypt` password hashing, JWT login, `requireAuth`, `ownerId`,
`GET /auth/me`, and pinned-first sorting with `PATCH /notes/:id/pin`.

## Setup with MongoDB Atlas

Requirements: Node.js 20 or newer, npm, and a free MongoDB Atlas cluster.

1. Copy `.env.example` to `.env` and fill in `JWT_SECRET` and your Atlas
   `MONGO_URI`:

```sh
cp .env.example .env
```

2. Install dependencies and start the server (`connectDB()` runs before
   `app.listen()`):

```sh
npm install
npm run dev
```

The server listens at `http://localhost:3002`. Run tests with `npm test`.

> `.env` is listed in `.gitignore` so secrets stay out of Git.

### Proving data survives a restart

1. Register a user (`POST /auth/register`), log in (`POST /auth/login`), and
   create a note (`POST /notes`).
2. Stop the server (`Ctrl+C`) and start it again (`npm run dev`).
3. Call `GET /notes` and log in again with the same account — both the user and
   notes are still there in MongoDB.

## Models

- **`User`** (`models/User.js`): unique lowercase `email`, `passwordHash`
  (stripped in `toJSON`), timestamps.
- **`Note`** (`models/Note.js`): required `title` (min 3 chars), `body`
  (default `""`), `pinned` (`Boolean`, default `false`), required `ownerId`
  (`ObjectId` ref `User`), timestamps.

## Endpoints

Protected routes require `Authorization: Bearer <token>`. Invalid ObjectIds
return `400`; unknown valid ObjectIds return `404`.

| Method | Path | Access | Request | Success | Errors |
| --- | --- | --- | --- | --- | --- |
| `POST` | `/auth/register` | **Public** | JSON: `email`, `password` (min 6 chars) | `201` `{ _id, id, email }` (password hashed with `bcrypt`) | `400` invalid input; `409` repeated email |
| `POST` | `/auth/login` | **Public** | JSON: `email`, `password` | `200` `{ token, user }` | `401` wrong email or password |
| `GET` | `/auth/me` | **Protected** (`requireAuth`) | Bearer token | `200` `{ _id, id, email }` (never returns password) | `401` missing or invalid token |
| `GET` | `/notes` | **Public** | Optional `?pinned=true` | `200` notes sorted with pinned notes first | - |
| `GET` | `/notes/:id` | **Public** | MongoDB `_id` path parameter | `200` one note | `400` bad ID; `404` unknown note |
| `POST` | `/notes` | **Protected** (`requireAuth`) | JSON: `title` (3+ chars), optional `body`, `pinned` | `201` created note with `ownerId: req.user.id` | `400` invalid fields; `401` unauthenticated |
| `PATCH` | `/notes/:id` | **Protected** (`requireAuth` + owner) | JSON: one or more of `title`, `body`, `pinned` | `200` updated note | `400` bad ID or fields; `401` unauthenticated; `403` not owner; `404` unknown note |
| `PATCH` | `/notes/:id/pin` | **Protected** (`requireAuth` + owner) | MongoDB `_id` path parameter | `200` note with `pinned` toggled | `400` bad ID; `401` unauthenticated; `403` not owner; `404` unknown note |
| `DELETE` | `/notes/:id` | **Protected** (`requireAuth` + owner) | MongoDB `_id` path parameter | `204` no content | `400` bad ID; `401` unauthenticated; `403` not owner; `404` unknown note |
| `GET` | `/stats` | **Public** | - | `200` request total and method counts | - |

## React Client

The `client/` folder uses MongoDB `_id`, displays `Hello, <email>` via
`GET /auth/me`, and toggles pins via `PATCH /notes/:id/pin`:

```sh
cd client
npm install
npm run dev
```
