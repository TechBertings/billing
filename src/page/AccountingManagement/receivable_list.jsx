import React, { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "../../lib/supabaseClient";
import {
  FaSearch,
  FaTimes,
  FaFileInvoiceDollar,
  FaChevronRight,
  FaCoins,
  FaReceipt,
  FaMoneyBillWave,
  FaUndo,
} from "react-icons/fa";

const GREEN = "#1a5c2e";
const RED = "#c0392b";
const AMBER = "#b7791f";
const BLUE = "#2563eb";

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
function isPastDue(dueDate) {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date(new Date().toDateString());
}

// Row-level status: derived fresh from charges/payments — not just the
// raw billing_statements.status column, so it's accurate even if that
// column hasn't been flipped to "paid" yet.
function computeStatus(row) {
  if (row.balance <= 0.005) return "paid";
  if (row.paid > 0.005) return "partial";
  if (isPastDue(row.due_date)) return "overdue";
  return "unpaid";
}

const STATUS_META = {
  paid: { label: "Paid", color: GREEN, bg: "#e8f5ec" },
  partial: { label: "Partial", color: BLUE, bg: "#eff4fb" },
  unpaid: { label: "Unpaid", color: AMBER, bg: "#fdf4e3" },
  overdue: { label: "Overdue", color: RED, bg: "#fdecea" },
};

const PAYMENT_METHOD_LABELS = {
  cash: "Cash",
  cheque: "Cheque",
  bank_transfer: "Bank Transfer",
  credit: "Client Credit",
  other: "Other",
};

const STATUS_FILTERS = ["all", "unpaid", "partial", "overdue", "paid"];

export default function ReceivablesList({ onSelectInvoice }) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortField, setSortField] = useState("due_date");
  const [sortDir, setSortDir] = useState("asc");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  // ── Date range filter (filters on due_date) ──
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // ── Detail modal (payment history for a single SOA) ──
  const [detailRow, setDetailRow] = useState(null); // the clicked row (summary)
  const [payments, setPayments] = useState([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);

  const getClientPrimaryName = (c) => {
    if (!c) return "Unknown client";
    if (c.business_name) return c.business_name;
    return [c.first_name, c.middle_name, c.last_name].filter(Boolean).join(" ") || c.client_id;
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // All finalized statements — includes already-paid ones too, since
      // this list is meant to show the full picture, not just what's owed.
      const { data: statements, error: stErr } = await supabase
        .from("billing_statements")
        .select("id, soa_number, client_id, soa_date, due_date, status")
        .not("status", "in", "(draft,pending_approval)")
        .order("due_date", { ascending: true });
      if (stErr) throw stErr;

      const billingIds = (statements || []).map((s) => s.id);
      const clientIds = [...new Set((statements || []).map((s) => s.client_id))];

      // Charges per invoice
      let chargeTotals = {};
      if (billingIds.length > 0) {
        const { data: items, error: itErr } = await supabase
          .from("billing_items")
          .select("billing_id, amount")
          .in("billing_id", billingIds);
        if (itErr) throw itErr;
        (items || []).forEach((i) => {
          chargeTotals[i.billing_id] = (chargeTotals[i.billing_id] || 0) + (Number(i.amount) || 0);
        });
      }

      // Payments applied directly to each invoice (same convention as
      // RecordPayment.jsx's fetchOutstandingSOAs — direct billing_id link only)
      let paidTotals = {};
      if (billingIds.length > 0) {
        const { data: receipts, error: orErr } = await supabase
          .from("official_receipts")
          .select("billing_id, amount")
          .in("billing_id", billingIds);
        if (orErr) throw orErr;
        (receipts || []).forEach((r) => {
          if (!r.billing_id) return;
          paidTotals[r.billing_id] = (paidTotals[r.billing_id] || 0) + (Number(r.amount) || 0);
        });
      }

      // Client profiles
      let clientMap = {};
      if (clientIds.length > 0) {
        const { data: clients } = await supabase
          .from("client_profile")
          .select("client_id, business_name, trade_name, first_name, middle_name, last_name")
          .in("client_id", clientIds);
        (clients || []).forEach((c) => (clientMap[c.client_id] = c));
      }

      const result = (statements || []).map((s) => {
        const charges = chargeTotals[s.id] || 0;
        const paid = paidTotals[s.id] || 0;
        const balance = Math.max(0, charges - paid);
        return {
          ...s,
          client: clientMap[s.client_id],
          total_amount: charges,
          paid,
          balance,
        };
      });

      setRows(result.map((r) => ({ ...r, computed_status: computeStatus(r) })));
    } catch (err) {
      console.error("Receivables List load error:", err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, startDate, endDate]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter((r) => {
      const name = getClientPrimaryName(r.client).toLowerCase();
      const matchesSearch =
        !q || name.includes(q) || r.client_id.toLowerCase().includes(q) || (r.soa_number || "").toLowerCase().includes(q);
      const matchesStatus = statusFilter === "all" || r.computed_status === statusFilter;

      // Date range — filters on due_date, inclusive of both endpoints
      const dueTime = r.due_date ? new Date(r.due_date).getTime() : null;
      const matchesStart = !startDate || (dueTime !== null && dueTime >= new Date(startDate).getTime());
      const matchesEnd = !endDate || (dueTime !== null && dueTime <= new Date(endDate).getTime());

      return matchesSearch && matchesStatus && matchesStart && matchesEnd;
    });
  }, [rows, search, statusFilter, startDate, endDate]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = sortField === "client" ? getClientPrimaryName(a.client) : a[sortField];
      const bv = sortField === "client" ? getClientPrimaryName(b.client) : b[sortField];
      let cmp;
      if (sortField === "due_date" || sortField === "soa_date") {
        cmp = new Date(av || 0) - new Date(bv || 0);
      } else if (typeof av === "string") {
        cmp = av.localeCompare(bv);
      } else {
        cmp = (av || 0) - (bv || 0);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Summary counts per status (computed over the full unfiltered set, so the
  // pill counts stay stable regardless of search/filter)
  const statusCounts = useMemo(() => {
    const c = { all: rows.length, unpaid: 0, partial: 0, overdue: 0, paid: 0 };
    rows.forEach((r) => (c[r.computed_status] = (c[r.computed_status] || 0) + 1));
    return c;
  }, [rows]);

  const grandTotals = useMemo(() => {
    return sorted.reduce(
      (acc, r) => {
        acc.total_amount += r.total_amount;
        acc.paid += r.paid;
        acc.balance += r.balance;
        return acc;
      },
      { total_amount: 0, paid: 0, balance: 0 },
    );
  }, [sorted]);

  const handleSort = (field) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const clearDateRange = () => {
    setStartDate("");
    setEndDate("");
  };

  // ── Open detail modal + fetch full payment history for that SOA ──
  const openDetail = async (row) => {
    setDetailRow(row);
    setPayments([]);
    setPaymentsLoading(true);
    try {
      const { data, error } = await supabase
        .from("official_receipts")
        .select(
          "id, invoice_number, amount, payment_date, payment_method, reference_number, cheque_number, cheque_bank, collected_by, recorded_by, notes, deposit_status",
        )
        .eq("billing_id", row.id)
        .order("payment_date", { ascending: true });
      if (error) throw error;
      setPayments(data || []);
    } catch (err) {
      console.error("Fetch payment history error:", err);
    }
    setPaymentsLoading(false);
  };

  const closeDetail = () => {
    setDetailRow(null);
    setPayments([]);
  };

  // Running total as we walk through the payment history (handles
  // reversals, which are negative-amount entries, correctly).
  const paymentsWithRunning = useMemo(() => {
    let running = 0;
    return payments.map((p) => {
      running += Number(p.amount || 0);
      return { ...p, running };
    });
  }, [payments]);

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* TOP BAR */}
      <div className="flex-shrink-0 px-6 py-4 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center rounded-full w-9 h-9" style={{ background: "#e8f5ec" }}>
              <FaFileInvoiceDollar size={14} style={{ color: GREEN }} />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-gray-800">Receivables List</h1>
            </div>
          </div>
        </div>

        {/* Status filter pills */}
        <div className="flex flex-wrap gap-2 mb-3">
          {STATUS_FILTERS.map((s) => {
            const meta = s === "all" ? { label: "All", color: "#6b7280" } : STATUS_META[s];
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-md border text-xs font-semibold transition ${
                  statusFilter === s ? "border-gray-400" : "border-gray-100 hover:bg-gray-50"
                }`}
                style={statusFilter === s ? { background: `${meta.color}1a`, color: meta.color } : { color: "#6b7280" }}
              >
                {meta.label} <span className="opacity-60">({statusCounts[s] || 0})</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <FaSearch className="absolute text-gray-300 -translate-y-1/2 left-3 top-1/2" size={12} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search client or SOA #..."
              className="w-full py-2 pr-8 text-sm border border-gray-200 rounded-md pl-9 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute text-gray-300 -translate-y-1/2 right-3 top-1/2 hover:text-gray-500">
                <FaTimes size={11} />
              </button>
            )}
          </div>

          {/* Due date range filter — Start Date / End Date */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              max={endDate || undefined}
              className="px-2 py-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
            />
            <label className="text-xs text-gray-400">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate || undefined}
              className="px-2 py-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
            />
            {(startDate || endDate) && (
              <button onClick={clearDateRange} className="text-gray-300 hover:text-gray-500">
                <FaTimes size={11} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-4 ml-auto text-xs text-gray-400">
            <span>
              Total: <span className="font-mono font-semibold text-gray-700">₱{fmt(grandTotals.total_amount)}</span>
            </span>
            <span>
              Paid: <span className="font-mono font-semibold text-green-700">₱{fmt(grandTotals.paid)}</span>
            </span>
            <span>
              Balance: <span className="font-mono font-semibold text-red-600">₱{fmt(grandTotals.balance)}</span>
            </span>
          </div>
        </div>
      </div>

      {/* TABLE */}
      <div className="flex flex-col flex-1 min-h-0 p-6">
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-white border border-gray-200 rounded-lg">
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-5 h-5 border-2 border-blue-500 rounded-full border-t-transparent animate-spin" />
            </div>
          ) : sorted.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-gray-300">
              <FaFileInvoiceDollar size={22} />
              <p className="text-sm">No invoices found.</p>
            </div>
          ) : (
            <>
              <div className="flex-1 min-h-0 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="text-gray-500 bg-gray-50 sticky top-0 z-[1]">
                    <tr>
                      <th
                        onClick={() => handleSort("soa_number")}
                        className="px-4 py-2.5 font-medium text-left cursor-pointer hover:text-gray-700"
                      >
                        SOA #
                      </th>
                      <th
                        onClick={() => handleSort("client")}
                        className="px-4 py-2.5 font-medium text-left cursor-pointer hover:text-gray-700"
                      >
                        Client
                      </th>
                      <th
                        onClick={() => handleSort("due_date")}
                        className="px-4 py-2.5 font-medium text-left cursor-pointer hover:text-gray-700"
                      >
                        Due Date
                      </th>
                      <th
                        onClick={() => handleSort("total_amount")}
                        className="px-4 py-2.5 font-medium text-right cursor-pointer hover:text-gray-700"
                      >
                        Total Amount
                      </th>
                      <th
                        onClick={() => handleSort("paid")}
                        className="px-4 py-2.5 font-medium text-right cursor-pointer hover:text-gray-700"
                      >
                        Paid Amount
                      </th>
                      <th
                        onClick={() => handleSort("balance")}
                        className="px-4 py-2.5 font-medium text-right cursor-pointer hover:text-gray-700"
                      >
                        Outstanding Balance
                      </th>
                      <th className="px-4 py-2.5 font-medium text-center">Status</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((r) => {
                      const meta = STATUS_META[r.computed_status];
                      const overdueDays = r.computed_status === "overdue" ? Math.floor((new Date() - new Date(r.due_date)) / (1000 * 60 * 60 * 24)) : 0;
                      return (
                        <tr
                          key={r.id}
                          onClick={() => openDetail(r)}
                          className="transition border-t cursor-pointer border-gray-50 hover:bg-gray-50/60"
                        >
                          <td className="px-4 py-3 font-mono text-gray-700">{r.soa_number}</td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-800">{getClientPrimaryName(r.client)}</p>
                            <p className="font-mono text-[10px] text-gray-400">{r.client_id}</p>
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {fmtDate(r.due_date)}
                            {r.computed_status === "overdue" && (
                              <span className="ml-1.5 text-[10px] font-semibold" style={{ color: RED }}>
                                ({overdueDays}d late)
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono text-right text-gray-700">₱{fmt(r.total_amount)}</td>
                          <td className="px-4 py-3 font-mono text-right text-gray-600">
                            {r.paid > 0.005 ? `₱${fmt(r.paid)}` : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-3 font-mono font-semibold text-right text-gray-800">
                            {r.balance > 0.005 ? `₱${fmt(r.balance)}` : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold"
                              style={{ background: meta.bg, color: meta.color }}
                            >
                              {meta.label}
                            </span>
                          </td>
                          <td className="px-2 py-3 text-gray-300">
                            <FaChevronRight size={10} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-gray-200 bg-gray-50">
                      <td colSpan={3} className="px-4 py-3 font-medium text-right text-gray-600">
                        Total ({sorted.length} invoice{sorted.length !== 1 ? "s" : ""})
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-right text-gray-700">₱{fmt(grandTotals.total_amount)}</td>
                      <td className="px-4 py-3 font-mono font-bold text-right text-green-700">₱{fmt(grandTotals.paid)}</td>
                      <td className="px-4 py-3 font-mono font-bold text-right" style={{ color: RED }}>₱{fmt(grandTotals.balance)}</td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Pagination — stays outside the scroll area, always visible */}
              {sorted.length > PAGE_SIZE && (
                <div className="flex items-center justify-between flex-shrink-0 px-4 py-3 border-t border-gray-100 text-[11px] text-gray-400">
                  <span>
                    Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, sorted.length)} of {sorted.length}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-2.5 py-1 border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
                    >
                      Prev
                    </button>
                    <span className="px-2">Page {page} of {totalPages}</span>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="px-2.5 py-1 border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* DETAIL MODAL — full payment history for the clicked SOA */}
      {detailRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-2xl max-h-[85vh] flex flex-col bg-white shadow-2xl rounded-xl overflow-hidden">
            {/* Header */}
            <div className="flex items-start justify-between flex-shrink-0 px-5 py-4 border-b border-gray-100">
              <div>
                <div className="flex items-center gap-2">
                  <FaFileInvoiceDollar size={13} style={{ color: GREEN }} />
                  <p className="text-sm font-semibold text-gray-800">{detailRow.soa_number}</p>
                  <span
                    className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold"
                    style={{
                      background: STATUS_META[detailRow.computed_status].bg,
                      color: STATUS_META[detailRow.computed_status].color,
                    }}
                  >
                    {STATUS_META[detailRow.computed_status].label}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-gray-500">
                  {getClientPrimaryName(detailRow.client)}{" "}
                  <span className="font-mono text-gray-400">({detailRow.client_id})</span>
                </p>
                <p className="text-[11px] text-gray-400">
                  SOA date {fmtDate(detailRow.soa_date)} · Due {fmtDate(detailRow.due_date)}
                </p>
              </div>
              <button onClick={closeDetail} className="p-1.5 text-gray-300 rounded-md hover:text-gray-500 hover:bg-gray-50">
                <FaTimes size={14} />
              </button>
            </div>

            {/* Summary strip */}
            <div className="grid flex-shrink-0 grid-cols-3 gap-3 px-5 py-3 border-b border-gray-100 bg-gray-50">
              <div>
                <p className="text-[10px] font-medium tracking-wide text-gray-400 uppercase">Total Amount</p>
                <p className="font-mono text-sm font-semibold text-gray-800">₱{fmt(detailRow.total_amount)}</p>
              </div>
              <div>
                <p className="text-[10px] font-medium tracking-wide text-gray-400 uppercase">Paid</p>
                <p className="font-mono text-sm font-semibold text-green-700">₱{fmt(detailRow.paid)}</p>
              </div>
              <div>
                <p className="text-[10px] font-medium tracking-wide text-gray-400 uppercase">Balance</p>
                <p className="font-mono text-sm font-semibold" style={{ color: detailRow.balance > 0.005 ? RED : GREEN }}>
                  ₱{fmt(detailRow.balance)}
                </p>
              </div>
            </div>

            {/* Payment history */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              {paymentsLoading ? (
                <div className="flex justify-center py-10">
                  <div className="w-4 h-4 border-2 border-blue-500 rounded-full border-t-transparent animate-spin" />
                </div>
              ) : payments.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-gray-300">
                  <FaReceipt size={20} />
                  <p className="text-xs">No payments recorded yet for this SOA.</p>
                </div>
              ) : (
                <table className="w-full text-xs">
                  <thead className="sticky top-0 text-gray-500 bg-white border-b border-gray-100">
                    <tr>
                      <th className="px-5 py-2 font-medium text-left">Date</th>
                      <th className="px-3 py-2 font-medium text-left">Invoice #</th>
                      <th className="px-3 py-2 font-medium text-left">Method</th>
                      <th className="px-3 py-2 font-medium text-left">Details</th>
                      <th className="px-3 py-2 font-medium text-right">Amount</th>
                      <th className="px-5 py-2 font-medium text-right">Running Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paymentsWithRunning.map((p) => {
                      const isReversal = Number(p.amount) < 0;
                      return (
                        <tr key={p.id} className="border-b border-gray-50">
                          <td className="px-5 py-2.5 text-gray-600 whitespace-nowrap">{fmtDate(p.payment_date)}</td>
                          <td className="px-3 py-2.5 font-mono text-gray-700 whitespace-nowrap">{p.invoice_number}</td>
                          <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">
                            {PAYMENT_METHOD_LABELS[p.payment_method] || p.payment_method}
                            {isReversal && (
                              <span className="inline-flex items-center gap-1 ml-1.5 text-[10px] font-semibold" style={{ color: RED }}>
                                <FaUndo size={8} /> reversal
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-gray-400">
                            {p.payment_method === "cheque" && p.cheque_number
                              ? `${p.cheque_number}${p.cheque_bank ? " / " + p.cheque_bank : ""}`
                              : p.reference_number || (p.notes ? p.notes : "—")}
                            {p.deposit_status === "undeposited" && (
                              <span className="ml-1.5 text-[10px] font-medium" style={{ color: AMBER }}>
                                · undeposited
                              </span>
                            )}
                          </td>
                          <td
                            className="px-3 py-2.5 font-mono font-semibold text-right whitespace-nowrap"
                            style={{ color: isReversal ? RED : "#374151" }}
                          >
                            {isReversal ? "− " : ""}₱{fmt(Math.abs(p.amount))}
                          </td>
                          <td className="px-5 py-2.5 font-mono text-right text-gray-500 whitespace-nowrap">₱{fmt(p.running)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Footer actions */}
            <div className="flex items-center justify-between flex-shrink-0 px-5 py-3 border-t border-gray-100 bg-gray-50">
              <button
                onClick={closeDetail}
                className="px-3 py-2 text-xs font-medium text-gray-600 border border-gray-200 rounded-md hover:bg-white"
              >
                Close
              </button>
              {detailRow.balance > 0.005 && (
                <button
                  onClick={() => {
                    onSelectInvoice?.(detailRow.client, detailRow.client_id, detailRow.id);
                    closeDetail();
                  }}
                  className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-white rounded-md"
                  style={{ background: GREEN }}
                >
                  <FaMoneyBillWave size={11} />
                  Record Payment for this SOA
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}