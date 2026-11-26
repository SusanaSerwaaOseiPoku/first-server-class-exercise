import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { findUserByEmail } from "../data/db.js";
import { getJwtSecret } from "../middleware/requireAuth.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SALT_ROUNDS = 10;

function normalizeBody(body) {
  return body !== null && typeof body === "object" && !Array.isArray(body)
    ? body
    : {};
}

export async function register(request, response, next) {
  try {
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

    const users = request.app.locals.users;
    if (findUserByEmail(users, email)) {
      return response
        .status(409)
        .json({ message: "An account with this email already exists." });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = {
      id: randomUUID(),
      email,
      passwordHash,
    };
    users.push(user);

    return response.status(201).json({
      id: user.id,
      email: user.email,
    });
  } catch (error) {
    return next(error);
  }
}

export async function login(request, response, next) {
  try {
    const body = normalizeBody(request.body);
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!email || !password) {
      return response
        .status(401)
        .json({ message: "Invalid email or password." });
    }

    const user = findUserByEmail(request.app.locals.users, email);
    if (!user) {
      return response
        .status(401)
        .json({ message: "Invalid email or password." });
    }

    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) {
      return response
        .status(401)
        .json({ message: "Invalid email or password." });
    }

    const token = jwt.sign(
      { sub: user.id, email: user.email },
      getJwtSecret(),
      { expiresIn: "2h" },
    );

    return response.json({
      token,
      user: {
        id: user.id,
        email: user.email,
      },
    });
  } catch (error) {
    return next(error);
  }
}

export function getMe(request, response) {
  const user = request.app.locals.users.find(
    (entry) => String(entry.id) === String(request.user.id),
  );
  return response.json({
    id: request.user.id,
    email: user ? user.email : request.user.email,
  });
}
