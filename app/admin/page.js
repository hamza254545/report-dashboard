"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { Radio, LogOut, Users, Upload, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

export default function AdminPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [partners, setPartners] = useState([]);
  const [newPartner, setNewPartner] = useState({ name: "", email: "", password: "" });
  const [selectedId, setSelectedId] = useState("");
  const [uploadStatus, setUploadStatus] = useState("");

  useEffect(() => {
    const session = JSON.parse(localStorage.getItem("adstream_session") || "null");
    if (!session || session.type !== "admin") {
      router.push("/");
      return;
    }
    setReady(true);
    loadPartners();
  }, []);

  const loadPartners = async () => {
    const { data } = await supabase.from("partners").select("*").order("created_at", { ascending: false });
    setPartners(data || []);
    if (data && data.length) setSelectedId(data[0].id);
  };

  const addPartner = async () => {
    if (!newPartner.name || !newPartner.email || !newPartner.password) return;
    const { error } = await supabase.from("partners").insert([{
      name: newPartner.name,
      email: newPartner.email.trim().toLowerCase(),
      password: newPartner.password,
    }]);
    if (!error) {
      setNewPartner({ name: "", email: "", password: "" });
      loadPartners();
    } else {
      alert("Error adding partner: " + error.message);
    }
  };

  const removePartner = async (id) => {
    await supabase.from("partners").delete().eq("id", id);
    loadPartners();
  };

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file || !selectedId) return;
    setUploadStatus("Parsing...");
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data.map((r) => ({
          partner_id: selectedId,
          date: r.date || r.Date || null,
          device: r.device || r.Device || r["Dimension.DEVICE_CATEGORY_NAME"] || null,
          country: r.country || r.Country || r["Dimension.COUNTRY_NAME"] || null,
          impressions: parseFloat(r.impressions || r["Column.AD_SERVER_IMPRESSIONS"] || 0) || 0,
          clicks: parseFloat(r.clicks || r["Column.AD_SERVER_CLICKS"] || 0) || 0,
          ctr: parseFloat(r.ctr || r["Column.AD_SERVER_CTR"] || 0) || 0,
          revenue: parseFloat(r.revenue || r["Column.AD_SERVER_CPM_AND_CPC_REVENUE"] || 0) / 1000000 || 0,
        }));
        const { error } = await supabase.from("reports").insert(rows);
        setUploadStatus(error ? "Upload failed: " + error.message : `Uploaded ${rows.length} rows.`);
      },
    });
  };

  const logout = () => {
    localStorage.removeItem("adstream_session");
    router.push("/");
  };

  if (!ready) return null;

  return (
    <div style={{ minHeight: "100vh" }}>
      <div className="stream-pulse"><div className="stream-pulse-dot" /></div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 28px", borderBottom: "1px solid #1E2430" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Radio size={18} color="#2DE1C2" />
          <span style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, fontSize: 16 }}>AdStreamHQ</span>
          <span style={{ color: "#5B6272", fontSize: 13 }}>Admin Panel</span>
        </div>
        <button className="btn btn-ghost" onClick={logout}><LogOut size={14} /> Log out</button>
      </div>

      <div style={{ padding: 28, maxWidth: 900, margin: "0 auto" }}>
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <Users size={16} color="#2DE1C2" />
            <span style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 600, fontSize: 15 }}>Add Partner</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 14 }}>
            <input className="input" placeholder="Partner name" value={newPartner.name} onChange={(e) => setNewPartner({ ...newPartner, name: e.target.value })} />
            <input className="input" placeholder="Email (used as login)" value={newPartner.email} onChange={(e) => setNewPartner({ ...newPartner, email: e.target.value })} />
            <input className="input" placeholder="Password" value={newPartner.password} onChange={(e) => setNewPartner({ ...newPartner, password: e.target.value })} />
          </div>
          <button className="btn btn-primary" onClick={addPartner}><Plus size={14} /> Add Partner</button>
        </div>

        <div className="card" style={{ marginBottom: 20 }}>
          <span style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 600, fontSize: 15 }}>Partners ({partners.length})</span>
          <div style={{ marginTop: 14 }}>
            {partners.length === 0 && <div style={{ color: "#5B6272", fontSize: 13 }}>No partners yet.</div>}
            {partners.map((p) => (
              <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderTop: "1px solid #1E2430" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{p.name}</div>
                  <div style={{ color: "#5B6272", fontSize: 12 }}>{p.email}</div>
                </div>
                <button onClick={() => removePartner(p.id)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                  <Trash2 size={15} color="#FF9F5A" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <Upload size={16} color="#2DE1C2" />
            <span style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 600, fontSize: 15 }}>Upload Report (CSV)</span>
          </div>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12.5, color: "#8B93A7", marginBottom: 6 }}>Select partner</div>
            <select className="input" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
              {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <input type="file" accept=".csv" onChange={handleFile} style={{ color: "#8B93A7", fontSize: 13 }} />
          {uploadStatus && <div style={{ marginTop: 10, fontSize: 12.5, color: "#2DE1C2" }}>{uploadStatus}</div>}
        </div>
      </div>
    </div>
  );
}
