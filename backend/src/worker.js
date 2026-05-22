import { Worker } from "bullmq";
import Redis from "ioredis";
import {
  notifyExpiringSoon,
  notifyExpired,
  sendPasswordResetEmail,
  sendRegistrationReceivedEmail,
  sendPlanActivatedEmail,
  sendVerificationOTPEmail,
  sendGuestPassEmail,
} from "./services/notificationService.js";
import {
  sendPushToMember,
  sendPushToAdminsAndStaff,
  sendPushToAdmins,
  sendPushToAllMembers,
} from "./services/pushNotificationService.js";

const connection = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null, // Required by BullMQ
});

let worker;

export function startWorker() {
  if (worker) return worker;

  console.log("[WORKER] Starting background job consumer...");

  worker = new Worker(
    "notifications",
    async (job) => {
      const { name, data } = job;
      console.log(`[WORKER] Processing job ${job.id}: ${name}`);

      if (name === "send-email") {
        switch (data.type) {
          case "expiring_soon":
            await notifyExpiringSoon(data.member, data.daysLeft);
            break;
          case "expired":
            await notifyExpired(data.member);
            break;
          case "password_reset":
            await sendPasswordResetEmail(data.member, data.resetLink);
            break;
          case "registration_received":
            await sendRegistrationReceivedEmail(data.member);
            break;
          case "activation":
            await sendPlanActivatedEmail(data.member, data.planDetails);
            break;
          case "otp":
            await sendVerificationOTPEmail(data.member, data.otp);
            break;
          case "guest_pass":
            await sendGuestPassEmail(data.email, data.guestName, data.passDetails);
            break;
          default:
            console.error(`[WORKER] Unknown email type: ${data.type}`);
        }
      } else if (name === "send-push") {
        switch (data.type) {
          case "member":
            await sendPushToMember(data.memberId, data.payload);
            break;
          case "admins_staff":
            await sendPushToAdminsAndStaff(data.payload);
            break;
          case "admins":
            await sendPushToAdmins(data.payload);
            break;
          case "all_members":
            await sendPushToAllMembers(data.payload);
            break;
          default:
            console.error(`[WORKER] Unknown push type: ${data.type}`);
        }
      }
    },
    { connection, concurrency: 5 }
  );

  worker.on("completed", (job) => {
    console.log(`[WORKER] Job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[WORKER] Job ${job.id} failed:`, err.message);
  });

  return worker;
}

// Support running directly as a standalone process (production isolation)
if (import.meta.url === `file://${process.argv[1]}` || process.env.RUN_STANDALONE_WORKER === "true") {
  startWorker();
}
