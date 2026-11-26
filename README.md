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

| Method | Path | Access | Notes |
| --- | --- | --- | --- |
| `POST` | `/auth/register` | **Public** | Hashes password with `bcrypt`; `409` for duplicate email |
| `POST` | `/auth/login` | **Public** | Returns `{ token, user }`; `401` for wrong details |
| `GET` | `/auth/me` | **Protected** (`requireAuth`) | Returns `{ _id, id, email }` (never password) |
| `GET` | `/tags` | **Public** | Lists seeded tags (`Work`, `Personal`, `Urgent`) |
| `GET` | `/notes` | **Public** | Populates `owner` (`email`) & `tags` (`name`); supports `?search=`, `?tag=<tagId>`, `?pinned=true`, `?page=` (limit 5); sorted pinned-first; returns `{ notes, pagination }` |
| `GET` | `/notes/mine` | **Protected** (`requireAuth`) | Mounted **above** `/:id`; returns only the logged-in user's notes |
| `GET` | `/notes/:id` | **Public** | `findNote` (`Note.findById`); `400` bad ID, `404` missing |
| `POST` | `/notes` | **Protected** (`requireAuth`) | Saves `ownerId: req.user.id` and optional `tags: [tagId]` |
| `PATCH` | `/notes/:id` | **Protected** (`requireAuth` + `checkOwner`) | Only the owner may update (`403` otherwise) |
| `PATCH` | `/notes/:id/pin` | **Protected** (`requireAuth` + `checkOwner`) | Toggles `pinned` (`403` for non-owners) |
| `DELETE` | `/notes/:id` | **Protected** (`requireAuth` + `checkOwner`) | Only the owner may delete (`403` otherwise) |
| `GET` | `/stats` | **Public** | Request counts by HTTP method |

## React Client

The `client/` app shows `Hello, <email>` via `GET /auth/me`, **All Notes** /
**My Notes**, each note's owner email and tag pills, search, tag filter chips
(`?tag=<tagId>`), and page buttons (`limit=5`):

```sh
cd client
npm install
npm run dev
```
