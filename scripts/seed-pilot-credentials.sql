-- seed-pilot-credentials.sql
-- Loads CallRail account_id + company_id (and clears wrong BrightLocal values)
-- for the 6 pilot clients. Idempotent — re-running updates the same rows.
-- Run with: psql "$DATABASE_URL" -f scripts/seed-pilot-credentials.sql
-- Or paste into the Supabase SQL editor.
--
-- Account-level CallRail account_id is repeated per client as an override so
-- the cron doesn't depend on CALLRAIL_DEFAULT_ACCOUNT_ID being set in Vercel.
-- Once that env var is confirmed correct, these per-client values can be
-- cleared with:  update client_credentials set callrail_account_id = null;
--
-- BrightLocal client_ids are explicitly NULLed because the values previously
-- supplied turned out to be CallRail numeric_ids, not BrightLocal IDs.
-- They'll be repopulated once real BrightLocal IDs are sourced from the
-- BrightLocal dashboard.

-- Olson Law Office PC (MT) — CallRail active
insert into client_credentials (client_id, callrail_account_id, callrail_company_id, brightlocal_client_id)
select id, 'ACC6e32cecb30544e85a31a9c2d104f89bc', 'COM019d6e19326e72e79a12fa3838051c0f', null
from clients where firm_name = 'Olson Law Office PC'
on conflict (client_id) do update set
  callrail_account_id = excluded.callrail_account_id,
  callrail_company_id = excluded.callrail_company_id,
  brightlocal_client_id = excluded.brightlocal_client_id,
  updated_at = now();

-- Movahedi Law (DC) — CallRail active
insert into client_credentials (client_id, callrail_account_id, callrail_company_id, brightlocal_client_id)
select id, 'ACC6e32cecb30544e85a31a9c2d104f89bc', 'COM019d745e983c7489b3ec59f43f81dd24', null
from clients where firm_name = 'Movahedi Law'
on conflict (client_id) do update set
  callrail_account_id = excluded.callrail_account_id,
  callrail_company_id = excluded.callrail_company_id,
  brightlocal_client_id = excluded.brightlocal_client_id,
  updated_at = now();

-- Daniels Law PA (FL) — CallRail company is DISABLED in CallRail UI as of 2026-04-29.
-- Seeding the ID anyway so wiring is correct; ingestion will return 0 calls
-- until Daniels' company is re-enabled in CallRail.
insert into client_credentials (client_id, callrail_account_id, callrail_company_id, brightlocal_client_id)
select id, 'ACC6e32cecb30544e85a31a9c2d104f89bc', 'COM019d8d070b48739a96c03cc9d92f90cf', null
from clients where firm_name = 'Daniels Law PA'
on conflict (client_id) do update set
  callrail_account_id = excluded.callrail_account_id,
  callrail_company_id = excluded.callrail_company_id,
  brightlocal_client_id = excluded.brightlocal_client_id,
  updated_at = now();

-- Gilliam Law (one client, two locations) — CallRail active
insert into client_credentials (client_id, callrail_account_id, callrail_company_id, brightlocal_client_id)
select id, 'ACC6e32cecb30544e85a31a9c2d104f89bc', 'COM019d88fb234073639d945813065e527c', null
from clients where firm_name = 'Gilliam Law'
on conflict (client_id) do update set
  callrail_account_id = excluded.callrail_account_id,
  callrail_company_id = excluded.callrail_company_id,
  brightlocal_client_id = excluded.brightlocal_client_id,
  updated_at = now();

-- Reiersen Law (WA) — CallRail company name "Ritchie-Reiersen", active
insert into client_credentials (client_id, callrail_account_id, callrail_company_id, brightlocal_client_id)
select id, 'ACC6e32cecb30544e85a31a9c2d104f89bc', 'COM019bed171c7476b6adde6315a075ad28', null
from clients where firm_name = 'Reiersen Law'
on conflict (client_id) do update set
  callrail_account_id = excluded.callrail_account_id,
  callrail_company_id = excluded.callrail_company_id,
  brightlocal_client_id = excluded.brightlocal_client_id,
  updated_at = now();

-- Dooley Noted (TX) — CallRail company name "Dooley Noted Probate", active.
-- (Earlier we thought CallRail was missing for Dooley; turns out it's there.)
insert into client_credentials (client_id, callrail_account_id, callrail_company_id, brightlocal_client_id)
select id, 'ACC6e32cecb30544e85a31a9c2d104f89bc', 'COM019cc06dbf21700898da675118f82de1', null
from clients where firm_name = 'Dooley Noted'
on conflict (client_id) do update set
  callrail_account_id = excluded.callrail_account_id,
  callrail_company_id = excluded.callrail_company_id,
  brightlocal_client_id = excluded.brightlocal_client_id,
  updated_at = now();

-- Verification: should return 6 rows, all with account_id and company_id set,
-- BrightLocal nulled.
select c.firm_name, cc.callrail_account_id, cc.callrail_company_id, cc.brightlocal_client_id, cc.updated_at
from clients c
join client_credentials cc on cc.client_id = c.id
where c.firm_name in (
  'Olson Law Office PC',
  'Movahedi Law',
  'Daniels Law PA',
  'Gilliam Law',
  'Reiersen Law',
  'Dooley Noted'
)
order by c.firm_name;
