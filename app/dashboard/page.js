"use client";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { Radio, LogOut, Upload } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

const DEVICE_COLORS = { Mobile: "#2DE1C2", Desktop: "#5B8DEF", Tablet: "#FF9F5A" };

function CustomTooltip({ active, payload, label, prefix = "" }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{ background: "#0A0E14", border: "1px solid #2DE1C2", borderRadius: 8, padding: "8px 12px", fontFamily: "JetBrains Mono, monospace", fontSize: 12 }}>
      <div style={{ color: "#8B93A7", marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: "#E8EAED" }}>{prefix}{typeof p.value === "number" ? p.value.toLocaleString() : p.value}</div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [partner, setPartner] = useState(null);
  const [rows, setRows] = useState([]);

  useEffect(() => {
    const session = JSON.parse(localStorage.getItem("adstream_session") || "null");
    if (!session || session.type !== "partner") {
      router.push("/");
      return;
    }
    setPartner(session.partner);
    loadReports(session.partner.id);
  }, []);

  const loadReports = async (partnerId) => {
    const { data } = await supabase.from("reports").select("*").eq("partner_id", partnerId).order("date");
    setRows(data || []);
    setReady(true);
  };

  const processed = useMemo(() => {
    if (!rows.length) return null;
    const byDate = {};
    const byDevice = {};
    let totalImpressions = 0, totalClicks = 0, totalRevenue = 0;

    rows.forEach((r) => {
      const d = r.date || "—";
      const dev = r.device || "Unknown";
      const imp = Number(r.impressions) || 0;
      const clk = Number(r.clicks) || 0;
      const rev = Number(r.revenue) || 0;

      totalImpressions += imp;
      totalClicks += clk;
      totalRevenue += rev;

      byDate[d] = byDate[d] || { date: d, impressions: 0, revenue: 0 };
      byDate[d].impressions += imp;
      byDate[d].revenue += rev;

      byDevice[dev] = (byDevice[dev] || 0) + imp;
    });

    const series = Object.values(byDate).sort((a, b) => (a.date > b.date ? 1 : -1));
    const deviceData = Object.entries(byDevice).map(([name, value]) => ({ name, value, color: DEVICE_COLORS[name] || "#7A8299" }));
    const ecpm = totalImpressions ? (totalRevenue / totalImpressions) * 1000 : 0;
    const ctr = totalImpressions ? (totalClicks / totalImpressions) * 100 : 0;

    return { series, deviceData, totalImpressions, totalClicks, totalRevenue, ecpm, ctr };
  }, [rows]);

  const logout = () => {
    localStorage.removeItem("adstream_session");
    router.push("/");
  };

  if (!ready || !partner) return null;

  return (
    <div style={{ minHeight: "100vh" }}>
      <div className="stream-pulse"><div className="stream-pulse-dot" /></div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 28px", borderBottom: "1px solid #1E2430" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Radio size={18} color="#2DE1C2" />
          <span style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, fontSize: 16 }}>AdStreamHQ</span>
          <span style={{ color: "#5B6272", fontSize: 13 }}>{partner.name}</span>
        </div>
        <button className="btn btn-ghost" onClick={logout}><LogOut size={14} /> Log out</button>
      </div>

      <div style={{ padding: "24px 28px 40px" }}>
        {!processed ? (
          <div className="card" style={{ textAlign: "center", color: "#5B6272" }}>
            <Upload size={26} color="#2DE1C2" style={{ marginBottom: 10 }} />
            <div style={{ fontFamily: "Space Grotesk, sans-serif", color: "#E8EAED", fontSize: 15, marginBottom: 6 }}>No report data yet</div>
            <div style={{ fontSize: 13 }}>Your report will appear here once it's uploaded.</div>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 22 }}>
              <div className="card" style={{ flex: "1 1 200px" }}>
                <div style={{ color: "#8B93A7", fontSize: 12.5, marginBottom: 8 }}>REVENUE</div>
                <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 24 }}>${processed.totalRevenue.toFixed(2)}</div>
              </div>
              <div className="card" style={{ flex: "1 1 200px" }}>
                <div style={{ color: "#8B93A7", fontSize: 12.5, marginBottom: 8 }}>IMPRESSIONS</div>
                <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 24 }}>{processed.totalImpressions.toLocaleString()}</div>
              </div>
              <div className="card" style={{ flex: "1 1 200px" }}>
                <div style={{ color: "#8B93A7", fontSize: 12.5, marginBottom: 8 }}>eCPM</div>
                <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 24 }}>${processed.ecpm.toFixed(2)}</div>
              </div>
              <div className="card" style={{ flex: "1 1 200px" }}>
                <div style={{ color: "#8B93A7", fontSize: 12.5, marginBottom: 8 }}>CTR</div>
                <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 24 }}>{processed.ctr.toFixed(2)}%</div>
              </div>
            </div>

            <div className="card" style={{ marginBottom: 20 }}>
              <span style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 600, fontSize: 14.5 }}>Revenue Trend</span>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={processed.series} margin={{ top: 14, right: 6, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2DE1C2" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#2DE1C2" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#1E2430" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: "#5B6272", fontSize: 11 }} axisLine={{ stroke: "#1E2430" }} tickLine={false} />
                  <YAxis tick={{ fill: "#5B6272", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip prefix="$" />} />
                  <Area type="monotone" dataKey="revenue" stroke="#2DE1C2" strokeWidth={2} fill="url(#revGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="card">
              <span style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 600, fontSize: 14.5 }}>Devices</span>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={processed.deviceData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={78} paddingAngle={2}>
                    {processed.deviceData.map((entry, i) => <Cell key={i} fill={entry.color} stroke="#0A0E14" strokeWidth={2} />)}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
