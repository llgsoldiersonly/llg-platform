-- 0007_sync_log_notifications.sql
-- Sync log (cron run history), in-app notifications, activity log (audit trail).
-- All staff-only — no client-facing reads.

-- ============================================================================
-- SYNC_LOG — every cron job run, success or failure
-- ============================================================================
create table if not exists sync_log (
  id bigserial primary key,
  source text not null,                    -- 'wordpress', 'callrail', 'metricool', 'rankings', etc.
  client_id uuid references clients(id) on delete set null,
  status text not null check (status in ('ok', 'error', 'partial', 'skipped')),
  row_count int default 0,
  duration_ms int,
  error_message text,
  error_stack text,
  created_at timestamptz default now()
);

create index if not exists sync_log_source_created_idx on sync_log(source, created_at desc);
create index if not exists sync_log_client_created_idx on sync_log(client_id, created_at desc);

-- ============================================================================
-- NOTIFICATIONS — in-app alerts for users
-- ============================================================================
-- Different from RingCentral webhooks (those go out to Glip channels).
-- These show up in the app's bell icon for individual users.
create table if not exists notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,                      -- 'ticket_assigned', 'task_assigned', 'sync_error', etc.
  subject text not null,
  body text,
  link text,                               -- in-app URL to navigate to
  read_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists notifications_user_unread_idx on notifications(user_id, read_at);

-- ============================================================================
-- ACTIVITY_LOG — audit trail of mutations
-- ============================================================================
-- Captures who changed what, when. Used for impersonation audits, hard-delete
-- recovery snapshots, deliverable reconciliation events.
create table if not exists activity_log (
  id bigserial primary key,
  actor_id uuid references auth.users(id) on delete set null,
  entity_type text not null,               -- 'ticket', 'task', 'client', 'subscription', 'deliverable', etc.
  entity_id uuid not null,
  action text not null,                    -- 'created', 'updated', 'closed', 'assigned', 'deleted'
  before jsonb,
  after jsonb,
  created_at timestamptz default now()
);

create index if not exists activity_log_entity_idx on activity_log(entity_type, entity_id);
create index if not exists activity_log_actor_created_idx on activity_log(actor_id, created_at desc);
