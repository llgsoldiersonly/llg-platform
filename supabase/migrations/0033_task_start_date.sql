-- 0033_task_start_date.sql
-- Add a start date to tasks so an assignment has a timeline (start → due),
-- not just a single due date.
alter table tasks add column if not exists start_date date;
