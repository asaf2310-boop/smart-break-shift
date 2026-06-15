-- =============================================================================
-- מעבר ל-Gemini embeddings — vector(768) במקום OpenAI vector(1536)
-- =============================================================================
-- הרץ ב-Supabase SQL Editor אחרי knowledge_pgvector.sql + knowledge_images_gaps.sql
-- אחרי הרצה: /admin/knowledge → "עיבוד מחדש לכל המסמכים"
-- =============================================================================

-- knowledge_chunks: 1536 → 768
drop index if exists knowledge_chunks_embedding_hnsw_idx;

alter table knowledge_chunks drop column if exists embedding;
alter table knowledge_chunks add column embedding extensions.vector(768);

create index if not exists knowledge_chunks_embedding_hnsw_idx
  on knowledge_chunks
  using hnsw (embedding extensions.vector_cosine_ops)
  with (m = 16, ef_construction = 64);

-- knowledge_images (אם קיים)
drop index if exists knowledge_images_embedding_hnsw_idx;

alter table knowledge_images drop column if exists embedding;
alter table knowledge_images add column embedding extensions.vector(768);

create index if not exists knowledge_images_embedding_hnsw_idx
  on knowledge_images
  using hnsw (embedding extensions.vector_cosine_ops)
  with (m = 16, ef_construction = 64);

-- עדכון RPC match_knowledge_chunks
create or replace function match_knowledge_chunks(
  query_embedding extensions.vector(768),
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

-- עדכון RPC match_knowledge_images (אם קיים)
do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on p.pronamespace = n.oid
    where p.proname = 'match_knowledge_images'
  ) then
    execute $fn$
      create or replace function match_knowledge_images(
        query_embedding extensions.vector(768),
        match_count integer default 3,
        match_threshold float default 0.50,
        filter_tenant_id text default null
      )
      returns table (
        id uuid,
        tenant_id text,
        document_id text,
        document_name text,
        file_name text,
        page_number integer,
        ocr_text text,
        description text,
        image_data text,
        similarity float
      )
      language plpgsql
      stable
      as $body$
      begin
        return query
        select
          ki.id,
          ki.tenant_id,
          ki.document_id,
          ki.document_name,
          ki.file_name,
          ki.page_number,
          ki.ocr_text,
          ki.description,
          ki.image_data,
          (1 - (ki.embedding <=> query_embedding))::float as similarity
        from knowledge_images ki
        where ki.embedding is not null
          and (filter_tenant_id is null or ki.tenant_id is null or ki.tenant_id = filter_tenant_id)
          and (1 - (ki.embedding <=> query_embedding)) >= match_threshold
        order by ki.embedding <=> query_embedding
        limit greatest(match_count, 1);
      end;
      $body$;
    $fn$;
  end if;
end $$;

comment on column knowledge_chunks.embedding is 'Gemini gemini-embedding-001 (768 dims via outputDimensionality)';
