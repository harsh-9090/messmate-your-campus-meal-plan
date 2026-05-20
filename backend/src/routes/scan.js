import { Router } from "express";
import { body, validationResult } from "express-validator";
import { format } from "date-fns";
import { verifyToken, requireRole } from "../middleware/authMiddleware.js";
import { scanLimiter } from "../middleware/rateLimiter.js";
import { verifyQRToken, getISTDateStr } from "../services/qrService.js";
import { query, rowToMember, stripPassword } from "../db/index.js";
import { validateAndRecord } from "../services/scanValidator.js";

import { getCache, setCache } from "../db/redis.js";

const router = Router();
router.use(verifyToken);

// GET /scan/lookup - staff/admin only
router.get("/lookup", requireRole("staff", "admin"), async (req, res, next) => {
  try {
    const { query: searchVal } = req.query;
    if (!searchVal) return res.status(400).json({ error: "Search query is required" });

    // Search by member_id (exact match) or mobile (exact match)
    const { rows } = await query(
      `SELECT * FROM members 
       WHERE role = 'member' AND is_active = TRUE AND (member_id = $1 OR mobile = $1)`,
      [searchVal.trim()]
    );
    if (!rows[0]) return res.status(404).json({ error: "No active member found with this ID or contact number" });
    
    const member = rowToMember(rows[0]);
    res.json(stripPassword(member));
  } catch (e) { next(e); }
});

// POST /scan/manual - staff/admin only
router.post("/manual", requireRole("staff", "admin"),
  body("memberId").isString().notEmpty(),
  body("meal").isIn(["Breakfast", "Lunch", "Dinner"]),
  async (req, res, next) => {
    try {
      const errs = validationResult(req);
      if (!errs.isEmpty()) return res.status(400).json({ error: "Invalid input", details: errs.array() });

      const { memberId, meal } = req.body;

      // Check if today is a scheduled active holiday
      const todayStr = getISTDateStr();
      const holidayRes = await query(
        `SELECT content FROM dashboard_notifications 
         WHERE type = 'holiday' AND holiday_date = $1 AND is_active = TRUE LIMIT 1`,
        [todayStr]
      );
      if (holidayRes.rows.length > 0) {
        const reason = `Mess is closed today: ${holidayRes.rows[0].content}`;
        await query(
          `INSERT INTO scan_logs (member_id, member_name, meal, date, ts, status, denial_code, denial_reason, scanned_by)
           VALUES ($1, $2, $3, $4, NOW(), 'denied', 'MESS_CLOSED', $5, $6)`,
          [memberId, null, meal, todayStr, reason, req.user.sub]
        );
        return res.status(200).json({
          status: "denied",
          code: "MESS_CLOSED",
          reason,
          meal,
          member: { memberId }
        });
      }

      const { rows } = await query(
        `SELECT * FROM members WHERE member_id = $1 AND is_active = TRUE`,
        [memberId]
      );
      if (!rows[0]) return res.status(404).json({ error: "Active member not found" });

      const member = rowToMember(rows[0]);
      
      const result = await validateAndRecord({
        member,
        meal,
        scannedBy: req.user.sub,
        deviceInfo: `${req.headers["user-agent"] || ""} (Manual Check-in)`,
      });
      res.json(result);
    } catch (e) { next(e); }
  });

