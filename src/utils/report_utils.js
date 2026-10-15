import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "../lib/supabaseClient";

// ═══════════════════════════════════════════════════════════════════════════
// Shared constants
// ═══════════════════════════════════════════════════════════════════════════
export const GREEN = "#1a5c2e";
export const GREEN_RGB = [26, 92, 46];
export const RED = "#c0392b";
export const AMBER = "#b7791f";
export const BLUE = "#2563eb";

export const inputCls =
  "w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 bg-white transition";
export const labelCls = "block text-xs font-medium text-gray-500 mb-1";

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const BUCKETS = [
  { key: "current", label: "Current", color: GREEN },
  { key: "b1_30", label: "1–30 days", color: BLUE },
  { key: "b31_60", label: "31–60 days", color: AMBER },
  { key: "b61_90", label: "61–90 days", color: "#d97706" },
  { key: "b90_plus", label: "90+ days", color: RED },
];

// ONE definition of "issued SOA" for every report (previously each report had its own list).
export const BILLABLE_STATUSES = ["approved", "unpaid", "paid"];

// ═══════════════════════════════════════════════════════════════════════════
// Formatting
// ═══════════════════════════════════════════════════════════════════════════
export function fmt(n) {
  return Number(n || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// Date-only strings ("YYYY-MM-DD") are built as LOCAL dates so they never shift a day.
export function fmtDate(d) {
  if (!d) return "—";
  const dt =
    typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)
      ? new Date(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)))
      : new Date(d);
  if (isNaN(dt)) return "—";
  return dt.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "2-digit" });
}

