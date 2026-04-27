-- 0002_credentials.sql
-- Per-client API credentials. Locked down with RLS — only service_role reads.
-- Admin UI writes via server actions using service-role client (lib/supabase/admin.ts).
-- Sensitive fields (wp_app_password, gbp_refresh_token) should be encrypted app-side
-- before insert; see APPENDIX A in the handoff for options.

create table if not exists client_credentials (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null unique references clients(id) on delete cascade,

  -- WordPress
  wp_username text,
  wp_app_password text,                                  -- 🚨 encrypt before insert

  -- Language detection (drives BLOG_EN / BLOG_ES reconciliation in Phase 6)
  wp_language_method text check (
    wp_language_method in ('polylang', 'wpml', 'category', 'tag', 'path', 'none')
  ) default 'none',
  wp_language_en_value text,
  wp_language_es_value text,

  -- CallRail
  callrail_account_id text,
  callrail_company_id text,

  -- Metricool
  metricool_user_id text,
  metricool_blog_id text,

  -- BrightLocal (client-level ID; per-location IDs live on client_locations)
  brightlocal_client_id text,

  -- Google Business Profile (OAuth) — optional v1.5
  gbp_account_id text,
  gbp_refresh_token text,                                -- 🚨 encrypt before insert

  -- External tool URLs (rendered as click-out cards on admin view, never client view)
  ga4_property_url text,
  ga4_property_id text,
  google_ads_account_url text,
  google_ads_customer_id text,
  lsa_account_url text,
  gsc_property_url text,
  gsc_resource_id text,

  updated_at timestamptz default now(),
  updated_by uuid references auth.users(id)
);

-- Lock down: RLS on, no policies = no one reads except service_role (which bypasses).
-- This is intentional. Reads happen only from server actions using the admin client.
alter table client_credentials enable row level security;
