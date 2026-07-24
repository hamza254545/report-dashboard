import Papa from "papaparse";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  getAccessToken,
  runReportJob,
  waitForReportCompletion,
  getReportDownloadUrl,
  downloadReportCsv,
} from "@/lib/gamClient";

const REPORT_DIMENSIONS = ["DATE", "COUNTRY_NAME", "DEVICE_CATEGORY_NAME"];
const REPORT_COLUMNS = ["AD_SERVER_IMPRESSIONS", "AD_SERVER_CLICKS", "AD_SERVER_CPM_AND_CPC_REVENUE"];

function toGamDateParts(dateString) {
  const d = new Date(dateString);
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

  return {
    partner_id: partnerId,
    date: row["Dimension.DATE"],
    country: row["Dimension.COUNTRY_NAME"] || null,
    device: row["Dimension.DEVICE_CATEGORY_NAME"] || null,
    impressions,
    clicks,
    // Computed locally rather than trusting AD_SERVER_CTR's formatting,
    // which can come back as a "1.23%" string depending on report settings.
    ctr: impressions > 0 ? Number(((clicks / impressions) * 100).toFixed(4)) : 0,
    revenue: Number((revenueMicros / 1_000_000).toFixed(2)),
  };
}

async function upsertReports(rows) {
  if (!rows.length) return { written: 0 };

  // Requires a unique constraint on (partner_id, date, country, device) in
  // the `reports` table for the upsert to correctly de-duplicate re-synced
  // date ranges instead of inserting duplicate rows.
  const { error, count } = await supabaseAdmin
    .from("reports")
    .upsert(rows, { onConflict: "partner_id,date,country,device", count: "exact" });

  if (error) {
    throw new Error(`Failed to write reports to Supabase: ${error.message}`);
  }

  return { written: count ?? rows.length };
}

/**
 * Full sync pipeline for one partner: create the report job, wait for it,
 * download + parse the CSV, and upsert rows into Supabase.
 */
export async function syncPartnerReport(partnerId, { startDate, endDate } = {}) {
  if (!partnerId) throw new Error("partnerId is required.");

  const end = endDate || new Date().toISOString().slice(0, 10);
  const start = startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const partner = await fetchPartner(partnerId);
  const accessToken = await getAccessToken();
  const networkCode = partner.network_code;

  const reportQueryXml = buildReportQueryXml(start, end);

  const reportJobId = await runReportJob({ accessToken, networkCode, reportQueryXml });
  await waitForReportCompletion({ accessToken, networkCode, reportJobId });

  const downloadUrl = await getReportDownloadUrl({ accessToken, networkCode, reportJobId });
  const csvText = await downloadReportCsv(downloadUrl);

  const rows = parseReportCsv(csvText)
    .map((row) => normalizeRow(row, partnerId))
    .filter((row) => row.date);

  const { written } = await upsertReports(rows);

  return {
    partnerId,
    networkCode,
    reportJobId,
    dateRange: { start, end },
    rowsProcessed: rows.length,
    rowsWritten: written,
  };
}
