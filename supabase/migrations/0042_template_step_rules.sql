-- 0042_template_step_rules.sql
-- Make workflow templates self-driving: each step can say WHO does it and WHEN
-- it's due, so applying a template produces subtasks that are already assigned
-- and scheduled.
--
--   assignee_rule:
--     'unassigned'      — nobody (default; same as before)
--     'parent_assignee' — whoever the parent task is assigned to
--     'department_lead' — the lead of the step's department (falls back to the
--                         parent's department)
--     'specific'        — the user in assignee_id
--   offset_days: due date = (parent start_date, else the day the template is
--                 applied) + offset_days. Null = no due date.
--
-- Requires 0040 (task_template_steps).

alter table task_template_steps
  add column if not exists assignee_rule text not null default 'unassigned'
    check (assignee_rule in ('unassigned', 'parent_assignee', 'department_lead', 'specific'));
alter table task_template_steps
  add column if not exists assignee_id uuid references auth.users(id) on delete set null;
alter table task_template_steps
  add column if not exists offset_days int;
