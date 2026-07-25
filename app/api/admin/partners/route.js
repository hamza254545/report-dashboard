import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdminSession } from "@/lib/auth";
import { hashPassword } from "@/lib/auth";
import { requireEmail, requireString, ValidationError } from "@/lib/validation";
import { withApiLogging } from "@/lib/apiLogger";

export const dynamic = "force-dynamic";

const PARTNER_COLUMNS = "id, name, email, network_code, last_sync_at, sync_status, created_at";

async function getHandler(request) {
  if (!requireAdminSession(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("partners")
    .select(PARTNER_COLUMNS)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to list partners: ${error.message}`);

  return NextResponse.json({ success: true, partners: data || [] });
}

async function postHandler(request) {
  if (!requireAdminSession(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    throw new ValidationError("Invalid JSON body.");
  }

  const name = requireString(body?.name, "name", { min: 1, max: 200 });
  const email = requireEmail(body?.email);
  const password = requireString(body?.password, "password", { min: 8, max: 200 });
  const networkCode = body?.networkCode ? requireString(body.networkCode, "networkCode", { min: 1, max: 50 }) : null;

  const { data: existing } = await supabaseAdmin.from("partners").select("id").eq("email", email).maybeSingle();
  if (existing) {
    return NextResponse.json({ success: false, error: "A partner with that email already exists." }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);

  const { data, error } = await supabaseAdmin
    .from("partners")
    .insert([{ name, email, password_hash: passwordHash, network_code: networkCode, sync_status: "idle" }])
    .select(PARTNER_COLUMNS)
    .single();

  if (error) throw new Error(`Failed to create partner: ${error.message}`);

  return NextResponse.json({ success: true, partner: data }, { status: 201 });
}

export const GET = withApiLogging("/api/admin/partners", getHandler);
export const POST = withApiLogging("/api/admin/partners", postHandler);
