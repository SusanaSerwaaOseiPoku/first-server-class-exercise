export default function findNote(request, response, next) {
  const note = request.app.locals.notes.find(
    (entry) => entry.id === request.params.id,
  );
  if (!note) {
    return response.status(404).json({ message: "Note not found." });
  }

  request.note = note;
  next();
}
