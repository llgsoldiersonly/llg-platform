-- 0017_dataforseo_schema.sql
-- DataForSEO-sourced tables for the SEO portal (backlinks, SERP, Maps, AI mentions).
--
-- Design notes:
-- 1. The handoff doc proposed `portal_clients` and `client_sites` tables. Both
--    were dropped here — `clients` and `client_locations` from 0001 already
--    cover that ground (firm_name, primary_domain, lat/lng, gbp_place_id, etc.).
--    All new tables FK directly to clients(id) and client_locations(id).
-- 2. BrightLocal's existing rank pipeline (raw_rankings + rankings_daily) is
--    untouched. DataForSEO snapshots land in dfs_keyword_rank_snapshots so the
--    two sources can run in parallel during transition.
-- 3. RLS pattern matches the rest of the platform: enable RLS, no policies =
--    service-role-only reads (server actions + cron via createAdminClient).
-- 4. All tables prefixed `dfs_` so they're easy to grep, drop, and migrate as a
--    group.

-- =====================================================================
-- COMPETITORS — 3-5 local competitors per client
-- =====================================================================
create table if not exists dfs_competitor_sites (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,
  competitor_name text not null,
  competitor_domain text,
  google_business_profile_name text,
  city text,
  state text,
  notes text,
  is_active boolean default true,
  created_at timestamptz default now()
);
create index if not exists dfs_competitor_sites_client_idx on dfs_competitor_sites(client_id);

-- =====================================================================
-- TRACKED KEYWORDS — what we monitor per client / location
-- =====================================================================
create table if not exists dfs_tracked_keywords (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,
  client_location_id uuid references client_locations(id) on delete set null,
  keyword text not null,
  practice_area text,
  city text,
  state text,
  zip_code text,
  -- DataForSEO targeting params (one of location_name OR location_code).
  location_name text,
  location_code integer,
  language_code text default 'en',
  device text default 'desktop' check (device in ('desktop', 'mobile')),
  search_type text not null check (search_type in ('organic', 'local_pack', 'maps', 'ai_mode')),
  priority text default 'medium' check (priority in ('low', 'medium', 'high')),
  is_active boolean default true,
  created_at timestamptz default now()
);
create index if not exists dfs_tracked_keywords_client_idx on dfs_tracked_keywords(client_id);
create index if not exists dfs_tracked_keywords_active_idx on dfs_tracked_keywords(is_active) where is_active = true;

