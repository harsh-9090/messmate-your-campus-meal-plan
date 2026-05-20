import { Router } from "express";
import { query } from "../db/index.js";
import { verifyToken, requireRole } from "../middleware/authMiddleware.js";

const router = Router();
router.use(verifyToken);

const formatSqlDate = (d) => {
  if (d instanceof Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  return d;
};

// GET /notifications -> list currently active notifications for dashboard banner display
router.get("/", async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, title, content, type, holiday_date, start_time, end_time, is_active,
              block_breakfast, block_lunch, block_dinner
       FROM dashboard_notifications
       WHERE is_active = TRUE
         AND NOW() BETWEEN start_time AND end_time
       ORDER BY start_time ASC`
    );
    res.json(rows.map(r => ({
      id: r.id,
      title: r.title,
      content: r.content,
      type: r.type,
      holidayDate: r.holiday_date ? formatSqlDate(r.holiday_date) : null,
      startTime: r.start_time,
      endTime: r.end_time,
      isActive: r.is_active,
      blockBreakfast: r.block_breakfast,
      blockLunch: r.block_lunch,
      blockDinner: r.block_dinner,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    })));
  } catch (e) { next(e); }
});

// GET /notifications/all -> list all notifications (Admin only)
router.get("/all", requireRole("admin"), async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, title, content, type, holiday_date, start_time, end_time, is_active,
              block_breakfast, block_lunch, block_dinner, created_at, updated_at
       FROM dashboard_notifications
       ORDER BY start_time DESC`
    );
    res.json(rows.map(r => ({
      id: r.id,
      title: r.title,
      content: r.content,
      type: r.type,
      holidayDate: r.holiday_date ? formatSqlDate(r.holiday_date) : null,
      startTime: r.start_time,
      endTime: r.end_time,
      isActive: r.is_active,
      blockBreakfast: r.block_breakfast,
      blockLunch: r.block_lunch,
      blockDinner: r.block_dinner,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    })));
  } catch (e) { next(e); }
});

// POST /notifications -> create notification (Admin only)
router.post("/", requireRole("admin"), async (req, res, next) => {
  try {
    const {
      title, content, type, holidayDate = null, startTime, endTime, isActive = true,
      blockBreakfast = true, blockLunch = true, blockDinner = true
    } = req.body;

    if (!title || !content || !type) {
      return res.status(400).json({ error: "title, content, and type are required" });
    }

    if (!['general', 'holiday'].includes(type)) {
      return res.status(400).json({ error: "type must be 'general' or 'holiday'" });
    }

    let finalStartTime = startTime;
    let finalEndTime = endTime;

    if (type === 'holiday') {
      if (!holidayDate || !/^\d{4}-\d{2}-\d{2}$/.test(holidayDate)) {
        return res.status(400).json({ error: "holidayDate is required in YYYY-MM-DD format when type is 'holiday'" });
      }
      // Calculate display starts (2 days before holiday at 00:00:00 IST) and ends (holiday itself at 23:59:59 IST)
      const startD = new Date(`${holidayDate}T00:00:00+05:30`);
      startD.setDate(startD.getDate() - 2);
      const endD = new Date(`${holidayDate}T23:59:59+05:30`);

      finalStartTime = startD.toISOString();
      finalEndTime = endD.toISOString();
    } else {
      if (!startTime || !endTime) {
        return res.status(400).json({ error: "startTime and endTime are required for general notices" });
      }
    }

    const { rows } = await query(
      `INSERT INTO dashboard_notifications 
        (title, content, type, holiday_date, start_time, end_time, is_active,
         block_breakfast, block_lunch, block_dinner, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
       RETURNING *`,
      [title, content, type, holidayDate, finalStartTime, finalEndTime, isActive, blockBreakfast, blockLunch, blockDinner]
    );

    const r = rows[0];
    res.status(201).json({
      id: r.id,
      title: r.title,
      content: r.content,
      type: r.type,
      holidayDate: r.holiday_date ? formatSqlDate(r.holiday_date) : null,
      startTime: r.start_time,
      endTime: r.end_time,
      isActive: r.is_active,
      blockBreakfast: r.block_breakfast,
      blockLunch: r.block_lunch,
      blockDinner: r.block_dinner,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    });
  } catch (e) { next(e); }
});

// PUT /notifications/:id -> update notification (Admin only)
router.put("/:id", requireRole("admin"), async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      title, content, type, holidayDate = null, startTime, endTime, isActive,
      blockBreakfast, blockLunch, blockDinner
    } = req.body;

    // Check if notification exists
    const check = await query(`SELECT * FROM dashboard_notifications WHERE id = $1`, [id]);
    if (!check.rows[0]) return res.status(404).json({ error: "Notification not found" });

    const newTitle = title ?? check.rows[0].title;
    const newContent = content ?? check.rows[0].content;
    const newType = type ?? check.rows[0].type;
    const newHolidayDate = type ? (holidayDate ?? null) : check.rows[0].holiday_date;
    const newIsActive = isActive ?? check.rows[0].is_active;
    const newBlockBreakfast = blockBreakfast ?? check.rows[0].block_breakfast;
    const newBlockLunch = blockLunch ?? check.rows[0].block_lunch;
    const newBlockDinner = blockDinner ?? check.rows[0].block_dinner;
    let finalStartTime = startTime ?? check.rows[0].start_time;
    let finalEndTime = endTime ?? check.rows[0].end_time;

    if (newType === 'holiday') {
      if (!newHolidayDate || !/^\d{4}-\d{2}-\d{2}$/.test(newHolidayDate)) {
        return res.status(400).json({ error: "holidayDate is required in YYYY-MM-DD format when type is 'holiday'" });
      }
      // Calculate display starts (2 days before holiday at 00:00:00 IST) and ends (holiday itself at 23:59:59 IST)
      const startD = new Date(`${newHolidayDate}T00:00:00+05:30`);
      startD.setDate(startD.getDate() - 2);
      const endD = new Date(`${newHolidayDate}T23:59:59+05:30`);

      finalStartTime = startD.toISOString();
      finalEndTime = endD.toISOString();
    } else {
      if (!finalStartTime || !finalEndTime) {
        return res.status(400).json({ error: "startTime and endTime are required for general notices" });
      }
    }

    const { rows } = await query(
      `UPDATE dashboard_notifications
       SET title = $1, content = $2, type = $3, holiday_date = $4,
           start_time = $5, end_time = $6, is_active = $7,
           block_breakfast = $8, block_lunch = $9, block_dinner = $10,
           updated_at = NOW()
       WHERE id = $11 RETURNING *`,
      [
        newTitle, newContent, newType, newHolidayDate, finalStartTime, finalEndTime, newIsActive,
        newBlockBreakfast, newBlockLunch, newBlockDinner, id
      ]
    );

    const r = rows[0];
    res.json({
      id: r.id,
      title: r.title,
      content: r.content,
      type: r.type,
      holidayDate: r.holiday_date ? formatSqlDate(r.holiday_date) : null,
      startTime: r.start_time,
      endTime: r.end_time,
      isActive: r.is_active,
      blockBreakfast: r.block_breakfast,
      blockLunch: r.block_lunch,
      blockDinner: r.block_dinner,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    });
  } catch (e) { next(e); }
});

// DELETE /notifications/:id -> delete notification (Admin only)
router.delete("/:id", requireRole("admin"), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rowCount } = await query(`DELETE FROM dashboard_notifications WHERE id = $1`, [id]);
    if (rowCount === 0) return res.status(404).json({ error: "Notification not found" });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;
