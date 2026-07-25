import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { signSessionToken } from "@/lib/auth";
import { requireString, ValidationError } from "@/lib/validation";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { withApiLogging } from "@/lib/apiLogger";

export const dynamic = "force-dynamic";

async function verifyAdminPassword(password) {
  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (hash) {
    return bcrypt.compare(password, hash);
  }

  const plain = process.env.ADMIN_PASSWORD;
  if (plain) {
    return password === plain;
  }

  throw new Error(
    "Server is missing ADMIN_PASSWORD_HASH (preferred) or ADMIN_PASSWORD environment variable."
  );
}

async function handler(request) {
  const ip = getClientIp(request);
  const { allowed, retryAfterMs } = checkRateLimit(`admin-login:${ip}`, { limit: 8, windowMs: 60_000 });
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

  const password = requireString(body?.password, "password", { min: 1, max: 200 });
  const isValid = await verifyAdminPassword(password);

  if (!isValid) {
    return NextResponse.json({ success: false, error: "Incorrect admin password." }, { status: 401 });
  }

  const token = signSessionToken({ role: "admin" });
  return NextResponse.json({ success: true, token });
}

export const POST = withApiLogging("/api/auth/admin-login", handler);
