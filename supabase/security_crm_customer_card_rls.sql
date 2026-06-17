-- =============================================================================
-- CRM Customer Card RLS — אנשי קשר ומוצרים ללקוח
-- =============================================================================
-- הרץ **אחרי**:
--   1. crm_customer_card_schema.sql
--   2. security_crm_rls.sql (פונקציות _security_* קיימות)
-- =============================================================================

begin;

-- ── crm_customer_contacts ───────────────────────────────────────────────────
do $$
begin
  if to_regclass('public.crm_customer_contacts') is not null then
    perform public._security_grant_authenticated_if_table_exists('public', 'crm_customer_contacts');

    perform public._security_drop_policy_if_table_exists('public', 'crm_customer_contacts', 'crm_customer_contacts_select');
    perform public._security_drop_policy_if_table_exists('public', 'crm_customer_contacts', 'crm_customer_contacts_insert');
    perform public._security_drop_policy_if_table_exists('public', 'crm_customer_contacts', 'crm_customer_contacts_update');
    perform public._security_drop_policy_if_table_exists('public', 'crm_customer_contacts', 'crm_customer_contacts_delete');

    create policy crm_customer_contacts_select on public.crm_customer_contacts
      for select to authenticated using (true);

    create policy crm_customer_contacts_insert on public.crm_customer_contacts
      for insert to authenticated with check (true);

    create policy crm_customer_contacts_update on public.crm_customer_contacts
      for update to authenticated using (true) with check (true);

    create policy crm_customer_contacts_delete on public.crm_customer_contacts
      for delete to authenticated using (true);
  end if;
end;
$$;

-- ── crm_customer_products ─────────────────────────────────────────────────────
do $$
begin
  if to_regclass('public.crm_customer_products') is not null then
    perform public._security_grant_authenticated_if_table_exists('public', 'crm_customer_products');

    perform public._security_drop_policy_if_table_exists('public', 'crm_customer_products', 'crm_customer_products_select');
    perform public._security_drop_policy_if_table_exists('public', 'crm_customer_products', 'crm_customer_products_insert');
    perform public._security_drop_policy_if_table_exists('public', 'crm_customer_products', 'crm_customer_products_update');
    perform public._security_drop_policy_if_table_exists('public', 'crm_customer_products', 'crm_customer_products_delete');

    create policy crm_customer_products_select on public.crm_customer_products
      for select to authenticated using (true);

    create policy crm_customer_products_insert on public.crm_customer_products
      for insert to authenticated with check (true);

    create policy crm_customer_products_update on public.crm_customer_products
      for update to authenticated using (true) with check (true);

    create policy crm_customer_products_delete on public.crm_customer_products
      for delete to authenticated using (true);
  end if;
end;
$$;

commit;
