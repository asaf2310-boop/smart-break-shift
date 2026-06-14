-- =============================================================================
-- בסיס ידע AI — pgvector RAG (קטעים + embeddings)
-- =============================================================================
-- הרץ ב-Supabase → SQL Editor אחרי knowledge.sql (idempotent)
-- דורש: OPENAI_API_KEY + SUPABASE_SERVICE_ROLE_KEY ב-Vercel
-- =============================================================================

create extension if not exists vector with schema extensions;

-- עמודות נוספות למסמכים (אם knowledge.sql כבר רץ)
alter table knowledge_documents
  add column if not exists tenant_id text,
  add column if not exists chunk_count integer not null default 0;

comment on column knowledge_documents.tenant_id is 'nullable — לשימוש עתידי multi-tenant';
comment on column knowledge_documents.chunk_count is 'מספר קטעים מאונדקסים ב-knowledge_chunks';

-- קטעי RAG + embedding
create table if not exists knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  tenant_id text,
  document_id text not null references knowledge_documents(id) on delete cascade,
  document_name text not null,
  chunk_text text not null,
  chunk_index integer not null default 0,
  page_number integer,
  section_title text,
  category text,
  embedding extensions.vector(1536),
  created_at timestamptz not null default now()
);

create index if not exists knowledge_chunks_document_id_idx
  on knowledge_chunks (document_id);

create index if not exists knowledge_chunks_tenant_id_idx
  on knowledge_chunks (tenant_id)
  where tenant_id is not null;

-- HNSW לחיפוש cosine (text-embedding-3-small = 1536)
create index if not exists knowledge_chunks_embedding_hnsw_idx
  on knowledge_chunks
  using hnsw (embedding extensions.vector_cosine_ops)
  with (m = 16, ef_construction = 64);

comment on table knowledge_chunks is 'קטעי RAG + embeddings — מקור אמת לחיפוש סמנטי';

-- לוג שאילתות (אופציונלי — לניטור)
create table if not exists knowledge_query_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id text,
  question text not null,
  retrieval_method text,
  retrieved_chunks jsonb not null default '[]'::jsonb,
  model_answer text,
  created_at timestamptz not null default now()
);

comment on table knowledge_query_logs is 'לוג שאילתות בסיס ידע — שאלה, קטעים, תשובה';

-- חיפוש דמיון
create or replace function match_knowledge_chunks(
  query_embedding extensions.vector(1536),
  match_count integer default 5,
  match_threshold float default 0.55,
  filter_tenant_id text default null
)
returns table (
  id uuid,
  tenant_id text,
  document_id text,
  document_name text,
  chunk_text text,
  chunk_index integer,
  page_number integer,
  section_title text,
  category text,
  similarity float
)
language plpgsql
stable
as $$
begin
  return query
  select
    kc.id,
    kc.tenant_id,
    kc.document_id,
    kc.document_name,
    kc.chunk_text,
    kc.chunk_index,
    kc.page_number,
    kc.section_title,
    kc.category,
    (1 - (kc.embedding <=> query_embedding))::float as similarity
  from knowledge_chunks kc
  where kc.embedding is not null
    and (filter_tenant_id is null or kc.tenant_id is null or kc.tenant_id = filter_tenant_id)
    and (1 - (kc.embedding <=> query_embedding)) >= match_threshold
  order by kc.embedding <=> query_embedding
  limit greatest(match_count, 1);
end;
$$;

comment on function match_knowledge_chunks is 'חיפוש קטעים לפי embedding — cosine similarity';

-- RLS
alter table knowledge_chunks enable row level security;
alter table knowledge_query_logs enable row level security;

drop policy if exists "anon_read_knowledge_chunks" on knowledge_chunks;
create policy "anon_read_knowledge_chunks"
  on knowledge_chunks for select using (true);

drop policy if exists "service_all_knowledge_chunks" on knowledge_chunks;
create policy "service_all_knowledge_chunks"
  on knowledge_chunks for all using (true) with check (true);

drop policy if exists "anon_read_knowledge_query_logs" on knowledge_query_logs;
create policy "anon_read_knowledge_query_logs"
  on knowledge_query_logs for select using (true);

drop policy if exists "service_all_knowledge_query_logs" on knowledge_query_logs;
create policy "service_all_knowledge_query_logs"
  on knowledge_query_logs for all using (true) with check (true);

-- Realtime (אופציונלי)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and tablename = 'knowledge_chunks'
    ) then
      alter publication supabase_realtime add table knowledge_chunks;
    end if;
  end if;
end $$;
