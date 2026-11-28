import mongoose from "mongoose";
import asyncHandler from "../middleware/asyncHandler.js";
import Note from "../models/Note.js";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 50;
const MIN_TITLE_LENGTH = 3;
const DECIMAL_RADIX = 10;

function populateNoteById(noteId) {
  return Note.findById(noteId)
    .populate("owner", "email")
    .populate("tags", "name");
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function validateTagsInput(rawTags) {
  if (rawTags === undefined) return { ok: true, tags: undefined };
  if (!Array.isArray(rawTags)) {
    return { ok: false, message: "Tags must be an array of tag IDs." };
  }
  const uniqueIds = [];
  for (const entry of rawTags) {
    const id = typeof entry === "string" ? entry.trim() : String(entry ?? "");
    if (!mongoose.isValidObjectId(id)) {
      return { ok: false, message: "Each tag must be a valid tag ID." };
    }
    if (!uniqueIds.includes(id)) {
      uniqueIds.push(id);
    }
  }
  return { ok: true, tags: uniqueIds };
}

async function queryNotes(query, baseFilter = {}) {
  const filter = { ...baseFilter };

  if (query.pinned === "true") {
    filter.pinned = true;
  }

  const rawSearch = typeof query.search === "string" ? query.search.trim() : "";
  if (rawSearch) {
    filter.title = { $regex: escapeRegex(rawSearch), $options: "i" };
  }

  const rawTag = typeof query.tag === "string" ? query.tag.trim() : "";
  if (rawTag) {
    if (!mongoose.isValidObjectId(rawTag)) {
      const error = new Error("Invalid tag ID.");
      error.status = 400;
      throw error;
    }
    filter.tags = rawTag;
  }

  const parsedPage = Number.parseInt(query.page, DECIMAL_RADIX);
  const page =
    Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : DEFAULT_PAGE;

  const parsedLimit = Number.parseInt(query.limit, DECIMAL_RADIX);
  const limit =
    Number.isInteger(parsedLimit) && parsedLimit > 0
      ? Math.min(parsedLimit, MAX_LIMIT)
      : DEFAULT_LIMIT;

  const skip = (page - 1) * limit;

  const [total, notes] = await Promise.all([
    Note.countDocuments(filter),
    Note.find(filter)
      .sort({ pinned: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("owner", "email")
      .populate("tags", "name"),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / limit));
  return {
    notes,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasPrev: page > 1,
      hasNext: page < totalPages,
    },
  };
}

export const listNotes = asyncHandler(async (request, response) => {
  const result = await queryNotes(request.query);
  response.json(result);
});

export const listMyNotes = asyncHandler(async (request, response) => {
  const result = await queryNotes(request.query, { ownerId: request.user.id });
  response.json(result);
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

  const tagsCheck = validateTagsInput(request.body.tags);
  if (!tagsCheck.ok) {
    return response.status(400).json({ message: tagsCheck.message });
  }

  const created = await Note.create({
    title,
    body,
    pinned: request.body.pinned ?? false,
    ownerId: request.user.id,
    tags: tagsCheck.tags ?? [],
  });

  const populated = await populateNoteById(created._id);

  return response.status(201).json(populated || created);
});

function applyNoteUpdates(note, updates) {
  if (Object.hasOwn(updates, "title")) {
    if (
      typeof updates.title !== "string" ||
      updates.title.trim().length < MIN_TITLE_LENGTH
    ) {
      return `Title must be at least ${MIN_TITLE_LENGTH} characters.`;
    }
    note.title = updates.title.trim();
  }

  if (Object.hasOwn(updates, "body")) {
    if (typeof updates.body !== "string") {
      return "Body must be text.";
    }
    note.body = updates.body;
  }

  if (Object.hasOwn(updates, "pinned")) {
    if (typeof updates.pinned !== "boolean") {
      return "Pinned must be true or false.";
    }
    note.pinned = updates.pinned;
  }

  if (Object.hasOwn(updates, "tags")) {
    const tagsCheck = validateTagsInput(updates.tags);
    if (!tagsCheck.ok) {
      return tagsCheck.message;
    }
    note.tags = tagsCheck.tags;
  }

  return null;
}

export const updateNote = asyncHandler(async (request, response) => {
  const note = request.note;
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

  const validationError = applyNoteUpdates(note, updates);
  if (validationError) {
    return response.status(400).json({ message: validationError });
  }

  await note.save();

  const populated = await populateNoteById(note._id);

  return response.json(populated || note);
});

export const togglePinNote = asyncHandler(async (request, response) => {
  const note = request.note;
  note.pinned = !note.pinned;
  await note.save();

  const populated = await populateNoteById(note._id);

  return response.json(populated || note);
});

export const deleteNote = asyncHandler(async (request, response) => {
  await Note.findByIdAndDelete(request.note._id);
  return response.status(204).end();
});
