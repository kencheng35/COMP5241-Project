begin;

-- No backfill: historical completion, background, diagnostic and unknown ages
-- remain unknown. Draft rubric/content still requires owner pedagogical review.
alter table public.profiles
  add column onboarding_completed_at timestamptz,
  add column onboarding_background jsonb,
  add column diagnostic_summary jsonb,
  add column learning_setup_revision integer not null default 0;

create function public.forge_valid_background(value jsonb) returns boolean
language plpgsql immutable set search_path = public as $$
declare allowed_experience text[]; allowed_goals text[];
begin
  if value is null then return true; end if;
  if jsonb_typeof(value) <> 'object' or
    (select count(*) from jsonb_object_keys(value)) <> 4 or
    not (value ?& array['version','role','experience','goals']) or
    value->'version' <> '1'::jsonb then return false; end if;
  if exists (select 1 from jsonb_each(value) as fields(k,v) where v = 'null'::jsonb) then return false; end if;
  if value->>'role' = 'learner' then
    allowed_experience := array['starting','coursework','projects'];
    allowed_goals := array['sdlc','agents','teamwork'];
  elsif value->>'role' = 'instructor' then
    allowed_experience := array['new-teaching','teaching','curriculum'];
    allowed_goals := array['scaffold','assessment','feedback'];
  else return false; end if;
  if not (value->>'experience' = any(allowed_experience)) or
    jsonb_typeof(value->'goals') <> 'array' then return false; end if;
  if jsonb_array_length(value->'goals') not between 1 and 3 then return false; end if;
  return (select count(*) = count(distinct goal) and bool_and(goal = any(allowed_goals))
    from jsonb_array_elements_text(value->'goals') as goals(goal));
exception when others then return false;
end;
$$;

create function public.forge_valid_diagnostic(value jsonb) returns boolean
language plpgsql immutable set search_path = public as $$
declare points integer; suggested text; completed timestamptz;
begin
  if value is null then return true; end if;
  if jsonb_typeof(value) <> 'object' or
    (select count(*) from jsonb_object_keys(value)) <> 6 or
    not (value ?& array['rubric_version','role','score','total','suggested_level','completed_at']) or
    value->>'rubric_version' <> 'draft-2026-10-v1' or
    value->>'role' not in ('learner','instructor') or
    jsonb_typeof(value->'score') <> 'number' or
    (value->>'score') !~ '^[0-6]$' or value->'total' <> '6'::jsonb or
    jsonb_typeof(value->'completed_at') <> 'string' or
    (value->>'completed_at') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T.*Z$'
    then return false; end if;
  if exists (select 1 from jsonb_each(value) as fields(k,v) where v = 'null'::jsonb) then return false; end if;
  points := (value->>'score')::integer;
  suggested := case when points <= 1 then 'new' when points <= 3 then 'foundation'
    when points <= 5 then 'intermediate' else 'advanced' end;
  completed := (value->>'completed_at')::timestamptz;
  return value->>'suggested_level' = suggested and completed is not null;
exception when others then return false;
end;
$$;

alter table public.profiles
  add constraint profiles_onboarding_pair check ((onboarding_completed_at is null) = (onboarding_background is null)),
  add constraint profiles_background_valid check (public.forge_valid_background(onboarding_background) is true),
  add constraint profiles_diagnostic_valid check (public.forge_valid_diagnostic(diagnostic_summary) is true),
  add constraint profiles_setup_revision_valid check (learning_setup_revision >= 0);

create function public.forge_bump_learning_setup() returns trigger
language plpgsql set search_path = public as $$
begin
  if row(new.learning_level, new.learning_goals, new.onboarding_completed_at,
      new.onboarding_background, new.diagnostic_summary, new.learning_setup_revision)
    is distinct from row(old.learning_level, old.learning_goals, old.onboarding_completed_at,
      old.onboarding_background, old.diagnostic_summary, old.learning_setup_revision) then
    new.learning_setup_revision := old.learning_setup_revision + 1;
    new.updated_at := now();
  end if;
  return new;
end;
$$;
create trigger forge_learning_setup_revision before update on public.profiles
for each row execute function public.forge_bump_learning_setup();

-- Existing profile RLS continues to scope reads to auth.uid(). Only checked
-- server actions may write completion/summary/revision. Keep ordinary profile
-- columns writable for the existing account form; no role/AI permission changes.
revoke insert, update on public.profiles from public, anon, authenticated;
grant insert (id, display_name, age, age_range, avatar_url, learning_level,
  preferred_subjects, learning_goals, updated_at) on public.profiles to authenticated;
grant update (id, display_name, age, age_range, avatar_url, learning_level,
  preferred_subjects, learning_goals, updated_at) on public.profiles to authenticated;
grant select, update on public.profiles to service_role;

comment on column public.profiles.onboarding_background is
  'Private coarse self-report only; versioned role-specific background/goals. Never grants permissions.';
comment on column public.profiles.diagnostic_summary is
  'Latest local draft-rubric summary only; no raw answers/history. Retaking never changes learning_level.';
comment on column public.profiles.onboarding_completed_at is
  'First confirmed onboarding save, not inferred historical completion.';
comment on column public.profiles.learning_setup_revision is
  'Optimistic concurrency token shared with ordinary profile level/goals edits.';
commit;
