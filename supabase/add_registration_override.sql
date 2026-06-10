-- הרץ ב-Supabase → SQL Editor (פעם אחת) אם הטבלה כבר קיימת ללא העמודה
alter table break_settings
  add column if not exists registration_override_open boolean default false;
