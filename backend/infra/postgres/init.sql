-- Runs automatically on first container start (empty data volume only).
-- If you ever wipe volumes and recreate, this reruns; if you're adding these to an
-- already-running db, run them manually instead — this file won't re-execute.

-- Required for: EXCLUDE USING GIST (resource_id WITH =, slot WITH &&) on bookings —
-- see README.md §4.3. Without this, the booking-overlap constraint can't be created.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- gen_random_uuid() is built into Postgres 16 core, but keeping pgcrypto explicit
-- costs nothing and protects against someone quietly downgrading the image tag.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
