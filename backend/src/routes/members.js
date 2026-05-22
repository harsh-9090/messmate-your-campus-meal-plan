import { Router } from "express";
import bcrypt from "bcrypt";
import { addDays, format } from "date-fns";
import { body, validationResult } from "express-validator";
import { query, rowToMember, stripPassword, withTx } from "../db/index.js";
import { verifyToken, requireRole } from "../middleware/authMiddleware.js";
import { getCache, setCache, delCache, delByPattern } from "../db/redis.js";
import { nextMemberId } from "../services/memberIdService.js";
import { sendPlanActivatedEmail, sendVerificationOTPEmail } from "../services/notificationService.js";
import { calculateAbsenceCredits } from "../services/absenceService.js";

const router = Router();
router.use(verifyToken);

const fmtDate = (d) => format(d, "yyyy-MM-dd");

const getISTDate = () => {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utc + (3600000 * 5.5)); // Force UTC+5.30 (Indian Standard Time)
};

// list (admin)
router.get("/", requireRole("admin"), async (req, res, next) => {
  try {
    const { search = "", status, planId, page = 1, limit = 20, sortBy = "created_at", sortOrder = "desc" } = req.query;
    const cacheKey = `messmate:member:list:${page}:${limit}:${search}:${status || "all"}:${planId || "all"}:${sortBy}:${sortOrder}`;
    const cached = await getCache(cacheKey);
    if (cached) return res.json(cached);

    const where = [`role = 'member'`];
    if (status === "pending") {
      where.push(`is_active = FALSE`);
    } else if (!status || status === "all") {
      // Show all members (both active and pending)
    } else {
      // Default: show only active members for other filters (expired, unpaid, etc)
      where.push(`is_active = TRUE`);
    }

    const params = [];
    if (search) {
      params.push(`%${search}%`);
      where.push(`(name ILIKE $${params.length} OR member_id ILIKE $${params.length})`);
    }
    if (planId && planId !== "all") {
      params.push(planId);
      where.push(`sub_plan_id = $${params.length}`);
    }
    const today = fmtDate(new Date());
    if (status === "expired") where.push(`sub_end_date < DATE '${today}'`);
    if (status === "unpaid") where.push(`sub_is_paid = FALSE`);
    if (status === "active") where.push(`sub_is_paid = TRUE AND sub_end_date >= DATE '${today}'`);

    const whereSql = `WHERE ${where.join(" AND ")}`;
    const lim = parseInt(limit, 10), pg = parseInt(page, 10);
    const offset = (pg - 1) * lim;
    params.push(lim, offset);

    // Sorting logic
    let orderSql = "ORDER BY created_at DESC"; // Default: newly joined first
    if (sortBy === "member_id") {
      const order = sortOrder === "desc" ? "DESC" : "ASC";
      orderSql = `ORDER BY member_id ${order}`;
    } else if (sortBy === "created_at") {
      const order = sortOrder === "asc" ? "ASC" : "DESC";
      orderSql = `ORDER BY created_at ${order}`;
    }

    console.log("[DEBUG] Members List Query:", { whereSql, orderSql, params });

    const [items, total] = await Promise.all([
      query(`SELECT * FROM members ${whereSql} ${orderSql} LIMIT $${params.length - 1} OFFSET $${params.length}`, params),
      query(`SELECT COUNT(*)::int AS c FROM members ${whereSql}`, params.slice(0, -2)),
    ]);
    const result = {
      items: items.rows.map((r) => stripPassword(rowToMember(r))),
      total: total.rows[0].c, page: pg, limit: lim,
    };
    await setCache(cacheKey, result, 120, "member:list"); // 2 min, tracked in group
    res.json(result);
  } catch (e) { next(e); }
});

