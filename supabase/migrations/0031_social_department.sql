-- 0031_social_department.sql
-- Add a dedicated "Social" department. Social work was previously folded into
-- Content; this gives it its own bucket for staff assignment. Idempotent.

insert into departments (name, slug)
values ('Social', 'social')
on conflict (slug) do nothing;
