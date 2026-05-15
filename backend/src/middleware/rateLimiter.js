import rateLimit from "express-rate-limit";

export const scanLimiter = rateLimit({ windowMs: 60_000, max: 30, standardHeaders: true, legacyHeaders: false });
export const qrLimiter = rateLimit({ windowMs: 60_000, max: 10, standardHeaders: true, legacyHeaders: false });
export const authLimiter = rateLimit({ windowMs: 15 * 60_000, max: 30 });
