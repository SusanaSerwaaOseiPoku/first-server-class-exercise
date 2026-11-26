export function notFound(_request, _response, next) {
  const error = new Error("Endpoint not found.");
  error.status = 404;
  next(error);
}

export function errorHandler(error, _request, response, _next) {
  if (error?.name === "CastError") {
    return response.status(400).json({ message: "Invalid ID format." });
  }
  if (error?.name === "ValidationError") {
    const firstMessage =
      Object.values(error.errors || {})[0]?.message || "Validation failed.";
    return response.status(400).json({ message: firstMessage });
  }
  if (error?.code === 11000) {
    return response
      .status(409)
      .json({ message: "An account with this email already exists." });
  }

  const status =
    Number.isInteger(error?.status) && error.status >= 400 && error.status < 600
      ? error.status
      : 500;
  return response
    .status(status)
    .json({ message: error?.message || "Internal server error." });
}
