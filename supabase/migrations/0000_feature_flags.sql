-- 0000_feature_flags.sql
-- Phase 1 baseline: feature flag system used to gate v1.5+ features.

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

create table if not exists feature_flags (
  id uuid primary key default uuid_generate_v4(),
  flag_code text not null unique,
  enabled_globally boolean default false,
  enabled_for_user_ids uuid[] default '{}',
  enabled_for_client_ids uuid[] default '{}',
  description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

insert into feature_flags (flag_code, description) values
  ('seed_test_flag', 'Phase 1 smoke test — toggling this verifies the feature flag plumbing'),
  ('compensation_layer', 'v1.7 salary/cost tracking — finance admins only'),
  ('google_ads_integration', 'v1.6 Google Ads read-only ingestion'),
  ('department_dashboards', 'v1.5 per-department analytics'),
  ('monthly_report_pdf', 'v2 client-facing monthly PDF export')
on conflict (flag_code) do nothing;

alter table feature_flags enable row level security;

create policy "feature_flags_read_all"
  on feature_flags for select
  using (true);

create policy "feature_flags_admin_only_write"
  on feature_flags for all
  using (false)
  with check (false);
