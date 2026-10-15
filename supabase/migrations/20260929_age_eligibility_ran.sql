begin;

alter table public.profiles add column if not exists age integer;
alter table public.profiles add constraint profiles_age_eligibility
  check (age is not null and age between 13 and 120) not valid;
alter table public.profiles add constraint profiles_age_range_consistent
  check (age_range = case
    when age < 18 then '13-17'
    when age < 25 then '18-24'
    when age < 35 then '25-34'
    else '35-plus'
  end) not valid;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  signup_age numeric;
begin
  if jsonb_typeof(new.raw_user_meta_data -> 'age') is distinct from 'number' then
    raise exception 'A numeric whole-number age from 13 to 120 is required for this supervised demo.' using errcode = '23514';
  end if;
  signup_age := (new.raw_user_meta_data ->> 'age')::numeric;
  if signup_age < 13 or signup_age > 120 or signup_age <> trunc(signup_age) then
    raise exception 'A numeric whole-number age from 13 to 120 is required for this supervised demo.' using errcode = '23514';
  end if;
  insert into public.profiles (id, display_name, age, age_range)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', 'Learner'), signup_age::integer,
    case
      when signup_age < 18 then '13-17'
      when signup_age < 25 then '18-24'
      when signup_age < 35 then '25-34'
      else '35-plus'
    end);
  return new;
end;
$$;

commit;