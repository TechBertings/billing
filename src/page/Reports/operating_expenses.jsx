import React, { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "../../lib/supabaseClient";
import { FaSync, FaDownload, FaSearch, FaTimes } from "react-icons/fa";

const GREEN = "#1a5c2e";

// fund_requests.fund_type value for operating expenses (remittances page uses "remittances")
const OPEX_TYPE = "operating_expenses";

const STATUSES = ["approved", "released", "pending"];
const STATUS_LABEL = { approved: "Approved", released: "Released", pending: "Pending" };
const STATUS_CLS = {
  approved: "bg-blue-50 text-blue-600 border-blue-200",
  released: "bg-green-50 text-green-700 border-green-200",
  pending: "bg-amber-50 text-amber-600 border-amber-200",
};

const MONTH_NAMES = [
  "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
  "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER",
];

const fmt = (n) =>
  Number(n || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const currentMonth = () => new Date().toISOString().slice(0, 7);

function monthRange(ym) {
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return { from: `${ym}-01`, to: `${ym}-${String(last).padStart(2, "0")}` };
}

const fmtShortDate = (d) =>
  d
    ? new Date(`${String(d).slice(0, 10)}T00:00:00`).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "short",
        day: "2-digit",
      })
    : "";

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

const inputCls =
  "px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 bg-white";

