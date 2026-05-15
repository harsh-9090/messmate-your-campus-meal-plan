import jwt from "jsonwebtoken";
import crypto from "crypto";

export function generateQRToken(memberId) {
  const ttl = parseInt(process.env.QR_TOKEN_TTL_SECONDS || "8", 10);
  const nonce = crypto.randomBytes(6).toString("hex");
  const token = jwt.sign({ userId: memberId, nonce }, process.env.JWT_QR_SECRET, { expiresIn: `${ttl}s` });
  return { token, expiresIn: ttl };
}

export function verifyQRToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_QR_SECRET); // { userId, nonce, iat, exp }
  } catch {
    return null;
  }
}
