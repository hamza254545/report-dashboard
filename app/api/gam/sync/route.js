import { NextResponse } from "next/server";
import { syncPartnerReport } from "@/services/gamReportService";
import { requireAdminSession } from "@/lib/auth";
import { requireUuid, optionalDate, ValidationError } from "@/lib/validation";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { withApiLogging } from "@/lib/apiLogger";

// This calls out to Google Ad Manager and can take a while (report job
// creation + polling), so make sure it isn't statically optimized/cached.
export const dynamic = "force-dynamic";
export const maxDuration = 300; // seconds — raise your Vercel plan's function timeout to match

/**
 * POST /api/gam/sync
 * Auth: admin session (Authorization: Bearer <admin token>)
 * Body: { partnerId: string, startDate?: "YYYY-MM-DD", endDate?: "YYYY-MM-DD" }
 *
 * Triggers a Google Ad Manager report job for the given partner's network,
 * waits for it to complete, downloads + parses it, and upserts the rows
 * into the Supabase `reports` table. Retries transient failures and writes
 * a sync_logs row with full stats.
 */
async function handler(request, _ctx, { setPartnerIdForLog }) {
  if (!requireAdminSession(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
  }

  const ip = getClientIp(request);
  const { allowed, retryAfterMs } = checkRateLimit(`sync:${ip}`, { limit: 10, windowMs: 60_000 });
  if (!allowed) {
    return NextResponse.json(
      { success: false, error: "Too many sync requests. Please slow down." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    throw new ValidationError("Invalid JSON body.");
  }

  const partnerId = requireUuid(body?.partnerId, "partnerId");
  const startDate = optionalDate(body?.startDate, "startDate");
  const endDate = optionalDate(body?.endDate, "endDate");

  setPartnerIdForLog(partnerId);

  const result = await syncPartnerReport(partnerId, { startDate, endDate, syncType: "manual" });
  return NextResponse.json({ success: true, data: result });
}

export const POST = withApiLogging("/api/gam/sync", handler);
