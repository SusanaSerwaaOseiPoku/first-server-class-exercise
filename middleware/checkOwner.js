export default function checkOwner(request, response, next) {
  if (!request.user) {
    return response.status(401).json({ message: "Authentication required." });
  }
  if (!request.note) {
    return response.status(404).json({ message: "Note not found." });
  }

  const ownerId =
    request.note.ownerId &&
    typeof request.note.ownerId === "object" &&
    "_id" in request.note.ownerId
      ? request.note.ownerId._id
      : request.note.ownerId;

  if (ownerId !== null && String(ownerId) !== String(request.user.id)) {
    return response
      .status(403)
      .json({ message: "Only the note owner can update or delete this note." });
  }

  return next();
}
