begin;
create table if not exists public.forge_lesson_seen (
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid not null references public.forge_lessons(id) on delete cascade,
  seen_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);
alter table public.forge_lesson_seen enable row level security;
revoke all on public.forge_lesson_seen from anon, authenticated;
grant all on public.forge_lesson_seen to service_role;
commit;
