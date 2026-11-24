import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import { createStarterNotes } from "./data/db.js";
import { errorHandler, notFound } from "./middleware/errors.js";
import logger from "./middleware/logger.js";
import requestCounter from "./middleware/requestCounter.js";
import notesRouter from "./routes/notes.js";
import statsRouter from "./routes/stats.js";

export { createStarterNotes };
export function createApp(notes = createStarterNotes()) {
  const app = express(); app.locals.notes = notes;
  app.locals.requestStats = { total: 0, byMethod: {} };
  app.use(logger, requestCounter, cors(), express.json());
  app.use("/notes", notesRouter);
  app.use("/stats", statsRouter);
  app.use(notFound, errorHandler);
  return app;
}
export const notes = createStarterNotes(), app = createApp(notes);
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  app.listen(Number(process.env.PORT) || 3002, () => console.log(`Notes API listening at http://localhost:${Number(process.env.PORT) || 3002}`));
}
