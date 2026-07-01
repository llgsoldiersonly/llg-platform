-- 0034_client_assets.sql
-- Per-client internal asset folder: staff upload working files (creative,
-- briefs, images, docs) into one folder per client so nothing gets mixed up.
-- Internal only — NOT exposed to clients (no client_user RLS policy). Files can
-- optionally be attached to a task.

create table if not exists client_assets (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,
  task_id uuid references tasks(id) on delete set null,   -- optional attachment
  storage_path text not null,          -- path within the 'client-assets' bucket
  file_name text not null,             -- original filename
  content_type text,
  size_bytes bigint,
  uploaded_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists client_assets_client_idx on client_assets(client_id, created_at desc);
create index if not exists client_assets_task_idx on client_assets(task_id);

alter table client_assets enable row level security;

-- Staff only — no client_user read policy on purpose (these are internal).
drop policy if exists "client_assets_staff_all" on client_assets;
create policy "client_assets_staff_all" on client_assets
  for all using (is_agency_staff());

-- Private bucket. Access is server-side only (service role + signed URLs).
insert into storage.buckets (id, name, public, file_size_limit)
values ('client-assets', 'client-assets', false, 52428800)   -- 50MB cap
on conflict (id) do nothing;
