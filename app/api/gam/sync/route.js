import { NextResponse } from "next/server";
import { syncPartnerReport } from "@/services/gamReportService";

// This calls out to Google Ad Manager and can take a while (report job
// creation + polling), so make sure it isn't statically optimized/cached.
export const dynamic = "force-dynamic";
export const maxDuration = 300; // seconds — raise your Vercel plan's function timeout to match

/**
 * POST /api/gam/sync
 * Body: { partnerId: string, startDate?: "YYYY-MM-DD", endDate?: "YYYY-MM-DD" }
 *
 * Triggers a Google Ad Manager report job for the given partner's network,
 * waits for it to complete, downloads + parses it, and upserts the rows
 * into the Supabase `reports` table.
 */
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const { partnerId, startDate, endDate } = body || {};

  if (!partnerId) {
    return NextResponse.json({ success: false, error: "partnerId is required." }, { status: 400 });
  }

  try {
    const result = await syncPartnerReport(partnerId, { startDate, endDate });
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("[GAM SYNC ERROR]", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to sync Ad Manager report." },
      { status: 500 }
    );
  }
}
