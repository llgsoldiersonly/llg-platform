-- 0004_raw_tables.sql
-- Append-only ingestion buffers. Cron jobs write here; app reads normalized
-- tables (0005). Enables re-processing without re-fetching from upstream.

-- ============================================================================
-- TRACKED_KEYWORDS — the master keyword list per location
-- ============================================================================
-- Scoped to LOCATION not client because Gilliam Law's Chicago keywords
-- (immigration attorney Chicago) differ from Nashville keywords. Mirrored
-- to BrightLocal Rank Tracker via Management API; synced_to_brightlocal
-- flips true once BL confirms.
create table if not exists tracked_keywords (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,
  location_id uuid not null references client_locations(id) on delete cascade,
  keyword text not null,
  device text default 'desktop' check (device in ('desktop', 'mobile')),
  search_engine text default 'google',
  is_priority boolean default false,
  language_code text default 'en',
  notes text,
  synced_to_brightlocal boolean default false,
  created_at timestamptz default now(),
  created_by uuid references auth.users(id),
  unique (location_id, keyword, device, language_code)
);

create index if not exists tracked_keywords_client_idx on tracked_keywords(client_id);
create index if not exists tracked_keywords_location_idx on tracked_keywords(location_id);

-- ============================================================================
-- RAW_RANKINGS — BrightLocal Rank Tracker pulls (weekly)
-- ============================================================================
create table if not exists raw_rankings (
  id bigserial primary key,
  client_id uuid not null references clients(id) on delete cascade,
  location_id uuid references client_locations(id) on delete cascade,
  keyword text not null,
  position_google int,
  position_google_mobile int,
  position_google_local_finder int,
  position_bing int,
  last_position_google int,
  url text,
  search_engine text default 'google',
  captured_at timestamptz not null default now()
);

create index if not exists raw_rankings_client_captured_idx on raw_rankings(client_id, captured_at desc);

-- ============================================================================
-- RAW_LIGHTHOUSE — Google PageSpeed Insights pulls (weekly)
-- ============================================================================
create table if not exists raw_lighthouse (
  id bigserial primary key,
  client_id uuid not null references clients(id) on delete cascade,
  url text not null,
  strategy text not null check (strategy in ('mobile', 'desktop')),
  performance int,
  seo int,
  accessibility int,
  best_practices int,
  lcp_ms int,
  fid_ms int,
  cls numeric,
  opportunities jsonb,
  captured_at timestamptz not null default now()
);

create index if not exists raw_lighthouse_client_captured_idx on raw_lighthouse(client_id, captured_at desc);

-- ============================================================================
-- RAW_REVIEWS — BrightLocal Reputation Manager pulls (daily)
-- ============================================================================
-- Replaces GBP API for reviews. Covers Google, Avvo, Martindale, Justia,
-- Lawyers.com, BBB, Yelp, Facebook in one stream.
create table if not exists raw_reviews (
  id bigserial primary key,
  client_id uuid not null references clients(id) on delete cascade,
  location_id uuid references client_locations(id) on delete cascade,
  directory text not null,                   -- 'google', 'avvo', 'martindale', etc.
  external_review_id text,                   -- per-directory ID; used for dedup
  reviewer_name text,
  rating numeric,
  review_text text,
  review_date date,
  response_text text,
  response_date date,
  review_url text,
  raw_json jsonb,
  captured_at timestamptz default now(),
  unique (directory, external_review_id)
);

create index if not exists raw_reviews_client_directory_date_idx on raw_reviews(client_id, directory, review_date desc);

-- ============================================================================
-- RAW_CITATIONS — BrightLocal Citation Tracker pulls (monthly)
-- ============================================================================
create table if not exists raw_citations (
  id bigserial primary key,
  client_id uuid not null references clients(id) on delete cascade,
  health_score int,
  correct_count int,
  incorrect_count int,
  missing_count int,
  directories jsonb,
  ai_fixes jsonb,
  captured_at timestamptz not null default now()
);

create index if not exists raw_citations_client_captured_idx on raw_citations(client_id, captured_at desc);

-- ============================================================================
-- RAW_GMB — Google Business Profile pulls (daily, optional v1.5)
-- ============================================================================
-- Skipped in v1 if GBP API approval hasn't landed. Reviews come from raw_reviews
-- (BrightLocal). GBP only adds: posts count, Q&A, insights.
create table if not exists raw_gmb (
  id bigserial primary key,
  client_id uuid not null references clients(id) on delete cascade,
  location_id uuid references client_locations(id) on delete cascade,
  rating numeric,
  review_count int,
  posts_30d int,
  category text,
  hours jsonb,
  insights jsonb,
  captured_at timestamptz not null default now()
);

-- ============================================================================
-- RAW_WORDPRESS — WordPress posts via REST API (daily)
-- ============================================================================
-- Spec section 3.6: ALL blog content pulls through /wp/v2/posts with
-- ?_embed=wp:term so each post's categories/tags arrive inline. No separate
-- custom-post-type endpoint.
create table if not exists raw_wordpress (
  id bigserial primary key,
  client_id uuid not null references clients(id) on delete cascade,
  post_id int not null,
  slug text,
  title text,
  content_html text,
  post_type text default 'post',
  post_status text,
  categories text[] default '{}',
  tags text[] default '{}',
  language text,                                  -- populated from Polylang lang field if present
  url text,
  modified_at timestamptz,
  fetched_at timestamptz default now(),
  raw_json jsonb,
  unique (client_id, post_id, post_type)
);

create index if not exists raw_wordpress_client_modified_idx on raw_wordpress(client_id, modified_at desc);
create index if not exists raw_wordpress_categories_idx on raw_wordpress using gin (categories);

-- ============================================================================
-- RAW_CALLRAIL — CallRail calls + form submissions (daily)
-- ============================================================================
create table if not exists raw_callrail (
  id bigserial primary key,
  client_id uuid not null references clients(id) on delete cascade,
  call_id text not null,
  duration int,
  source text,
  tracker text,
  recording_url text,
  caller_name text,
  caller_number text,
  first_call boolean,
  agent_email text,
  started_at timestamptz,
  raw_json jsonb,
  fetched_at timestamptz default now(),
  unique (client_id, call_id)
);

-- ============================================================================
-- RAW_METRICOOL — Metricool social stats (daily)
-- ============================================================================
create table if not exists raw_metricool (
  id bigserial primary key,
  client_id uuid not null references clients(id) on delete cascade,
  channel text not null,
  period_start date not null,
  period_end date not null,
  followers int,
  reach int,
  impressions int,
  posts_count int,
  ad_spend_cents int,
  raw_json jsonb,
  fetched_at timestamptz default now(),
  unique (client_id, channel, period_start)
);
