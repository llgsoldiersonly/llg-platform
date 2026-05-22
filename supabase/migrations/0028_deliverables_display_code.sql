-- 0028_deliverables_display_code.sql
-- Expose package_deliverables.code on the deliverables_display view so the
-- /staff and /admin/submissions/new forms can filter their "Counts toward"
-- dropdown by submission kind (e.g., a Blog post submission only lists
-- BLOG_* deliverables).
--
-- Postgres CREATE OR REPLACE VIEW can only add columns at the end, not
-- reorder them — so the new `code` column lands at the bottom of the
-- SELECT list. Existing columns keep their positions.

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
  coalesce(pd.code, '') as code
from deliverables d
join subscriptions s on s.id = d.subscription_id
left join package_deliverables pd on pd.id = d.template_id;
