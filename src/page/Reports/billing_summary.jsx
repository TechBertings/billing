import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { supabase } from "../../lib/supabaseClient";
import {
  FaSync,
  FaSearch,
  FaTimes,
  FaUser,
  FaChevronRight,
  FaChevronDown,
  FaPrint,
  FaFileExcel,
  FaFilePdf,
} from "react-icons/fa";
import { exportTablePDF } from "../../utils/report_pdf";

// ── helpers ─────────────────────────────────────────────────────────────────
function fmt(n) {
  return Number(n || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// soa_date is "YYYY-MM-DD" — parse as string (no Date) to avoid timezone shifts
function bucketKey(soaDate, view) {
  if (!soaDate) return "No date";
  const [y, m] = soaDate.split("-");
  if (view === "year") return y;
  if (view === "month") return `${y}-${m}`;
  return soaDate.slice(0, 10);
}

function bucketLabel(key, view) {
  if (key === "No date") return key;
  if (view === "year") return key;
  if (view === "month") {
    const [y, m] = key.split("-");
    return `${MONTHS[Number(m) - 1]} ${y}`;
  }
  const [y, m, d] = key.split("-");
  return `${MONTHS[Number(m) - 1].slice(0, 3)} ${d}, ${y}`;
}

function fmtDate(s) {
  if (!s) return "—";
  const [y, m, d] = s.slice(0, 10).split("-");
  return `${MONTHS[Number(m) - 1].slice(0, 3)} ${d}, ${y}`;
}

const todayStr = () => new Date().toISOString().split("T")[0];
const firstOfYearStr = () => `${new Date().getFullYear()}-01-01`;

// Only issued SOAs count (no draft / pending approval).
// "paid" is included because RecordPayment flips fully-settled SOAs to "paid".
const BILLABLE_STATUSES = ["approved", "unpaid", "paid"];

const PAY_FILTERS = [
  { value: "all", label: "All" },
  { value: "paid", label: "Paid" },
  { value: "unpaid", label: "Not paid" },
];

const PAGE_SIZES = [10, 20, 50, 100];

const GREEN = "#1a5c2e";
const RED = "#c0392b";
const inputCls =
  "px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 bg-white";
const labelCls = "block text-xs font-medium text-gray-500 mb-1";

const PAY_BADGE = {
  paid: { label: "Paid", cls: "bg-green-100 text-green-700" },
  partial: { label: "Partially paid", cls: "bg-blue-100 text-blue-700" },
  unpaid: { label: "Not paid", cls: "bg-red-100 text-red-600" },
};

// relative column widths for the PDF
const PDF_COLS = [
  { label: "SOA No.", w: 1.5 },
  { label: "SOA Date", w: 1.2 },
  { label: "Client", w: 2.6 },
  { label: "Payment", w: 1.2 },
  { label: "Gross Billed", w: 1.4 },
  { label: "Down Payment", w: 1.3 },
  { label: "Withholding Tax", w: 1.3 },
  { label: "Net Billed", w: 1.4 },
  { label: "Paid", w: 1.3 },
  { label: "Balance", w: 1.3 },
];

function getClientName(c) {
  if (!c) return "";
  if (c.business_name) return c.business_name;
  return (
    [c.first_name, c.middle_name, c.last_name].filter(Boolean).join(" ") ||
    c.client_id
  );
}

const sumOf = (arr, k) => arr.reduce((s, r) => s + (r[k] || 0), 0);

// ── data fetch (paginated — Supabase returns max 1000 rows per request) ─────
async function fetchStatements({ from, to, statuses, clientId }) {
  const pageSize = 1000;
  let all = [];
  let offset = 0;

  while (true) {
    let q = supabase
      .from("billing_statements")
      .select(
        "id, soa_number, soa_date, client_id, bill_to, status, down_payment, withholding_tax, billing_items(amount, item_type)",
      )
      .order("soa_date", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (from) q = q.gte("soa_date", from);
    if (to) q = q.lte("soa_date", to);
    if (clientId) q = q.eq("client_id", clientId);
    if (statuses.length) q = q.in("status", statuses);

    const { data, error } = await q;
    if (error) throw error;
    all = all.concat(data || []);
    if (!data || data.length < pageSize) break;
    offset += pageSize;
  }
  return all;
}

// Total payments per billing_id (reversals are negative rows, so they net out)
async function fetchPaidTotals(billingIds) {
  const totals = {};
  const chunkSize = 100; // keep the .in() URL short enough
  for (let i = 0; i < billingIds.length; i += chunkSize) {
    const chunk = billingIds.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from("official_receipts")
      .select("billing_id, amount")
      .in("billing_id", chunk);
    if (error) throw error;
    (data || []).forEach((r) => {
      totals[r.billing_id] =
        (totals[r.billing_id] || 0) + (Number(r.amount) || 0);
    });
  }
  return totals;
}

// ── component ───────────────────────────────────────────────────────────────
export default function BillingSummary() {
  const [view, setView] = useState("month"); // "day" | "month" | "year"
  const [dateFrom, setDateFrom] = useState(firstOfYearStr());
  const [dateTo, setDateTo] = useState(todayStr());
  const [payFilter, setPayFilter] = useState("all"); // all | paid | unpaid
  const [rows, setRows] = useState([]);
  const [paidTotals, setPaidTotals] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);

  // ── Client filter (default: all clients) ──
  const [selectedClient, setSelectedClient] = useState(null); // null = all
  const [clientSearch, setClientSearch] = useState("");
  const [clientResults, setClientResults] = useState([]);
  const [showClientDrop, setShowClientDrop] = useState(false);
  const clientRef = useRef(null);

  // ── Drill-down: period → client → SOAs ──
  const [openPeriods, setOpenPeriods] = useState(new Set());
  const [openClients, setOpenClients] = useState(new Set()); // `${periodKey}|${clientKey}`

  const togglePeriod = (key) =>
    setOpenPeriods((p) => {
      const n = new Set(p);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });
  const toggleClient = (id) =>
    setOpenClients((p) => {
      const n = new Set(p);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  // ── Pagination (of period rows) ──
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // SheetJS for Excel export
  useEffect(() => {
    const src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    if (document.querySelector(`script[src="${src}"]`)) return;
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    document.head.appendChild(s);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchStatements({
        from: dateFrom,
        to: dateTo,
        statuses: BILLABLE_STATUSES,
        clientId: selectedClient?.client_id || null,
      });
      const totals = await fetchPaidTotals(data.map((s) => s.id));
      setRows(data);
      setPaidTotals(totals);
    } catch (e) {
      setError(e.message || "Failed to load billing data.");
    }
    setLoading(false);
  }, [dateFrom, dateTo, selectedClient]);

  useEffect(() => {
    load();
  }, [load]);

  // reset page whenever filters change
  useEffect(() => {
    setPage(1);
  }, [dateFrom, dateTo, payFilter, selectedClient, view, pageSize]);

  // collapse everything when the grouping changes
  useEffect(() => {
    setOpenPeriods(new Set());
    setOpenClients(new Set());
  }, [view]);

  // ── client search ──
  const searchClients = useCallback(async (term) => {
    let q = supabase
      .from("client_profile")
      .select("id, client_id, business_name, first_name, middle_name, last_name")
      .eq("approval_status", "approved")
      .limit(8);
    if (term.trim()) {
      q = q.or(
        `business_name.ilike.%${term}%,client_id.ilike.%${term}%,first_name.ilike.%${term}%,last_name.ilike.%${term}%,trade_name.ilike.%${term}%`,
      );
    } else {
      q = q.order("business_name", { ascending: true });
    }
    const { data, error } = await q;
    if (!error) setClientResults(data || []);
  }, []);

  useEffect(() => {
    if (!showClientDrop) return;
    const t = setTimeout(() => searchClients(clientSearch), 300);
    return () => clearTimeout(t);
  }, [clientSearch, showClientDrop, searchClients]);

  useEffect(() => {
    const handler = (e) => {
      if (clientRef.current && !clientRef.current.contains(e.target))
        setShowClientDrop(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const pickClient = (c) => {
    setSelectedClient(c);
    setClientSearch("");
    setShowClientDrop(false);
  };
  const clearClient = () => {
    setSelectedClient(null);
    setClientSearch("");
  };

  // ── Enrich every statement with amounts + payment state ──
  const enriched = useMemo(
    () =>
      rows.map((st) => {
        const items = st.billing_items || [];
        const gross = items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
        const dp = parseFloat(st.down_payment) || 0;
        const wht = parseFloat(st.withholding_tax) || 0;
        const net = gross - dp - wht;
        const paid = paidTotals[st.id] || 0;
        const balance = Math.max(gross - paid, 0); // same basis as RecordPayment.jsx
        const payState =
          st.status === "paid" || (gross > 0 && gross - paid <= 0.005)
            ? "paid"
            : paid > 0.005
              ? "partial"
              : "unpaid";
        return { ...st, gross, dp, wht, net, paid, balance, payState };
      }),
    [rows, paidTotals],
  );

  // Apply All / Paid / Not paid
  const filtered = useMemo(() => {
    if (payFilter === "paid") return enriched.filter((s) => s.payState === "paid");
    if (payFilter === "unpaid") return enriched.filter((s) => s.payState !== "paid");
    return enriched;
  }, [enriched, payFilter]);

  const payCounts = useMemo(
    () => ({
      all: enriched.length,
      paid: enriched.filter((s) => s.payState === "paid").length,
      unpaid: enriched.filter((s) => s.payState !== "paid").length,
    }),
    [enriched],
  );

  // Period → clients → statements
  const periods = useMemo(() => {
    const pMap = new Map();
    filtered.forEach((s) => {
      const key = bucketKey(s.soa_date, view);
      if (!pMap.has(key)) pMap.set(key, []);
      pMap.get(key).push(s);
    });

    return Array.from(pMap.entries())
      .map(([key, sts]) => {
        const cMap = new Map();
        sts.forEach((s) => {
          const ck = s.client_id || s.bill_to || "unknown";
          if (!cMap.has(ck)) cMap.set(ck, { key: ck, name: s.bill_to || ck, statements: [] });
          cMap.get(ck).statements.push(s);
        });
        const clients = Array.from(cMap.values())
          .map((c) => ({
            ...c,
            statements: c.statements.sort(
              (a, b) =>
                (a.soa_date || "").localeCompare(b.soa_date || "") ||
                a.soa_number.localeCompare(b.soa_number),
            ),
            count: c.statements.length,
            gross: sumOf(c.statements, "gross"),
            net: sumOf(c.statements, "net"),
            paid: sumOf(c.statements, "paid"),
            balance: sumOf(c.statements, "balance"),
          }))
          .sort((a, b) => a.name.localeCompare(b.name));
        return {
          key,
          clients,
          count: sts.length,
          gross: sumOf(sts, "gross"),
          net: sumOf(sts, "net"),
          paid: sumOf(sts, "paid"),
          balance: sumOf(sts, "balance"),
        };
      })
      .sort((a, b) => b.key.localeCompare(a.key)); // newest first
  }, [filtered, view]);

  const totals = useMemo(
    () => ({
      count: filtered.length,
      gross: sumOf(filtered, "gross"),
      net: sumOf(filtered, "net"),
      paid: sumOf(filtered, "paid"),
      balance: sumOf(filtered, "balance"),
    }),
    [filtered],
  );

  // ── Pagination of period rows ──
  const totalPages = Math.max(1, Math.ceil(periods.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginated = periods.slice((safePage - 1) * pageSize, safePage * pageSize);

  // ── Export helpers (always export ALL periods, not just the current page) ──
  const payLabel = PAY_FILTERS.find((f) => f.value === payFilter)?.label || "All";
  const clientLabel = selectedClient ? getClientName(selectedClient) : "All Clients";
  const rangeLabel = `${fmtDate(dateFrom)} – ${fmtDate(dateTo)}`;
  const groupLabel = view === "day" ? "Day" : view === "month" ? "Month" : "Year";
  const stamp = todayStr();

  // statements in report order: period (newest first) → client → SOA
  const orderedByPeriod = periods.map((p) => ({
    period: p,
    statements: p.clients.flatMap((c) => c.statements),
  }));

  const exportExcel = () => {
    const XLSX = window.XLSX;
    if (!XLSX) {
      alert("SheetJS not loaded yet, please try again in a moment.");
      return;
    }
    const aoa = [
      ["Billing Summary"],
      [`Client: ${clientLabel}`],
      [`Period: ${rangeLabel}`],
      [`Payment: ${payLabel}  |  Grouped by: ${groupLabel}`],
      [],
      [groupLabel, ...PDF_COLS.map((c) => c.label)],
    ];
    orderedByPeriod.forEach(({ period, statements }) => {
      statements.forEach((s) =>
        aoa.push([
          bucketLabel(period.key, view),
          s.soa_number,
          s.soa_date || "",
          s.bill_to || "",
          PAY_BADGE[s.payState].label,
          s.gross,
          s.dp,
          s.wht,
          s.net,
          s.paid,
          s.balance,
        ]),
      );
      aoa.push([
        `${bucketLabel(period.key, view)} subtotal`,
        `${period.count} SOA${period.count !== 1 ? "s" : ""}`,
        "", "", "",
        period.gross, "", "", period.net, period.paid, period.balance,
      ]);
    });
    aoa.push([
      "TOTAL",
      `${totals.count} SOA${totals.count !== 1 ? "s" : ""}`,
      "", "", "",
      totals.gross, "", "", totals.net, totals.paid, totals.balance,
    ]);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [
      { wch: 20 }, { wch: 18 }, { wch: 14 }, { wch: 34 }, { wch: 16 },
      { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Billing Summary");
    XLSX.writeFile(wb, `billing_summary_${payFilter}_${dateFrom}_to_${dateTo}.xlsx`);
  };

  const exportPDF = async () => {
    setPdfBusy(true);
    try {
      const subtitle = [
      clientLabel,
      rangeLabel,
      payLabel,
      `By ${groupLabel}`,
      `Total: ${totals.count} SOA${totals.count !== 1 ? "s" : ""} | Gross ${fmt(totals.gross)} | Net ${fmt(totals.net)} | Paid ${fmt(totals.paid)} | Balance ${fmt(totals.balance)}`,
    ].join("  |  ");
      await exportTablePDF({
        title: "Billing Summary",
        subtitle,
        cols: PDF_COLS,
      groups: orderedByPeriod.map(({ period, statements }) => ({
  label: bucketLabel(period.key, view),
  sublabel: `Gross ${fmt(period.gross)}  |  Net ${fmt(period.net)}  |  Paid ${fmt(period.paid)}  |  Balance ${fmt(period.balance)}`,
  countLabel: `${period.count} SOA${period.count !== 1 ? "s" : ""}`,
  rows: statements.map((s) => [
    s.soa_number,
    fmtDate(s.soa_date),
    s.bill_to || "—",
    PAY_BADGE[s.payState].label,
    fmt(s.gross),
    fmt(s.dp),
    fmt(s.wht),
    fmt(s.net),
    fmt(s.paid),
    fmt(s.balance),
  ]),
})),
        format: "legal",
        fileName: `billing_summary_${payFilter}_${dateFrom}_to_${dateTo}.pdf`,
      });
    } finally {
      setPdfBusy(false);
    }
  };

  const exportDisabled = loading || filtered.length === 0;
  const numCell = "px-4 py-2.5 font-mono text-right";

  return (
    <div className="min-h-screen bg-gray-50 print:bg-white print:min-h-0">
      {/* TOP BAR */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-3.5 bg-white border-b border-gray-200 print:hidden">
        <div>
          <h1 className="text-base font-semibold text-gray-800">
            Billing Summary
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Click a period to see clients, then a client to see their SOAs
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-gray-600 transition border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            <FaSync size={11} className={loading ? "animate-spin" : ""} />
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

      {/* SCREEN CONTENT */}
      <div className="px-6 py-6 space-y-5 print:hidden">
        {/* PAYMENT TABS: All / Paid / Not paid */}
        <div className="flex gap-2">
          {PAY_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setPayFilter(f.value)}
              className={`px-4 py-2 text-sm font-medium rounded-md border transition ${
                payFilter === f.value
                  ? "text-white border-transparent"
                  : "text-gray-600 bg-white border-gray-200 hover:bg-gray-50"
              }`}
              style={payFilter === f.value ? { background: GREEN } : undefined}
            >
              {f.label}
              <span
                className={`ml-2 text-xs ${
                  payFilter === f.value ? "text-white/80" : "text-gray-400"
                }`}
              >
                {payCounts[f.value]}
              </span>
            </button>
          ))}
        </div>

        {/* FILTERS */}
        <div className="flex flex-wrap items-end gap-5 p-5 bg-white border border-gray-200 rounded-lg">
          {/* Client */}
          <div className="relative w-64" ref={clientRef}>
            <label className={labelCls}>Client</label>
            {!selectedClient ? (
              <>
                <div className="relative">
                  <FaSearch
                    className="absolute text-gray-300 -translate-y-1/2 left-3 top-1/2"
                    size={12}
                  />
                  <input
                    type="text"
                    value={clientSearch}
                    onChange={(e) => {
                      setClientSearch(e.target.value);
                      setShowClientDrop(true);
                    }}
                    onFocus={() => setShowClientDrop(true)}
                    placeholder="All clients — type to filter..."
                    className={`${inputCls} w-full pl-9`}
                  />
                </div>
                {showClientDrop && clientResults.length > 0 && (
                  <div className="absolute left-0 right-0 z-30 mt-1 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg top-full max-h-56">
                    {clientResults.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => pickClient(c)}
                        className="flex items-center w-full gap-3 px-4 py-2.5 text-left transition border-b hover:bg-blue-50 border-gray-50 last:border-0"
                      >
                        <div className="flex items-center justify-center bg-blue-100 rounded-full w-7 h-7 shrink-0">
                          <FaUser size={10} className="text-blue-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">
                            {getClientName(c)}
                          </p>
                          <p className="font-mono text-xs text-gray-400">
                            {c.client_id}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-between px-3 py-2 border border-gray-200 rounded-md bg-gray-50">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {getClientName(selectedClient)}
                  </p>
                  <p className="font-mono text-xs text-gray-400">
                    {selectedClient.client_id}
                  </p>
                </div>
                <button
                  onClick={clearClient}
                  className="text-gray-300 hover:text-gray-500 shrink-0"
                  title="Back to all clients"
                >
                  <FaTimes size={12} />
                </button>
              </div>
            )}
          </div>

          <div>
            <label className={labelCls}>From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className={inputCls}
            />
          </div>

               <div>
            <label className={labelCls}>Group by</label>
            <select
              value={view}
              onChange={(e) => setView(e.target.value)}
              className={`${inputCls} w-36`}
            >
              <option value="day">Day</option>
              <option value="month">Month</option>
              <option value="year">Year</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="px-4 py-3 text-sm text-red-700 border-l-4 border-red-500 rounded-md bg-red-50">
            {error}
          </div>
        )}

        {/* TOTAL CARDS */}
        <div className="grid grid-cols-5 gap-5">
          {[
            ["SOAs", totals.count, false],
            ["Gross billed", totals.gross, true],
            ["Net billed", totals.net, true],
            ["Total paid", totals.paid, true],
            ["Outstanding balance", totals.balance, true],
          ].map(([label, value, money]) => (
            <div
              key={label}
              className="p-5 bg-white border border-gray-200 rounded-lg"
            >
              <p className="text-xs font-medium text-gray-400">{label}</p>
              <p
                className="mt-1 font-mono text-xl font-bold"
                style={{
                  color:
                    label === "Outstanding balance"
                      ? RED
                      : label === "Total paid"
                        ? GREEN
                        : "#1f2937",
                }}
              >
                {money ? `₱${fmt(value)}` : value}
              </p>
            </div>
          ))}
        </div>

        {/* DRILL-DOWN TABLE: period → client → SOAs */}
        <div className="overflow-hidden bg-white border border-gray-200 rounded-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-[11px] font-semibold text-gray-400">
                  <th className="px-4 py-2.5 text-left">
                    {view === "day" ? "Date" : view === "month" ? "Month" : "Year"}
                  </th>
                  <th className="px-4 py-2.5 text-right w-36">SOAs</th>
                  <th className="px-4 py-2.5 text-right">Gross billed</th>
                  <th className="px-4 py-2.5 text-right">Net billed</th>
                  <th className="px-4 py-2.5 text-right">Paid</th>
                  <th className="px-4 py-2.5 text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-gray-400">
                      Loading...
                    </td>
                  </tr>
                )}
                {!loading && periods.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-gray-400">
                      No billing statements found for these filters.
                    </td>
                  </tr>
                )}

                {!loading &&
                  paginated.map((p) => {
                    const pOpen = openPeriods.has(p.key);
                    return (
                      <React.Fragment key={p.key}>
                        {/* PERIOD ROW */}
                        <tr
                          onClick={() => togglePeriod(p.key)}
                          className="transition border-t border-gray-100 cursor-pointer hover:bg-gray-50"
                        >
                          <td className="px-4 py-2.5 font-semibold text-gray-800">
                            <span className="inline-flex items-center gap-2.5">
                              {pOpen ? (
                                <FaChevronDown size={10} className="text-gray-400" />
                              ) : (
                                <FaChevronRight size={10} className="text-gray-400" />
                              )}
                              {bucketLabel(p.key, view)}
                              <span className="text-xs font-normal text-gray-400">
                                {p.clients.length} client{p.clients.length !== 1 ? "s" : ""}
                              </span>
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right text-gray-600">{p.count}</td>
                          <td className={`${numCell} text-gray-800`}>{fmt(p.gross)}</td>
                          <td className={`${numCell} font-semibold`} style={{ color: GREEN }}>
                            ₱{fmt(p.net)}
                          </td>
                          <td className={`${numCell} text-gray-600`}>{fmt(p.paid)}</td>
                          <td
                            className={`${numCell} font-semibold`}
                            style={{ color: p.balance > 0.005 ? RED : GREEN }}
                          >
                            {fmt(p.balance)}
                          </td>
                        </tr>

                        {/* CLIENT ROWS */}
                        {pOpen &&
                          p.clients.map((c) => {
                            const cid = `${p.key}|${c.key}`;
                            const cOpen = openClients.has(cid);
                            return (
                              <React.Fragment key={cid}>
                                <tr
                                  onClick={() => toggleClient(cid)}
                                  className="transition border-t cursor-pointer border-gray-50 bg-gray-50/60 hover:bg-gray-100/70"
                                >
                                  <td className="py-2 pl-10 pr-4 text-gray-700">
                                    <span className="inline-flex items-center gap-2.5">
                                      {cOpen ? (
                                        <FaChevronDown size={9} className="text-gray-400" />
                                      ) : (
                                        <FaChevronRight size={9} className="text-gray-400" />
                                      )}
                                      {c.name}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2 text-right text-gray-500">{c.count}</td>
                                  <td className="px-4 py-2 font-mono text-right text-gray-600">{fmt(c.gross)}</td>
                                  <td className="px-4 py-2 font-mono text-right text-gray-700">₱{fmt(c.net)}</td>
                                  <td className="px-4 py-2 font-mono text-right text-gray-600">{fmt(c.paid)}</td>
                                  <td
                                    className="px-4 py-2 font-mono text-right"
                                    style={{ color: c.balance > 0.005 ? RED : GREEN }}
                                  >
                                    {fmt(c.balance)}
                                  </td>
                                </tr>

                                {/* SOA / TRANSACTION ROWS */}
                                {cOpen &&
                                  c.statements.map((s) => {
                                    const badge = PAY_BADGE[s.payState];
                                    return (
                                      <tr
                                        key={s.id}
                                        className="text-xs bg-white border-t border-gray-50"
                                      >
                                        <td className="py-2 pl-20 pr-4">
                                          <span className="font-mono text-gray-700">
                                            {s.soa_number}
                                          </span>
                                          <span className="ml-2 text-gray-400">
                                            {fmtDate(s.soa_date)}
                                          </span>
                                        </td>
                                        <td className="px-4 py-2 text-right">
                                          <span
                                            className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${badge.cls}`}
                                          >
                                            {badge.label}
                                          </span>
                                        </td>
                                        <td className="px-4 py-2 font-mono text-right text-gray-500">{fmt(s.gross)}</td>
                                        <td className="px-4 py-2 font-mono text-right text-gray-700">₱{fmt(s.net)}</td>
                                        <td className="px-4 py-2 font-mono text-right text-gray-500">{fmt(s.paid)}</td>
                                        <td
                                          className="px-4 py-2 font-mono text-right"
                                          style={{ color: s.balance > 0.005 ? RED : GREEN }}
                                        >
                                          {fmt(s.balance)}
                                        </td>
                                      </tr>
                                    );
                                  })}
                              </React.Fragment>
                            );
                          })}
                      </React.Fragment>
                    );
                  })}
              </tbody>

              {!loading && periods.length > 0 && (
                <tfoot>
                  <tr className="font-semibold text-white" style={{ background: GREEN }}>
                    <td className="px-4 py-2.5">TOTAL</td>
                    <td className="px-4 py-2.5 text-right">{totals.count}</td>
                    <td className="px-4 py-2.5 font-mono text-right">{fmt(totals.gross)}</td>
                    <td className="px-4 py-2.5 font-mono text-right">₱{fmt(totals.net)}</td>
                    <td className="px-4 py-2.5 font-mono text-right">{fmt(totals.paid)}</td>
                    <td className="px-4 py-2.5 font-mono text-right">{fmt(totals.balance)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Pagination bar */}
          {periods.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-t border-gray-100">
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">
                  {(safePage - 1) * pageSize + 1}–
                  {Math.min(safePage * pageSize, periods.length)} of {periods.length}{" "}
                  {view === "day" ? "days" : view === "month" ? "months" : "years"}
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
                <button
                  onClick={() => setPage(1)}
                  disabled={safePage === 1}
                  className="px-2.5 py-1 text-xs border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  First
                </button>
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                  className="px-2.5 py-1 text-xs border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Prev
                </button>
                <span className="px-2 text-xs text-gray-500">
                  {safePage} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                  className="px-2.5 py-1 text-xs border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Next
                </button>
                <button
                  onClick={() => setPage(totalPages)}
                  disabled={safePage === totalPages}
                  className="px-2.5 py-1 text-xs border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Last
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* PRINT-ONLY: full report (all periods expanded, no pagination) */}
      {!loading && filtered.length > 0 && (
        <div className="hidden p-6 print:block">
          <h1 className="text-lg font-bold">Billing Summary</h1>
          <p className="mb-3 text-xs text-gray-500">
            {clientLabel} · {rangeLabel} · {payLabel} · By {groupLabel} · Generated{" "}
            {new Date().toLocaleString("en-PH")}
          </p>
          <table className="w-full text-[10px] border-collapse">
            <thead>
              <tr className="border-b border-gray-400">
                <th className="py-1.5 pr-2 text-left">SOA No.</th>
                <th className="py-1.5 pr-2 text-left">SOA Date</th>
                <th className="py-1.5 pr-2 text-left">Client</th>
                <th className="py-1.5 pr-2 text-left">Payment</th>
                <th className="py-1.5 pr-2 text-right">Gross</th>
                <th className="py-1.5 pr-2 text-right">Down Pmt</th>
                <th className="py-1.5 pr-2 text-right">WHT</th>
                <th className="py-1.5 pr-2 text-right">Net</th>
                <th className="py-1.5 pr-2 text-right">Paid</th>
                <th className="py-1.5 text-right">Balance</th>
              </tr>
            </thead>
            {orderedByPeriod.map(({ period, statements }) => (
              <tbody key={period.key} className="break-inside-avoid-page">
                <tr className="bg-gray-100">
                  <td colSpan={10} className="px-1 py-1.5 font-bold">
                    {bucketLabel(period.key, view)}
                    <span className="ml-2 font-normal text-gray-500">
                      {period.count} SOA{period.count !== 1 ? "s" : ""}
                    </span>
                  </td>
                </tr>
                {statements.map((s) => (
                  <tr key={s.id} className="border-b border-gray-200 break-inside-avoid">
                    <td className="py-1 pr-2 font-mono whitespace-nowrap">{s.soa_number}</td>
                    <td className="py-1 pr-2 whitespace-nowrap">{fmtDate(s.soa_date)}</td>
                    <td className="py-1 pr-2">{s.bill_to || "—"}</td>
                    <td className="py-1 pr-2">{PAY_BADGE[s.payState].label}</td>
                    <td className="py-1 pr-2 font-mono text-right">{fmt(s.gross)}</td>
                    <td className="py-1 pr-2 font-mono text-right">{fmt(s.dp)}</td>
                    <td className="py-1 pr-2 font-mono text-right">{fmt(s.wht)}</td>
                    <td className="py-1 pr-2 font-mono text-right">{fmt(s.net)}</td>
                    <td className="py-1 pr-2 font-mono text-right">{fmt(s.paid)}</td>
                    <td className="py-1 font-mono text-right">{fmt(s.balance)}</td>
                  </tr>
                ))}
                <tr className="font-semibold border-b border-gray-400">
                  <td colSpan={4} className="py-1 pr-2 text-right">
                    Subtotal
                  </td>
                  <td className="py-1 pr-2 font-mono text-right">{fmt(period.gross)}</td>
                  <td className="py-1 pr-2" />
                  <td className="py-1 pr-2" />
                  <td className="py-1 pr-2 font-mono text-right">{fmt(period.net)}</td>
                  <td className="py-1 pr-2 font-mono text-right">{fmt(period.paid)}</td>
                  <td className="py-1 font-mono text-right">{fmt(period.balance)}</td>
                </tr>
              </tbody>
            ))}
            <tfoot>
              <tr className="font-bold border-t-2 border-gray-600">
                <td colSpan={4} className="py-2 pr-2 text-right">
                  TOTAL ({totals.count} SOA{totals.count !== 1 ? "s" : ""})
                </td>
                <td className="py-2 pr-2 font-mono text-right">{fmt(totals.gross)}</td>
                <td className="py-2 pr-2" />
                <td className="py-2 pr-2" />
                <td className="py-2 pr-2 font-mono text-right">{fmt(totals.net)}</td>
                <td className="py-2 pr-2 font-mono text-right">{fmt(totals.paid)}</td>
                <td className="py-2 font-mono text-right">{fmt(totals.balance)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}