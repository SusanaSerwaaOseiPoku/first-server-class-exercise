import { randomUUID } from "node:crypto";

function isForbiddenOwner(note, user) {
  return note.ownerId !== null && String(note.ownerId) !== String(user.id);
}

export function listNotes(request, response) {
  const notes = request.app.locals.notes;
  const result =
    request.query.pinned === "true"
      ? notes.filter((note) => note.pinned)
      : notes;
  response.json(result);
}

export function getNote(request, response) {
  response.json(request.note);
}

export function createNote(request, response) {
  const title = request.body.title.trim();
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
    ownerId: request.user.id,
  };
  request.app.locals.notes.push(note);
  response.status(201).json(note);
}

export function updateNote(request, response) {
  const note = request.note;
  if (isForbiddenOwner(note, request.user)) {
    return response
      .status(403)
      .json({ message: "Only the note owner can update this note." });
  }

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
}

export function deleteNote(request, response) {
  const note = request.note;
  if (isForbiddenOwner(note, request.user)) {
    return response
      .status(403)
      .json({ message: "Only the note owner can delete this note." });
  }

  const notes = request.app.locals.notes;
  notes.splice(notes.indexOf(note), 1);
  response.status(204).end();
}
