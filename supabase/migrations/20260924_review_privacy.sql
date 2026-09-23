begin;
alter table public.forge_lessons add column if not exists review_requested boolean not null default false;
commit;