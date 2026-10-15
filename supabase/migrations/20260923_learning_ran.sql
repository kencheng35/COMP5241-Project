begin;

create table if not exists public.forge_lessons (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  subject text not null,
  summary text not null,
  content jsonb not null,
  visibility text not null default 'private' check (visibility in ('private', 'public')),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  check (jsonb_array_length(content -> 'questions') = 10)
);
create table if not exists public.forge_enrollments (
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid not null references public.forge_lessons(id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  attended_at timestamptz,
  primary key (user_id, lesson_id)
);
create table if not exists public.forge_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid not null references public.forge_lessons(id) on delete cascade,
  lesson_title text not null,
  lesson_version integer not null,
  certificate_kind text not null check (certificate_kind in ('private', 'public')),
  answers jsonb not null,
  questions jsonb not null,
  score integer not null check (score between 0 and 10),
  completed_at timestamptz not null default now(),
  check (jsonb_array_length(answers) = 10)
);
create table if not exists public.forge_bookmarks (
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid not null references public.forge_lessons(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);
create table if not exists public.forge_requests (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null default current_date,
  count integer not null default 0,
  primary key (user_id, day)
);
create table if not exists public.forge_reviewers (
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid not null references public.forge_lessons(id) on delete cascade,
  primary key (user_id, lesson_id)
);

alter table public.forge_lessons enable row level security;
alter table public.forge_enrollments enable row level security;
alter table public.forge_attempts enable row level security;
alter table public.forge_bookmarks enable row level security;
alter table public.forge_requests enable row level security;
alter table public.forge_reviewers enable row level security;
revoke all on public.forge_lessons, public.forge_enrollments, public.forge_attempts, public.forge_bookmarks, public.forge_requests, public.forge_reviewers from anon, authenticated;
grant all on public.forge_lessons, public.forge_enrollments, public.forge_attempts, public.forge_bookmarks, public.forge_requests, public.forge_reviewers to service_role;
create index if not exists forge_lessons_visibility on public.forge_lessons(visibility, created_at desc);
create index if not exists forge_lessons_owner on public.forge_lessons(owner_id);
create index if not exists forge_attempts_user on public.forge_attempts(user_id, completed_at desc);
create index if not exists forge_attempts_lesson on public.forge_attempts(lesson_id);

create or replace function public.forge_claim_request(request_user uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare used integer;
begin
  delete from public.forge_requests where day < current_date;
  insert into public.forge_requests(user_id, day, count) values(request_user, current_date, 1)
  on conflict(user_id, day) do update set count = forge_requests.count + 1
  where forge_requests.count < 5 returning count into used;
  return used is not null;
end;
$$;
revoke all on function public.forge_claim_request(uuid) from public, anon, authenticated;
grant execute on function public.forge_claim_request(uuid) to service_role;

commit;