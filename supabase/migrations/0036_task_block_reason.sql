-- 0036_task_block_reason.sql
-- Reason a task is paused (status = 'blocked' on the board is labeled "Paused").
-- Captured when a card is moved to Paused so it's clear what the task is
-- waiting on. Cleared automatically when the task leaves the paused state.
alter table tasks add column if not exists block_reason text;
