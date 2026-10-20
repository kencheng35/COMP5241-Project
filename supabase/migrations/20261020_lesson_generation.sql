begin;

create function public.forge_generation_text(v jsonb, lo integer, hi integer) returns boolean
language sql immutable set search_path = pg_catalog as $$
  select coalesce(jsonb_typeof(v) = 'string' and char_length(btrim(v #>> '{}')) between lo and hi, false)
$$;
create function public.forge_generation_selection(v jsonb) returns boolean
language plpgsql immutable set search_path = pg_catalog, public as $$
declare m jsonb; x jsonb; topic text;
begin
  if jsonb_typeof(v) <> 'object' or (select count(*) from jsonb_object_keys(v)) <> 2 then return false; end if;
  m := v->'metadata'; topic := m->>'topic';
  if jsonb_typeof(m) <> 'object' or (select count(*) from jsonb_object_keys(m)) <> 6 or
    not (m ?& array['version','audience','difficulty','topic','outcomes','prerequisites']) or
    m->'version' <> '1'::jsonb or m->>'audience' not in ('learners','instructors','both') or
    m->>'difficulty' not in ('new','foundation','intermediate','advanced') then return false; end if;
  if not ((v->>'subject' = 'Software Development Life Cycle' and topic in ('overview','requirements','design','implementation','testing','deployment','maintenance')) or
    (v->>'subject' = 'AI Coding-Agent Skills' and topic = 'coding-agents') or
    (v->>'subject' = 'Software Development Soft and Product Skills' and topic = 'soft-product')) then return false; end if;
  if jsonb_typeof(m->'outcomes') <> 'array' or jsonb_array_length(m->'outcomes') not between 1 and 8 or
    jsonb_typeof(m->'prerequisites') <> 'array' or jsonb_array_length(m->'prerequisites') > 8 then return false; end if;
  for x in select value from jsonb_array_elements((m->'outcomes') || (m->'prerequisites')) loop
    if not public.forge_generation_text(x,1,240) or (x #>> '{}') ~ '[<>\x00-\x1f]' then return false; end if;
  end loop;
  return coalesce(topic is not null and v->>'subject' is not null and m->>'audience' is not null and m->>'difficulty' is not null, false);
exception when others then return false;
end $$;

create function public.forge_generation_part(parts jsonb, v jsonb) returns boolean
language plpgsql immutable set search_path = pg_catalog, public as $$
declare i integer := jsonb_array_length(parts); n integer; x jsonb; opt jsonb;
begin
  if v is null or jsonb_typeof(v) <> 'object' or octet_length(v::text) > 24000 then return false; end if;
  if i = 0 then
    if (select count(*) from jsonb_object_keys(v)) <> 3 or not (v ?& array['title','summary','plan']) or not public.forge_generation_text(v->'title',3,120) or
      not public.forge_generation_text(v->'summary',10,300) or jsonb_typeof(v->'plan') <> 'array' or
      jsonb_array_length(v->'plan') not between 4 and 6 then return false; end if;
    for x in select value from jsonb_array_elements(v->'plan') loop
      if not public.forge_generation_text(x,1,100) then return false; end if;
    end loop;
  else
    n := jsonb_array_length(parts->0->'plan');
    if i <= n then
      if (select count(*) from jsonb_object_keys(v)) <> 3 or not (v ?& array['title','body','example']) or not public.forge_generation_text(v->'title',1,100) or
        not public.forge_generation_text(v->'body',1,400) or not public.forge_generation_text(v->'example',1,240) or
        cardinality(regexp_split_to_array(btrim(v->>'body'), '\s+')) > 60 then return false; end if;
    elsif i = n + 1 then
      if (select count(*) from jsonb_object_keys(v)) <> 2 or not (v ?& array['prompt','steps']) or not public.forge_generation_text(v->'prompt',1,240) or
        jsonb_typeof(v->'steps') <> 'array' or jsonb_array_length(v->'steps') not between 3 and 6 then return false; end if;
      for x in select value from jsonb_array_elements(v->'steps') loop
        if not public.forge_generation_text(x,1,120) then return false; end if;
      end loop;
    elsif i in (n + 2, n + 3) then
      if (select count(*) from jsonb_object_keys(v)) <> 1 or not (v ? 'questions') or jsonb_typeof(v->'questions') <> 'array' or jsonb_array_length(v->'questions') <> 5 then return false; end if;
      for x in select value from jsonb_array_elements(v->'questions') loop
        if jsonb_typeof(x) <> 'object' or (select count(*) from jsonb_object_keys(x)) <> 4 or not (x ?& array['prompt','explanation','options','correct']) or
          not public.forge_generation_text(x->'prompt',1,300) or not public.forge_generation_text(x->'explanation',1,400) or
          jsonb_typeof(x->'options') <> 'array' or jsonb_array_length(x->'options') <> 4 or
          jsonb_typeof(x->'correct') <> 'number' or x->>'correct' !~ '^[0-3]$' then return false; end if;
        if (select count(distinct lower(btrim(value #>> '{}'))) from jsonb_array_elements(x->'options')) <> 4 then return false; end if;
        for opt in select value from jsonb_array_elements(x->'options') loop
          if not public.forge_generation_text(opt,1,200) then return false; end if;
        end loop;
      end loop;
    else return false;
    end if;
  end if;
  return true;
exception when others then return false;
end $$;

create table public.forge_lesson_generations (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  kind text check (kind in ('studio','import')),
  objective text check (char_length(objective) between 5 and 500),
  selection jsonb check (selection is null or public.forge_generation_selection(selection)),
  source_text text check (char_length(source_text) between 1 and 20000),
  parts jsonb not null default '[]' check (jsonb_typeof(parts) = 'array' and jsonb_array_length(parts) <= 10 and octet_length(parts::text) <= 131072),
  part_count integer generated always as (jsonb_array_length(parts)) stored,
  attempts jsonb not null default '[]' check (jsonb_typeof(attempts) = 'array' and jsonb_array_length(attempts) <= 30 and octet_length(attempts::text) <= 24000),
  revision integer not null default 1 check (revision between 1 and 1000),
  lesson_id uuid,
  created_at timestamptz not null default clock_timestamp(),
  deleted_at timestamptz,
  check ((deleted_at is null and kind is not null and objective is not null and selection is not null) or
    (deleted_at is not null and kind is null and objective is null and selection is null and source_text is null and parts = '[]' and attempts = '[]')),
  check (source_text is null or (kind = 'import' and lesson_id is null))
);
create index forge_generation_owner on public.forge_lesson_generations(owner_id, created_at, id);
alter table public.forge_lesson_generations enable row level security;
revoke all on public.forge_lesson_generations from public, anon, authenticated, service_role;
grant select on public.forge_lesson_generations to service_role;

-- All writes lock the auth owner first, serializing quota, caps, leases and deletion.
-- Deleted rows retain only an owner/id tombstone so ambiguous start acknowledgements
-- can never recreate a deleted draft. Account deletion cascades these too.
create function public.forge_generation_start(p_owner uuid, p_id uuid, p_kind text, p_objective text, p_selection jsonb, p_source text)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare r public.forge_lesson_generations;
begin
  perform id from auth.users where id=p_owner for update;
  if not found then return jsonb_build_object('code','missing'); end if;
  select * into r from public.forge_lesson_generations where id=p_id;
  if found then
    if r.owner_id <> p_owner then return jsonb_build_object('code','missing'); end if;
    if r.deleted_at is not null then return jsonb_build_object('code','deleted'); end if;
    if r.kind = p_kind and r.objective = p_objective and r.selection = p_selection and
      (r.source_text is not distinct from p_source or r.lesson_id is not null) then
      return jsonb_build_object('code','replay','draft',to_jsonb(r));
    end if;
    return jsonb_build_object('code','conflict');
  end if;
  if p_id is null or p_kind is null or p_kind not in ('studio','import') or p_objective is null or
    char_length(p_objective) not between 5 and 500 or p_selection is null or not public.forge_generation_selection(p_selection) or
    (p_source is not null and (p_kind <> 'import' or char_length(p_source) not between 1 and 20000)) then return jsonb_build_object('code','invalid'); end if;
  if (select count(*) from public.forge_lesson_generations where owner_id=p_owner) >= 100 or
    (select count(*) from public.forge_lesson_generations where owner_id=p_owner and lesson_id is null and deleted_at is null) >= 10 then
    return jsonb_build_object('code','limit'); end if;
  if not public.forge_claim_request(p_owner) then return jsonb_build_object('code','quota'); end if;
  insert into public.forge_lesson_generations(id,owner_id,kind,objective,selection,source_text)
    values(p_id,p_owner,p_kind,p_objective,p_selection,p_source) returning * into r;
  return jsonb_build_object('code','ok','draft',to_jsonb(r));
end $$;

create function public.forge_generation_reserve(p_owner uuid, p_id uuid, p_revision integer, p_request uuid, p_token uuid)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare r public.forge_lesson_generations; a jsonb; ats jsonb; moment timestamptz; i integer;
begin
  perform id from auth.users where id=p_owner for update;
  select * into r from public.forge_lesson_generations where id=p_id and owner_id=p_owner for update;
  if not found or r.deleted_at is not null then return jsonb_build_object('code','missing'); end if;
  if p_request is null or p_token is null or p_revision is null then return jsonb_build_object('code','invalid'); end if;
  for a in select value from jsonb_array_elements(r.attempts) loop
    if a->>'request' = p_request::text then
      return jsonb_build_object('code',case when (a->>'revision')::integer=p_revision then 'replay' else 'conflict' end,'draft',to_jsonb(r));
    end if;
  end loop;
  if r.revision <> p_revision or r.lesson_id is not null then return jsonb_build_object('code','conflict'); end if;
  moment := clock_timestamp();
  i := jsonb_array_length(r.parts);
  if i > 0 and i >= jsonb_array_length(r.parts->0->'plan')+4 then return jsonb_build_object('code','conflict'); end if;
  if exists(select 1 from public.forge_lesson_generations f, lateral jsonb_array_elements(f.attempts) x
    where f.owner_id=p_owner and x->>'outcome'='pending' and (x->>'lease')::timestamptz > moment) then return jsonb_build_object('code','busy'); end if;
  if (select count(*) from jsonb_array_elements(r.attempts) x where (x->>'stage')::integer=i) >= 3 then return jsonb_build_object('code','attempts'); end if;
  select coalesce(jsonb_agg(case when value->>'outcome'='pending' then jsonb_set(value,'{outcome}','"expired"') else value end),'[]')
    into ats from jsonb_array_elements(r.attempts);
  ats := ats || jsonb_build_array(jsonb_build_object('request',p_request,'token',p_token,'stage',i,'revision',p_revision,'lease',moment+interval '90 seconds','outcome','pending'));
  update public.forge_lesson_generations set attempts=ats,revision=revision+1 where id=p_id returning * into r;
  return jsonb_build_object('code','ok','draft',to_jsonb(r));
end $$;

create function public.forge_generation_settle(p_owner uuid, p_id uuid, p_token uuid, p_part jsonb)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare r public.forge_lesson_generations; a jsonb; i integer;
begin
  perform id from auth.users where id=p_owner for update;
  select * into r from public.forge_lesson_generations where id=p_id and owner_id=p_owner for update;
  if not found or r.deleted_at is not null then return jsonb_build_object('code','missing'); end if;
  i := jsonb_array_length(r.attempts)-1; a := r.attempts->i;
  if p_token is null or a is null or a->>'token' <> p_token::text or a->>'outcome' <> 'pending' or
    (a->>'lease')::timestamptz <= clock_timestamp() or (a->>'stage')::integer <> jsonb_array_length(r.parts) or
    r.revision <> (a->>'revision')::integer+1 then return jsonb_build_object('code','conflict'); end if;
  if p_part is not null and not public.forge_generation_part(r.parts,p_part) then return jsonb_build_object('code','invalid'); end if;
  update public.forge_lesson_generations set
    parts=case when p_part is null then parts else parts || jsonb_build_array(p_part) end,
    attempts=jsonb_set(attempts,array[i::text,'outcome'],to_jsonb(case when p_part is null then 'failed'::text else 'complete'::text end)),
    revision=revision+1 where id=p_id returning * into r;
  return jsonb_build_object('code','ok','draft',to_jsonb(r));
end $$;

create function public.forge_generation_finalize(p_owner uuid, p_id uuid, p_revision integer)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare r public.forge_lesson_generations; n integer; i integer; prefix jsonb := '[]'; slides jsonb := '[]'; content jsonb;
begin
  perform id from auth.users where id=p_owner for update;
  select * into r from public.forge_lesson_generations where id=p_id and owner_id=p_owner for update;
  if not found or r.deleted_at is not null then return jsonb_build_object('code','missing'); end if;
  if r.lesson_id is not null then return jsonb_build_object('code','replay','draft',to_jsonb(r)); end if;
  if p_revision is null or r.revision <> p_revision or jsonb_array_length(r.parts)=0 then return jsonb_build_object('code','conflict'); end if;
  n := jsonb_array_length(r.parts->0->'plan');
  if jsonb_array_length(r.parts) <> n+4 then return jsonb_build_object('code','invalid'); end if;
  for i in 0..n+3 loop
    if not public.forge_generation_part(prefix,r.parts->i) then return jsonb_build_object('code','invalid'); end if;
    prefix := prefix || jsonb_build_array(r.parts->i);
    if i between 1 and n then slides := slides || jsonb_build_array(r.parts->i); end if;
  end loop;
  content := r.selection || jsonb_build_object('title',r.parts->0->>'title','summary',r.parts->0->>'summary',
    'slides',slides,'activity',r.parts->(n+1),'questions',(r.parts->(n+2)->'questions') || (r.parts->(n+3)->'questions'));
  -- Stable lesson identity and INSERT in the same transaction as completion.
  insert into public.forge_lessons(id,owner_id,title,subject,summary,content,visibility)
    values(r.id,p_owner,content->>'title',content->>'subject',content->>'summary',content,'private');
  update public.forge_lesson_generations set lesson_id=id,source_text=null,revision=revision+1 where id=p_id returning * into r;
  return jsonb_build_object('code','ok','draft',to_jsonb(r));
end $$;

create function public.forge_generation_delete(p_owner uuid, p_id uuid)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  perform id from auth.users where id=p_owner for update;
  update public.forge_lesson_generations set deleted_at=clock_timestamp(),kind=null,objective=null,selection=null,source_text=null,
    parts='[]',attempts='[]',revision=revision+1 where id=p_id and owner_id=p_owner and deleted_at is null;
  return jsonb_build_object('code','ok');
end $$;

revoke all on function public.forge_generation_text(jsonb,integer,integer), public.forge_generation_selection(jsonb),
  public.forge_generation_part(jsonb,jsonb) from public, anon, authenticated, service_role;
revoke all on function public.forge_generation_start(uuid,uuid,text,text,jsonb,text),
  public.forge_generation_reserve(uuid,uuid,integer,uuid,uuid), public.forge_generation_settle(uuid,uuid,uuid,jsonb),
  public.forge_generation_finalize(uuid,uuid,integer), public.forge_generation_delete(uuid,uuid) from public, anon, authenticated;
grant execute on function public.forge_generation_start(uuid,uuid,text,text,jsonb,text),
  public.forge_generation_reserve(uuid,uuid,integer,uuid,uuid), public.forge_generation_settle(uuid,uuid,uuid,jsonb),
  public.forge_generation_finalize(uuid,uuid,integer), public.forge_generation_delete(uuid,uuid) to service_role;
commit;
