"use client";
import { useEffect, useState, useCallback } from "react";
import { Settings as SettingsIcon, Save, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";

const FIELDS = [
  { key: "auto_sync_enabled", label: "Auto sync enabled", type: "boolean", help: "Master switch — turns both hourly and daily cron syncs off when disabled." },
  { key: "hourly_sync_enabled", label: "Hourly sync", type: "boolean", help: "Runs a short-lookback sync for every partner once an hour." },
  { key: "daily_sync_enabled", label: "Daily sync", type: "boolean", help: "Runs a 30-day reconciliation sync for every partner once a day." },
  { key: "default_lookback_days", label: "Default lookback (days)", type: "number", help: "Used when a manual sync doesn't specify a date range." },
  { key: "sync_retry_attempts", label: "Sync retry attempts", type: "number", help: "How many times a failed sync is retried before being marked failed." },
];

export default function SettingsTab() {
  const [values, setValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { settings } = await apiFetch("/api/admin/settings");
      setValues(settings);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await apiFetch("/api/admin/settings", { method: "PUT", body: JSON.stringify(values) });
      setMessage("Settings saved.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="card" style={{ color: "#5B6272", fontSize: 13 }}>Loading…</div>;

  return (
    <div className="card" style={{ maxWidth: 560 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
        <SettingsIcon size={16} color="#2DE1C2" />
        <span style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 600, fontSize: 15 }}>Sync Settings</span>
      </div>

      {FIELDS.map((field) => (
        <div key={field.key} style={{ marginBottom: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{field.label}</span>
            {field.type === "boolean" ? (
              <button
                onClick={() => setValues((v) => ({ ...v, [field.key]: !v[field.key] }))}
                style={{
                  width: 42, height: 22, borderRadius: 11, border: "none", cursor: "pointer",
                  background: values[field.key] ? "#2DE1C2" : "#1E2430", position: "relative", transition: "background 0.15s",
                }}
              >
                <span style={{
                  position: "absolute", top: 2, left: values[field.key] ? 22 : 2, width: 18, height: 18,
                  borderRadius: "50%", background: "#0A0E14", transition: "left 0.15s",
                }} />
              </button>
            ) : (
              <input
                className="input"
                type="number"
                min={1}
                style={{ width: 90, textAlign: "right" }}
                value={values[field.key] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [field.key]: Number(e.target.value) }))}
              />
            )}
          </div>
          <div style={{ fontSize: 11.5, color: "#5B6272" }}>{field.help}</div>
        </div>
      ))}

      {error && <div style={{ color: "#FF9F5A", fontSize: 12.5, marginBottom: 12 }}>{error}</div>}
      {message && <div style={{ color: "#2DE1C2", fontSize: 12.5, marginBottom: 12 }}>{message}</div>}

      <button className="btn btn-primary" onClick={save} disabled={saving}>
        {saving ? <Loader2 size={14} className="spin" /> : <Save size={14} />} Save Settings
      </button>
    </div>
  );
}
