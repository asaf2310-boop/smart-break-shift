-- Random PeerJS id for agent (guest calls agent_peer_id, not session id).
-- Run once in Supabase → SQL Editor.

alter table support_sessions
  add column if not exists agent_peer_id text;

create index if not exists idx_support_sessions_agent_peer_id
  on support_sessions(agent_peer_id)
  where agent_peer_id is not null;
