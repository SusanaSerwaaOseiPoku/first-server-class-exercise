export default function validateNote(request, response, next) {
  const title =
    typeof request.body?.title === "string" ? request.body.title.trim() : "";
  if (title.length < 3) {
    return response
      .status(400)
      .json({ message: "Title must be at least 3 characters." });
  }

  next();
}
