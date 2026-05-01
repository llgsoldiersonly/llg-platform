-- 0016_google_ads_setup.sql
-- Adds Google Ads OAuth refresh-token storage at the agency level and
-- documents the per-client customer-id column already on client_credentials.
--
-- Architecture:
--   - One OAuth refresh token per agency (single-row platform_settings).
--   - One Google Ads customer_id per pilot client (client_credentials column
--     already exists; this migration just seeds known values).
--   - All API calls send: agency refresh token (-> access token), MCC
--     login-customer-id header, target client customer_id in body.

-- ============================================================================
-- platform_settings: refresh token column
-- ============================================================================
alter table platform_settings
  add column if not exists google_ads_refresh_token text;

comment on column platform_settings.google_ads_refresh_token is
  'OAuth 2.0 refresh token for Google Ads API. Set once via the
   /api/auth/google-ads/callback route after the agency super-admin
   authorizes the app. Used by the cron + read endpoints to mint
   access tokens for every per-client API call.';

-- ============================================================================
-- client_credentials.google_ads_customer_id seed
-- ============================================================================
-- Customer IDs supplied 2026-04-30 (Phase 1 of Google Ads integration):
--   Dooley Noted Probate                                601-712-9698 -> 6017129698
--   The Movahedi Law Group                              262-119-5598 -> 2621195598
--   Ritchie-Reiersen Injury & Immigration Attorneys     998-409-6802 -> 9984096802
--
-- Stored without dashes per the Google Ads API convention.

update client_credentials cc
set google_ads_customer_id = '6017129698',
    updated_at = now()
from clients c
where cc.client_id = c.id
  and c.firm_name = 'Dooley Noted';

update client_credentials cc
set google_ads_customer_id = '2621195598',
    updated_at = now()
from clients c
where cc.client_id = c.id
  and c.firm_name = 'Movahedi Law';

update client_credentials cc
set google_ads_customer_id = '9984096802',
    updated_at = now()
from clients c
where cc.client_id = c.id
  and c.firm_name = 'Reiersen Law';

-- Verification
select c.firm_name, cc.google_ads_customer_id
from client_credentials cc
join clients c on c.id = cc.client_id
where cc.google_ads_customer_id is not null
order by c.firm_name;
