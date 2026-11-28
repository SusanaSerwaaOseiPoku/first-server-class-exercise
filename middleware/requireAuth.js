import jwt from "jsonwebtoken";

const BEARER_HEADER_PATTERN = /^Bearer\s+(.+)$/i;

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
  const authorizationHeader = request.headers.authorization;
  const bearerTokenMatch =
    typeof authorizationHeader === "string"
      ? BEARER_HEADER_PATTERN.exec(authorizationHeader.trim())
      : null;
  if (!bearerTokenMatch) {
    return response.status(401).json({ message: "Authentication required." });
  }

  try {
    const tokenPayload = jwt.verify(bearerTokenMatch[1], getJwtSecret());
    request.user = {
      id: String(tokenPayload.sub ?? tokenPayload.id),
      email: tokenPayload.email,
    };
    return next();
  } catch (error) {
    if (error.status === 500) {
      return next(error);
    }
    return response.status(401).json({ message: "Invalid or expired token." });
  }
}
