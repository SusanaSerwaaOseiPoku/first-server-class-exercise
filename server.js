import "dotenv/config";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import connectDB from "./config/db.js";
import { errorHandler, notFound } from "./middleware/errors.js";
import logger from "./middleware/logger.js";
import requestCounter from "./middleware/requestCounter.js";
import authRouter from "./routes/auth.js";
import notesRouter from "./routes/notes.js";
import statsRouter from "./routes/stats.js";

export function createApp() {
  const app = express();
  app.locals.requestStats = { total: 0, byMethod: {} };
  app.use(logger, requestCounter, cors(), express.json());
  app.use("/auth", authRouter);
  app.use("/notes", notesRouter);
  app.use("/stats", statsRouter);
  app.use(notFound, errorHandler);
  return app;
}

export async function startServer() {
  await connectDB();
  const app = createApp();
  const port = Number(process.env.PORT) || 3002;
  return app.listen(port, () =>
    console.log(`Notes API listening at http://localhost:${port}`),
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  startServer().catch((error) => {
    console.error("Failed to start Notes API:", error.message);
    process.exit(1);
  });
}
