-- 004_rls_lockdown.sql
-- All reads/writes to partners, reports, sync_logs, api_logs, and settings
-- now go through Next.js API routes using the Supabase service role key,
-- which bypasses RLS. The browser only ever holds the anon key, so we lock
-- every table down to "no anon access" — the API routes are the only path
-- to this data. This also means dropping the direct-from-browser Supabase
-- calls in the old login/admin/dashboard pages (done in this same release).

begin;

alter table public.partners enable row level security;
alter table public.reports enable row level security;
alter table public.sync_logs enable row level security;
alter table public.api_logs enable row level security;
alter table public.settings enable row level security;

-- No policies are created for anon/authenticated roles: with RLS enabled
-- and zero policies, all access from the anon/public key is denied by
-- default. The service role key (used only in server-side code) bypasses
-- RLS entirely, so API routes are unaffected.

commit;
