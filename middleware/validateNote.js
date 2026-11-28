const MIN_TITLE_LENGTH = 3;

export default function validateNote(request, response, next) {
  const title =
    typeof request.body?.title === "string" ? request.body.title.trim() : "";
  if (title.length < MIN_TITLE_LENGTH) {
    return response.status(400).json({
      message: `Title must be at least ${MIN_TITLE_LENGTH} characters.`,
    });
  }

  return next();
}
