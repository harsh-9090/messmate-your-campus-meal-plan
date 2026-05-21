-- MessMate PostgreSQL schema

CREATE TABLE IF NOT EXISTS plans (
  plan_id           TEXT PRIMARY KEY,
  label             TEXT NOT NULL,
  meals             TEXT[] NOT NULL,
  price_per_month   INTEGER NOT NULL,
  duration_months   INTEGER NOT NULL DEFAULT 1,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS meal_windows (
  meal        TEXT PRIMARY KEY CHECK (meal IN ('Breakfast','Lunch','Dinner')),
  start_time  TEXT NOT NULL,   -- "HH:MM"
  end_time    TEXT NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS members (
  member_id           TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  email               TEXT NOT NULL UNIQUE,
  mobile              TEXT,
  password_hash       TEXT NOT NULL,
  photo_url           TEXT,
  role                TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin','staff','member')),
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,

  sub_plan_id         TEXT,
  sub_plan_label      TEXT,
  sub_meals           TEXT[] DEFAULT '{}',
  sub_start_date      DATE,
  sub_end_date        DATE,
  sub_is_paid         BOOLEAN NOT NULL DEFAULT FALSE,
  sub_paid_at         TIMESTAMPTZ,
  sub_price_per_month INTEGER DEFAULT 0,
  sub_amount_paid     INTEGER NOT NULL DEFAULT 0,
  sub_renewed_at      TIMESTAMPTZ,
  sub_renewal_count   INTEGER NOT NULL DEFAULT 0,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS members_role_active_idx ON members(role, is_active);
CREATE INDEX IF NOT EXISTS members_sub_end_idx     ON members(sub_end_date);
CREATE INDEX IF NOT EXISTS members_sub_paid_idx    ON members(sub_is_paid);

CREATE TABLE IF NOT EXISTS meal_usage (
  id              BIGSERIAL PRIMARY KEY,
  member_id       TEXT NOT NULL REFERENCES members(member_id) ON DELETE CASCADE,
  date            DATE NOT NULL,
  used_breakfast  BOOLEAN NOT NULL DEFAULT FALSE,
  used_lunch      BOOLEAN NOT NULL DEFAULT FALSE,
  used_dinner     BOOLEAN NOT NULL DEFAULT FALSE,
  used_count      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (member_id, date)
);

CREATE INDEX IF NOT EXISTS meal_usage_date_idx ON meal_usage(date);

CREATE TABLE IF NOT EXISTS scan_logs (
  id             BIGSERIAL PRIMARY KEY,
  member_id      TEXT,
  member_name    TEXT,
  meal           TEXT CHECK (meal IN ('Breakfast','Lunch','Dinner')),
  date           DATE NOT NULL,
  ts             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status         TEXT NOT NULL CHECK (status IN ('allowed','denied')),
  denial_code    TEXT,
  denial_reason  TEXT,
  scanned_by     TEXT,
  device_info    TEXT
);

CREATE INDEX IF NOT EXISTS scan_logs_member_date_idx ON scan_logs(member_id, date);
CREATE INDEX IF NOT EXISTS scan_logs_date_status_idx ON scan_logs(date, status);
CREATE INDEX IF NOT EXISTS scan_logs_ts_idx          ON scan_logs(ts);

CREATE TABLE IF NOT EXISTS payments (
  id             BIGSERIAL PRIMARY KEY,
  member_id      TEXT REFERENCES members(member_id) ON DELETE SET NULL,
  member_name    TEXT,
  member_mobile  TEXT,
  plan_id        TEXT,
  amount         INTEGER NOT NULL,
  method         TEXT NOT NULL, -- 'Cash', 'Online', 'UPI', 'Card'
  type           TEXT NOT NULL, -- 'initial', 'renewal', 'topup'
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS payments_member_idx ON payments(member_id);
CREATE INDEX IF NOT EXISTS payments_created_at_idx ON payments(created_at);

-- Migrations for existing payments table
ALTER TABLE payments ADD COLUMN IF NOT EXISTS member_name TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS member_mobile TEXT;
ALTER TABLE payments ALTER COLUMN member_id DROP NOT NULL;
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_member_id_fkey;
ALTER TABLE payments ADD CONSTRAINT payments_member_id_fkey FOREIGN KEY (member_id) REFERENCES members(member_id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE scan_logs DROP CONSTRAINT IF EXISTS scan_logs_member_id_fkey;
ALTER TABLE scan_logs ADD CONSTRAINT scan_logs_member_id_fkey FOREIGN KEY (member_id) REFERENCES members(member_id) ON DELETE SET NULL ON UPDATE CASCADE;

-- Migrations for forgot/reset password
ALTER TABLE members ADD COLUMN IF NOT EXISTS reset_password_token TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS reset_password_expires TIMESTAMPTZ;

-- Menus table
CREATE TABLE IF NOT EXISTS menus (
  id          SERIAL PRIMARY KEY,
  date        DATE NOT NULL,
  meal        TEXT NOT NULL CHECK (meal IN ('Breakfast','Lunch','Dinner')),
  items       TEXT[] NOT NULL,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (date, meal)
);

CREATE INDEX IF NOT EXISTS menus_date_idx ON menus(date);

-- Migration for email verification status
ALTER TABLE members ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;
UPDATE members SET email_verified = TRUE WHERE is_active = TRUE OR role IN ('admin', 'staff');

CREATE TABLE IF NOT EXISTS dashboard_notifications (
  id             SERIAL PRIMARY KEY,
  title          TEXT NOT NULL,
  content        TEXT NOT NULL,
  type           TEXT NOT NULL CHECK (type IN ('general', 'holiday')),
  holiday_date   DATE,
  start_time     TIMESTAMPTZ NOT NULL,
  end_time       TIMESTAMPTZ NOT NULL,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  block_breakfast BOOLEAN NOT NULL DEFAULT TRUE,
  block_lunch     BOOLEAN NOT NULL DEFAULT TRUE,
  block_dinner    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS dashboard_notifications_active_idx ON dashboard_notifications(is_active);
CREATE INDEX IF NOT EXISTS dashboard_notifications_time_idx ON dashboard_notifications(start_time, end_time);

CREATE TABLE IF NOT EXISTS meal_skips (
  id              BIGSERIAL PRIMARY KEY,
  member_id       TEXT NOT NULL REFERENCES members(member_id) ON DELETE CASCADE,
  skip_date       DATE NOT NULL,
  meal            TEXT NOT NULL CHECK (meal IN ('Breakfast','Lunch','Dinner')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (member_id, skip_date, meal)
);

CREATE INDEX IF NOT EXISTS meal_skips_date_member_idx ON meal_skips (skip_date, member_id);

CREATE TABLE IF NOT EXISTS menu_item_ratings (
  id              BIGSERIAL PRIMARY KEY,
  member_id       TEXT REFERENCES members(member_id) ON DELETE SET NULL,
  date            DATE NOT NULL,
  meal            TEXT NOT NULL CHECK (meal IN ('Breakfast','Lunch','Dinner')),
  dish_name       TEXT NOT NULL,
  rating          INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comments        TEXT,
  is_anonymous    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (member_id, date, meal, dish_name)
);

CREATE INDEX IF NOT EXISTS menu_item_ratings_dish_idx ON menu_item_ratings (dish_name);
CREATE INDEX IF NOT EXISTS menu_item_ratings_date_idx ON menu_item_ratings (date);



