-- =============================================================================
-- בסיס ידע AI — תמונות/OCR, פערי ידע, משוב
-- =============================================================================
-- הרץ ב-Supabase → SQL Editor אחרי knowledge_pgvector.sql (idempotent)
-- =============================================================================

-- תמונות מ-PDF / העלאות PNG,JPG,WEBP + OCR + embedding
create table if not exists knowledge_images (
  id uuid primary key default gen_random_uuid(),
  tenant_id text,
  document_id text not null references knowledge_documents(id) on delete cascade,
  document_name text not null,
  page_number integer,
  file_name text,
  ocr_text text,
  image_data text,
  storage_url text,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  embedding extensions.vector(1536),
  created_at timestamptz not null default now()
);

create index if not exists knowledge_images_document_id_idx
  on knowledge_images (document_id);

create index if not exists knowledge_images_tenant_id_idx
  on knowledge_images (tenant_id)
  where tenant_id is not null;

create index if not exists knowledge_images_embedding_hnsw_idx
  on knowledge_images
  using hnsw (embedding extensions.vector_cosine_ops)
  with (m = 16, ef_construction = 64);

comment on table knowledge_images is 'תמונות עמוד/PDF + OCR + caption — חיפוש היברידי';

-- שאלות ללא מקור ברור
create table if not exists knowledge_gaps (
  id uuid primary key default gen_random_uuid(),
  tenant_id text,
  question text not null,
  manual_answer text,
  status text not null default 'open',
  confidence float,
  retrieval_method text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists knowledge_gaps_status_idx on knowledge_gaps (status);
create index if not exists knowledge_gaps_tenant_id_idx
  on knowledge_gaps (tenant_id) where tenant_id is not null;

comment on table knowledge_gaps is 'שאלות שלא נמצא להן מקור — מנהל יכול להוסיף תשובה ידנית';

-- משוב נציגים
create table if not exists knowledge_feedback (
  id uuid primary key default gen_random_uuid(),
  tenant_id text,
  question text not null,
  answer text,
  helpful boolean not null,
  confidence float,
  query_log_id uuid,
  created_at timestamptz not null default now()
);

comment on table knowledge_feedback is 'משוב נציג — התשובה עזרה / לא עזרה';

-- חיפוש תמונות לפי embedding
create or replace function match_knowledge_images(
  query_embedding extensions.vector(1536),
  match_count integer default 3,
  match_threshold float default 0.50,
  filter_tenant_id text default null
)
returns table (
  id uuid,
  tenant_id text,
  document_id text,
  document_name text,
  page_number integer,
  file_name text,
  ocr_text text,
  image_data text,
  storage_url text,
  description text,
  metadata jsonb,
  similarity float
)
language plpgsql
stable
as $$
begin
  return query
  select
    ki.id,
    ki.tenant_id,
    ki.document_id,
    ki.document_name,
    ki.page_number,
    ki.file_name,
    ki.ocr_text,
    ki.image_data,
    ki.storage_url,
    ki.description,
    ki.metadata,
    (1 - (ki.embedding <=> query_embedding))::float as similarity
  from knowledge_images ki
  where ki.embedding is not null
    and (filter_tenant_id is null or ki.tenant_id is null or ki.tenant_id = filter_tenant_id)
    and (1 - (ki.embedding <=> query_embedding)) >= match_threshold
  order by ki.embedding <=> query_embedding
  limit greatest(match_count, 1);
end;
$$;

-- חיפוש מילות מפתח בקטעים (ilike — עברית ללא tsvector)
create or replace function search_knowledge_chunks_keyword(
  search_query text,
  match_count integer default 5,
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
  keyword_score float
)
language plpgsql
stable
as $$
declare
  terms text[];
  term text;
begin
  terms := array(
    select lower(trim(t))
    from unnest(regexp_split_to_array(coalesce(search_query, ''), '\s+')) as t
    where length(trim(t)) >= 2
       or trim(t) ~ '^[a-z0-9]{2,8}$'
    limit 8
  );

  if array_length(terms, 1) is null then
    return;
  end if;

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
    (
      select count(*)::float
      from unnest(terms) as t
      where lower(kc.chunk_text) like '%' || t || '%'
         or lower(coalesce(kc.document_name, '')) like '%' || t || '%'
    ) as keyword_score
  from knowledge_chunks kc
  where (filter_tenant_id is null or kc.tenant_id is null or kc.tenant_id = filter_tenant_id)
    and exists (
      select 1 from unnest(terms) as t
      where lower(kc.chunk_text) like '%' || t || '%'
         or lower(coalesce(kc.document_name, '')) like '%' || t || '%'
    )
  order by keyword_score desc, kc.chunk_index
  limit greatest(match_count, 1);
end;
$$;

-- RLS
alter table knowledge_images enable row level security;
alter table knowledge_gaps enable row level security;
alter table knowledge_feedback enable row level security;

drop policy if exists "anon_read_knowledge_images" on knowledge_images;
drop policy if exists "service_all_knowledge_images" on knowledge_images;
drop policy if exists "anon_read_knowledge_gaps" on knowledge_gaps;
drop policy if exists "service_all_knowledge_gaps" on knowledge_gaps;
drop policy if exists "anon_read_knowledge_feedback" on knowledge_feedback;
drop policy if exists "service_all_knowledge_feedback" on knowledge_feedback;

-- מדיניות RLS: security_phase0a → … → security_phase9 (ראה RUN_IN_SUPABASE.sql)