// export (admin)
router.get("/export", requireRole("admin"), async (req, res, next) => {
  try {
    const { rows } = await query(`SELECT * FROM members WHERE role = 'member' ORDER BY name ASC`);
    
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=messmate_members.csv");

    const headers = [
      "Member ID", "Name", "Email", "Mobile", "Status", "Meal Plan",
      "Allowed Meals", "Start Date", "End Date", "Price", "Paid Amount",
      "Due Amount", "Payment Status"
    ];
    
    const escapeCsv = (str) => `"${String(str || "").replace(/"/g, '""')}"`;

    const csvLines = [headers.map(escapeCsv).join(",")];

    for (const r of rows) {
      const m = rowToMember(r);
      const status = m.isActive ? "Active" : "Inactive";
      const mealsStr = m.subscription.meals.join(" & ");
      
      const startDate = m.subscription.startDate ? format(new Date(m.subscription.startDate), "yyyy-MM-dd") : "N/A";
      const endDate = m.subscription.endDate ? format(new Date(m.subscription.endDate), "yyyy-MM-dd") : "N/A";
      
      const paymentStatus = m.subscription.isPaid 
        ? "Paid" 
        : (m.subscription.amountPaid > 0 ? "Partially Paid" : "Unpaid");

      csvLines.push([
        m.memberId,
        m.name,
        m.email,
        m.mobile || "N/A",
        status,
        m.subscription.planLabel || "N/A",
        mealsStr || "N/A",
        startDate,
        endDate,
        m.subscription.pricePerMonth || 0,
        m.subscription.amountPaid || 0,
        m.subscription.dueAmount || 0,
        paymentStatus
      ].map(escapeCsv).join(","));
    }

    res.send(csvLines.join("\n"));
  } catch (e) {
    next(e);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    if (req.user.role !== "admin" && req.user.sub !== req.params.id)
      return res.status(403).json({ error: "Forbidden" });
    
    const cacheKey = `messmate:member:${req.params.id}`;
    const cached = await getCache(cacheKey);
    if (cached) return res.json(cached);

    const { rows } = await query(`SELECT * FROM members WHERE member_id = $1`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "Not found" });
    
    const result = stripPassword(rowToMember(rows[0]));
    await setCache(cacheKey, result, 600); // 10 min
    res.json(result);
  } catch (e) { next(e); }
});

router.get("/:id/absence-credits", requireRole("admin"), async (req, res, next) => {
  try {
    const { rows } = await query(`SELECT sub_start_date, sub_end_date FROM members WHERE member_id = $1`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "Member not found" });

    const { sub_start_date, sub_end_date } = rows[0];
    const credits = await calculateAbsenceCredits(req.params.id, sub_start_date, sub_end_date);
    res.json(credits);
  } catch (e) { next(e); }
});

