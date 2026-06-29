-- פיצול מודול knowledge ל-knowledge_chat (שאל את הידע) + knowledge_guide (מדריך תשלומים)
-- הרץ ב-Supabase → SQL Editor (פעם אחת)

-- ברירת מחדל לנציגים חדשים
alter table agents
  alter column modules
  set default '["breaks","shifts","training","metrics","remote_support","customer_chat","internal_chat","crm","knowledge_chat","knowledge_guide","google_review"]'::jsonb;

-- המרת knowledge ישן לשני המודולים החדשים
update agents
set
  modules = (
    select coalesce(jsonb_agg(distinct value order by value), '[]'::jsonb)
    from (
      select elem as value
      from jsonb_array_elements_text(modules) elem
      where elem <> 'knowledge'
      union all
      select 'knowledge_chat'
      where modules @> '["knowledge"]'::jsonb
      union all
      select 'knowledge_guide'
      where modules @> '["knowledge"]'::jsonb
    ) expanded
  ),
  updated_at = now()
where deleted_at is null
  and modules @> '["knowledge"]'::jsonb;

-- הוספת המודולים החדשים לנציגים שכבר יש להם מודולים אחרים אך חסרים החדשים (אופציונלי — רק אם רוצים להפעיל לכולם)
-- update agents set modules = modules || '["knowledge_chat","knowledge_guide"]'::jsonb, updated_at = now()
-- where deleted_at is null and not (modules @> '["knowledge_chat"]'::jsonb);
