import { createClient } from "redis";
import dotenv from "dotenv";

dotenv.config();

const client = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
});

client.on("error", (err) => {
  console.error("[Redis] Client Error:", err);
});

let isConnected = false;

export async function connectRedis() {
  try {
    await client.connect();
    isConnected = true;
    console.log("✓ Redis connected");
  } catch (err) {
    console.error("✗ Redis connection failed:", err.message);
    isConnected = false;
  }
}

/**
 * Gets a value from cache.
 * @returns {Promise<any|null>} Parsed JSON object or null if miss/error
 */
export async function getCache(key) {
  if (!isConnected) return null;
  try {
    const data = await client.get(key);
    if (!data) return null;
    return JSON.parse(data);
  } catch (err) {
    console.error(`[Redis] GET error for key ${key}:`, err.message);
    return null;
  }
}

/**
 * Sets a value in cache with an expiration.
 * Optionally tracks the key in a named group Set for later bulk deletion.
 * @param {string} key
 * @param {any} value
 * @param {number} ttlSeconds
 * @param {string|null} group - optional group name, e.g. "member:list"
 */
export async function setCache(key, value, ttlSeconds, group = null) {
  if (!isConnected) return;
  try {
    await client.setEx(key, ttlSeconds, JSON.stringify(value));
    if (group) {
      const groupKey = `messmate:group:${group}`;
      await client.sAdd(groupKey, key);
      // Keep the group key alive slightly longer than the cached values
      await client.expire(groupKey, ttlSeconds + 60);
    }
  } catch (err) {
    console.error(`[Redis] SET error for key ${key}:`, err.message);
  }
}

/**
 * Deletes one or more specific keys.
 * @param {string|string[]} keys
 */
export async function delCache(keys) {
  if (!isConnected) return;
  try {
    const keyArray = Array.isArray(keys) ? keys : [keys];
    if (keyArray.length > 0) {
      await client.del(keyArray);
    }
  } catch (err) {
    console.error(`[Redis] DEL error:`, err.message);
  }
}

/**
 * Deletes all keys belonging to a named group (tracked via a Redis Set).
 * Works on Upstash Redis (no SCAN needed).
 * @param {string} group - group name used in setCache(), e.g. "member:list"
 */
export async function delByPattern(group) {
  if (!isConnected) return;
  try {
    const groupKey = `messmate:group:${group}`;
    const keys = await client.sMembers(groupKey);
    if (keys && keys.length > 0) {
      await client.del([groupKey, ...keys]);
    } else {
      await client.del(groupKey);
    }
  } catch (err) {
    console.error(`[Redis] DEL_GROUP error for ${group}:`, err.message);
  }
}


/**
 * Blacklists a refresh token by setting it in Redis with a TTL.
 * @param {string} token
 * @param {number} ttlSeconds
 */
export async function blacklistToken(token, ttlSeconds) {
  if (!isConnected) return;
  try {
    await client.setEx(`messmate:blacklist:${token}`, ttlSeconds, "1");
  } catch (err) {
    console.error(`[Redis] Blacklist error for token:`, err.message);
  }
}

/**
 * Checks if a refresh token has been blacklisted.
 * @param {string} token
 * @returns {Promise<boolean>}
 */
export async function isTokenBlacklisted(token) {
  if (!isConnected) return false;
  try {
    const exists = await client.exists(`messmate:blacklist:${token}`);
    return exists === 1;
  } catch (err) {
    console.error(`[Redis] Check blacklist error:`, err.message);
    return false;
  }
}

export { client };

