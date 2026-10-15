import React, { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../../lib/supabaseClient";
import {
  FaSearch,
  FaTimes,
  FaUser,
  FaHistory,
  FaFilter,
  FaSync,
  FaDownload,
  FaFileInvoice,
  FaEdit,
  FaCheckCircle,
  FaBan,
  FaMoneyBillWave,
  FaUndo,
  FaTrashAlt,
  FaPlusCircle,
  FaMinusCircle,
  FaExchangeAlt,
} from "react-icons/fa";

const GREEN = "#1a5c2e";
const RED = "#c0392b";
const AMBER = "#a15c00";
const BLUE = "#1d4ed8";

const BG_GREEN = "#e6f4ea";
const BG_RED = "#fde8e8";
const BG_AMBER = "#fff4e0";
const BG_BLUE = "#e0ecff";

const inputCls =
  "w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 bg-white transition";
const labelCls = "block text-xs font-medium text-gray-500 mb-1";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const EXPORT_LIMIT = 20000;

// ── Event catalogue (matches the `event` values written by the DB triggers) ──
const EVENT_META = {
  soa_created: { label: "SOA created", color: GREEN, bg: BG_GREEN, Icon: FaFileInvoice },
  soa_edited: { label: "SOA edited", color: BLUE, bg: BG_BLUE, Icon: FaEdit },
  soa_approved: { label: "SOA approved", color: GREEN, bg: BG_GREEN, Icon: FaCheckCircle },
  soa_rejected: { label: "SOA rejected", color: RED, bg: BG_RED, Icon: FaBan },
  soa_marked_paid: { label: "SOA marked paid", color: GREEN, bg: BG_GREEN, Icon: FaMoneyBillWave },
  soa_voided: { label: "SOA voided", color: RED, bg: BG_RED, Icon: FaBan },
  soa_status_changed: { label: "SOA status changed", color: AMBER, bg: BG_AMBER, Icon: FaExchangeAlt },
  soa_deleted: { label: "SOA deleted", color: RED, bg: BG_RED, Icon: FaTrashAlt },
  soa_item_added: { label: "Item added", color: GREEN, bg: BG_GREEN, Icon: FaPlusCircle },
  soa_item_edited: { label: "Item edited", color: BLUE, bg: BG_BLUE, Icon: FaEdit },
  soa_item_removed: { label: "Item removed", color: RED, bg: BG_RED, Icon: FaMinusCircle },
  payment_recorded: { label: "Payment recorded", color: GREEN, bg: BG_GREEN, Icon: FaMoneyBillWave },
  payment_reversed: { label: "Payment reversed", color: RED, bg: BG_RED, Icon: FaUndo },
  receipt_edited: { label: "Receipt edited", color: BLUE, bg: BG_BLUE, Icon: FaEdit },
  receipt_deposit_status_changed: {
    label: "Deposit status changed",
    color: AMBER,
    bg: BG_AMBER,
    Icon: FaExchangeAlt,
  },
  receipt_deleted: { label: "Receipt deleted", color: RED, bg: BG_RED, Icon: FaTrashAlt },
};

const EVENT_GROUPS = [
  {
    key: "soa",
    label: "Statements (SOA)",
    events: [
      "soa_created",
      "soa_edited",
      "soa_approved",
      "soa_rejected",
      "soa_marked_paid",
      "soa_voided",
      "soa_status_changed",
      "soa_deleted",
    ],
  },
  {
    key: "items",
    label: "SOA items",
    events: ["soa_item_added", "soa_item_edited", "soa_item_removed"],
  },
  {
    key: "payments",
    label: "Payments & receipts",
    events: [
      "payment_recorded",
      "payment_reversed",
      "receipt_edited",
      "receipt_deposit_status_changed",
      "receipt_deleted",
    ],
  },
];

const HIGHLIGHT_EVENTS = new Set([
  "soa_rejected",
  "soa_voided",
  "soa_deleted",
  "soa_item_removed",
  "payment_reversed",
  "receipt_deleted",
]);

// ── helpers ─────────────────────────────────────────────────────────────────
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
    timeZone: "Asia/Manila",
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
    second: "2-digit",
    timeZone: "Asia/Manila",
  });
}

function humanize(key) {
  return String(key).replace(/_/g, " ");
}

function fmtValue(key, v) {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "object") return JSON.stringify(v);
  if (typeof v === "number" && /amount|payment|tax|total|balance/i.test(key)) {
    return `₱${fmt(v)}`;
  }
  return String(v);
}

