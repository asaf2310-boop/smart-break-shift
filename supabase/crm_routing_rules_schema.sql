-- CRM Phase 4 — כללי ניתוב אוטומטי לפניות
-- הרץ אחרי: crm_professional_schema.sql

begin;

create table if not exists public.crm_routing_rules (
  id text primary key,
  referral_topic text not null,
  assigned_to_type text not null default 'department'
    check (assigned_to_type in ('agent', 'department')),
  assigned_department_id text references public.crm_departments(id) on delete set null,
  assigned_agent_id uuid references public.agents(id) on delete set null,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_crm_routing_rules_topic
  on public.crm_routing_rules (referral_topic)
  where active = true;

create index if not exists idx_crm_routing_rules_sort
  on public.crm_routing_rules (sort_order, referral_topic);

alter table public.crm_routing_rules enable row level security;

-- ברירת מחדל
insert into public.crm_routing_rules (id, referral_topic, assigned_to_type, assigned_department_id, sort_order) values
  ('rule_billing', 'חשבוניות', 'department', 'billing', 0),
  ('rule_sales', 'סליקה', 'department', 'sales', 1)
on conflict (id) do nothing;

commit;
