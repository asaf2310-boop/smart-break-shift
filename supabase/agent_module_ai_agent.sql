-- הוספת מודול ai_agent והסרת knowledge_chat מברירת המחדל (מיגרציה אופציונלית)

-- עדכון ברירת מחדל לנציגים חדשים
alter table agents
  alter column modules
  set default '["breaks","shifts","training","metrics","remote_support","customer_chat","internal_chat","crm","ai_agent","knowledge_guide","google_review"]'::jsonb;

-- מיגרציה לנציגים קיימים: knowledge_chat → ai_agent
update agents
set
  modules = (
    select coalesce(jsonb_agg(distinct elem), '[]'::jsonb)
    from (
      select case
        when elem::text = '"knowledge_chat"' then '"ai_agent"'::jsonb
        else elem
      end as elem
      from jsonb_array_elements(modules) as elem
      where elem::text not in ('"knowledge_chat"')
      union
      select '"ai_agent"'::jsonb
      where modules @> '["knowledge_chat"]'::jsonb
    ) sub
  ),
  updated_at = now()
where deleted_at is null
  and modules @> '["knowledge_chat"]'::jsonb
  and not (modules @> '["ai_agent"]'::jsonb);
