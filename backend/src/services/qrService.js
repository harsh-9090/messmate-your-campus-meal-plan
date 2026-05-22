import jwt from "jsonwebtoken";
import { format } from "date-fns";
import crypto from "node:crypto";

/**
 * Returns today's date consistently formatted in Indian Standard Time (IST, UTC+5.30).
 */
export function getISTDateStr() {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const ist = new Date(utc + (3600000 * 5.5));
  return format(ist, "yyyy-MM-dd");
}

/**
 * Generates an HMAC SHA-256 signature of the timestamp using the JWT_QR_SECRET.
 */
function generateTimestampHash(timestamp) {
  const secret = process.env.JWT_QR_SECRET || "fallback_secure_hash_secret_key";
  return crypto
    .createHmac("sha256", secret)
    .update(String(timestamp))
    .digest("hex");
}

/**
 * Generates a signed, date-locked JWT token for a specific member and meal.
 * 
 * @param {string} memberId 
 * @param {"Breakfast"|"Lunch"|"Dinner"} meal 
 * @returns {{ token: string, date: string, meal: string }}
 */
export function generateQRToken(memberId, meal) {
  const dateStr = getISTDateStr();
  const timestamp = Date.now();
  const tsHash = generateTimestampHash(timestamp);

  const token = jwt.sign(
    { userId: memberId, date: dateStr, meal, ts: timestamp, tsHash },
    process.env.JWT_QR_SECRET
  );
  return { token, date: dateStr, meal };
}

/**
 * Verifies a daily static QR token and asserts that:
 * 1. The JWT signature is authentic.
 * 2. The timestamp hash matches the raw timestamp (integrity check).
 * 3. The token was issued for today's date in IST.
 * 4. The token matches the specific meal window being scanned.
 * 
 * @param {string} token 
 * @param {"Breakfast"|"Lunch"|"Dinner"} expectedMeal 
 * @returns {Promise<any|null>}
 */
export async function verifyQRToken(token, expectedMeal) {
  try {
    const decoded = jwt.verify(token, process.env.JWT_QR_SECRET); // { userId, date, meal, ts, tsHash }
    
    // Verify that the hashed timestamp matches the raw timestamp
    const expectedHash = generateTimestampHash(decoded.ts);
    if (decoded.tsHash !== expectedHash) {
      console.warn(`[SECURITY] Timestamp tampering detected for member: ${decoded.userId}`);
      return null;
    }

    // Enforce matching date in Indian Standard Time
    const todayStr = getISTDateStr();
    if (decoded.date !== todayStr) {
      return null;
    }
    
    // Enforce matching meal type
    if (decoded.meal !== expectedMeal) {
      return { isMismatch: true, tokenMeal: decoded.meal, userId: decoded.userId };
    }
    
    return decoded;
  } catch (e) {
    return null;
  }
}

