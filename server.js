import "dotenv/config";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import mongoose from "mongoose";
import connectDB from "./config/db.js";
import { errorHandler, notFound } from "./middleware/errors.js";
import logger from "./middleware/logger.js";
import requestCounter from "./middleware/requestCounter.js";
import { seedDefaultTags } from "./models/Tag.js";
import authRouter from "./routes/auth.js";
import notesRouter from "./routes/notes.js";
import statsRouter from "./routes/stats.js";
import tagsRouter from "./routes/tags.js";

const DB_READY_STATES = {
  0: "disconnected",
  1: "connected",
  2: "connecting",
  3: "disconnecting",
};

export function getHealthPayload() {
  const readyState = mongoose.connection.readyState;
  const dbStatus = DB_READY_STATES[readyState] || "unknown";
  const connected = readyState === 1;

  return {
    httpStatus: connected ? 200 : 503,
    body: {
      status: connected ? "ok" : "degraded",
      database: {
        status: dbStatus,
        readyState,
        name: mongoose.connection.name || null,
      },
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    },
  };
}

export function getCorsOptions(clientUrl = process.env.CLIENT_URL) {
  const allowedOrigins =
    typeof clientUrl === "string"
      ? clientUrl
          .split(",")
          .map((origin) => origin.trim())
          .filter(Boolean)
      : [];

  return {
    origin(origin, callback) {
      if (
        !origin ||
        allowedOrigins.length === 0 ||
        allowedOrigins.includes(origin)
      ) {
        return callback(null, true);
      }
      return callback(new Error("Origin not allowed by CORS."));
    },
    credentials: true,
  };
}

export function createApp() {
  const app = express();
  app.locals.requestStats = { total: 0, byMethod: {} };
  app.use(logger, requestCounter, cors(getCorsOptions()), express.json());

  app.get("/health", (_request, response) => {
    const { httpStatus, body } = getHealthPayload();
    response.status(httpStatus).json(body);
  });

  app.use("/auth", authRouter);
  app.use("/notes", notesRouter);
  app.use("/tags", tagsRouter);
  app.use("/stats", statsRouter);
  app.use(notFound, errorHandler);
  return app;
}

export async function startServer() {
  await connectDB();
  await seedDefaultTags();
  const app = createApp();
  const port = Number(process.env.PORT) || 3002;
  return app.listen(port, () =>
    console.log(`Notes API listening on port ${port}`),
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  startServer().catch((error) => {
    console.error("Failed to start Notes API:", error.message);
    process.exit(1);
  });
}
