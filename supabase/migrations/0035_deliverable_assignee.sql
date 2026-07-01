-- 0035_deliverable_assignee.sql
-- Deliverable-level ownership: give each deliverable an assignee (the staffer
-- responsible for the work), separate from completed_by (who marked it done).
-- This is the "deliverable-level ownership + tasks for everything else" model.

alter table deliverables
  add column if not exists assigned_to uuid references auth.users(id) on delete set null;

create index if not exists deliverables_assignee_idx on deliverables(assigned_to);

-- Recreate the display view to expose assigned_to (CREATE OR REPLACE can only
-- append columns — assigned_to lands at the end, existing columns keep order).
create or replace view deliverables_display as
select
  d.id,
  d.subscription_id,
  s.client_id,
  s.location_id,
  d.source,
  d.is_incentive,
  coalesce(pd.display_name, d.custom_title) as title,
  coalesce(pd.description, d.custom_description) as description,
  coalesce(pd.department_slug, d.custom_department_slug) as department_slug,
  coalesce(pd.module_code, 'CUSTOM') as module_code,
  coalesce(pd.frequency, d.custom_frequency) as frequency,
  coalesce(pd.target_count, d.custom_target_count) as target_count,
  coalesce(pd.target_unit, d.custom_target_unit) as target_unit,
  coalesce(pd.client_visible, true) as client_visible,
  d.period_start,
  d.period_end,
  d.status,
  d.actual_count,
  d.completed_at,
  d.notes,
  coalesce(pd.code, '') as code,
  d.assigned_to
from deliverables d
join subscriptions s on s.id = d.subscription_id
left join package_deliverables pd on pd.id = d.template_id;
