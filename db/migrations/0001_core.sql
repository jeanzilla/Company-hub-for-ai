-- Hub core: people and roles, sessions, tokens to connect an AI, connectors with the secret encrypted,
-- an activity log that cannot be changed, and physical devices with their job queue.
--
-- Only the hub server reads these tables (it connects with DATABASE_URL). Every table has RLS enabled and no
-- policy, so on Supabase the public key sees nothing.

-- ── Roles and people ─────────────────────────────────────────
create table roles (
  slug        text primary key check (slug ~ '^[a-z][a-z0-9_-]{1,39}$'),
  name        text not null,
  description text not null default '',
  permissions text[] not null default '{}',
  is_system   boolean not null default false,
  created_at  timestamptz not null default now()
);

create table people (
  id              uuid primary key default gen_random_uuid(),
  email           text not null unique check (email = lower(email)),
  name            text not null default '',
  role            text not null references roles (slug) on update cascade,
  password_hash   text,                                -- scrypt; null until the person sets a password
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  last_sign_in_at timestamptz
);

insert into roles (slug, name, description, permissions, is_system) values
  ('admin',  'Admin',  'Sees and changes everything: people, roles, connectors and devices.', '{*}', true),
  ('member', 'Member', 'Reads the log and writes to it. Starting point for a new role.', '{log:read,log:write}', false);

-- ── Sign-in ──────────────────────────────────────────────────
-- For the session cookie, the invite links and the tokens, only the SHA-256 fingerprint is stored:
-- whoever reads these tables cannot pass as anyone.
create table sessions (
  id          uuid primary key default gen_random_uuid(),
  person_id   uuid not null references people (id) on delete cascade,
  fingerprint text not null unique,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);
create index sessions_person on sessions (person_id);

-- Single-use link to set the password (a new person or a forgotten password).
create table invites (
  id          uuid primary key default gen_random_uuid(),
  person_id   uuid not null references people (id) on delete cascade,
  fingerprint text not null unique,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  used_at     timestamptz
);

-- Failed sign-ins, to slow down anyone who is guessing passwords.
create table failed_sign_ins (
  id         bigint generated always as identity primary key,
  email      text not null,
  created_at timestamptz not null default now()
);
create index failed_sign_ins_email on failed_sign_ins (email, created_at desc);

-- ── Tokens to connect an AI to the hub MCP ───────────────────
-- "personal": the person creates it in "My AI" and pastes it into their app. "access" and "refresh": the hub
-- issues them over OAuth when the person connects their AI with one click.
create table oauth_clients (
  id            text primary key,
  name          text not null default '',
  redirect_uris text[] not null default '{}',
  created_at    timestamptz not null default now()
);

create table tokens (
  id           uuid primary key default gen_random_uuid(),
  person_id    uuid not null references people (id) on delete cascade,
  kind         text not null default 'personal' check (kind in ('personal', 'access', 'refresh')),
  name         text not null default '',
  prefix       text not null default '',
  fingerprint  text not null unique,
  client_id    text references oauth_clients (id) on delete cascade,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz,
  last_used_at timestamptz,
  revoked_at   timestamptz
);
create index tokens_person on tokens (person_id);

create table oauth_codes (
  fingerprint  text primary key,
  client_id    text not null references oauth_clients (id) on delete cascade,
  person_id    uuid not null references people (id) on delete cascade,
  redirect_uri text not null,
  challenge    text not null,                          -- PKCE S256
  expires_at   timestamptz not null
);

-- ── Connectors ───────────────────────────────────────────────
-- An outside service (accounting, CRM, telephony, shipping...). The secret is stored encrypted with
-- AES-256-GCM (lib/crypto.ts) and never leaves the server: the hub makes the call on behalf of the person.
create table connectors (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique check (slug ~ '^[a-z][a-z0-9_-]{1,39}$'),
  name             text not null,
  description      text not null default '',
  base_url         text not null default '',
  auth_type        text not null default 'none' check (auth_type in ('none', 'bearer', 'header', 'query', 'basic')),
  auth_name        text not null default '',           -- name of the header or of the parameter, depending on auth_type
  secret_encrypted text,
  secret_hint      text not null default '',           -- the last 4 characters, to recognize it on screen
  active           boolean not null default true,
  updated_at       timestamptz not null default now(),
  updated_by       text not null default ''
);

