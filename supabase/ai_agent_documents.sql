-- =============================================================================
-- סוכן AI — בסיס מסמכים (RAG)
-- =============================================================================
-- הרץ ב-Supabase → SQL Editor (idempotent — בטוח להרצה חוזרת)
-- דורש: SUPABASE_SERVICE_ROLE_KEY + OPENAI_API_KEY או GEMINI_API_KEY ב-Vercel
--
-- אחרי ההרצה: PostgREST טוען מחדש את ה-schema cache אוטומטית.
-- אם עדיין מופיעה שגיאה "Could not find the table … in the schema cache":
--   הריצו שוב את השורה האחרונה של קובץ זה (NOTIFY pgrst) או רעננו את דף הניהול.
-- =============================================================================

create extension if not exists vector with schema extensions;

create table if not exists public.ai_agent_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  file_name text,
  file_path text,
  mime_type text,
  content_text text not null default '',
  chunk_count integer not null default 0,
  status text not null default 'ready',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.ai_agent_documents is 'מסמכי ידע לסוכן AI — ניהול מ-/admin/knowledge/ai-agent';
comment on column public.ai_agent_documents.status is 'processing | ready | error';
comment on column public.ai_agent_documents.file_path is 'נתיב ב-bucket ai-agent-docs (אופציונלי)';

create index if not exists ai_agent_documents_created_at_idx
  on public.ai_agent_documents (created_at desc);

create table if not exists public.ai_agent_document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.ai_agent_documents(id) on delete cascade,
  document_title text not null,
  chunk_text text not null,
  chunk_index integer not null default 0,
  section_title text,
  embedding extensions.vector(768),
  created_at timestamptz not null default now()
);

create index if not exists ai_agent_document_chunks_document_id_idx
  on public.ai_agent_document_chunks (document_id);

create index if not exists ai_agent_document_chunks_embedding_hnsw_idx
  on public.ai_agent_document_chunks
  using hnsw (embedding extensions.vector_cosine_ops)
  with (m = 16, ef_construction = 64);

comment on table public.ai_agent_document_chunks is 'קטעי RAG לסוכן AI + embeddings (768 — Gemini / outputDimensionality)';

create or replace function public.match_ai_agent_document_chunks(
  query_embedding extensions.vector(768),
  match_count integer default 5,
  match_threshold float default 0.50
)
returns table (
  id uuid,
  document_id uuid,
  document_title text,
  chunk_text text,
  chunk_index integer,
  section_title text,
  similarity float
)
language plpgsql
stable
as $$
begin
  return query
  select
    c.id,
    c.document_id,
    c.document_title,
    c.chunk_text,
    c.chunk_index,
    c.section_title,
    (1 - (c.embedding <=> query_embedding))::float as similarity
  from public.ai_agent_document_chunks c
  join public.ai_agent_documents d on d.id = c.document_id
  where c.embedding is not null
    and d.status = 'ready'
    and (1 - (c.embedding <=> query_embedding)) >= match_threshold
  order by c.embedding <=> query_embedding
  limit greatest(match_count, 1);
end;
$$;

comment on function public.match_ai_agent_document_chunks is 'חיפוש קטעי מסמכים לסוכן AI — cosine similarity';

-- Storage bucket (private — גישה דרך service role בלבד)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ai-agent-docs',
  'ai-agent-docs',
  false,
  10485760, -- 10 MB
  array[
    'application/pdf',
    'text/plain',
    'text/markdown',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- RLS — גישה רק דרך service role (אין anon/authenticated)
alter table public.ai_agent_documents enable row level security;
alter table public.ai_agent_document_chunks enable row level security;

drop policy if exists "service_all_ai_agent_documents" on public.ai_agent_documents;
drop policy if exists "service_all_ai_agent_document_chunks" on public.ai_agent_document_chunks;
drop policy if exists "anon_all_ai_agent_documents" on public.ai_agent_documents;
drop policy if exists "anon_all_ai_agent_document_chunks" on public.ai_agent_document_chunks;

-- אין מדיניות ל-anon/authenticated — ה-API משתמש ב-SUPABASE_SERVICE_ROLE_KEY (עוקף RLS).

grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on public.ai_agent_documents to service_role;
grant all on public.ai_agent_document_chunks to service_role;
grant execute on function public.match_ai_agent_document_chunks(extensions.vector, integer, float) to service_role;

-- רענון schema cache של PostgREST
notify pgrst, 'reload schema';
