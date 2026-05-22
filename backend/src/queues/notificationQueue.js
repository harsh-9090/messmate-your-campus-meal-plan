import { Queue } from "bullmq";
import Redis from "ioredis";

const connection = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null, // Required by BullMQ
});

export const notificationQueue = new Queue("notifications", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

export async function queueEmailJob(type, emailData) {
  try {
    await notificationQueue.add("send-email", { type, ...emailData });
    console.log(`[QUEUE] Queued email job of type: ${type} for ${emailData.email || emailData.to}`);
  } catch (err) {
    console.error(`[QUEUE-ERROR] Failed to queue email job:`, err.message);
  }
}

export async function queuePushJob(type, pushData) {
  try {
    await notificationQueue.add("send-push", { type, ...pushData });
    console.log(`[QUEUE] Queued push job of type: ${type}`);
  } catch (err) {
    console.error(`[QUEUE-ERROR] Failed to queue push job:`, err.message);
  }
}
