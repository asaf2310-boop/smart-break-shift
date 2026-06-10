<<<<<<< HEAD
-- הרץ ב-Supabase → SQL Editor אם כבר הרצת schema.sql בעבר
-- מונע הרשמה למשבצת שכבר מלאה (כולל לחיצות כפולות בו-זמנית)

create or replace function check_break_slot_capacity()
returns trigger
language plpgsql
as $$
declare
  max_slots int;
  current_count int;
begin
  select case new.break_type
    when 'lunch' then coalesce(bs.lunch_max_per_slot, 1)
    when 'short' then coalesce(bs.short_max_per_slot, 1)
    else 1
  end
  into max_slots
  from break_settings bs
  where bs.date = new.date;

  if max_slots is null then
    max_slots := 1;
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

drop trigger if exists trg_break_registration_capacity on break_registrations;
create trigger trg_break_registration_capacity
before insert on break_registrations
for each row
execute function check_break_slot_capacity();
=======
-- הרץ ב-Supabase → SQL Editor אם כבר הרצת schema.sql בעבר
-- מונע הרשמה למשבצת שכבר מלאה (כולל לחיצות כפולות בו-זמנית)

create or replace function check_break_slot_capacity()
returns trigger
language plpgsql
as $$
declare
  max_slots int;
  current_count int;
begin
  select case new.break_type
    when 'lunch' then coalesce(bs.lunch_max_per_slot, 1)
    when 'short' then coalesce(bs.short_max_per_slot, 1)
    else 1
  end
  into max_slots
  from break_settings bs
  where bs.date = new.date;

  if max_slots is null then
    max_slots := 1;
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

drop trigger if exists trg_break_registration_capacity on break_registrations;
create trigger trg_break_registration_capacity
before insert on break_registrations
for each row
execute function check_break_slot_capacity();
>>>>>>> 842dd9e (Initial commit)
