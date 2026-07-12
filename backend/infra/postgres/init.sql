-- Runs automatically on first container start (empty data volume only).
-- If you ever wipe volumes and recreate, this reruns; if you're adding these to an
-- already-running db, run them manually instead — this file won't re-execute.

-- Required for: EXCLUDE USING GIST (resource_id WITH =, slot WITH &&) on bookings —
-- see README.md §4.3. Without this, the booking-overlap constraint can't be created.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- gen_random_uuid() is built into Postgres 16 core, but keeping pgcrypto explicit
-- costs nothing and protects against someone quietly downgrading the image tag.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SEQUENCE IF NOT EXISTS asset_tag_seq START 1;

CREATE TABLE IF NOT EXISTS departments (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  head_id BIGINT,
  parent_department_id BIGINT REFERENCES departments(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('admin','asset_manager','dept_head','employee')),
  department_id BIGINT REFERENCES departments(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE departments
  ADD CONSTRAINT departments_head_id_fkey
  FOREIGN KEY (head_id) REFERENCES users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS asset_categories (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS assets (
  id BIGSERIAL PRIMARY KEY,
  tag TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category_id BIGINT REFERENCES asset_categories(id) ON DELETE SET NULL,
  serial_number TEXT,
  acquisition_date DATE,
  acquisition_cost NUMERIC(12, 2),
  condition TEXT NOT NULL DEFAULT 'good',
  location TEXT,
  is_bookable BOOLEAN NOT NULL DEFAULT false,
  photo_url TEXT,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available','allocated','reserved','maintenance','lost','retired','disposed'))
);

CREATE TABLE IF NOT EXISTS allocations (
  id BIGSERIAL PRIMARY KEY,
  asset_id BIGINT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  holder_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  holder_department_id BIGINT REFERENCES departments(id) ON DELETE SET NULL,
  allocated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expected_return_date DATE,
  returned_at TIMESTAMPTZ,
  return_condition_notes TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','returned','overdue'))
);

CREATE UNIQUE INDEX IF NOT EXISTS one_active_allocation_per_asset
  ON allocations(asset_id)
  WHERE status = 'active';

CREATE TABLE IF NOT EXISTS transfer_requests (
  id BIGSERIAL PRIMARY KEY,
  asset_id BIGINT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  from_holder_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  to_holder_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','approved','rejected','completed')),
  requested_by BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  approved_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bookings (
  id BIGSERIAL PRIMARY KEY,
  resource_id BIGINT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  booked_by BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slot TSTZRANGE NOT NULL,
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming','ongoing','completed','cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_booking_slot CHECK (NOT isempty(slot))
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'no_overlapping_bookings'
  ) THEN
    ALTER TABLE bookings
      ADD CONSTRAINT no_overlapping_bookings
      EXCLUDE USING gist (resource_id WITH =, slot WITH &&)
      WHERE (status != 'cancelled');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS maintenance_requests (
  id BIGSERIAL PRIMARY KEY,
  asset_id BIGINT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  raised_by BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  issue_description TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium',
  photo_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  approved_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  technician_name TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_cycles (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  scope_department_id BIGINT REFERENCES departments(id) ON DELETE SET NULL,
  scope_location TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_by BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_items (
  id BIGSERIAL PRIMARY KEY,
  cycle_id BIGINT NOT NULL REFERENCES audit_cycles(id) ON DELETE CASCADE,
  asset_id BIGINT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  expected_location TEXT,
  verification_status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  verified_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  related_entity_type TEXT,
  related_entity_id BIGINT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id BIGSERIAL PRIMARY KEY,
  actor_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id BIGINT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assets_search ON assets USING gin (to_tsvector('simple', tag || ' ' || name || ' ' || coalesce(serial_number, '')));
CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);
CREATE INDEX IF NOT EXISTS idx_bookings_resource_slot ON bookings USING gist(resource_id, slot);

INSERT INTO departments(name)
VALUES ('Engineering'), ('Facilities'), ('Finance')
ON CONFLICT (name) DO NOTHING;

INSERT INTO users(name, email, password_hash, role, department_id)
SELECT 'Admin User', 'admin@assetflow.local', '$2b$12$.01E7gugQRQnWmC4NM7Xw.hh3ZjvylcAZm04tq7JS/xHpVkjk4aIG', 'admin', d.id
FROM departments d WHERE d.name = 'Engineering'
ON CONFLICT (email) DO NOTHING;

INSERT INTO users(name, email, password_hash, role, department_id)
SELECT 'Priya Shah', 'priya@assetflow.local', '$2b$12$.01E7gugQRQnWmC4NM7Xw.hh3ZjvylcAZm04tq7JS/xHpVkjk4aIG', 'employee', d.id
FROM departments d WHERE d.name = 'Engineering'
ON CONFLICT (email) DO NOTHING;

INSERT INTO asset_categories(name, custom_fields)
VALUES ('Laptop', '{"warranty_months": 36}'::jsonb), ('Room', '{}'::jsonb)
ON CONFLICT (name) DO NOTHING;

INSERT INTO assets(tag, name, category_id, serial_number, location, is_bookable, status)
SELECT 'AF-0114', 'MacBook Pro 14', c.id, 'MBP-0114', 'Engineering', false, 'available'
FROM asset_categories c WHERE c.name = 'Laptop'
ON CONFLICT (tag) DO NOTHING;

INSERT INTO assets(tag, name, category_id, location, is_bookable, status)
SELECT 'AF-ROOM-B2', 'Room B2', c.id, 'Floor 2', true, 'available'
FROM asset_categories c WHERE c.name = 'Room'
ON CONFLICT (tag) DO NOTHING;
