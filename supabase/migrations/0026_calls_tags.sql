-- 0026_calls_tags.sql
-- Capture CallRail tags so the client-facing Calls widget can group calls
-- by funnel status (pending / accepted / rejected). CallRail returns tags
-- only when `fields=tags` is included on the calls.json request — see
-- lib/integrations/callrail.ts. Status is derived from tags in app code
-- (lib/calls/status.ts), not stored, so the mapping can be tuned without
-- a migration.

alter table calls
  add column if not exists tags text[] default '{}';

alter table raw_callrail
  add column if not exists tags text[] default '{}';

-- GIN index makes status-filtered queries fast (e.g., looking up calls
-- tagged 'conversion' for a single client).
create index if not exists calls_tags_idx on calls using gin(tags);
