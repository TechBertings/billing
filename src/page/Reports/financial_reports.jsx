import React, { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "../../lib/supabaseClient";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  FaChartLine,
  FaFileInvoiceDollar,
  FaUniversity,
  FaPrint,
  FaFileCsv,
  FaFilePdf,
  FaCheckCircle,
  FaExclamationTriangle,
  FaSpinner,
  FaCoins,
  FaChartBar,
} from "react-icons/fa";

const GREEN = "#1a5c2e";
const GREEN_RGB = [26, 92, 46];
const RED = "#c0392b";
const AMBER = "#b7791f";
const BLUE = "#2563eb";

const inputCls =
  "w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 bg-white transition";
const labelCls = "block text-xs font-medium text-gray-500 mb-1";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const PAYMENT_METHOD_LABELS = {
  cash: "Cash",
  cheque: "Cheque",
  bank_transfer: "Bank Transfer",
  credit: "Applied Credit",
  other: "Other",
};

const BUCKETS = [
  { key: "current", label: "Current", color: GREEN },
  { key: "b1_30", label: "1–30 days", color: BLUE },
  { key: "b31_60", label: "31–60 days", color: AMBER },
  { key: "b61_90", label: "61–90 days", color: "#d97706" },
  { key: "b90_plus", label: "90+ days", color: RED },
];

// ── Shared helpers ──────────────────────────────────────────────────────
function fmt(n) {
  return Number(n || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "2-digit" });
}
function lastDayOfMonth(year, month) {
  return new Date(year, month, 0).toISOString().split("T")[0];
}
function daysOverdue(dueDate) {
  if (!dueDate) return 0;
  return Math.floor((new Date() - new Date(dueDate)) / (1000 * 60 * 60 * 24));
}
function bucketFor(days) {
  if (days <= 0) return "current";
  if (days <= 30) return "b1_30";
  if (days <= 60) return "b31_60";
  if (days <= 90) return "b61_90";
  return "b90_plus";
}
function paymentMethodLabel(row) {
  const method = typeof row === "string" ? row : row?.payment_method;
  const receivingBank = typeof row === "object" ? row?.receiving_bank : null;

  if (method === "bank_transfer" && receivingBank) {
    if (receivingBank === "bdo") return "BDO Bank Transfer";
    if (receivingBank === "chinabank") return "China Bank Transfer";
  }
  return PAYMENT_METHOD_LABELS[method] || method || "Unspecified";
}
function clientDisplayName(c) {
  if (!c) return "Unknown client";
  return (
    c.business_name ||
    c.trade_name ||
    [c.first_name, c.middle_name, c.last_name].filter(Boolean).join(" ") ||
    "Unknown client"
  );
}

