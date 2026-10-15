begin;

-- One bounded, typed row; no browser grants or role-based transcript exceptions.
create function public.forge_interview_turns_valid(v jsonb) returns boolean
language plpgsql immutable set search_path = pg_catalog, public as $$
declare t jsonb; a jsonb; n integer := 0; j integer; ids text[] := '{}'; s text;
begin
  if v is null or jsonb_typeof(v) <> 'array' or jsonb_array_length(v) > 9 or octet_length(v::text) > 131072 then return false; end if;
  for t in select value from jsonb_array_elements(v) loop
    n := n + 1;
    if jsonb_typeof(t) <> 'object' or (select count(*) from jsonb_object_keys(t)) <> 6 or
       not (t ?& array['id','kind','learner','assistant','status','attempts']) then return false; end if;
    perform (t->>'id')::uuid;
    if jsonb_typeof(t->'id') <> 'string' or t->>'id' is null or t->>'id' = any(ids) then return false; end if;
    ids := array_append(ids,t->>'id');
    if jsonb_typeof(t->'kind') <> 'string' or (n = 1 and t->>'kind' <> 'opening') or (n > 1 and t->>'kind' <> 'answer') then return false; end if;
    if n = 1 then
      if t->'learner' <> 'null'::jsonb then return false; end if;
    elsif jsonb_typeof(t->'learner') <> 'string' or char_length(btrim(t->>'learner')) not between 1 and 1200 then return false;
    end if;
    s := t->>'status';
    if s is null or s not in ('pending','failed','complete','cancelled') then return false; end if;
    if s = 'complete' then
      if jsonb_typeof(t->'assistant') <> 'string' or char_length(btrim(t->>'assistant')) not between 1 and 1600 then return false; end if;
    elsif t->'assistant' <> 'null'::jsonb then return false;
    end if;
    if n < jsonb_array_length(v) and s <> 'complete' then return false; end if;
    if jsonb_typeof(t->'attempts') <> 'array' or jsonb_array_length(t->'attempts') not between 1 and 3 then return false; end if;
    j := 0;
    for a in select value from jsonb_array_elements(t->'attempts') loop
      j := j + 1;
      if jsonb_typeof(a) <> 'object' or (select count(*) from jsonb_object_keys(a)) <> 5 or
         not (a ?& array['request_id','token','lease_until','expected_revision','outcome']) then return false; end if;
      perform (a->>'request_id')::uuid, (a->>'token')::uuid, (a->>'lease_until')::timestamptz;
      if jsonb_typeof(a->'request_id') <> 'string' or jsonb_typeof(a->'token') <> 'string' or
         jsonb_typeof(a->'lease_until') <> 'string' or not isfinite((a->>'lease_until')::timestamptz) or
         a->>'request_id' is null or a->>'token' is null or a->>'lease_until' is null or
         a->>'request_id' = any(ids) or a->>'token' = any(ids) or a->>'request_id' = a->>'token' then return false; end if;
      ids := ids || array[a->>'request_id',a->>'token'];
      if jsonb_typeof(a->'expected_revision') <> 'number' or a->>'expected_revision' !~ '^[0-9]+$' or (a->>'expected_revision')::integer not between 1 and 1000 then return false; end if;
      if a->>'outcome' is null or
         (j < jsonb_array_length(t->'attempts') and a->>'outcome' not in ('failed','expired')) or
         (j = jsonb_array_length(t->'attempts') and a->>'outcome' <> s) then return false; end if;
    end loop;
  end loop;
  return true;
exception when others then return false;
end;
$$;

create table public.forge_interviews (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  schema_version integer not null default 1 check (schema_version = 1),
  topic text not null check (topic in ('planning','requirements','design','implementation','testing','deployment','maintenance','delegation','boundaries','verification','prioritization','communication')),
  level text not null check (level in ('new','foundation','intermediate','advanced')),
  state text not null default 'ready' check (state in ('ready','active','completed')),
  revision integer not null default 1 check (revision between 1 and 1000),
  turns jsonb not null default '[]' check (public.forge_interview_turns_valid(turns)),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz,
  check ((state = 'completed') = (completed_at is not null)),
  check (state <> 'ready' or case when jsonb_typeof(turns) = 'array' then jsonb_array_length(turns) = 0 else false end),
  check (state <> 'active' or case when jsonb_typeof(turns) = 'array' then jsonb_array_length(turns) > 0 else false end),
  check (state <> 'completed' or not jsonb_path_exists(turns, '$[*] ? (@.status == "pending")'))
);
create index forge_interviews_owner_history on public.forge_interviews(owner_id, created_at desc, id desc);
alter table public.forge_interviews enable row level security;
revoke all on public.forge_interviews from public, anon, authenticated, service_role;
grant select on public.forge_interviews to service_role;

