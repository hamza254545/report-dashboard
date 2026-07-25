import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdminSession, hashPassword } from "@/lib/auth";
import { requireUuid, requireString, ValidationError } from "@/lib/validation";
import { withApiLogging } from "@/lib/apiLogger";

export const dynamic = "force-dynamic";

const PARTNER_COLUMNS = "id, name, email, network_code, last_sync_at, sync_status, created_at";

async function patchHandler(request, { params }) {
  if (!requireAdminSession(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
  }

  const id = requireUuid(params.id, "id");

  let body;
  try {
    body = await request.json();
  } catch {
    throw new ValidationError("Invalid JSON body.");
  }

  const updates = {};
  if (body?.name !== undefined) updates.name = requireString(body.name, "name", { min: 1, max: 200 });
  if (body?.networkCode !== undefined) {
    updates.network_code = body.networkCode ? requireString(body.networkCode, "networkCode", { min: 1, max: 50 }) : null;
  }
  if (body?.password) {
    updates.password_hash = await hashPassword(requireString(body.password, "password", { min: 8, max: 200 }));
  }

  if (Object.keys(updates).length === 0) {
    throw new ValidationError("No valid fields to update.");
  }

  const { data, error } = await supabaseAdmin
    .from("partners")
    .update(updates)
    .eq("id", id)
    .select(PARTNER_COLUMNS)
    .single();

  if (error) throw new Error(`Failed to update partner: ${error.message}`);

  return NextResponse.json({ success: true, partner: data });
}

async function deleteHandler(request, { params }) {
  if (!requireAdminSession(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
  }

  const id = requireUuid(params.id, "id");

  const { error } = await supabaseAdmin.from("partners").delete().eq("id", id);
  if (error) throw new Error(`Failed to delete partner: ${error.message}`);

  return NextResponse.json({ success: true });
}

export const PATCH = withApiLogging("/api/admin/partners/[id]", patchHandler);
export const DELETE = withApiLogging("/api/admin/partners/[id]", deleteHandler);
