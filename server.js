import "dotenv/config";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import { createStarterNotes, createStarterUsers } from "./data/db.js";
import { errorHandler, notFound } from "./middleware/errors.js";
import logger from "./middleware/logger.js";
import requestCounter from "./middleware/requestCounter.js";
import authRouter from "./routes/auth.js";
import notesRouter from "./routes/notes.js";
import statsRouter from "./routes/stats.js";

export { createStarterNotes, createStarterUsers };

export function createApp(
  notes = createStarterNotes(),
  users = createStarterUsers(),
) {
  const app = express();
  app.locals.notes = notes;
  app.locals.users = users;
  app.locals.requestStats = { total: 0, byMethod: {} };
  app.use(logger, requestCounter, cors(), express.json());
  app.use("/auth", authRouter);
  app.use("/notes", notesRouter);
  app.use("/stats", statsRouter);
  app.use(notFound, errorHandler);
  return app;
}

export const notes = createStarterNotes();
export const users = createStarterUsers();
export const app = createApp(notes, users);

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number(process.env.PORT) || 3002;
  app.listen(port, () => console.log(`Notes API listening at http://localhost:${port}`));
}
