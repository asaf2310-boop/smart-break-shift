-- =============================================================================
-- vacation_requests — אפשר למנהל לעדכן סטטוס (אישור/דחייה)
-- =============================================================================
-- הרץ אחרי security_phase9_agent_rls.sql
-- Pattern A מאפשר UPDATE רק לנציג הבעלים; מנהל צריך לעדכן בקשות של נציגים אחרים.
-- (האפליקציה משתמשת גם ב-API admin_update_vacation_request עם service role.)
-- =============================================================================

begin;

drop policy if exists authenticated_update_vacation_requests on public.vacation_requests;

create policy authenticated_update_vacation_requests on public.vacation_requests
  for update to authenticated
  using (
    public.auth_agent_owns_name(agent_name)
    or public.auth_agent_is_admin()
  )
  with check (
    public.auth_agent_owns_name(agent_name)
    or public.auth_agent_is_admin()
  );

commit;
