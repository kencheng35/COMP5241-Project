begin;
create table public.forge_resume (
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid not null references public.forge_lessons(id) on delete cascade,
  lesson_version integer not null check (lesson_version > 0),
  revision integer not null default 1 check (revision > 0),
  stage text not null check (stage in ('slides', 'activity', 'quiz')),
  slide integer not null check (slide >= 0),
  ordering integer[] not null,
  answers integer[] not null check (array_length(answers, 1) = 10),
  updated_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);
alter table public.forge_resume enable row level security;
revoke all on public.forge_resume from anon, authenticated;
commit;