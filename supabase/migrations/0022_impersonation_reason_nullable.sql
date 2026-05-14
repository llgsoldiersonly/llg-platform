-- 0022_impersonation_reason_nullable.sql
-- Per Nathan, 2026-05-14: reason is no longer required when starting an
-- impersonation. The audit row's value comes from impersonator_id +
-- impersonated_client_id + started_at; reason is now a nicety for context-
-- rich debug sessions, not a hard requirement.

alter table impersonation_log
  alter column reason drop not null;
