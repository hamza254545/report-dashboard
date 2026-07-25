"use client";
import { useEffect, useState, useCallback } from "react";
import { ScrollText, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";

const STATUS_COLORS = { running: "#5B8DEF", success: "#2DE1C2", partial: "#FF9F5A", failed: "#FF9F5A" };
const PAGE_SIZE = 25;

export default function SyncLogsTab() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (nextOffset) => {
    setLoading(true);
    setError("");
    try {
      const { logs, total } = await apiFetch(`/api/admin/sync-logs?limit=${PAGE_SIZE}&offset=${nextOffset}`);
      setLogs(logs);
      setTotal(total);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(offset); }, [offset, load]);

  return (
    <div className="card">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ScrollText size={16} color="#2DE1C2" />
          <span style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 600, fontSize: 15 }}>Sync Logs</span>
          {loading && <Loader2 size={14} className="spin" color="#5B6272" />}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button className="btn btn-ghost" onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))} disabled={offset === 0}>
            <ChevronLeft size={14} />
          </button>
          <span style={{ fontSize: 12, color: "#8B93A7" }}>{offset + 1}-{Math.min(offset + PAGE_SIZE, total)} of {total}</span>
          <button className="btn btn-ghost" onClick={() => setOffset((o) => o + PAGE_SIZE)} disabled={offset + PAGE_SIZE >= total}>
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {error && <div style={{ color: "#FF9F5A", fontSize: 13, marginBottom: 12 }}>{error}</div>}

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr style={{ color: "#8B93A7", textAlign: "left" }}>
              {["Started", "Partner", "Type", "Status", "Duration", "Rows +", "Rows ~", "Rows !", "Error"].map((h) => (
                <th key={h} style={{ padding: "6px 10px", borderBottom: "1px solid #1E2430" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} style={{ borderBottom: "1px solid #1E2430" }}>
                <td style={{ padding: "6px 10px", whiteSpace: "nowrap" }}>{new Date(log.started_at).toLocaleString()}</td>
                <td style={{ padding: "6px 10px" }}>{log.partners?.name || "—"}</td>
                <td style={{ padding: "6px 10px" }}>{log.sync_type}</td>
                <td style={{ padding: "6px 10px", color: STATUS_COLORS[log.status] || "#8B93A7", fontWeight: 600 }}>{log.status}</td>
                <td style={{ padding: "6px 10px" }}>{log.execution_time_ms != null ? `${(log.execution_time_ms / 1000).toFixed(1)}s` : "—"}</td>
                <td style={{ padding: "6px 10px" }}>{log.rows_inserted}</td>
                <td style={{ padding: "6px 10px" }}>{log.rows_updated}</td>
                <td style={{ padding: "6px 10px" }}>{log.rows_failed}</td>
                <td style={{ padding: "6px 10px", color: "#FF9F5A", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={log.error_message || ""}>
                  {log.error_message || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!logs.length && !loading && <div style={{ color: "#5B6272", fontSize: 13, marginTop: 12 }}>No sync attempts logged yet.</div>}
      </div>
    </div>
  );
}
