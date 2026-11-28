export default function logger(request, response, next) {
  const startedAt = Date.now();
  response.on("finish", () => {
    const elapsedMs = Date.now() - startedAt;
    console.log(
      `${request.method} ${request.originalUrl} ${response.statusCode} ${elapsedMs}ms`,
    );
  });
  next();
}
