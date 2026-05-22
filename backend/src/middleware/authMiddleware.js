import jwt from "jsonwebtoken";
import { isTokenBlacklisted } from "../db/redis.js";

export async function verifyToken(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return res.status(401).json({ error: "Missing token" });
  const token = auth.slice(7);
  try {
    req.user = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    // Check if this access token has been revoked (e.g. after logout)
    const blacklisted = await isTokenBlacklisted(token);
    if (blacklisted) return res.status(401).json({ error: "Token revoked" });
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role))
    return res.status(403).json({ error: "Forbidden" });
  next();
};
