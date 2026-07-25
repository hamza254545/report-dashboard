-- 002b_drop_plaintext_password.sql
-- OPTIONAL, run manually once you've confirmed every partner can log in
-- with password_hash (i.e. after 002_partners_sync_and_auth.sql has run
-- and the app has been deployed for a while with no login issues).
--
-- This is intentionally a separate file rather than part of 002 so the
-- destructive step is never bundled with an automated migration run.

begin;

alter table public.partners
  drop column if exists password;

commit;
