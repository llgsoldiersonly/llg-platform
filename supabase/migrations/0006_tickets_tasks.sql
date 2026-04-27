-- 0006_tickets_tasks.sql
-- Tickets (client-submitted requests) + ticket_messages (threaded replies)
-- + ticket_routing_rules (category→department) + tasks (internal work)
-- + task_comments. Phase 5 extends tickets further (quotas, SLA settings).

-- ============================================================================
-- TICKETS
-- ============================================================================
create table if not exists tickets (
  id uuid primary key default uuid_generate_v4(),
  ticket_number serial,
  client_id uuid not null references clients(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  subject text not null,
  category text,                           -- 'seo', 'design', 'dev', 'ads', 'content', 'intakes', 'billing', 'other'
  priority text default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  status text default 'open' check (status in ('open', 'in_progress', 'waiting_on_client', 'resolved', 'closed')),
  assigned_department_id uuid references departments(id),
  assigned_user_id uuid references auth.users(id),
  first_response_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  closed_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists tickets_client_idx on tickets(client_id);
create index if not exists tickets_status_idx on tickets(status);
create index if not exists tickets_dept_idx on tickets(assigned_department_id);
create index if not exists tickets_user_idx on tickets(assigned_user_id);

-- ============================================================================
-- TICKET_MESSAGES — threaded conversation
-- ============================================================================
-- is_internal_note=true messages are invisible to clients via RLS (see 0008).
create table if not exists ticket_messages (
  id uuid primary key default uuid_generate_v4(),
  ticket_id uuid not null references tickets(id) on delete cascade,
  author_id uuid not null references auth.users(id),
  body text not null,
  is_internal_note boolean default false,
  attachments jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);

create index if not exists ticket_messages_ticket_idx on ticket_messages(ticket_id, created_at);

-- ============================================================================
-- TICKET_ROUTING_RULES — category → department + RingCentral channel
-- ============================================================================
-- Editable in admin /settings/routing without a redeploy. Seeded in 0009.
create table if not exists ticket_routing_rules (
  id uuid primary key default uuid_generate_v4(),
  category text not null unique,
  department_id uuid not null references departments(id),
  priority_override text,                  -- e.g. always escalate this category
  glip_webhook_url text,
  active boolean default true,
  updated_at timestamptz default now()
);

-- ============================================================================
-- TASKS — internal work items (pm-tool functionality)
-- ============================================================================
create table if not exists tasks (
  id uuid primary key default uuid_generate_v4(),
  task_number serial,
  client_id uuid references clients(id) on delete set null,
  deliverable_id uuid references deliverables(id) on delete set null,
  title text not null,
  description text,
  status text default 'todo' check (status in ('todo', 'in_progress', 'in_review', 'blocked', 'done', 'cancelled')),
  priority text default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  department_id uuid references departments(id),
  created_by uuid not null references auth.users(id),
  assigned_to uuid references auth.users(id),
  due_date date,
  completed_at timestamptz,
  estimated_hours numeric,
  actual_hours numeric,
  tags text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists tasks_assignee_status_idx on tasks(assigned_to, status);
create index if not exists tasks_client_idx on tasks(client_id);
create index if not exists tasks_dept_status_idx on tasks(department_id, status);

-- ============================================================================
-- TASK_COMMENTS
-- ============================================================================
create table if not exists task_comments (
  id uuid primary key default uuid_generate_v4(),
  task_id uuid not null references tasks(id) on delete cascade,
  author_id uuid not null references auth.users(id),
  body text not null,
  created_at timestamptz default now()
);

create index if not exists task_comments_task_idx on task_comments(task_id, created_at);
