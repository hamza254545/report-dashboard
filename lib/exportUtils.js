"use client";
import Papa from "papaparse";

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const REPORT_COLUMNS = [
  { key: "date", label: "Date" },
  { key: "country", label: "Country" },
  { key: "device", label: "Device" },
  { key: "impressions", label: "Impressions" },
  { key: "clicks", label: "Clicks" },
  { key: "ctr", label: "CTR (%)" },
  { key: "requests", label: "Requests" },
  { key: "matched_requests", label: "Matched Requests" },
  { key: "fill_rate", label: "Fill Rate (%)" },
  { key: "ecpm", label: "eCPM ($)" },
  { key: "revenue", label: "Revenue ($)" },
];

function toRows(reports) {
  return reports.map((r) =>
    REPORT_COLUMNS.reduce((acc, col) => {
      acc[col.label] = r[col.key];
      return acc;
    }, {})
  );
}

export function exportReportsToCsv(reports, filename = "adstreamhq-report.csv") {
  const rows = toRows(reports);
  const csv = Papa.unparse(rows);
  triggerDownload(new Blob([csv], { type: "text/csv;charset=utf-8;" }), filename);
}

export async function exportReportsToExcel(reports, filename = "adstreamhq-report.xlsx") {
  const XLSX = await import("xlsx");
  const rows = toRows(reports);
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
  const buffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  triggerDownload(
    new Blob([buffer], { type: "application/octet-stream" }),
    filename
  );
}

export async function exportReportsToPdf(reports, { filename = "adstreamhq-report.pdf", title = "AdStreamHQ Report" } = {}) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(14);
  doc.text(title, 14, 16);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Generated ${new Date().toLocaleString()}`, 14, 22);

  autoTable(doc, {
    startY: 28,
    head: [REPORT_COLUMNS.map((c) => c.label)],
    body: reports.map((r) => REPORT_COLUMNS.map((c) => r[c.key])),
    styles: { fontSize: 7 },
    headStyles: { fillColor: [45, 225, 194], textColor: [10, 14, 20] },
  });

  doc.save(filename);
}
