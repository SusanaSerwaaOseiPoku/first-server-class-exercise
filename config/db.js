import mongoose from "mongoose";

export default async function connectDB(
  uri = process.env.MONGO_URI,
  { exitOnFailure = false } = {},
) {
  const connectionUri = typeof uri === "string" ? uri.trim() : "";
  if (!connectionUri) {
    const message =
      "MONGO_URI is not set. Add your MongoDB Atlas connection string to .env or Render environment variables.";
    if (exitOnFailure) {
      console.error(`Startup aborted: ${message}`);
      process.exit(1);
    }
    throw new Error(message);
  }

  try {
    const connection = await mongoose.connect(connectionUri, {
      serverSelectionTimeoutMS: 10000,
    });
    console.log(
      `Connected to MongoDB (${connection.connection.host}/${connection.connection.name})`,
    );
    return connection;
  } catch (error) {
    const message = `Could not connect to MongoDB. Check MONGO_URI and Atlas network access (${error.message}).`;
    console.error(`Startup aborted: ${message}`);
    if (exitOnFailure) {
      process.exit(1);
    }
    throw new Error(message);
  }
}
