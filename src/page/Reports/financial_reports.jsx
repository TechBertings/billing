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
  FaEye,
  FaSearch,
  FaTimes,
} from "react-icons/fa";

const GREEN = "#1a5c2e";
const GREEN_RGB = [26, 92, 46];
const RED = "#c0392b";
const AMBER = "#b7791f";
const BLUE = "#2563eb";
const OTHER = "__other__"; // remittance not tied to a specific account

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
const num = (v) => Number(v) || 0;

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
// Built from plain numbers (not toISOString) so the last day isn't shifted back by the timezone
function lastDayOfMonth(year, month) {
  const d = new Date(year, month, 0).getDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
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
const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

// Supabase returns max 1000 rows per request — page through everything
async function fetchAll(buildQuery) {
  const size = 1000;
  let all = [];
  let offset = 0;
  while (true) {
    const { data, error } = await buildQuery().range(offset, offset + size - 1);
    if (error) throw error;
    all = all.concat(data || []);
    if (!data || data.length < size) break;
    offset += size;
  }
  return all;
}

// Extra info shown next to the payment method (cheque no., bank, reference, collector)
function methodDetail(r) {
  const parts = [];
  if (r.payment_method === "cheque") {
    if (r.cheque_number) parts.push(`Cheque #${r.cheque_number}`);
    if (r.cheque_bank) parts.push(r.cheque_bank);
  }
  if (r.payment_method === "bank_transfer" && r.drawee_bank) parts.push(`From ${r.drawee_bank}`);
  if (r.reference_number) parts.push(`Ref ${r.reference_number}`);
  if ((r.payment_method === "cash" || r.payment_method === "cheque") && r.collected_by)
    parts.push(`Collected by ${r.collected_by}`);
  return parts.join(" · ");
}

// Totals for a list of receipts. Applied credit isn't cash, so it's tracked separately.
function summarize(list) {
  const s = { count: list.length, income: 0, remit: 0, total: 0, credit: 0, undeposited: 0 };
  list.forEach((r) => {
    const amt = num(r.amount);
    if (r.payment_method === "credit") {
      s.credit += amt;
      return;
    }
    s.total += amt;
    s.income += num(r.income_amount);
    s.remit += num(r.remittance_amount);
    if (r.deposit_status !== "deposited") s.undeposited += amt;
  });
  return s;
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

function SummaryCard({ label, value, accent, hint }) {
  return (
    <div className="p-4 bg-white border border-gray-200 rounded-lg">
      <p className="text-xs font-medium text-gray-400">{label}</p>
      <p className="mt-1 text-lg font-bold" style={{ color: accent || "#1f2937" }}>{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-gray-400">{hint}</p>}
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

// Eye button used in table rows
function EyeButton({ onClick, title = "View details" }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={title}
      className="p-1.5 text-gray-400 transition rounded-md hover:text-green-700 hover:bg-green-50"
    >
      <FaEye size={13} />
    </button>
  );
}

// Generic modal shell (click outside / Esc closes)
function Modal({ onClose, children, wide = false, z = 50, closeOnEsc = true }) {
  useEffect(() => {
    if (!closeOnEsc) return;
    const h = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose, closeOnEsc]);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4 bg-black/50 print:hidden"
      style={{ zIndex: z }}
      onMouseDown={onClose}
    >
      <div
        className={`w-full ${wide ? "max-w-5xl" : "max-w-2xl"} max-h-[88vh] flex flex-col bg-white shadow-2xl rounded-xl overflow-hidden`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

// Status pill for a receipt row
function StatusBadge({ r }) {
  if (num(r.amount) < 0)
    return (
      <span className="inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-full" style={{ background: "#fdecea", color: RED }}>
        Reversal
      </span>
    );
  if (r.payment_method === "credit")
    return (
      <span className="inline-flex px-2 py-0.5 text-[10px] font-semibold text-gray-600 bg-gray-100 rounded-full">
        Credit applied
      </span>
    );
  if (r.deposit_status === "deposited")
    return (
      <span className="inline-flex px-2 py-0.5 text-[10px] font-semibold text-green-700 bg-green-100 rounded-full">
        Deposited
      </span>
    );
  return (
    <span className="inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-full" style={{ background: "#fef3c7", color: AMBER }}>
      Undeposited
    </span>
  );
}

function Fact({ label, value, mono }) {
  return (
    <div>
      <p className="text-[10px] font-medium tracking-wide text-gray-400">{label}</p>
      <p className={`text-xs text-gray-800 ${mono ? "font-mono" : ""}`}>{value || "—"}</p>
    </div>
  );
}

// ── Receipt detail modal: who paid, how, how much went to income vs remittance, per account ──
function ReceiptModal({ receipt, acctNames, typeFilter = "all", onClose }) {
  const [items, setItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);

  useEffect(() => {
    if (!receipt.billing_id) {
      setItems([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingItems(true);
      const { data } = await supabase
        .from("billing_items")
        .select("id, account_code, agency, description, period_covered, amount, item_type")
        .eq("billing_id", receipt.billing_id)
        .order("agency", { ascending: true });
      if (!cancelled) {
        setItems(data || []);
        setLoadingItems(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [receipt.billing_id]);

  const isCredit = receipt.payment_method === "credit";
  const income = num(receipt.income_amount);
  const remit = num(receipt.remittance_amount);
  const amount = num(receipt.amount);
  const split = Math.abs(income) + Math.abs(remit);
  const incomePct = split > 0 ? (Math.abs(income) / split) * 100 : 0;
const showInc = typeFilter !== "remittance";
const showRem = typeFilter !== "income";
const shownAmount = typeFilter === "income" ? income : typeFilter === "remittance" ? remit : amount;
const visibleItems = items.filter((it) =>
  typeFilter === "all"
    ? true
    : typeFilter === "remittance"
      ? it.item_type === "remittance"
      : it.item_type !== "remittance",
);
  const bd =
    receipt.remittance_breakdown && typeof receipt.remittance_breakdown === "object"
      ? Object.entries(receipt.remittance_breakdown).filter(([, v]) => Math.abs(num(v)) > 0.005)
      : [];
  const acctLabel = (code) => (code === OTHER ? "Unallocated" : acctNames[code] || code);

  return (
    <Modal onClose={onClose} z={60}>
      <div className="flex items-start justify-between flex-shrink-0 px-5 py-4 border-b border-gray-100">
        <div>
          <p className="text-sm font-semibold text-gray-800">{receipt.clientName}</p>
          <p className="font-mono text-[11px] text-gray-400">{receipt.invoice_number}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge r={receipt} />
          <button onClick={onClose} className="p-1.5 text-gray-300 rounded-md hover:text-gray-500 hover:bg-gray-50">
            <FaTimes size={12} />
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 px-5 py-4 space-y-5 overflow-y-auto">
    {/* Amount split */}
<div>
  <div className="flex items-end justify-between">
    <div>
      <p className="text-[10px] font-medium tracking-wide text-gray-400">
        {typeFilter === "income" ? "Income portion" : typeFilter === "remittance" ? "Remittance portion" : "Amount paid"}
      </p>
      <p className="font-mono text-xl font-bold text-gray-800" style={shownAmount < 0 ? { color: RED } : undefined}>
        ₱{fmt(shownAmount)}
      </p>
    </div>
    {isCredit && <p className="text-[11px] text-gray-400">Applied from client credit, not cash received</p>}
  </div>

  {typeFilter === "all" && (
    <div className="flex h-2 mt-3 overflow-hidden bg-gray-100 rounded-full">
      <div style={{ width: `${incomePct}%`, background: BLUE }} />
      <div style={{ width: `${100 - incomePct}%`, background: split > 0 ? AMBER : "transparent" }} />
    </div>
  )}

  <div className={`grid gap-3 mt-3 ${typeFilter === "all" ? "grid-cols-2" : "grid-cols-1"}`}>
    {showInc && (
      <div className="p-3 border border-blue-100 rounded-lg bg-blue-50/50">
        <p className="text-[10px] font-medium text-blue-700">Income (Retainer / fees)</p>
        <p className="font-mono text-sm font-semibold text-blue-700">₱{fmt(income)}</p>
      </div>
    )}
    {showRem && (
      <div className="p-3 border rounded-lg border-amber-100 bg-amber-50/60">
        <p className="text-[10px] font-medium text-amber-700">Gov't remittance</p>
        <p className="font-mono text-sm font-semibold text-amber-700">₱{fmt(remit)}</p>
      </div>
    )}
  </div>
</div>

        {/* Payment facts */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Fact label="Payment date" value={fmtDate(receipt.payment_date)} />
          <Fact label="Payment method" value={paymentMethodLabel(receipt)} />
          <Fact label="SOA" value={receipt.soa_number || "General / unapplied"} mono />
          {receipt.payment_method === "cheque" && (
            <>
              <Fact label="Cheque no." value={receipt.cheque_number} mono />
              <Fact label="Cheque bank" value={receipt.cheque_bank} />
              <Fact label="Drawee bank" value={receipt.drawee_bank} />
            </>
          )}
          {receipt.payment_method === "bank_transfer" && (
            <>
              <Fact label="From bank" value={receipt.drawee_bank} />
              <Fact label="Received in" value={receipt.receiving_bank ? receipt.receiving_bank.toUpperCase() : ""} />
            </>
          )}
          <Fact label="Reference no." value={receipt.reference_number} mono />
          {(receipt.payment_method === "cash" || receipt.payment_method === "cheque") && (
            <Fact label="Collected by" value={receipt.collected_by} />
          )}
          <Fact label="Recorded by" value={receipt.recorded_by} />
          {!isCredit && (
            <Fact
              label="Deposit"
              value={
                receipt.deposit_status === "deposited"
                  ? `Deposited${receipt.deposited_date ? ` · ${fmtDate(receipt.deposited_date)}` : ""}`
                  : "Undeposited"
              }
            />
          )}
        </div>

       {/* Remittance per account */}
{showRem && Math.abs(remit) > 0.005 && (
  <div>
    <p className="mb-2 text-xs font-semibold text-gray-700">Remittance by account</p>
            {bd.length === 0 ? (
              <p className="px-3 py-2 text-xs text-gray-400 border border-gray-200 border-dashed rounded-md">
                This older receipt isn't tagged per account yet.
              </p>
            ) : (
              <div className="overflow-hidden border border-gray-100 rounded-lg">
                <table className="w-full text-xs">
                  <thead className="text-gray-500 bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 font-medium text-left">Account</th>
                      <th className="px-3 py-2 font-medium text-left">Code</th>
                      <th className="px-3 py-2 font-medium text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bd.map(([code, v]) => (
                      <tr key={code} className="border-t border-gray-50">
                        <td className="px-3 py-2 text-gray-800">{acctLabel(code)}</td>
                        <td className="px-3 py-2 font-mono text-gray-400">{code === OTHER ? "—" : code}</td>
                        <td className="px-3 py-2 font-mono text-right text-amber-700">₱{fmt(v)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* SOA lines */}
        {receipt.billing_id && (
          <div>
            <p className="mb-2 text-xs font-semibold text-gray-700">
              Statement lines{receipt.soa_number ? ` · ${receipt.soa_number}` : ""}
            </p>
    {loadingItems ? (
  <LoadingRow />
) : visibleItems.length === 0 ? (
  <p className="px-3 py-2 text-xs text-gray-400 border border-gray-200 border-dashed rounded-md">
    No {typeFilter === "all" ? "" : typeFilter + " "}line items found.
  </p>
) : (
              <div className="overflow-hidden border border-gray-100 rounded-lg">
                <table className="w-full text-xs">
                  <thead className="text-gray-500 bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 font-medium text-left">Agency</th>
                      <th className="px-3 py-2 font-medium text-left">Description</th>
                      <th className="px-3 py-2 font-medium text-left">Period</th>
                      <th className="px-3 py-2 font-medium text-left">Type</th>
                      <th className="px-3 py-2 font-medium text-right">Billed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleItems.map((it) => (
                      <tr key={it.id} className="border-t border-gray-50">
                        <td className="px-3 py-2 text-gray-700">{it.agency || "—"}</td>
                        <td className="px-3 py-2 text-gray-600">{it.description || "—"}</td>
                        <td className="px-3 py-2 text-gray-400">{it.period_covered || "—"}</td>
                        <td className="px-3 py-2">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${
                              it.item_type === "remittance" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"
                            }`}
                          >
                            {it.item_type === "remittance" ? "Remittance" : "Income"}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono text-right text-gray-700">₱{fmt(it.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {receipt.notes && (
          <div>
            <p className="text-[10px] font-medium tracking-wide text-gray-400">Notes</p>
            <p className="text-xs text-gray-700">{receipt.notes}</p>
          </div>
        )}
      </div>

      <div className="flex justify-end flex-shrink-0 px-5 py-3 border-t border-gray-100 bg-gray-50">
        <button onClick={onClose} className="px-3 py-2 text-xs font-medium text-gray-600 border border-gray-200 rounded-md hover:bg-white">
          Close
        </button>
      </div>
    </Modal>
  );
}

// ── Group modal: every receipt behind a client / payment-method row ──
function GroupModal({ group, groupBy, onClose, onOpenReceipt, receiptOpen }) {
  const s = summarize(group.list);

  // payment-method mix inside a client group
  const methodMix = useMemo(() => {
    const m = {};
    group.list.forEach((r) => {
      const k = paymentMethodLabel(r);
      m[k] = (m[k] || 0) + num(r.amount);
    });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [group]);

  return (
    <Modal onClose={onClose} wide closeOnEsc={!receiptOpen}>
      <div className="flex items-start justify-between flex-shrink-0 px-5 py-4 border-b border-gray-100">
        <div>
          <p className="text-sm font-semibold text-gray-800">{group.label}</p>
          <p className="text-[11px] text-gray-400">
            {groupBy === "client" ? "Client" : "Payment method"} · {s.count} receipt{s.count !== 1 ? "s" : ""}
          </p>
        </div>
        <button onClick={onClose} className="p-1.5 text-gray-300 rounded-md hover:text-gray-500 hover:bg-gray-50">
          <FaTimes size={12} />
        </button>
      </div>

      <div className="grid flex-shrink-0 grid-cols-2 gap-3 px-5 py-3 border-b border-gray-100 bg-gray-50 sm:grid-cols-4">
        <div>
          <p className="text-[10px] font-medium text-gray-400">Total collected</p>
          <p className="font-mono text-xs font-semibold" style={{ color: GREEN }}>₱{fmt(s.total)}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium text-gray-400">Income</p>
          <p className="font-mono text-xs font-semibold text-blue-700">₱{fmt(s.income)}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium text-gray-400">Remittance</p>
          <p className="font-mono text-xs font-semibold text-amber-700">₱{fmt(s.remit)}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium text-gray-400">Undeposited</p>
          <p className="font-mono text-xs font-semibold text-gray-600">₱{fmt(s.undeposited)}</p>
        </div>
        {groupBy === "client" && methodMix.length > 0 && (
          <div className="col-span-2 sm:col-span-4">
            <p className="text-[10px] font-medium text-gray-400">Paid through</p>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {methodMix.map(([label, v]) => (
                <span key={label} className="px-2 py-0.5 text-[11px] text-gray-600 bg-white border border-gray-200 rounded-full">
                  {label} · <span className="font-mono">₱{fmt(v)}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 text-gray-500 bg-white border-b border-gray-100">
            <tr>
              <th className="px-4 py-2 font-medium text-left">Date</th>
              <th className="px-3 py-2 font-medium text-left">OR #</th>
              {groupBy === "client" ? (
                <th className="px-3 py-2 font-medium text-left">Method</th>
              ) : (
                <th className="px-3 py-2 font-medium text-left">Client</th>
              )}
              <th className="px-3 py-2 font-medium text-right">Income</th>
              <th className="px-3 py-2 font-medium text-right">Remittance</th>
              <th className="px-3 py-2 font-medium text-right">Total</th>
              <th className="px-3 py-2 font-medium text-center">Status</th>
              <th className="w-10 px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {group.list.map((r) => (
              <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50/60">
                <td className="px-4 py-2 text-gray-600 whitespace-nowrap">{fmtDate(r.payment_date)}</td>
                <td className="px-3 py-2 font-mono text-gray-500">{r.invoice_number}</td>
                <td className="px-3 py-2 text-gray-800">
                  {groupBy === "client" ? paymentMethodLabel(r) : r.clientName}
                  {methodDetail(r) && groupBy === "client" && (
                    <span className="block text-[10px] text-gray-400">{methodDetail(r)}</span>
                  )}
                </td>
                <td className="px-3 py-2 font-mono text-right text-blue-700">{fmt(r.income_amount)}</td>
                <td className="px-3 py-2 font-mono text-right text-amber-700">{fmt(r.remittance_amount)}</td>
                <td className="px-3 py-2 font-mono font-semibold text-right text-gray-800">{fmt(r.amount)}</td>
                <td className="px-3 py-2 text-center"><StatusBadge r={r} /></td>
                <td className="px-3 py-2 text-right"><EyeButton onClick={() => onOpenReceipt(r)} /></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-gray-200 bg-gray-50">
              <td colSpan={3} className="px-4 py-2.5 font-medium text-right text-gray-600">Total</td>
              <td className="px-3 py-2.5 font-mono font-bold text-right text-blue-700">{fmt(s.income)}</td>
              <td className="px-3 py-2.5 font-mono font-bold text-right text-amber-700">{fmt(s.remit)}</td>
              <td className="px-3 py-2.5 font-mono font-bold text-right" style={{ color: GREEN }}>{fmt(s.total)}</td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex justify-end flex-shrink-0 px-5 py-3 border-t border-gray-100 bg-gray-50">
        <button onClick={onClose} className="px-3 py-2 text-xs font-medium text-gray-600 border border-gray-200 rounded-md hover:bg-white">
          Close
        </button>
      </div>
    </Modal>
  );
}
// Small segmented toggle used by the Collections Report filters
function Pills({ value, onChange, options }) {
  return (
    <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-md w-fit">
      {options.map(([k, label]) => (
        <button
          key={k}
          onClick={() => onChange(k)}
          className={`px-3 py-1.5 text-xs font-medium rounded transition ${
            value === k ? "bg-white shadow-sm text-gray-800" : "text-gray-500"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// ── Tab 1: Collections Report — pick a client first, then view that client's receipts ──
function CollectionsReport({ month, year }) {
  // client picker
  const [clientQuery, setClientQuery] = useState("");
  const [clientResults, setClientResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [client, setClient] = useState(null); // { client_id, name }

  // report data (only loaded after a client is picked)
  const [loading, setLoading] = useState(false);
  const [receipts, setReceipts] = useState([]);
  const [acctNames, setAcctNames] = useState({});

  // filters
  const [methodFilter, setMethodFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all"); // "all" | "income" | "remittance"
  const [receiptModal, setReceiptModal] = useState(null);

const [activeIdx, setActiveIdx] = useState(0);

// ── Client list: shows first 10 on open, filters as you type ──
useEffect(() => {
  if (!pickerOpen) return;
  const q = clientQuery.trim().replace(/[,()%]/g, " ");
  let cancelled = false;

  const t = setTimeout(
    async () => {
      setSearching(true);
      let query = supabase
        .from("client_profile")
        .select("client_id, business_name, trade_name, first_name, middle_name, last_name")
        .order("business_name", { ascending: true, nullsFirst: false })
        .limit(10);

      if (q) {
        query = query.or(
          `business_name.ilike.%${q}%,trade_name.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%,client_id.ilike.%${q}%`,
        );
      }

      const { data, error } = await query;
      if (!cancelled) {
        setClientResults(error ? [] : data || []);
        setActiveIdx(0);
        setSearching(false);
      }
    },
    q ? 300 : 0, // no delay on first open, debounce while typing
  );

  return () => {
    cancelled = true;
    clearTimeout(t);
  };
}, [clientQuery, pickerOpen]);
  const pickClient = (c) => {
    setClient({ client_id: c.client_id, name: clientDisplayName(c) });
    setClientQuery("");
    setClientResults([]);
    setPickerOpen(false);
    setMethodFilter("all");
    setTypeFilter("all");
  };

  const clearClient = () => {
    setClient(null);
    setReceipts([]);
    setMethodFilter("all");
    setTypeFilter("all");
  };

  // ── Fetch receipts for the selected client + period ──
  const load = useCallback(async () => {
    if (!client) return;
    setLoading(true);
    try {
      const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
      const endDate = lastDayOfMonth(year, month);

      const rowsData = await fetchAll(() =>
        supabase
          .from("official_receipts")
          .select(
            "id, invoice_number, payment_date, amount, income_amount, remittance_amount, remittance_breakdown, notes, client_id, billing_id, soa_number, payment_method, receiving_bank, cheque_number, cheque_bank, drawee_bank, reference_number, collected_by, recorded_by, deposit_status, deposited_date",
          )
          .eq("client_id", client.client_id)
          .gte("payment_date", startDate)
          .lte("payment_date", endDate)
          .order("payment_date", { ascending: false })
          .order("id", { ascending: false }),
      );

      const { data: accts } = await supabase.from("chart_of_accounts").select("code, account_name");
      const names = {};
      (accts || []).forEach((a) => { if (a.code) names[a.code] = a.account_name; });
      setAcctNames(names);

      setReceipts(rowsData.map((r) => ({ ...r, clientName: client.name })));
    } catch (err) {
      console.error("Error loading collections report:", err.message);
      setReceipts([]);
    }
    setLoading(false);
  }, [client, month, year]);

  useEffect(() => { load(); }, [load]);

const showInc = typeFilter !== "remittance";
const showRem = typeFilter !== "income";

  // Income / Remittance filter: keep only the chosen portion of each receipt
  const typed = useMemo(() => {
    if (typeFilter === "all") return receipts.map((r) => ({ ...r, _orig: r }));
    return receipts
      .filter((r) => Math.abs(num(typeFilter === "income" ? r.income_amount : r.remittance_amount)) > 0.005)
      .map((r) =>
        typeFilter === "income"
          ? { ...r, amount: num(r.income_amount), remittance_amount: 0, _orig: r }
          : { ...r, amount: num(r.remittance_amount), income_amount: 0, _orig: r },
      );
  }, [receipts, typeFilter]);

  const methodOptions = useMemo(
    () => Array.from(new Set(typed.map((r) => paymentMethodLabel(r)))).sort(),
    [typed],
  );

  const filtered = useMemo(
    () => (methodFilter === "all" ? typed : typed.filter((r) => paymentMethodLabel(r) === methodFilter)),
    [typed, methodFilter],
  );

  const totals = useMemo(() => summarize(filtered), [filtered]);
  const showCredit = totals.credit !== 0;

  // "Paid through" cards (built from typed, so they stay visible after clicking one)
  const methodCards = useMemo(() => {
    const map = {};
    typed.forEach((r) => {
      const label = paymentMethodLabel(r);
      if (!map[label]) map[label] = [];
      map[label].push(r);
    });
    const all = summarize(typed).total;
    return Object.entries(map)
      .map(([label, list]) => ({
        label,
        stats: summarize(list),
        credit: list[0]?.payment_method === "credit",
        all,
      }))
      .sort((a, b) => b.stats.total - a.stats.total);
  }, [typed]);

  // ── Export ──
  const typeText = { all: "Income & Remittance", income: "Income only", remittance: "Remittance only" }[typeFilter];
  const subtitle = client
    ? `${client.name} · ${MONTHS[month - 1]} ${year} · ${typeText}${methodFilter !== "all" ? ` · ${methodFilter}` : ""}`
    : "";

  const headers = [
    "Date",
    "OR #",
    "Method",
    "Details",
    ...(showInc ? ["Income"] : []),
    ...(showRem ? ["Remittance"] : []),
    "Total",
    "Status",
  ];
  const statusText = (r) =>
    num(r.amount) < 0 ? "Reversal"
    : r.payment_method === "credit" ? "Credit applied"
    : r.deposit_status === "deposited" ? "Deposited"
    : "Undeposited";
  const csvRows = filtered.map((r) => [
    r.payment_date,
    r.invoice_number,
    paymentMethodLabel(r),
    methodDetail(r),
    ...(showInc ? [fmt(r.income_amount)] : []),
    ...(showRem ? [fmt(r.remittance_amount)] : []),
    fmt(r.amount),
    statusText(r),
  ]);
  const footerRow = [
    "Total", "", "", "",
    ...(showInc ? [fmt(totals.income)] : []),
    ...(showRem ? [fmt(totals.remit)] : []),
    fmt(totals.total),
    "",
  ];
  const safeName = (client?.name || "client").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const fileBase = `collections-${safeName}-${typeFilter}-${year}-${String(month).padStart(2, "0")}`;
  const th = "px-3 py-2 font-medium";
  const emptyCols = 5 + (showInc ? 1 : 0) + (showRem ? 1 : 0);

  return (
    <div className="space-y-5">
      {/* ── Step 1: pick a client ── */}
      <div className="print:hidden">
        <label className={labelCls}>Client</label>
        {client ? (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-2 text-sm font-medium border border-green-300 rounded-md bg-green-50/50" style={{ color: GREEN }}>
              {client.name}
              <span className="font-mono text-[10px] text-gray-400">{client.client_id}</span>
            </div>
            <button
              onClick={clearClient}
              className="flex items-center gap-1 px-2.5 py-2 text-xs font-medium text-gray-500 border border-gray-200 rounded-md hover:bg-gray-50"
            >
              <FaTimes size={10} /> Change client
            </button>
          </div>
        ) : (
        <div className="relative max-w-md">
  <FaSearch className="absolute text-gray-300 -translate-y-1/2 left-3 top-1/2" size={11} />
  <input
    type="text"
    value={clientQuery}
    onChange={(e) => { setClientQuery(e.target.value); setPickerOpen(true); }}
    onFocus={() => setPickerOpen(true)}
    onClick={() => setPickerOpen(true)}
    onBlur={() => setPickerOpen(false)}
    onKeyDown={(e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setPickerOpen(true);
        setActiveIdx((i) => Math.min(i + 1, clientResults.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && clientResults[activeIdx]) {
        e.preventDefault();
        pickClient(clientResults[activeIdx]);
      } else if (e.key === "Escape") {
        setPickerOpen(false);
      }
    }}
    placeholder="Click to browse clients, or type a name / ID..."
    className="w-full py-2 pl-8 pr-3 text-sm bg-white border border-gray-200 rounded-md focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
  />

  {pickerOpen && (
    <div className="absolute z-20 w-full mt-1 overflow-y-auto bg-white border border-gray-200 rounded-md shadow-lg max-h-72">
      <p className="px-3 pt-2 pb-1 text-[10px] font-medium tracking-wide text-gray-400 uppercase">
        {clientQuery.trim() ? "Search results" : "Clients"}
      </p>

      {searching && clientResults.length === 0 ? (
        <p className="px-3 py-2 text-xs text-gray-400">Loading...</p>
      ) : clientResults.length === 0 ? (
        <p className="px-3 py-2 text-xs text-gray-400">No clients found.</p>
      ) : (
        clientResults.map((c, i) => (
          <button
            key={c.client_id}
            onMouseDown={(e) => { e.preventDefault(); pickClient(c); }}
            onMouseEnter={() => setActiveIdx(i)}
            className={`flex items-center justify-between w-full px-3 py-2 text-left ${
              i === activeIdx ? "bg-green-50" : "hover:bg-gray-50"
            }`}
          >
            <span className="text-xs text-gray-800">{clientDisplayName(c)}</span>
            <span className="font-mono text-[10px] text-gray-400">{c.client_id}</span>
          </button>
        ))
      )}

      {clientResults.length === 10 && (
        <p className="px-3 py-2 text-[10px] text-gray-400 border-t border-gray-100">
          Showing first 10 — type to narrow down.
        </p>
      )}
    </div>
  )}
</div>
        )}
      </div>

      {!client ? (
        <div className="py-16 text-sm text-center text-gray-400 border border-gray-200 border-dashed rounded-lg">
          Choose a client to view collections.
        </div>
      ) : (
        <>
          {/* ── Step 2: filters + export ── */}
          <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
            <div className="flex flex-wrap items-center gap-3">
              <Pills
                value={typeFilter}
                onChange={setTypeFilter}
                options={[["all", "All"], ["income", "Income"], ["remittance", "Remittance"]]}
              />
              <select
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value)}
                className="px-3 py-2 text-xs bg-white border border-gray-200 rounded-md focus:outline-none focus:border-blue-400"
              >
                <option value="all">All payment methods</option>
                {methodOptions.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <ReportActions
              disabled={filtered.length === 0}
              onExportCsv={() => downloadCsv(`${fileBase}.csv`, headers, csvRows)}
              onExportPdf={() =>
                downloadPdf({
                  filename: `${fileBase}.pdf`,
                  title: "Collections Report",
                  subtitle,
                  headers,
                  rows: csvRows.map((r) => r.map(String)),
                  footerRow,
                  orientation: "landscape",
                })
              }
              onPrint={() => window.print()}
            />
          </div>

          <div className="hidden mb-2 print:block">
            <h2 className="text-base font-bold text-gray-800">Collections Report</h2>
            <p className="text-xs text-gray-500">{subtitle}</p>
          </div>

          {/* Summary */}
          <div className={`grid grid-cols-2 gap-3 ${showCredit ? "sm:grid-cols-5" : "sm:grid-cols-4"}`}>
            <SummaryCard label="Total Collected" value={`₱${fmt(totals.total)}`} accent={GREEN} hint={`${totals.count} receipt${totals.count !== 1 ? "s" : ""}`} />
            {showInc && <SummaryCard label="Income" value={`₱${fmt(totals.income)}`} accent={BLUE} hint="Retainer / fees" />}
            {showRem && <SummaryCard label="Remittance" value={`₱${fmt(totals.remit)}`} accent={AMBER} hint="Held for gov't agencies" />}
            <SummaryCard label="Undeposited" value={`₱${fmt(totals.undeposited)}`} accent={totals.undeposited > 0.005 ? RED : "#1f2937"} hint="Not yet in the bank" />
            {showCredit && <SummaryCard label="Credit Applied" value={`₱${fmt(totals.credit)}`} hint="Not cash received" />}
          </div>

          {/* Paid through (click to filter) */}
          {!loading && methodCards.length > 0 && (
            <div className="print:hidden">
              <p className="mb-2 text-xs font-semibold text-gray-700">Paid through</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {methodCards.map((m) => {
                  const pct = m.all > 0 && !m.credit ? (m.stats.total / m.all) * 100 : 0;
                  return (
                    <button
                      key={m.label}
                      onClick={() => setMethodFilter(methodFilter === m.label ? "all" : m.label)}
                      className={`p-3 text-left bg-white border rounded-lg transition hover:border-green-300 ${
                        methodFilter === m.label ? "border-green-400 bg-green-50/40" : "border-gray-200"
                      }`}
                      title="Click to filter by this method"
                    >
                      <p className="text-xs font-medium text-gray-600">{m.label}</p>
                      <p className="font-mono text-sm font-bold text-gray-800">
                        ₱{fmt(m.credit ? m.stats.credit : m.stats.total)}
                      </p>
                      <p className="text-[10px] text-gray-400">
                        {m.stats.count} receipt{m.stats.count !== 1 ? "s" : ""}
                        {!m.credit && ` · ${pct.toFixed(0)}%`}
                      </p>
                      {!m.credit && typeFilter === "all" && (
                        <p className="mt-1 text-[10px]">
                          <span className="text-blue-700">Inc {fmt(m.stats.income)}</span>
                          <span className="text-gray-300"> · </span>
                          <span className="text-amber-700">Rem {fmt(m.stats.remit)}</span>
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Receipts of the selected client */}
          {loading ? (
            <LoadingRow />
          ) : (
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full text-xs">
                <thead className="text-gray-500 bg-gray-50">
                  <tr>
                    <th className={`${th} text-left`}>Date</th>
                    <th className={`${th} text-left`}>OR #</th>
                    <th className={`${th} text-left`}>Method</th>
                    {showInc && <th className={`${th} text-right`}>Income</th>}
                    {showRem && <th className={`${th} text-right`}>Remittance</th>}
                    <th className={`${th} text-right`}>Total</th>
                    <th className={`${th} text-center`}>Status</th>
                    <th className={`${th} w-10 print:hidden`} />
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={emptyCols} className="py-6 text-center text-gray-400">
                        Walang collections ang client na ito sa period / filter na napili.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((r) => (
                      <tr key={r.id} className="border-t border-gray-50 hover:bg-gray-50/60">
                        <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{fmtDate(r.payment_date)}</td>
                        <td className="px-3 py-2 font-mono text-gray-500">{r.invoice_number}</td>
                        <td className="px-3 py-2 text-gray-700">
                          {paymentMethodLabel(r)}
                          {methodDetail(r) && <span className="block text-[10px] text-gray-400">{methodDetail(r)}</span>}
                        </td>
                        {showInc && <td className="px-3 py-2 font-mono text-right text-blue-700">{fmt(r.income_amount)}</td>}
                        {showRem && <td className="px-3 py-2 font-mono text-right text-amber-700">{fmt(r.remittance_amount)}</td>}
                        <td className="px-3 py-2 font-mono font-semibold text-right text-gray-800">{fmt(r.amount)}</td>
                        <td className="px-3 py-2 text-center"><StatusBadge r={r} /></td>
                        <td className="px-3 py-2 text-right print:hidden">
                          <EyeButton onClick={() => setReceiptModal(r._orig || r)} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {filtered.length > 0 && (
                  <tfoot>
                    <tr className="border-t border-gray-200 bg-gray-50">
                      <td colSpan={3} className="px-3 py-2 font-semibold text-right text-gray-700">Total ({totals.count})</td>
                      {showInc && <td className="px-3 py-2 font-mono font-bold text-right text-blue-700">{fmt(totals.income)}</td>}
                      {showRem && <td className="px-3 py-2 font-mono font-bold text-right text-amber-700">{fmt(totals.remit)}</td>}
                      <td className="px-3 py-2 font-mono font-bold text-right" style={{ color: GREEN }}>{fmt(totals.total)}</td>
                      <td colSpan={2} className="print:hidden" />
                    </tr>
                  </tfoot>
                )}
              </table>
              {showCredit && (
                <p className="px-3 py-2 text-[11px] text-gray-400 border-t border-gray-100">
                  Applied credit isn't cash received, so it's left out of the totals.
                </p>
              )}
            </div>
          )}
        </>
      )}

   {receiptModal && (
  <ReceiptModal
    receipt={receiptModal}
    acctNames={acctNames}
    typeFilter={typeFilter}
    onClose={() => setReceiptModal(null)}
  />
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

// ── Tab 3: Revenue Summary — Billed vs Collected (income / remittance) across all 12 months ──
function RevenueSummary({ year }) {
  const [loading, setLoading] = useState(false);
  const [billedInc, setBilledInc] = useState(Array(12).fill(0));
  const [billedRem, setBilledRem] = useState(Array(12).fill(0));
  const [collInc, setCollInc] = useState(Array(12).fill(0));
  const [collRem, setCollRem] = useState(Array(12).fill(0));
  const [collTotal, setCollTotal] = useState(Array(12).fill(0));
  const [byMethod, setByMethod] = useState([]);

  // month index from a "YYYY-MM-DD" string (no timezone shift)
  const monthIdx = (d) => parseInt(String(d).slice(5, 7), 10) - 1;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const yearStart = `${year}-01-01`;
      const yearEnd = `${year}-12-31`;

      // Billed — statements finalized this year, split into income / remittance lines
      const statements = await fetchAll(() =>
        supabase
          .from("billing_statements")
          .select("id, soa_date")
          .gte("soa_date", yearStart)
          .lte("soa_date", yearEnd)
          .not("status", "in", "(draft,pending_approval)")
          .order("id", { ascending: true }),
      );

      const itemTotals = {};
      for (const part of chunk(statements.map((s) => s.id), 200)) {
        const { data: items, error: itErr } = await supabase
          .from("billing_items")
          .select("billing_id, amount, item_type")
          .in("billing_id", part);
        if (itErr) throw itErr;
        (items || []).forEach((i) => {
          const t = (itemTotals[i.billing_id] = itemTotals[i.billing_id] || { income: 0, remit: 0 });
          if (i.item_type === "remittance") t.remit += num(i.amount);
          else t.income += num(i.amount);
        });
      }

      const bInc = Array(12).fill(0);
      const bRem = Array(12).fill(0);
      statements.forEach((s) => {
        const t = itemTotals[s.id];
        if (!t) return;
        const m = monthIdx(s.soa_date);
        bInc[m] += t.income;
        bRem[m] += t.remit;
      });

      // Collected — cash receipts this year (applied credit isn't new cash)
      const receipts = await fetchAll(() =>
        supabase
          .from("official_receipts")
          .select("id, amount, income_amount, remittance_amount, payment_date, payment_method, receiving_bank")
          .gte("payment_date", yearStart)
          .lte("payment_date", yearEnd)
          .order("id", { ascending: true }),
      );

      const cInc = Array(12).fill(0);
      const cRem = Array(12).fill(0);
      const cTot = Array(12).fill(0);
      const methodMap = {};
      receipts.forEach((r) => {
        if (r.payment_method === "credit") return;
        const m = monthIdx(r.payment_date);
        cInc[m] += num(r.income_amount);
        cRem[m] += num(r.remittance_amount);
        cTot[m] += num(r.amount);

        const label = paymentMethodLabel(r);
        const mm = (methodMap[label] = methodMap[label] || { label, count: 0, income: 0, remit: 0, total: 0 });
        mm.count += 1;
        mm.income += num(r.income_amount);
        mm.remit += num(r.remittance_amount);
        mm.total += num(r.amount);
      });

      setBilledInc(bInc);
      setBilledRem(bRem);
      setCollInc(cInc);
      setCollRem(cRem);
      setCollTotal(cTot);
      setByMethod(Object.values(methodMap).sort((a, b) => b.total - a.total));
    } catch (err) {
      console.error("Error loading revenue summary:", err.message);
    }
    setLoading(false);
  }, [year]);

  useEffect(() => { load(); }, [load]);

  const sum = (a) => a.reduce((s, v) => s + v, 0);
  const totalBilledInc = useMemo(() => sum(billedInc), [billedInc]);
  const totalBilledRem = useMemo(() => sum(billedRem), [billedRem]);
  const totalBilled = totalBilledInc + totalBilledRem;
  const totalCollInc = useMemo(() => sum(collInc), [collInc]);
  const totalCollRem = useMemo(() => sum(collRem), [collRem]);
  const totalCollected = useMemo(() => sum(collTotal), [collTotal]);
  const collectionRate = totalBilled > 0.005 ? (totalCollected / totalBilled) * 100 : 0;

  const subtitle = `Calendar Year ${year}`;
  const headers = [
    "Month", "Billed Income", "Billed Remittance", "Billed Total",
    "Collected Income", "Collected Remittance", "Collected Total", "Variance",
  ];
  const csvRows = MONTHS.map((m, i) => {
    const billed = billedInc[i] + billedRem[i];
    return [
      m, fmt(billedInc[i]), fmt(billedRem[i]), fmt(billed),
      fmt(collInc[i]), fmt(collRem[i]), fmt(collTotal[i]), fmt(collTotal[i] - billed),
    ];
  });
  const pdfRows = csvRows;
  const footerRow = [
    "Total", fmt(totalBilledInc), fmt(totalBilledRem), fmt(totalBilled),
    fmt(totalCollInc), fmt(totalCollRem), fmt(totalCollected), fmt(totalCollected - totalBilled),
  ];

  const methodHeaders = ["Payment Method", "Receipts", "Income", "Remittance", "Total"];
  const methodCsv = byMethod.map((m) => [m.label, m.count, fmt(m.income), fmt(m.remit), fmt(m.total)]);

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
              orientation: "landscape",
            })
          }
          onPrint={() => window.print()}
        />
      </div>

      <div className="hidden mb-2 print:block">
        <h2 className="text-base font-bold text-gray-800">Revenue Summary</h2>
        <p className="text-xs text-gray-500">{subtitle}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 print:hidden">
        <SummaryCard label="Total Billed" value={`₱${fmt(totalBilled)}`} hint={`Income ${fmt(totalBilledInc)} · Remit ${fmt(totalBilledRem)}`} />
        <SummaryCard label="Total Collected" value={`₱${fmt(totalCollected)}`} accent={GREEN} />
        <SummaryCard label="Income Collected" value={`₱${fmt(totalCollInc)}`} accent={BLUE} />
        <SummaryCard label="Remittance Collected" value={`₱${fmt(totalCollRem)}`} accent={AMBER} />
        <SummaryCard label="Collection Rate" value={`${collectionRate.toFixed(1)}%`} accent={collectionRate >= 90 ? GREEN : collectionRate >= 60 ? AMBER : RED} />
      </div>

      {loading ? (
        <LoadingRow />
      ) : (
        <>
          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="w-full text-xs">
              <thead className="text-gray-500 bg-gray-50">
                <tr className="text-[10px] font-semibold text-gray-400">
                  <th />
                  <th colSpan={3} className="px-3 py-1.5 text-center border-l border-gray-100">Billed</th>
                  <th colSpan={3} className="px-3 py-1.5 text-center border-l border-gray-100">Collected</th>
                  <th className="border-l border-gray-100" />
                </tr>
                <tr>
                  <th className="px-3 py-2 font-medium text-left">Month</th>
                  <th className="px-3 py-2 font-medium text-right border-l border-gray-100">Income</th>
                  <th className="px-3 py-2 font-medium text-right">Remittance</th>
                  <th className="px-3 py-2 font-medium text-right">Total</th>
                  <th className="px-3 py-2 font-medium text-right border-l border-gray-100">Income</th>
                  <th className="px-3 py-2 font-medium text-right">Remittance</th>
                  <th className="px-3 py-2 font-medium text-right">Total</th>
                  <th className="px-3 py-2 font-medium text-right border-l border-gray-100">Variance</th>
                </tr>
              </thead>
              <tbody>
                {MONTHS.map((m, i) => {
                  const billed = billedInc[i] + billedRem[i];
                  const variance = collTotal[i] - billed;
                  return (
                    <tr key={m} className="border-t border-gray-50">
                      <td className="px-3 py-2 text-gray-800">{m}</td>
                      <td className="px-3 py-2 font-mono text-right text-gray-600 border-l border-gray-50">{fmt(billedInc[i])}</td>
                      <td className="px-3 py-2 font-mono text-right text-gray-600">{fmt(billedRem[i])}</td>
                      <td className="px-3 py-2 font-mono text-right text-gray-800">{fmt(billed)}</td>
                      <td className="px-3 py-2 font-mono text-right text-blue-700 border-l border-gray-50">{fmt(collInc[i])}</td>
                      <td className="px-3 py-2 font-mono text-right text-amber-700">{fmt(collRem[i])}</td>
                      <td className="px-3 py-2 font-mono text-right text-gray-800">{fmt(collTotal[i])}</td>
                      <td className="px-3 py-2 font-mono text-right border-l border-gray-50" style={{ color: variance < 0 ? RED : GREEN }}>
                        {variance >= 0 ? "+" : ""}{fmt(variance)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-200 bg-gray-50">
                  <td className="px-3 py-2 font-semibold text-gray-700">Total</td>
                  <td className="px-3 py-2 font-mono font-bold text-right text-gray-700">{fmt(totalBilledInc)}</td>
                  <td className="px-3 py-2 font-mono font-bold text-right text-gray-700">{fmt(totalBilledRem)}</td>
                  <td className="px-3 py-2 font-mono font-bold text-right text-gray-700">{fmt(totalBilled)}</td>
                  <td className="px-3 py-2 font-mono font-bold text-right text-blue-700">{fmt(totalCollInc)}</td>
                  <td className="px-3 py-2 font-mono font-bold text-right text-amber-700">{fmt(totalCollRem)}</td>
                  <td className="px-3 py-2 font-mono font-bold text-right" style={{ color: GREEN }}>{fmt(totalCollected)}</td>
                  <td className="px-3 py-2 font-mono font-bold text-right" style={{ color: totalCollected - totalBilled < 0 ? RED : GREEN }}>
                    {totalCollected - totalBilled >= 0 ? "+" : ""}{fmt(totalCollected - totalBilled)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Collected by payment method for the whole year */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-700">Collected by payment method · {year}</p>
              <button
                onClick={() => downloadCsv(`revenue-by-method-${year}.csv`, methodHeaders, methodCsv)}
                disabled={byMethod.length === 0}
                className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-40 print:hidden"
              >
                <FaFileCsv size={10} /> CSV
              </button>
            </div>
            <div className="overflow-hidden border border-gray-200 rounded-lg">
              <table className="w-full text-xs">
                <thead className="text-gray-500 bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 font-medium text-left">Payment method</th>
                    <th className="px-3 py-2 font-medium text-right">Receipts</th>
                    <th className="px-3 py-2 font-medium text-right">Income</th>
                    <th className="px-3 py-2 font-medium text-right">Remittance</th>
                    <th className="px-3 py-2 font-medium text-right">Total</th>
                    <th className="px-3 py-2 font-medium text-right">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {byMethod.length === 0 ? (
                    <tr><td colSpan={6} className="py-6 text-center text-gray-400">No collections recorded for this year.</td></tr>
                  ) : (
                    byMethod.map((m) => (
                      <tr key={m.label} className="border-t border-gray-50">
                        <td className="px-3 py-2 text-gray-800">{m.label}</td>
                        <td className="px-3 py-2 text-right text-gray-600">{m.count}</td>
                        <td className="px-3 py-2 font-mono text-right text-blue-700">{fmt(m.income)}</td>
                        <td className="px-3 py-2 font-mono text-right text-amber-700">{fmt(m.remit)}</td>
                        <td className="px-3 py-2 font-mono font-semibold text-right text-gray-800">{fmt(m.total)}</td>
                        <td className="px-3 py-2 text-right text-gray-500">
                          {totalCollected > 0 ? `${((m.total / totalCollected) * 100).toFixed(1)}%` : "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[11px] text-gray-400">
              Applied client credit isn't counted as collected, since the cash was already received when the credit was created.
            </p>
          </div>
        </>
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