import React, { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "../../lib/supabaseClient";
import {
  FaSearch,
  FaTimes,
  FaUser,
  FaMoneyBillWave,
  FaExclamationTriangle,
  FaFileInvoiceDollar,
  FaChevronRight,
  FaCoins,
} from "react-icons/fa";

const GREEN = "#1a5c2e";
const RED = "#c0392b";
const AMBER = "#b7791f";

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
  return new Date(d).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "2-digit" });
}
function daysOverdue(dueDate) {
  if (!dueDate) return 0;
  const diff = Math.floor((new Date() - new Date(dueDate)) / (1000 * 60 * 60 * 24));
  return diff;
}
// Bucket a single overdue-day count into an aging column
function bucketFor(days) {
  if (days <= 0) return "current";
  if (days <= 30) return "b1_30";
  if (days <= 60) return "b31_60";
  if (days <= 90) return "b61_90";
  return "b90_plus";
}

const BUCKETS = [
  { key: "current", label: "Current", color: GREEN },
  { key: "b1_30", label: "1–30 days", color: "#2563eb" },
  { key: "b31_60", label: "31–60 days", color: AMBER },
  { key: "b61_90", label: "61–90 days", color: "#d97706" },
  { key: "b90_plus", label: "90+ days", color: RED },
];

export default function ARAgingReport({ onSelectClient }) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]); // one row per client with balances + bucket totals
  const [creditOnlyRows, setCreditOnlyRows] = useState([]); // clients with credit but no outstanding balance
  const [search, setSearch] = useState("");
  const [bucketFilter, setBucketFilter] = useState("all");
  const [sortField, setSortField] = useState("total_balance");
  const [sortDir, setSortDir] = useState("desc");

  const getClientPrimaryName = (c) => {
    if (!c) return "Unknown client";
    if (c.business_name) return c.business_name;
    return [c.first_name, c.middle_name, c.last_name].filter(Boolean).join(" ") || c.client_id;
  };

  // ── Core fetch + aggregation ──────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      // 1) All finalized statements (the "charges" side)
      const { data: statements, error: stErr } = await supabase
        .from("billing_statements")
        .select("id, soa_number, client_id, soa_date, due_date, status")
        .in("status", ["approved", "unpaid"])
        .order("due_date", { ascending: true });
      if (stErr) throw stErr;

      const billingIds = (statements || []).map((s) => s.id);

      // 2) Totals per billing_id (sum of billing_items)
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

      // 3) All payments — grouped by client. Payments applied to a specific
      // billing_id are netted against that invoice first; unapplied/general
      // payments are netted against the client's oldest invoice (FIFO),
      // same convention used in StatementOfAccountSummary.jsx.
      const clientIds = [...new Set((statements || []).map((s) => s.client_id))];
      let receiptsByClient = {};
      if (clientIds.length > 0) {
        const { data: receipts, error: orErr } = await supabase
          .from("official_receipts")
          .select("client_id, billing_id, amount, payment_date")
          .in("client_id", clientIds);
        if (orErr) throw orErr;
        (receipts || []).forEach((r) => {
          if (!receiptsByClient[r.client_id]) receiptsByClient[r.client_id] = [];
          receiptsByClient[r.client_id].push(r);
        });
      }

      // 4) Client profiles for display
      let clientMap = {};
      if (clientIds.length > 0) {
        const { data: clients } = await supabase
          .from("client_profile")
          .select("client_id, business_name, trade_name, first_name, middle_name, last_name")
          .in("client_id", clientIds);
        (clients || []).forEach((c) => (clientMap[c.client_id] = c));
      }

      // 4b) Credit balances — fetched separately across ALL clients (not just
      // those with an outstanding statement), since a client can have credit
      // sitting unused with zero open invoices.
      const { data: credits, error: credErr } = await supabase
        .from("client_credits")
        .select("client_id, balance");
      if (credErr) console.error("client_credits fetch error:", credErr);
      const creditMap = {};
      (credits || []).forEach((c) => {
        if (Number(c.balance) > 0.005) creditMap[c.client_id] = Number(c.balance);
      });

      // 5) Group statements by client, apply payments FIFO per client
      const byClient = {};
      (statements || []).forEach((s) => {
        if (!byClient[s.client_id]) byClient[s.client_id] = [];
        byClient[s.client_id].push({
          ...s,
          charge: itemTotals[s.id] || 0,
        });
      });

      const result = Object.entries(byClient).map(([clientId, invoices]) => {
        // Oldest invoice first so payments settle the oldest debt first
        const sortedInvoices = [...invoices].sort(
          (a, b) => new Date(a.soa_date) - new Date(b.soa_date),
        );

        // Payments applied to a specific billing_id are subtracted directly;
        // the rest (general/unapplied) go into a pool applied FIFO below.
        let pool = 0;
        const applied = {};
        (receiptsByClient[clientId] || []).forEach((r) => {
          if (r.billing_id && applied[r.billing_id] !== undefined) {
            applied[r.billing_id] += Number(r.amount) || 0;
          } else if (r.billing_id) {
            applied[r.billing_id] = Number(r.amount) || 0;
          } else {
            pool += Number(r.amount) || 0;
          }
        });
 const bucketTotals = { current: 0, b1_30: 0, b31_60: 0, b61_90: 0, b90_plus: 0 };
       let totalBalance = 0;
       let oldestDueDate = null;
       let openInvoiceCount = 0;

        sortedInvoices.forEach((inv) => {
          let remaining = inv.charge - (applied[inv.id] || 0);
          if (remaining > 0 && pool > 0) {
            const take = Math.min(pool, remaining);
            remaining -= take;
            pool -= take;
          }
          if (remaining <= 0.005) return; // fully settled

          totalBalance += remaining;
          openInvoiceCount += 1;
          const days = daysOverdue(inv.due_date);
          bucketTotals[bucketFor(days)] += remaining;
          if (!oldestDueDate || new Date(inv.due_date) < new Date(oldestDueDate)) {
            oldestDueDate = inv.due_date;
          }
        });

        return {
          client_id: clientId,
          client: clientMap[clientId],
          total_balance: totalBalance,
          credit: creditMap[clientId] || 0,
          net_balance: totalBalance - (creditMap[clientId] || 0),
          oldest_due_date: oldestDueDate,
          days_overdue: oldestDueDate ? Math.max(0, daysOverdue(oldestDueDate)) : 0,
          bucket: oldestDueDate ? bucketFor(daysOverdue(oldestDueDate)) : "current",
          ...bucketTotals,
       invoice_count: openInvoiceCount,
        };
      });

      const withBalance = result.filter((r) => r.total_balance > 0.005);
      setRows(withBalance);

      // Clients who have credit but no row above (no open balance at all) —
      // fetch their profiles separately so the "unused credit" panel can
      // still show a name instead of just a client_id.
      const balanceClientIds = new Set(withBalance.map((r) => r.client_id));
      const creditOnlyIds = Object.keys(creditMap).filter((id) => !balanceClientIds.has(id));
      if (creditOnlyIds.length > 0) {
        const { data: creditOnlyClients } = await supabase
          .from("client_profile")
          .select("client_id, business_name, trade_name, first_name, middle_name, last_name")
          .in("client_id", creditOnlyIds);
        const map = {};
        (creditOnlyClients || []).forEach((c) => (map[c.client_id] = c));
        setCreditOnlyRows(
          creditOnlyIds.map((id) => ({ client_id: id, client: map[id], credit: creditMap[id] })),
        );
      } else {
        setCreditOnlyRows([]);
      }
    } catch (err) {
      console.error("AR Aging load error:", err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ── Filter + sort ──────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter((r) => {
      const name = getClientPrimaryName(r.client).toLowerCase();
      const matchesSearch = !q || name.includes(q) || r.client_id.toLowerCase().includes(q);
      const matchesBucket = bucketFilter === "all" || r.bucket === bucketFilter;
      return matchesSearch && matchesBucket;
    });
  }, [rows, search, bucketFilter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = sortField === "name" ? getClientPrimaryName(a.client) : a[sortField];
      const bv = sortField === "name" ? getClientPrimaryName(b.client) : b[sortField];
      const cmp = typeof av === "string" ? av.localeCompare(bv) : av - bv;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortField, sortDir]);

  // ── Grand totals for the summary strip ─────────────────────────────────
  const totals = useMemo(() => {
    const t = { current: 0, b1_30: 0, b31_60: 0, b61_90: 0, b90_plus: 0, total_balance: 0, total_credit: 0 };
    rows.forEach((r) => {
      BUCKETS.forEach((b) => (t[b.key] += r[b.key] || 0));
      t.total_balance += r.total_balance;
      t.total_credit += r.credit || 0;
    });
    creditOnlyRows.forEach((r) => (t.total_credit += r.credit || 0));
    return t;
  }, [rows, creditOnlyRows]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* TOP BAR */}
      <div className="sticky top-0 z-10 px-6 py-4 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center rounded-full w-9 h-9" style={{ background: "#e8f5ec" }}>
              <FaMoneyBillWave size={14} style={{ color: GREEN }} />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-gray-800">Collections &amp; Receivables</h1>
              <p className="text-xs text-gray-400">AR Aging — who owes what, and how overdue</p>
            </div>
          </div>
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-5 gap-2">
          {BUCKETS.map((b) => (
            <button
              key={b.key}
              onClick={() => setBucketFilter((v) => (v === b.key ? "all" : b.key))}
              className={`px-3 py-2 rounded-md border text-left transition ${
                bucketFilter === b.key ? "border-gray-400 bg-gray-50" : "border-gray-100 hover:bg-gray-50"
              }`}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: b.color }}>
                {b.label}
              </p>
              <p className="font-mono text-sm font-bold text-gray-800">₱{fmt(totals[b.key])}</p>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 mt-3">
          <div className="relative flex-1 max-w-xs">
            <FaSearch className="absolute text-gray-300 -translate-y-1/2 left-3 top-1/2" size={12} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search client..."
              className="w-full py-2 pr-8 text-sm border border-gray-200 rounded-md pl-9 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute text-gray-300 -translate-y-1/2 right-3 top-1/2 hover:text-gray-500">
                <FaTimes size={11} />
              </button>
            )}
          </div>
          {bucketFilter !== "all" && (
            <button
              onClick={() => setBucketFilter("all")}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-500 border border-gray-200 rounded-md hover:bg-gray-50"
            >
              <FaTimes size={9} /> Clear filter
            </button>
          )}
          <div className="flex items-center gap-4 ml-auto text-xs text-gray-400">
            {totals.total_credit > 0.005 && (
              <span className="flex items-center gap-1.5">
                <FaCoins size={10} className="text-amber-400" />
                Unused credit: <span className="font-mono font-semibold text-amber-600">₱{fmt(totals.total_credit)}</span>
              </span>
            )}
            Total outstanding: <span className="font-mono font-semibold text-gray-700">₱{fmt(totals.total_balance)}</span>
          </div>
        </div>
      </div>

      {/* TABLE */}
      <div className="p-6">
        <div className="overflow-hidden bg-white border border-gray-200 rounded-lg">
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-5 h-5 border-2 border-blue-500 rounded-full border-t-transparent animate-spin" />
            </div>
          ) : sorted.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-gray-300">
              <FaFileInvoiceDollar size={22} />
              <p className="text-sm">No outstanding balances found.</p>
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="text-gray-500 bg-gray-50">
                <tr>
                  <th
                    onClick={() => { setSortField("name"); setSortDir((d) => (sortField === "name" && d === "asc" ? "desc" : "asc")); }}
                    className="px-4 py-2.5 font-medium text-left cursor-pointer hover:text-gray-700"
                  >
                    Client
                  </th>
                  <th className="px-4 py-2.5 font-medium text-center">Open Invoices</th>
                  <th className="px-4 py-2.5 font-medium text-left">Oldest Due Date</th>
                  <th className="px-4 py-2.5 font-medium text-center">Days Overdue</th>
                  <th className="px-4 py-2.5 font-medium text-right">Credit</th>
                  <th
                    onClick={() => { setSortField("total_balance"); setSortDir((d) => (sortField === "total_balance" && d === "asc" ? "desc" : "asc")); }}
                    className="px-4 py-2.5 font-medium text-right cursor-pointer hover:text-gray-700"
                  >
                    Balance
                  </th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => {
                  const bucketMeta = BUCKETS.find((b) => b.key === r.bucket) || BUCKETS[0];
                  return (
                    <tr
                      key={r.client_id}
                      onClick={() => onSelectClient?.(r.client, r.client_id)}
                      className="transition border-t cursor-pointer border-gray-50 hover:bg-gray-50/60"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex items-center justify-center bg-blue-100 rounded-full w-7 h-7 shrink-0">
                            <FaUser size={10} className="text-blue-500" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-800">{getClientPrimaryName(r.client)}</p>
                            <p className="font-mono text-[10px] text-gray-400">{r.client_id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600">{r.invoice_count}</td>
                      <td className="px-4 py-3 text-gray-600">{fmtDate(r.oldest_due_date)}</td>
                      <td className="px-4 py-3 text-center">
                        {r.days_overdue > 0 ? (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                            style={{ background: `${bucketMeta.color}1a`, color: bucketMeta.color }}
                          >
                            {r.days_overdue > 60 && <FaExclamationTriangle size={8} />}
                            {r.days_overdue}d — {bucketMeta.label}
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold text-gray-400">Current</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {r.credit > 0.005 ? (
                          <span className="inline-flex items-center gap-1 font-mono font-semibold text-amber-600">
                            <FaCoins size={9} /> ₱{fmt(r.credit)}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-mono font-semibold text-gray-800">₱{fmt(r.total_balance)}</span>
                        {r.credit > 0.005 && (
                          <p className="text-[10px] text-amber-600">
                            {r.net_balance <= 0.005 ? "fully covered by credit" : `net ₱${fmt(r.net_balance)}`}
                          </p>
                        )}
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
                  <td colSpan={5} className="px-4 py-3 font-medium text-right text-gray-600">
                    Total
                  </td>
                  <td className="px-4 py-3 font-mono font-bold text-right" style={{ color: GREEN }}>
                    ₱{fmt(totals.total_balance)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        {/* Clients with unused credit but no open invoices */}
        {creditOnlyRows.length > 0 && (
          <div className="mt-5 overflow-hidden bg-white border rounded-lg border-amber-100">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-amber-100 bg-amber-50/60">
              <FaCoins size={12} className="text-amber-500" />
              <p className="text-xs font-semibold text-amber-700">
                Clients with unused credit ({creditOnlyRows.length}) — no open invoices right now
              </p>
            </div>
            <table className="w-full text-xs">
              <tbody>
                {creditOnlyRows.map((r) => (
                  <tr
                    key={r.client_id}
                    onClick={() => onSelectClient?.(r.client, r.client_id)}
                    className="transition border-t cursor-pointer border-gray-50 hover:bg-gray-50/60"
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="flex items-center justify-center bg-blue-100 rounded-full w-7 h-7 shrink-0">
                          <FaUser size={10} className="text-blue-500" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-800">{getClientPrimaryName(r.client)}</p>
                          <p className="font-mono text-[10px] text-gray-400">{r.client_id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="inline-flex items-center gap-1 font-mono font-semibold text-amber-600">
                        <FaCoins size={9} /> ₱{fmt(r.credit)}
                      </span>
                    </td>
                    <td className="w-8 px-2 py-2.5 text-gray-300">
                      <FaChevronRight size={10} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}