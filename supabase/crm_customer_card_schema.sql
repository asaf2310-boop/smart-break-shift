-- =============================================================================
-- CRM Customer Card — הרחבת כרטיס לקוח
-- =============================================================================
-- הרץ **אחרי** crm_professional_schema.sql
-- מדיניות RLS: security_crm_customer_card_rls.sql (אחרי security_crm_rls.sql)
-- =============================================================================

begin;

-- שדות נוספים בלקוח
alter table public.crm_customers
  add column if not exists tax_id text,
  add column if not exists address text;

comment on column public.crm_customers.tax_id is 'ח.פ / ת.ז';
comment on column public.crm_customers.address is 'כתובת';

-- אנשי קשר נוספים ללקוח
create table if not exists public.crm_customer_contacts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.crm_customers(id) on delete cascade,
  name text not null,
  role_title text,
  phone text,
  email text,
  notes text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists crm_customer_contacts_customer_id_idx
  on public.crm_customer_contacts (customer_id);

create index if not exists crm_customer_contacts_sort_idx
  on public.crm_customer_contacts (customer_id, sort_order);

-- מוצרים משויכים ללקוח (לא קטלוג מוצרים מלא)
create table if not exists public.crm_customer_products (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.crm_customers(id) on delete cascade,
  product_name text not null,
  product_code text,
  status text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists crm_customer_products_customer_id_idx
  on public.crm_customer_products (customer_id);

alter table public.crm_customer_contacts enable row level security;
alter table public.crm_customer_products enable row level security;

commit;
