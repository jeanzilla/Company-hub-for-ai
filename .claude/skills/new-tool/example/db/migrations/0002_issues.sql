-- Issues: things that are broken on the premises or at work, so that someone fixes them.
create table issues (
  id          bigint generated always as identity primary key,
  title       text not null,
  detail      text not null default '',
  status      text not null default 'open' check (status in ('open', 'resolved')),
  created_by  text not null default '',
  created_at  timestamptz not null default now(),
  resolved_by text not null default '',
  resolved_at timestamptz
);
create index issues_status on issues (status, created_at desc);

-- Every new table: RLS enabled and no policies. Only the hub server reads it.
alter table issues enable row level security;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on table issues from anon, authenticated; end if;
end $$;
