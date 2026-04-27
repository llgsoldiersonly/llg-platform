-- 0008_rls_policies.sql
-- Row-level security. The most important migration for tenant isolation.
--
-- Pattern:
--  - Staff (agency_staff or super_admin) has full access to everything
--  - Client users see only data tied to clients in their `client_users` rows
--  - client_credentials and tasks are staff-only (no client policy = no client read)
--
-- Helper functions are SECURITY DEFINER so they can read profiles + client_users
-- without triggering recursive RLS lookups.

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

create or replace function is_agency_staff()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
      and role in ('agency_staff', 'super_admin')
  );
$$;

grant execute on function is_agency_staff() to authenticated, anon;

create or replace function is_super_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'super_admin'
  );
$$;

grant execute on function is_super_admin() to authenticated, anon;

create or replace function accessible_client_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select client_id from client_users where user_id = auth.uid();
$$;

grant execute on function accessible_client_ids() to authenticated, anon;

-- ============================================================================
-- ENABLE RLS on every tenant-scoped table
-- ============================================================================
alter table clients enable row level security;
alter table client_locations enable row level security;
alter table client_users enable row level security;
alter table subscriptions enable row level security;
alter table deliverables enable row level security;
alter table tracked_keywords enable row level security;
alter table raw_rankings enable row level security;
alter table raw_lighthouse enable row level security;
alter table raw_reviews enable row level security;
alter table raw_citations enable row level security;
alter table raw_gmb enable row level security;
alter table raw_wordpress enable row level security;
alter table raw_callrail enable row level security;
alter table raw_metricool enable row level security;
alter table rankings_daily enable row level security;
alter table site_health enable row level security;
alter table citations enable row level security;
alter table reviews enable row level security;
alter table review_summary enable row level security;
alter table gmb_snapshots enable row level security;
alter table posts enable row level security;
alter table calls enable row level security;
alter table social_stats enable row level security;
alter table tickets enable row level security;
alter table ticket_messages enable row level security;
alter table tasks enable row level security;
alter table task_comments enable row level security;
alter table ticket_routing_rules enable row level security;
alter table sync_log enable row level security;
alter table notifications enable row level security;
alter table activity_log enable row level security;
alter table profiles enable row level security;
alter table departments enable row level security;
alter table package_templates enable row level security;
alter table package_modules enable row level security;
alter table package_deliverables enable row level security;
-- client_credentials already has RLS enabled in 0002 (no policies = service-role-only)

-- ============================================================================
-- PROFILES
-- ============================================================================
-- Users can read + update their own profile. Staff can read everyone's.
drop policy if exists "profiles_self_read" on profiles;
create policy "profiles_self_read" on profiles
  for select using (id = auth.uid());

drop policy if exists "profiles_staff_read_all" on profiles;
create policy "profiles_staff_read_all" on profiles
  for select using (is_agency_staff());

drop policy if exists "profiles_self_update" on profiles;
create policy "profiles_self_update" on profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "profiles_staff_update_all" on profiles;
create policy "profiles_staff_update_all" on profiles
  for update using (is_agency_staff());

-- ============================================================================
-- DEPARTMENTS — read by everyone, no writes from app (admin manages via service role)
-- ============================================================================
drop policy if exists "departments_read_all" on departments;
create policy "departments_read_all" on departments
  for select using (true);

-- ============================================================================
-- PACKAGE_TEMPLATES / MODULES / DELIVERABLES — public read
-- ============================================================================
-- Clients see their package details too (via the deliverables_display view).
drop policy if exists "package_templates_read_all" on package_templates;
create policy "package_templates_read_all" on package_templates
  for select using (true);

drop policy if exists "package_modules_read_all" on package_modules;
create policy "package_modules_read_all" on package_modules
  for select using (true);

drop policy if exists "package_deliverables_read_all" on package_deliverables;
create policy "package_deliverables_read_all" on package_deliverables
  for select using (true);

-- ============================================================================
-- CLIENTS — staff: all; clients: own client only
-- ============================================================================
drop policy if exists "clients_staff_all" on clients;
create policy "clients_staff_all" on clients
  for all using (is_agency_staff());

drop policy if exists "clients_user_read_own" on clients;
create policy "clients_user_read_own" on clients
  for select using (id in (select accessible_client_ids()));

-- ============================================================================
-- CLIENT_LOCATIONS
-- ============================================================================
drop policy if exists "locations_staff_all" on client_locations;
create policy "locations_staff_all" on client_locations
  for all using (is_agency_staff());

drop policy if exists "locations_user_read_own" on client_locations;
create policy "locations_user_read_own" on client_locations
  for select using (client_id in (select accessible_client_ids()));

-- ============================================================================
-- CLIENT_USERS — staff: all; users: see only own membership rows
-- ============================================================================
drop policy if exists "client_users_staff_all" on client_users;
create policy "client_users_staff_all" on client_users
  for all using (is_agency_staff());

drop policy if exists "client_users_self_read" on client_users;
create policy "client_users_self_read" on client_users
  for select using (user_id = auth.uid());