export function fmtDateTime(d) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt)) return "—";
  return dt.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function clientDisplayName(c) {
  if (!c) return "";
  return (
    c.business_name ||
    [c.first_name, c.middle_name, c.last_name].filter(Boolean).join(" ") ||
    c.trade_name ||
    c.client_id ||
    ""
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Timezone-safe date helpers (never use toISOString() for a local calendar date:
// in Manila it returns the PREVIOUS day before 8:00 AM)
// ═══════════════════════════════════════════════════════════════════════════
export const pad = (n) => String(n).padStart(2, "0");
export const ymd = (d = new Date()) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayStr = () => ymd();
export const currentMonthStr = () => todayStr().slice(0, 7);
export const lastDayOfMonth = (y, m) => `${y}-${pad(m)}-${pad(new Date(y, m, 0).getDate())}`;
export const monthRange = (ym) => {
  const [y, m] = ym.split("-").map(Number);
  return { from: `${ym}-01`, to: lastDayOfMonth(y, m) };
};

function utcDay(s) {
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}
export function daysBetween(fromStr, toStr) {
  return Math.round((utcDay(toStr) - utcDay(fromStr)) / 86400000);
}
export function daysOverdue(dueDate, asOf = todayStr()) {
  if (!dueDate) return 0;
  return daysBetween(dueDate, asOf);
}
export function bucketFor(days) {
  if (days <= 0) return "current";
  if (days <= 30) return "b1_30";
  if (days <= 60) return "b31_60";
  if (days <= 90) return "b61_90";
  return "b90_plus";
}

export function datePresets() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-based
  const first = (yy, mm) => `${yy}-${pad(mm + 1)}-01`;
  const prev = m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 };
  const qStart = Math.floor(m / 3) * 3;
  return [
    { key: "this_month", label: "This month", from: first(y, m), to: todayStr() },
    { key: "last_month", label: "Last month", from: first(prev.y, prev.m), to: lastDayOfMonth(prev.y, prev.m + 1) },
    { key: "this_quarter", label: "This quarter", from: first(y, qStart), to: todayStr() },
    { key: "ytd", label: "Year to date", from: `${y}-01-01`, to: todayStr() },
    { key: "last_year", label: "Last year", from: `${y - 1}-01-01`, to: `${y - 1}-12-31` },
    { key: "all", label: "All time", from: "", to: "" },
  ];
}

// ═══════════════════════════════════════════════════════════════════════════
// Supabase helpers — Supabase returns max 1000 rows per request, so EVERYTHING pages.
// The query builder MUST have a stable, unique ordering (end it with .order("id")).
// ═══════════════════════════════════════════════════════════════════════════
export const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

export async function fetchAll(buildQuery, size = 1000) {
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

// .in() lists over a few hundred values make the URL too long, so chunk them (and page each chunk).
export async function fetchIn(table, select, column, ids, shape) {
  let out = [];
  for (const part of chunk([...new Set((ids || []).filter(Boolean))], 150)) {
    const rows = await fetchAll(() => {
      let q = supabase.from(table).select(select).in(column, part).order("id", { ascending: true });
      if (shape) q = shape(q);
      return q;
    });
    out = out.concat(rows);
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
// Reversal helpers (works with the new `reversal_of` column if it exists, and still
// understands the old "Reversal of Invoice X" notes text)
// ═══════════════════════════════════════════════════════════════════════════
export function extractReversedInvoice(notes) {
  if (!notes) return null;
  const match = notes.match(/^Reversal of Invoice (\S+)/);
  return match ? match[1] : null;
}
export const reversedInvoiceOf = (r) => r.reversal_of || extractReversedInvoice(r.notes);

// ═══════════════════════════════════════════════════════════════════════════
// THE invoice ledger — single source of truth for balances.
//
//   charge  = sum of billing_items (gross)            ← same basis as Record Payment
//   paid    = payments tagged to the SOA  +  untagged payments applied oldest-first (FIFO)
//   balance = max(charge − paid, 0)
//
// AR Aging, Billing Summary, Financial Reports and Remittances all read from this,
// so their totals always tie out. (If the firm decides the receivable should be net of
// withholding tax / down payment, change invoiceCharge() below — ONE place.)
// ═══════════════════════════════════════════════════════════════════════════
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const invoiceCharge = (gross /*, dp, wht */) => gross;

function allocateClient(invoices, receipts) {
  const direct = {};
  let pool = 0;
  const ids = new Set(invoices.map((i) => i.id));
  receipts.forEach((r) => {
    const a = Number(r.amount) || 0;
    if (r.billing_id) {
      if (ids.has(r.billing_id)) direct[r.billing_id] = (direct[r.billing_id] || 0) + a;
    } else {
      pool += a;
    }
  });

  let unapplied = 0;
  const out = invoices.map((inv) => {
    const charge = invoiceCharge(inv.gross, inv.dp, inv.wht);
    const d = direct[inv.id] || 0;
    if (d - charge > 0.005) unapplied += d - charge; // paid more than the SOA
    let remaining = Math.max(charge - d, 0);
    let taken = 0;
    if (remaining > 0.005 && pool > 0.005) {
      taken = Math.min(pool, remaining);
      remaining -= taken;
      pool -= taken;
    }
    const paid = d + taken;
    const balance = remaining <= 0.005 ? 0 : round2(remaining);
    const payState =
      charge > 0.005 ? (balance <= 0.005 ? "paid" : paid > 0.005 ? "partial" : "unpaid") : inv.status === "paid" ? "paid" : "unpaid";
    return { ...inv, charge, paid: round2(paid), balance, payState };
  });
  if (pool > 0.005) unapplied += pool; // payments with nothing left to settle
  return { invoices: out, unapplied: round2(unapplied) };
}

export async function loadInvoiceLedger({ asOf, clientId = null, skipPayments = false, from = null } = {}) {
  const cutoff = asOf || todayStr();

  // 1) Issued SOAs (items embedded → one paged query, no chunking)
  const statements = await fetchAll(() => {
    let q = supabase
      .from("billing_statements")
      .select(
        "id, soa_number, soa_date, due_date, client_id, bill_to, status, down_payment, withholding_tax, approved_by, approved_at, billing_items(amount)",
      )
      .in("status", BILLABLE_STATUSES)
      .lte("soa_date", cutoff)
      .order("soa_date", { ascending: true })
      .order("id", { ascending: true });
    if (from && skipPayments) q = q.gte("soa_date", from); // only safe when no FIFO is needed
    if (clientId) q = q.eq("client_id", clientId);
    return q;
  });

  const base = statements.map((s) => {
    const gross = round2((s.billing_items || []).reduce((t, i) => t + (parseFloat(i.amount) || 0), 0));
    const dp = parseFloat(s.down_payment) || 0;
    const wht = parseFloat(s.withholding_tax) || 0;
    return {
      id: s.id,
      soa_number: s.soa_number,
      soa_date: s.soa_date,
      due_date: s.due_date,
      client_id: s.client_id,
      bill_to: s.bill_to,
      status: s.status,
      approved_by: s.approved_by,
      approved_at: s.approved_at,
      gross,
      dp,
      wht,
      net: round2(gross - dp - wht),
    };
  });

  // 2) Payments up to the cutoff (reversals are negative rows, so they net out)
  let receipts = [];
  if (!skipPayments) {
    receipts = await fetchAll(() => {
      let q = supabase
        .from("official_receipts")
        .select("id, client_id, billing_id, amount, payment_date")
        .lte("payment_date", cutoff)
        .order("id", { ascending: true });
      if (clientId) q = q.eq("client_id", clientId);
      return q;
    });
  }
  const receiptsByClient = {};
  receipts.forEach((r) => {
    (receiptsByClient[r.client_id] = receiptsByClient[r.client_id] || []).push(r);
  });

  // 3) Allocate per client
  const byClient = {};
  base.forEach((i) => {
    (byClient[i.client_id] = byClient[i.client_id] || []).push(i);
  });

  const invoices = [];
  const unappliedByClient = {};
  Object.entries(byClient).forEach(([cid, list]) => {
    if (skipPayments) {
      list.forEach((i) => invoices.push({ ...i, charge: invoiceCharge(i.gross), paid: 0, balance: i.gross, payState: "unpaid" }));
      return;
    }
    const res = allocateClient(list, receiptsByClient[cid] || []);
    res.invoices.forEach((i) => invoices.push(i));
    if (res.unapplied > 0.005) unappliedByClient[cid] = res.unapplied;
  });

  // 4) Credits (current balance, not as-of) and profiles
  const creditMap = {};
  try {
    const credits = await fetchAll(() => {
      let q = supabase.from("client_credits").select("client_id, balance").gt("balance", 0).order("client_id", { ascending: true });
      if (clientId) q = q.eq("client_id", clientId);
      return q;
    });
    credits.forEach((c) => {
      if (Number(c.balance) > 0.005) creditMap[c.client_id] = Number(c.balance);
    });
  } catch (e) {
    console.error("client_credits fetch error:", e);
  }

  const profileIds = [...new Set([...Object.keys(byClient), ...Object.keys(creditMap)])];
  const clientMap = {};
  if (profileIds.length > 0) {
    const profiles = await fetchIn(
      "client_profile",
      "id, client_id, business_name, trade_name, first_name, middle_name, last_name",
      "client_id",
      profileIds,
    );
    profiles.forEach((c) => (clientMap[c.client_id] = c));
  }

  return {
    asOf: cutoff,
    invoices,
    clientMap,
    creditMap,
    unappliedByClient,
    unappliedTotal: Object.values(unappliedByClient).reduce((s, v) => s + v, 0),
  };
}

// Per-client aging rows (open invoices only) + clients that only hold unused credit
export function buildAgingRows(ledger) {
  const { invoices, clientMap, creditMap, unappliedByClient, asOf } = ledger;
  const byClient = new Map();

  invoices.forEach((inv) => {
    if (inv.balance <= 0.005) return;
    if (!byClient.has(inv.client_id)) byClient.set(inv.client_id, []);
    byClient.get(inv.client_id).push(inv);
  });

  const rows = [];
  byClient.forEach((list, cid) => {
    const open = list
      .map((inv) => {
        const days = daysOverdue(inv.due_date, asOf);
        return { ...inv, days_overdue: days, bucket: bucketFor(days) };
      })
      .sort((a, b) => (a.due_date || a.soa_date || "").localeCompare(b.due_date || b.soa_date || ""));

    const buckets = { current: 0, b1_30: 0, b31_60: 0, b61_90: 0, b90_plus: 0 };
    let total = 0;
    open.forEach((i) => {
      buckets[i.bucket] += i.balance;
      total += i.balance;
    });
    const oldest = open.find((i) => i.due_date)?.due_date || null;
    const credit = creditMap[cid] || 0;
    const profile = clientMap[cid];

    rows.push({
      client_id: cid,
      client: profile,
      clientName: clientDisplayName(profile) || open[0]?.bill_to || cid,
      invoices: open,
      invoice_count: open.length,
      total_balance: round2(total),
      credit,
      net_balance: round2(total - credit),
      unapplied: unappliedByClient[cid] || 0,
      oldest_due_date: oldest,
      days_overdue: oldest ? Math.max(0, daysOverdue(oldest, asOf)) : 0,
      bucket: oldest ? bucketFor(daysOverdue(oldest, asOf)) : "current",
      ...buckets,
    });
  });

  const creditOnly = Object.keys(creditMap)
    .filter((id) => !byClient.has(id))
    .map((id) => ({
      client_id: id,
      client: clientMap[id],
      clientName: clientDisplayName(clientMap[id]) || id,
      credit: creditMap[id],
    }));

  return { rows, creditOnly };
}

// ═══════════════════════════════════════════════════════════════════════════
// Export helpers
// ═══════════════════════════════════════════════════════════════════════════
export function downloadCsv(filename, headers, rows) {
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }); // BOM → Excel reads UTF-8
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// jsPDF's default font has no peso sign — amounts in PDFs are labelled "(PHP)".
export function downloadPdf({ filename, title, subtitle, headers, rows, footerRow, orientation = "portrait" }) {
  const doc = new jsPDF({ orientation, unit: "pt" });
  doc.setFontSize(14);
  doc.setTextColor(20, 20, 20);
  doc.text(title, 40, 40);
  if (subtitle) {
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text(subtitle, 40, 56);
  }
  autoTable(doc, {
    startY: subtitle ? 68 : 54,
    head: [headers],
    body: rows,
    foot: footerRow ? [footerRow] : undefined,
    styles: { fontSize: 8, cellPadding: 5 },
    headStyles: { fillColor: GREEN_RGB, textColor: 255, fontStyle: "bold" },
    footStyles: { fillColor: [240, 240, 240], textColor: 20, fontStyle: "bold" },
    margin: { left: 40, right: 40, bottom: 36 },
  });
  const pages = doc.getNumberOfPages();
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(160, 160, 160);
    doc.text(`Generated ${new Date().toLocaleString("en-PH")}`, 40, h - 20);
    doc.text(`Page ${i} of ${pages}`, w - 40, h - 20, { align: "right" });
  }
  doc.save(filename);
}