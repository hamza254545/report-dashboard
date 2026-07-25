import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Creates a `running` sync_logs row and returns its id. Call
 * finishSyncLog/failSyncLog when the sync completes.
 */
export async function startSyncLog({ partnerId, syncType = "manual", dateRangeStart, dateRangeEnd, attempt = 1 }) {
  const { data, error } = await supabaseAdmin
    .from("sync_logs")
    .insert([
      {
        partner_id: partnerId,
        sync_type: syncType,
        status: "running",
        started_at: new Date().toISOString(),
        date_range_start: dateRangeStart || null,
        date_range_end: dateRangeEnd || null,
        attempt,
      },
    ])
    .select("id")
    .single();

  if (error) {
    // Logging must never block the actual sync — surface a console error
    // and let the caller proceed without a log id.
    console.error("[syncLogService] failed to create sync_logs row:", error.message);
    return null;
  }

  return data.id;
}

export async function completeSyncLog(logId, { status, reportJobId, rowsProcessed, rowsInserted, rowsUpdated, rowsFailed, errorMessage, startedAtMs }) {
  if (!logId) return;

  const finishedAt = new Date();
  const executionTimeMs = startedAtMs ? finishedAt.getTime() - startedAtMs : null;

  const { error } = await supabaseAdmin
    .from("sync_logs")
    .update({
      status,
      finished_at: finishedAt.toISOString(),
      execution_time_ms: executionTimeMs,
      report_job_id: reportJobId || null,
      rows_processed: rowsProcessed ?? 0,
      rows_inserted: rowsInserted ?? 0,
      rows_updated: rowsUpdated ?? 0,
      rows_failed: rowsFailed ?? 0,
      error_message: errorMessage || null,
    })
    .eq("id", logId);

  if (error) {
    console.error("[syncLogService] failed to update sync_logs row:", error.message);
  }
}

export async function listSyncLogs({ partnerId, limit = 50, offset = 0 } = {}) {
  let query = supabaseAdmin
    .from("sync_logs")
    .select("*, partners(name)", { count: "exact" })
    .order("started_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (partnerId) query = query.eq("partner_id", partnerId);

  const { data, error, count } = await query;
  if (error) throw new Error(`Failed to list sync logs: ${error.message}`);
  return { logs: data || [], total: count ?? 0 };
}
