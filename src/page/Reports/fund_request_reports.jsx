import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "../../lib/supabaseClient";
import {
  FaCoins,
  FaSearch,
  FaTimes,
  FaChevronDown,
  FaFileInvoiceDollar,
  FaFilter,
  FaPrint,
  FaFileExcel,
  FaFilePdf,
} from "react-icons/fa";
import { exportTablePDF } from "../../utils/report_pdf";

const GREEN = "#1a5c2e";

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
    day: "2-digit",
  });
}

const POOL_META = {
  income: { label: "Retainer Fee (Income)" },
  remittance: { label: "Gov't Remittance" },
};

const POOL_TABS = ["all", "income", "remittance"];

// fund_requests.fund_type -> which pool it draws down from
const FUND_TYPE_TO_POOL = {
  operating_expenses: "income",
  remittances: "remittance",
};

// relative column widths for the PDF
const PDF_COLS = [
  { label: "Date", w: 1.2 },
  { label: "Pool", w: 1.8 },
  { label: "Party", w: 2.4 },
  { label: "Reference", w: 1.5 },
  { label: "Amount (PHP)", w: 1.4 },
];

const pageBtn =
  "px-2.5 py-1 text-[11px] border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition";

export default function FundRequestReports() {
  const [loading, setLoading] = useState(true);
  const [poolBalances, setPoolBalances] = useState({ income: null, remittance: null });
  const [entries, setEntries] = useState([]); // fund requests only
  const [pdfBusy, setPdfBusy] = useState(false);

  const [poolTab, setPoolTab] = useState("all");
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // ── Client picker (single select) ──
  const [selectedClient, setSelectedClient] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [pickSearch, setPickSearch] = useState("");
  const pickerRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) setShowPicker(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

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
    try {
      // ── Authoritative current balances (falls back to computed net below
      // if this table/columns don't exist in your schema) ──
      const { data: pools } = await supabase
        .from("fund_pools")
        .select("pool_type, balance");
      const balances = { income: null, remittance: null };
      (pools || []).forEach((p) => {
        if (p.pool_type === "income" || p.pool_type === "remittance") {
          balances[p.pool_type] = Number(p.balance) || 0;
        }
      });

      // ── Inflows: official_receipts (used ONLY for the pool balance cards) ──
      const { data: receipts, error: recErr } = await supabase
        .from("official_receipts")
        .select(
          "id, invoice_number, client_id, income_amount, remittance_amount, payment_date, payment_method",
        )
        .order("payment_date", { ascending: false });
      if (recErr) throw recErr;

      const receiptEntries = [];
      (receipts || []).forEach((r) => {
        if (Number(r.income_amount) !== 0) {
          receiptEntries.push({
            pool: "income",
            direction: Number(r.income_amount) > 0 ? "in" : "out",
            amount: Math.abs(Number(r.income_amount)),
          });
        }
        if (Number(r.remittance_amount) !== 0) {
          receiptEntries.push({
            pool: "remittance",
            direction: Number(r.remittance_amount) > 0 ? "in" : "out",
            amount: Math.abs(Number(r.remittance_amount)),
          });
        }
      });

      // ── Outflows: approved fund_requests, mapped by fund_type ──
      const { data: fundRequests, error: frErr } = await supabase
        .from("fund_requests")
        .select("id, slip_number, fund_type, tax_payer, total_amount, status, request_date")
        .eq("status", "approved")
        .order("request_date", { ascending: false });
      if (frErr) throw frErr;

      const fundRequestEntries = (fundRequests || []).map((f) => ({
        id: `${f.id}-fr`,
        date: f.request_date,
        pool: FUND_TYPE_TO_POOL[f.fund_type] || "income",
        direction: "out",
        amount: Number(f.total_amount) || 0,
        label: "Fund Request",
        ref: f.slip_number,
        party: f.tax_payer,
      }));

      // Full ledger (receipts + fund requests) is used ONLY to compute pool balances
      const ledger = [...receiptEntries, ...fundRequestEntries];

      // The table shows fund requests only
      const all = [...fundRequestEntries].sort(
        (a, b) => new Date(b.date) - new Date(a.date),
      );

      // If fund_pools table isn't available, compute net balance from the
      // ledger itself (in - out per pool) so the summary cards still work.
      ["income", "remittance"].forEach((pool) => {
        if (balances[pool] === null) {
          balances[pool] = ledger
            .filter((e) => e.pool === pool)
            .reduce((sum, e) => sum + (e.direction === "in" ? e.amount : -e.amount), 0);
        }
      });

      setPoolBalances(balances);
      setEntries(all);
    } catch (err) {
      console.error("FundRequestReports load error:", err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Client options come from the fund requests themselves (tax_payer)
  const clientOptions = useMemo(
    () =>
      [...new Set(entries.map((e) => e.party).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [entries],
  );
  const visibleOptions = clientOptions.filter((c) =>
    c.toLowerCase().includes(pickSearch.toLowerCase()),
  );

  // Data only appears when client + start date + end date are all set
  const filtersReady = Boolean(selectedClient && startDate && endDate);

  const missing = [
    !selectedClient && "client",
    !startDate && "start date",
    !endDate && "end date",
  ].filter(Boolean);

  useEffect(() => {
    setPage(1);
  }, [poolTab, search, startDate, endDate, selectedClient, pageSize]);

  const filtered = useMemo(() => {
    if (!filtersReady) return [];
    const q = search.toLowerCase();
    return entries.filter((e) => {
      if (e.party !== selectedClient) return false;
      if (poolTab !== "all" && e.pool !== poolTab) return false;
      const d = e.date ? String(e.date).slice(0, 10) : null; // YYYY-MM-DD
      if (!d || d < startDate || d > endDate) return false;
      if (
        q &&
        !(e.ref || "").toLowerCase().includes(q) &&
        !(e.label || "").toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [entries, filtersReady, selectedClient, poolTab, search, startDate, endDate]);

  const totalRequested = useMemo(
    () => filtered.reduce((sum, e) => sum + e.amount, 0),
    [filtered],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const clearDateRange = () => {
    setStartDate("");
    setEndDate("");
  };

  const resetFilters = () => {
    setSelectedClient("");
    setStartDate("");
    setEndDate("");
    setSearch("");
    setPoolTab("all");
  };

  // ── Export helpers (always export ALL filtered rows, not just the current page) ──
  const poolLabel = poolTab === "all" ? "All Pools" : POOL_META[poolTab].label;
  const rangeLabel = filtersReady ? `${fmtDate(startDate)} – ${fmtDate(endDate)}` : "";
  const stamp = new Date().toISOString().split("T")[0];

  const exportExcel = () => {
    const XLSX = window.XLSX;
    if (!XLSX) {
      alert("SheetJS not loaded yet, please try again in a moment.");
      return;
    }
    const aoa = [
      ["Fund Request Report"],
      [`Client: ${selectedClient}`],
      [`Period: ${rangeLabel}`],
      [`Pool: ${poolLabel}`],
      [],
      ["#", "Date", "Pool", "Party", "Reference", "Amount"],
      ...filtered.map((e, i) => [
        i + 1,
        fmtDate(e.date),
        POOL_META[e.pool].label,
        e.party || "",
        e.ref || "",
        Number(e.amount) || 0,
      ]),
      ["", "", "", "", "TOTAL", totalRequested],
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [{ wch: 5 }, { wch: 14 }, { wch: 24 }, { wch: 34 }, { wch: 18 }, { wch: 16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Fund Requests");
    XLSX.writeFile(wb, `fund_request_report_${stamp}.xlsx`);
  };

  const exportPDF = async () => {
    setPdfBusy(true);
    try {
      const subtitle = [selectedClient, rangeLabel, poolLabel].filter(Boolean).join("  |  ");
      await exportTablePDF({
        title: "Fund Request Report",
        subtitle,
        cols: PDF_COLS,
        groups: [
          {
            label: null,
            rows: [
              ...filtered.map((e) => [
                fmtDate(e.date),
                POOL_META[e.pool].label,
                e.party || "—",
                e.ref || "—",
                fmt(e.amount),
              ]),
              ["", "", "", "TOTAL", fmt(totalRequested)],
            ],
          },
        ],
        fileName: `fund_request_report_${stamp}.pdf`,
      });
    } finally {
      setPdfBusy(false);
    }
  };

  const exportDisabled = loading || !filtersReady || filtered.length === 0;

  return (
    <div className="flex flex-col h-screen bg-gray-50 print:h-auto print:block print:bg-white">
      {/* TOP BAR */}
      <div className="flex-shrink-0 px-6 py-4 bg-white border-b border-gray-200 print:hidden">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center bg-gray-100 rounded-full w-9 h-9">
              <FaCoins size={14} className="text-gray-500" />
            </div>
            <h1 className="text-sm font-semibold text-gray-800">Fund Request Report</h1>
          </div>

          <div className="flex gap-2">
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

        {/* Pool balance cards */}
        <div className="grid max-w-xl grid-cols-2 gap-3 mb-4">
          {["income", "remittance"].map((pool) => (
            <div key={pool} className="px-4 py-3 bg-gray-100 border border-gray-200 rounded-xl">
              <p className="text-[10px] font-semibold tracking-wide text-gray-500 uppercase">
                {POOL_META[pool].label}
              </p>
              <p className="font-mono text-lg font-bold text-gray-800">
                ₱{fmt(poolBalances[pool])}
              </p>
            </div>
          ))}
        </div>

        {/* Pool tabs */}
        <div className="flex flex-wrap gap-2 mb-3">
          {POOL_TABS.map((p) => (
            <button
              key={p}
              onClick={() => setPoolTab(p)}
              className={`px-3 py-1.5 rounded-md border text-xs font-semibold transition ${
                poolTab === p
                  ? "border-gray-400 bg-gray-100 text-gray-800"
                  : "border-gray-100 text-gray-500 hover:bg-gray-50"
              }`}
            >
              {p === "all" ? "All" : POOL_META[p].label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Client picker */}
          <div className="relative" ref={pickerRef}>
            <button
              onClick={() => setShowPicker((v) => !v)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50 min-w-[220px] justify-between"
            >
              <span className="truncate">
                {selectedClient ? selectedClient : "Select client *"}
              </span>
              <FaChevronDown size={10} className="text-gray-400" />
            </button>
            {showPicker && (
              <div className="absolute left-0 z-30 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl w-80">
                <div className="p-2 border-b border-gray-100">
                  <input
                    type="text"
                    autoFocus
                    value={pickSearch}
                    onChange={(e) => setPickSearch(e.target.value)}
                    placeholder="Find client..."
                    className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:border-gray-400"
                  />
                </div>
                <div className="overflow-y-auto max-h-64">
                  {visibleOptions.length === 0 && (
                    <p className="px-3 py-4 text-xs text-center text-gray-400">No clients found</p>
                  )}
                  {visibleOptions.map((c) => (
                    <button
                      key={c}
                      onClick={() => {
                        setSelectedClient(c);
                        setShowPicker(false);
                        setPickSearch("");
                      }}
                      className={`block w-full px-3 py-2 text-xs text-left hover:bg-gray-50 ${
                        selectedClient === c ? "bg-gray-100 font-semibold text-gray-800" : "text-gray-700"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Date range */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400">Start Date *</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              max={endDate || undefined}
              className="px-2 py-2 text-xs border border-gray-200 rounded-md"
            />
            <label className="text-xs text-gray-400">End Date *</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate || undefined}
              className="px-2 py-2 text-xs border border-gray-200 rounded-md"
            />
            {(startDate || endDate) && (
              <button onClick={clearDateRange} className="text-gray-300 hover:text-gray-500">
                <FaTimes size={11} />
              </button>
            )}
          </div>

          {/* Reference search (only useful after the filters are set) */}
          <div className="relative flex-1 max-w-xs">
            <FaSearch className="absolute text-gray-300 -translate-y-1/2 left-3 top-1/2" size={12} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              disabled={!filtersReady}
              placeholder="Search ref no..."
              className="w-full py-2 pr-8 text-sm border border-gray-200 rounded-md pl-9 focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-100 disabled:bg-gray-50 disabled:cursor-not-allowed"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute text-gray-300 -translate-y-1/2 right-3 top-1/2 hover:text-gray-500"
              >
                <FaTimes size={11} />
              </button>
            )}
          </div>

          {(selectedClient || startDate || endDate) && (
            <button onClick={resetFilters} className="text-xs text-gray-500 hover:underline">
              Reset filters
            </button>
          )}

          {filtersReady && (
            <div className="flex items-center gap-4 ml-auto text-xs text-gray-500">
              <span>
                Total Requested:{" "}
                <span className="font-mono font-semibold text-gray-800">
                  ₱{fmt(totalRequested)}
                </span>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* TABLE (screen) */}
      <div className="flex flex-col flex-1 min-h-0 p-6 print:hidden">
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-white border border-gray-200 rounded-lg">
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-5 h-5 border-2 border-gray-400 rounded-full border-t-transparent animate-spin" />
            </div>
          ) : !filtersReady ? (
            <div className="flex flex-col items-center gap-2 py-16 text-gray-300">
              <FaFilter size={22} />
              <p className="text-sm text-gray-400">
                Please select a {missing.join(", ").replace(/, ([^,]*)$/, " and $1")} to view fund requests.
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-gray-300">
              <FaFileInvoiceDollar size={22} />
              <p className="text-sm">No fund requests found.</p>
            </div>
          ) : (
            <>
              <div className="flex-1 min-h-0 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="text-gray-500 bg-gray-50 sticky top-0 z-[1]">
                    <tr>
                      <th className="px-4 py-2.5 font-medium text-left">Date</th>
                      <th className="px-4 py-2.5 font-medium text-left">Pool</th>
                      <th className="px-4 py-2.5 font-medium text-left">Party</th>
                      <th className="px-4 py-2.5 font-medium text-left">Reference</th>
                      <th className="px-4 py-2.5 font-medium text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((e) => (
                      <tr key={e.id} className="border-t border-gray-50">
                        <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">
                          {fmtDate(e.date)}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-600">
                            {POOL_META[e.pool].label}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-gray-700">{e.party || "—"}</td>
                        <td className="px-4 py-2.5 font-mono text-gray-500">{e.ref || "—"}</td>
                        <td className="px-4 py-2.5 font-mono font-semibold text-right text-gray-800">
                          ₱{fmt(e.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-gray-200 bg-gray-50">
                      <td colSpan={4} className="px-4 py-3 font-medium text-right text-gray-600">
                        Total ({filtered.length} fund request{filtered.length !== 1 ? "s" : ""})
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-right text-gray-800">
                        ₱{fmt(totalRequested)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* PAGINATION */}
              <div className="flex items-center justify-between flex-shrink-0 px-4 py-3 border-t border-gray-100">
                <div className="flex items-center gap-3 text-[11px] text-gray-400">
                  <span>
                    {(safePage - 1) * pageSize + 1}–
                    {Math.min(safePage * pageSize, filtered.length)} of {filtered.length}
                  </span>
                  <label className="flex items-center gap-1.5">
                    Rows
                    <select
                      value={pageSize}
                      onChange={(e) => setPageSize(Number(e.target.value))}
                      className="px-1.5 py-1 text-[11px] border border-gray-200 rounded-md"
                    >
                      {[10, 15, 25, 50, 100].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </label>
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
                  <span className="px-2 text-[11px] text-gray-500">
                    Page {safePage} of {totalPages}
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
      {filtersReady && filtered.length > 0 && (
        <div className="hidden p-6 print:block">
          <h1 className="text-lg font-bold">Fund Request Report</h1>
          <p className="mb-3 text-xs text-gray-500">
            {selectedClient} · {rangeLabel} · {poolLabel} · Generated{" "}
            {new Date().toLocaleString("en-PH")}
          </p>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-gray-400">
                <th className="py-1.5 pr-3 text-left">Date</th>
                <th className="py-1.5 pr-3 text-left">Pool</th>
                <th className="py-1.5 pr-3 text-left">Party</th>
                <th className="py-1.5 pr-3 text-left">Reference</th>
                <th className="py-1.5 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id} className="border-b border-gray-200 break-inside-avoid">
                  <td className="py-1.5 pr-3 whitespace-nowrap">{fmtDate(e.date)}</td>
                  <td className="py-1.5 pr-3">{POOL_META[e.pool].label}</td>
                  <td className="py-1.5 pr-3">{e.party || "—"}</td>
                  <td className="py-1.5 pr-3 font-mono">{e.ref || "—"}</td>
                  <td className="py-1.5 font-mono text-right">₱{fmt(e.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-600 font-bold">
                <td colSpan={4} className="py-2 pr-3 text-right">
                  TOTAL ({filtered.length} fund request{filtered.length !== 1 ? "s" : ""})
                </td>
                <td className="py-2 font-mono text-right">₱{fmt(totalRequested)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}