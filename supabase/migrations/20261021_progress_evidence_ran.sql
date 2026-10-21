begin;

-- Keep evidence with its existing owner enrollment: paginated account export
-- already selects *, and both auth-user and lesson deletion already cascade.
-- Empty means unknown, not reviewed. Never backfill historical activity.
alter table public.forge_enrollments
  add column progress_evidence jsonb not null default '{}'::jsonb
  check (jsonb_typeof(progress_evidence) = 'object');

create function public.forge_record_progress(
  request_user uuid, request_lesson uuid, expected_version integer, evidence_kind text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  lesson public.forge_lessons%rowtype;
  enrollment public.forge_enrollments%rowtype;
  evidence jsonb;
  stamp text;
begin
  if evidence_kind not in ('reviewed_at', 'attended_at') or evidence_kind is null then
    raise exception 'Invalid evidence kind';
  end if;
  -- Serialize against edits, unpublishing and deletion. A stale request cannot
  -- acknowledge a newer version or lose an earlier version's evidence.
  select * into lesson from public.forge_lessons where id = request_lesson for share;
  if not found or (lesson.visibility <> 'public' and lesson.owner_id <> request_user) then
    raise exception 'Lesson unavailable';
  end if;
  if expected_version is null or lesson.version <> expected_version then
    raise exception 'Lesson version changed';
  end if;
  select * into enrollment from public.forge_enrollments
    where user_id = request_user and lesson_id = request_lesson for update;
  if not found then raise exception 'Enrollment required'; end if;

  evidence := coalesce(enrollment.progress_evidence -> expected_version::text, '{}'::jsonb);
  -- First acknowledgement wins. Replays (including response loss) are safe.
  stamp := coalesce(evidence ->> evidence_kind, to_jsonb(clock_timestamp()) #>> '{}');
  evidence := evidence || jsonb_build_object(evidence_kind, stamp);
  update public.forge_enrollments set
    progress_evidence = jsonb_set(progress_evidence, array[expected_version::text], evidence),
    attended_at = case when evidence_kind = 'attended_at' then coalesce(attended_at, stamp::timestamptz) else attended_at end,
    attendance_kind = case when evidence_kind = 'attended_at' then coalesce(attendance_kind, lesson.visibility) else attendance_kind end
    where user_id = request_user and lesson_id = request_lesson;
  return jsonb_build_object('version', expected_version, 'reviewedAt', evidence ->> 'reviewed_at', 'attendedAt', evidence ->> 'attended_at');
end;
$$;

-- Browser roles cannot read/write evidence or impersonate an owner via RPC.
-- Application actions derive request_user from fresh authenticated identity.
revoke all on public.forge_enrollments from public, anon, authenticated;
grant select, insert, update, delete on public.forge_enrollments to service_role;
revoke all on function public.forge_record_progress(uuid, uuid, integer, text) from public, anon, authenticated;
grant execute on function public.forge_record_progress(uuid, uuid, integer, text) to service_role;

commit;
