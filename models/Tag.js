import mongoose from "mongoose";

export const DEFAULT_TAGS = ["Work", "Personal", "Urgent"];

const tagSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Tag name is required."],
      unique: true,
      trim: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

const Tag = mongoose.models.Tag || mongoose.model("Tag", tagSchema);

export async function seedDefaultTags() {
  const seeded = [];
  for (const name of DEFAULT_TAGS) {
    let tag = await Tag.findOne({ name });
    if (!tag) {
      tag = await Tag.create({ name });
    }
    seeded.push(tag);
  }
  return seeded;
}

export default Tag;
