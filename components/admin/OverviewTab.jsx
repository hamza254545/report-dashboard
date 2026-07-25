"use client";
import { useEffect, useState, useCallback } from "react";
import { Activity, PlayCircle, Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";

const STATUS_META = {
  idle: { color: "#5B6272", icon: Clock, label: "Idle" },
  running: { color: "#5B8DEF", icon: Loader2, label: "Running" },
  success: { color: "#2DE1C2", icon: CheckCircle2, label: "Success" },
  failed: { color: "#FF9F5A", icon: XCircle, label: "Failed" },
};

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || STATUS_META.idle;
  const Icon = meta.icon;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: meta.color, fontSize: 12.5, fontWeight: 600 }}>
      <Icon size={13} className={status === "running" ? "spin" : ""} /> {meta.label}
    </span>
  );
}

export default function OverviewTab() {
  const [partners, setPartners] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncingAll, setSyncingAll] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ partners }, { logs }] = await Promise.all([
        apiFetch("/api/admin/partners"),
        apiFetch("/api/admin/sync-logs?limit=5"),
      ]);
      setPartners(partners);
      setLogs(logs);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const syncAll = async () => {
    setSyncingAll(true);
    setMessage("");
    try {
      const { data } = await apiFetch("/api/gam/sync-all", { method: "POST", body: JSON.stringify({}) });
      setMessage(`Synced ${data.succeeded}/${data.totalPartners} partners successfully.`);
      await load();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setSyncingAll(false);
    }
  };

  const successCount = partners.filter((p) => p.sync_status === "success").length;
  const failedCount = partners.filter((p) => p.sync_status === "failed").length;
  const runningCount = partners.filter((p) => p.sync_status === "running").length;

  return (
    <div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 20 }}>
        <div className="card" style={{ flex: "1 1 160px" }}>
          <div style={{ color: "#8B93A7", fontSize: 12, marginBottom: 8 }}>PARTNERS</div>
          <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 22 }}>{partners.length}</div>
        </div>
        <div className="card" style={{ flex: "1 1 160px" }}>
          <div style={{ color: "#8B93A7", fontSize: 12, marginBottom: 8 }}>LAST SYNC: SUCCESS</div>
          <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 22, color: "#2DE1C2" }}>{successCount}</div>
        </div>
        <div className="card" style={{ flex: "1 1 160px" }}>
          <div style={{ color: "#8B93A7", fontSize: 12, marginBottom: 8 }}>RUNNING</div>
          <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 22, color: "#5B8DEF" }}>{runningCount}</div>
        </div>
        <div className="card" style={{ flex: "1 1 160px" }}>
          <div style={{ color: "#8B93A7", fontSize: 12, marginBottom: 8 }}>FAILED</div>
          <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 22, color: "#FF9F5A" }}>{failedCount}</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Activity size={16} color="#2DE1C2" />
            <span style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 600, fontSize: 15 }}>Manual Sync</span>
          </div>
          <button className="btn btn-primary" onClick={syncAll} disabled={syncingAll}>
            {syncingAll ? <Loader2 size={14} className="spin" /> : <PlayCircle size={14} />}
            Sync All Partners
          </button>
        </div>
        {message && <div style={{ fontSize: 12.5, color: "#8B93A7" }}>{message}</div>}
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <span style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 600, fontSize: 15 }}>Partner Sync Status</span>
        <div style={{ marginTop: 14 }}>
          {loading && <div style={{ color: "#5B6272", fontSize: 13 }}>Loading…</div>}
          {!loading && partners.length === 0 && <div style={{ color: "#5B6272", fontSize: 13 }}>No partners yet.</div>}
          {partners.map((p) => (
            <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderTop: "1px solid #1E2430" }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{p.name}</div>
                <div style={{ color: "#5B6272", fontSize: 12 }}>
                  {p.last_sync_at ? `Last synced ${new Date(p.last_sync_at).toLocaleString()}` : "Never synced"}
                </div>
              </div>
              <StatusBadge status={p.sync_status} />
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <span style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 600, fontSize: 15 }}>Recent Sync Activity</span>
        <div style={{ marginTop: 14 }}>
          {logs.length === 0 && <div style={{ color: "#5B6272", fontSize: 13 }}>No sync activity yet.</div>}
          {logs.map((log) => (
            <div key={log.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderTop: "1px solid #1E2430" }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{log.partners?.name || "All partners"} · {log.sync_type}</div>
                <div style={{ color: "#5B6272", fontSize: 12 }}>
                  {new Date(log.started_at).toLocaleString()}
                  {log.execution_time_ms != null && ` · ${(log.execution_time_ms / 1000).toFixed(1)}s`}
                  {` · +${log.rows_inserted} / ~${log.rows_updated}${log.rows_failed ? ` / !${log.rows_failed}` : ""}`}
                </div>
              </div>
              <StatusBadge status={log.status === "success" || log.status === "partial" ? "success" : log.status} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
