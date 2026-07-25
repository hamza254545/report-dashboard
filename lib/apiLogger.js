import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getClientIp } from "@/lib/rateLimit";
import { ValidationError } from "@/lib/validation";

/**
 * Fire-and-forget write to api_logs. Never throws — logging failures must
 * not break the request they're logging.
 */
export async function logApiRequest({
  request,
  endpoint,
  statusCode,
  partnerId = null,
  durationMs,
  errorMessage = null,
}) {
  try {
    await supabaseAdmin.from("api_logs").insert([
      {
        endpoint,
        method: request.method,
        status_code: statusCode,
        partner_id: partnerId,
        ip_address: getClientIp(request),
        user_agent: request.headers.get("user-agent") || null,
        duration_ms: durationMs,
        error_message: errorMessage,
      },
    ]);
  } catch (err) {
    console.error("[api_logs] failed to write log entry:", err.message);
  }
}

/**
 * Wraps a route handler with timing, structured error handling, and an
 * api_logs entry for every request. `handler` receives (request, ctx) and
 * should return a NextResponse.
 */
export function withApiLogging(endpoint, handler) {
  return async function wrapped(request, ctx) {
    const startedAt = Date.now();
    let response;
    let errorMessage = null;
    let partnerIdForLog = null;

    try {
      response = await handler(request, ctx, {
        setPartnerIdForLog: (id) => {
          partnerIdForLog = id;
        },
      });
    } catch (error) {
      errorMessage = error.message || "Unknown error";
      const status = error instanceof ValidationError ? error.status : error.status || 500;
      console.error(`[${endpoint}]`, error);
      response = NextResponse.json(
        { success: false, error: status >= 500 ? "Internal server error." : errorMessage },
        { status }
      );
    }

    const durationMs = Date.now() - startedAt;
    await logApiRequest({
      request,
      endpoint,
      statusCode: response.status,
      partnerId: partnerIdForLog,
      durationMs,
      errorMessage,
    });

    return response;
  };
}
