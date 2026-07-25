"use client";
import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { Radio, LogOut, Inbox, Download, FileSpreadsheet, FileText, RefreshCw } from "lucide-react";
import { apiFetch, getStoredSession, clearStoredSession } from "@/lib/apiClient";
import { exportReportsToCsv, exportReportsToExcel, exportReportsToPdf } from "@/lib/exportUtils";

const DEVICE_COLORS = { Mobile: "#2DE1C2", Desktop: "#5B8DEF", Tablet: "#FF9F5A", Unknown: "#5B6272" };

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

function MetricCard({ label, value }) {
  return (
    <div className="card" style={{ flex: "1 1 160px" }}>
      <div style={{ color: "#8B93A7", fontSize: 12, marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 21 }}>{value}</div>
    </div>
  );
}

function defaultDateRange() {
  const end = new Date();
  const start = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000);
  return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
}

export default function DashboardPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [partner, setPartner] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [groupBy, setGroupBy] = useState("day"); // day | month
  const [country, setCountry] = useState("");
  const [device, setDevice] = useState("");
  const [{ startDate, endDate }, setRange] = useState(defaultDateRange());
  const [exporting, setExporting] = useState("");

  const loadReports = useCallback(async (params) => {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams();
      if (params.startDate) query.set("startDate", params.startDate);
      if (params.endDate) query.set("endDate", params.endDate);
      if (params.country) query.set("country", params.country);
      if (params.device) query.set("device", params.device);
      const { reports } = await apiFetch(`/api/reports?${query.toString()}`);
      setRows(reports || []);
    } catch (err) {
      setError(err.message || "Failed to load reports.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const session = getStoredSession();
    if (!session || session.type !== "partner") {
      router.push("/");
      return;
    }
    setPartner(session.partner);
    setReady(true);
  }, [router]);

  useEffect(() => {
    if (!ready) return;
    loadReports({ startDate, endDate, country, device });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, startDate, endDate, country, device]);

  const filterOptions = useMemo(() => {
    const countries = new Set();
    const devices = new Set();
    rows.forEach((r) => {
      if (r.country) countries.add(r.country);
      if (r.device) devices.add(r.device);
    });
    return { countries: [...countries].sort(), devices: [...devices].sort() };
  }, [rows]);

  const processed = useMemo(() => {
    if (!rows.length) return null;
    const byPeriod = {};
    const byDevice = {};
    let totalImpressions = 0, totalClicks = 0, totalRevenue = 0, totalRequests = 0, totalMatched = 0;

    rows.forEach((r) => {
      const period = groupBy === "month" ? String(r.date).slice(0, 7) : r.date;
      const dev = r.device || "Unknown";
      const imp = Number(r.impressions) || 0;
      const clk = Number(r.clicks) || 0;
      const rev = Number(r.revenue) || 0;
      const req = Number(r.requests) || 0;
      const matched = Number(r.matched_requests) || 0;

      totalImpressions += imp;
      totalClicks += clk;
      totalRevenue += rev;
      totalRequests += req;
      totalMatched += matched;

      byPeriod[period] = byPeriod[period] || { period, impressions: 0, revenue: 0 };
      byPeriod[period].impressions += imp;
      byPeriod[period].revenue += rev;

      byDevice[dev] = (byDevice[dev] || 0) + imp;
    });

    const series = Object.values(byPeriod).sort((a, b) => (a.period > b.period ? 1 : -1));
    const deviceData = Object.entries(byDevice).map(([name, value]) => ({ name, value, color: DEVICE_COLORS[name] || "#7A8299" }));
    const ecpm = totalImpressions ? (totalRevenue / totalImpressions) * 1000 : 0;
    const ctr = totalImpressions ? (totalClicks / totalImpressions) * 100 : 0;
    const fillRate = totalRequests ? (totalMatched / totalRequests) * 100 : 0;

    return { series, deviceData, totalImpressions, totalClicks, totalRevenue, totalRequests, totalMatched, ecpm, ctr, fillRate };
  }, [rows, groupBy]);

  const logout = () => {
    clearStoredSession();
    router.push("/");
  };

  const runExport = async (type) => {
    if (!rows.length) return;
    setExporting(type);
    try {
      if (type === "csv") exportReportsToCsv(rows, `${partner.name}-report.csv`);
      if (type === "xlsx") await exportReportsToExcel(rows, `${partner.name}-report.xlsx`);
      if (type === "pdf") await exportReportsToPdf(rows, { filename: `${partner.name}-report.pdf`, title: `${partner.name} — AdStreamHQ Report` });
    } finally {
      setExporting("");
    }
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
        <div className="card" style={{ marginBottom: 20, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <div style={{ fontSize: 11.5, color: "#8B93A7", marginBottom: 6 }}>From</div>
            <input className="input" type="date" value={startDate} onChange={(e) => setRange((r) => ({ ...r, startDate: e.target.value }))} style={{ width: 150 }} />
          </div>
          <div>
            <div style={{ fontSize: 11.5, color: "#8B93A7", marginBottom: 6 }}>To</div>
            <input className="input" type="date" value={endDate} onChange={(e) => setRange((r) => ({ ...r, endDate: e.target.value }))} style={{ width: 150 }} />
          </div>
          <div>
            <div style={{ fontSize: 11.5, color: "#8B93A7", marginBottom: 6 }}>Country</div>
            <select className="input" value={country} onChange={(e) => setCountry(e.target.value)} style={{ width: 150 }}>
              <option value="">All countries</option>
              {filterOptions.countries.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11.5, color: "#8B93A7", marginBottom: 6 }}>Device</div>
            <select className="input" value={device} onChange={(e) => setDevice(e.target.value)} style={{ width: 130 }}>
              <option value="">All devices</option>
              {filterOptions.devices.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11.5, color: "#8B93A7", marginBottom: 6 }}>View</div>
            <select className="input" value={groupBy} onChange={(e) => setGroupBy(e.target.value)} style={{ width: 120 }}>
              <option value="day">Daily</option>
              <option value="month">Monthly</option>
            </select>
          </div>
          <button className="btn btn-ghost" onClick={() => loadReports({ startDate, endDate, country, device })} disabled={loading}>
            <RefreshCw size={14} className={loading ? "spin" : ""} /> Refresh
          </button>
          <div style={{ flex: 1 }} />
          <button className="btn btn-ghost" onClick={() => runExport("csv")} disabled={!rows.length || exporting}>
            <Download size={14} /> CSV
          </button>
          <button className="btn btn-ghost" onClick={() => runExport("xlsx")} disabled={!rows.length || exporting}>
            <FileSpreadsheet size={14} /> Excel
          </button>
          <button className="btn btn-ghost" onClick={() => runExport("pdf")} disabled={!rows.length || exporting}>
            <FileText size={14} /> PDF
          </button>
        </div>

        {error && <div className="card" style={{ marginBottom: 20, color: "#FF9F5A", fontSize: 13 }}>{error}</div>}

        {!processed ? (
          <div className="card" style={{ textAlign: "center", color: "#5B6272" }}>
            <Inbox size={26} color="#2DE1C2" style={{ marginBottom: 10 }} />
            <div style={{ fontFamily: "Space Grotesk, sans-serif", color: "#E8EAED", fontSize: 15, marginBottom: 6 }}>
              {loading ? "Loading report data…" : "No report data for this range"}
            </div>
            <div style={{ fontSize: 13 }}>Try widening the date range, or check back after the next sync.</div>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 22 }}>
              <MetricCard label="REVENUE" value={`$${processed.totalRevenue.toFixed(2)}`} />
              <MetricCard label="IMPRESSIONS" value={processed.totalImpressions.toLocaleString()} />
              <MetricCard label="CLICKS" value={processed.totalClicks.toLocaleString()} />
              <MetricCard label="CTR" value={`${processed.ctr.toFixed(2)}%`} />
              <MetricCard label="eCPM" value={`$${processed.ecpm.toFixed(2)}`} />
              <MetricCard label="REQUESTS" value={processed.totalRequests.toLocaleString()} />
              <MetricCard label="MATCHED REQUESTS" value={processed.totalMatched.toLocaleString()} />
              <MetricCard label="FILL RATE" value={`${processed.fillRate.toFixed(2)}%`} />
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
                  <XAxis dataKey="period" tick={{ fill: "#5B6272", fontSize: 11 }} axisLine={{ stroke: "#1E2430" }} tickLine={false} />
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
