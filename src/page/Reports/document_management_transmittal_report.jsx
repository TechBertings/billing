import React, { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "../../lib/supabaseClient";
import {
  FaSearch,
  FaTimes,
  FaFileInvoiceDollar,
  FaPrint,
  FaSyncAlt,
  FaCheckCircle,
  FaEnvelope,
  FaFileExcel,
  FaFilePdf,
} from "react-icons/fa";
import { exportTablePDF } from "../../utils/report_pdf";

const GREEN = "#1a5c2e";
const LIGHT_GREEN = "#e8f5ec";

const inputCls =
  "w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 bg-white transition";
const labelCls = "block text-xs font-medium text-gray-500 mb-1";

function fmt(n) {
  return Number(n || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function fmtDateTime(d) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const PAGE_SIZES = [10, 12, 25, 50, 100];

// relative column widths for the PDF
const PDF_COLS = [
  { label: "SOA Number", w: 1.5 },
  { label: "Client", w: 2.4 },
  { label: "SOA Date", w: 1.1 },
  { label: "Due Date", w: 1.1 },
  { label: "Prepared By", w: 1.5 },
  { label: "Sent By", w: 1.5 },
  { label: "Amount (PHP)", w: 1.4 },
];

const pageBtn =
  "px-2.5 py-1 text-xs border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition";

/**
 * Read-only report of SOAs that have already been approved / sent to clients.
 * Pulls directly from billing_statements (status = "approved") — no new
 * tables. Amount is derived from billing_items minus down payment / WHT,
 * same math as CreateBilling.jsx.
 */
export default function TransmittalReport() {
  const [rows, setRows] = useState([]); // all approved SOAs, enriched with totalDue
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [sentBy, setSentBy] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  // SheetJS for Excel export
  useEffect(() => {
    const src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    if (document.querySelector(`script[src="${src}"]`)) return;
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    document.head.appendChild(s);
  }, []);

  const fetchTransmittals = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data: statements, error: stErr } = await supabase
        .from("billing_statements")
        .select(
            "id, soa_number, client_id, bill_to, address, soa_date, due_date, down_payment, withholding_tax, status, approved_by, approved_at, created_by_name",        )
        .eq("status", "approved")
        .order("approved_at", { ascending: false, nullsFirst: false });
      if (stErr) throw stErr;

      const billingIds = (statements || []).map((s) => s.id);
      if (billingIds.length === 0) {
        setRows([]);
        return;
      }

      // .in() with many ids makes the URL too long, so fetch in chunks
      const items = [];
      for (let i = 0; i < billingIds.length; i += 100) {
        const part = billingIds.slice(i, i + 100);
        const { data, error: itErr } = await supabase
          .from("billing_items")
          .select("billing_id, amount")
          .in("billing_id", part);
        if (itErr) throw itErr;
        items.push(...(data || []));
      }

      const subtotals = {};
      items.forEach((i) => {
        subtotals[i.billing_id] =
          (subtotals[i.billing_id] || 0) + (Number(i.amount) || 0);
      });

      const enriched = (statements || []).map((s) => {
        const subtotal = subtotals[s.id] || 0;
        const totalDue =
          subtotal - (Number(s.down_payment) || 0) - (Number(s.withholding_tax) || 0);
        return { ...s, subtotal, totalDue };
      });

      setRows(enriched);
    } catch (err) {
      console.error("fetchTransmittals error:", err);
      setError(err.message || "Failed to load transmittal report.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTransmittals();
  }, [fetchTransmittals]);

  // "Sent By" dropdown options
  const sentByOptions = useMemo(
    () =>
      [...new Set(rows.map((r) => r.approved_by).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [rows],
  );

  // ── Client-side filtering ──
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (term) {
        const hay = `${r.soa_number || ""} ${r.bill_to || ""}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      if (sentBy !== "all" && r.approved_by !== sentBy) return false;
      if (dateFrom && (!r.soa_date || r.soa_date < dateFrom)) return false;
      if (dateTo && (!r.soa_date || r.soa_date > dateTo)) return false;
      return true;
    });
  }, [rows, search, sentBy, dateFrom, dateTo]);

  useEffect(() => {
    setPage(1);
  }, [search, sentBy, dateFrom, dateTo, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  // ── Summary stats ──
  const totalAmount = filtered.reduce((s, r) => s + r.totalDue, 0);
  const thisMonthKey = new Date().toISOString().slice(0, 7); // YYYY-MM
  const thisMonthCount = filtered.filter(
    (r) => (r.soa_date || "").slice(0, 7) === thisMonthKey,
  ).length;

  const hasFilters = search || sentBy !== "all" || dateFrom || dateTo;
  const clearFilters = () => {
    setSearch("");
    setSentBy("all");
    setDateFrom("");
    setDateTo("");
  };

  // ── Export helpers (always export ALL filtered rows, not just the current page) ──
  const stamp = new Date().toISOString().split("T")[0];
  const rangeLabel =
    dateFrom || dateTo
      ? `SOA Date: ${dateFrom ? fmtDate(dateFrom) : "Start"} – ${dateTo ? fmtDate(dateTo) : "Present"}`
      : "All Dates";
  const filterLabel = [
    rangeLabel,
    sentBy !== "all" ? `Sent by: ${sentBy}` : "",
    search ? `Search: "${search}"` : "",
  ]
    .filter(Boolean)
    .join("  |  ");
  const exportDisabled = loading || filtered.length === 0;
  const countText = `${filtered.length} SOA${filtered.length === 1 ? "" : "s"}`;

  const exportExcel = () => {
    const XLSX = window.XLSX;
    if (!XLSX) {
      alert("SheetJS not loaded yet, please try again in a moment.");
      return;
    }
  const aoa = [
  ["Transmittal Report"],
  [filterLabel],
  [`Generated: ${new Date().toLocaleString("en-PH")}`],
  [],
  ["#", ...PDF_COLS.map((c) => c.label)],
  ...filtered.map((r, i) => [
    i + 1,
    r.soa_number || "",
    r.bill_to || "",
       fmtDate(r.soa_date),
    fmtDate(r.due_date),
    r.created_by_name || "",
    r.approved_by || "",
    Number(r.totalDue) || 0,
  ]),
  ["", "TOTAL", countText, "", "", "", "", totalAmount],
];
const ws = XLSX.utils.aoa_to_sheet(aoa);
ws["!cols"] = [
  { wch: 5 }, { wch: 18 }, { wch: 34 }, { wch: 14 },
  { wch: 14 }, { wch: 22 }, { wch: 22 }, { wch: 16 },
];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Transmittals");
    XLSX.writeFile(wb, `transmittal_report_${stamp}.xlsx`);
  };

  const exportPDF = async () => {
    setPdfBusy(true);
    try {
      await exportTablePDF({
        title: "Transmittal Report",
        subtitle: filterLabel,
        cols: PDF_COLS,
       groups: [
  {
    label: "Approved Statements of Account",
    sublabel: `Total Amount: PHP ${fmt(totalAmount)}`,
    countLabel: countText,
    rows: filtered.map((r) => [
      r.soa_number || "—",
      r.bill_to || "—",
      fmtDate(r.soa_date),
      fmtDate(r.due_date),
      r.created_by_name || "—",
      r.approved_by || "—",
      fmt(r.totalDue),
    ]),
  },
],
         
        format: "a4",
        fileName: `transmittal_report_${stamp}.pdf`,
      });
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 print:bg-white print:min-h-0">
      {/* Top bar */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-white border-b border-gray-100 print:hidden">
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center rounded-full w-9 h-9"
            style={{ background: LIGHT_GREEN }}
          >
            <FaFileInvoiceDollar size={14} style={{ color: GREEN }} />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-gray-800">Transmittal Report</h1>
            <p className="text-xs text-gray-400">
              Statements of Account already approved &amp; sent to clients
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchTransmittals}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-gray-600 transition border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            <FaSyncAlt size={11} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
          <button
            onClick={exportExcel}
            disabled={exportDisabled}
            className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-white transition rounded-md bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40"
          >
            <FaFileExcel size={11} /> Excel
          </button>
          <button
            onClick={exportPDF}
            disabled={exportDisabled || pdfBusy}
            className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-white transition bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-40"
          >
            <FaFilePdf size={11} /> {pdfBusy ? "Generating..." : "PDF"}
          </button>
          <button
            onClick={() => window.print()}
            disabled={exportDisabled}
            className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-white transition rounded-md disabled:opacity-40"
            style={{ background: GREEN }}
          >
            <FaPrint size={11} /> Print
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center justify-between px-4 py-2.5 mx-6 mt-4 text-sm text-red-700 border-l-4 border-red-500 rounded-md bg-red-50 print:hidden">
          {error}
          <button onClick={() => setError("")}>
            <FaTimes size={11} />
          </button>
        </div>
      )}

      {/* SCREEN CONTENT */}
      <div className="p-6 space-y-5 print:hidden">
        {/* Summary cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="p-4 bg-white border border-gray-100 rounded-xl">
            <p className="text-xs font-medium text-gray-400">Total Transmitted</p>
            <p className="mt-1 text-2xl font-bold text-gray-800">{filtered.length}</p>
            <p className="text-xs text-gray-400">
              SOA{filtered.length === 1 ? "" : "s"} sent to clients
            </p>
          </div>
          <div
            className="p-4 border rounded-xl"
            style={{ borderColor: "#bfe3cb", background: LIGHT_GREEN }}
          >
            <p className="text-xs font-semibold" style={{ color: GREEN }}>
              Total Amount
            </p>
            <p className="mt-1 font-mono text-2xl font-bold" style={{ color: GREEN }}>
              ₱{fmt(totalAmount)}
            </p>
            <p className="text-xs" style={{ color: GREEN }}>
              Across filtered results
            </p>
          </div>
          <div className="p-4 bg-white border border-gray-100 rounded-xl">
            <p className="text-xs font-medium text-gray-400">This Month</p>
            <p className="mt-1 text-2xl font-bold text-gray-800">{thisMonthCount}</p>
            <p className="text-xs text-gray-400">SOAs transmitted so far</p>
          </div>
        </div>

        {/* Filters */}
        <div className="p-4 bg-white border border-gray-100 rounded-xl">
          <div className="grid items-end grid-cols-1 gap-3 sm:grid-cols-5">
            <div className="sm:col-span-2">
              <label className={labelCls}>Search</label>
              <div className="relative">
                <FaSearch
                  className="absolute text-gray-300 -translate-y-1/2 left-3 top-1/2"
                  size={12}
                />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="SOA number or client name..."
                  className={`${inputCls} pl-9`}
                />
              </div>
            </div>
            <div>
              <label className={labelCls}>Sent By</label>
              <select
                value={sentBy}
                onChange={(e) => setSentBy(e.target.value)}
                className={inputCls}
              >
                <option value="all">All</option>
                {sentByOptions.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>SOA Date From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                max={dateTo || undefined}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>SOA Date To</label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  min={dateFrom || undefined}
                  className={inputCls}
                />
                {hasFilters && (
                  <button
                    onClick={clearFilters}
                    title="Clear filters"
                    className="px-2.5 text-gray-400 border border-gray-200 rounded-md hover:bg-gray-50 hover:text-gray-600 shrink-0"
                  >
                    <FaTimes size={11} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden bg-white border border-gray-100 rounded-xl">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16">
              <div className="w-5 h-5 border-2 border-green-600 rounded-full border-t-transparent animate-spin" />
              <p className="text-xs text-gray-400">Loading transmittal report...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16">
              <FaEnvelope size={20} className="text-gray-200" />
              <p className="text-sm text-gray-400">
                {rows.length === 0
                  ? "No SOAs have been approved / sent yet."
                  : "No results match your filters."}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-gray-500 bg-gray-50">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-[11px] font-semibold">SOA Number</th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-semibold">Client</th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-semibold">SOA Date</th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-semibold">Due Date</th>
                      <th className="px-4 py-2.5 text-right text-[11px] font-semibold">Amount</th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-semibold">Prepared By</th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-semibold">Sent By</th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-semibold">Sent On</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {paginated.map((r) => (
                      <tr key={r.id} className="transition hover:bg-gray-50/60">
                        <td className="px-4 py-2.5 font-mono text-xs font-medium text-gray-700">
                          {r.soa_number}
                        </td>
                        <td className="px-4 py-2.5 text-gray-700">{r.bill_to || "—"}</td>
                        <td className="px-4 py-2.5 text-xs text-gray-500">{fmtDate(r.soa_date)}</td>
                        <td className="px-4 py-2.5 text-xs text-gray-500">{fmtDate(r.due_date)}</td>
                        <td className="px-4 py-2.5 font-mono text-right text-gray-700">
                          ₱{fmt(r.totalDue)}
                        </td>
                          <td className="px-4 py-2.5 text-xs text-gray-500">{r.created_by_name || "—"}</td>
                          <td className="px-4 py-2.5 text-xs text-gray-500">{r.approved_by || "—"}</td>
                          <td className="px-4 py-2.5 text-xs text-gray-400">
                          <div className="flex items-center gap-1.5">
                            <FaCheckCircle size={9} className="text-green-500 shrink-0" />
                            {fmtDateTime(r.approved_at)}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-gray-200 bg-gray-50">
                      <td colSpan={4} className="px-4 py-2.5 font-medium text-right text-gray-600">
                        Page Total
                      </td>
                      <td className="px-4 py-2.5 font-mono font-semibold text-right text-gray-700">
                        ₱{fmt(paginated.reduce((s, r) => s + r.totalDue, 0))}
                      </td>
                      <td colSpan={2} />
                    </tr>
                    <tr className="border-t border-gray-200" style={{ background: LIGHT_GREEN }}>
                      <td
                        colSpan={4}
                        className="px-4 py-2.5 font-semibold text-right"
                        style={{ color: GREEN }}
                      >
                        Grand Total ({countText})
                      </td>
                      <td
                        className="px-4 py-2.5 font-mono font-bold text-right"
                        style={{ color: GREEN }}
                      >
                        ₱{fmt(totalAmount)}
                      </td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-gray-100">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400">
                    {(safePage - 1) * pageSize + 1}–
                    {Math.min(safePage * pageSize, filtered.length)} of {filtered.length}
                  </span>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="px-2 py-1 text-xs border border-gray-200 rounded-md"
                  >
                    {PAGE_SIZES.map((n) => (
                      <option key={n} value={n}>
                        {n} / page
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setPage(1)} disabled={safePage === 1} className={pageBtn}>
                    First
                  </button>
                  <button
                    onClick={() => setPage(Math.max(1, safePage - 1))}
                    disabled={safePage === 1}
                    className={pageBtn}
                  >
                    Prev
                  </button>
                  <span className="px-2 text-xs text-gray-500">
                    {safePage}/{totalPages}
                  </span>
                  <button
                    onClick={() => setPage(Math.min(totalPages, safePage + 1))}
                    disabled={safePage === totalPages}
                    className={pageBtn}
                  >
                    Next
                  </button>
                  <button
                    onClick={() => setPage(totalPages)}
                    disabled={safePage === totalPages}
                    className={pageBtn}
                  >
                    Last
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* PRINT-ONLY: full report (all filtered rows, no pagination) */}
      {!loading && filtered.length > 0 && (
        <div className="hidden p-6 print:block">
          <h1 className="text-lg font-bold">Transmittal Report</h1>
          <p className="mb-3 text-xs text-gray-500">
            {filterLabel} · Generated {new Date().toLocaleString("en-PH")}
          </p>
          <table className="w-full text-[10px] border-collapse">
            <thead>
              <tr className="border-b border-gray-400">
                <th className="py-1.5 pr-2 text-left">#</th>
                <th className="py-1.5 pr-2 text-left">SOA Number</th>
                <th className="py-1.5 pr-2 text-left">Client</th>
                <th className="py-1.5 pr-2 text-left">SOA Date</th>
                <th className="py-1.5 pr-2 text-left">Due Date</th>
                <th className="py-1.5 pr-2 text-right">Amount</th>
                <th className="py-1.5 pr-2 text-left">Prepared By</th>
                <th className="py-1.5 pr-2 text-left">Sent By</th>
                <th className="py-1.5 text-left">Sent On</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={r.id} className="border-b border-gray-200 break-inside-avoid">
                  <td className="py-1 pr-2 text-gray-500">{i + 1}</td>
                  <td className="py-1 pr-2 font-mono whitespace-nowrap">{r.soa_number}</td>
                  <td className="py-1 pr-2">{r.bill_to || "—"}</td>
                  <td className="py-1 pr-2 whitespace-nowrap">{fmtDate(r.soa_date)}</td>
                  <td className="py-1 pr-2 whitespace-nowrap">{fmtDate(r.due_date)}</td>
                  <td className="py-1 pr-2 font-mono text-right">{fmt(r.totalDue)}</td>
                  <td className="py-1 pr-2">{r.created_by_name || "—"}</td>
                  <td className="py-1 pr-2">{r.approved_by || "—"}</td>
                  <td className="py-1 whitespace-nowrap">{fmtDateTime(r.approved_at)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-bold border-t-2 border-gray-600">
                <td colSpan={5} className="py-2 pr-2 text-right">
                  TOTAL ({countText})
                </td>
                <td className="py-2 pr-2 font-mono text-right">{fmt(totalAmount)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}