// Reusable date helpers (local-date safe, walang timezone shift)

export const pad2 = (n) => String(n).padStart(2, "0");

// Number of days in a month (month is 1-based: 1 = January)
export const daysInMonth = (year, month) => new Date(year, month, 0).getDate();

// Date -> "YYYY-MM-DD" (local, hindi toISOString)
export function ymd(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

// "YYYY-MM-DD" -> Date (local midnight)
export function parseYmd(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// Display format. Plain "YYYY-MM-DD" strings are parsed as local dates,
// para hindi umatras ang araw sa ibang timezone.
export function fmtDate(d) {
  if (!d) return "—";
  const date = typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) ? parseYmd(d) : new Date(d);
  return date.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "2-digit" });
}

export function formatRangeLabel(from, to) {
  return from === to ? fmtDate(from) : `${fmtDate(from)} – ${fmtDate(to)}`;
}

// Quick-select ranges -> [from, to]
export function presetRange(key) {
  const t = new Date();
  const y = t.getFullYear();
  const m = t.getMonth();
  const d = t.getDate();
  if (key === "today") return [ymd(t), ymd(t)];
  if (key === "week") {
    const dow = t.getDay(); // Sunday – Saturday
    return [ymd(new Date(y, m, d - dow)), ymd(new Date(y, m, d - dow + 6))];
  }
  if (key === "month") return [ymd(new Date(y, m, 1)), ymd(new Date(y, m + 1, 0))];
  if (key === "lastMonth") return [ymd(new Date(y, m - 1, 1)), ymd(new Date(y, m, 0))];
  if (key === "year") return [ymd(new Date(y, 0, 1)), ymd(new Date(y, 11, 31))];
  return [ymd(t), ymd(t)];
}

export const QUICK_PRESETS = [
  ["today", "Today"],
  ["week", "This Week"],
  ["month", "This Month"],
  ["lastMonth", "Last Month"],
  ["year", "This Year"],
];