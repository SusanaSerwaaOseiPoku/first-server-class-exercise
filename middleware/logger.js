export default function logger(request, response, next) {
  const startedAt = Date.now();
  response.on("finish", () => {
    if (process.env.NODE_ENV === "test") return;
    const elapsedMs = Date.now() - startedAt;
    process.stdout.write(
      `${request.method} ${request.originalUrl} ${response.statusCode} ${elapsedMs}ms\n`,
    );
  });
  next();
}