// POST /scan/validate  - staff/admin only
router.post("/validate",
  requireRole("staff", "admin"),
  scanLimiter,
  body("qrToken").isString().notEmpty(),
  body("meal").isIn(["Breakfast", "Lunch", "Dinner"]),
  async (req, res, next) => {
    try {
      const errs = validationResult(req);
      if (!errs.isEmpty()) return res.status(400).json({ error: "Invalid input", details: errs.array() });
      const { qrToken, meal } = req.body;

      // Check if today is a scheduled active holiday
      const todayStr = getISTDateStr();
      const holidayRes = await query(
        `SELECT content FROM dashboard_notifications 
         WHERE type = 'holiday' AND holiday_date = $1 AND is_active = TRUE LIMIT 1`,
        [todayStr]
      );
      if (holidayRes.rows.length > 0) {
        const reason = `Mess is closed today: ${holidayRes.rows[0].content}`;
        let memberId = null;
        let memberName = null;
        try {
          const decoded = await verifyQRToken(qrToken, meal);
          if (decoded) {
            memberId = decoded.userId;
            const mRes = await query(`SELECT name FROM members WHERE member_id = $1`, [memberId]);
            memberName = mRes.rows[0]?.name || null;
          }
        } catch {}

        await query(
          `INSERT INTO scan_logs (member_id, member_name, meal, date, ts, status, denial_code, denial_reason, scanned_by)
           VALUES ($1, $2, $3, $4, NOW(), 'denied', 'MESS_CLOSED', $5, $6)`,
          [memberId, memberName, meal, todayStr, reason, req.user.sub]
        );
        return res.status(200).json({
          status: "denied",
          code: "MESS_CLOSED",
          reason,
          meal,
          member: memberId ? { memberId, name: memberName } : null
        });
      }

      const decoded = await verifyQRToken(qrToken, meal);
      if (!decoded) {
        await query(
          `INSERT INTO scan_logs (meal, date, ts, status, denial_code, denial_reason, scanned_by)
           VALUES ($1, $2, NOW(), 'denied', 'INVALID_TOKEN', 'Invalid or expired QR code', $3)`,
          [meal, format(new Date(), "yyyy-MM-dd"), req.user.sub]
        );
        return res.status(200).json({ status: "denied", code: "INVALID_TOKEN", reason: "Invalid or expired QR code", meal });
      }

      const memberId = decoded.userId;
      let member = await getCache(`messmate:member:${memberId}`);
      let subscription = await getCache(`messmate:member:${memberId}:subscription`);
      
      if (!member || !subscription) {
        const { rows } = await query(
          `SELECT * FROM members WHERE member_id = $1 AND is_active = TRUE`,
          [memberId]
        );
        member = rowToMember(rows[0]);
        if (member) {
          subscription = member.subscription;
          await setCache(`messmate:member:${memberId}`, member, 600); // 10 min
          await setCache(`messmate:member:${memberId}:subscription`, subscription, 300); // 5 min
        }
      } else {
        member.subscription = subscription;
      }

      if (decoded.isMismatch) {
        const reason = `It is currently the ${meal} window, but this QR code is for ${decoded.tokenMeal}`;
        await query(
          `INSERT INTO scan_logs (member_id, member_name, meal, date, ts, status, denial_code, denial_reason, scanned_by)
           VALUES ($1, $2, $3, $4, NOW(), 'denied', 'WRONG_MEAL_QR', $5, $6)`,
          [memberId, member ? member.name : null, meal, format(new Date(), "yyyy-MM-dd"), reason, req.user.sub]
        );
        return res.status(200).json({
          status: "denied",
          code: "WRONG_MEAL_QR",
          reason,
          meal,
          member: member ? { memberId: member.memberId, name: member.name } : null
        });
      }

      const result = await validateAndRecord({
        member, meal, scannedBy: req.user.sub, deviceInfo: req.headers["user-agent"],
      });
      res.json(result);
    } catch (e) { next(e); }
  });

// GET /scan/logs?date=&memberId=&status=&code=&limit=&page=
// admin/staff: full feed; member: only their own
router.get("/logs", async (req, res, next) => {
  try {
    const { date, memberId, status, code, limit = 100, page = 1 } = req.query;
    
    // Only cache simple requests (first page, no filters other than date and memberId)
    const isCacheable = parseInt(page, 10) === 1 && parseInt(limit, 10) === 100 && !status && !code && date;
    let cacheKey = null;
    if (isCacheable) {
      if (req.user.role === "member") cacheKey = `messmate:scan:log:${date}:${req.user.sub}`;
      else if (memberId) cacheKey = `messmate:scan:log:${date}:${memberId}`;
      else cacheKey = `messmate:scan:log:${date}`;
      
      const cached = await getCache(cacheKey);
      if (cached) return res.json(cached);
    }

    const where = [];
    const params = [];
    const role = req.user.role;
    if (role === "member") { params.push(req.user.sub); where.push(`member_id = $${params.length}`); }
    else if (memberId)     { params.push(memberId);     where.push(`member_id = $${params.length}`); }
    if (date)   { params.push(date);   where.push(`date = $${params.length}`); }
    if (status) { params.push(status); where.push(`status = $${params.length}`); }
    if (code)   { params.push(code);   where.push(`denial_code = $${params.length}`); }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const lim = Math.min(parseInt(limit, 10) || 100, 500);
    const pg = parseInt(page, 10) || 1;
    const offset = (pg - 1) * lim;
    params.push(lim, offset);

    const { rows } = await query(
      `SELECT id, member_id, member_name, meal, date, ts, status, denial_code, denial_reason, scanned_by
         FROM scan_logs ${whereSql}
         ORDER BY ts DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    
    const result = rows.map((l) => ({
      id: String(l.id),
      memberId: l.member_id ?? "",
      memberName: l.member_name ?? "Unknown",
      meal: l.meal,
      date: format(l.date, "yyyy-MM-dd"),
      timestamp: l.ts,
      status: l.status,
      denialCode: l.denial_code ?? undefined,
      denialReason: l.denial_reason ?? undefined,
      scannedBy: l.scanned_by ?? "",
    }));
    
    if (isCacheable && cacheKey) {
      await setCache(cacheKey, result, 120); // 2 min
    }
    
    res.json(result);
  } catch (e) { next(e); }
});

export default router;
