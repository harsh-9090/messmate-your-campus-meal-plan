import { Router } from "express";
import { body, validationResult } from "express-validator";
import { query } from "../db/index.js";
import { verifyToken, requireRole } from "../middleware/authMiddleware.js";
import crypto from "crypto";
import { format } from "date-fns";
import { sendGuestPassEmail } from "../services/notificationService.js";
import { sendPushToMember, sendPushToAdminsAndStaff } from "../services/pushNotificationService.js";
import { getISTDateStr } from "../services/qrService.js";

const router = Router();

async function autoExpirePasses() {
  try {
    const todayStr = getISTDateStr();
    await query(
      `UPDATE guest_passes 
       SET status = 'expired', updated_at = NOW() 
       WHERE status IN ('active', 'pending_approval') AND date < $1`,
      [todayStr]
    );
  } catch (err) {
    console.error("[AUTO-EXPIRE-ERROR] Failed to auto expire guest passes:", err.message);
  }
}



// 1. Create a guest pass request (authenticated members)
// POST /
router.post(
  "/",
  verifyToken,
  requireRole("member"),
  body("guestName").optional().isString().trim(),
  body("date").isISO8601().withMessage("Invalid date format (yyyy-mm-dd)"),
  body("meal").isIn(["Breakfast", "Lunch", "Dinner"]).withMessage("Invalid meal type"),
  async (req, res, next) => {
    try {
      const errs = validationResult(req);
      if (!errs.isEmpty()) return res.status(400).json({ error: "Invalid input", details: errs.array() });

      const { guestName, date, meal } = req.body;
      const memberId = req.user.sub; // host student

      // Generate a crypto random token prefixed with 'gp_'
      const rawToken = crypto.randomBytes(32).toString("hex");
      const qrToken = `gp_${rawToken}`;

      const { rows: windowRows } = await query(
        `SELECT guest_price FROM meal_windows WHERE meal = $1`,
        [meal]
      );
      const price = windowRows[0]?.guest_price ?? 120;

      const { rows } = await query(
        `INSERT INTO guest_passes (member_id, guest_name, date, meal, qr_token, status, price)
         VALUES ($1, $2, $3, $4, $5, 'pending_approval', $6)
         RETURNING *`,
        [memberId, guestName || "Guest", date, meal, qrToken, price]
      );

      // Notify admins and staff about the pending approval pass
      (async () => {
        try {
          const memberRes = await query("SELECT name FROM members WHERE member_id = $1", [memberId]);
          const hostName = memberRes.rows[0]?.name || "A member";
          await sendPushToAdminsAndStaff({
            title: "Pending Guest Pass Approval",
            body: `${hostName} requested a guest pass for ${guestName || "Guest"} (${meal} on ${format(new Date(date), "yyyy-MM-dd")})`,
            url: "/admin/guest-passes",
          });
        } catch (pushErr) {
          console.error("[PUSH-ERROR] Failed to send push on guest pass creation:", pushErr.message);
        }
      })();

      res.status(201).json(rows[0]);
    } catch (e) {
      next(e);
    }
  }
);

// 2. Get active & past guest passes for the logged-in member
// GET /my-passes
router.get("/my-passes", verifyToken, requireRole("member"), async (req, res, next) => {
  try {
    const memberId = req.user.sub;
    await autoExpirePasses();
    const { rows } = await query(
      `SELECT * FROM guest_passes WHERE member_id = $1 ORDER BY created_at DESC`,
      [memberId]
    );
    // Format dates to string
    const formatted = rows.map((gp) => ({
      ...gp,
      date: format(new Date(gp.date), "yyyy-MM-dd"),
    }));
    res.json(formatted);
  } catch (e) {
    next(e);
  }
});

// 3. List pending guest passes (Admins only)
// GET /pending
router.get("/pending", verifyToken, requireRole("admin"), async (req, res, next) => {
  try {
    await autoExpirePasses();
    const { rows } = await query(
      `SELECT gp.*, m.name as host_name, m.mobile as host_mobile
       FROM guest_passes gp
       JOIN members m ON gp.member_id = m.member_id
       WHERE gp.status = 'pending_approval'
       ORDER BY gp.created_at ASC`
    );
    const formatted = rows.map((gp) => ({
      ...gp,
      date: format(new Date(gp.date), "yyyy-MM-dd"),
    }));
    res.json(formatted);
  } catch (e) {
    next(e);
  }
});

