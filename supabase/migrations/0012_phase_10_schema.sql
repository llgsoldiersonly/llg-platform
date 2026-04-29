-- 0012_phase_10_schema.sql
-- Phase 10 schema additions: onboarding tasks, monthly KPI snapshots,
-- impersonation audit. Per Phase 10 spec in CLAUDE_CODE_HANDOFF.md.
--
-- All staff-only — no client-facing reads except client_onboarding_tasks
-- (clients see their own setup progress on the portal).

-- ============================================================================
-- ONBOARDING_TEMPLATES — package-tier task templates
-- ============================================================================
-- One row per (package, task). Drives auto-generation of client tasks when
-- a subscription is created (Phase 10 line item: "onboarding checklist
-- auto-generation").
create table if not exists onboarding_templates (
  id uuid primary key default uuid_generate_v4(),
  package_code text not null references package_templates(code),
  code text not null,
  display_name text not null,
  department_slug text not null,
  sort_order int default 100,
  target_days_from_start int,                -- e.g. 7 = "do within 7 days of subscription start"
  description text,
  unique (package_code, code)
);

create index if not exists onboarding_templates_pkg_idx on onboarding_templates(package_code, sort_order);

alter table onboarding_templates enable row level security;

drop policy if exists "onboarding_templates_staff_all" on onboarding_templates;
create policy "onboarding_templates_staff_all" on onboarding_templates
  for all using (is_agency_staff());

drop policy if exists "onboarding_templates_read_all" on onboarding_templates;
create policy "onboarding_templates_read_all" on onboarding_templates
  for select using (true);

-- ============================================================================
-- CLIENT_ONBOARDING_TASKS — per-subscription instances
-- ============================================================================
-- Created automatically when a subscription is inserted (trigger TBD in
-- application code). Visible on /admin/clients/[id] and on the client portal
-- as "Your setup progress."
create table if not exists client_onboarding_tasks (
  id uuid primary key default uuid_generate_v4(),
  subscription_id uuid not null references subscriptions(id) on delete cascade,
  template_id uuid references onboarding_templates(id),
  display_name text not null,
  department_slug text not null,
  status text default 'pending' check (status in ('pending', 'in_progress', 'done', 'skipped')),
  assigned_to uuid references auth.users(id),
  due_date date,
  completed_at timestamptz,
  completed_by uuid references auth.users(id),
  notes text,
  created_at timestamptz default now()
);

create index if not exists client_onboarding_tasks_sub_status_idx on client_onboarding_tasks(subscription_id, status);
create index if not exists client_onboarding_tasks_assignee_idx on client_onboarding_tasks(assigned_to, status);

alter table client_onboarding_tasks enable row level security;

drop policy if exists "client_onboarding_tasks_staff_all" on client_onboarding_tasks;
create policy "client_onboarding_tasks_staff_all" on client_onboarding_tasks
  for all using (is_agency_staff());

drop policy if exists "client_onboarding_tasks_user_read_own" on client_onboarding_tasks;
create policy "client_onboarding_tasks_user_read_own" on client_onboarding_tasks
  for select using (
    subscription_id in (
      select s.id from subscriptions s
      where s.client_id in (select accessible_client_ids())
    )
  );

-- ============================================================================
-- MONTHLY_SNAPSHOTS — KPI snapshots for year-over-year comparison
-- ============================================================================
-- Captured by cron `/api/cron/monthly-snapshot` at 00:00 on the 1st of each
-- month. One row per (client, month). Enables trend reporting in v1.5+.
create table if not exists monthly_snapshots (
  id bigserial primary key,
  client_id uuid not null references clients(id) on delete cascade,
  snapshot_month date not null,             -- always first of month
  rankings_count int,
  rankings_avg_position numeric,
  rankings_top10_count int,
  citation_score int,
  gmb_rating numeric,
  gmb_review_count int,
  gmb_post_count int,
  ad_spend_ytd_cents bigint,
  conversions_ytd int,
  call_count_month int,
  social_posts_month int,
  social_followers_total int,
  raw_snapshot jsonb,
  captured_at timestamptz default now(),
  unique (client_id, snapshot_month)
);

create index if not exists monthly_snapshots_client_month_idx on monthly_snapshots(client_id, snapshot_month desc);

alter table monthly_snapshots enable row level security;

drop policy if exists "monthly_snapshots_staff_all" on monthly_snapshots;
create policy "monthly_snapshots_staff_all" on monthly_snapshots
  for all using (is_agency_staff());

drop policy if exists "monthly_snapshots_user_read_own" on monthly_snapshots;
create policy "monthly_snapshots_user_read_own" on monthly_snapshots
  for select using (client_id in (select accessible_client_ids()));

-- ============================================================================
-- IMPERSONATION_LOG — audit trail for "View as client" (god-mode)
-- ============================================================================
-- Super-admin only. Every impersonation start + end recorded. Read-only
-- after creation; only super_admins read; never exposed to client_users.
create table if not exists impersonation_log (
  id bigserial primary key,
  impersonator_id uuid not null references auth.users(id) on delete set null,
  impersonated_client_id uuid not null references clients(id) on delete cascade,
  reason text not null,
  started_at timestamptz default now(),
  ended_at timestamptz
);

create index if not exists impersonation_log_actor_idx on impersonation_log(impersonator_id, started_at desc);
create index if not exists impersonation_log_client_idx on impersonation_log(impersonated_client_id, started_at desc);

alter table impersonation_log enable row level security;

-- Lock down: only super_admin reads/writes via service-role server actions.
-- Default-deny RLS (no policies) means service_role bypass is the only path.
