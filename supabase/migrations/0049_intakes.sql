-- 0049_intakes.sql
-- Intake service: LLG's intake team records leads/calls for participating
-- firms. Two service kinds — 'intakes_only' firms get an intake-only client
-- portal (marketing pages hidden); 'intakes_leads' firms keep the full
-- portal and gain the Intakes page.

alter table clients add column if not exists intake_mode text not null default 'none'
  check (intake_mode in ('none', 'intakes_only', 'intakes_leads'));

create table if not exists intake_leads (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,
  lead_name text not null,
  lead_phone text,
  date_of_loss date,
  at_fault_name text,
  at_fault_phone text,
  at_fault_license text,
  at_fault_insurance text,
  description text,
  status text not null default 'new' check (status in ('new', 'retained', 'referred_out', 'dropped')),
  -- The firm's verdict after reviewing the lead in their portal
  -- (Accepted / Not accepted / Disengaged). Separate from the intake team's
  -- pipeline status above.
  client_decision text check (client_decision in ('accepted', 'not_accepted', 'disengaged')),
  client_decision_at timestamptz,
  client_decision_by uuid references auth.users(id) on delete set null,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists intake_leads_client_idx on intake_leads(client_id, created_at desc);

create table if not exists intake_lead_files (
  id uuid primary key default uuid_generate_v4(),
  lead_id uuid not null references intake_leads(id) on delete cascade,
  -- 'retainer' = the signed retainer PDF; 'support' = medical records,
  -- police report, photos, etc.
  kind text not null check (kind in ('retainer', 'support')),
  file_name text not null,
  content_type text,
  size_bytes bigint,
  storage_path text not null,
  uploaded_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists intake_lead_files_lead_idx on intake_lead_files(lead_id);

alter table intake_leads enable row level security;
alter table intake_lead_files enable row level security;

-- Staff manage everything; client users read their own firm's leads (the
-- client-portal Intakes page). PII stays scoped by accessible_client_ids.
drop policy if exists "intake_leads_staff_all" on intake_leads;
create policy "intake_leads_staff_all" on intake_leads for all using (is_agency_staff());
drop policy if exists "intake_leads_client_read" on intake_leads;
create policy "intake_leads_client_read" on intake_leads for select
  using (client_id in (select accessible_client_ids()));

drop policy if exists "intake_lead_files_staff_all" on intake_lead_files;
create policy "intake_lead_files_staff_all" on intake_lead_files for all using (is_agency_staff());
drop policy if exists "intake_lead_files_client_read" on intake_lead_files;
create policy "intake_lead_files_client_read" on intake_lead_files for select
  using (lead_id in (select id from intake_leads where client_id in (select accessible_client_ids())));

-- Private bucket; downloads go through short-lived signed URLs minted
-- server-side after an RLS-authorized row read. 50MB per file.
insert into storage.buckets (id, name, public, file_size_limit)
values ('intake-files', 'intake-files', false, 52428800)
on conflict (id) do nothing;

-- The Intake department gates who sees the internal intake workspace
-- (plus super-admins). Flag members in Settings → Users.
insert into departments (name, slug, description)
select 'Intake', 'intake', 'LLG intake team — records leads and calls for intake-service firms'
where not exists (select 1 from departments where slug = 'intake');
