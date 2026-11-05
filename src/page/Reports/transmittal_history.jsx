import React, { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "../../lib/supabaseClient";
import { FaSearch, FaSync, FaEye, FaPrint, FaFilePdf, FaTimes, FaCopy } from "react-icons/fa";
import {
  longDate,
  loadScript,
  toDataURL,
  drawCopy,
  Sheet,
  CSS,
  JSPDF_SRC,
  AUTOTABLE_SRC,
  LOGO_SRC,
} from "./document_management_transmittal_report";

const GREEN = "#1a5c2e";
const PAGE_SIZES = [10, 20, 50];

const inputCls =
  "px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 bg-white";
const labelCls = "block text-xs font-medium text-gray-500 mb-1";

const ACTION_LABEL = {
  saved: { label: "Saved", cls: "bg-blue-100 text-blue-700" },
  updated: { label: "Updated", cls: "bg-amber-100 text-amber-700" },
  printed: { label: "Printed", cls: "bg-green-100 text-green-700" },
  pdf: { label: "PDF exported", cls: "bg-red-100 text-red-600" },
};

const fmtDateTime = (iso) =>
  iso
    ? new Date(iso).toLocaleString("en-PH", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "—";

const countOf = (logs, action) => (logs || []).filter((l) => l.action === action).length;

// DB record -> data na tanggap ng <Sheet /> at drawCopy()
const toSheetData = (t) => ({
  tfNo: t.tf_no,
  client: t.client_name || "",
  attn: t.attn || "",
  re: t.re || "",
  dateLabel: longDate(t.tf_date),
  preparedBy: t.prepared_by || "",
  rows: Array.isArray(t.rows) ? t.rows : [],
});

export default function TransmittalHistory() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [selected, setSelected] = useState(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debounced, dateFrom, dateTo, pageSize]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      let q = supabase
        .from("transmittals")
        .select("*, transmittal_logs(id, action, performed_at)", { count: "exact" })
        .order("created_at", { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (debounced) {
        const t = debounced.replace(/[,()]/g, " ");
        q = q.or(`client_name.ilike.%${t}%,tf_no.ilike.%${t}%,re.ilike.%${t}%,attn.ilike.%${t}%`);
      }
      if (dateFrom) q = q.gte("tf_date", dateFrom);
      if (dateTo) q = q.lte("tf_date", dateTo);

      const { data, error: err, count } = await q;
      if (err) throw err;
      setItems(data || []);
      setTotal(count || 0);

      // keep the open modal in sync (logs count, etc.)
      setSelected((cur) => (cur ? (data || []).find((r) => r.id === cur.id) || cur : cur));
    } catch (e) {
      setError(e.message || "Failed to load transmittals.");
    }
    setLoading(false);
  }, [page, pageSize, debounced, dateFrom, dateTo]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);

  const sheetD = useMemo(() => (selected ? toSheetData(selected) : null), [selected]);

  const sortedLogs = useMemo(
    () =>
      selected
        ? [...(selected.transmittal_logs || [])].sort((a, b) =>
            (b.performed_at || "").localeCompare(a.performed_at || "")
          )
        : [],
    [selected]
  );

  const logAction = async (id, action) => {
    const { error: err } = await supabase
      .from("transmittal_logs")
      .insert({ transmittal_id: id, action });
    if (err) console.error("log failed:", err);
  };

  // Reprint: gumagamit ng #tf-print sa ibaba (nirender mula sa selected)
  const reprint = async () => {
    if (!selected) return;
    await logAction(selected.id, "printed");
    window.print();
    load();
  };

  const reexport = async () => {
    if (!selected) return;
    setPdfBusy(true);
    setError("");
    try {
      await loadScript(JSPDF_SRC);
      await loadScript(AUTOTABLE_SRC);
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const logo = await toDataURL(LOGO_SRC);
      const d = toSheetData(selected);

      drawCopy(doc, 8, d, logo);
      doc.setDrawColor(120, 120, 120);
      doc.setLineWidth(0.2);
      doc.setLineDash([2, 2], 0);
      doc.line(8, 148.5, 202, 148.5);
      doc.setLineDash([], 0);
      drawCopy(doc, 151, d, logo);

      const slug = d.client.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "").slice(0, 40);
      doc.save(`${selected.tf_no}_${slug}_${selected.tf_date || ""}.pdf`);
      await logAction(selected.id, "pdf");
      load();
    } catch (e) {
      console.error(e);
      setError("Failed to generate PDF. Check your internet connection and try again.");
    }
    setPdfBusy(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 print:bg-white print:min-h-0">
      <style>{CSS}</style>

      {/* TOP BAR */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-3.5 bg-white border-b border-gray-200 print:hidden">
        <div>
          <h1 className="text-base font-semibold text-gray-800">Transmittal Records</h1>
          <p className="text-xs text-gray-400 mt-0.5">
                       All saved transmittals. Click a row to view the form and its history.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-gray-600 transition border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50"
        >
          <FaSync size={11} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      <div className="px-6 py-6 space-y-5 print:hidden">
        {/* FILTERS */}
        <div className="flex flex-wrap items-end gap-5 p-5 bg-white border border-gray-200 rounded-lg">
          <div className="relative w-72">
            <label className={labelCls}>Search</label>
            <FaSearch className="absolute text-gray-300 left-3 bottom-3" size={12} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Client, TF No., Re, Attn..."
              className={`${inputCls} w-full pl-9`}
            />
          </div>
          <div>
            <label className={labelCls}>Date from</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Date to</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={inputCls} />
          </div>
          {(search || dateFrom || dateTo) && (
            <button
              onClick={() => { setSearch(""); setDateFrom(""); setDateTo(""); }}
              className="px-3 py-2 text-sm text-gray-500 hover:text-gray-800"
            >
              Clear filters
            </button>
          )}
        </div>

        {error && (
          <div className="px-4 py-3 text-sm text-red-700 border-l-4 border-red-500 rounded-md bg-red-50">
            {error}
          </div>
        )}

        {/* LIST */}
        <div className="overflow-hidden bg-white border border-gray-200 rounded-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-[11px] font-semibold text-gray-400">
                  <th className="px-4 py-2.5 text-left">TF No.</th>
                  <th className="px-4 py-2.5 text-left">Date</th>
                  <th className="px-4 py-2.5 text-left">Client</th>
                  <th className="px-4 py-2.5 text-left">Re</th>
                  <th className="px-4 py-2.5 text-right">Docs</th>
                  <th className="px-4 py-2.5 text-right">Printed</th>
                  <th className="px-4 py-2.5 text-right">PDF</th>
                  <th className="px-4 py-2.5 text-left">Last activity</th>
                  <th className="w-12" />
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-gray-400">Loading...</td>
                  </tr>
                )}
                {!loading && items.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-gray-400">
                                            No transmittals found.
                    </td>
                  </tr>
                )}
                {!loading &&
                  items.map((t) => {
                    const logs = t.transmittal_logs || [];
                    const last = logs.reduce(
                      (m, l) => ((l.performed_at || "") > m ? l.performed_at : m),
                      t.created_at || ""
                    );
                    return (
                      <tr
                        key={t.id}
                        onClick={() => setSelected(t)}
                        className="transition border-t border-gray-100 cursor-pointer hover:bg-gray-50"
                      >
                        <td className="px-4 py-2.5 font-mono font-semibold" style={{ color: GREEN }}>
                          {t.tf_no}
                        </td>
                        <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{longDate(t.tf_date) || "—"}</td>
                        <td className="px-4 py-2.5 font-medium text-gray-800">{t.client_name}</td>
                        <td className="px-4 py-2.5 text-gray-500 max-w-[260px] truncate">{t.re || "—"}</td>
                        <td className="px-4 py-2.5 text-right text-gray-600">
                          {Array.isArray(t.rows) ? t.rows.length : 0}
                        </td>
                        <td className="px-4 py-2.5 text-right text-gray-600">{countOf(logs, "printed")}</td>
                        <td className="px-4 py-2.5 text-right text-gray-600">{countOf(logs, "pdf")}</td>
                        <td className="px-4 py-2.5 text-xs text-gray-400 whitespace-nowrap">{fmtDateTime(last)}</td>
                        <td className="px-2 py-2.5 text-right">
                          <FaEye size={12} className="text-gray-300" />
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          {total > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-t border-gray-100">
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">
                  {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, total)} of {total}
                </span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="px-2 py-1 text-xs border border-gray-200 rounded-md"
                >
                  {PAGE_SIZES.map((n) => (
                    <option key={n} value={n}>{n} / page</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPage(1)}
                  disabled={safePage === 1}
                  className="px-2.5 py-1 text-xs border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                >First</button>
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                  className="px-2.5 py-1 text-xs border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                >Prev</button>
                <span className="px-2 text-xs text-gray-500">{safePage} / {totalPages}</span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                  className="px-2.5 py-1 text-xs border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                >Next</button>
                <button
                  onClick={() => setPage(totalPages)}
                  disabled={safePage === totalPages}
                  className="px-2.5 py-1 text-xs border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                >Last</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* VIEW MODAL: same layout as the Preview */}
      {selected && sheetD && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center p-6 overflow-y-auto bg-black/50 print:hidden"
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-5xl p-4 bg-white rounded-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <p className="font-mono text-sm font-semibold" style={{ color: GREEN }}>
                {selected.tf_no}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={reexport}
                  disabled={pdfBusy}
                  className="flex items-center gap-2 h-9 px-4 text-sm font-medium text-red-600 transition bg-white border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-40"
                >
                  <FaFilePdf size={12} /> {pdfBusy ? "Generating..." : "Re-export PDF"}
                </button>
                <button
                  onClick={reprint}
                  className="flex items-center gap-2 h-9 px-4 text-sm font-medium text-white transition rounded-lg hover:opacity-90"
                  style={{ background: GREEN }}
                >
                  <FaPrint size={12} /> Reprint
                </button>
                <button
                  onClick={() => setSelected(null)}
                  className="p-2 text-gray-400 hover:text-gray-700"
                >
                  <FaTimes size={14} />
                </button>
              </div>
            </div>

            <Sheet d={sheetD} />

            {/* Activity log */}
            <div className="mt-5">
              <p className="mb-2 text-xs font-semibold tracking-wide text-gray-400 uppercase">
                Activity ({sortedLogs.length})
              </p>
              <div className="overflow-hidden border border-gray-100 rounded-lg">
                {sortedLogs.length === 0 && (
                                   <p className="px-4 py-3 text-sm text-gray-400">No activity yet.</p>
                )}
                {sortedLogs.map((l) => {
                  const a = ACTION_LABEL[l.action] || { label: l.action, cls: "bg-gray-100 text-gray-600" };
                  return (
                    <div
                      key={l.id}
                      className="flex items-center justify-between px-4 py-2 text-sm border-b border-gray-50 last:border-0"
                    >
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${a.cls}`}>
                        {a.label}
                      </span>
                      <span className="text-xs text-gray-500">{fmtDateTime(l.performed_at)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PRINT-ONLY: 2 copies on one A4 (for Reprint) */}
      {sheetD && (
        <div id="tf-print">
          <div className="tf-page-copy"><Sheet d={sheetD} /></div>
          <div className="tf-cut" />
          <div className="tf-page-copy"><Sheet d={sheetD} /></div>
        </div>
      )}
    </div>
  );
}