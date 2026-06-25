-- 0032_client_leads.sql
-- Per-client "Leads" feature: admin uploads PDF leads, client downloads them
-- from the portal. Gated by clients.leads_enabled. Supports lead-buyer clients
-- that have no package/subscription.

-- Per-client toggle for the Leads box.
alter table clients add column if not exists leads_enabled boolean not null default false;

-- Uploaded lead PDFs. Files live in the private 'lead-files' storage bucket;
-- this table is the metadata + display list (created_at is the shown timestamp).
create table if not exists client_lead_files (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,
  storage_path text not null,          -- path within the 'lead-files' bucket
  file_name text not null,             -- original filename shown to the client
  size_bytes bigint,
  uploaded_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists client_lead_files_client_idx
  on client_lead_files(client_id, created_at desc);

alter table client_lead_files enable row level security;

drop policy if exists "lead_files_staff_all" on client_lead_files;
create policy "lead_files_staff_all" on client_lead_files
  for all using (is_agency_staff());

drop policy if exists "lead_files_user_read_own" on client_lead_files;
create policy "lead_files_user_read_own" on client_lead_files
  for select using (client_id in (select accessible_client_ids()));

-- Private storage bucket for the PDFs. Access is server-side only (service role
-- + short-lived signed URLs), so no public access and no per-object policies.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('lead-files', 'lead-files', false, 26214400, array['application/pdf'])
on conflict (id) do nothing;
