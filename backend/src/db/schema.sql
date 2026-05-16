-- MessMate PostgreSQL schema

CREATE TABLE IF NOT EXISTS plans (
  plan_id           TEXT PRIMARY KEY,
  label             TEXT NOT NULL,
  meals             TEXT[] NOT NULL,
  price_per_month   INTEGER NOT NULL,
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
  password_hash       TEXT NOT NULL,
  room                TEXT,
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