-- ============================================================================
-- SUBSCRIPTIONS
-- ============================================================================
drop policy if exists "subs_staff_all" on subscriptions;
create policy "subs_staff_all" on subscriptions
  for all using (is_agency_staff());

drop policy if exists "subs_user_read_own" on subscriptions;
create policy "subs_user_read_own" on subscriptions
  for select using (client_id in (select accessible_client_ids()));

-- ============================================================================
-- DELIVERABLES — clients read via subscription join
-- ============================================================================
drop policy if exists "deliv_staff_all" on deliverables;
create policy "deliv_staff_all" on deliverables
  for all using (is_agency_staff());

drop policy if exists "deliv_user_read_own" on deliverables;
create policy "deliv_user_read_own" on deliverables
  for select using (
    subscription_id in (
      select id from subscriptions where client_id in (select accessible_client_ids())
    )
  );

-- ============================================================================
-- TRACKED_KEYWORDS — staff manages, clients see their own (read-only at portal)
-- ============================================================================
drop policy if exists "tracked_kw_staff_all" on tracked_keywords;
create policy "tracked_kw_staff_all" on tracked_keywords
  for all using (is_agency_staff());

drop policy if exists "tracked_kw_user_read" on tracked_keywords;
create policy "tracked_kw_user_read" on tracked_keywords
  for select using (client_id in (select accessible_client_ids()));

-- ============================================================================
-- RAW_* tables — staff full, clients read-only on their data
-- ============================================================================
drop policy if exists "raw_rankings_staff_all" on raw_rankings;
create policy "raw_rankings_staff_all" on raw_rankings
  for all using (is_agency_staff());
drop policy if exists "raw_rankings_user_read" on raw_rankings;
create policy "raw_rankings_user_read" on raw_rankings
  for select using (client_id in (select accessible_client_ids()));

drop policy if exists "raw_lighthouse_staff_all" on raw_lighthouse;
create policy "raw_lighthouse_staff_all" on raw_lighthouse
  for all using (is_agency_staff());
drop policy if exists "raw_lighthouse_user_read" on raw_lighthouse;
create policy "raw_lighthouse_user_read" on raw_lighthouse
  for select using (client_id in (select accessible_client_ids()));

drop policy if exists "raw_reviews_staff_all" on raw_reviews;
create policy "raw_reviews_staff_all" on raw_reviews
  for all using (is_agency_staff());
drop policy if exists "raw_reviews_user_read" on raw_reviews;
create policy "raw_reviews_user_read" on raw_reviews
  for select using (client_id in (select accessible_client_ids()));

drop policy if exists "raw_citations_staff_all" on raw_citations;
create policy "raw_citations_staff_all" on raw_citations
  for all using (is_agency_staff());
drop policy if exists "raw_citations_user_read" on raw_citations;
create policy "raw_citations_user_read" on raw_citations
  for select using (client_id in (select accessible_client_ids()));

drop policy if exists "raw_gmb_staff_all" on raw_gmb;
create policy "raw_gmb_staff_all" on raw_gmb
  for all using (is_agency_staff());
drop policy if exists "raw_gmb_user_read" on raw_gmb;
create policy "raw_gmb_user_read" on raw_gmb
  for select using (client_id in (select accessible_client_ids()));

drop policy if exists "raw_wordpress_staff_all" on raw_wordpress;
create policy "raw_wordpress_staff_all" on raw_wordpress
  for all using (is_agency_staff());
drop policy if exists "raw_wordpress_user_read" on raw_wordpress;
create policy "raw_wordpress_user_read" on raw_wordpress
  for select using (client_id in (select accessible_client_ids()));

drop policy if exists "raw_callrail_staff_all" on raw_callrail;
create policy "raw_callrail_staff_all" on raw_callrail
  for all using (is_agency_staff());
drop policy if exists "raw_callrail_user_read" on raw_callrail;
create policy "raw_callrail_user_read" on raw_callrail
  for select using (client_id in (select accessible_client_ids()));

drop policy if exists "raw_metricool_staff_all" on raw_metricool;
create policy "raw_metricool_staff_all" on raw_metricool
  for all using (is_agency_staff());
drop policy if exists "raw_metricool_user_read" on raw_metricool;
create policy "raw_metricool_user_read" on raw_metricool
  for select using (client_id in (select accessible_client_ids()));

-- ============================================================================
-- NORMALIZED tables
-- ============================================================================
drop policy if exists "rankings_daily_staff_all" on rankings_daily;
create policy "rankings_daily_staff_all" on rankings_daily
  for all using (is_agency_staff());
drop policy if exists "rankings_daily_user_read" on rankings_daily;
create policy "rankings_daily_user_read" on rankings_daily
  for select using (client_id in (select accessible_client_ids()));

drop policy if exists "site_health_staff_all" on site_health;
create policy "site_health_staff_all" on site_health
  for all using (is_agency_staff());
drop policy if exists "site_health_user_read" on site_health;
create policy "site_health_user_read" on site_health
  for select using (client_id in (select accessible_client_ids()));

drop policy if exists "citations_staff_all" on citations;
create policy "citations_staff_all" on citations
  for all using (is_agency_staff());
