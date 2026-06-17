-- =============================================================================
-- CRM Professional Schema (Phase 1 foundation)
-- =============================================================================
-- מטרה: תשתית CRM בענן בדומה ל-Salesforce/Dynamics:
--   לקוחות, פניות, מחלקות, שיוך נציגים, לוגים, ואירועי ניתוב.
--
-- הערה חשובה:
--   הקובץ יוצר סכימה + אינדקסים + enable RLS בלבד.
--   מדיניות RLS לפרודקשן: security_crm_rls.sql (אחרי security_phase9).
-- =============================================================================

begin;

create table if not exists public.crm_departments (
  id text primary key,
  name text not null,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_department_members (
  id uuid primary key default gen_random_uuid(),
  department_id text not null references public.crm_departments(id) on delete cascade,
  agent_id uuid not null references public.agents(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (department_id, agent_id)
);

create table if not exists public.crm_customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  company text,
  notes text,
  created_by_agent_id uuid references public.agents(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_referrals (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.crm_customers(id) on delete cascade,
  referral_topic text,
  description text,
  status text not null default 'open' check (status in ('open', 'closed')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  assigned_to_type text not null default 'agent' check (assigned_to_type in ('agent', 'department')),
  assigned_agent_id uuid references public.agents(id) on delete set null,
  assigned_department_id text references public.crm_departments(id) on delete set null,
  created_by_agent_id uuid references public.agents(id) on delete set null,
  original_agent_id uuid references public.agents(id) on delete set null,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  last_activity_at timestamptz not null default now(),
  reopened_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.crm_call_logs (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.crm_customers(id) on delete cascade,
  referral_id uuid references public.crm_referrals(id) on delete set null,
  occurred_at timestamptz not null default now(),
  call_type text not null check (call_type in ('incoming', 'outgoing', 'chat')),
  summary text,
  agent_id uuid references public.agents(id) on delete set null,
  duration_minutes int,
  referral_topic text,
  created_at timestamptz not null default now()
);

create table if not exists public.crm_email_logs (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.crm_customers(id) on delete cascade,
  referral_id uuid references public.crm_referrals(id) on delete set null,
  direction text not null default 'outbound' check (direction in ('outbound', 'inbound')),
  to_email text,
  from_email text,
  subject text,
  body text,
  referral_topic text,
  sent_at timestamptz not null default now(),
  agent_id uuid references public.agents(id) on delete set null,
  status text not null default 'sent' check (status in ('sent', 'simulated', 'received', 'failed')),
  created_at timestamptz not null default now()
);

create table if not exists public.crm_referral_events (
  id uuid primary key default gen_random_uuid(),
  referral_id uuid not null references public.crm_referrals(id) on delete cascade,
  event_type text not null check (event_type in ('created', 'assigned', 'claimed', 'closed', 'reopened', 'comment')),
  actor_agent_id uuid references public.agents(id) on delete set null,
  old_value jsonb not null default '{}'::jsonb,
  new_value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_crm_customers_name on public.crm_customers (name);
create index if not exists idx_crm_customers_phone on public.crm_customers (phone);
create index if not exists idx_crm_referrals_customer_id on public.crm_referrals (customer_id);
create index if not exists idx_crm_referrals_status on public.crm_referrals (status);
create index if not exists idx_crm_referrals_assigned_agent on public.crm_referrals (assigned_agent_id);
create index if not exists idx_crm_referrals_assigned_department on public.crm_referrals (assigned_department_id);
create index if not exists idx_crm_referrals_last_activity on public.crm_referrals (last_activity_at desc);
create index if not exists idx_crm_call_logs_customer on public.crm_call_logs (customer_id);
create index if not exists idx_crm_email_logs_customer on public.crm_email_logs (customer_id);
create index if not exists idx_crm_referral_events_referral on public.crm_referral_events (referral_id, created_at desc);

alter table public.crm_departments enable row level security;
alter table public.crm_department_members enable row level security;
alter table public.crm_customers enable row level security;
alter table public.crm_referrals enable row level security;
alter table public.crm_call_logs enable row level security;
alter table public.crm_email_logs enable row level security;
alter table public.crm_referral_events enable row level security;

-- עדכון automatic timestamps למחלקות/לקוחות
create or replace function public.crm_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_crm_departments_updated_at on public.crm_departments;
create trigger trg_crm_departments_updated_at
before update on public.crm_departments
for each row
execute function public.crm_set_updated_at();

drop trigger if exists trg_crm_customers_updated_at on public.crm_customers;
create trigger trg_crm_customers_updated_at
before update on public.crm_customers
for each row
execute function public.crm_set_updated_at();

commit;
