import rateLimit from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import { client } from "../db/redis.js";

const createRedisLimiter = (prefix, windowMs, max) => {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore({
      sendCommand: async (...args) => {
        // Wait at most 1 second for Redis to connect during boot-up
        if (!client.isOpen) {
          let elapsed = 0;
          await new Promise((resolve) => {
            const check = setInterval(() => {
              elapsed += 50;
              if (client.isOpen || elapsed >= 1000) {
                clearInterval(check);
                resolve();
              }
            }, 50);
          });
        }

        // Fail-open gracefully if Redis is down/unreachable
        if (!client.isOpen) {
          console.warn(`[RateLimiter] Redis is offline. Rate limiter '${prefix}' bypassed.`);
          const isScriptCmd = (typeof args[0] === "string" && args[0].toLowerCase() === "script") ||
                              (Array.isArray(args[0]) && typeof args[0][0] === "string" && args[0][0].toLowerCase() === "script");
          if (isScriptCmd) {
            return "0000000000000000000000000000000000000000";
          }
          // Return a dummy count of 1 to allow request to pass without exceeding max
          return 1;
        }

        // If arguments are nested (e.g. [[cmd, args...]]), flatten them or pass directly
        if (args.length === 1 && Array.isArray(args[0])) {
          return client.sendCommand(args[0]);
        }
        return client.sendCommand(args);
      },
      prefix: `messmate:limiter:${prefix}:`,
    }),
  });
};

export const scanLimiter = createRedisLimiter("scan", 60_000, 30);
export const qrLimiter = createRedisLimiter("qr", 60_000, 30);
export const authLimiter = createRedisLimiter("auth", 15 * 60_000, 30);



