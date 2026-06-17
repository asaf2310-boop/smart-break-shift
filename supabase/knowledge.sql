-- =============================================================================
-- בסיס ידע AI — מסמכים + אינדקס RAG משותף לכל הנציגים
-- =============================================================================
-- הרץ ב-Supabase → SQL Editor (idempotent)
-- דורש: VITE_KNOWLEDGE_ENABLED=true + OPENAI_API_KEY ב-Vercel
-- =============================================================================

create table if not exists knowledge_documents (
  id text primary key,
  title text not null,
  category text not null default 'כללי',
  content text not null,
  source_type text,
  file_name text,
  pages jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists knowledge_index (
  id text primary key default 'default',
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

comment on table knowledge_documents is 'מסמכי בסיס ידע — ניהול מ-/admin/knowledge';
comment on table knowledge_index is 'אינדקס קטעים + embeddings ל-RAG — שורה יחידה id=default';

alter table knowledge_documents enable row level security;
alter table knowledge_index enable row level security;

drop policy if exists "anon_all_knowledge_documents" on knowledge_documents;
drop policy if exists "anon_all_knowledge_index" on knowledge_index;

-- מדיניות RLS: security_phase0a → … → security_phase9 (ראה RUN_IN_SUPABASE.sql)

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and tablename = 'knowledge_documents'
    ) then
      alter publication supabase_realtime add table knowledge_documents;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and tablename = 'knowledge_index'
    ) then
      alter publication supabase_realtime add table knowledge_index;
    end if;
  end if;
end $$;
