-- הרץ ב-Supabase → SQL Editor
-- פותח רישום הפסקות ל-2 נציגים למשבצת באופן קבוע, כולל היום (שעון ישראל).

-- 1) ברירת מחדל לטבלה — ימים חדשים בלי הגדרה מפורשת
alter table break_settings
  alter column lunch_max_per_slot set default 2;

alter table break_settings
  alter column short_max_per_slot set default 2;

-- 2) טריגר קיבולת — fallback כשאין שורת הגדרות ליום
create or replace function check_break_slot_capacity()
returns trigger
language plpgsql
as $$
declare
  max_slots int;
  current_count int;
begin
  select case new.break_type
    when 'lunch' then coalesce(bs.lunch_max_per_slot, 2)
    when 'short' then coalesce(bs.short_max_per_slot, 2)
    else 2
  end
  into max_slots
  from break_settings bs
  where bs.date = new.date;

  if max_slots is null then
    max_slots := 2;
  end if;

  select count(*)::int
  into current_count
  from break_registrations
  where date = new.date
    and time_slot = new.time_slot
    and break_type = new.break_type;

  if current_count >= max_slots then
    raise exception 'break_slot_full';
  end if;

  return new;
end;
$$;

-- 3) היום + ימים עתידיים: מכסה 2, בלי פופאפ מחסור
update break_settings
set
  lunch_max_per_slot = 2,
  short_max_per_slot = 2,
  show_shortage_notice = false
where date >= ((now() at time zone 'Asia/Jerusalem')::date);

-- 4) ודא שיש שורה להיום (אם חסרה)
insert into break_settings (
  date,
  lunch_max_per_slot,
  short_max_per_slot,
  show_shortage_notice,
  registration_override_open
)
values (
  (now() at time zone 'Asia/Jerusalem')::date,
  2,
  2,
  false,
  false
)
on conflict (date) do update set
  lunch_max_per_slot = excluded.lunch_max_per_slot,
  short_max_per_slot = excluded.short_max_per_slot,
  show_shortage_notice = excluded.show_shortage_notice;
