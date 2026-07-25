# AdStreamHQ Publisher Dashboard

A production-ready Google Ad Manager publisher reporting dashboard built on
Next.js 14 (App Router), Supabase, and Vercel. It automatically imports
performance reports from Google Ad Manager using a service account, and
gives each publisher partner a dashboard of their own revenue, traffic, and
fill metrics — with an admin panel to manage partners, trigger syncs, and
monitor sync health.

## What's in this release

- **Google Ad Manager sync pipeline** (`lib/gamClient.js`,
  `services/gamReportService.js`, `app/api/gam/sync`, `app/api/gam/sync-all`)
  — service-account auth, report job creation, polling, download, parsing,
  and an idempotent UPSERT into Supabase, with retries and full logging.
- **Auto sync** — hourly and daily Vercel Cron jobs
  (`app/api/cron/hourly`, `app/api/cron/daily`), each gated by a
  `settings` toggle and a `CRON_SECRET`.
- **Secure auth** — partner and admin login now go through server-side API
  routes (`app/api/auth/*`) using bcrypt password hashes and signed session
  tokens (JWT via `APP_SECRET`), not client-side Supabase queries.
- **Admin dashboard** (`app/admin`) — Dashboard (sync status, manual sync),
  Partners (CRUD, per-partner sync), Reports (filter + export), Sync Logs
  (paginated history), Settings (auto-sync toggles).
- **Publisher dashboard** (`app/dashboard`) — revenue, impressions, clicks,
  CTR, eCPM, requests, matched requests, fill rate; date range + country +
  device filters; daily/monthly grouping; CSV/Excel/PDF export.
- **Logging** — every sync attempt is recorded in `sync_logs` (status,
  timing, rows inserted/updated/failed); every API request is recorded in
  `api_logs`.
- **Security** — no hardcoded credentials, bcrypt password hashing, input
  validation, per-IP rate limiting on auth/sync endpoints, Supabase Row
  Level Security locked down so only server-side code (service role key)
  can read/write.

## Database migrations

Run the SQL files in `supabase/migrations/` **in order** against your
Supabase project (SQL Editor, or `supabase db push` / your migration tool
of choice):

1. `001_extend_reports.sql` — adds `requests`, `matched_requests`,
   `fill_rate`, `ecpm` to `reports`, plus the unique constraint the sync
   pipeline's UPSERT depends on.
2. `002_partners_sync_and_auth.sql` — adds `last_sync_at`, `sync_status`,
   `password_hash` to `partners`, and bcrypt-hashes any existing plaintext
   passwords via `pgcrypto`.
3. `002b_drop_plaintext_password.sql` — **optional, run manually** once
   you've confirmed every partner can log in with the new hashed
   passwords. Drops the old plaintext `password` column.
4. `003_logging_and_settings.sql` — creates `sync_logs`, `api_logs`, and
   `settings` (seeded with sensible defaults).
5. `004_rls_lockdown.sql` — enables Row Level Security on every table with
   no policies, so the anon/public key has zero access. All reads/writes
   go through API routes using the service role key, which bypasses RLS.

## Environment variables (Vercel)

Set these under **Project Settings → Environment Variables** in Vercel
(see `.env.local.example` for the same list with comments):

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Your Supabase project URL. Not secret. |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-only. Bypasses RLS — never expose to the client. |
| `APP_SECRET` | Yes | Long random string signing session tokens. `openssl rand -hex 32`. |
| `ADMIN_PASSWORD_HASH` | Recommended | bcrypt hash of the admin password. |
| `ADMIN_PASSWORD` | Fallback | Plaintext admin password if you skip hashing it yourself. Set one of `ADMIN_PASSWORD_HASH` / `ADMIN_PASSWORD`. |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | Yes | Full service account JSON key, as a single-line string. |
| `GAM_API_VERSION` | Optional | Defaults to `v202408`. |
| `GAM_APPLICATION_NAME` | Optional | Defaults to `AdStreamHQ`. |
| `CRON_SECRET` | Yes (for auto sync) | Vercel Cron sends this automatically as a Bearer token once set. |

Generate an `ADMIN_PASSWORD_HASH`:

```bash
node -e "console.log(require('bcryptjs').hashSync('your-password-here', 10))"
```

### Google Ad Manager service account setup

1. In Google Cloud Console, create (or reuse) a service account —
   `adstreamhq-reports@adstreamhq-reports.iam.gserviceaccount.com` for this
   project — and generate a JSON key.
2. In Google Ad Manager, go to **Admin → Access & authorization → Users**,
   invite the service account's email as a user, and grant it a role with
   report-running permissions (e.g. "Read-only" or higher).
3. Paste the **entire JSON key file contents** as a single-line string
   into `GOOGLE_SERVICE_ACCOUNT_KEY`.
4. Set each partner's `network_code` (via the admin Partners tab) to the
   Ad Manager network you want to pull their reports from — network code
   `23284530772` for this account.

## Auto sync (Vercel Cron)

`vercel.json` schedules two cron requests:

- `/api/cron/hourly` — every hour, short lookback, only runs if the
  `hourly_sync_enabled` setting is `true` (default: off).
- `/api/cron/daily` — once a day at 03:00 UTC, 30-day lookback for
  reconciliation, runs unless `daily_sync_enabled` is explicitly `false`
  (default: on).

Toggle both from the admin Settings tab. Both endpoints require the
`CRON_SECRET` environment variable — Vercel automatically sends it as
`Authorization: Bearer <CRON_SECRET>` for scheduled invocations once the
variable is set, so no extra configuration is needed beyond setting it.

## Local development

```bash
npm install
cp .env.local.example .env.local   # fill in real values
npm run dev
```

## Deploying to Vercel

1. Push this repository to GitHub/GitLab/Bitbucket and import it into
   Vercel (or run `vercel` from the CLI).
2. Add all environment variables listed above under **Project Settings →
   Environment Variables** (for Production, and Preview if you want cron
   previews to work).
3. Run the SQL migrations against your Supabase project (see above).
4. Deploy. Vercel will pick up `vercel.json`'s cron schedule automatically.
5. Log in at `/` — use the Admin tab first to create partner accounts and
   set their network codes, then trigger a manual sync from the Dashboard
   tab to verify the Ad Manager connection end-to-end.

## Architecture notes

- `lib/gamClient.js` talks to Ad Manager's `ReportService` directly over
  HTTPS/SOAP using an OAuth2 bearer token from the service account (Ad
  Manager's Reporting API has no official Node client). Re-check element
  names against the live WSDL for your `GAM_API_VERSION` before deploying,
  since Google revises the API version quarterly.
- `services/gamReportService.js` owns the end-to-end sync: build the
  report query → run the job → poll for completion → download → parse →
  upsert, each step wrapped in retry-with-backoff, with a `sync_logs` row
  tracking status, timing, and row counts throughout.
- All Supabase access from the browser goes through Next.js API routes
  using the service role key; the anon key is unused and RLS denies it by
  default. Session state in the browser is a signed JWT, not a raw
  database row.
