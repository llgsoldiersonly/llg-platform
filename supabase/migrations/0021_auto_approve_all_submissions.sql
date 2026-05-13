-- 0021_auto_approve_all_submissions.sql
-- Per Nathan, 2026-05-13: remove the approval flow entirely. Every staff
-- submission lands as `approved` on insert, regardless of kind. The
-- previous social-only auto-approve trigger is generalized.
--
-- Rationale: approval queue created friction without proportional QA value.
-- For "already-live" kinds (gmb_post, social_post, citation, link) the URL
-- itself is the verification. For other kinds (blog, faq, ai_page, pre-
-- launch milestones) staff are submitting proof-of-work post-publish, so
-- there's nothing to gate. Manager review can still happen out-of-band by
-- editing rows directly; we just don't block client visibility on it.

create or replace function auto_approve_published_submission()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'pending_approval' then
    new.status := 'approved';
    new.reviewed_by := new.submitted_by;
    new.reviewed_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_auto_approve_social on deliverable_submissions;
drop trigger if exists trg_auto_approve_published on deliverable_submissions;

create trigger trg_auto_approve_published
  before insert on deliverable_submissions
  for each row
  execute function auto_approve_published_submission();

-- Old function no longer referenced.
drop function if exists auto_approve_social_submission();