-- ── Log ──────────────────────────────────────────────────────
-- Who did what. The hub writes "usage" by itself on every call from an AI or a device;
-- a person or their AI writes "decision", "change", "project" and "note" to tell the rest of the team.
create table log (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  person_id   uuid references people (id) on delete set null,
  who         text not null default '',                -- name at that moment (kept even if the person is deleted)
  via         text not null check (via in ('web', 'mcp', 'device', 'system')),
  kind        text not null check (kind in ('usage', 'decision', 'change', 'project', 'note')),
  area        text not null default '',
  title       text not null,
  detail      text not null default '',
  tool        text not null default '',
  data        jsonb not null default '{}',
  ok          boolean not null default true
);
create index log_created_at on log (created_at desc);
create index log_person on log (person_id, created_at desc);
create index log_kind on log (kind, created_at desc);

create function log_immutable() returns trigger language plpgsql as $$
begin
  -- The only change allowed: person_id becomes null when the person is deleted (on delete set null).
  if tg_op = 'UPDATE' and new.person_id is null and old.person_id is not null
     and (to_jsonb(new) - 'person_id') = (to_jsonb(old) - 'person_id') then
    return new;
  end if;
  raise exception 'The log cannot be changed or deleted';
end $$;
create trigger log_no_changes before update or delete on log
  for each row execute function log_immutable();
create trigger log_no_truncate before truncate on log
  for each statement execute function log_immutable();

-- ── Physical devices ─────────────────────────────────────────
-- A printer, a card reader, a camera... Behind it runs a small program (devices/agent.mjs) that calls the hub
-- with its key: it sends heartbeats, picks up jobs and sends events. The hub never calls the device.
create table devices (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique check (slug ~ '^[a-z][a-z0-9_-]{1,39}$'),
  name              text not null,
  kind              text not null default 'other',
  location          text not null default '',
  key_prefix        text not null default '',
  key_fingerprint   text not null unique,
  active            boolean not null default true,
  last_heartbeat_at timestamptz,
  status            jsonb not null default '{}',
  created_at        timestamptz not null default now()
);

create table device_jobs (
  id           uuid primary key default gen_random_uuid(),
  device_id    uuid not null references devices (id) on delete cascade,
  kind         text not null,
  payload      jsonb not null default '{}',
  status       text not null default 'pending' check (status in ('pending', 'delivered', 'done', 'error')),
  attempts     int not null default 0,
  requested_by text not null default '',
  result       text not null default '',
  created_at   timestamptz not null default now(),
  delivered_at timestamptz,
  finished_at  timestamptz
);
create index jobs_queue on device_jobs (device_id, status, created_at);

create table device_events (
  id         bigint generated always as identity primary key,
  device_id  uuid not null references devices (id) on delete cascade,
  created_at timestamptz not null default now(),
  kind       text not null,
  data       jsonb not null default '{}'
);
create index events_device on device_events (device_id, created_at desc);

-- Hands out the pending jobs of a device, each one to a single request even if two arrive at the same time.
-- A job delivered and not confirmed within 5 minutes is delivered again, up to 5 times; after that it is set to error.
create function claim_jobs(p_device uuid, p_max int default 10)
returns setof device_jobs language plpgsql as $$
begin
  update device_jobs set status = 'error', finished_at = now(), result = 'Not confirmed after 5 deliveries'
   where device_id = p_device and status = 'delivered'
     and attempts >= 5 and delivered_at < now() - interval '5 minutes';
  return query
    update device_jobs t set status = 'delivered', delivered_at = now(), attempts = t.attempts + 1
     where t.id in (
       select c.id from device_jobs c
        where c.device_id = p_device
          and (c.status = 'pending' or (c.status = 'delivered' and c.delivered_at < now() - interval '5 minutes'))
        order by c.created_at
        limit p_max
        for update skip locked)
    returning t.*;
end $$;

-- ── Lock-down: none of this is visible with the Supabase public key ──
do $$
declare t text;
begin
  foreach t in array array['roles', 'people', 'sessions', 'invites', 'failed_sign_ins', 'oauth_clients',
                           'tokens', 'oauth_codes', 'connectors', 'log',
                           'devices', 'device_jobs', 'device_events'] loop
    execute format('alter table %I enable row level security', t);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on table %I from anon, authenticated', t);
    end if;
  end loop;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke execute on function claim_jobs(uuid, int) from public, anon, authenticated;
  end if;
end $$;
