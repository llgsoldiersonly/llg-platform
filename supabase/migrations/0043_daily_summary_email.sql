-- 0043_daily_summary_email.sql
-- Recipient for the daily whole-team summary email (submissions, completed
-- tasks, overdue, paused). Null disables the summary. Seeded to Brittany
-- Winters per the 2026-07 request — change with:
--   update platform_settings set daily_summary_email = 'someone@...' where id = 1;

alter table platform_settings add column if not exists daily_summary_email text;

update platform_settings
  set daily_summary_email = 'brittany.w@lucrativelegal.com'
  where id = 1 and daily_summary_email is null;
