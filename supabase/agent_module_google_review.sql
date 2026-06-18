-- מודול דירוג בגוגל (google_review) — הפעלה לכל הנציגים הקיימים
-- הרץ ב-Supabase → SQL Editor (פעם אחת, אחרי agents_users.sql / agents_full_setup.sql)

-- ברירת מחדל לנציגים חדשים
alter table agents
  alter column modules
  set default '["breaks","shifts","training","metrics","remote_support","customer_chat","internal_chat","crm","knowledge","google_review"]'::jsonb;

-- הוספת google_review לכל נציג קיים שחסר לו המודול
update agents
set
  modules = modules || '["google_review"]'::jsonb,
  updated_at = now()
where deleted_at is null
  and not (modules @> '["google_review"]'::jsonb);
