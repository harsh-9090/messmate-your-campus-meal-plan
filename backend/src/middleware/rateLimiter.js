import rateLimit from "express-rate-limit";

const createMemoryLimiter = (prefix, windowMs, max) => {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    // By not passing a 'store', it defaults to MemoryStore
  });
};

export const scanLimiter = createMemoryLimiter("scan", 60_000, 30);
export const qrLimiter = createMemoryLimiter("qr", 60_000, 30);
export const authLimiter = createMemoryLimiter("auth", 15 * 60_000, 30);



