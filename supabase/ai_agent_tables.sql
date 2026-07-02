-- טבלאות לסוכן AI (קריאה בלבד דרך API)
-- הריצו ב-Supabase SQL Editor אם הטבלאות אינן קיימות.

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  status text default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price numeric(10, 2),
  duration_minutes int,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,
  service_id uuid references public.services(id) on delete set null,
  scheduled_at timestamptz not null,
  status text not null default 'scheduled',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,
  subject text not null,
  status text not null default 'open',
  priority text default 'normal',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_appointments_scheduled_at on public.appointments (scheduled_at);
create index if not exists idx_tickets_status on public.tickets (status);
create index if not exists idx_customers_phone on public.customers (phone);

alter table public.customers enable row level security;
alter table public.services enable row level security;
alter table public.appointments enable row level security;
alter table public.tickets enable row level security;

-- גישה דרך service role בלבד (ה-API משתמש ב-SUPABASE_SERVICE_ROLE_KEY)
-- אין מדיניות ל-anon/authenticated — הנתונים נגישים רק מהשרת.

comment on table public.customers is 'לקוחות — סוכן AI (קריאה בלבד)';
comment on table public.services is 'שירותים — סוכן AI (קריאה בלבד)';
comment on table public.appointments is 'תורים — סוכן AI (קריאה בלבד)';
comment on table public.tickets is 'כרטיסים — סוכן AI (קריאה בלבד)';
