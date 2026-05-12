-- 0020_submission_function_search_path.sql
-- Locks down `search_path` on the two trigger functions added in 0018.
-- Without an explicit search_path, Postgres resolves unqualified names
-- against the caller's search_path at execution time — a known attack
-- surface for SECURITY DEFINER / trigger functions. Supabase advisor flags
-- this as `function_search_path_mutable` (WARN). Both functions only touch
-- columns on the NEW row, so pinning to `public` is safe.

create or replace function auto_approve_social_submission()
returns trigger
language plpgsql
set search_path = public
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

create or replace function touch_deliverable_submission_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
