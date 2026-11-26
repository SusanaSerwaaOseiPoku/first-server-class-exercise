import jwt from "jsonwebtoken";

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) {
    const error = new Error("JWT_SECRET is not configured.");
    error.status = 500;
    throw error;
  }
  return secret;
}

export default function requireAuth(request, response, next) {
  const header = request.headers.authorization;
  const match =
    typeof header === "string" ? /^Bearer\s+(.+)$/i.exec(header.trim()) : null;
  if (!match) {
    return response.status(401).json({ message: "Authentication required." });
  }

  try {
    const payload = jwt.verify(match[1], getJwtSecret());
    request.user = {
      id: String(payload.sub ?? payload.id),
      email: payload.email,
    };
    return next();
  } catch (error) {
    if (error.status === 500) {
      return next(error);
    }
    return response.status(401).json({ message: "Invalid or expired token." });
  }
}
