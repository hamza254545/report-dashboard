import Papa from "papaparse";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  getAccessToken,
  runReportJob,
  waitForReportCompletion,
  getReportDownloadUrl,
  downloadReportCsv,
  withRetry,
} from "@/lib/gamClient";
import { startSyncLog, completeSyncLog } from "@/services/syncLogService";

// NOTE: Ad Manager revises its Column/Dimension enums between API versions.
// Verify these identifiers against the ReportService reference for the
// GAM_API_VERSION you're targeting before relying on them in production:
// https://developers.google.com/ad-manager/api/reference/{version}/ReportService.ColumnType
const REPORT_DIMENSIONS = ["DATE", "COUNTRY_NAME", "DEVICE_CATEGORY_NAME"];
const REPORT_COLUMNS = [
  "AD_SERVER_IMPRESSIONS",
  "AD_SERVER_CLICKS",
  "AD_SERVER_CPM_AND_CPC_REVENUE",
  "AD_SERVER_AD_REQUESTS",
  "AD_SERVER_MATCHED_REQUESTS",
];

const DEFAULT_LOOKBACK_DAYS = 7;
const DEFAULT_SYNC_RETRIES = 3;

function toGamDateParts(dateString) {
  const d = new Date(`${dateString}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid date: ${dateString}`);
  }
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

function buildReportQueryXml(startDate, endDate) {
  const start = toGamDateParts(startDate);
  const end = toGamDateParts(endDate);

  const dimensionsXml = REPORT_DIMENSIONS.map((d) => `<dimensions>${d}</dimensions>`).join("");
  const columnsXml = REPORT_COLUMNS.map((c) => `<columns>${c}</columns>`).join("");

  return `${dimensionsXml}${columnsXml}
    <dateRangeType>CUSTOM_DATE</dateRangeType>
    <startDate><year>${start.year}</year><month>${start.month}</month><day>${start.day}</day></startDate>
    <endDate><year>${end.year}</year><month>${end.month}</month><day>${end.day}</day></endDate>`;
}

async function fetchPartner(partnerId) {
  const { data, error } = await supabaseAdmin
    .from("partners")
    .select("id, name, network_code")
    .eq("id", partnerId)
    .single();

  if (error || !data) {
    throw new Error(`Partner ${partnerId} not found.`);
  }
  if (!data.network_code) {
    throw new Error(`Partner ${partnerId} has no Google Ad Manager network_code configured.`);
  }

  return data;
}

async function fetchAllActivePartners() {
  const { data, error } = await supabaseAdmin
    .from("partners")
    .select("id, name, network_code")
    .not("network_code", "is", null);

  if (error) throw new Error(`Failed to list partners: ${error.message}`);
  return data || [];
}

function parseReportCsv(csvText) {
  const { data, errors } = Papa.parse(csvText.trim(), {
    header: true,
    skipEmptyLines: true,
  });

  if (errors && errors.length) {
    throw new Error(`Failed to parse Ad Manager report CSV: ${errors[0].message}`);
  }

  return data;
}

// Ad Manager's CSV_DUMP export prefixes dimension/column headers with
// "Dimension." / "Column." — confirm exact header names against a sample
// export for your account, since custom report templates can vary.
function normalizeRow(row, partnerId) {
  const impressions = Number(row["Column.AD_SERVER_IMPRESSIONS"] || 0);
  const clicks = Number(row["Column.AD_SERVER_CLICKS"] || 0);
  const revenueMicros = Number(row["Column.AD_SERVER_CPM_AND_CPC_REVENUE"] || 0);
  const requests = Number(row["Column.AD_SERVER_AD_REQUESTS"] || 0);
  const matchedRequests = Number(row["Column.AD_SERVER_MATCHED_REQUESTS"] || 0);
  const revenue = Number((revenueMicros / 1_000_000).toFixed(2));

  return {
    partner_id: partnerId,
    date: row["Dimension.DATE"],
    country: row["Dimension.COUNTRY_NAME"] || "Unknown",
    device: row["Dimension.DEVICE_CATEGORY_NAME"] || "Unknown",
    impressions,
    clicks,
    requests,
    matched_requests: matchedRequests,
    // Computed locally rather than trusting formatted percentage columns,
    // which can come back as "1.23%" strings depending on report settings.
    ctr: impressions > 0 ? Number(((clicks / impressions) * 100).toFixed(4)) : 0,
    fill_rate: requests > 0 ? Number(((matchedRequests / requests) * 100).toFixed(4)) : 0,
    ecpm: impressions > 0 ? Number(((revenue / impressions) * 1000).toFixed(4)) : 0,
    revenue,
  };
}

