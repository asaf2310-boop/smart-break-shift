-- =============================================================================
-- שלב 20 — InfoSec (תיעוד + אינדקס אופציונלי)
-- =============================================================================
-- הרץ **אחרי** security_phase18.sql (+ deploy קוד phase 20)
--
-- Phase 20 ממוקד בקוד (audit נציגים/CRM, rate limits, guest token cleanup,
-- איפוס סיסמה) — אין מדיניות RLS חדשה.
-- =============================================================================

begin;

comment on table public.security_audit_log is
  'יומן ביקורת — פעולות מנהל ורגישות (phase 12+). phase 20: admin_agent_*, crm_routing_change.';

-- חיפוש לפי סוג פעולה + משאב (למשל agent / crm_routing_rule)
create index if not exists idx_security_audit_log_action_resource
  on public.security_audit_log (action, resource_type, created_at desc);

commit;
