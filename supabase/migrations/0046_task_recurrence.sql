-- 0046_task_recurrence.sql
-- Recurring tasks (weekly GBP audits, monthly reports, …). When a recurring
-- task is Submitted, the next occurrence is spawned automatically with the
-- due date advanced past today. Null = one-off task (default).
alter table tasks add column if not exists recur_every text
  check (recur_every in ('daily', 'weekly', 'biweekly', 'monthly'));
