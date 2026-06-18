-- CRM Phase 4 — RLS לכללי ניתוב
-- דרישות: security_phase9_agent_rls.sql (auth_agent_is_admin)
-- הרץ אחרי: crm_routing_rules_schema.sql

begin;

do $$
begin
  if to_regclass('public.crm_routing_rules') is not null then
    perform public._security_grant_authenticated_if_table_exists('public', 'crm_routing_rules');

    perform public._security_drop_policy_if_table_exists('public', 'crm_routing_rules', 'crm_routing_rules_select');
    perform public._security_drop_policy_if_table_exists('public', 'crm_routing_rules', 'crm_routing_rules_insert');
    perform public._security_drop_policy_if_table_exists('public', 'crm_routing_rules', 'crm_routing_rules_update');
    perform public._security_drop_policy_if_table_exists('public', 'crm_routing_rules', 'crm_routing_rules_delete');

    create policy crm_routing_rules_select on public.crm_routing_rules
      for select to authenticated using (true);

    create policy crm_routing_rules_insert on public.crm_routing_rules
      for insert to authenticated with check (public.auth_agent_is_admin());

    create policy crm_routing_rules_update on public.crm_routing_rules
      for update to authenticated
      using (public.auth_agent_is_admin())
      with check (public.auth_agent_is_admin());

    create policy crm_routing_rules_delete on public.crm_routing_rules
      for delete to authenticated using (public.auth_agent_is_admin());
  end if;
end;
$$;

commit;
