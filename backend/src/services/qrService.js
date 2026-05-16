import jwt from "jsonwebtoken";
import crypto from "crypto";
import { getCache, setCache } from "../db/redis.js";

export function generateQRToken(memberId) {
  const ttl = parseInt(process.env.QR_TOKEN_TTL_SECONDS || "8", 10);
  const nonce = crypto.randomBytes(6).toString("hex");
  const token = jwt.sign({ userId: memberId, nonce }, process.env.JWT_QR_SECRET, { expiresIn: `${ttl}s` });
  return { token, expiresIn: ttl };
}

export async function verifyQRToken(token) {
  try {
    const decoded = jwt.verify(token, process.env.JWT_QR_SECRET); // { userId, nonce, iat, exp }
    const cacheKey = `messmate:qr:nonce:${decoded.nonce}`;
    const isUsed = await getCache(cacheKey);
    if (isUsed) return null; // Replay attack prevented
    
    // Cache the nonce for 8 seconds
    await setCache(cacheKey, true, 8);
    return decoded;
  } catch {
    return null;
  }
}
