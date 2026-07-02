-- 0044_weekly_capacity.sql
-- Per-person weekly capacity in hours, for the hours-based Workload view.
-- Default 40; set lower for part-timers via the staff edit dialog.
alter table profiles add column if not exists weekly_capacity_hours numeric not null default 40;
