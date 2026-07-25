import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyPassword, signSessionToken } from "@/lib/auth";
import { requireEmail, requireString, ValidationError } from "@/lib/validation";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { withApiLogging } from "@/lib/apiLogger";

export const dynamic = "force-dynamic";

async function handler(request, _ctx, { setPartnerIdForLog }) {
  const ip = getClientIp(request);
  const { allowed, retryAfterMs } = checkRateLimit(`login:${ip}`, { limit: 10, windowMs: 60_000 });
  if (!allowed) {
    return NextResponse.json(
      { success: false, error: "Too many login attempts. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    throw new ValidationError("Invalid JSON body.");
  }

  const email = requireEmail(body?.email);
  const password = requireString(body?.password, "password", { min: 1, max: 200 });

  const { data: partner, error } = await supabaseAdmin
    .from("partners")
    .select("id, name, email, network_code, password_hash, last_sync_at, sync_status")
    .eq("email", email)
    .maybeSingle();

  if (error) throw new Error(`Database error during login: ${error.message}`);

  // Constant-shape response whether the email exists or not, to avoid
  // leaking which emails are registered.
  const isValid = partner?.password_hash ? await verifyPassword(password, partner.password_hash) : false;

  if (!partner || !isValid) {
    return NextResponse.json({ success: false, error: "Incorrect email or password." }, { status: 401 });
  }

  setPartnerIdForLog(partner.id);

  const token = signSessionToken({ role: "partner", partnerId: partner.id });

  return NextResponse.json({
    success: true,
    token,
    partner: {
      id: partner.id,
      name: partner.name,
      email: partner.email,
      networkCode: partner.network_code,
      lastSyncAt: partner.last_sync_at,
      syncStatus: partner.sync_status,
    },
  });
}

export const POST = withApiLogging("/api/auth/login", handler);
