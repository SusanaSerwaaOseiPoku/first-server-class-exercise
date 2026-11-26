# Notes API

An Express and CORS API for the Notes App class exercise, extended with
`bcrypt` password hashing, JWT login, `requireAuth` middleware, note
ownership (`ownerId`), and `GET /auth/me`.

## Run the API

Requirements: Node.js 20 or newer and npm.

1. Copy `.env.example` to `.env` and set `JWT_SECRET`:

```sh
cp .env.example .env
```

2. Install dependencies and start the API:

```sh
npm install
npm run dev
```

The server listens at `http://localhost:3002`. Run tests with `npm test`.

> `.env` is listed in `.gitignore` so secrets stay out of Git.

## Endpoints

Protected routes require `Authorization: Bearer <token>`.

| Method | Path | Access | Request | Success | Errors |
| --- | --- | --- | --- | --- | --- |
| `POST` | `/auth/register` | **Public** | JSON: `email`, `password` (min 6 chars) | `201` `{ id, email }` (password hashed with `bcrypt`) | `400` invalid input; `409` repeated email |
| `POST` | `/auth/login` | **Public** | JSON: `email`, `password` | `200` `{ token, user }` | `401` wrong email or password |
| `GET` | `/auth/me` | **Protected** (`requireAuth`) | Bearer token | `200` `{ id, email }` (never returns password) | `401` missing or invalid token |
| `GET` | `/notes` | **Public** | Optional `?pinned=true` | `200` all notes (or pinned only) | - |
| `GET` | `/notes/:id` | **Public** | ID path parameter | `200` one note | `404` unknown note |
| `POST` | `/notes` | **Protected** (`requireAuth`) | JSON: `title` (3+ chars), optional `body`, `pinned` | `201` created note with `ownerId: req.user.id` | `400` invalid fields; `401` unauthenticated |
| `PATCH` | `/notes/:id` | **Protected** (`requireAuth` + owner) | JSON: one or more of `title`, `body`, `pinned` | `200` updated note | `400` invalid fields; `401` unauthenticated; `403` not owner; `404` unknown note |
| `DELETE` | `/notes/:id` | **Protected** (`requireAuth` + owner) | ID path parameter | `204` no content | `401` unauthenticated; `403` not owner; `404` unknown note |
| `GET` | `/stats` | **Public** | - | `200` request total and method counts | - |

## React Client (Challenge)

The `client/` folder contains a small React + Axios frontend that logs in,
calls `GET /auth/me` to render `Hello, <email>`, and lets you view public
notes or create/update/delete your own notes:

```sh
cd client
npm install
npm run dev
```
