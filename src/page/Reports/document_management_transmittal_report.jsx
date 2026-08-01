import React, { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "../../lib/supabaseClient";
import {
  FaSearch,
  FaTimes,
  FaFileInvoiceDollar,
  FaCalendarAlt,
  FaPrint,
  FaSyncAlt,
  FaCheckCircle,
  FaEnvelope,
} from "react-icons/fa";

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

const PAGE_SIZE = 12;

/**
 * Read-only report of SOAs that have already been approved / sent to clients.
 * Pulls directly from billing_statements (status = "approved") — no new
 * tables. Amount is derived from billing_items minus down payment / WHT,
 * same math as CreateBilling.jsx.
 *
 * Props:
 *  - currentUser: same shape used elsewhere (unused here, kept for parity)
 */
export default function TransmittalReport() {
  const [rows, setRows] = useState([]); // all approved SOAs, enriched with totalDue
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  const fetchTransmittals = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data: statements, error: stErr } = await supabase
        .from("billing_statements")
        .select(
          "id, soa_number, client_id, bill_to, address, soa_date, due_date, down_payment, withholding_tax, status, approved_by, approved_at",
        )
        .eq("status", "approved")
        .order("approved_at", { ascending: false, nullsFirst: false });
      if (stErr) throw stErr;

      const billingIds = (statements || []).map((s) => s.id);
      if (billingIds.length === 0) {
        setRows([]);
        return;
      }

      const { data: items, error: itErr } = await supabase
        .from("billing_items")
        .select("billing_id, amount")
        .in("billing_id", billingIds);
      if (itErr) throw itErr;

      const subtotals = {};
      (items || []).forEach((i) => {
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

  // ── Client-side filtering ──
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (term) {
        const hay = `${r.soa_number || ""} ${r.bill_to || ""}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      if (dateFrom && r.soa_date && r.soa_date < dateFrom) return false;
      if (dateTo && r.soa_date && r.soa_date > dateTo) return false;
      return true;
    });
  }, [rows, search, dateFrom, dateTo]);

  useEffect(() => {
    setPage(1);
  }, [search, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // ── Summary stats ──
  const totalAmount = filtered.reduce((s, r) => s + r.totalDue, 0);
  const thisMonthKey = new Date().toISOString().slice(0, 7); // YYYY-MM
  const thisMonthCount = filtered.filter(
    (r) => (r.soa_date || "").slice(0, 7) === thisMonthKey,
  ).length;

  const clearFilters = () => {
    setSearch("");
    setDateFrom("");
    setDateTo("");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-white border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center rounded-full w-9 h-9"
            style={{ background: LIGHT_GREEN }}
          >
            <FaFileInvoiceDollar size={14} style={{ color: GREEN }} />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-gray-800">
              Transmittal Report
            </h1>
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
            onClick={() => window.print()}
            className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-white transition rounded-md"
            style={{ background: GREEN }}
          >
            <FaPrint size={11} /> Print
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center justify-between px-4 py-2.5 mx-6 mt-4 text-sm text-red-700 border-l-4 border-red-500 rounded-md bg-red-50">
          {error}
          <button onClick={() => setError("")}>
            <FaTimes size={11} />
          </button>
        </div>
      )}

      <div className="p-6 space-y-5">
        {/* Summary cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="p-4 bg-white border border-gray-100 rounded-xl">
            <p className="text-xs font-medium text-gray-400">Total Transmitted</p>
            <p className="mt-1 text-2xl font-bold text-gray-800">
              {filtered.length}
            </p>
            <p className="text-xs text-gray-400">SOA{filtered.length === 1 ? "" : "s"} sent to clients</p>
          </div>
          <div className="p-4 border rounded-xl" style={{ borderColor: "#bfe3cb", background: LIGHT_GREEN }}>
            <p className="text-xs font-semibold" style={{ color: GREEN }}>Total Amount</p>
            <p className="mt-1 font-mono text-2xl font-bold" style={{ color: GREEN }}>
              ₱{fmt(totalAmount)}
            </p>
            <p className="text-xs" style={{ color: GREEN }}>Across filtered results</p>
          </div>
          <div className="p-4 bg-white border border-gray-100 rounded-xl">
            <p className="text-xs font-medium text-gray-400">This Month</p>
            <p className="mt-1 text-2xl font-bold text-gray-800">{thisMonthCount}</p>
            <p className="text-xs text-gray-400">SOAs transmitted so far</p>
          </div>
        </div>

        {/* Filters */}
        <div className="p-4 bg-white border border-gray-100 rounded-xl">
          <div className="grid items-end grid-cols-1 gap-3 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <label className={labelCls}>Search</label>
              <div className="relative">
                <FaSearch className="absolute text-gray-300 -translate-y-1/2 left-3 top-1/2" size={12} />
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
              <div className="flex gap-2">
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className={inputCls}
                />
                {(search || dateFrom || dateTo) && (
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
                  </tfoot>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                <span className="text-xs text-gray-400">
                  {(page - 1) * PAGE_SIZE + 1}–
                  {Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-2.5 py-1 text-xs border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
                  >
                    Prev
                  </button>
                  <span className="text-xs text-gray-500">{page}/{totalPages}</span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-2.5 py-1 text-xs border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}