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
const UNMATCHED = "__unmatched__";
const MONTH_NAMES = [
  "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
  "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER",
];

const fmt = (n) =>
  Number(n || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// Excel style: zero -> blank, amounts in the account columns
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
  const end = String(p).split(/[–—]/).pop().trim(); // end of range
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
              <li
                key={p}
                className="flex items-center justify-between text-xs text-gray-700"
              >
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

const norm = (s) => (s || "").toLowerCase().replace(/\s+/g, " ").trim();

const isDeposited = (r) =>
  r.payment_method === "credit" || r.deposit_status === "deposited";

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

// Remittance deadlines fall in the month AFTER the month being viewed
// (e.g. January collection -> due 02/28). Change to 0 if yours fall in the same month.
const DUE_MONTH_OFFSET = 1;

const OTHER = "__other__"; // remittance not tied to a specific account column
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// !! Same function as in RecordPayment.jsx — must always stay identical.
function allocateRemittance(items, receipts) {
  const billed = {};
  const order = [];
  (items || []).forEach((i) => {
    const code = i.code || OTHER;
    if (!(code in billed)) {
      billed[code] = 0;
      order.push(code);
    }
    billed[code] += Number(i.amount) || 0;
  });
  const rem = { ...billed };
  const perReceipt = {};
  const sorted = [...(receipts || [])].sort((a, b) =>
    a.id > b.id ? 1 : a.id < b.id ? -1 : 0,
  );
  sorted.forEach((r) => {
    const stored = r.remittance_breakdown;
    if (stored && typeof stored === "object" && Object.keys(stored).length) {
      const bd = {};
      Object.keys(stored).forEach((k) => {
        const v = Number(stored[k]) || 0;
        bd[k] = v;
        if (k in rem) rem[k] = r2(rem[k] - v);
      });
      perReceipt[r.id] = bd;
      return;
    }
    let left = r2(r.remittance_amount);
    const bd = {};
    if (left > 0.005) {
      order.forEach((code) => {
        if (left <= 0.005) return;
        const take = Math.min(left, Math.max(rem[code], 0));
        if (take > 0.005) {
          bd[code] = r2(take);
          rem[code] = r2(rem[code] - take);
          left = r2(left - take);
        }
      });
      if (left > 0.005) bd[OTHER] = r2((bd[OTHER] || 0) + left);
    } else if (left < -0.005) {
      let back = -left;
      [...order].reverse().forEach((code) => {
        if (back <= 0.005) return;
        const give = Math.min(back, Math.max(billed[code] - rem[code], 0));
        if (give > 0.005) {
          bd[code] = r2(-give);
          rem[code] = r2(rem[code] + give);
          back = r2(back - give);
        }
      });
      if (back > 0.005) bd[OTHER] = r2((bd[OTHER] || 0) - back);
    }
    perReceipt[r.id] = bd;
  });
  return { billed, rem, order, perReceipt };
}

// ── Fixed columns (the account columns are dynamic and sit between PRE and POST) ──
const PRE_DEFS = [
  {
    key: "cash",
    label: "Remittance collected",
    val: (r) => r.cash,
    tot: (t) => t.cash,
    cls: () => "whitespace-nowrap",
    style: () => ({ paddingLeft: 24, paddingRight: 24 }),
  },
  {
    key: "date",
    label: "Date collected",
    text: (r) => summarizeDates(r.dates).text,
    title: (r) => summarizeDates(r.dates).title,
    cls: () => "text-gray-500 whitespace-nowrap",
    style: () => ({ paddingRight: 24 }),
  },
];
const POST_DEFS = [
  {
    key: "onHand",
    label: "Balances",
    val: (r) => r.onHand,
    tot: (t) => t.onHand,
    cls: (r) =>
      r.onHand > 0.005
        ? "border-l border-gray-100 text-amber-600 font-semibold"
        : r.onHand < -0.005
          ? "border-l border-gray-100 text-red-500 font-semibold"
          : "border-l border-gray-100 text-gray-400",
  },
];

export default function RemittancesPayables() {
  const [view, setView] = useState("all"); // "all" | "year" | "month"
  const [month, setMonth] = useState(currentMonth());
  const [year, setYear] = useState(String(new Date().getFullYear()));
  // false = only clients that have activity / balances (clients with nothing are hidden)
  const [showAll] = useState(false);
  // "payable" | "paid"
  const [acctMode, setAcctMode] = useState("payable");
  const [showCols, setShowCols] = useState(false);
  // column visibility overrides: key -> boolean. Missing = default
  // (fixed columns: shown; account columns: shown only if they have an amount)
  const [colPrefs, setColPrefs] = useState({});
  const [warn, setWarn] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [availableMonths, setAvailableMonths] = useState([]);

  // ── Client filters ──
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClients, setSelectedClients] = useState([]); // empty = all
  const [showPicker, setShowPicker] = useState(false);
  const [pickSearch, setPickSearch] = useState("");
  const pickerRef = useRef(null);

  const [receipts, setReceipts] = useState([]);
  const [fundReqs, setFundReqs] = useState([]);
  const [credits, setCredits] = useState({});
  const [billingPeriods, setBillingPeriods] = useState({}); // billing_id -> [period_covered]
  const [remitItems, setRemitItems] = useState({}); // billing_id -> [{code, amount}] (remittance items only)
  const [remitCols, setRemitCols] = useState([]); // every account under a remittance group
  const [names, setNames] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const handler = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target))
        setShowPicker(false);
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
        .filter((id) => id !== "__trade")
        .map((id) => ({ id, name: names[id] }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [names],
  );
  const visibleOptions = clientOptions.filter((c) =>
    `${c.name} ${c.id}`.toLowerCase().includes(pickSearch.toLowerCase()),
  );
  const toggleClient = (id) =>
    setSelectedClients((p) =>
      p.includes(id) ? p.filter((x) => x !== id) : [...p, id],
    );

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
 
const monthLabel = (ym) => {
  const [y, m] = ym.split("-");
  const name = MONTH_NAMES[Number(m) - 1];
  return `${name[0]}${name.slice(1).toLowerCase()} ${y}`;
};
const yearOptions = useMemo(
  () => [...new Set(availableMonths.map((m) => m.slice(0, 4)))],
  [availableMonths],
);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const to = range.to;

      // ── Columns: every account under a group whose category = 'remittance' ──
      const { data: groups, error: gErr } = await supabase
        .from("fee_groups")
        .select("id, sort_order")
        .eq("category", "remittance");
      if (gErr) throw gErr;
      const groupIds = (groups || []).map((g) => g.id);

      let cols = [];
      if (groupIds.length) {
        const { data: ags, error: aErr } = await supabase
          .from("government_agencies")
          .select("id, name, sort_order")
          .in("group_id", groupIds)
          .order("sort_order", { ascending: true })
          .order("name", { ascending: true });
        if (aErr) throw aErr;
        const agIds = (ags || []).map((a) => a.id);
        if (agIds.length) {
          const { data: accts, error: cErr } = await supabase
            .from("chart_of_accounts")
            .select("id, code, account_name, agency_id, is_active, due_day")
            .in("agency_id", agIds)
            .eq("is_active", true)
            .order("code", { ascending: true });
          if (cErr) throw cErr;
          const agOrder = {};
          (ags || []).forEach((a, i) => (agOrder[a.id] = { i, name: a.name }));
          cols = (accts || [])
            .filter((a) => a.code)
            .map((a) => ({
              key: a.code,
              name: a.account_name,
              agency: agOrder[a.agency_id]?.name || "",
              dueDay: a.due_day || null,
              ord: agOrder[a.agency_id]?.i ?? 999,
            }))
            .sort((a, b) => a.ord - b.ord || a.key.localeCompare(b.key));
        }
      }
      setRemitCols(cols);

      // ── Receipts ──
      const allRcpts = await fetchAll(() =>
        supabase
          .from("official_receipts")
          .select(
            "id, client_id, billing_id, amount, income_amount, remittance_amount, remittance_breakdown, payment_method, payment_date, deposit_status",
          )
          .lte("payment_date", to)
          .order("id", { ascending: true }),
      );

      // ── Billing items of the SOAs that were paid: PC + remittance lines ──
      const billingIds = [
        ...new Set(allRcpts.map((r) => r.billing_id).filter(Boolean)),
      ];
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
          if (i.item_type === "remittance" && i.period_covered)
            (pcMap[i.billing_id] = pcMap[i.billing_id] || []).push(i.period_covered);
          if (i.item_type === "remittance")
            (itemMap[i.billing_id] = itemMap[i.billing_id] || []).push({
              code: i.account_code || OTHER,
              amount: Number(i.amount) || 0,
            });
        });
      }
      setBillingPeriods(pcMap);
      setRemitItems(itemMap);

      // per-account breakdown of each receipt (stored, or computed for old ones)
      const byBilling = {};
      allRcpts.forEach((r) => {
        if (r.billing_id) (byBilling[r.billing_id] = byBilling[r.billing_id] || []).push(r);
      });
      const bdMap = {};
      Object.keys(byBilling).forEach((bid) => {
        Object.assign(bdMap, allocateRemittance(itemMap[bid], byBilling[bid]).perReceipt);
      });
      setReceipts(
        allRcpts.filter(isDeposited).map((r) => ({
          ...r,
          bd: r.billing_id
            ? bdMap[r.id] || {}
            : Number(r.remittance_amount)
              ? { [OTHER]: Number(r.remittance_amount) }
              : {},
        })),
      );

      // ── Remittance fund requests (approved/released = remitted, pending = in process) ──
      setFundReqs(
        await fetchAll(() =>
          supabase
            .from("fund_requests")
            .select("*")
            .eq("fund_type", "remittances")
            .in("status", ["approved", "released", "pending"])
            .lte("request_date", to)
            .order("id", { ascending: true }),
        ),
      );

      // ── Client credit balances ──
      const { data: cr, error: crErr } = await supabase
        .from("client_credits")
        .select("client_id, balance")
        .gt("balance", 0);
      setWarn(
        crErr
          ? "Cannot read the client_credits table, so 'Credit payable' is blank for now. Create the table to show it."
          : "",
      );
      const creditMap = {};
      (cr || []).forEach((c) => (creditMap[c.client_id] = Number(c.balance)));
      setCredits(creditMap);

      // ── All approved clients ──
      const profiles = await fetchAll(() =>
        supabase
          .from("client_profile")
          .select(
            "client_id, business_name, trade_name, first_name, middle_name, last_name",
          )
          .eq("approval_status", "approved")
          .order("id", { ascending: true }),
      );
      const nameMap = { __trade: {} };
      profiles.forEach((c) => {
        nameMap[c.client_id] =
          c.business_name ||
          [c.first_name, c.middle_name, c.last_name].filter(Boolean).join(" ") ||
          c.client_id;
        if (c.trade_name) nameMap.__trade[norm(c.trade_name)] = c.client_id;
      });
      setNames(nameMap);
    } catch (e) {
      setError(e.message || "Failed to load data.");
    }
    setLoading(false);
  }, [range.to]);

  useEffect(() => {
    load();
  }, [load]);
