import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth";
import { listSyncLogs } from "@/services/syncLogService";
import { isValidUuid } from "@/lib/validation";
import { withApiLogging } from "@/lib/apiLogger";

export const dynamic = "force-dynamic";

async function getHandler(request) {
  if (!requireAdminSession(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const partnerIdParam = searchParams.get("partnerId");
  const partnerId = partnerIdParam && isValidUuid(partnerIdParam) ? partnerIdParam : undefined;
  const limit = Math.min(Number(searchParams.get("limit")) || 50, 200);
  const offset = Math.max(Number(searchParams.get("offset")) || 0, 0);

  const { logs, total } = await listSyncLogs({ partnerId, limit, offset });

  return NextResponse.json({ success: true, logs, total, limit, offset });
}

export const GET = withApiLogging("/api/admin/sync-logs", getHandler);
