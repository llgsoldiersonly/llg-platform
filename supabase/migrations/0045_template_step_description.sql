-- 0045_template_step_description.sql
-- Per-step instructions (the SOP). Copied into every subtask spawned from the
-- step, so the task itself explains what "done" looks like — new staff ramp
-- without asking, veterans stay consistent.
alter table task_template_steps add column if not exists description text;