-- =====================================================================
-- KEYWORD RANK SNAPSHOTS — DataForSEO SERP results
-- =====================================================================
create table if not exists dfs_keyword_rank_snapshots (
  id uuid primary key default uuid_generate_v4(),
  tracked_keyword_id uuid not null references dfs_tracked_keywords(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  snapshot_date date not null,
  month_key text not null,                 -- 'YYYY-MM' for fast monthly grouping
  keyword text not null,
  search_type text not null,
  device text,
  location_name text,
  rank_group integer,                      -- DataForSEO grouped rank
  rank_absolute integer,
  url text,
  title text,
  description text,
  is_client_ranking boolean default false, -- true when client appears in SERP
  ranking_domain text,
  serp_features jsonb,                     -- featured snippet, AI overview presence, etc.
  top_competitors jsonb,                   -- top 10 competitors snapshot
  raw jsonb,
  created_at timestamptz default now(),
  unique (tracked_keyword_id, snapshot_date, search_type, device)
);
create index if not exists dfs_keyword_rank_snapshots_client_month_idx
  on dfs_keyword_rank_snapshots(client_id, month_key);
create index if not exists dfs_keyword_rank_snapshots_keyword_date_idx
  on dfs_keyword_rank_snapshots(tracked_keyword_id, snapshot_date desc);

-- =====================================================================
-- MAP GRID POINTS — geo-grid lat/lng around an office
-- =====================================================================
create table if not exists dfs_map_grid_points (
  id uuid primary key default uuid_generate_v4(),
  client_location_id uuid not null references client_locations(id) on delete cascade,
  label text,
  lat numeric not null,
  lng numeric not null,
  radius_miles numeric default 5,
  created_at timestamptz default now()
);
create index if not exists dfs_map_grid_points_location_idx on dfs_map_grid_points(client_location_id);

-- =====================================================================
-- MAP GRID RANK SNAPSHOTS — Maps/Local Finder rank per grid point
-- =====================================================================
create table if not exists dfs_map_grid_rank_snapshots (
  id uuid primary key default uuid_generate_v4(),
  map_grid_point_id uuid not null references dfs_map_grid_points(id) on delete cascade,
  tracked_keyword_id uuid not null references dfs_tracked_keywords(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  snapshot_date date not null,
  month_key text not null,
  keyword text not null,
  lat numeric not null,
  lng numeric not null,
  client_map_rank integer,                 -- null = not found in top results
  client_found boolean default false,
  top_results jsonb,                       -- snapshot of top 10 listings at this point
  raw jsonb,
  created_at timestamptz default now(),
  unique (map_grid_point_id, tracked_keyword_id, snapshot_date)
);
create index if not exists dfs_map_grid_rank_snapshots_client_month_idx
  on dfs_map_grid_rank_snapshots(client_id, month_key);

-- =====================================================================
-- BACKLINK SNAPSHOTS — monthly summary
-- =====================================================================
create table if not exists dfs_backlink_snapshots (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,
  snapshot_date date not null,
  month_key text not null,
  total_backlinks integer default 0,
  referring_domains integer default 0,
  referring_main_domains integer default 0,
  referring_ips integer default 0,
  broken_backlinks integer default 0,
  backlink_spam_score integer default 0,
  new_backlinks integer default 0,
  lost_backlinks integer default 0,
  new_referring_domains integer default 0,
  lost_referring_domains integer default 0,
  raw_summary jsonb,
  raw_new_lost jsonb,
  created_at timestamptz default now(),
  unique (client_id, snapshot_date)
);
create index if not exists dfs_backlink_snapshots_client_month_idx
  on dfs_backlink_snapshots(client_id, month_key);

-- =====================================================================
-- BACKLINK ROWS — individual new/lost/live links
-- =====================================================================
create table if not exists dfs_backlink_rows (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,
  month_key text not null,
  status text not null check (status in ('new', 'lost', 'live')),
  domain_from text,
  url_from text,
  url_to text,
  page_from_title text,
  first_seen timestamptz,
  prev_seen timestamptz,
  last_seen timestamptz,
  dofollow boolean,
  anchor text,
  item_type text,
  semantic_location text,
  is_broken boolean,
  backlink_spam_score integer,
  rank integer,
  page_from_rank integer,
  domain_from_rank integer,
  domain_from_country text,
  insight_category text,                   -- 'high_value' | 'directory' | 'spam' | etc.
  raw jsonb,
  created_at timestamptz default now(),
  unique (client_id, status, url_from, url_to, month_key)
);
create index if not exists dfs_backlink_rows_client_month_status_idx
  on dfs_backlink_rows(client_id, month_key, status);

-- =====================================================================
-- AI / LLM VISIBILITY SNAPSHOTS
-- =====================================================================
create table if not exists dfs_ai_visibility_snapshots (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,
  tracked_keyword_id uuid references dfs_tracked_keywords(id) on delete set null,
  snapshot_date date not null,
  month_key text not null,
  platform text not null,                  -- 'google_ai_mode' | 'chat_gpt' | 'llm_mentions' | etc.
  prompt text not null,
  client_mentioned boolean default false,
  client_cited boolean default false,
  client_mention_count integer default 0,
  client_citation_urls jsonb,
  competitor_mentions jsonb,
  top_domains jsonb,
  raw jsonb,
  created_at timestamptz default now()
);
create index if not exists dfs_ai_visibility_snapshots_client_month_idx
  on dfs_ai_visibility_snapshots(client_id, month_key);

-- =====================================================================
-- MONTHLY REPORTS — finalized on 1st of each month
-- =====================================================================
create table if not exists dfs_seo_monthly_reports (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,
  month_key text not null,
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
  created_at timestamptz default now(),
  unique (client_id, month_key)
);

-- =====================================================================
-- USAGE LOG — DataForSEO API cost tracking
-- =====================================================================
create table if not exists dfs_usage_log (
  id bigserial primary key,
  client_id uuid references clients(id) on delete set null,
  endpoint text not null,
  cost numeric default 0,
  tasks_count integer default 0,
  tasks_error integer default 0,
  request_tag text,
  raw_status_code integer,
  raw_status_message text,
  duration_ms integer,
  created_at timestamptz default now()
);
create index if not exists dfs_usage_log_endpoint_created_idx on dfs_usage_log(endpoint, created_at desc);
create index if not exists dfs_usage_log_client_created_idx on dfs_usage_log(client_id, created_at desc);

-- =====================================================================
-- RLS — staff-only across the board (no policies = service-role only)
-- Matches client_credentials / sync_log convention.
-- =====================================================================
alter table dfs_competitor_sites enable row level security;
alter table dfs_tracked_keywords enable row level security;
alter table dfs_keyword_rank_snapshots enable row level security;
alter table dfs_map_grid_points enable row level security;
alter table dfs_map_grid_rank_snapshots enable row level security;
alter table dfs_backlink_snapshots enable row level security;
alter table dfs_backlink_rows enable row level security;
alter table dfs_ai_visibility_snapshots enable row level security;
alter table dfs_seo_monthly_reports enable row level security;
alter table dfs_usage_log enable row level security;
