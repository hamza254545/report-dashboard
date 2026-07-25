import { NextResponse } from "next/server";
import { syncAllPartners } from "@/services/gamReportService";
import { requireAdminSession } from "@/lib/auth";
import { optionalDate, ValidationError } from "@/lib/validation";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { withApiLogging } from "@/lib/apiLogger";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * POST /api/gam/sync-all
 * Auth: admin session
 * Body: { startDate?, endDate? }
 *
 * Runs syncPartnerReport for every partner with a configured network_code,
 * isolating failures per partner. Used by the admin "Sync All" button and
 * by the hourly/daily cron routes.
 */
async function handler(request) {
  if (!requireAdminSession(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
  }

  const ip = getClientIp(request);
  const { allowed, retryAfterMs } = checkRateLimit(`sync-all:${ip}`, { limit: 3, windowMs: 60_000 });
  if (!allowed) {
    return NextResponse.json(
      { success: false, error: "Too many sync-all requests. Please slow down." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } }
    );
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    // No body is fine — defaults to the standard lookback window.
  }

  const startDate = optionalDate(body?.startDate, "startDate");
  const endDate = optionalDate(body?.endDate, "endDate");

  const result = await syncAllPartners({ startDate, endDate, syncType: "manual" });
  return NextResponse.json({ success: true, data: result });
}

export const POST = withApiLogging("/api/gam/sync-all", handler);
