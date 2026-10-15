import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { supabase } from "../../lib/supabaseClient";
import {
  FaSync,
  FaSearch,
  FaTimes,
  FaChevronDown,
  FaColumns,
  FaPrint,
  FaFileExcel,
  FaFilePdf,
} from "react-icons/fa";
import { exportTablePDF } from "../../utils/report_pdf";

const GREEN = "#1a5c2e";
const OTHER = "__other__"; // income not tied to a specific account column
const MONTH_NAMES = [
  "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
  "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER",
];

const fmt = (n) =>
  Number(n || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// Excel style: zero -> blank
const fmtCell = (n) => (Math.abs(n) > 0.005 ? fmt(n) : "");

const currentMonth = () => new Date().toISOString().slice(0, 7);

function monthRange(ym) {
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return { from: `${ym}-01`, to: `${ym}-${String(last).padStart(2, "0")}` };
}

const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

const fmtShortDate = (d) =>
  new Date(`${d}T00:00:00`).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });

// Sortable "YYYY-MM" key from either "2026-10" or "Aug 01, 2026 – Sep 19, 2026"
const periodKey = (p) => {
  if (/^\d{4}-\d{2}$/.test(p)) return p;
  const end = String(p).split(/[–—]/).pop().trim();
  const t = Date.parse(end);
  if (isNaN(t)) return "0000-00";
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const sortPeriods = (set) =>
  Array.from(set).sort((a, b) => periodKey(a).localeCompare(periodKey(b)));

// "2026-01" -> "01-2026"; other text stays as is
const fmtPC = (p) => (/^\d{4}-\d{2}$/.test(p) ? `${p.slice(5)}-${p.slice(0, 4)}` : p);

// Latest period + "+N" chip; click the chip to see all of them
function PeriodCell({ periods }) {
  const [pos, setPos] = useState(null);
  const list = sortPeriods(periods);

  useEffect(() => {
    if (!pos) return;
    const close = () => setPos(null);
    window.addEventListener("mousedown", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [pos]);

  if (list.length === 0) return null;
  const latest = list[list.length - 1];

  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span>{fmtPC(latest)}</span>
      {list.length > 1 && (
        <button
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setPos(pos ? null : { top: r.bottom + 6, left: r.left });
          }}
          className="px-1.5 py-0.5 text-[10px] font-semibold rounded-full border border-green-200 bg-green-50 hover:bg-green-100 transition"
          style={{ color: GREEN }}
          title="Show all periods"
        >
          +{list.length - 1}
        </button>
      )}
      {pos && (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          className="fixed z-50 p-3 bg-white border border-gray-200 rounded-lg shadow-xl w-52"
          style={{ top: pos.top, left: pos.left }}
        >
          <p className="mb-2 text-[10px] font-semibold tracking-wide text-gray-400 uppercase">
            Periods covered ({list.length})
          </p>
          <ul className="space-y-1 overflow-y-auto max-h-48">
            {[...list].reverse().map((p, i) => (
              <li key={p} className="flex items-center justify-between text-xs text-gray-700">
                <span>{fmtPC(p)}</span>
                {i === 0 && <span className="text-[10px] text-gray-400">latest</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </span>
  );
}

const summarizeDates = (set) => {
  const arr = Array.from(set).sort();
  if (arr.length === 0) return { text: "", title: "" };
  const latest = arr[arr.length - 1];
  return {
    text: fmtShortDate(latest) + (arr.length > 1 ? ` (+${arr.length - 1})` : ""),
    title: arr.map(fmtShortDate).join(", "),
  };
};

// Deposited cash only. Credit applications aren't cash, so they're excluded.
const isDepositedCash = (r) =>
  r.deposit_status === "deposited" && r.payment_method !== "credit";

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

// ── Fixed columns (the income account columns are dynamic and sit between PRE and POST) ──
const PRE_DEFS = [
  {
    key: "pc",
    label: "PC",
    text: (r) => sortPeriods(r.periods).map(fmtPC).join(", "),
    render: (r) => <PeriodCell periods={r.periods} />,
    cls: () => "text-gray-500 whitespace-nowrap",
  },
  {
    key: "date",
    label: "Date collected",
    text: (r) => summarizeDates(r.dates).text,
    title: (r) => summarizeDates(r.dates).title,
    cls: () => "text-gray-500 whitespace-nowrap",
  },
];
const POST_DEFS = [
  {
    key: "income",
    label: "Total income",
    val: (r) => r.income,
    tot: (t) => t.income,
    cls: () => "font-semibold border-l border-gray-100",
    footStyle: { color: GREEN },
  },
];

export default function IncomeReportDeposited() {
  const [view, setView] = useState("month"); // "month" | "year" | "all"
  const [month, setMonth] = useState(currentMonth());
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [showCols, setShowCols] = useState(false);
  // column visibility overrides: key -> boolean. Missing = default
  // (fixed columns: shown; account columns: shown only if they have an amount)
  const [colPrefs, setColPrefs] = useState({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [pdfBusy, setPdfBusy] = useState(false);

  // ── Client filters ──
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClients, setSelectedClients] = useState([]); // empty = all
  const [showPicker, setShowPicker] = useState(false);
  const [pickSearch, setPickSearch] = useState("");
  const pickerRef = useRef(null);

  const [receipts, setReceipts] = useState([]);
  const [billingPeriods, setBillingPeriods] = useState({}); // billing_id -> [period_covered]
  const [incomeItems, setIncomeItems] = useState({}); // billing_id -> [{code, amount}] (non-remittance items)
  const [accounts, setAccounts] = useState({}); // code -> {name, agency}
  const [names, setNames] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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

  const clientOptions = useMemo(
    () =>
      Object.keys(names)
        .map((id) => ({ id, name: names[id] }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [names],
  );
  const visibleOptions = clientOptions.filter((c) =>
    `${c.name} ${c.id}`.toLowerCase().includes(pickSearch.toLowerCase()),
  );
  const toggleClient = (id) =>
    setSelectedClients((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

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
  // Longer label for export headers, e.g. "OCTOBER 2026"
  const exportPeriodLabel =
    view === "month" ? `${periodLabel} ${month.slice(0, 4)}` : periodLabel;
  const yearOptions = Array.from({ length: 8 }, (_, i) => String(new Date().getFullYear() - i));

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { from, to } = range;

      // ── Account names + agency (for column headers / grouping) ──
      const { data: ags, error: aErr } = await supabase
        .from("government_agencies")
        .select("id, name, sort_order")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (aErr) throw aErr;
      const agMap = {};
      (ags || []).forEach((a, i) => (agMap[a.id] = { name: a.name, ord: i }));

      const { data: accts, error: cErr } = await supabase
        .from("chart_of_accounts")
        .select("code, account_name, agency_id")
        .eq("is_active", true)
        .order("code", { ascending: true });
      if (cErr) throw cErr;
      const acctMap = {};
      (accts || []).forEach((a) => {
        if (!a.code) return;
        acctMap[a.code] = {
          name: a.account_name,
          agency: agMap[a.agency_id]?.name || "",
          ord: agMap[a.agency_id]?.ord ?? 999,
        };
      });
      setAccounts(acctMap);

      // ── Deposited receipts within the period ──
      const allRcpts = await fetchAll(() =>
        supabase
          .from("official_receipts")
          .select(
            "id, client_id, billing_id, amount, income_amount, remittance_amount, payment_method, payment_date, deposit_status",
          )
          .eq("deposit_status", "deposited")
          .gte("payment_date", from)
          .lte("payment_date", to)
          .order("id", { ascending: true }),
      );
      // Income report: only receipts that actually carry income.
      // Remittance-only payments belong in the Remittances report.
      const rcpts = allRcpts.filter(
        (r) => isDepositedCash(r) && Math.abs(Number(r.income_amount) || 0) > 0.005,
      );
      setReceipts(rcpts);

      // ── Billing items of the paid SOAs: PC + income lines ──
      const billingIds = [...new Set(rcpts.map((r) => r.billing_id).filter(Boolean))];
      const pcMap = {};
      const itemMap = {};
      for (const part of chunk(billingIds, 200)) {
        const { data: its, error: iErr } = await supabase
          .from("billing_items")
          .select("id, billing_id, account_code, amount, item_type, period_covered")
          .in("billing_id", part)
          .order("account_code", { ascending: true })
          .order("id", { ascending: true });
        if (iErr) throw iErr;
        (its || []).forEach((i) => {
          if (i.item_type !== "remittance" && i.period_covered)
            (pcMap[i.billing_id] = pcMap[i.billing_id] || []).push(i.period_covered);
          if (i.item_type !== "remittance")
            (itemMap[i.billing_id] = itemMap[i.billing_id] || []).push({
              code: i.account_code || OTHER,
              amount: Number(i.amount) || 0,
            });
        });
      }
      setBillingPeriods(pcMap);
      setIncomeItems(itemMap);

      // ── Client names ──
      const profiles = await fetchAll(() =>
        supabase
          .from("client_profile")
          .select("client_id, business_name, first_name, middle_name, last_name")
          .eq("approval_status", "approved")
          .order("id", { ascending: true }),
      );
      const nameMap = {};
      profiles.forEach((c) => {
        nameMap[c.client_id] =
          c.business_name ||
          [c.first_name, c.middle_name, c.last_name].filter(Boolean).join(" ") ||
          c.client_id;
      });
      setNames(nameMap);
    } catch (e) {
      setError(e.message || "Failed to load data.");
    }
    setLoading(false);
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  // ── Per-client rows + totals ──────────────────────────────────────────────
  const { rows, totals, summary, columns: allColumns, acctAll } = useMemo(() => {
    const map = new Map();
    const get = (id) => {
      if (!map.has(id))
        map.set(id, {
          client_id: id,
          name: names[id] || id,
          cash: 0,
          income: 0,
          remit: 0,
          count: 0,
          dates: new Set(),
          periods: new Set(),
          acct: {}, // account code -> income deposited in the period
        });
      return map.get(id);
    };

    receipts.forEach((r) => {
      const c = get(r.client_id);
      const inc = Number(r.income_amount) || 0;
      c.cash += inc; // income portion only
      c.income += inc;
      c.count += 1;
      if (Number(r.amount) > 0) {
        c.dates.add(r.payment_date);
        (billingPeriods[r.billing_id] || []).forEach((p) => c.periods.add(p));
      }

      // Split the receipt's income across the SOA's income lines (pro-rata by line amount)
      if (Math.abs(inc) > 0.005) {
        const items = incomeItems[r.billing_id] || [];
        const base = items.reduce((s, i) => s + i.amount, 0);
        if (items.length && base > 0) {
          items.forEach((i) => {
            const key = accounts[i.code] ? i.code : OTHER;
            c.acct[key] = (c.acct[key] || 0) + (inc * i.amount) / base;
          });
        } else {
          c.acct[OTHER] = (c.acct[OTHER] || 0) + inc;
        }
      }
    });

    const rows = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));

    // totals per account across ALL clients (decides which columns have an amount)
    const acctAll = {};
    rows.forEach((r) =>
      Object.keys(r.acct).forEach((k) => (acctAll[k] = (acctAll[k] || 0) + r.acct[k])),
    );

    const q = clientSearch.trim().toLowerCase();
    const picked = new Set(selectedClients);
    const filteredRows = rows.filter((r) => {
      if (picked.size > 0 && !picked.has(r.client_id)) return false;
      if (q && !`${r.name} ${r.client_id}`.toLowerCase().includes(q)) return false;
      return true;
    });

    const totals = filteredRows.reduce(
      (t, r) => {
        Object.keys(r.acct).forEach((k) => (t.acct[k] = (t.acct[k] || 0) + r.acct[k]));
        return {
          cash: t.cash + r.cash,
          income: t.income + r.income,
          remit: t.remit + r.remit,
          count: t.count + r.count,
          acct: t.acct,
        };
      },
      { cash: 0, income: 0, remit: 0, count: 0, acct: {} },
    );

    // Only accounts that actually have income in the period (+ "Other" when needed)
    const columns = Object.keys(acctAll)
      .filter((k) => k !== OTHER)
      .map((k) => ({ key: k, ...accounts[k] }))
      .sort((a, b) => a.ord - b.ord || a.key.localeCompare(b.key));
    if (Math.abs(acctAll[OTHER] || 0) > 0.005)
      columns.push({ key: OTHER, name: "Other / unallocated", agency: "" });

    return {
      rows: filteredRows,
      totals,
      columns,
      acctAll,
      summary: {
        cash: totals.cash,
        income: totals.income,
        remit: totals.remit,
        count: totals.count,
      },
    };
  }, [receipts, names, billingPeriods, incomeItems, accounts, clientSearch, selectedClients]);

  const fv = (k) => colPrefs[k] !== false; // fixed column visible?
  const acctVisible = (c) =>
    colPrefs[c.key] !== undefined ? colPrefs[c.key] : Math.abs(acctAll[c.key] || 0) > 0.005;
  const columns = useMemo(
    () => allColumns.filter(acctVisible),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allColumns, colPrefs, acctAll],
  );

  const preDefs = PRE_DEFS.filter((d) => fv(d.key));
  const postDefs = POST_DEFS.filter((d) => fv(d.key));
  const totalCols = 1 + preDefs.length + columns.length + postDefs.length;
  const visibleCount = totalCols;
  const allCount = 1 + PRE_DEFS.length + allColumns.length + POST_DEFS.length;

  useEffect(() => {
    setPage(1);
  }, [range, pageSize, clientSearch, selectedClients]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedRows = rows.slice((safePage - 1) * pageSize, safePage * pageSize);

  // agency header groups: [{agency, span}]
  const agencyGroups = useMemo(() => {
    const out = [];
    columns.forEach((c) => {
      const last = out[out.length - 1];
      if (last && last.agency === c.agency) last.span += 1;
      else out.push({ agency: c.agency, span: 1 });
    });
    return out;
  }, [columns]);

  // ── Export helpers (always export ALL filtered rows, not just the current page) ──
  const stamp = new Date().toISOString().split("T")[0];
  const clientFilterLabel =
    selectedClients.length > 0
      ? `${selectedClients.length} client${selectedClients.length === 1 ? "" : "s"} selected`
      : clientSearch
        ? `Search: "${clientSearch}"`
        : "All Clients";
  const exportDisabled = loading || rows.length === 0;

  const colHeader = (c) => (c.agency ? `${c.agency} - ${c.name}` : c.name);

  const exportExcel = () => {
    const XLSX = window.XLSX;
    if (!XLSX) {
      alert("SheetJS not loaded yet, please try again in a moment.");
      return;
    }
    const header = [
      "#",
      "Client",
      ...preDefs.map((d) => d.label),
      ...columns.map(colHeader),
      ...postDefs.map((d) => d.label),
    ];
    const cellXlsx = (d, r) =>
      d.val ? Number(d.val(r)) || 0 : d.title ? d.title(r) : d.text(r);
    const aoa = [
      ["Income Report — Deposited"],
      [`Period: ${exportPeriodLabel}`],
      [`Clients: ${clientFilterLabel}`],
      [],
      header,
      ...rows.map((r, i) => [
        i + 1,
        r.name,
        ...preDefs.map((d) => cellXlsx(d, r)),
        ...columns.map((c) => Number(r.acct[c.key]) || 0),
        ...postDefs.map((d) => cellXlsx(d, r)),
      ]),
      [
        "",
        "TOTAL",
        ...preDefs.map((d) => (d.tot ? Number(d.tot(totals)) || 0 : "")),
        ...columns.map((c) => Number(totals.acct[c.key]) || 0),
        ...postDefs.map((d) => (d.tot ? Number(d.tot(totals)) || 0 : "")),
      ],
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = header.map((h, i) => ({
      wch: i === 0 ? 5 : i === 1 ? 34 : Math.max(String(h).length + 4, 16),
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Income Deposited");
    XLSX.writeFile(wb, `income_report_deposited_${periodText}_${stamp}.xlsx`);
  };

  const exportPDF = async () => {
    setPdfBusy(true);
    try {
      const subtitle = [exportPeriodLabel, clientFilterLabel].join("  |  ");
      const pdfCols = [
        { label: "Client", w: 2.6 },
        ...preDefs.map((d) => ({ label: d.label, w: d.key === "pc" ? 1.4 : 1.6 })),
        ...columns.map((c) => ({ label: c.name, w: 1.3 })),
        ...postDefs.map((d) => ({ label: d.label, w: 1.4 })),
      ];
      const cellPdf = (d, r) => (d.val ? fmt(d.val(r)) : d.text(r));
      await exportTablePDF({
        title: "Income Report — Deposited",
        subtitle,
        cols: pdfCols,
        groups: [
          {
            label: null,
            rows: [
              ...rows.map((r) => [
                r.name,
                ...preDefs.map((d) => cellPdf(d, r)),
                ...columns.map((c) => fmtCell(r.acct[c.key] || 0)),
                ...postDefs.map((d) => cellPdf(d, r)),
              ]),
              [
                "TOTAL",
                ...preDefs.map((d) => (d.tot ? fmt(d.tot(totals)) : "")),
                ...columns.map((c) => fmtCell(totals.acct[c.key] || 0)),
                ...postDefs.map((d) => (d.tot ? fmt(d.tot(totals)) : "")),
              ],
            ],
          },
        ],
        format: pdfCols.length > 8 ? "legal" : "a4",
        fileName: `income_report_deposited_${periodText}_${stamp}.pdf`,
      });
    } finally {
      setPdfBusy(false);
    }
  };

  const renderCell = (d, r) => (
    <td
      key={d.key}
      title={d.title ? d.title(r) : undefined}
      className={`px-3 py-2 ${d.val ? "font-mono text-right" : "text-left"} ${d.cls(r)}`}
      style={d.style ? d.style(r) : undefined}
    >
      {d.render ? d.render(r) : d.val ? fmt(d.val(r)) : d.text(r)}
    </td>
  );

  // checkbox chip used in the column picker
  const Chip = ({ checked, onChange, label, hint, disabled }) => (
    <label
      className={`flex items-center gap-2 px-3 py-2 text-xs border rounded-md cursor-pointer select-none transition ${
        checked ? "border-green-300 bg-green-50 text-gray-800" : "border-gray-200 bg-white text-gray-500"
      } ${disabled ? "opacity-70 cursor-default" : ""}`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        className="accent-green-700"
      />
      <span className="flex-1 truncate">{label}</span>
      {hint && <span className="font-mono text-[10px] text-gray-400">{hint}</span>}
    </label>
  );

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
    <div className="min-h-screen bg-gray-50 print:bg-white print:min-h-0">
      {/* TOP BAR */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-3.5 bg-white border-b border-gray-200 print:hidden">
        <div>
          <h1 className="text-base font-semibold text-gray-800">Income Report — Deposited</h1>
        </div>
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
        {error && (
          <div className="px-4 py-3 text-sm text-red-700 border-l-4 border-red-500 rounded-md bg-red-50">
            {error}
          </div>
        )}

        {/* CLIENT FILTERS */}
        <div className="flex flex-wrap items-center gap-3 p-4 bg-white border border-gray-200 rounded-lg">
          <div className="relative w-72">
            <FaSearch
              className="absolute text-gray-300 -translate-y-1/2 left-3 top-1/2"
              size={12}
            />
            <input
              type="text"
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
              placeholder="Search client name or ID..."
              className={`${inputCls} w-full pl-9 pr-8`}
            />
            {clientSearch && (
              <button
                onClick={() => setClientSearch("")}
                className="absolute text-gray-300 -translate-y-1/2 right-3 top-1/2 hover:text-gray-500"
              >
                <FaTimes size={11} />
              </button>
            )}
          </div>

          <div className="relative" ref={pickerRef}>
            <button
              onClick={() => setShowPicker((v) => !v)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50"
            >
              {selectedClients.length === 0
                ? "Clients: All"
                : `Clients: ${selectedClients.length} selected`}
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
                    className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:border-blue-400"
                  />
                  <div className="flex items-center justify-between mt-2 text-[11px]">
                    <button
                      onClick={() =>
                        setSelectedClients((p) => [
                          ...new Set([...p, ...visibleOptions.map((c) => c.id)]),
                        ])
                      }
                      className="text-blue-500 hover:underline"
                    >
                      Select shown ({visibleOptions.length})
                    </button>
                    <button
                      onClick={() => setSelectedClients([])}
                      className="text-gray-400 hover:underline"
                    >
                      Clear (show all)
                    </button>
                  </div>
                </div>
                <div className="overflow-y-auto max-h-64">
                  {visibleOptions.length === 0 && (
                    <p className="px-3 py-4 text-xs text-center text-gray-400">No clients found</p>
                  )}
                  {visibleOptions.map((c) => (
                    <label
                      key={c.id}
                      className="flex items-center gap-2.5 px-3 py-1.5 text-xs cursor-pointer hover:bg-gray-50"
                    >
                      <input
                        type="checkbox"
                        checked={selectedClients.includes(c.id)}
                        onChange={() => toggleClient(c.id)}
                        className="accent-green-700"
                      />
                      <span className="flex-1 text-gray-700 truncate">{c.name}</span>
                      <span className="font-mono text-[10px] text-gray-400">{c.id}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => setShowCols((v) => !v)}
            className={`flex items-center gap-2 px-3 py-2 text-sm border rounded-md ${
              showCols
                ? "border-green-300 bg-green-50 text-gray-800"
                : "border-gray-200 text-gray-700 bg-white hover:bg-gray-50"
            }`}
          >
            <FaColumns size={11} className="text-gray-400" />
            Columns ({visibleCount}/{allCount})
          </button>

          {(clientSearch || selectedClients.length > 0) && (
            <button
              onClick={() => {
                setClientSearch("");
                setSelectedClients([]);
              }}
              className="text-xs text-gray-500 hover:underline"
            >
              Reset client filter
            </button>
          )}
        </div>

        {/* COLUMN PICKER */}
        {showCols && (
          <div className="p-4 space-y-4 bg-white border border-gray-200 rounded-lg">
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <button
                onClick={() => setColPrefs({})}
                className="px-3 py-1.5 border border-gray-200 rounded-md hover:bg-gray-50"
              >
                Default
              </button>
              <button
                onClick={() => {
                  const n = {};
                  allColumns.forEach((c) => (n[c.key] = true));
                  setColPrefs((p) => ({ ...p, ...n }));
                }}
                className="px-3 py-1.5 border border-gray-200 rounded-md hover:bg-gray-50"
              >
                Show all accounts
              </button>
              <button
                onClick={() => {
                  const n = {};
                  allColumns.forEach((c) => (n[c.key] = false));
                  setColPrefs((p) => ({ ...p, ...n }));
                }}
                className="px-3 py-1.5 border border-gray-200 rounded-md hover:bg-gray-50"
              >
                Hide all accounts
              </button>
              <span className="text-gray-400">
                Only accounts with income in this period are shown.
              </span>
            </div>

            <div>
              <p className="mb-2 text-[11px] font-semibold text-gray-400">Details</p>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <Chip checked disabled label="Client" />
                {[...PRE_DEFS, ...POST_DEFS].map((d) => (
                  <Chip
                    key={d.key}
                    checked={fv(d.key)}
                    label={d.label}
                    onChange={() => setColPrefs((p) => ({ ...p, [d.key]: !fv(d.key) }))}
                  />
                ))}
              </div>
            </div>

            {Array.from(new Set(allColumns.map((c) => c.agency))).map((ag) => (
              <div key={ag || "other"}>
                <p className="mb-2 text-[11px] font-semibold" style={{ color: GREEN }}>
                  {ag || "Other"}
                </p>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                  {allColumns
                    .filter((c) => c.agency === ag)
                    .map((c) => (
                      <Chip
                        key={c.key}
                        checked={acctVisible(c)}
                        label={c.name}
                        hint={Math.abs(acctAll[c.key] || 0) > 0.005 ? fmt(acctAll[c.key]) : ""}
                        onChange={() => setColPrefs((p) => ({ ...p, [c.key]: !acctVisible(c) }))}
                      />
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TABLE */}
        <div className="overflow-hidden bg-white border border-gray-200 rounded-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                {columns.length > 0 && (
                  <tr className="text-[10px] font-semibold text-gray-400">
                    <th className="sticky left-0 bg-white" />
                    {preDefs.length > 0 && <th colSpan={preDefs.length} />}
                    {agencyGroups.map((g, i) => (
                      <th
                        key={i}
                        colSpan={g.span}
                        className="px-3 py-1.5 text-center border-l border-gray-100"
                        style={{ background: "#f4faf6", color: GREEN }}
                      >
                        {g.agency}
                      </th>
                    ))}
                    {postDefs.length > 0 && <th colSpan={postDefs.length} />}
                  </tr>
                )}
                <tr className="border-b border-gray-100 text-[11px] font-semibold text-gray-400">
                  <th className="sticky left-0 px-4 py-2.5 text-left bg-white">Client</th>
                  {preDefs.map((d) => (
                    <th key={d.key} className={`px-3 py-2.5 ${d.val ? "text-right" : "text-left"}`}>
                      {d.label}
                    </th>
                  ))}
                  {columns.map((c) => (
                    <th
                      key={c.key}
                      className="px-3 py-2.5 text-right border-l border-gray-100 whitespace-nowrap"
                      style={{ background: "#f4faf6", color: GREEN }}
                      title={c.key === OTHER ? "" : c.key}
                    >
                      {c.name}
                    </th>
                  ))}
                  {postDefs.map((d) => (
                    <th
                      key={d.key}
                      className={`px-3 py-2.5 ${d.val ? "text-right" : "text-left"} ${d.key === "remit" ? "border-l border-gray-100" : ""}`}
                    >
                      {d.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading && (
                  <tr>
                    <td colSpan={totalCols} className="py-10 text-center text-gray-400">
                      Loading...
                    </td>
                  </tr>
                )}
                {!loading && rows.length === 0 && (
                  <tr>
                    <td colSpan={totalCols} className="py-10 text-center text-gray-400">
                      No deposited income in this period.
                    </td>
                  </tr>
                )}
                {!loading &&
                  pagedRows.map((r) => (
                    <tr key={r.client_id} className="hover:bg-gray-50/50">
                      <td className="sticky left-0 px-4 py-2 font-medium text-gray-800 bg-white whitespace-nowrap">
                        {r.name}
                      </td>
                      {preDefs.map((d) => renderCell(d, r))}
                      {columns.map((c) => {
                        const v = r.acct[c.key] || 0;
                        return (
                          <td
                            key={c.key}
                            className={`px-3 py-2 font-mono text-right border-l border-gray-50 ${
                              v < -0.005 ? "text-red-500" : "text-gray-700"
                            }`}
                          >
                            {fmtCell(v)}
                          </td>
                        );
                      })}
                      {postDefs.map((d) => renderCell(d, r))}
                    </tr>
                  ))}
              </tbody>
              {!loading && rows.length > 0 && (
                <tfoot>
                  <tr
                    className="font-bold"
                    style={{ borderTop: `2px solid ${GREEN}`, background: "#f4faf6" }}
                  >
                    <td
                      className="sticky left-0 px-4 py-2.5 text-right text-gray-700"
                      style={{ background: "#f4faf6" }}
                    >
                      TOTAL
                    </td>
                    {preDefs.map((d) => (
                      <td key={d.key} className="px-3 py-2.5 font-mono text-right">
                        {d.tot ? fmt(d.tot(totals)) : ""}
                      </td>
                    ))}
                    {columns.map((c) => (
                      <td key={c.key} className="px-3 py-2.5 font-mono text-right">
                        {fmtCell(totals.acct[c.key] || 0)}
                      </td>
                    ))}
                    {postDefs.map((d) => (
                      <td
                        key={d.key}
                        className="px-3 py-2.5 font-mono text-right"
                        style={d.footStyle}
                      >
                        {d.tot ? fmt(d.tot(totals)) : ""}
                      </td>
                    ))}
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
                  {rows.length} clients
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
          <div className="p-5 bg-white border border-gray-200 rounded-lg">
            <table className="text-sm">
              <tbody>
                <SummaryRow
                  label={`${periodLabel} INCOME DEPOSITED`}
                  value={summary.income}
                  color={GREEN}
                  bold
                />
              </tbody>
            </table>
            <p className="mt-3 text-xs text-gray-500">
              {summary.count} deposited receipt{summary.count === 1 ? "" : "s"}
            </p>
          </div>
        )}
      </div>

      {/* PRINT-ONLY: full report (all rows, no pagination) */}
      {!loading && rows.length > 0 && (
        <div className="hidden p-6 print:block">
          <h1 className="text-lg font-bold">Income Report — Deposited</h1>
          <p className="mb-3 text-xs text-gray-500">
            {exportPeriodLabel} · {clientFilterLabel} · Generated{" "}
            {new Date().toLocaleString("en-PH")}
          </p>
          <table className="w-full text-[9px] border-collapse">
            <thead>
              {columns.length > 0 && (
                <tr className="text-[8px] font-semibold text-gray-500">
                  <th />
                  {preDefs.length > 0 && <th colSpan={preDefs.length} />}
                  {agencyGroups.map((g, i) => (
                    <th key={i} colSpan={g.span} className="px-1 py-1 text-center border-l border-gray-300">
                      {g.agency}
                    </th>
                  ))}
                  {postDefs.length > 0 && <th colSpan={postDefs.length} />}
                </tr>
              )}
              <tr className="border-b border-gray-400">
                <th className="py-1.5 pr-2 text-left">Client</th>
                {preDefs.map((d) => (
                  <th key={d.key} className={`px-1 py-1.5 ${d.val ? "text-right" : "text-left"}`}>
                    {d.label}
                  </th>
                ))}
                {columns.map((c) => (
                  <th key={c.key} className="px-1 py-1.5 text-right">
                    {c.name}
                  </th>
                ))}
                {postDefs.map((d) => (
                  <th key={d.key} className={`px-1 py-1.5 ${d.val ? "text-right" : "text-left"}`}>
                    {d.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.client_id} className="border-b border-gray-200 break-inside-avoid">
                  <td className="py-1 pr-2 font-medium">{r.name}</td>
                  {preDefs.map((d) => (
                    <td
                      key={d.key}
                      className={`px-1 py-1 ${d.val ? "font-mono text-right" : "text-left"}`}
                    >
                      {d.val ? fmt(d.val(r)) : d.text(r)}
                    </td>
                  ))}
                  {columns.map((c) => (
                    <td key={c.key} className="px-1 py-1 font-mono text-right">
                      {fmtCell(r.acct[c.key] || 0)}
                    </td>
                  ))}
                  {postDefs.map((d) => (
                    <td
                      key={d.key}
                      className={`px-1 py-1 ${d.val ? "font-mono text-right font-semibold" : "text-left"}`}
                    >
                      {d.val ? fmt(d.val(r)) : d.text(r)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-bold border-t-2 border-gray-600">
                <td className="py-1.5 pr-2 text-right">TOTAL</td>
                {preDefs.map((d) => (
                  <td key={d.key} className="px-1 py-1.5 font-mono text-right">
                    {d.tot ? fmt(d.tot(totals)) : ""}
                  </td>
                ))}
                {columns.map((c) => (
                  <td key={c.key} className="px-1 py-1.5 font-mono text-right">
                    {fmtCell(totals.acct[c.key] || 0)}
                  </td>
                ))}
                {postDefs.map((d) => (
                  <td key={d.key} className="px-1 py-1.5 font-mono text-right">
                    {d.tot ? fmt(d.tot(totals)) : ""}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
          <p className="mt-3 text-xs font-semibold">
            {periodLabel} INCOME DEPOSITED: ₱{fmt(summary.income)}{" "}
            <span className="font-normal text-gray-500">
              ({summary.count} deposited receipt{summary.count === 1 ? "" : "s"})
            </span>
          </p>
        </div>
      )}
    </div>
  );
}