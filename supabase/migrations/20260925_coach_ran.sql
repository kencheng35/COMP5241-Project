begin;
alter table public.forge_requests add column if not exists coach_count integer not null default 0;
create or replace function public.forge_claim_coach_request(request_user uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare used integer;
begin
  delete from public.forge_requests where day < current_date;
  insert into public.forge_requests(user_id, day, count, coach_count) values(request_user, current_date, 0, 1)
  on conflict(user_id, day) do update set coach_count = forge_requests.coach_count + 1
  where forge_requests.coach_count < 15 returning coach_count into used;
  return used is not null;
end;
$$;
revoke all on function public.forge_claim_coach_request(uuid) from public, anon, authenticated;
grant execute on function public.forge_claim_coach_request(uuid) to service_role;
commit;