export function notFound(_request, _response, next) {
  const error = new Error("Endpoint not found.");
  error.status = 404;
  next(error);
}

export function errorHandler(error, _request, response, _next) {
  const status =
    Number.isInteger(error.status) && error.status >= 400 && error.status < 600
      ? error.status
      : 500;
  response.status(status).json({ message: error.message || "Internal server error." });
}
