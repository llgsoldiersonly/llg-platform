-- 0039_content_plans.sql
-- Content plans: bulk content/SEO work modeled as a named plan (per client)
-- with one row per page/blog. Rows can be split across staff; each assigned
-- row spawns a child task that shows on the assignee's board / My Day. This is
-- the "client needs 10 blog pages / a sitemap of SEO pages" workflow, matching
-- the keyword-sheet structure (keyword, practice area, tier).

create table if not exists content_plans (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,
  name text not null,
  kind text not null default 'seo_page' check (kind in ('blog', 'seo_page', 'sitemap')),
  department_id uuid references departments(id),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists content_plans_client_idx on content_plans(client_id, created_at desc);

create table if not exists content_plan_items (
  id uuid primary key default uuid_generate_v4(),
  plan_id uuid not null references content_plans(id) on delete cascade,
  position int not null default 0,
  keyword text not null,                 -- the page/blog title or target keyword
  practice_area text,
  tier text,
  target_slug text,                      -- optional target URL / slug
  assigned_to uuid references auth.users(id) on delete set null,
  status text not null default 'todo'
    check (status in ('todo', 'in_progress', 'in_review', 'done', 'cancelled')),
  task_id uuid references tasks(id) on delete set null,   -- spawned child task
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists content_plan_items_plan_idx on content_plan_items(plan_id, position);
create index if not exists content_plan_items_assignee_idx on content_plan_items(assigned_to);
create index if not exists content_plan_items_task_idx on content_plan_items(task_id);

alter table content_plans enable row level security;
alter table content_plan_items enable row level security;

-- Internal only — no client_user policy (these are agency planning artifacts).
drop policy if exists "content_plans_staff_all" on content_plans;
create policy "content_plans_staff_all" on content_plans for all using (is_agency_staff());

drop policy if exists "content_plan_items_staff_all" on content_plan_items;
create policy "content_plan_items_staff_all" on content_plan_items for all using (is_agency_staff());
