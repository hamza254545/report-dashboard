import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdminSession } from "@/lib/auth";
import { ValidationError } from "@/lib/validation";
import { withApiLogging } from "@/lib/apiLogger";

export const dynamic = "force-dynamic";

const ALLOWED_KEYS = new Set([
  "auto_sync_enabled",
  "hourly_sync_enabled",
  "daily_sync_enabled",
  "default_lookback_days",
  "sync_retry_attempts",
]);

async function getHandler(request) {
  if (!requireAdminSession(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin.from("settings").select("key, value, updated_at");
  if (error) throw new Error(`Failed to load settings: ${error.message}`);

  const settings = {};
  for (const row of data || []) settings[row.key] = row.value;

  return NextResponse.json({ success: true, settings });
}

async function putHandler(request) {
  if (!requireAdminSession(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    throw new ValidationError("Invalid JSON body.");
  }

  const entries = Object.entries(body || {}).filter(([key]) => ALLOWED_KEYS.has(key));
  if (!entries.length) {
    throw new ValidationError(`No valid settings keys provided. Allowed: ${[...ALLOWED_KEYS].join(", ")}`);
  }

  const rows = entries.map(([key, value]) => ({ key, value, updated_at: new Date().toISOString() }));

  const { error } = await supabaseAdmin.from("settings").upsert(rows, { onConflict: "key" });
  if (error) throw new Error(`Failed to update settings: ${error.message}`);

  return NextResponse.json({ success: true });
}

export const GET = withApiLogging("/api/admin/settings", getHandler);
export const PUT = withApiLogging("/api/admin/settings", putHandler);
