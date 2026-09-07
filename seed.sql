-- ─────────────────────────────────────────────────────────────────────────
-- SmartFit · seed.sql
--
-- Relational schema + demo data for SQL tooling, warehouses, analytics and
-- local Postgres/SQLite exploration. The production app itself uses Cloud
-- Firestore (NoSQL) and ships with NO demo data — this file is for reference,
-- analytics and demos only. To populate Firestore with the same demo data run
-- `pnpm seed` (scripts/seed-firestore.mjs).
--
-- Dialect: PostgreSQL (SQLite-compatible with minor type tweaks).
-- ─────────────────────────────────────────────────────────────────────────

-- Schema ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY,            -- uid (matches users/{uid} in Firestore)
  email           TEXT,
  name            TEXT NOT NULL DEFAULT 'Athlete',
  weight_unit     TEXT NOT NULL DEFAULT 'kg',   -- kg | lb
  distance_unit   TEXT NOT NULL DEFAULT 'km',   -- km | mi
  weekly_rest_days INTEGER NOT NULL DEFAULT 2,
  plan_id         TEXT NOT NULL DEFAULT 'full-body',
  onboarding_done INTEGER NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS categories (
  id       TEXT PRIMARY KEY,                    -- e.g. cat-strength
  user_id  TEXT REFERENCES users(id) ON DELETE CASCADE,
  name     TEXT NOT NULL,
  icon     TEXT NOT NULL,
  color    TEXT NOT NULL,
  builtin  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sessions (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date          DATE NOT NULL,                  -- ISO yyyy-mm-dd
  category_id   TEXT REFERENCES categories(id),
  title         TEXT NOT NULL,
  duration_min  INTEGER NOT NULL,
  intensity     TEXT NOT NULL,                  -- low | moderate | high
  calories      INTEGER NOT NULL,
  distance_km   REAL,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workout_exercises (
  id          TEXT PRIMARY KEY,
  session_id  TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  position    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS workout_sets (
  id          TEXT PRIMARY KEY,
  exercise_id TEXT NOT NULL REFERENCES workout_exercises(id) ON DELETE CASCADE,
  reps        INTEGER,
  weight_kg   REAL,
  distance_km REAL,
  duration_min INTEGER,
  position    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS schedule (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  category_id  TEXT REFERENCES categories(id),
  weekday      INTEGER NOT NULL,                -- 0=Sun … 6=Sat
  time_of_day  TEXT NOT NULL,                   -- "07:30"
  duration_min INTEGER NOT NULL,
  intensity    TEXT NOT NULL,
  active       INTEGER NOT NULL DEFAULT 1,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS goals (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  metric     TEXT NOT NULL,                     -- workouts | minutes | calories | distance
  cadence    TEXT NOT NULL,                     -- weekly | monthly
  target     REAL NOT NULL,
  start_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS body_logs (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date       DATE NOT NULL,
  unit       TEXT NOT NULL,                     -- weight | bodyfat | waist | chest | arms | custom
  label      TEXT,
  value      REAL NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Demo data ──────────────────────────────────────────────────────────────────

INSERT INTO users (id, email, name, plan_id, onboarding_done) VALUES
  ('demo-user', 'demo@smartfit.app', 'Demo Athlete', 'upper-lower', 1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO categories (id, user_id, name, icon, color, builtin) VALUES
  ('cat-strength', 'demo-user', 'Strength', 'dumbbell',          '#e05e36', 1),
  ('cat-cardio',   'demo-user', 'Cardio',   'heart-pulse',       '#cdaca4', 1),
  ('cat-hiit',     'demo-user', 'HIIT',     'flame',             '#8a6a58', 1),
  ('cat-mobility', 'demo-user', 'Mobility', 'stretch-horizontal','#eda07e', 1),
  ('cat-sports',   'demo-user', 'Sports',   'volleyball',        '#2b2725', 1)
ON CONFLICT (id) DO NOTHING;

-- Goals
INSERT INTO goals (id, user_id, name, metric, cadence, target, start_date) VALUES
  ('seed_goal_workouts', 'demo-user', 'Train this week',   'workouts', 'weekly',  5,  current_date - INTERVAL '6 days'),
  ('seed_goal_minutes',  'demo-user', 'Active minutes',    'minutes',  'weekly',  260, current_date - INTERVAL '6 days'),
  ('seed_goal_distance', 'demo-user', 'Monthly distance',  'distance', 'monthly', 60,  current_date - INTERVAL '29 days')
ON CONFLICT (id) DO NOTHING;

-- Weekly training schedule
INSERT INTO schedule (id, user_id, title, category_id, weekday, time_of_day, duration_min, intensity) VALUES
  ('seed_sch_1', 'demo-user', 'Push',  'cat-strength', 1, '07:30', 55, 'high'),
  ('seed_sch_2', 'demo-user', 'Pull',  'cat-strength', 2, '07:30', 50, 'high'),
  ('seed_sch_3', 'demo-user', 'Run',   'cat-cardio',   3, '06:45', 35, 'moderate'),
  ('seed_sch_4', 'demo-user', 'HIIT',  'cat-hiit',     4, '18:00', 28, 'high'),
  ('seed_sch_5', 'demo-user', 'Legs',  'cat-strength', 5, '07:30', 60, 'high')
ON CONFLICT (id) DO NOTHING;

-- Six weeks of sessions. generate_series builds one row per training day per
-- week; intensity/calories mirror the app's estimate (≈ high 11, mod 8 kcal/min).
INSERT INTO sessions (id, user_id, date, category_id, title, duration_min, intensity, calories, distance_km)
SELECT
  'seed_ses_w' || w || '_d' || t.dow,
  'demo-user',
  current_date - ((w * 7 + ((7 - t.dow + 1) % 7 + CASE WHEN t.dow = 1 THEN 7 ELSE 0 END)) || ' days')::interval,
  t.cat,
  t.title,
  t.min,
  t.int,
  CASE t.int WHEN 'high' THEN t.min * 11 WHEN 'moderate' THEN t.min * 8 ELSE t.min * 5 END,
  t.dist
FROM generate_series(0, 5) AS w
CROSS JOIN (VALUES
  (1, 'cat-strength', 'Push — chest & shoulders', 55, 'high',     NULL::real),
  (2, 'cat-strength', 'Pull — back & biceps',     50, 'high',     NULL),
  (3, 'cat-cardio',   'Morning run',              35, 'moderate', 5.2),
  (4, 'cat-hiit',     'HIIT circuits',            28, 'high',     NULL),
  (5, 'cat-strength', 'Legs — squats & hinges',   60, 'high',     NULL),
  (6, 'cat-sports',   'Football with friends',    70, 'moderate', NULL)
) AS t(dow, cat, title, min, int, dist)
ON CONFLICT (id) DO NOTHING;

-- Body-weight trend (kg)
INSERT INTO body_logs (id, user_id, date, unit, value) VALUES
  ('seed_body_w0', 'demo-user', current_date - INTERVAL '42 days', 'weight', 82.5),
  ('seed_body_w1', 'demo-user', current_date - INTERVAL '28 days', 'weight', 81.4),
  ('seed_body_w2', 'demo-user', current_date - INTERVAL '14 days', 'weight', 80.6),
  ('seed_body_w3', 'demo-user', current_date - INTERVAL '2 days',  'weight', 79.9)
ON CONFLICT (id) DO NOTHING;

-- Helpful analytics view: weekly training volume per user.
CREATE OR REPLACE VIEW v_weekly_volume AS
SELECT
  user_id,
  date_trunc('week', date)::date AS week_start,
  COUNT(*)                       AS sessions,
  SUM(duration_min)              AS minutes,
  SUM(calories)                  AS calories,
  SUM(COALESCE(distance_km, 0))  AS distance_km
FROM sessions
GROUP BY user_id, date_trunc('week', date)
ORDER BY week_start DESC;
