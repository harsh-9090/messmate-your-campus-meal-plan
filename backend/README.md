# MessMate - Backend (Node.js + Express + PostgreSQL)

Standalone REST API for the MessMate hostel mess management system.

## Quick start

```bash
cd backend
cp .env.example .env          # then edit DATABASE_URL + JWT secrets
npm install
npm run seed                  # creates schema + sample admin/staff/members + plans + windows
npm run dev                   # http://localhost:4000
```

Requires Node 20+ and PostgreSQL 13+ (local, Docker, Neon, Supabase Postgres, RDS, etc.).

`npm run seed` calls `migrate` first, so a fresh database is bootstrapped end-to-end.
If you only want to (re)create the schema without seed data, run `npm run migrate`.
The dev server also runs `migrate()` on boot - safe because the schema uses `IF NOT EXISTS`.

## Database setup

Either set a single `DATABASE_URL`:

```
DATABASE_URL=postgres://user:pass@host:5432/messmate
```

…or use the discrete `PGHOST` / `PGPORT` / `PGUSER` / `PGPASSWORD` / `PGDATABASE` env vars.
For managed providers that require TLS, set `PGSSL=true` (or include `?sslmode=require` in the URL).

Local Docker option:

```bash
docker run --name messmate-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=messmate -p 5432:5432 -d postgres:16
```

## Default seeded credentials

| Role   | ID       | Password   |
|--------|----------|------------|
| Admin  | ADMIN01  | admin123   |
| Staff  | STAFF01  | staff123   |
| Member | STU001…STU005 | pass123 |

## API base

`/api/v1`

Highlights:

- `POST /auth/login` - returns access token + sets refresh httpOnly cookie
- `GET  /qr/token` - member-only, returns 8-second JWT QR token
- `POST /scan/validate` - staff-only, body `{ qrToken, meal }`, runs the 5-step validator
- `GET  /members`, `POST /members`, `PUT /members/:id/renew`, etc.
- `GET  /reports/daily?date=YYYY-MM-DD`
- `GET  /reports/export?type=daily&format=csv`

## 5-Step Scan Validation

Implemented in `src/services/scanValidator.js`. Order is strict:

1. UNPAID - `sub_is_paid = FALSE`
2. EXPIRED - today outside `[sub_start_date, sub_end_date]`
3. NOT_IN_PLAN - meal not in `sub_meals[]`
4. WRONG_TIME - current time outside the meal's window
5. ALREADY_USED - conditional `UPDATE meal_usage SET used_<meal> = TRUE WHERE used_<meal> = FALSE`
   (atomic - Postgres `RETURNING` returns no row if already used)

If all pass: mark usage, log scan, return success.

## Schema

See `src/db/schema.sql`. Tables: `plans`, `meal_windows`, `members` (with flat `sub_*` columns),
`meal_usage` (unique on `member_id, date`), `scan_logs`.

## Cron

`src/cron/dailyJobs.js` runs at `00:01` server-time daily and:
- flags members expiring in 3 days (notification stub)
- flags members expired today

## Security defaults

- bcrypt salt rounds = 12
- access JWT = 15m (Authorization: Bearer)
- refresh JWT = 7d (httpOnly cookie)
- QR JWT = 8s with random `nonce`
- `helmet`, `cors` whitelist via `CLIENT_ORIGIN`, `express-rate-limit` on `/scan/*` and `/qr/*`
- soft delete (`is_active = FALSE`) - members never hard-deleted

## Deploy

Render / Railway / Fly.io / your own VPS. Set every env var from `.env.example`. Point your frontend at `VITE_API_URL=https://<deployed-host>/api/v1`.

## Notes

- Email/WhatsApp notifications are stubbed - wire `nodemailer` and `twilio` with the provided env vars.
- Razorpay integration is intentionally not included (Phase 2).
- This server is independent of the Lovable frontend; it is **not** deployed by Lovable.
