-- Run this file once in the Supabase SQL editor.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  age_range text not null check (age_range in ('under-13','13-17','18-24','25-34','35-plus')),
  avatar_url text,
  learning_level text default 'foundation',
  preferred_subjects text[] default '{}',
  learning_goals text default '',
  updated_at timestamptz default now()
);
create table public.enrollments (id bigint generated always as identity primary key, user_id uuid not null references auth.users(id) on delete cascade, course_slug text not null, enrolled_at timestamptz default now(), completed_at timestamptz, unique(user_id, course_slug));
create table public.lesson_progress (id bigint generated always as identity primary key, user_id uuid not null references auth.users(id) on delete cascade, course_slug text not null, lesson_slug text not null, progress smallint default 0 check (progress between 0 and 100), completed_at timestamptz, last_activity_at timestamptz default now(), unique(user_id, course_slug, lesson_slug));
create table public.quiz_results (id bigint generated always as identity primary key, user_id uuid not null references auth.users(id) on delete cascade, quiz_slug text not null, score smallint not null, total smallint not null, completed_at timestamptz default now());
create table public.bookmarks (id bigint generated always as identity primary key, user_id uuid not null references auth.users(id) on delete cascade, lesson_slug text not null, created_at timestamptz default now(), unique(user_id, lesson_slug));
create table public.achievements (id bigint generated always as identity primary key, user_id uuid not null references auth.users(id) on delete cascade, achievement_slug text not null, awarded_at timestamptz default now(), certificate_url text, unique(user_id, achievement_slug));

alter table public.profiles enable row level security;
alter table public.enrollments enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.quiz_results enable row level security;
alter table public.bookmarks enable row level security;
alter table public.achievements enable row level security;

create policy "Profiles are private" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "Enrollments are private" on public.enrollments for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Progress is private" on public.lesson_progress for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Quiz results are private" on public.quiz_results for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Bookmarks are private" on public.bookmarks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Achievements are private" on public.achievements for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, age_range)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', 'Learner'), coalesce(new.raw_user_meta_data ->> 'age_range', '18-24'));
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();