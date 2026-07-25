"use client";
import { useEffect, useState, useCallback } from "react";
import { BarChart3, Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import { exportReportsToCsv, exportReportsToExcel, exportReportsToPdf } from "@/lib/exportUtils";

function defaultDateRange() {
  const end = new Date();
  const start = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000);
  return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
}

export default function ReportsTab() {
  const [partners, setPartners] = useState([]);
  const [partnerId, setPartnerId] = useState("");
  const [{ startDate, endDate }, setRange] = useState(defaultDateRange());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState("");

  useEffect(() => {
    apiFetch("/api/admin/partners").then(({ partners }) => {
      setPartners(partners);
      if (partners.length) setPartnerId(partners[0].id);
    }).catch((err) => setError(err.message));
  }, []);

  const loadReports = useCallback(async () => {
    if (!partnerId) return;
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ partnerId, startDate, endDate });
      const { reports } = await apiFetch(`/api/reports?${query.toString()}`);
      setRows(reports || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [partnerId, startDate, endDate]);

  useEffect(() => { loadReports(); }, [loadReports]);

  const partnerName = partners.find((p) => p.id === partnerId)?.name || "partner";

  const runExport = async (type) => {
    if (!rows.length) return;
    setExporting(type);
    try {
      if (type === "csv") exportReportsToCsv(rows, `${partnerName}-report.csv`);
      if (type === "xlsx") await exportReportsToExcel(rows, `${partnerName}-report.xlsx`);
      if (type === "pdf") await exportReportsToPdf(rows, { filename: `${partnerName}-report.pdf`, title: `${partnerName} — AdStreamHQ Report` });
    } finally {
      setExporting("");
    }
  };

  const totals = rows.reduce(
    (acc, r) => {
      acc.impressions += Number(r.impressions) || 0;
      acc.clicks += Number(r.clicks) || 0;
      acc.revenue += Number(r.revenue) || 0;
      acc.requests += Number(r.requests) || 0;
      acc.matched += Number(r.matched_requests) || 0;
      return acc;
    },
    { impressions: 0, clicks: 0, revenue: 0, requests: 0, matched: 0 }
  );

  return (
    <div>
      <div className="card" style={{ marginBottom: 20, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div>
          <div style={{ fontSize: 11.5, color: "#8B93A7", marginBottom: 6 }}>Partner</div>
          <select className="input" value={partnerId} onChange={(e) => setPartnerId(e.target.value)} style={{ width: 200 }}>
            {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <div style={{ fontSize: 11.5, color: "#8B93A7", marginBottom: 6 }}>From</div>
          <input className="input" type="date" value={startDate} onChange={(e) => setRange((r) => ({ ...r, startDate: e.target.value }))} style={{ width: 150 }} />
        </div>
        <div>
          <div style={{ fontSize: 11.5, color: "#8B93A7", marginBottom: 6 }}>To</div>
          <input className="input" type="date" value={endDate} onChange={(e) => setRange((r) => ({ ...r, endDate: e.target.value }))} style={{ width: 150 }} />
        </div>
        <div style={{ flex: 1 }} />
        <button className="btn btn-ghost" onClick={() => runExport("csv")} disabled={!rows.length || exporting}><Download size={14} /> CSV</button>
        <button className="btn btn-ghost" onClick={() => runExport("xlsx")} disabled={!rows.length || exporting}><FileSpreadsheet size={14} /> Excel</button>
        <button className="btn btn-ghost" onClick={() => runExport("pdf")} disabled={!rows.length || exporting}><FileText size={14} /> PDF</button>
      </div>

      {error && <div className="card" style={{ marginBottom: 20, color: "#FF9F5A", fontSize: 13 }}>{error}</div>}

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 20 }}>
        <div className="card" style={{ flex: "1 1 150px" }}>
          <div style={{ color: "#8B93A7", fontSize: 12, marginBottom: 8 }}>REVENUE</div>
          <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 20 }}>${totals.revenue.toFixed(2)}</div>
        </div>
        <div className="card" style={{ flex: "1 1 150px" }}>
          <div style={{ color: "#8B93A7", fontSize: 12, marginBottom: 8 }}>IMPRESSIONS</div>
          <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 20 }}>{totals.impressions.toLocaleString()}</div>
        </div>
        <div className="card" style={{ flex: "1 1 150px" }}>
          <div style={{ color: "#8B93A7", fontSize: 12, marginBottom: 8 }}>CLICKS</div>
          <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 20 }}>{totals.clicks.toLocaleString()}</div>
        </div>
        <div className="card" style={{ flex: "1 1 150px" }}>
          <div style={{ color: "#8B93A7", fontSize: 12, marginBottom: 8 }}>FILL RATE</div>
          <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 20 }}>{totals.requests ? ((totals.matched / totals.requests) * 100).toFixed(2) : "0.00"}%</div>
        </div>
      </div>

      <div className="card" style={{ overflowX: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <BarChart3 size={16} color="#2DE1C2" />
          <span style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 600, fontSize: 15 }}>Report Rows ({rows.length})</span>
          {loading && <Loader2 size={14} className="spin" color="#5B6272" />}
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr style={{ color: "#8B93A7", textAlign: "left" }}>
              {["Date", "Country", "Device", "Impressions", "Clicks", "CTR", "Requests", "Matched", "Fill Rate", "eCPM", "Revenue"].map((h) => (
                <th key={h} style={{ padding: "6px 10px", borderBottom: "1px solid #1E2430" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 500).map((r) => (
              <tr key={r.id} style={{ borderBottom: "1px solid #1E2430" }}>
                <td style={{ padding: "6px 10px" }}>{r.date}</td>
                <td style={{ padding: "6px 10px" }}>{r.country}</td>
                <td style={{ padding: "6px 10px" }}>{r.device}</td>
                <td style={{ padding: "6px 10px" }}>{Number(r.impressions).toLocaleString()}</td>
                <td style={{ padding: "6px 10px" }}>{Number(r.clicks).toLocaleString()}</td>
                <td style={{ padding: "6px 10px" }}>{Number(r.ctr).toFixed(2)}%</td>
                <td style={{ padding: "6px 10px" }}>{Number(r.requests).toLocaleString()}</td>
                <td style={{ padding: "6px 10px" }}>{Number(r.matched_requests).toLocaleString()}</td>
                <td style={{ padding: "6px 10px" }}>{Number(r.fill_rate).toFixed(2)}%</td>
                <td style={{ padding: "6px 10px" }}>${Number(r.ecpm).toFixed(2)}</td>
                <td style={{ padding: "6px 10px" }}>${Number(r.revenue).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length > 500 && (
          <div style={{ marginTop: 10, fontSize: 11.5, color: "#5B6272" }}>Showing first 500 of {rows.length} rows — export for the full set.</div>
        )}
        {!rows.length && !loading && <div style={{ color: "#5B6272", fontSize: 13, marginTop: 8 }}>No rows for this range.</div>}
      </div>
    </div>
  );
}
