import "dotenv/config";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import connectDB from "./config/db.js";
import Note from "./models/Note.js";
import { seedDefaultTags } from "./models/Tag.js";
import User from "./models/User.js";

const DEMO_EMAIL = "demo@notes.test";
const DEMO_PASSWORD = "notes1234";

async function seed() {
  await connectDB();
  const tags = await seedDefaultTags();

  let demoUser = await User.findOne({ email: DEMO_EMAIL });
  if (!demoUser) {
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
    demoUser = await User.create({ email: DEMO_EMAIL, passwordHash });
  }

  const existingNote = await Note.findOne({
    title: "Welcome to Notes API",
    ownerId: demoUser._id,
  });
  if (!existingNote) {
    await Note.create({
      title: "Welcome to Notes API",
      body: "This starter note is stored in MongoDB and survives server restarts.",
      pinned: true,
      ownerId: demoUser._id,
      tags: tags[0] ? [tags[0]._id] : [],
    });
  }

  console.log(
    `Seed complete in database "${mongoose.connection.name}". Demo user ready: ${DEMO_EMAIL}`,
  );
  await mongoose.disconnect();
}

seed().catch(async (error) => {
  console.error("Seed failed:", error.message);
  await mongoose.disconnect();
  process.exit(1);
});
