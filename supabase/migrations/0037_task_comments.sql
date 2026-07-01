-- 0037_task_comments.sql
-- Comments on a task, so questions / handoffs / context happen in-context on
-- the task detail page instead of over chat. Staff-only.
create table if not exists task_comments (
  id uuid primary key default uuid_generate_v4(),
  task_id uuid not null references tasks(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists task_comments_task_idx on task_comments(task_id, created_at);
alter table task_comments enable row level security;
drop policy if exists "task_comments_staff_all" on task_comments;
create policy "task_comments_staff_all" on task_comments for all using (is_agency_staff());
