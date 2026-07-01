-- 0040_task_subtasks_templates.sql
-- Subtasks + reusable task templates (the Wrike-style "every blog runs the
-- same 01–07 pipeline" workflow).
--
-- 1. Subtasks: a task can have a parent task. Deleting the parent removes its
--    subtasks (cascade). position orders siblings.
-- 2. Templates: a named ordered list of steps. Applying a template to a task
--    creates one subtask per step (title + optional department).
-- 3. content_plans.template_id: a plan can carry a default template so each
--    row's spawned task automatically gets the workflow subtasks.

alter table tasks add column if not exists parent_task_id uuid references tasks(id) on delete cascade;
alter table tasks add column if not exists position int;
create index if not exists tasks_parent_idx on tasks(parent_task_id, position);

create table if not exists task_templates (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  kind text not null default 'generic',   -- 'blog' | 'seo_page' | 'generic' …
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists task_template_steps (
  id uuid primary key default uuid_generate_v4(),
  template_id uuid not null references task_templates(id) on delete cascade,
  position int not null default 0,
  title text not null,
  department_id uuid references departments(id)
);
create index if not exists task_template_steps_template_idx on task_template_steps(template_id, position);

alter table task_templates enable row level security;
alter table task_template_steps enable row level security;
drop policy if exists "task_templates_staff_all" on task_templates;
create policy "task_templates_staff_all" on task_templates for all using (is_agency_staff());
drop policy if exists "task_template_steps_staff_all" on task_template_steps;
create policy "task_template_steps_staff_all" on task_template_steps for all using (is_agency_staff());

alter table content_plans add column if not exists template_id uuid references task_templates(id) on delete set null;

-- Seed the standard blog workflow (idempotent) so the feature is usable out of
-- the box. Steps mirror the 01–07 pipeline from the team's existing board.
insert into task_templates (name, kind) values ('Blog workflow', 'blog') on conflict (name) do nothing;
insert into task_template_steps (template_id, position, title)
select t.id, s.position, s.title
from task_templates t
cross join (values
  (1, 'Keyword Research & Content Planning'),
  (2, 'SEO Content Writing'),
  (3, 'Internal Review & SEO Quality Check'),
  (4, 'Client Review & Content Approval'),
  (5, 'Content Revisions & Final Approval'),
  (6, 'Content Upload & On-Page SEO'),
  (7, 'Monthly Reporting')
) as s(position, title)
where t.name = 'Blog workflow'
  and not exists (select 1 from task_template_steps ts where ts.template_id = t.id);
