-- =============================================================================
-- שלב 18 — InfoSec (תיעוד + אינדקס אופציונלי)
-- =============================================================================
-- הרץ **אחרי** security_phase16.sql (+ deploy קוד phase 18)
--
-- Phase 18 ממוקד בקוד (rate limits, logout, CSP, audit labels) —
-- אין מדיניות RLS חדשה.
-- =============================================================================

begin;

comment on table public.security_audit_log is
  'יומן ביקורת — פעולות מנהל ורגישות (phase 12+). פעולות phase 14–17: guest_link_*, remote_session_*, sip_token_*, knowledge_*, send_*_sms.';

-- חיפוש לפי סוג משאב (למשל support_session) ביומן ביקורת
create index if not exists idx_security_audit_log_resource
  on public.security_audit_log (resource_type, resource_id, created_at desc);

commit;
