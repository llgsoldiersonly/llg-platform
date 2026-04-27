-- 0011_phase_5_tickets.sql
-- Phase 5 ticketing extensions per spec section 8.8.
-- Adds bug/request types, SLA deadlines, escalation, quota tracking,
-- platform settings (business hours + per-tier SLA hours), and profile
-- flags for escalation contacts and department managers.

-- ============================================================================
-- TICKETS — extend with type, SLA, escalation, quota tracking
-- ============================================================================
alter table tickets
  add column if not exists type text not null default 'request'
    check (type in ('bug', 'request'));

alter table tickets add column if not exists sla_deadline_at timestamptz;
alter table tickets add column if not exists close_reason text;
alter table tickets add column if not exists escalated_at timestamptz;
alter table tickets add column if not exists escalated_by uuid references auth.users(id);
alter table tickets add column if not exists quota_charged boolean default true;

-- ============================================================================
-- TICKET_QUOTA_USAGE — one row per (client, ISO week)
-- ============================================================================
-- Tracks weekly request count + carryover from prior week. Bug counter
-- is also tracked but never enforced (always allowed).
create table if not exists ticket_quota_usage (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,
  year int not null,
  iso_week int not null,
  requests_used int default 0,
  bugs_used int default 0,
  carried_over int default 0,
  updated_at timestamptz default now(),
  unique (client_id, year, iso_week)
);

create index if not exists ticket_quota_usage_client_idx on ticket_quota_usage(client_id, year desc, iso_week desc);

alter table ticket_quota_usage enable row level security;

drop policy if exists "ticket_quota_staff_all" on ticket_quota_usage;
create policy "ticket_quota_staff_all" on ticket_quota_usage
  for all using (is_agency_staff());

drop policy if exists "ticket_quota_user_read_own" on ticket_quota_usage;
create policy "ticket_quota_user_read_own" on ticket_quota_usage
  for select using (client_id in (select accessible_client_ids()));

-- ============================================================================
-- PLATFORM_SETTINGS — single-row config table for business hours + SLAs
-- ============================================================================
create table if not exists platform_settings (
  id int primary key default 1,
  business_hours_start time default '08:00',
  business_hours_end time default '17:00',
  business_timezone text default 'America/Los_Angeles',
  business_days int[] default '{1,2,3,4,5}',     -- ISO weekday: Mon=1, Sun=7
  -- SLA hours per tier — urgent vs normal. "Hours" = business hours.
  sla_gravity_urgent_hours int default 16,
  sla_lapetus_urgent_hours int default 16,
  sla_rhea_urgent_hours int default 8,
  sla_titan_urgent_hours int default 4,
  sla_gravity_normal_hours int default 32,
  sla_lapetus_normal_hours int default 32,
  sla_rhea_normal_hours int default 16,
  sla_titan_normal_hours int default 8,
  auto_close_inactive_days int default 7,
  constraint single_row check (id = 1)
);

insert into platform_settings (id) values (1) on conflict do nothing;

alter table platform_settings enable row level security;

drop policy if exists "platform_settings_staff_all" on platform_settings;
create policy "platform_settings_staff_all" on platform_settings
  for all using (is_agency_staff());

drop policy if exists "platform_settings_read_all" on platform_settings;
create policy "platform_settings_read_all" on platform_settings
  for select using (true);

-- ============================================================================
-- PROFILES — escalation + manager flags
-- ============================================================================
alter table profiles add column if not exists is_escalation_contact boolean default false;
alter table profiles add column if not exists is_department_manager boolean default false;

-- ============================================================================
-- TICKET_ROUTING_RULES — extend with description for clarity (optional)
-- ============================================================================
-- (Already covered in 0006; no change needed. Kept here as a comment marker.)
