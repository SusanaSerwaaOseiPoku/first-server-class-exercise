import mongoose from "mongoose";

export default function requireDb(_request, response, next) {
  if (mongoose.connection.readyState !== 1) {
    return response.status(503).json({
      message:
        "Service temporarily unavailable while connecting to the database. Please try again shortly.",
    });
  }
  return next();
}
