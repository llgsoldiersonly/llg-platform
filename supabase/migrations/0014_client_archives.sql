-- 0014_client_archives.sql
-- Pre-deletion snapshot table. Hard-delete flow dumps a JSONB summary of
-- everything we know about a client (creds, subscriptions, ingested data,
-- tickets, tasks) into client_archives BEFORE running the cascading DELETE
-- on clients. This is the "oh no I shouldn't have deleted that" safety net
-- mentioned in the Phase 10 spec.
--
-- Note: client_archives.client_id is intentionally NOT a foreign key —
-- the client row is gone by the time the archive is queried. firm_name is
-- denormalized for the same reason.

create table if not exists client_archives (
  id bigserial primary key,
  client_id uuid not null,                          -- intentionally no FK
  firm_name text not null,                          -- denormalized
  archived_by uuid references auth.users(id) on delete set null,
  reason text not null,
  archive_data jsonb not null,                      -- full pre-delete snapshot
  created_at timestamptz default now()
);

create index if not exists client_archives_created_idx on client_archives(created_at desc);
create index if not exists client_archives_actor_idx on client_archives(archived_by, created_at desc);

alter table client_archives enable row level security;

-- Default-deny RLS — only service_role (server actions) read/write.
-- Super-admins access through admin client; never exposed to client_users.