async function upsertReports(rows) {
  if (!rows.length) return { inserted: 0, updated: 0, failed: 0 };

  // Find which (partner_id, date, country, device) keys already exist so we
  // can report accurate inserted-vs-updated counts (upsert alone doesn't
  // tell you which rows were new).
  const partnerId = rows[0].partner_id;
  const dates = [...new Set(rows.map((r) => r.date))];

  const { data: existingRows, error: existingError } = await supabaseAdmin
    .from("reports")
    .select("date, country, device")
    .eq("partner_id", partnerId)
    .in("date", dates);

  if (existingError) {
    throw new Error(`Failed to check existing reports: ${existingError.message}`);
  }

  const existingKeys = new Set((existingRows || []).map((r) => `${r.date}|${r.country}|${r.device}`));

  let inserted = 0;
  let updated = 0;
  const failedRows = [];

  // Requires a unique constraint on (partner_id, date, country, device) in
  // the `reports` table (see supabase/migrations/001_extend_reports.sql).
  const CHUNK_SIZE = 500;
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    const { error } = await supabaseAdmin
      .from("reports")
      .upsert(chunk, { onConflict: "partner_id,date,country,device" });

    if (error) {
      console.error("[gamReportService] upsert chunk failed:", error.message);
      failedRows.push(...chunk);
      continue;
    }

    for (const row of chunk) {
      const key = `${row.date}|${row.country}|${row.device}`;
      if (existingKeys.has(key)) updated += 1;
      else inserted += 1;
    }
  }

  return { inserted, updated, failed: failedRows.length };
}

/**
 * Core sync pipeline for one partner (single attempt, no retry/logging —
 * see syncPartnerReport for the wrapped, production entry point).
 */
async function runSyncOnce({ partnerId, startDate, endDate }) {
  const partner = await fetchPartner(partnerId);
  const accessToken = await getAccessToken();
  const networkCode = partner.network_code;

  const reportQueryXml = buildReportQueryXml(startDate, endDate);

  const reportJobId = await withRetry(
    () => runReportJob({ accessToken, networkCode, reportQueryXml }),
    { label: `runReportJob(partner=${partnerId})` }
  );

  await withRetry(
    () => waitForReportCompletion({ accessToken, networkCode, reportJobId }),
    { retries: 2, label: `waitForReportCompletion(job=${reportJobId})` }
  );

  const downloadUrl = await withRetry(
    () => getReportDownloadUrl({ accessToken, networkCode, reportJobId }),
    { label: `getReportDownloadUrl(job=${reportJobId})` }
  );

  const csvText = await withRetry(() => downloadReportCsv(downloadUrl), {
    label: `downloadReportCsv(job=${reportJobId})`,
  });

  const rows = parseReportCsv(csvText)
    .map((row) => normalizeRow(row, partnerId))
    .filter((row) => row.date);

  const { inserted, updated, failed } = await upsertReports(rows);

  return {
    partnerId,
    partnerName: partner.name,
    networkCode,
    reportJobId,
    rowsProcessed: rows.length,
    rowsInserted: inserted,
    rowsUpdated: updated,
    rowsFailed: failed,
  };
}

/**
 * Full sync pipeline for one partner: create the report job, wait for it,
 * download + parse the CSV, and upsert rows into Supabase — with retries,
 * sync_logs tracking, execution timing, and partner sync_status updates.
 */
export async function syncPartnerReport(partnerId, { startDate, endDate, syncType = "manual" } = {}) {
  if (!partnerId) throw new Error("partnerId is required.");

  const end = endDate || new Date().toISOString().slice(0, 10);
  const start =
    startDate || new Date(Date.now() - DEFAULT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const startedAtMs = Date.now();

  await supabaseAdmin.from("partners").update({ sync_status: "running" }).eq("id", partnerId);

  const logId = await startSyncLog({
    partnerId,
    syncType,
    dateRangeStart: start,
    dateRangeEnd: end,
  });

  let lastError = null;

  for (let attempt = 1; attempt <= DEFAULT_SYNC_RETRIES; attempt += 1) {
    try {
      const result = await runSyncOnce({ partnerId, startDate: start, endDate: end });

      await completeSyncLog(logId, {
        status: result.rowsFailed > 0 ? "partial" : "success",
        reportJobId: result.reportJobId,
        rowsProcessed: result.rowsProcessed,
        rowsInserted: result.rowsInserted,
        rowsUpdated: result.rowsUpdated,
        rowsFailed: result.rowsFailed,
        startedAtMs,
      });

      await supabaseAdmin
        .from("partners")
        .update({ sync_status: "success", last_sync_at: new Date().toISOString() })
        .eq("id", partnerId);

      return { ...result, dateRange: { start, end }, attempt };
    } catch (error) {
      lastError = error;
      console.error(`[gamReportService] sync attempt ${attempt}/${DEFAULT_SYNC_RETRIES} failed for partner ${partnerId}:`, error.message);
      if (attempt < DEFAULT_SYNC_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
      }
    }
  }

  await completeSyncLog(logId, {
    status: "failed",
    errorMessage: lastError?.message || "Unknown error",
    startedAtMs,
  });

  await supabaseAdmin.from("partners").update({ sync_status: "failed" }).eq("id", partnerId);

  throw new Error(`Sync failed for partner ${partnerId} after ${DEFAULT_SYNC_RETRIES} attempts: ${lastError?.message}`);
}

/**
 * Syncs every partner that has a network_code configured. Failures for one
 * partner do not stop the others — each is isolated and logged
 * independently. Returns per-partner results plus aggregate stats.
 */
export async function syncAllPartners({ startDate, endDate, syncType = "manual" } = {}) {
  const partners = await fetchAllActivePartners();

  const results = [];
  for (const partner of partners) {
    try {
      const result = await syncPartnerReport(partner.id, { startDate, endDate, syncType });
      results.push({ partnerId: partner.id, partnerName: partner.name, success: true, ...result });
    } catch (error) {
      results.push({ partnerId: partner.id, partnerName: partner.name, success: false, error: error.message });
    }
  }

  return {
    totalPartners: partners.length,
    succeeded: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    results,
  };
}