create function public.forge_interview_create(p_owner uuid, p_id uuid, p_topic text, p_level text)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare r public.forge_interviews;
begin
  -- Serialize owner cap and pending reservations, also interlock account deletion.
  perform id from auth.users where id = p_owner for update;
  if not found then return jsonb_build_object('code','missing'); end if;
  select * into r from public.forge_interviews where id = p_id and owner_id = p_owner;
  if found then
    if r.topic = p_topic and r.level = p_level then return jsonb_build_object('code','ok','interview',to_jsonb(r)); end if;
    return jsonb_build_object('code','conflict');
  end if;
  if (select count(*) from public.forge_interviews where owner_id = p_owner) >= 100 then return jsonb_build_object('code','limit'); end if;
  insert into public.forge_interviews(id,owner_id,topic,level) values(p_id,p_owner,p_topic,p_level) returning * into r;
  return jsonb_build_object('code','ok','interview',to_jsonb(r));
end;
$$;

create function public.forge_interview_reserve(
  p_owner uuid, p_id uuid, p_revision integer, p_request uuid, p_turn uuid,
  p_mode text, p_text text, p_token uuid
) returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare r public.forge_interviews; t jsonb; a jsonb; ts jsonb; ats jsonb; i integer; j integer; moment timestamptz;
begin
  perform id from auth.users where id = p_owner for update;
  select * into r from public.forge_interviews where id = p_id and owner_id = p_owner for update;
  if not found then return jsonb_build_object('code','missing'); end if;
  if p_revision is null or p_revision < 1 or p_request is null or p_turn is null or p_token is null or
     p_mode is null or p_mode not in ('start','answer','retry') or
     (p_mode = 'answer' and (p_text is null or char_length(btrim(p_text)) not between 1 and 1200)) or
     (p_mode <> 'answer' and p_text is not null) then return jsonb_build_object('code','invalid'); end if;
  for t in select value from jsonb_array_elements(r.turns) loop
    j := 0;
    for a in select value from jsonb_array_elements(t->'attempts') loop
      j := j + 1;
      if a->>'request_id' = p_request::text then
        if t->>'id' = p_turn::text and (a->>'expected_revision')::integer = p_revision and
           ((j > 1 and p_mode = 'retry') or (j = 1 and
             ((t->>'kind' = 'opening' and p_mode = 'start') or (t->>'kind' = 'answer' and p_mode = 'answer' and t->>'learner' = p_text)))) then
          return jsonb_build_object('code','replay','interview',to_jsonb(r));
        end if;
        return jsonb_build_object('code','conflict');
      end if;
    end loop;
  end loop;
  if r.revision <> p_revision or r.state = 'completed' then return jsonb_build_object('code','conflict'); end if;
  moment := clock_timestamp();
  ts := r.turns; i := jsonb_array_length(ts) - 1; t := ts->i;
  if exists (select 1 from public.forge_interviews f, lateral jsonb_array_elements(f.turns) x
      where f.owner_id = p_owner and x->>'status' = 'pending' and
      (f.id <> p_id or ((x->'attempts'->-1)->>'lease_until')::timestamptz > moment)) then return jsonb_build_object('code','busy'); end if;
  if p_mode = 'retry' then
    if i < 0 or t->>'id' <> p_turn::text or t->>'status' not in ('pending','failed') then return jsonb_build_object('code','conflict'); end if;
    ats := t->'attempts';
    if jsonb_array_length(ats) >= 3 then return jsonb_build_object('code','limit'); end if;
    if t->>'status' = 'pending' then ats := jsonb_set(ats, array[(jsonb_array_length(ats)-1)::text,'outcome'], '"expired"'); end if;
  else
    if (p_mode = 'start' and (r.state <> 'ready' or i <> -1)) or
       (p_mode = 'answer' and (r.state <> 'active' or i < 0 or t->>'status' <> 'complete')) then return jsonb_build_object('code','conflict'); end if;
    if jsonb_array_length(ts) >= 9 then return jsonb_build_object('code','limit'); end if;
    if exists(select 1 from jsonb_array_elements(ts) x where x->>'id' = p_turn::text) then return jsonb_build_object('code','conflict'); end if;
    ats := '[]';
    t := jsonb_build_object('id',p_turn,'kind',case when p_mode = 'start' then 'opening' else 'answer' end,
      'learner',p_text,'assistant',null,'status','pending','attempts',ats);
    i := i + 1;
  end if;
  -- The quota claim and answer save roll back together on any constraint/error.
  if not public.forge_claim_coach_request(p_owner) then return jsonb_build_object('code','quota'); end if;
  a := jsonb_build_object('request_id',p_request,'token',p_token,'lease_until',moment + interval '75 seconds',
    'expected_revision',p_revision,'outcome','pending');
  t := t || jsonb_build_object('status','pending','attempts',ats || jsonb_build_array(a));
  if p_mode = 'retry' then ts := jsonb_set(ts,array[i::text],t);
  else ts := ts || jsonb_build_array(t); end if;
  update public.forge_interviews set turns = ts, state = 'active', revision = revision + 1, updated_at = moment
    where id = p_id and owner_id = p_owner returning * into r;
  return jsonb_build_object('code','reserved','interview',to_jsonb(r));
