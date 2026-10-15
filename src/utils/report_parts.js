import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  FaSearch,
  FaTimes,
  FaUser,
  FaFileCsv,
  FaFilePdf,
  FaPrint,
  FaSpinner,
} from "react-icons/fa";
import { supabase } from "../lib/supabaseClient";
import { GREEN, inputCls, labelCls, clientDisplayName, datePresets } from "./report_utils";

// ── Pagination: one hook + one component for every report ──────────────────
export function usePagination(items, { initialSize = 25, resetOn = [] } = {}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialSize);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setPage(1), [pageSize, ...resetOn]);

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageItems = useMemo(
    () => items.slice((safePage - 1) * pageSize, safePage * pageSize),
    [items, safePage, pageSize],
  );
  return { page: safePage, setPage, pageSize, setPageSize, pageItems, total, totalPages };
}

function getPageNumbers(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set([1, total, current - 1, current, current + 1]);
  const sorted = [...set].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push("…");
    out.push(p);
  });
  return out;
}

export function Pagination({ pg, unit = "entries", sizes = [10, 25, 50, 100] }) {
  const { page, setPage, pageSize, setPageSize, total, totalPages } = pg;
  if (total === 0) return null;
  const btn =
    "px-3 py-1.5 text-xs border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition";
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-t border-gray-100 print:hidden">
      <div className="flex items-center gap-3 text-xs text-gray-400">
        <span>
          {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total} {unit}
        </span>
        <select
          value={pageSize}
          onChange={(e) => setPageSize(Number(e.target.value))}
          className="px-2 py-1 text-xs text-gray-600 border border-gray-200 rounded-md focus:outline-none"
        >
          {sizes.map((n) => (
            <option key={n} value={n}>
              {n} / page
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-1">
        <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className={btn}>
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
        <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className={btn}>
          Next
        </button>
      </div>
    </div>
  );
}

// ── Small display parts ────────────────────────────────────────────────────
export function LoadingRow({ text = "Loading..." }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-400">
      <FaSpinner className="animate-spin" size={13} /> {text}
    </div>
  );
}

export function SummaryCard({ label, value, accent, sub }) {
  return (
    <div className="p-4 bg-white border border-gray-200 rounded-lg">
      <p className="text-xs font-medium text-gray-400">{label}</p>
      <p className="mt-1 font-mono text-lg font-bold" style={{ color: accent || "#1f2937" }}>
        {value}
      </p>
      {sub && <p className="mt-0.5 text-[10px] text-gray-400">{sub}</p>}
    </div>
  );
}

export function ErrorBanner({ message, onClose }) {
  if (!message) return null;
  return (
    <div className="flex items-center justify-between px-4 py-2.5 text-sm text-red-700 border-l-4 border-red-500 rounded-md bg-red-50 print:hidden">
      {message}
      {onClose && (
        <button onClick={onClose}>
          <FaTimes size={11} />
        </button>
      )}
    </div>
  );
}

export function ReportActions({ onPrint, onExportPdf, onExportCsv, disabled }) {
  const btn =
    "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 transition border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-40";
  return (
    <div className="flex items-center gap-2 print:hidden">
      {onExportCsv && (
        <button onClick={onExportCsv} disabled={disabled} className={btn}>
          <FaFileCsv size={11} /> CSV
        </button>
      )}
      {onExportPdf && (
        <button onClick={onExportPdf} disabled={disabled} className={btn}>
          <FaFilePdf size={11} /> PDF
        </button>
      )}
      {onPrint && (
        <button
          onClick={onPrint}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white transition rounded-md"
          style={{ background: GREEN }}
        >
          <FaPrint size={11} /> Print
        </button>
      )}
    </div>
  );
}

// Only visible when printing — gives every printout a title, period and timestamp
export function PrintHeader({ title, subtitle }) {
  return (
    <div className="hidden mb-3 print:block">
      <h2 className="text-base font-bold text-gray-800">{title}</h2>
      {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
      <p className="text-[10px] text-gray-400">Generated {new Date().toLocaleString("en-PH")}</p>
    </div>
  );
}

// ── Date range with presets ────────────────────────────────────────────────
export function PeriodBar({ from, to, onChange, label = "Period" }) {
  const presets = useMemo(() => datePresets(), []);
  const active = presets.find((p) => p.from === from && p.to === to)?.key;
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="date"
          value={from}
          max={to || undefined}
          onChange={(e) => onChange({ from: e.target.value, to })}
          className={`${inputCls} w-40`}
        />
        <span className="text-xs text-gray-400">to</span>
        <input
          type="date"
          value={to}
          min={from || undefined}
          onChange={(e) => onChange({ from, to: e.target.value })}
          className={`${inputCls} w-40`}
        />
        <div className="flex flex-wrap gap-1">
          {presets.map((p) => (
            <button
              key={p.key}
              onClick={() => onChange({ from: p.from, to: p.to })}
              className="px-2.5 py-1.5 text-[11px] font-medium border rounded-md transition"
              style={
                active === p.key
                  ? { background: GREEN, borderColor: GREEN, color: "#fff" }
                  : { borderColor: "#e5e7eb", color: "#6b7280", background: "#fff" }
              }
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Single-select client picker (null = all clients) ───────────────────────
export function ClientPicker({
  value,
  onChange,
  label = "Client",
  placeholder = "All clients",
  onlyApproved = false,
  className = "w-64",
}) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);

  const search = useCallback(
    async (t) => {
      setBusy(true);
      try {
        let q = supabase
          .from("client_profile")
          .select("id, client_id, business_name, trade_name, first_name, middle_name, last_name")
          .limit(8);
        if (onlyApproved) q = q.eq("approval_status", "approved");
        const s = t.trim().replace(/[%,()]/g, ""); // keep PostgREST filter syntax safe
        if (s) {
          q = q.or(
            `business_name.ilike.%${s}%,client_id.ilike.%${s}%,first_name.ilike.%${s}%,last_name.ilike.%${s}%,trade_name.ilike.%${s}%`,
          );
        } else {
          q = q.order("business_name", { ascending: true });
        }
        const { data, error } = await q;
        if (!error) setResults(data || []);
      } finally {
        setBusy(false);
      }
    },
    [onlyApproved],
  );

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => search(term), 250);
    return () => clearTimeout(t);
  }, [term, open, search]);

  useEffect(() => {
    const h = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const avatar = (
    <div className="flex items-center justify-center bg-blue-100 rounded-full w-7 h-7 shrink-0">
      <FaUser size={10} className="text-blue-500" />
    </div>
  );

  return (
    <div className={`relative ${className}`} ref={ref}>
      <label className={labelCls}>{label}</label>
      {value ? (
        <div className="flex items-center justify-between px-3 py-2 border border-gray-200 rounded-md bg-gray-50">
          <div className="flex items-center min-w-0 gap-2.5">
            {avatar}
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{clientDisplayName(value)}</p>
              <p className="font-mono text-[10px] text-gray-400">{value.client_id}</p>
            </div>
          </div>
          <button onClick={() => onChange(null)} className="text-gray-300 hover:text-gray-500 shrink-0" title="Back to all clients">
            <FaTimes size={12} />
          </button>
        </div>
      ) : (
        <>
          <div className="relative">
            <FaSearch className="absolute text-gray-300 -translate-y-1/2 left-3 top-1/2" size={12} />
            <input
              type="text"
              value={term}
              onChange={(e) => {
                setTerm(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              placeholder={placeholder}
              className={`${inputCls} pl-9 pr-8`}
            />
            {busy && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            )}
          </div>
          {open && results.length > 0 && (
            <div className="absolute left-0 right-0 z-30 mt-1 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg top-full max-h-56">
              {results.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    onChange(c);
                    setTerm("");
                    setOpen(false);
                  }}
                  className="flex items-center w-full gap-3 px-4 py-2.5 text-left transition border-b hover:bg-blue-50 border-gray-50 last:border-0"
                >
                  {avatar}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{clientDisplayName(c)}</p>
                    <p className="font-mono text-xs text-gray-400">{c.client_id}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}