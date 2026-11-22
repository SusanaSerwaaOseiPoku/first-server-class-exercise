# Notes API

A small Express and CORS API for the Notes App class exercise. It keeps three
starter notes in memory, so changes reset when the server restarts.

## Run

Requirements: Node.js 20 or newer and npm.

```sh
npm ci
npm run dev
```

The server listens at `http://localhost:3002`. Run the tests with `npm test`.

## Endpoints

| Method | Path | Request | Success | Errors |
| --- | --- | --- | --- | --- |
| `GET` | `/notes` | Optional `?pinned=true` | `200` with all notes, or only pinned notes | - |
| `GET` | `/notes/:id` | ID as a path parameter | `200` with one note | `404` if unknown |
| `POST` | `/notes` | JSON: `title` (at least 3 characters); optional `body`, `pinned` | `201` with the created note | `400` if title is too short or fields have invalid types |
| `PATCH` | `/notes/:id` | JSON with one or more of `title`, `body`, `pinned` | `200` with the updated note | `400` for invalid fields; `404` if unknown |
| `DELETE` | `/notes/:id` | ID as a path parameter | `204` with no response body | `404` if unknown |

Notes have an `id`, `title`, `body`, and boolean `pinned` field. The initial
notes are **Welcome**, **Class exercise**, and **Remember**.
