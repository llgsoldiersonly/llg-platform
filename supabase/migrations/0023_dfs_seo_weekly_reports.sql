-- 0023_dfs_seo_weekly_reports.sql
-- Weekly SEO reports analog to dfs_seo_monthly_reports. Finalized every
-- Monday morning by /api/cron/weekly-report, covering the ISO week that
-- just ended (Mon → Sun). Adds two columns beyond the monthly schema:
--   - key_points: jsonb array of 3-5 short bullets (more granular than
--     executive_summary, which stays a 4-sentence narrative).
--   - last_month_recap: text, pulled verbatim from the most recent
--     finalized dfs_seo_monthly_reports.executive_summary at generation
--     time. Snapshot-on-write so the weekly archive remains stable even
--     after subsequent monthly reports land.

create table if not exists dfs_seo_weekly_reports (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,
  week_key text not null,                  -- 'YYYY-Www' (ISO 8601 week)
  period_start date not null,              -- inclusive (Monday)
  period_end date not null,                -- inclusive (Sunday)
  search_visibility_score integer,
  maps_score integer,
  organic_score integer,
  ai_visibility_score integer,
  review_score integer,
  competitor_gap_score integer,
  wins jsonb,
  losses jsonb,
  recommended_actions jsonb,
  executive_summary text,
  key_points jsonb,                        -- array of short strings
  last_month_recap text,                   -- snapshot of latest monthly exec_summary at write time
  created_at timestamptz default now(),
  unique (client_id, week_key)
);

create index if not exists dfs_seo_weekly_reports_client_week_idx
  on dfs_seo_weekly_reports(client_id, week_key desc);

alter table dfs_seo_weekly_reports enable row level security;
-- No policies = service-role only, matches dfs_seo_monthly_reports.
