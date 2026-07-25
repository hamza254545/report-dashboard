import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession } from "@/lib/auth";
import { isValidUuid, validateDateRange, ValidationError } from "@/lib/validation";
import { withApiLogging } from "@/lib/apiLogger";

export const dynamic = "force-dynamic";

const MAX_ROWS = 20_000;

async function handler(request, _ctx, { setPartnerIdForLog }) {
  const session = getSession(request);
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);

  let partnerId;
  if (session.role === "admin") {
    const requested = searchParams.get("partnerId");
    if (requested && !isValidUuid(requested)) throw new ValidationError("partnerId must be a valid UUID.");
    partnerId = requested || null;
  } else {
    partnerId = session.partnerId;
  }

  if (partnerId) setPartnerIdForLog(partnerId);

  const { start, end } = validateDateRange(searchParams.get("startDate"), searchParams.get("endDate"));
  const country = searchParams.get("country") || null;
  const device = searchParams.get("device") || null;

  let query = supabaseAdmin
    .from("reports")
    .select("id, partner_id, date, country, device, impressions, clicks, ctr, revenue, requests, matched_requests, fill_rate, ecpm")
    .order("date", { ascending: true })
    .limit(MAX_ROWS);

  if (partnerId) query = query.eq("partner_id", partnerId);
  if (start) query = query.gte("date", start);
  if (end) query = query.lte("date", end);
  if (country) query = query.eq("country", country);
  if (device) query = query.eq("device", device);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to load reports: ${error.message}`);

  return NextResponse.json({ success: true, reports: data || [] });
}

export const GET = withApiLogging("/api/reports", handler);