router.post("/",
  requireRole("admin"),
  body("name").isString().trim().notEmpty(),
  body("email").isEmail(),
  body("password")
    .isString()
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
    .withMessage("Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"),
  body("planId").isString(),
  body("meals").isArray({ min: 1 }),
  body("startDate").optional().isISO8601(),
  async (req, res, next) => {
    try {
      const errs = validationResult(req);
      if (!errs.isEmpty()) return res.status(400).json({ error: "Invalid input", details: errs.array() });
      const { name, email, password, mobile = null, planId, meals, startDate, amountPaid = 0, paymentMethod = "Cash", role = "member" } = req.body;

      const plan = (await query(`SELECT * FROM plans WHERE plan_id = $1`, [planId])).rows[0];
      const start = startDate ? new Date(startDate) : getISTDate();
      const duration = plan?.duration_months ?? 1;
      const end = addDays(start, duration * 30 - 1);
      const id = await nextMemberId();
      const hash = await bcrypt.hash(password, 12);

      const pricePerMonth = plan?.price_per_month ?? 0;
      const isPaid = amountPaid >= pricePerMonth && pricePerMonth > 0;

      const m = await withTx(async (client) => {
        const { rows } = await client.query(
          `INSERT INTO members
           (member_id, name, email, mobile, password_hash, role, is_active,
            sub_plan_id, sub_plan_label, sub_meals, sub_start_date, sub_end_date,
            sub_is_paid, sub_paid_at, sub_price_per_month, sub_amount_paid, sub_renewal_count)
           VALUES ($1,$2,$3,$4,$5,$6,TRUE,$7,$8,$9,$10,$11,$12,$13,$14,$15,0)
           RETURNING *`,
          [id, name, email, mobile, hash, role,
            planId, plan?.label ?? "Custom", meals, fmtDate(start), fmtDate(end),
            isPaid, isPaid ? new Date() : null, pricePerMonth, amountPaid]
        );

        await client.query(
          `INSERT INTO subscriptions (
            member_id, plan_id, plan_label, meals, start_date, end_date,
            price_per_month, amount_paid, is_paid, paid_at, status
          )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'active')`,
          [id, planId, plan?.label ?? "Custom", meals, fmtDate(start), fmtDate(end),
            pricePerMonth, amountPaid, isPaid, isPaid ? new Date() : null]
        );
        return rows[0];
      });
      
      await delByPattern("member:list");
      if (amountPaid > 0) {
        await query(
          `INSERT INTO payments (member_id, member_name, member_mobile, amount, method, type, plan_id) VALUES ($1,$2,$3,$4,$5,'initial',$6)`,
          [id, name, mobile, amountPaid, paymentMethod, planId]
        );
      }

      const memberObj = rowToMember(m);
      if (role === "member") {
        try {
          await sendPlanActivatedEmail(memberObj, {
            label: memberObj.subscription.planLabel,
            meals: memberObj.subscription.meals,
            startDate: memberObj.subscription.startDate,
            endDate: memberObj.subscription.endDate,
            price: memberObj.subscription.pricePerMonth,
            amountPaid: memberObj.subscription.amountPaid,
            dueAmount: memberObj.subscription.dueAmount,
          });
        } catch (mailErr) {
          console.error("[MEMBERS-ERROR] Failed to send initial plan activation email:", mailErr.message);
        }

        try {
          const otp = Math.floor(100000 + Math.random() * 900000).toString();
          await setCache(`messmate:member:${id}:email-otp`, otp, 300); // 5 minutes TTL
          await sendVerificationOTPEmail(memberObj, otp);
        } catch (otpErr) {
          console.error("[MEMBERS-ERROR] Failed to send email verification OTP:", otpErr.message);
        }
      }

      res.status(201).json(stripPassword(memberObj));
    } catch (e) { next(e); }
  });

router.put("/:id",
  requireRole("admin"),
  body("name").optional().isString().trim().notEmpty(),
  body("email").optional().isEmail(),
  body("password")
    .optional()
    .isString()
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
    .withMessage("Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"),
  async (req, res, next) => {
    try {
      const errs = validationResult(req);
      if (!errs.isEmpty()) return res.status(400).json({ error: "Invalid input", details: errs.array() });

      const existingRes = await query("SELECT email, email_verified FROM members WHERE member_id = $1", [req.params.id]);
      if (!existingRes.rows[0]) return res.status(404).json({ error: "Not found" });
      const existing = existingRes.rows[0];

      const allowed = { name: "name", email: "email", mobile: "mobile", role: "role", photoUrl: "photo_url" };
      const sets = [];
      const params = [];
      let emailChanged = false;

      if (req.body.email && req.body.email.trim().toLowerCase() !== (existing.email || "").trim().toLowerCase()) {
        emailChanged = true;
      }

      for (const [k, col] of Object.entries(allowed)) {
        if (k in req.body) {
          params.push(req.body[k]);
          sets.push(`${col} = $${params.length}`);
        }
      }
      if (req.body.password) {
        params.push(await bcrypt.hash(req.body.password, 12));
        sets.push(`password_hash = $${params.length}`);
      }

      if (emailChanged) {
        sets.push(`email_verified = FALSE`);
      }

      if (!sets.length) return res.status(400).json({ error: "No updatable fields" });
      sets.push(`updated_at = NOW()`);
      params.push(req.params.id);
      const { rows } = await query(
        `UPDATE members SET ${sets.join(", ")} WHERE member_id = $${params.length} RETURNING *`,
        params
      );
      if (!rows[0]) return res.status(404).json({ error: "Not found" });

      const updatedMember = rows[0];

      if (emailChanged) {
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        await setCache(`messmate:member:${updatedMember.member_id}:email-otp`, otp, 300);
        sendVerificationOTPEmail(
          { memberId: updatedMember.member_id, name: updatedMember.name, email: updatedMember.email },
          otp
        ).catch(err => console.error("[NOTIFY-ERROR] Failed to send verification email background:", err.message));
      }
      
      await delCache([`messmate:member:${req.params.id}`, `messmate:member:${req.params.id}:subscription`]);
      await delByPattern("member:list");
      
      res.json(stripPassword(rowToMember(rows[0])));
  } catch (e) { next(e); }
});

