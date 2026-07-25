"use client";
import { useEffect, useState, useCallback } from "react";
import { Users, Plus, Trash2, RefreshCw, Loader2, KeyRound } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";

export default function PartnersTab() {
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", email: "", password: "", networkCode: "" });
  const [error, setError] = useState("");
  const [syncingId, setSyncingId] = useState("");
  const [savingId, setSavingId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { partners } = await apiFetch("/api/admin/partners");
      setPartners(partners);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const addPartner = async () => {
    setError("");
    if (!form.name || !form.email || !form.password) {
      setError("Name, email, and password are required.");
      return;
    }
    try {
      await apiFetch("/api/admin/partners", { method: "POST", body: JSON.stringify(form) });
      setForm({ name: "", email: "", password: "", networkCode: "" });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const removePartner = async (id) => {
    if (!confirm("Delete this partner and all of their report data?")) return;
    try {
      await apiFetch(`/api/admin/partners/${id}`, { method: "DELETE" });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const updateNetworkCode = async (id, networkCode) => {
    setSavingId(id);
    try {
      await apiFetch(`/api/admin/partners/${id}`, { method: "PATCH", body: JSON.stringify({ networkCode }) });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingId("");
    }
  };

  const resetPassword = async (id) => {
    const password = prompt("Enter a new password for this partner (min 8 characters):");
    if (!password) return;
    try {
      await apiFetch(`/api/admin/partners/${id}`, { method: "PATCH", body: JSON.stringify({ password }) });
      alert("Password updated.");
    } catch (err) {
      setError(err.message);
    }
  };

  const syncPartner = async (id) => {
    setSyncingId(id);
    setError("");
    try {
      await apiFetch("/api/gam/sync", { method: "POST", body: JSON.stringify({ partnerId: id }) });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSyncingId("");
    }
  };

  return (
    <div>
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <Users size={16} color="#2DE1C2" />
          <span style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 600, fontSize: 15 }}>Add Partner</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 14, marginBottom: 14 }}>
          <input className="input" placeholder="Partner name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="input" placeholder="Email (used as login)" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input className="input" placeholder="Password (min 8 chars)" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <input className="input" placeholder="GAM network code" value={form.networkCode} onChange={(e) => setForm({ ...form, networkCode: e.target.value })} />
        </div>
        {error && <div style={{ color: "#FF9F5A", fontSize: 12.5, marginBottom: 12 }}>{error}</div>}
        <button className="btn btn-primary" onClick={addPartner}><Plus size={14} /> Add Partner</button>
      </div>

      <div className="card">
        <span style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 600, fontSize: 15 }}>Partners ({partners.length})</span>
        <div style={{ marginTop: 14 }}>
          {loading && <div style={{ color: "#5B6272", fontSize: 13 }}>Loading…</div>}
          {!loading && partners.length === 0 && <div style={{ color: "#5B6272", fontSize: 13 }}>No partners yet.</div>}
          {partners.map((p) => (
            <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "12px 0", borderTop: "1px solid #1E2430", flexWrap: "wrap" }}>
              <div style={{ minWidth: 180 }}>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{p.name}</div>
                <div style={{ color: "#5B6272", fontSize: 12 }}>{p.email}</div>
              </div>
              <input
                className="input"
                defaultValue={p.network_code || ""}
                placeholder="GAM network code"
                style={{ width: 160 }}
                onBlur={(e) => {
                  if (e.target.value !== (p.network_code || "")) updateNetworkCode(p.id, e.target.value);
                }}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-ghost" onClick={() => syncPartner(p.id)} disabled={syncingId === p.id}>
                  {syncingId === p.id ? <Loader2 size={13} className="spin" /> : <RefreshCw size={13} />} Sync
                </button>
                <button className="btn btn-ghost" onClick={() => resetPassword(p.id)}>
                  <KeyRound size={13} /> Reset PW
                </button>
                <button onClick={() => removePartner(p.id)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                  <Trash2 size={15} color="#FF9F5A" />
                </button>
              </div>
              {savingId === p.id && <span style={{ fontSize: 11, color: "#5B6272" }}>Saving…</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
