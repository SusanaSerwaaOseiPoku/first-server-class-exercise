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
import checkId from "../middleware/checkId.js";
import checkOwner from "../middleware/checkOwner.js";
import findNote from "../middleware/findNote.js";
import requireAuth from "../middleware/requireAuth.js";
import validateNote from "../middleware/validateNote.js";

const router = Router();
const checkNoteId = checkId("note");

router.get("/", listNotes);
router.get("/mine", requireAuth, listMyNotes);
router.get("/:id", checkNoteId, findNote, getNote);
router.post("/", requireAuth, validateNote, createNote);
router.patch(
  "/:id/pin",
  requireAuth,
  checkNoteId,
  findNote,
  checkOwner,
  togglePinNote,
);
router.patch(
  "/:id",
  requireAuth,
  checkNoteId,
  findNote,
  checkOwner,
  updateNote,
);
router.delete(
  "/:id",
  requireAuth,
  checkNoteId,
  findNote,
  checkOwner,
  deleteNote,
);

export default router;
