-- 0013_onboarding_seed_and_trigger.sql
-- Seeds onboarding_templates per package tier, then wires a trigger so
-- client_onboarding_tasks are auto-generated when a subscription is inserted.
-- Backfills tasks for pre-existing subscriptions at the end.

-- ============================================================================
-- ONBOARDING_TEMPLATES — seed
-- ============================================================================
-- Universal tasks that apply to every tier other than LIVE_INTAKES.
-- (LIVE_INTAKES is a standalone add-on with its own minimal set.)

-- Helper: package code in this insert flow
-- We use repeated inserts (one per package_code) instead of unnesting because
-- the seed is small and the explicitness helps reviewers.

insert into onboarding_templates (package_code, code, display_name, department_slug, sort_order, target_days_from_start, description) values
  -- GRAVITY
  ('GRAVITY', 'KICKOFF_CALL',     'Schedule kickoff call',                  'account_mgmt', 10,  3,  'Set up the 30-min kickoff call with the client.'),
  ('GRAVITY', 'AGREEMENT_SIGNED', 'Counter-signed service agreement filed', 'finance',      20,  7,  'Filed in the finance share.'),
  ('GRAVITY', 'ASSETS_RECEIVED',  'Logo + brand assets received',           'design',       30,  5,  'Need vector logo, color palette, brand guide if any.'),
  ('GRAVITY', 'WP_ACCESS',        'WordPress access provisioned',           'development',  40,  5,  'WP admin user + app password generated for the cron.'),
  ('GRAVITY', 'GMB_ACCESS',       'Google Business Profile owner access',   'local_gmb',    50,  7,  'Owner-level access required for posting + insights.'),
  ('GRAVITY', 'NAP_BASE',         'First 50 of 100 NAP submissions',        'local_gmb',    60,  30, 'Initial citation push.'),

  -- LAPETUS
  ('LAPETUS', 'KICKOFF_CALL',     'Schedule kickoff call',                  'account_mgmt', 10,  3,  null),
  ('LAPETUS', 'AGREEMENT_SIGNED', 'Counter-signed service agreement filed', 'finance',      20,  7,  null),
  ('LAPETUS', 'ASSETS_RECEIVED',  'Logo + brand assets received',           'design',       30,  5,  null),
  ('LAPETUS', 'WP_ACCESS',        'WordPress access provisioned',           'development',  40,  5,  null),
  ('LAPETUS', 'KW_DISCOVERY',     'Keyword discovery (20 target keywords)', 'seo',          50,  14, null),
  ('LAPETUS', 'TECH_SEO',         'Technical SEO audit complete',           'seo',          60,  14, 'Schema, sitemap, HTTPS, page speed.'),
  ('LAPETUS', 'HOMEPAGE_REWRITE', 'Homepage + cornerstone rewrite',         'content',      70,  21, null),
  ('LAPETUS', 'LANDING_PAGES',    'First 10 of 20 landing pages drafted',   'paid_ads',     80,  30, null),

  -- RHEA
  ('RHEA',    'KICKOFF_CALL',     'Schedule kickoff call',                  'account_mgmt', 10,  3,  null),
  ('RHEA',    'AGREEMENT_SIGNED', 'Counter-signed service agreement filed', 'finance',      20,  7,  null),
  ('RHEA',    'ASSETS_RECEIVED',  'Logo + brand assets received',           'design',       30,  5,  null),
  ('RHEA',    'WP_ACCESS',        'WordPress access provisioned',           'development',  40,  5,  null),
  ('RHEA',    'KW_DISCOVERY',     'Keyword discovery (25 target keywords)', 'seo',          50,  14, null),
  ('RHEA',    'TECH_SEO',         'Technical SEO audit complete',           'seo',          60,  14, null),
  ('RHEA',    'HOMEPAGE_REWRITE', 'Homepage + cornerstone rewrite',         'content',      70,  21, null),
  ('RHEA',    'CONTENT_CALENDAR', 'Q1 content calendar approved',           'content',      75,  14, null),
  ('RHEA',    'LANDING_PAGES',    'First 25 of 100 landing pages drafted',  'paid_ads',     80,  30, null),

  -- TITAN
  ('TITAN',   'KICKOFF_CALL',     'Schedule kickoff call',                  'account_mgmt', 10,  3,  null),
  ('TITAN',   'AGREEMENT_SIGNED', 'Counter-signed service agreement filed', 'finance',      20,  7,  null),
  ('TITAN',   'ASSETS_RECEIVED',  'Logo + brand assets received',           'design',       30,  5,  null),
  ('TITAN',   'WP_ACCESS',        'WordPress access provisioned',           'development',  40,  5,  null),
  ('TITAN',   'KW_DISCOVERY',     'Keyword discovery (30 target keywords)', 'seo',          50,  14, null),
  ('TITAN',   'TECH_SEO',         'Technical SEO audit complete',           'seo',          60,  14, null),
  ('TITAN',   'HOMEPAGE_REWRITE', 'Homepage + cornerstone rewrite',         'content',      70,  21, null),
  ('TITAN',   'CONTENT_CALENDAR', 'Q1 content calendar approved',           'content',      75,  14, null),
  ('TITAN',   'LANDING_PAGES',    'First 50 of 200 landing pages drafted',  'paid_ads',     80,  30, null),

  -- LIVE_INTAKES
  ('LIVE_INTAKES', 'KICKOFF_CALL',        'Schedule kickoff call',                 'account_mgmt', 10, 3, null),
  ('LIVE_INTAKES', 'INTAKES_SETUP',       'Live intake routing configured',        'intakes',      20, 7, null),
  ('LIVE_INTAKES', 'VOICEMAIL_FALLBACK',  'After-hours voicemail tested',          'intakes',      30, 7, null)
on conflict (package_code, code) do nothing;

-- ============================================================================
-- TRIGGER: auto-generate client_onboarding_tasks on subscription insert
-- ============================================================================
create or replace function generate_onboarding_tasks_on_subscription_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pkg_code text;
begin
  select code into pkg_code from package_templates where id = NEW.package_id;
  if pkg_code is null then
    return NEW;
  end if;

  insert into client_onboarding_tasks (subscription_id, template_id, display_name, department_slug, due_date)
  select
    NEW.id,
    t.id,
    t.display_name,
    t.department_slug,
    case when t.target_days_from_start is not null
         then (NEW.started_at + (t.target_days_from_start || ' days')::interval)::date
         else null end
  from onboarding_templates t
  where t.package_code = pkg_code;

  return NEW;
end;
$$;

drop trigger if exists subscriptions_generate_onboarding_tasks on subscriptions;
create trigger subscriptions_generate_onboarding_tasks
  after insert on subscriptions
  for each row
  execute function generate_onboarding_tasks_on_subscription_insert();

-- ============================================================================
-- BACKFILL — generate tasks for pre-existing subscriptions
-- ============================================================================
-- Only inserts tasks that don't already exist for that (subscription, template)
-- pair, so this is safe to re-run.
insert into client_onboarding_tasks (subscription_id, template_id, display_name, department_slug, due_date)
select
  s.id,
  t.id,
  t.display_name,
  t.department_slug,
  case when t.target_days_from_start is not null
       then (s.started_at + (t.target_days_from_start || ' days')::interval)::date
       else null end
from subscriptions s
join package_templates p on p.id = s.package_id
join onboarding_templates t on t.package_code = p.code
where not exists (
  select 1 from client_onboarding_tasks existing
  where existing.subscription_id = s.id
    and existing.template_id = t.id
);
