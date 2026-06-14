-- =============================================================================
-- לוח הדרכה + מטא-דאטה למצגות — שיתוף בין כל הנציגים (גם מרשת חיצונית)
-- =============================================================================
-- הרץ ב-Supabase → SQL Editor (idempotent)
-- Realtime: הוסף ל-publication (ראו enable_realtime.sql)
-- PDFים: supabase/training_docs_storage.sql (bucket training-docs, public)
-- =============================================================================

create table if not exists training_schedule_settings (
  id text primary key default 'default',
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists training_presentation_meta (
  id text primary key,
  meta jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

comment on table training_schedule_settings is
  'שינויי לוח הדרכה (מפגשים, תאריך התחלה) — שורה יחידה id=default';
comment on table training_presentation_meta is
  'קישורים חיצוניים ומיקום PDF ב-Supabase Storage — id = session_id';

alter table training_schedule_settings enable row level security;
alter table training_presentation_meta enable row level security;

drop policy if exists "anon_all_training_schedule_settings" on training_schedule_settings;
create policy "anon_all_training_schedule_settings"
  on training_schedule_settings for all using (true) with check (true);

drop policy if exists "anon_all_training_presentation_meta" on training_presentation_meta;
create policy "anon_all_training_presentation_meta"
  on training_presentation_meta for all using (true) with check (true);

-- Realtime (בטוח להרצה חוזרת)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and tablename = 'training_schedule_settings'
    ) then
      alter publication supabase_realtime add table training_schedule_settings;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and tablename = 'training_presentation_meta'
    ) then
      alter publication supabase_realtime add table training_presentation_meta;
    end if;
  end if;
end $$;
