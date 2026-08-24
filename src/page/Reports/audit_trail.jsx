import React, { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../../lib/supabaseClient";
import {
  FaSearch,
  FaTimes,
  FaUser,
  FaHistory,
  FaFilter,
  FaExchangeAlt,
  FaCheckCircle,
  FaUndo,
} from "react-icons/fa";

const GREEN = "#1a5c2e";
const RED = "#c0392b";
const AMBER = "#d97706";

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

// Extracts the original invoice number from a reversal entry's notes,
// e.g. "Reversal of Invoice INV-2026-0001 (recorded 2026-08-16) — bounced cheque"
function extractReversedInvoice(notes) {
  if (!notes) return null;
  const match = notes.match(/^Reversal of Invoice (\S+)/);
  return match ? match[1] : null;
}

const STATUS_META = {
  all: { label: "All", dot: "#9ca3af", bg: "#f3f4f6", activeBg: "#374151", color: "#4b5563" },
  normal: { label: "Normal", dot: GREEN, bg: "#e6f4ea", activeBg: GREEN, color: GREEN },
  reversed: { label: "Reversed", dot: RED, bg: "#fde8e8", activeBg: RED, color: RED },
  reversal_entry: { label: "Reversal Entry", dot: AMBER, bg: "#fff4e0", activeBg: AMBER, color: "#a15c00" },
};
const STATUS_OPTIONS = [
  { key: "all", ...STATUS_META.all },
  { key: "normal", ...STATUS_META.normal },
  { key: "reversed", ...STATUS_META.reversed },
  { key: "reversal_entry", ...STATUS_META.reversal_entry },
];

export default function AuditTrail() {
  // ── Filters ──
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [clientSearch, setClientSearch] = useState("");
  const [clientResults, setClientResults] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [clientSearchLoading, setClientSearchLoading] = useState(false);
  const [showClientDrop, setShowClientDrop] = useState(false);
  const clientRef = useRef(null);

  // ── Data ──
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;
  useEffect(() => {
    const handler = (e) => {
      if (clientRef.current && !clientRef.current.contains(e.target))
        setShowClientDrop(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Client search — same pattern as RecordPayment.jsx ──
  const searchClients = useCallback(async (term) => {
    setClientSearchLoading(true);
    try {
      let query = supabase
        .from("client_profile")
        .select("id, client_id, business_name, trade_name, first_name, middle_name, last_name")
        .limit(8);

      if (term.trim()) {
        query = query.or(
          `business_name.ilike.%${term}%,client_id.ilike.%${term}%,first_name.ilike.%${term}%,last_name.ilike.%${term}%,trade_name.ilike.%${term}%`,
        );
      } else {
        query = query.order("business_name", { ascending: true });
      }

      const { data, error } = await query;
      if (!error) {
        setClientResults(data || []);
        setShowClientDrop(true);
      }
    } finally {
      setClientSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!clientSearch.trim() || selectedClient) return;
    const t = setTimeout(() => searchClients(clientSearch), 300);
    return () => clearTimeout(t);
  }, [clientSearch, selectedClient, searchClients]);

  const getClientPrimaryName = (c) => {
    if (!c) return "";
    if (c.business_name) return c.business_name;
    return [c.first_name, c.middle_name, c.last_name].filter(Boolean).join(" ") || c.client_id;
  };

  const selectClient = (c) => {
    setSelectedClient(c);
    setClientSearch(getClientPrimaryName(c));
    setShowClientDrop(false);
    setClientResults([]);
  };

  const clearClientFilter = () => {
    setSelectedClient(null);
    setClientSearch("");
  };

  // ── Fetch + build the journal ──
  const fetchJournal = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("official_receipts")
        .select(
          "id, invoice_number, client_id, billing_id, soa_number, amount, payment_date, payment_method, reference_number, notes, collected_by, recorded_by, created_at",
        )
        .order("payment_date", { ascending: false })
        .order("created_at", { ascending: false });
        
      if (dateFrom) query = query.gte("payment_date", dateFrom);
      if (dateTo) query = query.lte("payment_date", dateTo);
      if (selectedClient) query = query.eq("client_id", selectedClient.client_id);

      const { data, error } = await query;
      if (error) throw error;

      const receipts = data || [];

      // Client names for display
      const clientIds = [...new Set(receipts.map((r) => r.client_id).filter(Boolean))];
      let clientMap = {};
      if (clientIds.length > 0) {
        const { data: clients } = await supabase
          .from("client_profile")
          .select("client_id, business_name, trade_name, first_name, middle_name, last_name")
          .in("client_id", clientIds);
        (clients || []).forEach((c) => {
          clientMap[c.client_id] = c;
        });
      }

      // Build lookup: invoice_number -> the row that reverses it (if any)
      const reversalByOriginal = {};
      receipts.forEach((r) => {
        const originalInv = extractReversedInvoice(r.notes);
        if (originalInv) reversalByOriginal[originalInv] = r;
      });

      const built = receipts.map((r) => {
        const c = clientMap[r.client_id];
        const clientName = c
          ? c.business_name ||
            [c.first_name, c.middle_name, c.last_name].filter(Boolean).join(" ") ||
            r.client_id
          : r.client_id || "—";

        const reversedByEntry = extractReversedInvoice(r.notes); // this row IS a reversal of X
        const reversingEntry = reversalByOriginal[r.invoice_number]; // this row WAS reversed by Y

        let status = "normal";
        if (reversedByEntry) status = "reversal_entry";
        else if (reversingEntry) status = "reversed";

        return {
          ...r,
          clientName,
          status,
          reversedByEntry, // invoice_number of the original this row reverses
          reversingEntry, // the full row object that reverses this one
        };
      });

      setRows(built);
    } catch (err) {
      console.error("fetchJournal error:", err);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, selectedClient]);

  useEffect(() => {
    fetchJournal();
  }, [fetchJournal]);

    useEffect(() => {
    setPage(1);
  }, [statusFilter, dateFrom, dateTo, selectedClient]);

const visibleRows = rows.filter((r) => statusFilter === "all" || r.status === statusFilter);

  const totalPages = Math.max(1, Math.ceil(visibleRows.length / PAGE_SIZE));
  const paginatedRows = visibleRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const counts = rows.reduce(
    (acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    },
    { normal: 0, reversed: 0, reversal_entry: 0 },
  );
  counts.all = rows.length;

  const netTotal = visibleRows.reduce((s, r) => s + Number(r.amount || 0), 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* TOP BAR / FILTERS */}
      <div className="sticky top-0 z-10 px-6 py-4 bg-white border-b border-gray-200">
        <div className="flex items-center gap-3 mb-4">
          <div
            className="flex items-center justify-center rounded-full w-9 h-9"
            style={{ background: "#e8f5ec" }}
          >
            <FaHistory size={14} style={{ color: GREEN }} />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-gray-800">Audit Trail / Payment Journal</h1>
            <p className="text-xs text-gray-400">Full history of recorded payments and reversals</p>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="relative min-w-[220px]" ref={clientRef}>
            <label className={labelCls}>Client</label>
            {!selectedClient ? (
              <>
                <div style={{ position: "relative" }}>
                  <FaSearch className="absolute text-gray-300 -translate-y-1/2 left-3 top-1/2" size={12} />
                  <input
                    type="text"
                    value={clientSearch}
                    onChange={(e) => {
                      setClientSearch(e.target.value);
                      setShowClientDrop(true);
                    }}
                    onFocus={() => {
                      searchClients(clientSearch);
                      setShowClientDrop(true);
                    }}
                    placeholder="All clients"
                    className="w-full py-2 pr-8 text-sm border border-gray-200 rounded-md pl-9 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
                  />
                  {clientSearchLoading && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                  )}
                </div>
                {showClientDrop && clientResults.length > 0 && (
                  <div className="absolute left-0 right-0 z-30 mt-1 overflow-hidden overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg top-full max-h-56">
                    {clientResults.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => selectClient(c)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50 text-left border-b border-gray-50 last:border-0 transition"
                      >
                        <div className="flex items-center justify-center bg-blue-100 rounded-full w-7 h-7 shrink-0">
                          <FaUser size={10} className="text-blue-500" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-800">{getClientPrimaryName(c)}</p>
                          <p className="font-mono text-xs text-gray-400">{c.client_id}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-between px-3 py-2 border border-gray-200 rounded-md bg-gray-50">
                <div className="flex items-center gap-2.5">
                  <div className="flex items-center justify-center bg-blue-100 rounded-full w-7 h-7 shrink-0">
                    <FaUser size={10} className="text-blue-500" />
                  </div>
                  <p className="text-sm font-medium text-gray-800">{getClientPrimaryName(selectedClient)}</p>
                </div>
                <button onClick={clearClientFilter} className="text-gray-300 hover:text-gray-500">
                  <FaTimes size={12} />
                </button>
              </div>
            )}
          </div>

          <div>
            <label className={labelCls}>Date From</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Date To</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>
              <FaFilter size={9} className="inline mr-1 -mt-0.5" />
              Status
            </label>
            <div className="relative">
              <span
                className="absolute top-0 bottom-0 left-0 rounded-l-md"
                style={{ width: 4, background: STATUS_META[statusFilter].dot }}
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="py-2 pl-4 text-xs font-semibold transition border rounded-md cursor-pointer pr-7 focus:outline-none focus:ring-1"
                style={{
                  background: STATUS_META[statusFilter].bg,
                  borderColor: STATUS_META[statusFilter].activeBg,
                  color: STATUS_META[statusFilter].color,
                }}
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.key} value={opt.key} style={{ color: "#222", background: "#fff" }}>
                    {opt.label} ({counts[opt.key] ?? 0})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* TABLE */}
      <div className="p-6">
        <div className="overflow-hidden bg-white border border-gray-200 rounded-lg">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
            <p className="text-xs font-semibold tracking-wider text-gray-400 uppercase">
              {visibleRows.length} entr{visibleRows.length === 1 ? "y" : "ies"}
            </p>
            <p className="text-xs text-gray-500">
              Net total:{" "}
              <span className="font-mono font-semibold" style={{ color: GREEN }}>
                ₱{fmt(netTotal)}
              </span>
            </p>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-5 h-5 border-2 border-blue-500 rounded-full border-t-transparent animate-spin" />
            </div>
          ) : visibleRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-gray-300">
              <FaHistory size={24} />
              <p className="text-sm">No entries match these filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-gray-500 bg-gray-50">
                  <tr>
                    <th className="px-3 py-2.5 font-medium text-left w-28">Date</th>
                    <th className="px-3 py-2.5 font-medium text-left">Invoice #</th>
                    <th className="px-3 py-2.5 font-medium text-left">Client</th>
                    <th className="px-3 py-2.5 font-medium text-left">Method</th>
                    <th className="px-3 py-2.5 font-medium text-right">Amount</th>
                    <th className="px-3 py-2.5 font-medium text-left w-32">Status</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.map((r) => (
                                        <React.Fragment key={r.id}>
                      <tr
                        className={`border-t border-gray-50 cursor-pointer hover:bg-gray-50/70 transition ${
                          r.amount < 0 ? "bg-red-50/30" : ""
                        }`}
                        onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                      >
                        <td className="px-3 py-2.5 text-gray-600">{fmtDate(r.payment_date)}</td>
                        <td className="px-3 py-2.5 font-mono text-gray-700">{r.invoice_number}</td>
                        <td className="px-3 py-2.5 text-gray-700">{r.clientName}</td>
                        <td className="px-3 py-2.5 text-gray-500 capitalize">
                          {(r.payment_method || "—").replace(/_/g, " ")}
                        </td>
                        <td
                          className="px-3 py-2.5 font-mono text-right font-semibold"
                          style={{ color: r.amount < 0 ? RED : "#374151" }}
                        >
                          {r.amount < 0 ? "− " : ""}₱{fmt(Math.abs(r.amount))}
                        </td>
                        <td className="px-3 py-2.5">
                          <StatusPill status={r.status} />
                        </td>
                        <td className="px-3 py-2.5 text-gray-300">
                          {expandedId === r.id ? "▲" : "▼"}
                        </td>
                      </tr>
                      {expandedId === r.id && (
                        <tr className="border-t border-gray-50 bg-gray-50/50">
                          <td colSpan={7} className="px-5 py-3">
                            <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-xs sm:grid-cols-3">
                              <DetailField label="Reference No." value={r.reference_number || "—"} mono />
                              <DetailField label="SOA #" value={r.soa_number || "—"} mono />
                              <DetailField label="Collected by" value={r.collected_by || "—"} />
                              <DetailField label="Recorded by" value={r.recorded_by || "—"} />
                              <DetailField label="Logged at" value={fmtDateTime(r.created_at)} />
                              {r.status === "reversal_entry" && (
                                <DetailField
                                  label="Reverses invoice"
                                  value={r.reversedByEntry}
                                  mono
                                  icon={<FaUndo size={9} style={{ color: AMBER }} />}
                                />
                              )}
                              {r.status === "reversed" && r.reversingEntry && (
                                <DetailField
                                  label="Reversed by"
                                  value={`${r.reversingEntry.invoice_number} (${fmtDate(r.reversingEntry.payment_date)})`}
                                  mono
                                  icon={<FaExchangeAlt size={9} style={{ color: RED }} />}
                                />
                              )}
                            </div>
                            {r.notes && (
                              <div className="pt-2 mt-2 text-gray-500 border-t border-gray-100">
                                <span className="font-medium text-gray-400">Notes: </span>
                                {r.notes}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
 </table>
            </div>
          )}

          {!loading && visibleRows.length > PAGE_SIZE && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
              <span className="text-xs text-gray-400">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, visibleRows.length)} of{" "}
                {visibleRows.length}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 text-xs border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
                >
                  Prev
                </button>
                <span className="text-xs text-gray-500">
                  {page}/{totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 text-xs border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status }) {
  const meta = STATUS_META[status] || STATUS_META.normal;
  const icon =
    status === "reversed" ? (
      <FaExchangeAlt size={9} />
    ) : status === "reversal_entry" ? (
      <FaUndo size={9} />
    ) : (
      <FaCheckCircle size={9} />
    );
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
      style={{ background: meta.bg, color: meta.color }}
    >
      {icon} {meta.label}
    </span>
  );
}

function DetailField({ label, value, mono, icon }) {
  return (
    <div>
      <p className="text-[10px] text-gray-400 uppercase tracking-wide">{label}</p>
      <p className={`text-gray-700 flex items-center gap-1 ${mono ? "font-mono" : ""}`}>
        {icon} {value}
      </p>
    </div>
  );
}