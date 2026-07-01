-- 0041_task_files.sql
-- File attachments on a task (images, video, docx, csv, pdf, etc.). Works for
-- any task — client-scoped or internal — unlike client_assets, which needs a
-- client. Files live in the private 'task-files' bucket; access is server-side
-- only (service role + short-lived signed URLs), gated by the staff RLS read.

create table if not exists task_files (
  id uuid primary key default uuid_generate_v4(),
  task_id uuid not null references tasks(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  content_type text,
  size_bytes bigint,
  uploaded_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists task_files_task_idx on task_files(task_id, created_at);

alter table task_files enable row level security;
drop policy if exists "task_files_staff_all" on task_files;
create policy "task_files_staff_all" on task_files for all using (is_agency_staff());

-- Private bucket, 200MB cap (video). No allowed_mime_types filter here — browser
-- MIME types for docx/csv are inconsistent, so the upload action validates by
-- extension instead to avoid false rejects.
insert into storage.buckets (id, name, public, file_size_limit)
values ('task-files', 'task-files', false, 209715200)
on conflict (id) do nothing;
