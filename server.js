import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";

const PORT = Number(process.env.PORT) || 3002;

export function createStarterNotes() {
  return [
    {
      id: "1",
      title: "Welcome",
      body: "This is your first note.",
      pinned: true,
    },
    {
      id: "2",
      title: "Class exercise",
      body: "Build a small Notes API with Express.",
      pinned: false,
    },
    {
      id: "3",
      title: "Remember",
      body: "Check the pinned notes filter.",
      pinned: true,
    },
  ];
}

export function createApp(notes = createStarterNotes()) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/notes", (request, response) => {
    const result =
      request.query.pinned === "true"
        ? notes.filter((note) => note.pinned)
        : notes;
    response.json(result);
  });

  app.get("/notes/:id", (request, response) => {
    const note = notes.find((entry) => entry.id === request.params.id);
    if (!note) return response.status(404).json({ message: "Note not found." });
    response.json(note);
  });

  app.post("/notes", (request, response) => {
    const title =
      typeof request.body?.title === "string" ? request.body.title.trim() : "";
    if (title.length < 3) {
      return response
        .status(400)
        .json({ message: "Title must be at least 3 characters." });
    }

    const body = request.body.body ?? "";
    if (typeof body !== "string") {
      return response.status(400).json({ message: "Body must be text." });
    }
    if (
      request.body.pinned !== undefined &&
      typeof request.body.pinned !== "boolean"
    ) {
      return response.status(400).json({ message: "Pinned must be true or false." });
    }

    const note = {
      id: randomUUID(),
      title,
      body,
      pinned: request.body.pinned ?? false,
    };
    notes.push(note);
    response.status(201).json(note);
  });

  app.patch("/notes/:id", (request, response) => {
    const note = notes.find((entry) => entry.id === request.params.id);
    if (!note) return response.status(404).json({ message: "Note not found." });

    const updates = request.body;
    if (
      !updates ||
      typeof updates !== "object" ||
      Array.isArray(updates) ||
      Object.keys(updates).length === 0
    ) {
      return response.status(400).json({ message: "At least one note field is required." });
    }
    if (Object.hasOwn(updates, "title")) {
      if (typeof updates.title !== "string" || updates.title.trim().length < 3) {
        return response
          .status(400)
          .json({ message: "Title must be at least 3 characters." });
      }
      note.title = updates.title.trim();
    }
    if (Object.hasOwn(updates, "body")) {
      if (typeof updates.body !== "string") {
        return response.status(400).json({ message: "Body must be text." });
      }
      note.body = updates.body;
    }
    if (Object.hasOwn(updates, "pinned")) {
      if (typeof updates.pinned !== "boolean") {
        return response.status(400).json({ message: "Pinned must be true or false." });
      }
      note.pinned = updates.pinned;
    }
    response.json(note);
  });

  app.delete("/notes/:id", (request, response) => {
    const noteIndex = notes.findIndex((entry) => entry.id === request.params.id);
    if (noteIndex === -1) {
      return response.status(404).json({ message: "Note not found." });
    }
    notes.splice(noteIndex, 1);
    response.status(204).end();
  });

  app.use((_request, response) => {
    response.status(404).json({ message: "Endpoint not found." });
  });

  return app;
}

export const notes = createStarterNotes();
export const app = createApp(notes);

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  app.listen(PORT, () => {
    console.log(`Notes API listening at http://localhost:${PORT}`);
  });
}
