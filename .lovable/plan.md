
# MessMate Implementation Plan

This is a large full-stack project. I'll build it in two parts:

## Part A — Frontend (this Lovable project)
A React PWA inside the existing TanStack Start template. Since the spec calls for `client/` with `src/pages/`, I'll adapt to TanStack Router file-based routing under `src/routes/` (TanStack template doesn't use `src/pages/`).

**Routes**
- `/login` — login page (role-based redirect)
- `/admin` (layout) → `dashboard`, `members`, `scan-logs`, `reports`, `plan-config`
- `/staff/scanner` — mobile-first scanner with html5-qrcode
- `/member` — QR portal + today's meals + history

**Components**: QRCanvas (8s refresh + countdown ring), SubscriptionBar, MealChip, ScanResult (fullscreen green/red), PlanBadge, ExpiryAlert, StatCard, MealWindowCard, AppSidebar.

**State**: Zustand stores (auth, members, scan). Axios with refresh interceptor. API base URL from `VITE_API_URL`.

**Demo mode**: Since the Node backend won't run inside Lovable's preview, I'll include a `VITE_DEMO_MODE=true` mock API layer so the UI is fully clickable in preview using seeded in-memory data (mirrors backend validation). Real backend is used when `VITE_API_URL` is set.

**Design**: Dark indigo (#6366f1) + white, Georgia headings + Inter body, semantic tokens in `src/styles.css` (oklch). Tailwind v4.

## Part B — Standalone Backend (`backend/` folder, NOT deployed by Lovable)
Full Node 20 + Express 4 + MongoDB/Mongoose code as specified. The user runs it themselves with `cd backend && npm install && npm run dev`.

**Files**
- `src/index.js`, `src/app.js`
- Models: Member, MealUsage, ScanLog, Plan, MealWindow
- Routes + controllers: auth, members, qr, scan, usage, reports, config
- Middleware: authMiddleware (verifyToken, requireRole), rateLimiter, errorHandler
- Services: scanValidator (5-step), qrService (JWT 8s), memberIdService, notificationService (stub), reportService (CSV via json2csv)
- Cron: dailyJobs (expiry reminders, summary)
- `seed.js` — sample admin, staff, 10 members, plans, windows
- `.env.example`, `README.md`

**Security**: bcrypt(12), JWT access 15m, refresh 7d httpOnly cookie, QR JWT 8s + nonce, express-rate-limit, helmet, cors, express-validator.

## Scope discipline
The spec is enormous; I'll deliver a polished, working v1 covering all listed routes/features but keep some areas pragmatic:
- Notifications (email/WhatsApp): stubbed with console + interface ready for Nodemailer/Twilio creds
- Razorpay: not implemented (spec says "Phase 2")
- Offline IndexedDB sync: basic service worker + cache, not full offline scan queue
- Reports CSV: implemented; charts use recharts

## Deliverable
After build: working preview with demo mode, plus `backend/` folder containing the complete Node server the user can run locally / deploy to Render.

Proceeding to implement.
