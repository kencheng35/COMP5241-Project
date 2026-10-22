-- Source migration only: application to any target requires separate authorization.
create table public.forge_reflections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  date date not null check (date between date '0001-01-01' and date '9999-12-31'),
  -- Same Unicode whitespace set as JavaScript String.trim; text stays otherwise unchanged.
  delegation text not null check (char_length(delegation) between 1 and 2000 and btrim(delegation, U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF') <> ''),
  description text not null check (char_length(description) between 1 and 2000 and btrim(description, U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF') <> ''),
  discernment text not null check (char_length(discernment) between 1 and 2000 and btrim(discernment, U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF') <> ''),
  diligence text not null check (char_length(diligence) between 1 and 2000 and btrim(diligence, U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF') <> ''),
  revision integer not null default 1 check (revision between 1 and 2147483647),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, date)
);
create index forge_reflections_history on public.forge_reflections(owner_id, date desc, id desc);
alter table public.forge_reflections enable row level security;
revoke all on table public.forge_reflections from public, anon, authenticated;
grant select, insert, update, delete on table public.forge_reflections to service_role;
-- No browser policies, role-based browsing, AI triggers, awards or progress writes.
