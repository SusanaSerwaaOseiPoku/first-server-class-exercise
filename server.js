import "dotenv/config";
import { fileURLToPath } from "node:url";
import app, { createApp, getCorsOptions, getHealthPayload } from "./app.js";
import connectDB from "./config/db.js";
import { seedDefaultTags } from "./models/Tag.js";

export { createApp, getCorsOptions, getHealthPayload };

export async function startServer() {
  await connectDB(process.env.MONGO_URI, { exitOnFailure: true });
  await seedDefaultTags();
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
