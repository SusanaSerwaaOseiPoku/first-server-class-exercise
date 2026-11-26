import mongoose from "mongoose";
import Note from "../models/Note.js";
import asyncHandler from "./asyncHandler.js";

const findNote = asyncHandler(async (request, response, next) => {
  const { id } = request.params;
  if (!mongoose.isValidObjectId(id)) {
    return response.status(400).json({ message: "Invalid note ID." });
  }

  const note = await Note.findById(id)
    .populate("owner", "email")
    .populate("tags", "name");

  if (!note) {
    return response.status(404).json({ message: "Note not found." });
  }

  request.note = note;
  return next();
});

export default findNote;
