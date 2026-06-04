-- 0030_client_sites_data_scoping.sql
-- Phase 2 of multi-site: make domain-driven data site-scoped.
--
-- Adds site_id to the tables whose data belongs to a specific website, and
-- backfills every existing row to the client's primary site (the one 0029
-- created from primary_domain). Cron fan-out (writing the correct site_id for
-- secondary sites) lands alongside this in the same release.
--
-- Out of scope here (still primary-site only, unchanged): AI visibility,
-- competitor discovery, and map-grid / GMB / local (those are place_id /
-- location driven, not domain driven).

-- Helper: a client's primary active site id.
-- (Used only inside this migration's backfills.)

-- ----------------------------------------------------------------------------
-- 1. Add site_id columns (nullable FK; on site delete, detach rather than
--    cascade — we never want losing a site row to delete historical metrics).
-- ----------------------------------------------------------------------------
alter table dfs_tracked_keywords       add column if not exists site_id uuid references client_sites(id) on delete set null;
alter table dfs_keyword_rank_snapshots add column if not exists site_id uuid references client_sites(id) on delete set null;
alter table dfs_backlink_snapshots     add column if not exists site_id uuid references client_sites(id) on delete set null;
alter table dfs_backlink_rows          add column if not exists site_id uuid references client_sites(id) on delete set null;
alter table site_health                add column if not exists site_id uuid references client_sites(id) on delete set null;
alter table raw_lighthouse             add column if not exists site_id uuid references client_sites(id) on delete set null;
alter table posts                      add column if not exists site_id uuid references client_sites(id) on delete set null;
alter table raw_wordpress              add column if not exists site_id uuid references client_sites(id) on delete set null;

-- ----------------------------------------------------------------------------
-- 2. Backfill every existing row to the client's primary site.
-- ----------------------------------------------------------------------------
update dfs_tracked_keywords t
  set site_id = s.id from client_sites s
  where s.client_id = t.client_id and s.is_primary and t.site_id is null;
update dfs_keyword_rank_snapshots t
  set site_id = s.id from client_sites s
  where s.client_id = t.client_id and s.is_primary and t.site_id is null;
update dfs_backlink_snapshots t
  set site_id = s.id from client_sites s
  where s.client_id = t.client_id and s.is_primary and t.site_id is null;
update dfs_backlink_rows t
  set site_id = s.id from client_sites s
  where s.client_id = t.client_id and s.is_primary and t.site_id is null;
update site_health t
  set site_id = s.id from client_sites s
  where s.client_id = t.client_id and s.is_primary and t.site_id is null;
update raw_lighthouse t
  set site_id = s.id from client_sites s
  where s.client_id = t.client_id and s.is_primary and t.site_id is null;
update posts t
  set site_id = s.id from client_sites s
  where s.client_id = t.client_id and s.is_primary and t.site_id is null;
update raw_wordpress t
  set site_id = s.id from client_sites s
  where s.client_id = t.client_id and s.is_primary and t.site_id is null;

create index if not exists dfs_tracked_keywords_site_idx       on dfs_tracked_keywords(site_id);
create index if not exists dfs_keyword_rank_snapshots_site_idx on dfs_keyword_rank_snapshots(site_id);
create index if not exists dfs_backlink_snapshots_site_idx     on dfs_backlink_snapshots(site_id);
create index if not exists dfs_backlink_rows_site_idx          on dfs_backlink_rows(site_id);
create index if not exists site_health_site_idx               on site_health(site_id);
create index if not exists posts_site_idx                      on posts(site_id);
create index if not exists raw_wordpress_site_idx              on raw_wordpress(site_id);

-- ----------------------------------------------------------------------------
-- 3. Widen uniqueness so two sites under one client don't collide.
--    Existing rows are already backfilled to the primary site, and the old
--    keys were unique per client, so each (… , primary_site , …) tuple stays
--    unique — these swaps are safe on current data.
--
--    The old unique CONSTRAINTS are dropped by introspection rather than by
--    literal name: Postgres truncates auto-generated names at 63 chars (the
--    dfs_backlink_rows one overflows), so a hard-coded DROP could silently
--    miss it and leave the client-wide uniqueness in place. This drops any
--    pre-existing unique constraint on the table that does NOT already
--    include site_id.
-- ----------------------------------------------------------------------------
do $$
declare
  tbl text;
  r record;
begin
  foreach tbl in array array['dfs_backlink_snapshots','dfs_backlink_rows','posts','raw_wordpress']
  loop
    for r in
      select con.conname
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace nsp on nsp.oid = rel.relnamespace
      where nsp.nspname = 'public'
        and rel.relname = tbl
        and con.contype = 'u'
        and not exists (
          select 1
          from unnest(con.conkey) ck
          join pg_attribute a on a.attrelid = con.conrelid and a.attnum = ck
          where a.attname = 'site_id'
        )
    loop
      execute format('alter table public.%I drop constraint %I', tbl, r.conname);
    end loop;
  end loop;
end $$;

-- Backlink summary: one row per site per day (was per client per day).
create unique index if not exists dfs_backlink_snapshots_site_date_key
  on dfs_backlink_snapshots(client_id, site_id, snapshot_date);

-- Backlink detail rows: include site_id in the dedupe key.
create unique index if not exists dfs_backlink_rows_site_dedupe_key
  on dfs_backlink_rows(client_id, site_id, status, url_from, url_to, month_key);

-- Posts: same external post id can exist on each site.
create unique index if not exists posts_site_source_external_key
  on posts(client_id, site_id, source_type, external_id);

-- raw_wordpress: same here.
create unique index if not exists raw_wordpress_site_post_key
  on raw_wordpress(client_id, site_id, post_id, post_type);

-- Note: dfs_keyword_rank_snapshots keeps its (tracked_keyword_id, snapshot_date,
-- search_type, device) key — the keyword already implies a site, so site_id is
-- carried as a denormalized filter column only. site_health keeps its
-- (client_id, url, strategy, captured_on) key — distinct site homepages have
-- distinct URLs, so it already disambiguates; site_id is a convenience filter.