// CSV export — generic, works for any report's flat row data
function downloadCsv(filename, headers, rows) {
  const escape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [headers.map(escape).join(","), ...rows.map((r) => r.map(escape).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// PDF export — generic table-based report, one company header + one table + optional footer totals row
// Requires: npm install jspdf jspdf-autotable
function downloadPdf({ filename, title, subtitle, headers, rows, footerRow, orientation = "portrait" }) {
  const doc = new jsPDF({ orientation, unit: "pt" });
  doc.setFontSize(14);
  doc.setTextColor(20, 20, 20);
  doc.text(title, 40, 40);
  if (subtitle) {
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text(subtitle, 40, 56);
  }
  autoTable(doc, {
    startY: subtitle ? 68 : 54,
    head: [headers],
    body: rows,
    foot: footerRow ? [footerRow] : undefined,
    styles: { fontSize: 8, cellPadding: 5 },
    headStyles: { fillColor: GREEN_RGB, textColor: 255, fontStyle: "bold" },
    footStyles: { fillColor: [240, 240, 240], textColor: 20, fontStyle: "bold" },
    margin: { left: 40, right: 40 },
  });
  doc.setFontSize(8);
  doc.setTextColor(160, 160, 160);
  doc.text(
    `Generated ${new Date().toLocaleString("en-PH")}`,
    40,
    doc.internal.pageSize.getHeight() - 20,
  );
  doc.save(filename);
}

// Shared row of export/print buttons for every report tab
function ReportActions({ onPrint, onExportPdf, onExportCsv, disabled }) {
  return (
    <div className="flex items-center gap-2 print:hidden">
      <button
        onClick={onExportCsv}
        disabled={disabled}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 transition border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-40"
      >
        <FaFileCsv size={11} /> CSV
      </button>
      <button
        onClick={onExportPdf}
        disabled={disabled}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 transition border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-40"
      >
        <FaFilePdf size={11} /> PDF
      </button>
      <button
        onClick={onPrint}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white transition rounded-md"
        style={{ background: GREEN }}
      >
        <FaPrint size={11} /> Print
      </button>
    </div>
  );
}

function SummaryCard({ label, value, accent }) {
  return (
    <div className="p-4 bg-white border border-gray-200 rounded-lg">
      <p className="text-xs font-medium text-gray-400">{label}</p>
      <p className="mt-1 text-lg font-bold" style={{ color: accent || "#1f2937" }}>{value}</p>
    </div>
  );
}

function LoadingRow() {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-400">
      <FaSpinner className="animate-spin" size={13} /> Loading...
    </div>
  );
}

// ── Tab 1: Collections Report — official_receipts for the period, by client / payment method ──
function CollectionsReport({ month, year }) {
  const [loading, setLoading] = useState(false);
  const [receipts, setReceipts] = useState([]);
  const [groupBy, setGroupBy] = useState("client");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
      const endDate = lastDayOfMonth(year, month);

        const { data: rowsData, error } = await supabase
        .from("official_receipts")
        .select("invoice_number, payment_date, amount, notes, client_id, payment_method, receiving_bank")
        .gte("payment_date", startDate)
        .lte("payment_date", endDate)
        .order("payment_date", { ascending: false });
      if (error) throw error;

      const clientIds = [...new Set((rowsData || []).map((r) => r.client_id).filter(Boolean))];
      let clientMap = {};
      if (clientIds.length > 0) {
        const { data: clients } = await supabase
          .from("client_profile")
          .select("client_id, business_name, trade_name, first_name, middle_name, last_name")
          .in("client_id", clientIds);
        (clients || []).forEach((c) => { clientMap[c.client_id] = c; });
      }

      setReceipts((rowsData || []).map((r) => ({ ...r, clientName: clientDisplayName(clientMap[r.client_id]) })));
    } catch (err) {
      console.error("Error loading collections report:", err.message);
      setReceipts([]);
    }
    setLoading(false);
  }, [month, year]);

  useEffect(() => { load(); }, [load]);

  const total = useMemo(() => receipts.reduce((s, r) => s + Number(r.amount || 0), 0), [receipts]);

  const grouped = useMemo(() => {
    const map = {};
    receipts.forEach((r) => {
      const label = groupBy === "client" ? r.clientName : paymentMethodLabel(r);
      if (!map[label]) map[label] = { label, count: 0, amount: 0 };
      map[label].count += 1;
      map[label].amount += Number(r.amount || 0);
    });
    return Object.values(map).sort((a, b) => b.amount - a.amount);
  }, [receipts, groupBy]);

  const subtitle = `${MONTHS[month - 1]} ${year} · Grouped by ${groupBy === "client" ? "Client" : "Payment Method"}`;
  const headers = [groupBy === "client" ? "Client" : "Payment Method", "Receipts", "Amount (PHP)"];
  const csvRows = grouped.map((g) => [g.label, g.count, fmt(g.amount)]);
  const pdfRows = grouped.map((g) => [g.label, String(g.count), fmt(g.amount)]);
  const footerRow = ["Total", String(receipts.length), fmt(total)];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-2 p-1 bg-gray-100 rounded-md w-fit">
          {["client", "payment_method"].map((g) => (
            <button
              key={g}
              onClick={() => setGroupBy(g)}
              className={`px-3 py-1.5 text-xs font-medium rounded transition ${
                groupBy === g ? "bg-white shadow-sm text-gray-800" : "text-gray-500"
              }`}
            >
              {g === "client" ? "By Client" : "By Payment Method"}
            </button>
          ))}
        </div>
        <ReportActions
          disabled={receipts.length === 0}
          onExportCsv={() => downloadCsv(`collections-report-${year}-${String(month).padStart(2, "0")}.csv`, headers, csvRows)}
          onExportPdf={() =>
            downloadPdf({
              filename: `collections-report-${year}-${String(month).padStart(2, "0")}.pdf`,
              title: "Collections Report",
              subtitle,
              headers,
              rows: pdfRows,
              footerRow,
            })
          }
          onPrint={() => window.print()}
        />
      </div>

      <div className="hidden mb-2 print:block">
        <h2 className="text-base font-bold text-gray-800">Collections Report</h2>
        <p className="text-xs text-gray-500">{subtitle}</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 print:hidden">
        <SummaryCard label="Total Collected" value={`\u20b1${fmt(total)}`} accent={GREEN} />
        <SummaryCard label="Receipts Recorded" value={receipts.length} />
        <SummaryCard label="Period" value={`${MONTHS[month - 1]} ${year}`} />
      </div>

      {loading ? (
        <LoadingRow />
      ) : (
        <>
          <div className="overflow-hidden border border-gray-200 rounded-lg">
            <table className="w-full text-xs">
              <thead className="text-gray-500 bg-gray-50">
                <tr>
                  <th className="px-3 py-2 font-medium text-left">{headers[0]}</th>
                  <th className="px-3 py-2 font-medium text-right w-28">Receipts</th>
                  <th className="px-3 py-2 font-medium text-right w-36">Amount</th>
                </tr>
              </thead>
              <tbody>
                {grouped.length === 0 ? (
                  <tr><td colSpan={3} className="py-6 text-center text-gray-400">No collections recorded for this period.</td></tr>
                ) : (
                  grouped.map((g) => (
                    <tr key={g.label} className="border-t border-gray-50">
                      <td className="px-3 py-2 text-gray-800">{g.label}</td>
                      <td className="px-3 py-2 text-right text-gray-600">{g.count}</td>
                      <td className="px-3 py-2 font-mono text-right text-gray-700">{fmt(g.amount)}</td>
                    </tr>
                  ))
                )}
              </tbody>
              {grouped.length > 0 && (
                <tfoot>
                  <tr className="border-t border-gray-200 bg-gray-50">
                    <td className="px-3 py-2 font-semibold text-right text-gray-700">Total</td>
                    <td className="px-3 py-2 font-semibold text-right text-gray-700">{receipts.length}</td>
                    <td className="px-3 py-2 font-mono font-bold text-right" style={{ color: GREEN }}>{fmt(total)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          <details className="text-xs print:hidden">
            <summary className="font-medium text-gray-500 cursor-pointer select-none">Show all {receipts.length} receipts</summary>
            <div className="mt-2 overflow-hidden border border-gray-100 rounded-lg">
              <table className="w-full text-xs">
                <thead className="text-gray-500 bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 font-medium text-left">Date</th>
                    <th className="px-3 py-2 font-medium text-left">OR #</th>
                    <th className="px-3 py-2 font-medium text-left">Client</th>
                    <th className="px-3 py-2 font-medium text-left">Method</th>
                    <th className="px-3 py-2 font-medium text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                    {receipts.map((r) => (
                    <tr key={r.invoice_number} className="border-t border-gray-50">
                      <td className="px-3 py-2 text-gray-600">{r.payment_date}</td>
                      <td className="px-3 py-2 font-mono text-gray-500">{r.invoice_number}</td>
                      <td className="px-3 py-2 text-gray-800">{r.clientName}</td>
                      <td className="px-3 py-2 text-gray-600">{paymentMethodLabel(r)}</td>
                      <td className="px-3 py-2 font-mono text-right text-gray-700">{fmt(r.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </div>
  );
}

// ── Tab 2: Bank Reconciliation Summary — status of every bank_reconciliations row for the period ──
function BankReconciliationSummary({ month, year }) {
  const [loading, setLoading] = useState(false);
  const [recons, setRecons] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("bank_reconciliations")
        .select("*")
        .eq("month", month)
        .eq("year", year)
        .order("bank_name", { ascending: true });
      if (error) throw error;
      setRecons(data || []);
    } catch (err) {
      console.error("Error loading bank reconciliation summary:", err.message);
      setRecons([]);
    }
    setLoading(false);
  }, [month, year]);

  useEffect(() => { load(); }, [load]);

  const totalCashBalance = useMemo(
    () => recons.reduce((s, r) => s + Number(r.beginning_balance || 0), 0),
    [recons],
  );

  const subtitle = `${MONTHS[month - 1]} ${year}`;
  const headers = ["Bank", "Account No.", "Beginning Balance", "Statement Balance", "Reconciled"];
  const csvRows = recons.map((r) => [
    r.bank_name, r.account_no || "", fmt(r.beginning_balance), fmt(r.bank_statement_balance), r.is_reconciled ? "Yes" : "No",
  ]);
  const pdfRows = csvRows;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-end print:hidden">
        <ReportActions
          disabled={recons.length === 0}
          onExportCsv={() => downloadCsv(`bank-reconciliation-summary-${year}-${String(month).padStart(2, "0")}.csv`, headers, csvRows)}
          onExportPdf={() =>
            downloadPdf({
              filename: `bank-reconciliation-summary-${year}-${String(month).padStart(2, "0")}.pdf`,
              title: "Bank Reconciliation Summary",
              subtitle,
              headers,
              rows: pdfRows,
            })
          }
          onPrint={() => window.print()}
        />
      </div>

      <div className="hidden mb-2 print:block">
        <h2 className="text-base font-bold text-gray-800">Bank Reconciliation Summary</h2>
        <p className="text-xs text-gray-500">{subtitle}</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 print:hidden">
        <SummaryCard label="Bank Accounts on File" value={recons.length} />
        <SummaryCard label="Reconciled" value={recons.filter((r) => r.is_reconciled).length} accent={GREEN} />
        <SummaryCard label="Total Beginning Balance" value={`\u20b1${fmt(totalCashBalance)}`} />
      </div>

      {loading ? (
        <LoadingRow />
      ) : (
        <div className="overflow-hidden border border-gray-200 rounded-lg">
          <table className="w-full text-xs">
            <thead className="text-gray-500 bg-gray-50">
              <tr>
                <th className="px-3 py-2 font-medium text-left">Bank</th>
                <th className="px-3 py-2 font-medium text-left">Account No.</th>
                <th className="px-3 py-2 font-medium text-right">Beginning Bal.</th>
                <th className="px-3 py-2 font-medium text-right">Statement Bal.</th>
                <th className="px-3 py-2 font-medium text-center w-28">Status</th>
              </tr>
            </thead>
            <tbody>
              {recons.length === 0 ? (
                <tr><td colSpan={5} className="py-6 text-center text-gray-400">No bank reconciliations found for this period.</td></tr>
              ) : (
                recons.map((r) => (
                  <tr key={r.id} className="border-t border-gray-50">
                    <td className="px-3 py-2 text-gray-800">{r.bank_name}</td>
                    <td className="px-3 py-2 font-mono text-gray-500">{r.account_no || "—"}</td>
                    <td className="px-3 py-2 font-mono text-right text-gray-700">{fmt(r.beginning_balance)}</td>
                    <td className="px-3 py-2 font-mono text-right text-gray-700">{fmt(r.bank_statement_balance)}</td>
                    <td className="px-3 py-2 text-center">
                      {r.is_reconciled ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold text-green-700 bg-green-100 rounded">
                          <FaCheckCircle size={9} /> Reconciled
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded" style={{ background: "#fdecea", color: RED }}>
                          <FaExclamationTriangle size={9} /> Pending
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Tab 3: Revenue Summary — Billed vs Collected trend across all 12 months of the selected year ──
function RevenueSummary({ year }) {
  const [loading, setLoading] = useState(false);
  const [monthlyBilled, setMonthlyBilled] = useState(Array(12).fill(0));
  const [monthlyCollected, setMonthlyCollected] = useState(Array(12).fill(0));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const yearStart = `${year}-01-01`;
      const yearEnd = `${year}-12-31`;

      // Billed — statements finalized this year, summed via billing_items, bucketed by soa_date's month
      const { data: statements, error: stErr } = await supabase
        .from("billing_statements")
        .select("id, soa_date")
        .gte("soa_date", yearStart)
        .lte("soa_date", yearEnd)
        .not("status", "in", "(draft,pending_approval)");
      if (stErr) throw stErr;

      const billingIds = (statements || []).map((s) => s.id);
      let itemTotals = {};
      if (billingIds.length > 0) {
        const { data: items, error: itErr } = await supabase
          .from("billing_items")
          .select("billing_id, amount")
          .in("billing_id", billingIds);
        if (itErr) throw itErr;
        (items || []).forEach((i) => {
          itemTotals[i.billing_id] = (itemTotals[i.billing_id] || 0) + (Number(i.amount) || 0);
        });
      }

      const billedByMonth = Array(12).fill(0);
      (statements || []).forEach((s) => {
        const m = new Date(s.soa_date).getMonth();
        billedByMonth[m] += itemTotals[s.id] || 0;
      });

      // Collected — official_receipts this year, bucketed by payment_date's month
      const { data: receipts, error: orErr } = await supabase
        .from("official_receipts")
        .select("amount, payment_date")
        .gte("payment_date", yearStart)
        .lte("payment_date", yearEnd);
      if (orErr) throw orErr;

      const collectedByMonth = Array(12).fill(0);
      (receipts || []).forEach((r) => {
        const m = new Date(r.payment_date).getMonth();
        collectedByMonth[m] += Number(r.amount) || 0;
      });

      setMonthlyBilled(billedByMonth);
      setMonthlyCollected(collectedByMonth);
    } catch (err) {
      console.error("Error loading revenue summary:", err.message);
    }
    setLoading(false);
  }, [year]);

  useEffect(() => { load(); }, [load]);

  const totalBilled = useMemo(() => monthlyBilled.reduce((s, v) => s + v, 0), [monthlyBilled]);
  const totalCollected = useMemo(() => monthlyCollected.reduce((s, v) => s + v, 0), [monthlyCollected]);
  const collectionRate = totalBilled > 0.005 ? (totalCollected / totalBilled) * 100 : 0;

  const subtitle = `Calendar Year ${year}`;
  const headers = ["Month", "Billed (PHP)", "Collected (PHP)", "Variance (PHP)"];
  const csvRows = MONTHS.map((m, i) => [
    m, fmt(monthlyBilled[i]), fmt(monthlyCollected[i]), fmt(monthlyCollected[i] - monthlyBilled[i]),
  ]);
  const pdfRows = csvRows;
  const footerRow = ["Total", fmt(totalBilled), fmt(totalCollected), fmt(totalCollected - totalBilled)];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-end print:hidden">
        <ReportActions
          disabled={totalBilled === 0 && totalCollected === 0}
          onExportCsv={() => downloadCsv(`revenue-summary-${year}.csv`, headers, csvRows)}
          onExportPdf={() =>
            downloadPdf({
              filename: `revenue-summary-${year}.pdf`,
              title: "Revenue Summary",
              subtitle,
              headers,
              rows: pdfRows,
              footerRow,
            })
          }
          onPrint={() => window.print()}
        />
      </div>

      <div className="hidden mb-2 print:block">
        <h2 className="text-base font-bold text-gray-800">Revenue Summary</h2>
        <p className="text-xs text-gray-500">{subtitle}</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 print:hidden">
        <SummaryCard label="Total Billed" value={`\u20b1${fmt(totalBilled)}`} />
        <SummaryCard label="Total Collected" value={`\u20b1${fmt(totalCollected)}`} accent={GREEN} />
        <SummaryCard label="Collection Rate" value={`${collectionRate.toFixed(1)}%`} accent={collectionRate >= 90 ? GREEN : collectionRate >= 60 ? AMBER : RED} />
      </div>

      {loading ? (
        <LoadingRow />
      ) : (
        <div className="overflow-hidden border border-gray-200 rounded-lg">
          <table className="w-full text-xs">
            <thead className="text-gray-500 bg-gray-50">
              <tr>
                <th className="px-3 py-2 font-medium text-left">Month</th>
                <th className="px-3 py-2 font-medium text-right">Billed</th>
                <th className="px-3 py-2 font-medium text-right">Collected</th>
                <th className="px-3 py-2 font-medium text-right">Variance</th>
              </tr>
            </thead>
            <tbody>
              {MONTHS.map((m, i) => {
                const variance = monthlyCollected[i] - monthlyBilled[i];
                return (
                  <tr key={m} className="border-t border-gray-50">
                    <td className="px-3 py-2 text-gray-800">{m}</td>
                    <td className="px-3 py-2 font-mono text-right text-gray-700">{fmt(monthlyBilled[i])}</td>
                    <td className="px-3 py-2 font-mono text-right text-gray-700">{fmt(monthlyCollected[i])}</td>
                    <td className="px-3 py-2 font-mono text-right" style={{ color: variance < 0 ? RED : GREEN }}>
                      {variance >= 0 ? "+" : ""}{fmt(variance)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-200 bg-gray-50">
                <td className="px-3 py-2 font-semibold text-gray-700">Total</td>
                <td className="px-3 py-2 font-mono font-bold text-right text-gray-700">{fmt(totalBilled)}</td>
                <td className="px-3 py-2 font-mono font-bold text-right" style={{ color: GREEN }}>{fmt(totalCollected)}</td>
                <td className="px-3 py-2 font-mono font-bold text-right" style={{ color: totalCollected - totalBilled < 0 ? RED : GREEN }}>
                  {totalCollected - totalBilled >= 0 ? "+" : ""}{fmt(totalCollected - totalBilled)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Tab 4: AR Aging Summary — consolidated bucket totals + top outstanding clients, as of today ──
// Same FIFO-allocation convention as ARAgingReport.jsx (general/unapplied payments pooled per
// client and applied oldest-invoice-first) so the totals here tie out with that page.
function AgingSummary() {
  const [loading, setLoading] = useState(false);
  const [clientRows, setClientRows] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null); // client row for the detail modal
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: statements, error: stErr } = await supabase
        .from("billing_statements")
        .select("id, soa_number, client_id, soa_date, due_date, status")
        .in("status", ["approved", "unpaid"]);
      if (stErr) throw stErr;

      const billingIds = (statements || []).map((s) => s.id);
      let itemTotals = {};
      if (billingIds.length > 0) {
        const { data: items, error: itErr } = await supabase
          .from("billing_items")
          .select("billing_id, amount")
          .in("billing_id", billingIds);
        if (itErr) throw itErr;
        (items || []).forEach((i) => {
          itemTotals[i.billing_id] = (itemTotals[i.billing_id] || 0) + (Number(i.amount) || 0);
        });
      }

      const clientIds = [...new Set((statements || []).map((s) => s.client_id))];
      let receiptsByClient = {};
      if (clientIds.length > 0) {
        const { data: receipts, error: orErr } = await supabase
          .from("official_receipts")
          .select("client_id, billing_id, amount")
          .in("client_id", clientIds);
        if (orErr) throw orErr;
        (receipts || []).forEach((r) => {
          if (!receiptsByClient[r.client_id]) receiptsByClient[r.client_id] = [];
          receiptsByClient[r.client_id].push(r);
        });
      }

      let clientMap = {};
      if (clientIds.length > 0) {
        const { data: clients } = await supabase
          .from("client_profile")
          .select("client_id, business_name, trade_name, first_name, middle_name, last_name")
          .in("client_id", clientIds);
        (clients || []).forEach((c) => { clientMap[c.client_id] = c; });
      }

      const byClient = {};
      (statements || []).forEach((s) => {
        if (!byClient[s.client_id]) byClient[s.client_id] = [];
        byClient[s.client_id].push({ ...s, charge: itemTotals[s.id] || 0 });
      });

      const result = Object.entries(byClient).map(([clientId, invoices]) => {
        const sortedInvoices = [...invoices].sort((a, b) => new Date(a.soa_date) - new Date(b.soa_date));

        let pool = 0;
        const applied = {};
        (receiptsByClient[clientId] || []).forEach((r) => {
          if (r.billing_id) {
            applied[r.billing_id] = (applied[r.billing_id] || 0) + (Number(r.amount) || 0);
          } else {
            pool += Number(r.amount) || 0;
          }
        });

               const bucketTotals = { current: 0, b1_30: 0, b31_60: 0, b61_90: 0, b90_plus: 0 };
        let totalBalance = 0;
        let oldestDueDate = null;
        const invoiceDetails = []; // per-invoice breakdown, shown in the detail modal

        sortedInvoices.forEach((inv) => {
          const originalCharge = inv.charge;
          const appliedDirect = applied[inv.id] || 0;
          let remaining = originalCharge - appliedDirect;
          let poolTaken = 0;
          if (remaining > 0 && pool > 0) {
            const take = Math.min(pool, remaining);
            remaining -= take;
            pool -= take;
            poolTaken = take;
          }
          if (remaining <= 0.005) return;

          const days = daysOverdue(inv.due_date);
          totalBalance += remaining;
          bucketTotals[bucketFor(days)] += remaining;
          if (!oldestDueDate || new Date(inv.due_date) < new Date(oldestDueDate)) {
            oldestDueDate = inv.due_date;
          }

          invoiceDetails.push({
            id: inv.id,
            soa_number: inv.soa_number,
            soa_date: inv.soa_date,
            due_date: inv.due_date,
            charge: originalCharge,
            paid: appliedDirect + poolTaken,
            balance: remaining,
            days_overdue: days,
            bucket: bucketFor(days),
          });
        });

        return {
          client_id: clientId,
          clientName: clientDisplayName(clientMap[clientId]),
          total_balance: totalBalance,
          oldest_due_date: oldestDueDate,
          invoices: invoiceDetails,
          ...bucketTotals,
        };
      });

      setClientRows(result.filter((r) => r.total_balance > 0.005).sort((a, b) => b.total_balance - a.total_balance));
    } catch (err) {
      console.error("Error loading AR aging summary:", err.message);
      setClientRows([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const bucketTotals = useMemo(() => {
    const t = { current: 0, b1_30: 0, b31_60: 0, b61_90: 0, b90_plus: 0 };
    clientRows.forEach((r) => BUCKETS.forEach((b) => (t[b.key] += r[b.key] || 0)));
    return t;
  }, [clientRows]);

  const grandTotal = useMemo(() => clientRows.reduce((s, r) => s + r.total_balance, 0), [clientRows]);
  const top10 = clientRows.slice(0, 10);

  const subtitle = `As of ${fmtDate(new Date().toISOString())}`;
  const headers = ["Client", "Oldest Due Date", ...BUCKETS.map((b) => b.label), "Total Balance"];
  const csvRows = clientRows.map((r) => [
    r.clientName, fmtDate(r.oldest_due_date), ...BUCKETS.map((b) => fmt(r[b.key])), fmt(r.total_balance),
  ]);
  const pdfRows = csvRows;
  const footerRow = ["Total", "", ...BUCKETS.map((b) => fmt(bucketTotals[b.key])), fmt(grandTotal)];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-end print:hidden">
        <ReportActions
          disabled={clientRows.length === 0}
          onExportCsv={() => downloadCsv(`ar-aging-summary-${new Date().toISOString().split("T")[0]}.csv`, headers, csvRows)}
          onExportPdf={() =>
            downloadPdf({
              filename: `ar-aging-summary-${new Date().toISOString().split("T")[0]}.pdf`,
              title: "AR Aging Summary",
              subtitle,
              headers,
              rows: pdfRows,
              footerRow,
              orientation: "landscape",
            })
          }
          onPrint={() => window.print()}
        />
      </div>

      <div className="hidden mb-2 print:block">
        <h2 className="text-base font-bold text-gray-800">AR Aging Summary</h2>
        <p className="text-xs text-gray-500">{subtitle}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 print:hidden">
        {BUCKETS.map((b) => (
          <SummaryCard key={b.key} label={b.label} value={`\u20b1${fmt(bucketTotals[b.key])}`} accent={b.color} />
        ))}
      </div>
      <div className="print:hidden">
        <SummaryCard label="Total Outstanding (All Clients)" value={`\u20b1${fmt(grandTotal)}`} accent={RED} />
      </div>

      {loading ? (
        <LoadingRow />
      ) : (
        <div className="overflow-hidden border border-gray-200 rounded-lg">
          <table className="w-full text-xs">
            <thead className="text-gray-500 bg-gray-50">
              <tr>
                <th className="px-3 py-2 font-medium text-left">Client</th>
                <th className="px-3 py-2 font-medium text-left">Oldest Due</th>
                {BUCKETS.map((b) => (
                  <th key={b.key} className="px-3 py-2 font-medium text-right">{b.label}</th>
                ))}
                <th className="px-3 py-2 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {clientRows.length === 0 ? (
                <tr><td colSpan={7} className="py-6 text-center text-gray-400">No outstanding balances.</td></tr>
              ) : (
                       (clientRows.length > 20 ? top10 : clientRows).map((r) => (
                  <tr
                    key={r.client_id}
                    onClick={() => setSelectedClient(r)}
                    className="transition border-t cursor-pointer border-gray-50 hover:bg-gray-50/60"
                  >
                    <td className="px-3 py-2 text-gray-800">{r.clientName}</td>
                    <td className="px-3 py-2 text-gray-600">{fmtDate(r.oldest_due_date)}</td>
                    {BUCKETS.map((b) => (
                      <td key={b.key} className="px-3 py-2 font-mono text-right text-gray-600">
                        {r[b.key] > 0.005 ? fmt(r[b.key]) : <span className="text-gray-300">—</span>}
                      </td>
                    ))}
                    <td className="px-3 py-2 font-mono font-semibold text-right text-gray-800">{fmt(r.total_balance)}</td>
                  </tr>
                ))
              )}
            </tbody>
            {clientRows.length > 0 && (
              <tfoot>
                <tr className="border-t border-gray-200 bg-gray-50">
                  <td colSpan={2} className="px-3 py-2 font-semibold text-right text-gray-700">Total ({clientRows.length} clients)</td>
                  {BUCKETS.map((b) => (
                    <td key={b.key} className="px-3 py-2 font-mono font-semibold text-right text-gray-700">{fmt(bucketTotals[b.key])}</td>
                  ))}
                  <td className="px-3 py-2 font-mono font-bold text-right" style={{ color: RED }}>{fmt(grandTotal)}</td>
                </tr>
              </tfoot>
            )}
          </table>
          {clientRows.length > 20 && (
            <p className="px-3 py-2 text-[11px] text-gray-400 border-t border-gray-100 print:hidden">
              Showing top 10 of {clientRows.length} clients by balance — full list included in CSV/PDF export.
            </p>
          )}
        </div>
      )}

      {/* Detail modal — invoices behind a client's outstanding balance */}
      {selectedClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-2xl max-h-[85vh] flex flex-col bg-white shadow-2xl rounded-xl overflow-hidden">
            <div className="flex items-start justify-between flex-shrink-0 px-5 py-4 border-b border-gray-100">
              <div>
                <p className="text-sm font-semibold text-gray-800">{selectedClient.clientName}</p>
                <p className="text-[11px] text-gray-400 font-mono">{selectedClient.client_id}</p>
              </div>
              <button
                onClick={() => setSelectedClient(null)}
                className="p-1.5 text-gray-300 rounded-md hover:text-gray-500 hover:bg-gray-50"
              >
                ✕
              </button>
            </div>

            <div className="grid flex-shrink-0 grid-cols-2 gap-3 px-5 py-3 border-b border-gray-100 bg-gray-50 sm:grid-cols-5">
              {BUCKETS.map((b) => (
                <div key={b.key}>
                  <p className="text-[10px] font-medium tracking-wide text-gray-400 uppercase">{b.label}</p>
                  <p className="font-mono text-xs font-semibold" style={{ color: selectedClient[b.key] > 0.005 ? b.color : "#9ca3af" }}>
                    ₱{fmt(selectedClient[b.key])}
                  </p>
                </div>
              ))}
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 text-gray-500 bg-white border-b border-gray-100">
                  <tr>
                    <th className="px-5 py-2 font-medium text-left">SOA #</th>
                    <th className="px-3 py-2 font-medium text-left">Due Date</th>
                    <th className="px-3 py-2 font-medium text-right">Charge</th>
                    <th className="px-3 py-2 font-medium text-right">Paid</th>
                    <th className="px-3 py-2 font-medium text-right">Balance</th>
                    <th className="px-5 py-2 font-medium text-center">Bucket</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedClient.invoices.map((inv) => {
                    const bucketMeta = BUCKETS.find((b) => b.key === inv.bucket);
                    return (
                      <tr key={inv.id} className="border-b border-gray-50">
                        <td className="px-5 py-2.5 font-mono text-gray-700 whitespace-nowrap">{inv.soa_number}</td>
                        <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">
                          {fmtDate(inv.due_date)}
                          {inv.days_overdue > 0 && (
                            <span className="ml-1 text-[10px] text-gray-400">({inv.days_overdue}d)</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-right text-gray-700">₱{fmt(inv.charge)}</td>
                        <td className="px-3 py-2.5 font-mono text-right text-gray-500">
                          {inv.paid > 0.005 ? `₱${fmt(inv.paid)}` : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-3 py-2.5 font-mono font-semibold text-right text-gray-800">₱{fmt(inv.balance)}</td>
                        <td className="px-5 py-2.5 text-center">
                          <span
                            className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold"
                            style={{ background: `${bucketMeta.color}1a`, color: bucketMeta.color }}
                          >
                            {bucketMeta.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-200 bg-gray-50">
                    <td colSpan={2} className="px-5 py-2.5 font-medium text-right text-gray-600">
                      Total ({selectedClient.invoices.length} invoice{selectedClient.invoices.length !== 1 ? "s" : ""})
                    </td>
                    <td className="px-3 py-2.5 font-mono font-bold text-right text-gray-700">
                      ₱{fmt(selectedClient.invoices.reduce((s, i) => s + i.charge, 0))}
                    </td>
                    <td className="px-3 py-2.5 font-mono font-bold text-right text-gray-700">
                      ₱{fmt(selectedClient.invoices.reduce((s, i) => s + i.paid, 0))}
                    </td>
                    <td className="px-3 py-2.5 font-mono font-bold text-right" style={{ color: RED }}>
                      ₱{fmt(selectedClient.total_balance)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="flex justify-end flex-shrink-0 px-5 py-3 border-t border-gray-100 bg-gray-50">
              <button
                onClick={() => setSelectedClient(null)}
                className="px-3 py-2 text-xs font-medium text-gray-600 border border-gray-200 rounded-md hover:bg-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────
const TABS = [
  { key: "collections", label: "Collections Report", icon: <FaFileInvoiceDollar size={12} />, needsMonth: true },
  { key: "bank", label: "Bank Reconciliation Summary", icon: <FaUniversity size={12} />, needsMonth: true },
  { key: "revenue", label: "Revenue Summary", icon: <FaChartBar size={12} />, needsMonth: false },
  { key: "aging", label: "AR Aging Summary", icon: <FaCoins size={12} />, needsMonth: false, hideYear: true },
];

export default function FinancialReports() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [activeTab, setActiveTab] = useState("collections");

  const tabMeta = TABS.find((t) => t.key === activeTab);

  return (
    <div className="min-h-screen bg-gray-50 print:bg-white">
      <div className="sticky top-0 z-10 px-6 py-4 bg-white border-b border-gray-200 print:hidden">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex items-center justify-center rounded-full w-9 h-9" style={{ background: "#e8f5ec" }}>
            <FaChartLine size={14} style={{ color: GREEN }} />
          </div>
          <h1 className="text-sm font-semibold text-gray-800">Financial Reports</h1>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          {tabMeta?.needsMonth && (
            <div>
              <label className={labelCls}>Month</label>
              <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className={`${inputCls} w-40`}>
                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </div>
          )}
          {!tabMeta?.hideYear && (
            <div>
              <label className={labelCls}>Year</label>
              <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className={`${inputCls} w-24`} />
            </div>
          )}
        </div>

        <div className="flex gap-1 mt-4 overflow-x-auto border-b border-gray-100">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-medium border-b-2 whitespace-nowrap transition ${
                activeTab === t.key ? "border-current" : "border-transparent text-gray-400 hover:text-gray-600"
              }`}
              style={activeTab === t.key ? { color: GREEN, borderColor: GREEN } : {}}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6 print:p-0">
        {activeTab === "collections" && <CollectionsReport month={month} year={year} />}
        {activeTab === "bank" && <BankReconciliationSummary month={month} year={year} />}
        {activeTab === "revenue" && <RevenueSummary year={year} />}
        {activeTab === "aging" && <AgingSummary />}
      </div>
    </div>
  );
}