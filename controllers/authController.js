import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import asyncHandler from "../middleware/asyncHandler.js";
import { getJwtSecret } from "../middleware/requireAuth.js";
import User from "../models/User.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SALT_ROUNDS = 10;

function normalizeBody(body) {
  return body !== null && typeof body === "object" && !Array.isArray(body)
    ? body
    : {};
}

export const register = asyncHandler(async (request, response) => {
  const body = normalizeBody(request.body);
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!EMAIL_PATTERN.test(email)) {
    return response
      .status(400)
      .json({ message: "A valid email address is required." });
  }
  if (password.length < 6) {
    return response
      .status(400)
      .json({ message: "Password must be at least 6 characters." });
  }

  const existing = await User.findOne({ email });
  if (existing) {
    return response
      .status(409)
      .json({ message: "An account with this email already exists." });
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await User.create({ email, passwordHash });

  return response.status(201).json({
    _id: user._id,
    id: String(user._id),
    email: user.email,
  });
});

export const login = asyncHandler(async (request, response) => {
  const body = normalizeBody(request.body);
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !password) {
    return response.status(401).json({ message: "Invalid email or password." });
  }

  const user = await User.findOne({ email });
  if (!user) {
    return response.status(401).json({ message: "Invalid email or password." });
  }

  const matches = await bcrypt.compare(password, user.passwordHash);
  if (!matches) {
    return response.status(401).json({ message: "Invalid email or password." });
  }

  const token = jwt.sign(
    { sub: String(user._id), email: user.email },
    getJwtSecret(),
    { expiresIn: "2h" },
  );

  return response.json({
    token,
    user: {
      _id: user._id,
      id: String(user._id),
      email: user.email,
    },
  });
});

export const getMe = asyncHandler(async (request, response) => {
  const user = await User.findById(request.user.id);
  if (!user) {
    return response.status(401).json({ message: "Invalid or expired token." });
  }
  return response.json({
    _id: user._id,
    id: String(user._id),
    email: user.email,
  });
});
