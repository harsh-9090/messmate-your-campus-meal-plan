# MessMate — Backend (Node.js + Express + MongoDB)

Standalone REST API for the MessMate hostel mess management system.

## Quick start

```bash
cd backend
cp .env.example .env          # then edit secrets + MongoDB URI
npm install
npm run seed                  # create sample admin/staff/members + plans + windows
npm run dev                   # http://localhost:4000
```

Requires Node 20+ and MongoDB (local or Atlas).

## Default seeded credentials

| Role   | ID       | Password   |
|--------|----------|------------|
| Admin  | ADMIN01  | admin123   |
| Staff  | STAFF01  | staff123   |
| Member | STU001…STU010 | pass123 |

## API base

`/api/v1`

See route files in `src/routes/` for the full surface. Highlights:

- `POST /auth/login` — returns access token + sets refresh httpOnly cookie
- `GET  /qr/token` — member-only, returns 8-second JWT QR token
- `POST /scan/validate` — staff-only, body `{ qrToken, meal }`, runs the 5-step validator
- `GET  /members`, `POST /members`, `PUT /members/:id/renew`, etc.
- `GET  /reports/daily?date=YYYY-MM-DD`
- `GET  /reports/export?type=daily&format=csv`

## 5-Step Scan Validation

Implemented in `src/services/scanValidator.js`. Order is strict:

1. UNPAID — `subscription.isPaid === false`
2. EXPIRED — today outside `[startDate, endDate]`
3. NOT_IN_PLAN — meal not in `subscription.meals[]`
4. WRONG_TIME — current time outside the meal's window
5. ALREADY_USED — `MealUsage.usedMeals[meal] === true`

If all pass: mark usage, log scan, return success.

## Cron

`src/cron/dailyJobs.js` runs at `00:01` server-time daily and:
- flags members expiring in 3 days (notification stub)
- flags members expired today
- generates a daily summary

## Security defaults

- bcrypt salt rounds = 12
- access JWT = 15m (Authorization: Bearer)
- refresh JWT = 7d (httpOnly cookie)
- QR JWT = 8s with random `nonce`
- `helmet`, `cors` whitelist via `CLIENT_ORIGIN`, `express-rate-limit` on `/scan/*` and `/qr/*`
- soft delete (`isActive=false`) — members never hard-deleted

## Deploy

Render / Railway / Fly.io / your own VPS. Set every env var from `.env.example`. Point your frontend at `VITE_API_URL=https://<deployed-host>/api/v1`.

## Notes

- Email/WhatsApp notifications are stubbed — wire `nodemailer` and `twilio` with the provided env vars.
- Razorpay integration is intentionally not included (Phase 2).
- This server is independent of the Lovable frontend; it is **not** deployed by Lovable.
