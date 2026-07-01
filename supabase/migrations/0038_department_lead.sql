-- 0038_department_lead.sql
-- "Head of Department" capability, layered on top of an agency_staff user
-- rather than a new top-level role (keeps RBAC + the JWT unchanged). A lead is
-- scoped to their existing profiles.department_id: they can see and manage all
-- tasks/deliverables in that department across every client.
--
-- Single-department per lead for now (their profiles.department_id). If someone
-- ever needs to lead two departments, add a department_leads(user_id,
-- department_id) mapping table — this column stays as the common case.
alter table profiles add column if not exists is_department_lead boolean not null default false;

create index if not exists profiles_department_lead_idx
  on profiles(department_id) where is_department_lead;
