-- הרץ ב-Supabase → SQL Editor
-- 1) מנקה הרשמות כפולות (שומר את הראשונה לכל נציג/יום/סוג)
-- 2) מונע הרשמה כפולה בעתיד

delete from break_registrations
where id in (
  select id
  from (
    select id,
           row_number() over (
             partition by agent_name, date, break_type
             order by created_at nulls last, id
           ) as rn
    from break_registrations
  ) ranked
  where rn > 1
);

create or replace function check_break_agent_not_duplicate()
returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1
    from break_registrations
    where date = new.date
      and break_type = new.break_type
      and lower(trim(regexp_replace(agent_name, '\s+', ' ', 'g')))
        = lower(trim(regexp_replace(new.agent_name, '\s+', ' ', 'g')))
  ) then
    raise exception 'break_agent_already_registered';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_break_registration_unique_agent on break_registrations;
create trigger trg_break_registration_unique_agent
before insert on break_registrations
for each row
execute function check_break_agent_not_duplicate();

create unique index if not exists idx_break_reg_unique_agent_day_type
  on break_registrations (
    lower(trim(regexp_replace(agent_name, '\s+', ' ', 'g'))),
    date,
    break_type
  );
