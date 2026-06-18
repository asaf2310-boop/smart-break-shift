-- =============================================================================
-- אינדקס לביצועי סטטיסטיקת SMS לפי נציג (יומן ביקורת phase 12)
-- =============================================================================
-- הרץ אחרי security_phase12_audit_log.sql
-- =============================================================================

create index if not exists idx_security_audit_log_action_actor
  on public.security_audit_log (action, actor_agent_id, created_at desc);
