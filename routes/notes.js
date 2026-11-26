import { Router } from "express";
import {
  createNote,
  deleteNote,
  getNote,
  listNotes,
  togglePinNote,
  updateNote,
} from "../controllers/notesController.js";
import findNote from "../middleware/findNote.js";
import requireAuth from "../middleware/requireAuth.js";
import validateNote from "../middleware/validateNote.js";

const router = Router();

router.get("/", listNotes);
router.get("/:id", findNote, getNote);
router.post("/", requireAuth, validateNote, createNote);
router.patch("/:id/pin", requireAuth, findNote, togglePinNote);
router.patch("/:id", requireAuth, findNote, updateNote);
router.delete("/:id", requireAuth, findNote, deleteNote);

export default router;
