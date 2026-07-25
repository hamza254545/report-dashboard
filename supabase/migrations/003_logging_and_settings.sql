-- 003_logging_and_settings.sql
-- Adds sync_logs (one row per Ad Manager sync attempt), api_logs (one row
-- per API request, used for auditing + rate-limit visibility), and a
-- generic key/value settings table for auto-sync configuration.

begin;

create table if not exists public.sync_logs (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid references public.partners (id) on delete cascade,
  sync_type text not null default 'manual',
  status text not null default 'running',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  execution_time_ms integer,
  date_range_start date,
  date_range_end date,
  report_job_id text,
  rows_processed integer not null default 0,
  rows_inserted integer not null default 0,
  rows_updated integer not null default 0,
  rows_failed integer not null default 0,
  attempt integer not null default 1,
  error_message text,
  created_at timestamptz not null default now(),
  constraint sync_logs_sync_type_check check (sync_type in ('manual', 'hourly', 'daily', 'retry')),
  constraint sync_logs_status_check check (status in ('running', 'success', 'failed', 'partial'))
);

create index if not exists sync_logs_partner_id_idx on public.sync_logs (partner_id);
create index if not exists sync_logs_started_at_idx on public.sync_logs (started_at desc);
create index if not exists sync_logs_status_idx on public.sync_logs (status);

create table if not exists public.api_logs (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null,
  method text not null,
  status_code integer,
  partner_id uuid references public.partners (id) on delete set null,
  ip_address text,
  user_agent text,
  error_message text,
  duration_ms integer,
  created_at timestamptz not null default now()
);

create index if not exists api_logs_created_at_idx on public.api_logs (created_at desc);
create index if not exists api_logs_endpoint_idx on public.api_logs (endpoint);
create index if not exists api_logs_ip_address_idx on public.api_logs (ip_address);

create table if not exists public.settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.settings (key, value)
values
  ('auto_sync_enabled', 'true'),
  ('hourly_sync_enabled', 'false'),
  ('daily_sync_enabled', 'true'),
  ('default_lookback_days', '7'),
  ('sync_retry_attempts', '3')
on conflict (key) do nothing;

commit;