// Months that actually have data (independent of the selected period)
const loadAvailable = useCallback(async () => {
  try {
    const [rc, fr] = await Promise.all([
      fetchAll(() =>
        supabase
          .from("official_receipts")
          .select("id, payment_date, remittance_amount, payment_method, deposit_status")
          .order("id", { ascending: true }),
      ),
      fetchAll(() =>
        supabase
          .from("fund_requests")
          .select("id, request_date")
          .eq("fund_type", "remittances")
          .in("status", ["approved", "released", "pending"])
          .order("id", { ascending: true }),
      ),
    ]);
    const set = new Set();
    rc.forEach((r) => {
      if (r.payment_date && isDeposited(r) && Math.abs(Number(r.remittance_amount) || 0) > 0.005)
        set.add(r.payment_date.slice(0, 7));
    });
    fr.forEach((f) => f.request_date && set.add(f.request_date.slice(0, 7)));
    setAvailableMonths(Array.from(set).sort().reverse());
  } catch (e) {
    console.error("loadAvailable error:", e);
  }
}, []);

useEffect(() => {
  loadAvailable();
}, [loadAvailable]);

// If the selected month/year has no data, jump to the latest one that does
useEffect(() => {
  if (availableMonths.length === 0) return;
  if (!availableMonths.includes(month)) setMonth(availableMonths[0]);
  if (!yearOptions.includes(year)) setYear(yearOptions[0]);
}, [availableMonths, yearOptions]); // eslint-disable-line react-hooks/exhaustive-deps
  // Used to decide if a remittance can be tied to an account column (else it goes to "Other")
  const colKeys = useMemo(() => new Set(remitCols.map((c) => c.key)), [remitCols]);

  // ── Per-client rows + totals ──────────────────────────────────────────────
  const { rows, totals, summary, columns: allColumns, acctAll } = useMemo(() => {
    const { from } = range;
    const inPeriod = (d) => d && d >= from;

    const byName = {};
    Object.keys(names).forEach((id) => {
      if (id !== "__trade") byName[norm(names[id])] = id;
    });
    const matchClient = (fr) => {
      if (fr.client_id) return fr.client_id;
      const key = norm(fr.tax_payer);
      return byName[key] || names.__trade?.[key] || UNMATCHED;
    };

    const map = new Map();
    const get = (id) => {
      if (!map.has(id))
        map.set(id, {
          client_id: id,
          name:
            id === UNMATCHED
              ? "Unmatched fund requests (tax payer ≠ client name)"
              : names[id] || id,
          cash: 0,
          undeposited: 0,
          income: 0,
          remitCollected: 0,
          remitCollectedAll: 0,
          remitted: 0,
          remittedAll: 0,
          pending: 0,
          credit: credits[id] || 0,
          dates: new Set(),
          remitDates: new Set(),
          periods: new Set(),
          a: { col: {}, colAll: {}, paid: {}, paidAll: {}, pending: {} },
        });
      return map.get(id);
    };

    receipts.forEach((r) => {
      const c = get(r.client_id);
      const rem = Number(r.remittance_amount) || 0;
      c.remitCollectedAll += rem;
      // credit applications aren't cash, so they're never "undeposited"
      if (r.deposit_status === "undeposited" && r.payment_method !== "credit")
        c.undeposited += Number(r.amount) || 0;
      if (inPeriod(r.payment_date)) {
        c.cash += rem; // remittance portion only
        c.income += Number(r.income_amount) || 0;
        c.remitCollected += rem;

        if (rem > 0.005 && r.payment_method !== "credit") {
          c.dates.add(r.payment_date);
          (billingPeriods[r.billing_id] || []).forEach((p) => c.periods.add(p));
        }
      }
      // per-account collected
      Object.keys(r.bd || {}).forEach((k) => {
        const kk = colKeys.has(k) ? k : OTHER;
        const v = Number(r.bd[k]) || 0;
        c.a.colAll[kk] = (c.a.colAll[kk] || 0) + v;
        if (inPeriod(r.payment_date)) c.a.col[kk] = (c.a.col[kk] || 0) + v;
      });
    });

    fundReqs.forEach((fr) => {
      const c = get(matchClient(fr));
      const amt = Number(fr.total_amount) || 0;

      if (fr.status === "approved" || fr.status === "released") {
        c.remittedAll += amt;
        if (inPeriod(fr.request_date)) {
          c.remitted += amt;
          c.remitDates.add(fr.request_date);
        }
      } else {
        c.pending += amt;
      }

      // Per-account: paid (approved/released) vs pending — separate buckets
      const isPaid = fr.status === "approved" || fr.status === "released";
      const lines =
        Array.isArray(fr.remittance_items) && fr.remittance_items.length
          ? fr.remittance_items
          : [{ account_code: fr.account_code, amount: amt }];
      lines.forEach((l) => {
        const kk = l.account_code && colKeys.has(l.account_code) ? l.account_code : OTHER;
        const v = Number(l.amount) || 0;
        if (isPaid) {
          c.a.paidAll[kk] = (c.a.paidAll[kk] || 0) + v;
          if (inPeriod(fr.request_date)) c.a.paid[kk] = (c.a.paid[kk] || 0) + v;
        } else {
          c.a.pending[kk] = (c.a.pending[kk] || 0) + v;
        }
      });
    });

    if (showAll)
      Object.keys(names).forEach((id) => {
        if (id !== "__trade") get(id);
      });

    const rows = Array.from(map.values())
      .map((r) => {
        const { colAll, paid, paidAll } = r.a;
        const keys = new Set([...Object.keys(colAll), ...Object.keys(paidAll)]);
        const acct = {};
        keys.forEach((k) => {
          const v =
            acctMode === "payable"
              ? (colAll[k] || 0) - (paidAll[k] || 0) // collected − remitted (cumulative)
              : paid[k] || 0; // remitted in the selected period
          if (Math.abs(v) > 0.005) acct[k] = v;
        });
        // Balances = remittance collected but not yet remitted (cumulative)
        return { ...r, acct, onHand: r.remitCollectedAll - r.remittedAll };
      })
      .filter(
        (r) =>
          showAll ||
          r.cash ||
          r.remitCollected ||
          r.remitted ||
          r.pending ||
          Math.abs(r.onHand) > 0.005 ||
          r.credit > 0.005,
      )
      .sort((a, b) => {
        if (a.client_id === UNMATCHED) return 1;
        if (b.client_id === UNMATCHED) return -1;
        return a.name.localeCompare(b.name);
      });

    // totals per account across ALL clients (used to decide which columns have an amount)
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
          undeposited: t.undeposited + r.undeposited,
          remitCollected: t.remitCollected + r.remitCollected,
          remitted: t.remitted + r.remitted,
          pending: t.pending + r.pending,
          onHand: t.onHand + r.onHand,
          credit: t.credit + r.credit,
          acct: t.acct,
        };
      },
      {
        cash: 0, undeposited: 0, remitCollected: 0,
        remitted: 0, pending: 0, onHand: 0, credit: 0, acct: {},
      },
    );

    // Account columns (+ "Other" only when it has something in it)
    const columns = [...remitCols];
    if (Math.abs(acctAll[OTHER] || 0) > 0.005)
      columns.push({ key: OTHER, name: "Other / unallocated", agency: "" });

    // ── Bottom block (mirrors the spreadsheet) ──
    const unmatched = filteredRows.find((r) => r.client_id === UNMATCHED);
    const missing = unmatched ? unmatched.remitted : 0;

    // COH = sum of the Balances column (same as CASH END under Balances)
    const coh = totals.onHand;
    const shortages = [];
    const borrow = 0;

    // Cash to remit = COH
    const toRemit = totals.onHand;

    return {
      rows: filteredRows,
      totals,
      columns,
      acctAll,
      summary: {
        contri: totals.remitCollected,
        noy: totals.remitted,
        missing,
        coh,
        shortages,
        borrow,
        toRemit,
        overShort: coh - toRemit,
      },
    };
  }, [
    receipts, fundReqs, credits, names, billingPeriods, remitItems, remitCols,
    colKeys, range, showAll, clientSearch, selectedClients, acctMode,
  ]);

  const fv = (k) => colPrefs[k] !== false; // fixed column visible?
  const acctVisible = (c) =>
    colPrefs[c.key] !== undefined ? colPrefs[c.key] : Math.abs(acctAll[c.key] || 0) > 0.005;
  const columns = useMemo(
    () => allColumns.filter(acctVisible),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allColumns, colPrefs, acctAll],
  );

  // deadline shown under each account column (Excel's date row)
  const dueLabel = (day) => {
    if (!day) return "";
    if (view !== "month") return `Day ${day}`;
    const [y, m] = month.split("-").map(Number);
    const t = new Date(y, m - 1 + DUE_MONTH_OFFSET, 1);
    const last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
    const d = Math.min(day, last);
    return `${String(t.getMonth() + 1).padStart(2, "0")}/${String(d).padStart(2, "0")}/${t.getFullYear()}`;
  };

  const preDefs = PRE_DEFS.filter((d) => fv(d.key));
  const postDefs = POST_DEFS.filter((d) => fv(d.key));
  const totalCols = 1 + preDefs.length + columns.length + postDefs.length;
  const visibleCount = totalCols;
  const allCount = 1 + PRE_DEFS.length + allColumns.length + POST_DEFS.length;

  useEffect(() => {
    setPage(1);
  }, [range, showAll, pageSize, clientSearch, selectedClients, acctMode]);

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
  const modeLabel = acctMode === "payable" ? "Payable" : "Remitted";
  const clientFilterLabel =
    selectedClients.length > 0
      ? `${selectedClients.length} client${selectedClients.length === 1 ? "" : "s"} selected`
      : clientSearch
        ? `Search: "${clientSearch}"`
        : "All Clients";
  const exportDisabled = loading || rows.length === 0;
  const colHeader = (c) => (c.agency ? `${c.agency} - ${c.name}` : c.name);
  const hasDue = columns.some((c) => c.dueDay);

  const summaryLines = [
    [`FBMEC ${periodLabel} Contri Funds`, summary.contri],
    [`NOY ${periodLabel} Contri Funds`, summary.noy],
    ["Missing Funds", summary.missing],
    ["TOTAL COH", summary.coh],
    ["TOTAL BORROW/ABONO", summary.borrow],
    ["TOTAL CASH TO REMIT", summary.toRemit],
    ["CASH OVER (SHORT)", summary.overShort],
  ];

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
      ["Remittances & Client Payables"],
      [`Mode: ${modeLabel}`],
      [`Period: ${exportPeriodLabel}`],
      [`Clients: ${clientFilterLabel}`],
      [],
      header,
    ];
    if (hasDue)
      aoa.push([
        "",
        "Due date",
        ...preDefs.map(() => ""),
        ...columns.map((c) => dueLabel(c.dueDay)),
        ...postDefs.map(() => ""),
      ]);
    rows.forEach((r, i) =>
      aoa.push([
        i + 1,
        r.name,
        ...preDefs.map((d) => cellXlsx(d, r)),
        ...columns.map((c) => Number(r.acct[c.key]) || 0),
        ...postDefs.map((d) => cellXlsx(d, r)),
      ]),
    );
    aoa.push([
      "",
      "CASH END",
      ...preDefs.map((d) => (d.tot ? Number(d.tot(totals)) || 0 : "")),
      ...columns.map((c) => Number(totals.acct[c.key]) || 0),
      ...postDefs.map((d) => (d.tot ? Number(d.tot(totals)) || 0 : "")),
    ]);
    aoa.push([]);
    summaryLines.forEach(([label, value]) => aoa.push(["", label, Number(value) || 0]));

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = header.map((h, i) => ({
      wch: i === 0 ? 5 : i === 1 ? 38 : Math.max(String(h).length + 4, 16),
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Remittances");
    XLSX.writeFile(wb, `remittances_${acctMode}_${periodText}_${stamp}.xlsx`);
  };

  const exportPDF = async () => {
    setPdfBusy(true);
    try {
      const pdfCols = [
        { label: "Client", w: 2.8 },
        ...preDefs.map((d) => ({ label: d.label, w: d.key === "date" ? 1.6 : 1.5 })),
        ...columns.map((c) => ({ label: c.name, w: 1.3 })),
        ...postDefs.map((d) => ({ label: d.label, w: 1.4 })),
      ];
      const cellPdf = (d, r) => (d.val ? fmt(d.val(r)) : d.text(r));
      const totalsText = [
        ...preDefs.filter((d) => d.tot).map((d) => `${d.label} ${fmt(d.tot(totals))}`),
        ...postDefs.filter((d) => d.tot).map((d) => `${d.label} ${fmt(d.tot(totals))}`),
      ].join("  |  ");

      await exportTablePDF({
        title: "Remittances & Client Payables",
        subtitle: [modeLabel, exportPeriodLabel, clientFilterLabel].join("  |  "),
        cols: pdfCols,
        groups: [
          {
            label: "Cash End",
            sublabel: `${totalsText}  |  Total COH ${fmt(summary.coh)}`,
            countLabel: `${rows.length} client${rows.length === 1 ? "" : "s"}`,
            rows: rows.map((r) => [
              r.name,
              ...preDefs.map((d) => cellPdf(d, r)),
              ...columns.map((c) => fmtCell(r.acct[c.key] || 0)),
              ...postDefs.map((d) => cellPdf(d, r)),
            ]),
          },
        ],
        format: pdfCols.length > 8 ? "legal" : "a4",
        fileName: `remittances_${acctMode}_${periodText}_${stamp}.pdf`,
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

  const SummaryRow = ({ label, value, note, color, bold }) => (
    <tr>
      <td
        className={`px-4 py-1.5 text-right ${bold ? "font-bold" : "font-medium"}`}
        style={{ color: color || "#1f2937", background: "#e8f5ec" }}
      >
        {label}
      </td>
      <td
        className={`px-4 py-1.5 font-mono text-right ${bold ? "font-bold" : ""}`}
        style={{
          color: color || "#1f2937",
          background: "#e8f5ec",
          minWidth: 130,
        }}
      >
        {value === null ? "" : fmt(value)}
      </td>
      <td className="px-3 py-1.5 text-xs text-gray-600">{note || ""}</td>
    </tr>
  );

  return (
    <div className="min-h-screen bg-gray-50 print:bg-white print:min-h-0">
      {/* TOP BAR */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-3.5 bg-white border-b border-gray-200 print:hidden">
        <div>
          <h1 className="text-base font-semibold text-gray-800">
            Remittances &amp; Client Payables
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden border border-gray-200 rounded-md">
            {[
              ["payable", "Payable"],
              ["paid", "Remitted"],
            ].map(([v, label]) => (
              <button
                key={v}
                onClick={() => setAcctMode(v)}
                className={`px-3 py-2 text-sm font-medium transition ${
                  acctMode === v ? "text-white" : "text-gray-600 bg-white hover:bg-gray-50"
                }`}
                style={acctMode === v ? { background: GREEN } : undefined}
              >
                {label}
              </button>
            ))}
          </div>

          <select
            value={view}
            onChange={(e) => setView(e.target.value)}
            className={inputCls}
          >
            <option value="all">All time</option>
            <option value="year">Year</option>
            <option value="month">Month</option>
          </select>
        {view === "all" ? null : view === "month" ? (
  <select
    value={month}
    onChange={(e) => setMonth(e.target.value)}
    disabled={availableMonths.length === 0}
    className={inputCls}
  >
    {availableMonths.length === 0 && <option value={month}>No data</option>}
    {availableMonths.map((m) => (
      <option key={m} value={m}>
        {monthLabel(m)}
      </option>
    ))}
  </select>
) : (
  <select
    value={year}
    onChange={(e) => setYear(e.target.value)}
    disabled={yearOptions.length === 0}
    className={inputCls}
  >
    {yearOptions.length === 0 && <option value={year}>No data</option>}
    {yearOptions.map((y) => (
      <option key={y} value={y}>
        {y}
      </option>
    ))}
  </select>
)}

          <button
          onClick={() => {
  load();
  loadAvailable();
}}
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

        {warn && (
          <div className="px-4 py-3 text-sm border-l-4 rounded-md text-amber-800 border-amber-400 bg-amber-50">
            {warn}
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
                    <p className="px-3 py-4 text-xs text-center text-gray-400">
                      No clients found
                    </p>
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
                Default (accounts with amount only)
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
                Accounts with no amount in this period are hidden.
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
                        onChange={() =>
                          setColPrefs((p) => ({ ...p, [c.key]: !acctVisible(c) }))
                        }
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
                  <th className="sticky left-0 px-4 py-2.5 text-left bg-white w-64">Client</th>
                  {preDefs.map((d) => (
                    <th
                      key={d.key}
                      className={`px-3 py-2.5 whitespace-nowrap ${d.val ? "text-right" : "text-left"}`}
                      style={d.style ? d.style() : undefined}
                    >
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
                      className={`px-3 py-2.5 ${d.val ? "text-right" : "text-left"}`}
                    >
                      {d.label}
                    </th>
                  ))}
                </tr>
                {columns.length > 0 && (
                  <tr className="border-b border-gray-100 text-[10px] text-gray-400">
                    <th className="sticky left-0 bg-white" />
                    {preDefs.length > 0 && <th colSpan={preDefs.length} />}
                    {columns.map((c) => (
                      <th
                        key={c.key}
                        className="px-3 py-1 font-normal text-right border-l border-gray-100 whitespace-nowrap"
                        style={{ background: "#f4faf6" }}
                        title="Remittance due date"
                      >
                        {dueLabel(c.dueDay)}
                      </th>
                    ))}
                    {postDefs.length > 0 && <th colSpan={postDefs.length} />}
                  </tr>
                )}
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
                      No client activity in this period.
                    </td>
                  </tr>
                )}
                {!loading &&
                  pagedRows.map((r) => (
                    <tr
                      key={r.client_id}
                      className={r.client_id === UNMATCHED ? "bg-blue-50/40" : "hover:bg-gray-50/50"}
                    >
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
                      CASH END
                    </td>
                    {preDefs.map((d) => (
                      <td
                        key={d.key}
                        className="px-3 py-2.5 font-mono text-right"
                        style={d.style ? d.style() : undefined}
                      >
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
                  {(safePage - 1) * pageSize + 1}–
                  {Math.min(safePage * pageSize, rows.length)} of {rows.length} clients
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

        {/* LOWER SUMMARY — mirrors the spreadsheet */}
        {!loading && rows.length > 0 && (
          <div className="p-5 bg-white border border-gray-200 rounded-lg">
            <table className="text-sm">
              <tbody>
                <SummaryRow label={`FBMEC ${periodLabel} Contri Funds`} value={summary.contri} />
                <SummaryRow label={`NOY ${periodLabel} Contri Funds`} value={summary.noy} />
                <SummaryRow label="Missing Funds" value={summary.missing} note="" />
                <SummaryRow label="TOTAL COH" value={summary.coh} color={GREEN} bold />
              </tbody>
            </table>

            <p className="mt-5 mb-2 text-sm font-bold text-gray-800">CHARGE TO RET FEES</p>
            <table className="mb-5 text-sm" style={{ minWidth: 380 }}>
              <tbody>
                <tr>
                  <td className="px-4 py-1.5 text-gray-800" style={{ background: "#fdf1d6" }}>
                    TOTAL
                  </td>
                  <td
                    className="px-4 py-1.5 font-mono text-right"
                    style={{ background: "#fdf1d6" }}
                  >
                    {fmt(0)}
                  </td>
                </tr>
              </tbody>
            </table>

            <table className="text-sm">
              <tbody>
                <SummaryRow
                  label="TOTAL BORROW/ABONO"
                  value={summary.borrow}
                  color={GREEN}
                  bold
                  note="ABONO (UNPAID TP/SHORT CHARGES)"
                />
                <tr>
                  <td colSpan={3} className="h-2" />
                </tr>
                <SummaryRow
                  label="TOTAL CASH TO REMIT"
                  value={summary.toRemit}
                  color="#c0392b"
                  bold
                  note="ABONO (UNPAID TP/SHORT CHARGES)"
                />
                <tr>
                  <td colSpan={3} className="h-2" />
                </tr>
                <SummaryRow
                  label="CASH OVER (SHORT)"
                  value={summary.overShort}
                  color="#c0392b"
                  bold
                  note="FUND FOR NEXT PAYMENT"
                />
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* PRINT-ONLY: full report (all rows, no pagination) */}
      {!loading && rows.length > 0 && (
        <div className="hidden p-6 print:block">
          <h1 className="text-lg font-bold">Remittances &amp; Client Payables</h1>
          <p className="mb-3 text-xs text-gray-500">
            {modeLabel} · {exportPeriodLabel} · {clientFilterLabel} · Generated{" "}
            {new Date().toLocaleString("en-PH")}
          </p>
          <table className="w-full text-[9px] border-collapse">
            <thead>
              {columns.length > 0 && (
                <tr className="text-[8px] font-semibold text-gray-500">
                  <th />
                  {preDefs.length > 0 && <th colSpan={preDefs.length} />}
                  {agencyGroups.map((g, i) => (
                    <th
                      key={i}
                      colSpan={g.span}
                      className="px-1 py-1 text-center border-l border-gray-300"
                    >
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
              {hasDue && (
                <tr className="text-[8px] text-gray-500 border-b border-gray-300">
                  <th />
                  {preDefs.length > 0 && <th colSpan={preDefs.length} />}
                  {columns.map((c) => (
                    <th key={c.key} className="px-1 py-0.5 font-normal text-right">
                      {dueLabel(c.dueDay)}
                    </th>
                  ))}
                  {postDefs.length > 0 && <th colSpan={postDefs.length} />}
                </tr>
              )}
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
                <td className="py-1.5 pr-2 text-right">CASH END</td>
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

          <table className="mt-4 text-[10px] break-inside-avoid">
            <tbody>
              {summaryLines.map(([label, value]) => (
                <tr key={label}>
                  <td className="py-0.5 pr-6 font-semibold">{label}</td>
                  <td className="py-0.5 font-mono text-right">{fmt(value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}