import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { syncAllPartners } from "@/services/gamReportService";
import { withApiLogging } from "@/lib/apiLogger";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` automatically
// when a CRON_SECRET environment variable is configured — see
// https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs
function isAuthorizedCronRequest(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.warn("[cron/daily] CRON_SECRET is not set — refusing to run an unauthenticated cron endpoint.");
    return false;
  }
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

async function isDailySyncEnabled() {
  const { data } = await supabaseAdmin.from("settings").select("value").eq("key", "daily_sync_enabled").maybeSingle();
  // Defaults to enabled if the setting row is missing, since the daily
  // sync is the primary safety net for catching up any missed data.
  return data?.value !== false;
}

async function handler(request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
  }

  if (!(await isDailySyncEnabled())) {
    return NextResponse.json({ success: true, skipped: true, reason: "daily_sync_enabled is false." });
  }

  // Daily run uses a wider lookback (30 days) to reconcile any late-arriving
  // or revised Ad Manager data, not just yesterday's numbers.
  const endDate = new Date().toISOString().slice(0, 10);
  const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const result = await syncAllPartners({ startDate, endDate, syncType: "daily" });
  return NextResponse.json({ success: true, data: result });
}

export const GET = withApiLogging("/api/cron/daily", handler);
