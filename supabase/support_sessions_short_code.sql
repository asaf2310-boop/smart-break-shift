-- קוד קצר לקישורי אורח (/j/ABC123) — הרץ ב-Supabase SQL Editor (פעם אחת).
-- נדרש לפתרון קישורים ממכשירים חיצוניים (טלפון / דפדפן אחר).
alter table support_sessions
  add column if not exists short_code text;

create unique index if not exists idx_support_sessions_short_code
  on support_sessions(short_code)
  where short_code is not null;

create index if not exists idx_support_sessions_short_code_lookup
  on support_sessions(short_code)
  where short_code is not null and status = 'active';
