import mongoose from "mongoose";

const noteSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required."],
      trim: true,
      minlength: [3, "Title must be at least 3 characters."],
    },
    body: {
      type: String,
      default: "",
    },
    pinned: {
      type: Boolean,
      default: false,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Owner is required."],
    },
    tags: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Tag",
      },
    ],
  },
  {
    timestamps: true,
    versionKey: false,
    id: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

noteSchema.virtual("owner", {
  ref: "User",
  localField: "ownerId",
  foreignField: "_id",
  justOne: true,
});

const Note = mongoose.models.Note || mongoose.model("Note", noteSchema);

export default Note;
