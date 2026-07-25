-- 001_extend_reports.sql
-- Extends the `reports` table with the additional Ad Manager metrics the
-- publisher dashboard needs (requests, matched requests, fill rate, eCPM),
-- and adds the unique constraint the sync pipeline's UPSERT relies on to
-- avoid duplicate rows when a date range is re-synced.

begin;

alter table public.reports
  add column if not exists requests bigint not null default 0,
  add column if not exists matched_requests bigint not null default 0,
  add column if not exists fill_rate numeric(7, 4) not null default 0,
  add column if not exists ecpm numeric(12, 4) not null default 0;

comment on column public.reports.requests is 'Total ad requests reported by Ad Manager (AD_SERVER_AD_REQUESTS).';
comment on column public.reports.matched_requests is 'Ad requests that were matched with an ad (AD_SERVER_MATCHED_REQUESTS).';
comment on column public.reports.fill_rate is 'matched_requests / requests, as a percentage (0-100).';
comment on column public.reports.ecpm is 'revenue / impressions * 1000.';

-- Normalize any existing NULLs before enforcing NOT NULL-safe upserts.
update public.reports set country = 'Unknown' where country is null;
update public.reports set device = 'Unknown' where device is null;

alter table public.reports
  alter column country set default 'Unknown',
  alter column device set default 'Unknown';

-- Required for the sync service's `upsert(..., { onConflict: 'partner_id,date,country,device' })`
-- to correctly de-duplicate re-synced date ranges instead of inserting
-- duplicate rows every time a sync runs.
drop index if exists reports_partner_date_country_device_idx;
alter table public.reports
  drop constraint if exists reports_partner_date_country_device_key;
alter table public.reports
  add constraint reports_partner_date_country_device_key
  unique (partner_id, date, country, device);

create index if not exists reports_partner_id_idx on public.reports (partner_id);
create index if not exists reports_date_idx on public.reports (date);
create index if not exists reports_partner_date_idx on public.reports (partner_id, date);

commit;