drop policy if exists "citations_user_read" on citations;
create policy "citations_user_read" on citations
  for select using (client_id in (select accessible_client_ids()));

drop policy if exists "reviews_staff_all" on reviews;
create policy "reviews_staff_all" on reviews
  for all using (is_agency_staff());
drop policy if exists "reviews_user_read" on reviews;
create policy "reviews_user_read" on reviews
  for select using (client_id in (select accessible_client_ids()));

drop policy if exists "review_summary_staff_all" on review_summary;
create policy "review_summary_staff_all" on review_summary
  for all using (is_agency_staff());
drop policy if exists "review_summary_user_read" on review_summary;
create policy "review_summary_user_read" on review_summary
  for select using (client_id in (select accessible_client_ids()));

drop policy if exists "gmb_snapshots_staff_all" on gmb_snapshots;
create policy "gmb_snapshots_staff_all" on gmb_snapshots
  for all using (is_agency_staff());
drop policy if exists "gmb_snapshots_user_read" on gmb_snapshots;
create policy "gmb_snapshots_user_read" on gmb_snapshots
  for select using (client_id in (select accessible_client_ids()));

drop policy if exists "posts_staff_all" on posts;
create policy "posts_staff_all" on posts
  for all using (is_agency_staff());
drop policy if exists "posts_user_read" on posts;
create policy "posts_user_read" on posts
  for select using (client_id in (select accessible_client_ids()));

drop policy if exists "calls_staff_all" on calls;
create policy "calls_staff_all" on calls
  for all using (is_agency_staff());
drop policy if exists "calls_user_read" on calls;
create policy "calls_user_read" on calls
  for select using (client_id in (select accessible_client_ids()));

drop policy if exists "social_stats_staff_all" on social_stats;
create policy "social_stats_staff_all" on social_stats
  for all using (is_agency_staff());
drop policy if exists "social_stats_user_read" on social_stats;
create policy "social_stats_user_read" on social_stats
  for select using (client_id in (select accessible_client_ids()));

-- ============================================================================
-- TICKETS — special: client can read+create own, but only staff can update/close
-- ============================================================================
drop policy if exists "tickets_staff_all" on tickets;
create policy "tickets_staff_all" on tickets
  for all using (is_agency_staff());

drop policy if exists "tickets_user_read_own" on tickets;
create policy "tickets_user_read_own" on tickets
  for select using (client_id in (select accessible_client_ids()));

drop policy if exists "tickets_user_create_own" on tickets;
create policy "tickets_user_create_own" on tickets
  for insert with check (
    client_id in (select accessible_client_ids())
    and created_by = auth.uid()
  );

-- No update/delete policy for clients — staff-only for status changes.

-- ============================================================================
-- TICKET_MESSAGES — clients see public messages only, can post public messages
-- ============================================================================
drop policy if exists "ticket_msg_staff_all" on ticket_messages;
create policy "ticket_msg_staff_all" on ticket_messages
  for all using (is_agency_staff());

drop policy if exists "ticket_msg_user_read_public" on ticket_messages;
create policy "ticket_msg_user_read_public" on ticket_messages
  for select using (
    is_internal_note = false
    and ticket_id in (
      select id from tickets where client_id in (select accessible_client_ids())
    )
  );

drop policy if exists "ticket_msg_user_insert_public" on ticket_messages;
create policy "ticket_msg_user_insert_public" on ticket_messages
  for insert with check (
    author_id = auth.uid()
    and is_internal_note = false
    and ticket_id in (
      select id from tickets where client_id in (select accessible_client_ids())
    )
  );

-- ============================================================================
-- TICKET_ROUTING_RULES — staff only
-- ============================================================================
drop policy if exists "ticket_routing_staff_all" on ticket_routing_rules;
create policy "ticket_routing_staff_all" on ticket_routing_rules
  for all using (is_agency_staff());

-- ============================================================================
-- TASKS / TASK_COMMENTS — staff only (clients never see internal tasks)
-- ============================================================================
drop policy if exists "tasks_staff_all" on tasks;
create policy "tasks_staff_all" on tasks
  for all using (is_agency_staff());

drop policy if exists "task_comments_staff_all" on task_comments;
create policy "task_comments_staff_all" on task_comments
  for all using (is_agency_staff());

-- ============================================================================
-- LOG / NOTIFICATION tables — staff only (notifications: user reads own)
-- ============================================================================
drop policy if exists "sync_log_staff_all" on sync_log;
create policy "sync_log_staff_all" on sync_log
  for all using (is_agency_staff());

drop policy if exists "notif_user_read_own" on notifications;
create policy "notif_user_read_own" on notifications
  for select using (user_id = auth.uid());

drop policy if exists "notif_user_update_own" on notifications;
create policy "notif_user_update_own" on notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "notif_staff_all" on notifications;
create policy "notif_staff_all" on notifications
  for all using (is_agency_staff());

drop policy if exists "activity_log_staff_all" on activity_log;
create policy "activity_log_staff_all" on activity_log
  for all using (is_agency_staff());