router.delete("/:id", requireRole("admin"), async (req, res, next) => {
  try {
    await query(`DELETE FROM members WHERE member_id = $1`, [req.params.id]);
    
    await delCache([`messmate:member:${req.params.id}`, `messmate:member:${req.params.id}:subscription`]);
    await delByPattern("member:list");
    
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.put("/:id/renew", requireRole("admin"), async (req, res, next) => {
  try {
    const today = new Date();
    const { planId = null, amountPaid = 0, paymentMethod = "Cash", applyAbsenceCredits = false } = req.body;
    
    // Fetch current member sub dates and target plan
    const currentMember = (await query(`SELECT sub_plan_id, sub_start_date, sub_end_date FROM members WHERE member_id = $1`, [req.params.id])).rows[0];
    const targetPlanId = planId || currentMember?.sub_plan_id;
    const plan = (await query(`SELECT * FROM plans WHERE plan_id = $1`, [targetPlanId])).rows[0];
    
    const duration = plan?.duration_months ?? 1;
    const price = plan?.price_per_month ?? 0;

    let credits = 0;
    if (applyAbsenceCredits && currentMember?.sub_start_date && currentMember?.sub_end_date) {
      const calc = await calculateAbsenceCredits(req.params.id, currentMember.sub_start_date, currentMember.sub_end_date);
      credits = calc.totalCreditDays;
    }

    const end = addDays(today, (duration * 30 - 1) + credits);
    const isPaid = amountPaid >= price && price > 0;

    const updatedMember = await withTx(async (client) => {
      // 1. Mark previous active/pending subscriptions of this member as expired
      await client.query(
        `UPDATE subscriptions 
         SET status = 'expired', updated_at = NOW() 
         WHERE member_id = $1 AND status IN ('active', 'pending')`,
        [req.params.id]
      );

      // 2. Insert new active subscription record
      await client.query(
        `INSERT INTO subscriptions (
          member_id, plan_id, plan_label, meals, start_date, end_date,
          price_per_month, amount_paid, is_paid, paid_at, status, renewed_at
        )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CASE WHEN $9 THEN NOW() ELSE NULL END, 'active', NOW())`,
        [req.params.id, plan?.plan_id, plan?.label, plan?.meals || "{}", fmtDate(today), fmtDate(end), price, amountPaid, isPaid]
      );

      // 3. Update the member profile
      const { rows } = await client.query(
        `UPDATE members SET 
           sub_plan_id = $1, sub_plan_label = $2, sub_meals = $3,
           sub_start_date = $4, sub_end_date = $5, 
           sub_is_paid = $6, sub_price_per_month = $7, sub_amount_paid = $8,
           sub_renewed_at = NOW(), sub_renewal_count = sub_renewal_count + 1,
           sub_paid_at = CASE WHEN $6 THEN NOW() ELSE sub_paid_at END, 
           is_active = TRUE,
           updated_at = NOW()
         WHERE member_id = $9 RETURNING *`,
        [plan?.plan_id, plan?.label, plan?.meals || "{}", fmtDate(today), fmtDate(end), isPaid, price, amountPaid, req.params.id]
      );
      return rows[0];
    });
    if (!updatedMember) return res.status(404).json({ error: "Not found" });

    if (amountPaid > 0) {
      await query(
        `INSERT INTO payments (member_id, member_name, member_mobile, amount, method, type, plan_id) VALUES ($1,$2,$3,$4,$5,'renewal',$6)`,
        [req.params.id, updatedMember.name, updatedMember.mobile, amountPaid, paymentMethod, plan?.plan_id]
      );
    }
    
    await delCache([`messmate:member:${req.params.id}`, `messmate:member:${req.params.id}:subscription`, `messmate:report:weekly`]);
    await delByPattern("member:list");
    await delByPattern("report:expiring");

    // Dispatch plan activation email asynchronously
    if (updatedMember.email_verified === false) {
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      await setCache(`messmate:member:${updatedMember.member_id}:email-otp`, otp, 300);
      sendVerificationOTPEmail(
        { memberId: updatedMember.member_id, name: updatedMember.name, email: updatedMember.email },
        otp
      ).catch(err => console.error("[NOTIFY-ERROR] Failed to send verification email background:", err.message));
    }

    sendPlanActivatedEmail(
      { memberId: updatedMember.member_id, name: updatedMember.name, email: updatedMember.email },
      {
        label: updatedMember.sub_plan_label,
        meals: updatedMember.sub_meals,
        startDate: updatedMember.sub_start_date ? fmtDate(new Date(updatedMember.sub_start_date)) : "",
        endDate: updatedMember.sub_end_date ? fmtDate(new Date(updatedMember.sub_end_date)) : "",
        price: updatedMember.sub_price_per_month,
        amountPaid: updatedMember.sub_amount_paid,
        dueAmount: Math.max(0, updatedMember.sub_price_per_month - updatedMember.sub_amount_paid)
      }
    ).catch(err => console.error("[NOTIFY-ERROR] Failed to send activation email background:", err.message));
    
    res.json(rowToMember(rows[0]).subscription);
  } catch (e) { next(e); }
});

router.put("/:id/payment", requireRole("admin"),
  body("amountPaid").isNumeric(),
  async (req, res, next) => {
    try {
      const { amountPaid, paymentMethod = "Cash" } = req.body;
      const updatedMember = await withTx(async (client) => {
        const { rows } = await client.query(
          `UPDATE members SET 
             sub_amount_paid = sub_amount_paid + $1,
             sub_is_paid = (sub_amount_paid + $1) >= sub_price_per_month AND sub_price_per_month > 0,
             sub_paid_at = CASE WHEN (sub_amount_paid + $1) >= sub_price_per_month AND sub_price_per_month > 0 THEN NOW() ELSE sub_paid_at END,
             is_active = TRUE,
             updated_at = NOW()
           WHERE member_id = $2 RETURNING *`,
          [amountPaid, req.params.id]
        );
        if (rows.length > 0) {
          await client.query(
            `UPDATE subscriptions SET
               amount_paid = amount_paid + $1,
               is_paid = (amount_paid + $1) >= price_per_month AND price_per_month > 0,
               paid_at = CASE WHEN (amount_paid + $1) >= price_per_month AND price_per_month > 0 THEN NOW() ELSE paid_at END,
               updated_at = NOW()
             WHERE member_id = $2 AND status = 'active'`,
            [amountPaid, req.params.id]
          );
        }
        return rows[0];
      });
      if (!updatedMember) return res.status(404).json({ error: "Not found" });

      const oldAmountPaid = updatedMember.sub_amount_paid - amountPaid;
      const paymentType = (oldAmountPaid <= 0 && updatedMember.sub_renewal_count === 0) ? "initial" : "top-up";

      await query(
        `INSERT INTO payments (member_id, member_name, member_mobile, amount, method, type, plan_id) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [req.params.id, updatedMember.name, updatedMember.mobile, amountPaid, paymentMethod, paymentType, updatedMember.sub_plan_id]
      );
      
      await delCache([`messmate:member:${req.params.id}`, `messmate:member:${req.params.id}:subscription`]);
      await delByPattern("member:list");

      // Dispatch plan activation email asynchronously
      if (updatedMember.email_verified === false) {
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        await setCache(`messmate:member:${updatedMember.member_id}:email-otp`, otp, 300);
        sendVerificationOTPEmail(
          { memberId: updatedMember.member_id, name: updatedMember.name, email: updatedMember.email },
          otp
        ).catch(err => console.error("[NOTIFY-ERROR] Failed to send verification email background:", err.message));
      }

      sendPlanActivatedEmail(
        { memberId: updatedMember.member_id, name: updatedMember.name, email: updatedMember.email },
        {
          label: updatedMember.sub_plan_label,
          meals: updatedMember.sub_meals,
          startDate: updatedMember.sub_start_date ? fmtDate(new Date(updatedMember.sub_start_date)) : "",
          endDate: updatedMember.sub_end_date ? fmtDate(new Date(updatedMember.sub_end_date)) : "",
          price: updatedMember.sub_price_per_month,
          amountPaid: updatedMember.sub_amount_paid,
          dueAmount: Math.max(0, updatedMember.sub_price_per_month - updatedMember.sub_amount_paid)
        }
      ).catch(err => console.error("[NOTIFY-ERROR] Failed to send activation email background:", err.message));
      
      res.json(rowToMember(updatedMember).subscription);
    } catch (e) { next(e); }
  });

router.put("/:id/plan", requireRole("admin"), async (req, res, next) => {
  try {
    const { planId, meals, startDate } = req.body;
    const plan = (await query(`SELECT * FROM plans WHERE plan_id = $1`, [planId])).rows[0];
    const current = (await query(`SELECT * FROM members WHERE member_id = $1`, [req.params.id])).rows[0];
    if (!current) return res.status(404).json({ error: "Not found" });

    const newMeals = meals ?? plan?.meals ?? current.sub_meals;
    const newStart = startDate ? new Date(startDate) : current.sub_start_date;
    const newEnd = startDate ? addDays(new Date(startDate), (plan?.duration_months ?? 1) * 30 - 1) : current.sub_end_date;
    const newPrice = plan?.price_per_month ?? current.sub_price_per_month;
    const newPaid = current.sub_amount_paid >= newPrice && newPrice > 0;

    const { rows } = await withTx(async (client) => {
      await client.query(
        `UPDATE subscriptions SET
           plan_id = $1, plan_label = $2, meals = $3,
           price_per_month = $4, start_date = $5, end_date = $6,
           is_paid = $7, updated_at = NOW()
         WHERE member_id = $8 AND status = 'active'`,
        [planId, plan?.label ?? "Custom", newMeals,
         newPrice,
         newStart instanceof Date ? fmtDate(newStart) : newStart,
         newEnd instanceof Date ? fmtDate(newEnd) : newEnd,
         newPaid, req.params.id]
      );

      return client.query(
        `UPDATE members SET sub_plan_id = $1, sub_plan_label = $2, sub_meals = $3,
           sub_price_per_month = $4, sub_start_date = $5, sub_end_date = $6,
           sub_is_paid = $7, updated_at = NOW()
         WHERE member_id = $8 RETURNING *`,
        [planId, plan?.label ?? "Custom", newMeals,
         newPrice,
         newStart instanceof Date ? fmtDate(newStart) : newStart,
         newEnd instanceof Date ? fmtDate(newEnd) : newEnd,
         newPaid, req.params.id]
      );
    });
    
    await delCache([`messmate:member:${req.params.id}`, `messmate:member:${req.params.id}:subscription`]);
    await delByPattern("member:list");
    await delByPattern("report:expiring");
    
    res.json(rowToMember(rows[0]).subscription);
  } catch (e) { next(e); }
});

export default router;
