import asyncHandler from "../middleware/asyncHandler.js";
import Note from "../models/Note.js";

function isForbiddenOwner(note, user) {
  return note.ownerId !== null && String(note.ownerId) !== String(user.id);
}

export const listNotes = asyncHandler(async (request, response) => {
  const filter = request.query.pinned === "true" ? { pinned: true } : {};
  const notes = await Note.find(filter).sort({ pinned: -1, createdAt: -1 });
  response.json(notes);
});

export function getNote(request, response) {
  response.json(request.note);
}

export const createNote = asyncHandler(async (request, response) => {
  const title = request.body.title.trim();
  const body = request.body.body ?? "";
  if (typeof body !== "string") {
    return response.status(400).json({ message: "Body must be text." });
  }
  if (
    request.body.pinned !== undefined &&
    typeof request.body.pinned !== "boolean"
  ) {
    return response
      .status(400)
      .json({ message: "Pinned must be true or false." });
  }

  const note = await Note.create({
    title,
    body,
    pinned: request.body.pinned ?? false,
    ownerId: request.user.id,
  });
  return response.status(201).json(note);
});

export const updateNote = asyncHandler(async (request, response) => {
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
    return response
      .status(400)
      .json({ message: "At least one note field is required." });
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
      return response
        .status(400)
        .json({ message: "Pinned must be true or false." });
    }
    note.pinned = updates.pinned;
  }

  const updated = await note.save();
  return response.json(updated);
});

export const togglePinNote = asyncHandler(async (request, response) => {
  const note = request.note;
  if (isForbiddenOwner(note, request.user)) {
    return response
      .status(403)
      .json({ message: "Only the note owner can pin or unpin this note." });
  }

  note.pinned = !note.pinned;
  const updated = await note.save();
  return response.json(updated);
});

export const deleteNote = asyncHandler(async (request, response) => {
  const note = request.note;
  if (isForbiddenOwner(note, request.user)) {
    return response
      .status(403)
      .json({ message: "Only the note owner can delete this note." });
  }

  await Note.findByIdAndDelete(note._id);
  return response.status(204).end();
});
