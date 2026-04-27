-- 0003_packages_deliverables.sql
-- Package templates (the menu), package modules (UI gates), package deliverables
-- (line-items the team tracks), client subscriptions, deliverables (instances).

-- ============================================================================
-- PACKAGE_TEMPLATES — the master list of plans LLG sells
-- ============================================================================
create table if not exists package_templates (
  id uuid primary key default uuid_generate_v4(),
  code text not null unique,             -- 'GRAVITY', 'LAPETUS', 'RHEA', 'TITAN', 'LIVE_INTAKES'
  display_name text not null,
  tier_order int not null,               -- 1 = lowest tier
  monthly_fee_cents int not null,
  description text,
  color_hex text,
  created_at timestamptz default now()
);

-- ============================================================================
-- PACKAGE_MODULES — which UI module sets a package enables
-- ============================================================================
-- A "module" is a content block in the portal: SEO_PLAN, LOCAL_PLAN, PPC, CONTENT,
-- AI_VOICE, INTAKES, KEYWORDS_READONLY. The module's config jsonb holds limits
-- (keyword count, blog count, etc.) used to render the right shape for that tier.
create table if not exists package_modules (
  id uuid primary key default uuid_generate_v4(),
  package_id uuid not null references package_templates(id) on delete cascade,
  module_code text not null,
  config jsonb default '{}'::jsonb,
  unique (package_id, module_code)
);

-- ============================================================================
-- PACKAGE_DELIVERABLES — every line-item tracked per package
-- ============================================================================
-- The MENU. Seeded in 0009. Client portal reads via deliverables_display view.
create table if not exists package_deliverables (
  id uuid primary key default uuid_generate_v4(),
  package_id uuid not null references package_templates(id) on delete cascade,
  module_code text not null,
  department_slug text not null,
  code text not null,                    -- 'BLOG_EN', 'GMB_POSTS', etc.
  display_name text not null,
  frequency text not null check (frequency in ('once', 'weekly', 'monthly', 'quarterly', 'ongoing')),
  target_count int,
  target_unit text,
  description text,
  client_visible boolean default true,

  -- Reconciliation source. See lib/deliverables/reconcile.ts (built in Phase 6).
  -- 'wp_post'     → count WordPress posts in raw_wordpress matching matcher_config
  -- 'gbp_post'    → count GMB posts from raw_gmb (if API returns them)
  -- 'social_post' → sum posts_count from raw_metricool for configured channels
  -- 'manual'      → team marks done on the admin deliverables page
  tracking_source text not null default 'manual'
    check (tracking_source in ('manual', 'wp_post', 'gbp_post', 'social_post')),

  -- Matcher config drives auto-counting. Examples in handoff Part 4.3.
  matcher_config jsonb default '{}'::jsonb,

  sort_order int default 100
);

-- ============================================================================
-- SUBSCRIPTIONS (a client's purchase of a package, optionally tied to a location)
-- ============================================================================
create table if not exists subscriptions (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,
  package_id uuid not null references package_templates(id),
  location_id uuid references client_locations(id),
  status text default 'active' check (status in ('onboarding', 'active', 'paused', 'cancelled')),
  started_at date not null,
  ended_at date,
  notes text,
  created_at timestamptz default now()
);

create index if not exists subscriptions_client_idx on subscriptions(client_id);
create index if not exists subscriptions_package_idx on subscriptions(package_id);

-- ============================================================================
-- DELIVERABLES (instantiated tracking rows; what the client portal renders)
-- ============================================================================
-- Two kinds:
--  1. Package deliverables: template_id set, source='package'
--  2. Custom/incentive: template_id null, source in ('incentive','custom'), team-added
create table if not exists deliverables (
  id uuid primary key default uuid_generate_v4(),
  subscription_id uuid not null references subscriptions(id) on delete cascade,
  template_id uuid references package_deliverables(id),

  -- For custom/incentive rows (no template_id):
  custom_title text,
  custom_description text,
  custom_department_slug text,
  custom_frequency text check (custom_frequency in ('once', 'weekly', 'monthly', 'quarterly', 'ongoing')),
  custom_target_count int,
  custom_target_unit text,

  source text not null default 'package'
    check (source in ('package', 'incentive', 'custom')),
  is_incentive boolean default false,

  period_start date not null,
  period_end date not null,
  status text default 'pending' check (status in ('pending', 'in_progress', 'done', 'skipped', 'blocked')),
  actual_count int default 0,
  notes text,
  completed_at timestamptz,
  completed_by uuid references auth.users(id),
  created_at timestamptz default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz default now(),

  -- Either a template-backed row OR a custom row, not both, not neither.
  constraint deliverables_source_exclusive check (
    (template_id is not null and custom_title is null and source = 'package')
    or
    (template_id is null and custom_title is not null and source in ('incentive', 'custom'))
  )
);

create index if not exists deliverables_subscription_period_idx on deliverables(subscription_id, period_start);
create index if not exists deliverables_status_idx on deliverables(status);
create index if not exists deliverables_source_idx on deliverables(source);

-- ============================================================================
-- DELIVERABLES_DISPLAY view — unified shape the UI consumes
-- ============================================================================
-- Coalesces template + custom fields so the portal/admin renders one list.
create or replace view deliverables_display as
select
  d.id,
  d.subscription_id,
  s.client_id,
  s.location_id,
  d.source,
  d.is_incentive,
  coalesce(pd.display_name, d.custom_title) as title,
  coalesce(pd.description, d.custom_description) as description,
  coalesce(pd.department_slug, d.custom_department_slug) as department_slug,
  coalesce(pd.module_code, 'CUSTOM') as module_code,
  coalesce(pd.frequency, d.custom_frequency) as frequency,
  coalesce(pd.target_count, d.custom_target_count) as target_count,
  coalesce(pd.target_unit, d.custom_target_unit) as target_unit,
  coalesce(pd.client_visible, true) as client_visible,
  d.period_start,
  d.period_end,
  d.status,
  d.actual_count,
  d.completed_at,
  d.notes
from deliverables d
join subscriptions s on s.id = d.subscription_id
left join package_deliverables pd on pd.id = d.template_id;
