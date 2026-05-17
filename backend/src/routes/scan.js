import { Router } from "express";
import { body, validationResult } from "express-validator";
import { format } from "date-fns";
import { verifyToken, requireRole } from "../middleware/authMiddleware.js";
import { scanLimiter } from "../middleware/rateLimiter.js";
import { verifyQRToken } from "../services/qrService.js";
import { query, rowToMember } from "../db/index.js";
import { validateAndRecord } from "../services/scanValidator.js";

import { getCache, setCache } from "../db/redis.js";

const router = Router();
router.use(verifyToken);

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
      const decoded = await verifyQRToken(qrToken);
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
