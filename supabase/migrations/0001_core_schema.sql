-- 0001_core_schema.sql
-- Profiles, departments, clients, client_locations, client_users.
-- This is the foundation that every other migration depends on.

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================================================
-- PROFILES (1:1 with auth.users)
-- ============================================================================
-- The role column is the source of truth for tenant-vs-staff distinction.
-- Spec section 1.2 lists two roles, but seed data + Part 12 reference a
-- 'super_admin' tier — accommodating all three so the seed migrations are valid.
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  phone text,
  title text,
  department_id uuid,
  role text not null check (role in ('agency_staff', 'client_user', 'super_admin')),
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================================
-- DEPARTMENTS (LLG internal org)
-- ============================================================================
create table if not exists departments (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  slug text not null unique,
  description text,
  created_at timestamptz default now()
);

-- Wire profiles.department_id once departments exists.
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'profiles_department_fk'
  ) then
    alter table profiles add constraint profiles_department_fk
      foreign key (department_id) references departments(id);
  end if;
end$$;

-- ============================================================================
-- CLIENTS (law firms)
-- ============================================================================
create table if not exists clients (
  id uuid primary key default uuid_generate_v4(),
  firm_name text not null,
  primary_domain text,
  primary_contact_email text,
  primary_contact_name text,
  primary_contact_phone text,
  vertical text,
  status text default 'active' check (status in ('prospect', 'onboarding', 'active', 'paused', 'churned')),
  onboarded_at date,
  notes text,
  -- Demo client flag: excluded from cron jobs, production reports.
  -- Spec section 11.1.
  is_demo_only boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists clients_demo_idx on clients(is_demo_only) where is_demo_only = true;
create index if not exists clients_status_idx on clients(status);

-- ============================================================================
-- CLIENT LOCATIONS (multi-city support — Gravity Pack uses this)
-- ============================================================================
-- BrightLocal per-location report IDs are populated by scripts/setup-brightlocal.ts
-- during Phase 8 — null until then.
create table if not exists client_locations (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,
  label text not null,
  city text not null,
  state text not null,
  country text default 'US',
  full_address text,
  lat numeric,
  lng numeric,
  timezone text default 'America/Los_Angeles',
  is_primary boolean default false,
  gbp_place_id text,
  gbp_location_resource text,
  brightlocal_location_id text,
  brightlocal_rank_tracker_campaign_id text,
  brightlocal_citation_report_id text,
  brightlocal_reputation_report_id text,
  created_at timestamptz default now()
);

create index if not exists client_locations_client_idx on client_locations(client_id);

-- ============================================================================
-- CLIENT USERS (many-to-many: auth users with access to a client)
-- ============================================================================
create table if not exists client_users (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text default 'viewer' check (role in ('owner', 'viewer')),
  created_at timestamptz default now(),
  unique (client_id, user_id)
);

create index if not exists client_users_user_idx on client_users(user_id);
create index if not exists client_users_client_idx on client_users(client_id);
