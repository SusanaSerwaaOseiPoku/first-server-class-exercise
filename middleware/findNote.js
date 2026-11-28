import Note from "../models/Note.js";
import asyncHandler from "./asyncHandler.js";

const findNote = asyncHandler(async (request, response, next) => {
  const note = await Note.findById(request.params.id)
    .populate("owner", "email")
    .populate("tags", "name");

  if (!note) {
    return response.status(404).json({ message: "Note not found." });
  }

  request.note = note;
  return next();
});

export default findNote;
