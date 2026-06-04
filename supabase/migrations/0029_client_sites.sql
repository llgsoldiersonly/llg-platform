-- 0029_client_sites.sql
-- Multiple tracked websites per client.
--
-- Until now each client had exactly one tracked domain (clients.primary_domain),
-- which drove organic rankings, backlinks, site-health, WordPress sync, AI
-- visibility, and competitor discovery. Some firms run two sites (e.g. a GBP/
-- local site plus a separate ads + organic site). client_sites becomes the
-- source of truth for which domains we monitor.
--
-- Rollout is additive and safe: we backfill one primary site per existing
-- client from primary_domain, and a trigger keeps clients.primary_domain
-- mirrored to the active primary site so every existing reader/cron keeps
-- working unchanged. Per-site data scoping + cron fan-out land in a follow-up.

create table if not exists client_sites (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,
  domain text not null,
  label text,                  -- human label, e.g. "Main / Ads site", "GBP site"
  purpose text,                -- free-text role hint, e.g. 'primary', 'local', 'microsite'
  is_primary boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- At most one primary site per client.
create unique index if not exists client_sites_one_primary_per_client
  on client_sites(client_id) where is_primary;

-- No duplicate domains within a client (case-insensitive).
create unique index if not exists client_sites_client_domain_uniq
  on client_sites(client_id, lower(domain));

create index if not exists client_sites_client_idx on client_sites(client_id);

-- ----------------------------------------------------------------------------
-- Backfill: one primary site per client that already has a primary_domain.
-- ----------------------------------------------------------------------------
insert into client_sites (client_id, domain, label, purpose, is_primary, is_active)
select id, primary_domain, 'Primary', 'primary', true, true
from clients
where primary_domain is not null and btrim(primary_domain) <> ''
on conflict do nothing;

-- ----------------------------------------------------------------------------
-- Keep clients.primary_domain mirrored to the active primary site, so all
-- existing code that reads primary_domain transparently follows the primary
-- site. Only writes when a primary exists (never nulls an existing value).
-- ----------------------------------------------------------------------------
create or replace function sync_client_primary_domain()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  target_client uuid := coalesce(new.client_id, old.client_id);
begin
  update clients c
  set primary_domain = ps.domain,
      updated_at = now()
  from (
    select client_id, domain
    from client_sites
    where client_id = target_client and is_primary and is_active
    limit 1
  ) ps
  where c.id = ps.client_id;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_sync_client_primary_domain on client_sites;
create trigger trg_sync_client_primary_domain
  after insert or update or delete on client_sites
  for each row
  execute function sync_client_primary_domain();

-- ----------------------------------------------------------------------------
-- RLS — mirror client_locations: staff full access, client users read own.
-- ----------------------------------------------------------------------------
alter table client_sites enable row level security;

drop policy if exists "client_sites_staff_all" on client_sites;
create policy "client_sites_staff_all" on client_sites
  for all using (is_agency_staff());

drop policy if exists "client_sites_user_read_own" on client_sites;
create policy "client_sites_user_read_own" on client_sites
  for select using (client_id in (select accessible_client_ids()));
