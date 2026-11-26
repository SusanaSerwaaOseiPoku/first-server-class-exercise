import { Router } from "express";
import {
  createNote,
  deleteNote,
  getNote,
  listMyNotes,
  listNotes,
  togglePinNote,
  updateNote,
} from "../controllers/notesController.js";
import checkOwner from "../middleware/checkOwner.js";
import findNote from "../middleware/findNote.js";
import requireAuth from "../middleware/requireAuth.js";
import validateNote from "../middleware/validateNote.js";

const router = Router();

router.get("/", listNotes);
router.get("/mine", requireAuth, listMyNotes);
router.get("/:id", findNote, getNote);
router.post("/", requireAuth, validateNote, createNote);
router.patch("/:id/pin", requireAuth, findNote, checkOwner, togglePinNote);
router.patch("/:id", requireAuth, findNote, checkOwner, updateNote);
router.delete("/:id", requireAuth, findNote, checkOwner, deleteNote);

export default router;
