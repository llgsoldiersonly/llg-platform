-- 0019_client_lifecycle_fields.sql
-- Adds the date fields the pre-launch / post-launch overview headers need.
--
-- Per Nathan's 2026-05-12 whiteboards:
--   PRE-launch header  → Package Type, Ad Date, Agreed Launch Date
--   POST-launch header → Package Type, Launch Date, Next Billing Cycle
--
-- Existing fields already cover:
--   Package Type   → derived from active subscription → package_templates.display_name
--   Launch Date    → clients.onboarded_at (post-launch only)
--
-- New fields:
--   agreed_launch_date → the planned go-live date set during onboarding.
--                        On flip from 'onboarding' to 'active', a trigger could
--                        copy this into onboarded_at, but we leave that to the
--                        app layer to avoid hidden surprises.
--   ad_date            → the date the client signed/agreed (for pre-launch header).
--   next_billing_at    → next monthly billing rollover (post-launch header).

alter table clients
  add column if not exists agreed_launch_date date,
  add column if not exists ad_date date,
  add column if not exists next_billing_at date;
