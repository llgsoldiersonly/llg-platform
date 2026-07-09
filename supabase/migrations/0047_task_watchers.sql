-- 0047_task_watchers.sql
-- Watch a task you don't own: watchers get notified on status changes and new
-- comments. Internal-only (staff RLS), rows vanish with the task.
create table if not exists task_watchers (
  task_id uuid not null references tasks(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, user_id)
);

alter table task_watchers enable row level security;
drop policy if exists "task_watchers_staff_all" on task_watchers;
create policy "task_watchers_staff_all" on task_watchers for all using (is_agency_staff());