function getClientPrimaryName(c) {
  if (!c) return "";
  if (c.business_name) return c.business_name;
  return (
    [c.first_name, c.middle_name, c.last_name].filter(Boolean).join(" ") ||
    c.client_id
  );
}

function pick(obj, keys) {
  const out = {};
  (keys || []).forEach((k) => {
    out[k] = obj ? obj[k] : undefined;
  });
  return out;
}

function csvCell(v) {
  let s = v === null || v === undefined ? "" : String(v);
  // neutralise spreadsheet formula injection on free-text values
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

function useDebounced(value, ms = 400) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

// Builds the list of page buttons, e.g. [1, "…", 4, 5, 6, "…", 20]
function getPageNumbers(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, current - 1, current, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push("…");
    out.push(p);
  });
  return out;
}

// ── component ───────────────────────────────────────────────────────────────
export default function AuditTrail() {
  // ── Filters ──
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [eventFilter, setEventFilter] = useState("all"); // all | group:<key> | <event>
  const [search, setSearch] = useState("");
  const [actorFilter, setActorFilter] = useState("");
  const dSearch = useDebounced(search.trim());
  const dActor = useDebounced(actorFilter.trim());

  const [clientSearch, setClientSearch] = useState("");
  const [clientResults, setClientResults] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [clientSearchLoading, setClientSearchLoading] = useState(false);
  const [showClientDrop, setShowClientDrop] = useState(false);
  const clientRef = useRef(null);

  // ── Data ──
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [exporting, setExporting] = useState(false);

  // ── Pagination (server-side) ──
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  useEffect(() => {
    const handler = (e) => {
      if (clientRef.current && !clientRef.current.contains(e.target))
        setShowClientDrop(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Client search ──
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

      const { data, error: err } = await query;
      if (!err) {
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

  // ── Shared filter builder (used by the table AND the export) ──
  const applyFilters = useCallback(
    (q) => {
      // Philippines has no DST, so a fixed +08:00 is safe
      if (dateFrom) q = q.gte("occurred_at", `${dateFrom}T00:00:00+08:00`);
      if (dateTo) q = q.lte("occurred_at", `${dateTo}T23:59:59.999+08:00`);
      if (selectedClient) q = q.eq("client_id", selectedClient.client_id);

      if (eventFilter.startsWith("group:")) {
        const g = EVENT_GROUPS.find((x) => x.key === eventFilter.slice(6));
        if (g) q = q.in("event", g.events);
      } else if (eventFilter !== "all") {
        q = q.eq("event", eventFilter);
      }

      if (dSearch) {
        const t = dSearch.replace(/[,()%*\\]/g, "");
        if (t) q = q.or(`soa_number.ilike.%${t}%,invoice_number.ilike.%${t}%`);
      }
      if (dActor) {
        const a = dActor.replace(/[%*\\]/g, "");
        if (a) q = q.ilike("actor", `%${a}%`);
      }
      return q;
    },
    [dateFrom, dateTo, selectedClient, eventFilter, dSearch, dActor],
  );

  // ── Load one page ──
  const reqRef = useRef(0);
  const load = useCallback(async () => {
    const id = ++reqRef.current;
    setLoading(true);
    setError("");
    try {
      const from = (page - 1) * pageSize;
      const { data, count, error: err } = await applyFilters(
        supabase.from("billing_audit_log").select("*", { count: "exact" }),
      )
        .order("occurred_at", { ascending: false })
        .order("id", { ascending: false })
        .range(from, from + pageSize - 1);
      if (err) throw err;

      const ids = [...new Set((data || []).map((r) => r.client_id).filter(Boolean))];
      const nameMap = {};
      if (ids.length > 0) {
        const { data: cl } = await supabase
          .from("client_profile")
          .select("client_id, business_name, first_name, middle_name, last_name")
          .in("client_id", ids);
        (cl || []).forEach((c) => {
          nameMap[c.client_id] = getClientPrimaryName(c);
        });
      }

      if (id !== reqRef.current) return; // a newer request superseded this one
      setRows(
        (data || []).map((r) => ({
          ...r,
          clientName: nameMap[r.client_id] || r.client_id || "—",
        })),
      );
      setTotal(count || 0);
    } catch (e) {
      if (id !== reqRef.current) return;
      console.error("AuditTrail load error:", e);
      setError(e.message || "Failed to load the audit trail.");
      setRows([]);
      setTotal(0);
    } finally {
      if (id === reqRef.current) setLoading(false);
    }
  }, [applyFilters, page, pageSize]);

  useEffect(() => {
    load();
  }, [load]);

  // Back to page 1 whenever the result set changes
  useEffect(() => {
    setPage(1);
    setExpandedId(null);
  }, [dateFrom, dateTo, selectedClient, eventFilter, dSearch, dActor, pageSize]);

  useEffect(() => {
    setExpandedId(null);
  }, [page]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // ── CSV export (all rows matching the current filters, not just this page) ──
  const exportCsv = async () => {
    setExporting(true);
    setError("");
    try {
      const all = [];
      const size = 1000;
      for (let off = 0; off < EXPORT_LIMIT; off += size) {
        const { data, error: err } = await applyFilters(
          supabase.from("billing_audit_log").select("*"),
        )
          .order("occurred_at", { ascending: false })
          .order("id", { ascending: false })
          .range(off, off + size - 1);
        if (err) throw err;
        all.push(...(data || []));
        if (!data || data.length < size) break;
      }

      const head = [
        "Date/Time (PH)",
        "Event",
        "Table",
        "SOA No.",
        "Invoice No.",
        "Client ID",
        "Amount",
        "User",
        "Reason / Notes",
        "Changed fields",
        "Before",
        "After",
        "Record ID",
      ];
      const lines = [head.map(csvCell).join(",")];
      all.forEach((r) => {
        const changed = r.changed_fields || [];
        lines.push(
          [
            fmtDateTime(r.occurred_at),
            EVENT_META[r.event]?.label || r.event,
            r.table_name,
            r.soa_number || "",
            r.invoice_number || "",
            r.client_id || "",
            r.amount ?? "",
            r.actor,
            r.reason || "",
            changed.join("; "),
            r.action === "UPDATE"
              ? JSON.stringify(pick(r.old_data, changed))
              : r.action === "DELETE"
                ? JSON.stringify(r.old_data)
                : "",
            r.action === "UPDATE"
              ? JSON.stringify(pick(r.new_data, changed))
              : r.action === "INSERT"
                ? JSON.stringify(r.new_data)
                : "",
            r.record_id,
          ]
            .map(csvCell)
            .join(","),
        );
      });

      const blob = new Blob(["\uFEFF" + lines.join("\r\n")], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit_trail_${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      if (all.length >= EXPORT_LIMIT) {
        alert(
          `Export is limited to the latest ${EXPORT_LIMIT.toLocaleString()} entries. Narrow the date range to get the rest.`,
        );
      }
    } catch (e) {
      console.error("AuditTrail export error:", e);
      setError(e.message || "Export failed.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* TOP BAR / FILTERS */}
      <div className="sticky top-0 z-10 px-6 py-4 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center rounded-full w-9 h-9"
              style={{ background: "#e8f5ec" }}
            >
              <FaHistory size={14} style={{ color: GREEN }} />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-gray-800">Audit Trail</h1>
              <p className="text-xs text-gray-400">
                Who did what and when: statements, items, payments and reversals
              </p>
            </div>
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
              onClick={exportCsv}
              disabled={exporting || loading || total === 0}
              className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-white transition rounded-md disabled:opacity-40"
              style={{ background: GREEN }}
            >
              <FaDownload size={11} /> {exporting ? "Exporting..." : "Export CSV"}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          {/* Search */}
          <div className="min-w-[200px]">
            <label className={labelCls}>SOA / Invoice no.</label>
            <div className="relative">
              <FaSearch
                className="absolute text-gray-300 -translate-y-1/2 left-3 top-1/2"
                size={12}
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="e.g. SOA-2026-0001"
                className={`${inputCls} pl-9`}
              />
            </div>
          </div>

          {/* Client */}
          <div className="relative min-w-[220px]" ref={clientRef}>
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
                    onFocus={() => {
                      searchClients(clientSearch);
                      setShowClientDrop(true);
                    }}
                    placeholder="All clients"
                    className={`${inputCls} pl-9 pr-8`}
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
                        className="flex items-center w-full gap-3 px-4 py-2.5 text-left transition border-b hover:bg-blue-50 border-gray-50 last:border-0"
                      >
                        <div className="flex items-center justify-center bg-blue-100 rounded-full w-7 h-7 shrink-0">
                          <FaUser size={10} className="text-blue-500" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-800">
                            {getClientPrimaryName(c)}
                          </p>
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
                  <p className="text-sm font-medium text-gray-800">
                    {getClientPrimaryName(selectedClient)}
                  </p>
                </div>
                <button onClick={clearClientFilter} className="text-gray-300 hover:text-gray-500">
                  <FaTimes size={12} />
                </button>
              </div>
            )}
          </div>

          <div>
            <label className={labelCls}>Date From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Date To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>
              <FaFilter size={9} className="inline mr-1 -mt-0.5" />
              Event
            </label>
            <select
              value={eventFilter}
              onChange={(e) => setEventFilter(e.target.value)}
              className={`${inputCls} w-56`}
            >
              <option value="all">All events</option>
              {EVENT_GROUPS.map((g) => (
                <optgroup key={g.key} label={g.label}>
                  <option value={`group:${g.key}`}>All {g.label.toLowerCase()}</option>
                  {g.events.map((ev) => (
                    <option key={ev} value={ev}>
                      {EVENT_META[ev].label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div className="w-40">
            <label className={labelCls}>User</label>
            <input
              type="text"
              value={actorFilter}
              onChange={(e) => setActorFilter(e.target.value)}
              placeholder="Any user"
              className={inputCls}
            />
          </div>
        </div>
      </div>

      {/* TABLE */}
      <div className="p-6">
        {error && (
          <div className="flex items-center justify-between px-4 py-3 mb-4 text-sm text-red-700 border-l-4 border-red-500 rounded-md bg-red-50">
            <span>{error}</span>
            <button onClick={load} className="text-xs font-semibold underline">
              Retry
            </button>
          </div>
        )}

        <div className="overflow-hidden bg-white border border-gray-200 rounded-lg">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
            <p className="text-xs font-semibold tracking-wider text-gray-400 uppercase">
              {total.toLocaleString()} entr{total === 1 ? "y" : "ies"}
            </p>
            <p className="text-xs text-gray-400">
              Append-only log: entries can't be edited or deleted
            </p>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-5 h-5 border-2 border-blue-500 rounded-full border-t-transparent animate-spin" />
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-gray-300">
              <FaHistory size={24} />
              <p className="text-sm">No entries match these filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-gray-500 bg-gray-50">
                  <tr>
                    <th className="px-3 py-2.5 font-medium text-left w-44">When</th>
                    <th className="px-3 py-2.5 font-medium text-left w-48">Event</th>
                    <th className="px-3 py-2.5 font-medium text-left">Reference</th>
                    <th className="px-3 py-2.5 font-medium text-left">Client</th>
                    <th className="px-3 py-2.5 font-medium text-right">Amount</th>
                    <th className="px-3 py-2.5 font-medium text-left">By</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <React.Fragment key={r.id}>
                      <tr
                        className={`border-t border-gray-50 cursor-pointer hover:bg-gray-50/70 transition ${
                          HIGHLIGHT_EVENTS.has(r.event) ? "bg-red-50/30" : ""
                        }`}
                        onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                      >
                        <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">
                          {fmtDateTime(r.occurred_at)}
                        </td>
                        <td className="px-3 py-2.5">
                          <EventPill event={r.event} />
                        </td>
                        <td className="px-3 py-2.5">
                          <p className="font-mono text-gray-700">
                            {r.invoice_number || r.soa_number || "—"}
                          </p>
                          {r.invoice_number && r.soa_number && (
                            <p className="font-mono text-[10px] text-gray-400">
                              SOA {r.soa_number}
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-gray-700">{r.clientName}</td>
                        <td
                          className="px-3 py-2.5 font-mono font-semibold text-right"
                          style={{ color: Number(r.amount) < 0 ? RED : "#374151" }}
                        >
                          {r.amount === null || r.amount === undefined
                            ? "—"
                            : `${Number(r.amount) < 0 ? "− " : ""}₱${fmt(Math.abs(r.amount))}`}
                        </td>
                        <td className="px-3 py-2.5 text-gray-600">{r.actor}</td>
                        <td className="px-3 py-2.5 text-gray-300">
                          {expandedId === r.id ? "▲" : "▼"}
                        </td>
                      </tr>
                      {expandedId === r.id && (
                        <tr className="border-t border-gray-50 bg-gray-50/50">
                          <td colSpan={7} className="px-5 py-3">
                            <AuditDetail r={r} />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* PAGINATION */}
          {!loading && total > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-t border-gray-100">
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span>
                  {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of{" "}
                  {total.toLocaleString()}
                </span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="px-2 py-1 text-xs text-gray-600 border border-gray-200 rounded-md focus:outline-none"
                >
                  {PAGE_SIZE_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n} / page
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 text-xs transition border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Prev
                </button>

                {getPageNumbers(page, totalPages).map((p, i) =>
                  p === "…" ? (
                    <span key={`gap-${i}`} className="px-1 text-xs text-gray-300">
                      …
                    </span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className="px-2.5 py-1.5 text-xs border rounded-md transition"
                      style={
                        p === page
                          ? { background: GREEN, borderColor: GREEN, color: "#fff" }
                          : { borderColor: "#e5e7eb", color: "#4b5563" }
                      }
                    >
                      {p}
                    </button>
                  ),
                )}

                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 text-xs transition border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
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

// ── sub-components ──────────────────────────────────────────────────────────
function EventPill({ event }) {
  const meta = EVENT_META[event] || {
    label: event,
    color: "#4b5563",
    bg: "#f3f4f6",
    Icon: FaHistory,
  };
  const { Icon } = meta;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap"
      style={{ background: meta.bg, color: meta.color }}
    >
      <Icon size={9} /> {meta.label}
    </span>
  );
}

function AuditDetail({ r }) {
  const [reversedBy, setReversedBy] = useState(null);

  // For an original payment, find the reversal (if any) that cancelled it
  useEffect(() => {
    if (r.event !== "payment_recorded" || !r.invoice_number) return;
    let alive = true;
    supabase
      .from("official_receipts")
      .select("invoice_number, payment_date")
      .eq("reverses_invoice", r.invoice_number)
      .limit(1)
      .then(({ data }) => {
        if (alive) setReversedBy(data && data[0] ? data[0] : null);
      });
    return () => {
      alive = false;
    };
  }, [r.event, r.invoice_number]);

  const changed = r.changed_fields || [];
  const snapshot = r.action === "DELETE" ? r.old_data : r.new_data;

  return (
    <div className="space-y-3 text-xs">
      <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 sm:grid-cols-3">
        <DetailField label="User" value={r.actor} />
        <DetailField label="Logged at" value={fmtDateTime(r.occurred_at)} />
        <DetailField label="Source table" value={r.table_name} mono />
        <DetailField label="Record ID" value={r.record_id} mono />
        <DetailField label="SOA #" value={r.soa_number || "—"} mono />
        <DetailField label="Invoice #" value={r.invoice_number || "—"} mono />
        {r.event === "payment_reversed" && r.new_data?.reverses_invoice && (
          <DetailField label="Reverses invoice" value={r.new_data.reverses_invoice} mono />
        )}
        {reversedBy && (
          <DetailField
            label="Later reversed by"
            value={`${reversedBy.invoice_number} (${fmtDate(reversedBy.payment_date)})`}
            mono
          />
        )}
      </div>

      {r.reason && (
        <div className="pt-2 text-gray-500 border-t border-gray-100">
          <span className="font-medium text-gray-400">Reason / notes: </span>
          {r.reason}
        </div>
      )}

      {r.action === "UPDATE" && changed.length > 0 && (
        <div className="pt-2 border-t border-gray-100">
          <p className="mb-1.5 text-[10px] font-semibold tracking-wide text-gray-400 uppercase">
            What changed
          </p>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-400">
                <th className="py-1 pr-4 font-medium w-48">Field</th>
                <th className="py-1 pr-4 font-medium">Before</th>
                <th className="py-1 font-medium">After</th>
              </tr>
            </thead>
            <tbody>
              {changed.map((k) => (
                <tr key={k} className="border-t border-gray-100">
                  <td className="py-1 pr-4 text-gray-500 capitalize">{humanize(k)}</td>
                  <td className="py-1 pr-4 font-mono break-all" style={{ color: RED }}>
                    {fmtValue(k, r.old_data?.[k])}
                  </td>
                  <td className="py-1 font-mono break-all" style={{ color: GREEN }}>
                    {fmtValue(k, r.new_data?.[k])}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {r.action !== "UPDATE" && snapshot && (
        <details className="pt-2 border-t border-gray-100">
          <summary className="cursor-pointer text-[10px] font-semibold tracking-wide text-gray-400 uppercase">
            {r.action === "DELETE" ? "Deleted record" : "Record snapshot"}
          </summary>
          <pre className="p-3 mt-2 overflow-x-auto font-mono text-[11px] text-gray-600 bg-white border border-gray-100 rounded-md">
            {JSON.stringify(snapshot, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}

function DetailField({ label, value, mono }) {
  return (
    <div>
      <p className="text-[10px] text-gray-400 uppercase tracking-wide">{label}</p>
      <p className={`text-gray-700 break-all ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}