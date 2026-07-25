-- 002_partners_sync_and_auth.sql
-- Adds sync-status tracking to `partners` and migrates plaintext passwords
-- to bcrypt hashes using Postgres' pgcrypto extension.

begin;

create extension if not exists pgcrypto;

alter table public.partners
  add column if not exists last_sync_at timestamptz,
  add column if not exists sync_status text not null default 'idle',
  add column if not exists password_hash text;

alter table public.partners
  drop constraint if exists partners_sync_status_check;
alter table public.partners
  add constraint partners_sync_status_check
  check (sync_status in ('idle', 'running', 'success', 'failed'));

-- One-time migration: hash any existing plaintext passwords with bcrypt
-- (pgcrypto's blowfish crypt() produces standard $2a$ bcrypt hashes, which
-- bcryptjs on the Node side can verify without modification).
update public.partners
set password_hash = crypt(password, gen_salt('bf', 10))
where password_hash is null
  and password is not null
  and password <> '';

-- `password` is kept for now so this migration is non-destructive, but the
-- application no longer reads or writes it after this release — every
-- login and partner-creation path uses `password_hash`. Once you've
-- confirmed all partners can log in, run 002b_drop_plaintext_password.sql
-- to remove the column entirely.
comment on column public.partners.password is 'DEPRECATED: superseded by password_hash. Safe to drop once verified (see 002b_drop_plaintext_password.sql).';
comment on column public.partners.password_hash is 'bcrypt hash, set via pgcrypto crypt() on migration and via bcryptjs on the application for new/updated passwords.';
comment on column public.partners.last_sync_at is 'Timestamp of the most recently completed Ad Manager sync for this partner.';
comment on column public.partners.sync_status is 'idle | running | success | failed — current state of the last sync attempt.';

create index if not exists partners_email_idx on public.partners (email);

commit;
