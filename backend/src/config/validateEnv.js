/**
 * Validates critical environment variables at startup.
 * Must be imported AFTER dotenv/config so process.env is populated.
 */

const required = [
  "DATABASE_URL",
  "JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET",
];

const recommended = [
  "REDIS_URL",
  "RESEND_API_KEY",
  "VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "VAPID_SUBJECT",
];

const isProd = process.env.NODE_ENV === "production";

const missingRequired = required.filter((k) => !process.env[k]);
const missingRecommended = recommended.filter((k) => !process.env[k]);

if (missingRequired.length) {
  console.error(`❌ CRITICAL: Missing required environment variables:\n   ${missingRequired.join(", ")}`);
  process.exit(1);
}

if (missingRecommended.length) {
  if (isProd) {
    console.error(`❌ CRITICAL: Missing recommended environment variables in production:\n   ${missingRecommended.join(", ")}`);
    process.exit(1);
  } else {
    console.warn(`⚠️  Missing recommended environment variables (non-critical in dev):\n   ${missingRecommended.join(", ")}`);
  }
}