export default function OperatingExpensesReport() {
  const [view, setView] = useState("month"); // "month" | "year" | "all"
  const [month, setMonth] = useState(currentMonth());
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [statusFilter, setStatusFilter] = useState(["approved", "released", "pending"]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [reqs, setReqs] = useState([]);
  const [accounts, setAccounts] = useState({}); // code -> account name
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const range = useMemo(
    () =>
      view === "all"
        ? { from: "1900-01-01", to: "2100-12-31" }
        : view === "year"
          ? { from: `${year}-01-01`, to: `${year}-12-31` }
          : monthRange(month),
    [view, month, year],
  );
  const periodText = view === "all" ? "all" : view === "year" ? year : month;
  const periodLabel =
    view === "all"
      ? "ALL TIME"
      : view === "year"
        ? year
        : MONTH_NAMES[Number(month.split("-")[1]) - 1];
  const yearOptions = Array.from({ length: 8 }, (_, i) => String(new Date().getFullYear() - i));

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data: accts, error: aErr } = await supabase
        .from("chart_of_accounts")
        .select("code, account_name");
      if (aErr) throw aErr;
      const map = {};
      (accts || []).forEach((a) => a.code && (map[a.code] = a.account_name));
      setAccounts(map);

      setReqs(
        await fetchAll(() =>
          supabase
            .from("fund_requests")
            .select("*")
            .eq("fund_type", OPEX_TYPE)
            .in("status", STATUSES)
            .gte("request_date", range.from)
            .lte("request_date", range.to)
            .order("request_date", { ascending: false })
            .order("id", { ascending: false }),
        ),
      );
    } catch (e) {
      setError(e.message || "Failed to load data.");
    }
    setLoading(false);
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  // Normalize each fund request slip into a report row
  const allRows = useMemo(
    () =>
      reqs.map((fr) => {
        const amount = Number(fr.total_amount) || 0;
        const rawLines = [fr.expense_items, fr.items, fr.line_items].find(
          (x) => Array.isArray(x) && x.length,
        );
        const lines = rawLines
          ? rawLines.map((l) => ({
              code: l.account_code || "",
              amount: Number(l.amount) || 0,
            }))
          : [{ code: fr.account_code || "", amount }];
        return {
          id: fr.id,
          slip: fr.request_no || fr.reference_no || fr.control_no || String(fr.id),
          date: fr.request_date,
          payee: fr.payee || fr.tax_payer || "",
          particulars: fr.purpose || fr.particulars || fr.description || fr.remarks || "",
          status: fr.status,
          amount,
          lines,
        };
      }),
    [reqs],
  );

  const accountName = (code) => (code ? accounts[code] || code : "Unassigned");

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allRows.filter((r) => {
      if (!statusFilter.includes(r.status)) return false;
      if (q) {
        const hay = `${r.slip} ${r.payee} ${r.particulars} ${r.lines
          .map((l) => accountName(l.code))
          .join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allRows, statusFilter, search, accounts]);

  const totals = useMemo(() => {
    const byStatus = { approved: 0, released: 0, pending: 0 };
    const byAccount = {};
    let total = 0;
    rows.forEach((r) => {
      total += r.amount;
      byStatus[r.status] = (byStatus[r.status] || 0) + r.amount;
      r.lines.forEach((l) => {
        const k = l.code || "__none__";
        byAccount[k] = (byAccount[k] || 0) + l.amount;
      });
    });
    const accountList = Object.keys(byAccount)
      .map((k) => ({
        code: k,
        name: k === "__none__" ? "Unassigned" : accountName(k),
        amount: byAccount[k],
      }))
      .sort((a, b) => b.amount - a.amount);
    return { total, byStatus, accountList };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, accounts]);

  useEffect(() => {
    setPage(1);
  }, [range, search, statusFilter, pageSize]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedRows = rows.slice((safePage - 1) * pageSize, safePage * pageSize);

  const toggleStatus = (s) =>
    setStatusFilter((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]));

  const exportCSV = () => {
    const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const header = ["Date", "Slip No.", "Payee", "Particulars", "Account", "Status", "Amount"];
    const lines = rows.map((r) =>
      [
        q(fmtShortDate(r.date)),
        q(r.slip),
        q(r.payee),
        q(r.particulars),
        q(r.lines.map((l) => accountName(l.code)).join("; ")),
        q(STATUS_LABEL[r.status] || r.status),
        r.amount.toFixed(2),
      ].join(","),
    );
    lines.push([q("TOTAL"), "", "", "", "", "", totals.total.toFixed(2)].join(","));
    const blob = new Blob([[header.map(q).join(","), ...lines].join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `operating-expenses-${periodText}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const pageBtn =
    "px-2 py-1 text-[11px] border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed";

  const SummaryRow = ({ label, value, color, bold }) => (
    <tr>
      <td
        className={`px-4 py-1.5 text-right ${bold ? "font-bold" : "font-medium"}`}
        style={{ color: color || "#1f2937", background: "#e8f5ec" }}
      >
        {label}
      </td>
      <td
        className={`px-4 py-1.5 font-mono text-right ${bold ? "font-bold" : ""}`}
        style={{ color: color || "#1f2937", background: "#e8f5ec", minWidth: 130 }}
      >
        {fmt(value)}
      </td>
    </tr>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* TOP BAR */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-3.5 bg-white border-b border-gray-200">
        <h1 className="text-base font-semibold text-gray-800">Operating Expenses Report</h1>
        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden border border-gray-200 rounded-md">
            {["month", "year", "all"].map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-2 text-sm font-medium capitalize transition ${
                  view === v ? "text-white" : "text-gray-600 bg-white hover:bg-gray-50"
                }`}
                style={view === v ? { background: GREEN } : undefined}
              >
                {v}
              </button>
            ))}
          </div>
          {view === "all" ? null : view === "month" ? (
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className={inputCls}
            />
          ) : (
            <select value={year} onChange={(e) => setYear(e.target.value)} className={inputCls}>
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            <FaSync size={11} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
          <button
            onClick={exportCSV}
            disabled={rows.length === 0}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-md disabled:opacity-50"
            style={{ background: GREEN }}
          >
            <FaDownload size={11} /> Export CSV
          </button>
        </div>
      </div>

      <div className="px-6 py-6 space-y-5">
        {error && (
          <div className="px-4 py-3 text-sm text-red-700 border-l-4 border-red-500 rounded-md bg-red-50">
            {error}
          </div>
        )}

        {/* FILTERS */}
        <div className="flex flex-wrap items-center gap-3 p-4 bg-white border border-gray-200 rounded-lg">
          <div className="relative w-72">
            <FaSearch
              className="absolute text-gray-300 -translate-y-1/2 left-3 top-1/2"
              size={12}
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search slip no., payee, particulars, account..."
              className={`${inputCls} w-full pl-9 pr-8`}
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

          <div className="flex items-center gap-2">
            {STATUSES.map((s) => {
              const on = statusFilter.includes(s);
              return (
                <button
                  key={s}
                  onClick={() => toggleStatus(s)}
                  className={`px-3 py-1.5 text-xs font-medium border rounded-full transition ${
                    on ? STATUS_CLS[s] : "bg-white text-gray-400 border-gray-200"
                  }`}
                >
                  {STATUS_LABEL[s]}
                </button>
              );
            })}
          </div>
        </div>

        {/* TABLE */}
        <div className="overflow-hidden bg-white border border-gray-200 rounded-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 text-[11px] font-semibold text-gray-400">
                  <th className="px-4 py-2.5 text-left">Date</th>
                  <th className="px-3 py-2.5 text-left">Slip no.</th>
                  <th className="px-3 py-2.5 text-left">Payee</th>
                  <th className="px-3 py-2.5 text-left">Particulars</th>
                  <th className="px-3 py-2.5 text-left">Account</th>
                  <th className="px-3 py-2.5 text-left">Status</th>
                  <th className="px-4 py-2.5 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading && (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-gray-400">
                      Loading...
                    </td>
                  </tr>
                )}
                {!loading && rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-gray-400">
                     No operating expense fund request in this period.
                    </td>
                  </tr>
                )}
                {!loading &&
                  pagedRows.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-2 text-gray-500 whitespace-nowrap">
                        {fmtShortDate(r.date)}
                      </td>
                      <td className="px-3 py-2 font-mono text-gray-700 whitespace-nowrap">
                        {r.slip}
                      </td>
                      <td className="px-3 py-2 font-medium text-gray-800">{r.payee}</td>
                      <td className="px-3 py-2 text-gray-600 max-w-[22rem] truncate" title={r.particulars}>
                        {r.particulars}
                      </td>
                      <td className="px-3 py-2 text-gray-600">
                        {r.lines.map((l) => accountName(l.code)).join(", ")}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`px-2 py-0.5 text-[10px] font-semibold border rounded-full ${STATUS_CLS[r.status] || ""}`}
                        >
                          {STATUS_LABEL[r.status] || r.status}
                        </span>
                      </td>
                      <td className="px-4 py-2 font-mono text-right text-gray-800">
                        {fmt(r.amount)}
                      </td>
                    </tr>
                  ))}
              </tbody>
              {!loading && rows.length > 0 && (
                <tfoot>
                  <tr
                    className="font-bold"
                    style={{ borderTop: `2px solid ${GREEN}`, background: "#f4faf6" }}
                  >
                    <td colSpan={6} className="px-4 py-2.5 text-right text-gray-700">
                      TOTAL
                    </td>
                    <td className="px-4 py-2.5 font-mono text-right" style={{ color: GREEN }}>
                      {fmt(totals.total)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {rows.length > 0 && (
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-100">
              <div className="flex items-center gap-3 text-[11px] text-gray-400">
                <span>
                  {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, rows.length)} of{" "}
                  {rows.length} slips
                </span>
                <label className="flex items-center gap-1.5">
                  Rows
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="px-1.5 py-1 text-[11px] border border-gray-200 rounded-md"
                  >
                    {[10, 25, 50, 100].map((n) => (
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
                <span className="text-[11px] text-gray-500">
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
          )}
        </div>

        {/* LOWER SUMMARY */}
        {!loading && rows.length > 0 && (
          <div className="grid gap-5 md:grid-cols-2">
            <div className="p-5 bg-white border border-gray-200 rounded-lg">
              <table className="text-sm">
                <tbody>
                  <SummaryRow label={`${periodLabel} Released`} value={totals.byStatus.released} />
                  <SummaryRow label={`${periodLabel} Approved`} value={totals.byStatus.approved} />
                  <SummaryRow label={`${periodLabel} Pending`} value={totals.byStatus.pending} />
                  <SummaryRow
                    label="TOTAL OPERATING EXPENSES"
                    value={totals.total}
                    color={GREEN}
                    bold
                  />
                </tbody>
              </table>
            </div>

            <div className="p-5 bg-white border border-gray-200 rounded-lg">
              <p className="mb-2 text-sm font-bold text-gray-800">By account</p>
              <table className="w-full text-xs">
                <tbody className="divide-y divide-gray-50">
                  {totals.accountList.map((a) => (
                    <tr key={a.code}>
                      <td className="py-1.5 text-gray-700">{a.name}</td>
                      <td className="py-1.5 font-mono text-right text-gray-800">{fmt(a.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}