import { Router } from "express";
import {
  createNote,
  deleteNote,
  getNote,
  listNotes,
  updateNote,
} from "../controllers/notesController.js";
import findNote from "../middleware/findNote.js";
import validateNote from "../middleware/validateNote.js";

const router = Router();

router.get("/", listNotes);
router.get("/:id", findNote, getNote);
router.post("/", validateNote, createNote);
router.patch("/:id", findNote, updateNote);
router.delete("/:id", findNote, deleteNote);

export default router;