end;
$$;

create function public.forge_interview_finalize(p_owner uuid, p_id uuid, p_revision integer, p_token uuid, p_text text)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare r public.forge_interviews; t jsonb; ts jsonb; i integer; j integer; outcome text; moment timestamptz;
begin
  select * into r from public.forge_interviews where id = p_id and owner_id = p_owner for update;
  if not found then return jsonb_build_object('code','stale'); end if;
  moment := clock_timestamp(); i := jsonb_array_length(r.turns)-1; t := r.turns->i;
  if p_revision is null or r.state <> 'active' or r.revision <> p_revision or t->>'status' <> 'pending' or
     t->'attempts'->-1->>'token' <> p_token::text or
     (t->'attempts'->-1->>'lease_until')::timestamptz <= moment or p_token is null then return jsonb_build_object('code','stale'); end if;
  if p_text is not null and char_length(btrim(p_text)) not between 1 and 1600 then return jsonb_build_object('code','invalid'); end if;
  outcome := case when p_text is null then 'failed' else 'complete' end;
  j := jsonb_array_length(t->'attempts')-1;
  t := jsonb_set(t,array['attempts',j::text,'outcome'],to_jsonb(outcome)) ||
    jsonb_build_object('status',outcome,'assistant',p_text);
  ts := jsonb_set(r.turns,array[i::text],t);
  update public.forge_interviews set turns = ts, revision = revision + 1, updated_at = moment,
    state = case when i = 8 and p_text is not null then 'completed' else 'active' end,
    completed_at = case when i = 8 and p_text is not null then moment else null end
    where id = p_id and owner_id = p_owner and revision = p_revision and state = 'active'
      and turns->-1->'attempts'->-1->>'token' = p_token::text
    returning * into r;
  if not found then return jsonb_build_object('code','stale'); end if;
  return jsonb_build_object('code','ok','interview',to_jsonb(r));
end;
$$;

create function public.forge_interview_finish(p_owner uuid, p_id uuid, p_revision integer)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare r public.forge_interviews; t jsonb; ts jsonb; i integer; j integer;
begin
  select * into r from public.forge_interviews where id = p_id and owner_id = p_owner for update;
  if not found then return jsonb_build_object('code','missing'); end if;
  if r.state = 'completed' then return jsonb_build_object('code','ok','interview',to_jsonb(r)); end if;
  if p_revision is null or r.revision <> p_revision then return jsonb_build_object('code','conflict'); end if;
  ts := r.turns; i := jsonb_array_length(ts)-1; t := ts->i;
  if t->>'status' = 'pending' then
    j := jsonb_array_length(t->'attempts')-1;
    t := jsonb_set(t,array['attempts',j::text,'outcome'],'"cancelled"') || '{"status":"cancelled"}'::jsonb;
    ts := jsonb_set(ts,array[i::text],t);
  end if;
  update public.forge_interviews set state = 'completed', turns = ts, completed_at = clock_timestamp(),
    updated_at = clock_timestamp(), revision = revision + 1 where id = p_id and owner_id = p_owner returning * into r;
  return jsonb_build_object('code','ok','interview',to_jsonb(r));
end;
$$;

create function public.forge_interview_delete(p_owner uuid, p_id uuid)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  delete from public.forge_interviews where id = p_id and owner_id = p_owner;
  return jsonb_build_object('code',case when found then 'deleted' else 'missing' end);
end;
$$;

revoke all on function public.forge_interview_turns_valid(jsonb) from public, anon, authenticated;
revoke all on function public.forge_interview_create(uuid,uuid,text,text) from public, anon, authenticated;
revoke all on function public.forge_interview_reserve(uuid,uuid,integer,uuid,uuid,text,text,uuid) from public, anon, authenticated;
revoke all on function public.forge_interview_finalize(uuid,uuid,integer,uuid,text) from public, anon, authenticated;
revoke all on function public.forge_interview_finish(uuid,uuid,integer) from public, anon, authenticated;
revoke all on function public.forge_interview_delete(uuid,uuid) from public, anon, authenticated;
grant execute on function public.forge_interview_turns_valid(jsonb) to service_role;
grant execute on function public.forge_interview_create(uuid,uuid,text,text) to service_role;
grant execute on function public.forge_interview_reserve(uuid,uuid,integer,uuid,uuid,text,text,uuid) to service_role;
grant execute on function public.forge_interview_finalize(uuid,uuid,integer,uuid,text) to service_role;
grant execute on function public.forge_interview_finish(uuid,uuid,integer) to service_role;
grant execute on function public.forge_interview_delete(uuid,uuid) to service_role;
commit;