// 3.1 List all guest passes (Admins only)
// GET /
router.get("/", verifyToken, requireRole("admin"), async (req, res, next) => {
  try {
    await autoExpirePasses();
    const { rows } = await query(
      `SELECT gp.*, COALESCE(m.name, 'Admin (Walk-in)') as host_name, m.mobile as host_mobile
       FROM guest_passes gp
       LEFT JOIN members m ON gp.member_id = m.member_id
       ORDER BY gp.created_at DESC`
    );
    const formatted = rows.map((gp) => ({
      ...gp,
      date: format(new Date(gp.date), "yyyy-MM-dd"),
    }));
    res.json(formatted);
  } catch (e) {
    next(e);
  }
});

// 4. Approve / Mark Paid a pending guest pass (Admins only)
// PATCH /:id/approve
router.patch("/:id/approve", verifyToken, requireRole("admin"), async (req, res, next) => {
  try {
    const { id } = req.params;

    const checkRes = await query(`SELECT * FROM guest_passes WHERE id = $1`, [id]);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({ error: "Guest pass not found" });
    }

    const gp = checkRes.rows[0];
    if (gp.status !== "pending_approval") {
      return res.status(400).json({ error: `Cannot approve pass with status: ${gp.status}` });
    }

    const { rows } = await query(
      `UPDATE guest_passes
       SET status = 'active', updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    // Notify member about the guest pass approval
    if (gp.member_id) {
      sendPushToMember(gp.member_id, {
        title: "Guest Pass Approved! 🎉",
        body: `Your guest pass request for ${gp.guest_name || "Guest"} has been approved for ${gp.meal} on ${format(new Date(gp.date), "yyyy-MM-dd")}.`,
        url: "/dashboard",
      }).catch((pushErr) => {
        console.error("[PUSH-ERROR] Failed to send push on guest pass approval:", pushErr.message);
      });
    }

    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
});

// 5. Get details of a guest pass by token (Public - no auth required)
// GET /public/:token
router.get("/public/:token", async (req, res, next) => {
  try {
    const { token } = req.params;
    await autoExpirePasses();
    const { rows } = await query(
      `SELECT gp.guest_name, gp.date, gp.meal, gp.status, gp.price, gp.qr_token, COALESCE(m.name, 'Admin (Walk-in)') as host_name
       FROM guest_passes gp
       LEFT JOIN members m ON gp.member_id = m.member_id
       WHERE gp.qr_token = $1`,
      [token]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Guest pass not found" });
    }

    const gp = rows[0];
    res.json({
      ...gp,
      date: format(new Date(gp.date), "yyyy-MM-dd"),
    });
  } catch (e) {
    next(e);
  }
});

// 6. Issue a walk-in guest pass (Admins only)
// POST /walk-in
router.post(
  "/walk-in",
  verifyToken,
  requireRole("admin"),
  [
    body("guestName").trim().notEmpty().withMessage("Guest name is required"),
    body("guestEmail").trim().isEmail().withMessage("Valid guest email is required"),
    body("date").isISO8601().withMessage("Valid date (YYYY-MM-DD) is required"),
    body("meal").isIn(["Breakfast", "Lunch", "Dinner"]).withMessage("Invalid meal type"),
  ],
  async (req, res, next) => {
    try {
      const errs = validationResult(req);
      if (!errs.isEmpty()) {
        return res.status(400).json({ error: "Invalid input", details: errs.array() });
      }

      const { guestName, guestEmail, date, meal } = req.body;

      // Generate a crypto random token prefixed with 'gp_'
      const rawToken = crypto.randomBytes(32).toString("hex");
      const qrToken = `gp_${rawToken}`;

      const { rows: windowRows } = await query(
        `SELECT guest_price FROM meal_windows WHERE meal = $1`,
        [meal]
      );
      const price = windowRows[0]?.guest_price ?? 120;

      const { rows } = await query(
        `INSERT INTO guest_passes (member_id, guest_name, date, meal, qr_token, status, price)
         VALUES (NULL, $1, $2, $3, $4, 'active', $5)
         RETURNING *`,
        [guestName, date, meal, qrToken, price]
      );

      const pass = rows[0];

      // Dispatch guest pass email asynchronously
      sendGuestPassEmail(guestEmail, guestName, {
        date: format(new Date(date), "yyyy-MM-dd"),
        meal,
        price,
        qrToken,
      }).catch((err) => {
        console.error("[NOTIFY-ERROR] Failed to send walk-in guest pass email:", err.message);
      });

      res.status(201).json({
        ...pass,
        date: format(new Date(pass.date), "yyyy-MM-dd"),
      });
    } catch (e) {
      next(e);
    }
  }
);

export default router;
