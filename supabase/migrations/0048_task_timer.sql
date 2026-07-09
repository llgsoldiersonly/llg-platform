-- 0048_task_timer.sql
-- One live timer per task: who started it and when. Stopping adds the
-- elapsed time to tasks.actual_hours and clears both fields.
alter table tasks add column if not exists timer_started_at timestamptz;
alter table tasks add column if not exists timer_user_id uuid references profiles(id) on delete set null;
