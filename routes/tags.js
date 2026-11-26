import { Router } from "express";
import asyncHandler from "../middleware/asyncHandler.js";
import Tag from "../models/Tag.js";

const router = Router();

router.get(
  "/",
  asyncHandler(async (_request, response) => {
    const tags = await Tag.find().sort({ name: 1 });
    response.json(tags);
  }),
);

export default router;
