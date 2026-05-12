-- 0018_deliverable_submissions.sql
-- Staff "submit work + link + approval" pipeline.
--
-- Workflow:
--   1. Agency staff completes a piece of work (a blog, FAQ, GMB post, citation, etc.)
--   2. They submit it through the portal: pick a firm, pick a kind, paste the link,
--      optional title/notes. Row lands in deliverable_submissions as 'pending_approval'.
--   3. A super_admin reviews and either approves or rejects (with reason).
--   4. On approve, increments actual_count on the matching `deliverables` row for
--      the current period (handled in lib/actions/submissions.ts, not a trigger,
--      so the period-resolution logic stays in one place).
--   5. Social-media submissions skip the queue: trigger auto-approves on insert
--      because the post is already live on the social platform and only needs to
--      be reported. (Per Nathan, 2026-05-12.)
--
-- Clients only ever see status='approved' rows via RLS. The submission link goes
-- into the Recent Updates timeline so they can verify the work.

create table if not exists deliverable_submissions (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,

  -- Links to a specific deliverables row (the period bucket). Optional because
  -- some pre-launch submissions (e.g. "Design Theme") may not have a deliverable
  -- row instantiated yet; reconcile in app code.
  deliverable_id uuid references deliverables(id) on delete set null,

  -- The kind of work submitted. Free-text discriminator (not enum) so we can add
  -- new kinds without a migration. App-layer constants live in lib/submissions/kinds.ts.
  -- Examples: 'blog', 'faq', 'ai_page', 'gmb_post', 'social_post', 'citation',
  -- 'link', 'directory', 'design_theme', 'parent_page', 'child_page'.
  kind text not null,

  title text,                       -- e.g. "New blog: Top 10 questions"
  link_url text not null,           -- proof of work; clients click through
  notes text,                       -- optional staff context

  submitted_by uuid not null references auth.users(id),
  submitted_at timestamptz not null default now(),

  status text not null default 'pending_approval'
    check (status in ('pending_approval', 'approved', 'rejected')),

  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  rejection_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists deliverable_submissions_client_idx
  on deliverable_submissions(client_id);
create index if not exists deliverable_submissions_status_idx
  on deliverable_submissions(status);
create index if not exists deliverable_submissions_kind_idx
  on deliverable_submissions(kind);
create index if not exists deliverable_submissions_deliverable_idx
  on deliverable_submissions(deliverable_id);
create index if not exists deliverable_submissions_pending_idx
  on deliverable_submissions(status, submitted_at desc)
  where status = 'pending_approval';

-- ============================================================================
-- AUTO-APPROVE TRIGGER for social_post kind
-- ============================================================================
-- Social posts are already live and visible on the social platforms by the time
-- staff log them here, so review adds no value — auto-approve on insert.
create or replace function auto_approve_social_submission()
returns trigger
language plpgsql
as $$
begin
  if new.kind = 'social_post' and new.status = 'pending_approval' then
    new.status := 'approved';
    new.reviewed_by := new.submitted_by;
    new.reviewed_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_auto_approve_social on deliverable_submissions;
create trigger trg_auto_approve_social
  before insert on deliverable_submissions
  for each row
  execute function auto_approve_social_submission();

-- ============================================================================
-- TOUCH updated_at
-- ============================================================================
create or replace function touch_deliverable_submission_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_touch_submission_updated_at on deliverable_submissions;
create trigger trg_touch_submission_updated_at
  before update on deliverable_submissions
  for each row
  execute function touch_deliverable_submission_updated_at();

-- ============================================================================
-- RLS
-- ============================================================================
alter table deliverable_submissions enable row level security;

-- Staff: full read/write (super_admin can also update status; enforced in app
-- since RLS can't easily gate column updates).
drop policy if exists "submissions_staff_all" on deliverable_submissions;
create policy "submissions_staff_all" on deliverable_submissions
  for all using (is_agency_staff());

-- Clients: read-only, and only approved rows for their own client.
drop policy if exists "submissions_client_read_approved" on deliverable_submissions;
create policy "submissions_client_read_approved" on deliverable_submissions
  for select using (
    status = 'approved'
    and client_id in (select accessible_client_ids())
  );

-- ============================================================================
-- VIEW: deliverable_submissions_with_actors
-- ============================================================================
-- Joins submitter + reviewer profile data for admin lists. Clients don't need
-- this view (they only see the approved link + title in their timeline).
create or replace view deliverable_submissions_with_actors as
select
  ds.*,
  sub.full_name as submitted_by_name,
  rev.full_name as reviewed_by_name,
  c.firm_name
from deliverable_submissions ds
left join profiles sub on sub.id = ds.submitted_by
left join profiles rev on rev.id = ds.reviewed_by
left join clients c on c.id = ds.client_id;
