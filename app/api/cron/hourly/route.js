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
    console.warn("[cron/hourly] CRON_SECRET is not set — refusing to run an unauthenticated cron endpoint.");
    return false;
  }
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

async function isHourlySyncEnabled() {
  const { data } = await supabaseAdmin.from("settings").select("value").eq("key", "hourly_sync_enabled").maybeSingle();
  return data?.value === true;
}

async function handler(request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
  }

  if (!(await isHourlySyncEnabled())) {
    return NextResponse.json({ success: true, skipped: true, reason: "hourly_sync_enabled is false." });
  }

  const result = await syncAllPartners({ syncType: "hourly" });
  return NextResponse.json({ success: true, data: result });
}

export const GET = withApiLogging("/api/cron/hourly", handler);
