-- 0005_normalized_tables.sql
-- Rolled-up, deduped views the app queries for charts and lists.
-- Reconciliation step (Phase 6+) reads raw_* and writes here.

-- ============================================================================
-- RANKINGS_DAILY — one row per (client, location, keyword, day)
-- ============================================================================
create table if not exists rankings_daily (
  id bigserial primary key,
  client_id uuid not null references clients(id) on delete cascade,
  location_id uuid references client_locations(id) on delete cascade,
  keyword text not null,
  position int,                            -- google desktop default
  position_mobile int,
  position_local_finder int,
  position_bing int,
  position_change int,                     -- delta vs previous pull
  url text,
  captured_on date not null,
  unique (client_id, location_id, keyword, captured_on)
);

create index if not exists rankings_daily_client_date_idx on rankings_daily(client_id, captured_on desc);

-- ============================================================================
-- SITE_HEALTH — PSI rolled up by day per URL+strategy
-- ============================================================================
create table if not exists site_health (
  id bigserial primary key,
  client_id uuid not null references clients(id) on delete cascade,
  url text not null,
  strategy text not null,
  performance int,
  seo int,
  accessibility int,
  best_practices int,
  lcp_ms int,
  fid_ms int,
  cls numeric,
  captured_on date not null,
  unique (client_id, url, strategy, captured_on)
);

-- ============================================================================
-- CITATIONS — daily snapshot per client (monthly source, daily rollup)
-- ============================================================================
create table if not exists citations (
  id bigserial primary key,
  client_id uuid not null references clients(id) on delete cascade,
  health_score int,
  correct_count int,
  incorrect_count int,
  missing_count int,
  captured_on date not null,
  unique (client_id, captured_on)
);

-- ============================================================================
-- REVIEWS — deduped review list across all directories
-- ============================================================================
create table if not exists reviews (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,
  location_id uuid references client_locations(id) on delete cascade,
  directory text not null,
  external_review_id text,
  reviewer_name text,
  rating numeric,
  review_text text,
  review_date date,
  response_text text,
  response_date date,
  review_url text,
  sentiment text,                          -- 'positive', 'neutral', 'negative' (derived from rating)
  responded boolean default false,
  unique (directory, external_review_id)
);

create index if not exists reviews_client_date_idx on reviews(client_id, review_date desc);
create index if not exists reviews_client_directory_date_idx on reviews(client_id, directory, review_date desc);

-- ============================================================================
-- REVIEW_SUMMARY — daily snapshot per (client, location, directory)
-- ============================================================================
-- Powers chart "average rating over time per directory" without recomputing.
create table if not exists review_summary (
  id bigserial primary key,
  client_id uuid not null references clients(id) on delete cascade,
  location_id uuid references client_locations(id) on delete cascade,
  directory text not null,
  avg_rating numeric,
  review_count int,
  reviews_30d int,
  reviews_7d int,
  unanswered_count int,
  captured_on date not null,
  unique (client_id, location_id, directory, captured_on)
);

-- ============================================================================
-- GMB_SNAPSHOTS — GBP daily snapshot per location
-- ============================================================================
create table if not exists gmb_snapshots (
  id bigserial primary key,
  client_id uuid not null references clients(id) on delete cascade,
  location_id uuid references client_locations(id) on delete cascade,
  rating numeric,
  review_count int,
  posts_30d int,
  views_30d int,
  searches_30d int,
  captured_on date not null,
  unique (location_id, captured_on)
);

-- ============================================================================
-- POSTS — deduped WordPress posts (the app reads this, not raw_wordpress)
-- ============================================================================
create table if not exists posts (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,
  source_type text not null,               -- 'wp_post', 'wp_page'
  external_id text not null,
  slug text,
  title text,
  excerpt text,
  categories text[] default '{}',
  tags text[] default '{}',
  language text,
  published_at timestamptz,
  modified_at timestamptz,
  url text,
  unique (client_id, source_type, external_id)
);

create index if not exists posts_client_published_idx on posts(client_id, published_at desc);

-- ============================================================================
-- CALLS — deduped CallRail calls
-- ============================================================================
create table if not exists calls (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,
  external_id text not null,
  duration int,
  source text,
  tracker text,
  recording_url text,
  caller_name text,
  caller_number text,
  first_call boolean,
  agent_email text,
  started_at timestamptz,
  unique (client_id, external_id)
);

create index if not exists calls_client_started_idx on calls(client_id, started_at desc);

-- ============================================================================
-- SOCIAL_STATS — Metricool stats per (client, channel, period)
-- ============================================================================
create table if not exists social_stats (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,
  channel text not null,
  period_start date not null,
  period_end date not null,
  followers int,
  reach int,
  impressions int,
  posts_count int,
  ad_spend_cents int,
  unique (client_id, channel, period_start)
);

create index if not exists social_stats_client_period_idx on social_stats(client_id, period_start desc);
