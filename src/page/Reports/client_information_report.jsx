import React, { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "../../lib/supabaseClient";
import {
  FaSearch,
  FaTimes,
  FaPrint,
  FaSyncAlt,
  FaFileExcel,
  FaAddressBook,
  FaColumns,
  FaFilePdf,
  FaFilter,
  FaExchangeAlt,
  FaCheck,
} from "react-icons/fa";
import { exportTablePDF } from "../../utils/report_pdf";

const GREEN = "#1a5c2e";
const LIGHT_GREEN = "#e8f5ec";
const ACCOUNT_TABS = ["All", "Summit", "Horizon"];

const inputCls =
  "w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 bg-white transition";
const labelCls = "block text-xs font-medium text-gray-500 mb-1";
const btnGhost =
  "flex items-center justify-center gap-2 px-3.5 py-2 text-sm font-medium text-gray-600 transition bg-white border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50";

const SORT_OPTIONS = [
  { value: "business_name_asc", label: "Business Name A→Z" },
  { value: "business_name_desc", label: "Business Name Z→A" },
  { value: "client_id_desc", label: "Client ID (Newest)" },
  { value: "client_id_asc", label: "Client ID (Oldest)" },
  { value: "date_of_coverage_desc", label: "Coverage (Newest)" },
  { value: "date_of_coverage_asc", label: "Coverage (Oldest)" },
  { value: "date_of_expiration_asc", label: "Contract Expiring" },
];

// date: true => formatted as date
const ALL_COLS = [
  { key: "client_id", label: "Client ID", default: true },
  { key: "business_name", label: "Business Name", default: true },
  { key: "trade_name", label: "Trade Name", default: false },
  { key: "account", label: "Account", default: true },
  { key: "entity_type", label: "Entity Type", default: false },
  { key: "business_registration", label: "Business Registration", default: false },
  { key: "line_of_business", label: "Line of Business", default: true },
  { key: "tax_type", label: "Tax Type", default: true },
  { key: "tax_payer_classification", label: "Tax Classification", default: false },
  { key: "source_of_income", label: "Source of Income", default: false },
  { key: "tin", label: "TIN", default: true },
  { key: "rdo", label: "RDO", default: false },
  { key: "registered_business_address", label: "Registered Address", default: false },
  { key: "contact_person", label: "Contact Person", default: true },
  { key: "designation", label: "Designation", default: false },
  { key: "contact_number", label: "Contact No.", default: true },
  { key: "email_address", label: "Email", default: true },
  { key: "sss_employer_no", label: "SSS Employer No.", default: false },
  { key: "phic_employer_no", label: "PHIC Employer No.", default: false },
  { key: "hdmf_employer_no", label: "HDMF Employer No.", default: false },
  { key: "date_of_coverage", label: "Date of Coverage", default: false, date: true },
  { key: "approval_status", label: "Status", default: true },
];

// relative column widths for the PDF (default 1)
const PDF_W = {
  client_id: 1, business_name: 2.2, trade_name: 1.6, account: 0.9,
  entity_type: 1.2, business_registration: 1.4, line_of_business: 1.8,
  tax_type: 1, tax_payer_classification: 1.8, source_of_income: 1.4,
  tin: 1.3, rdo: 0.6, registered_business_address: 2.6, contact_person: 1.5,
  designation: 1.2, contact_number: 1.3, email_address: 2,
  sss_employer_no: 1.3, phic_employer_no: 1.3, hdmf_employer_no: 1.3,
  date_of_coverage: 1.2, approval_status: 1,
};

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const cellValue = (row, col) =>
  col.date ? fmtDate(row[col.key]) : row[col.key] || "—";

// "field_asc" / "field_desc" → sorted copy. Blank values always go to the bottom.
function sortClients(arr, val) {
  const parts = val.split("_");
  const dir = parts.pop();
  const field = parts.join("_");
  return [...arr].sort((a, b) => {
    const av = (a[field] || "").toString();
    const bv = (b[field] || "").toString();
    if (!av && !bv) return 0;
    if (!av) return 1;
    if (!bv) return -1;
    const cmp = av.localeCompare(bv, undefined, { numeric: field === "client_id" });
    return dir === "asc" ? cmp : -cmp;
  });
}

// bypass Supabase 1000-row limit
async function fetchAllClients() {
  const BATCH = 1000;
  let all = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("client_profile")
      .select("*")
      .order("id", { ascending: true })
      .range(from, from + BATCH - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < BATCH) break;
    from += BATCH;
  }
  return all;
}

// ─── HOVER SEARCH ─────────────────────────────────────────────────────────────
// Icon only. Hover it and the input slides out. Stays open while you're typing
// (focused) or while there's still text in the search box.
function HoverSearch({ value, onChange }) {
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const open = hover || focus || !!value;

  return (
    <div
      className="flex items-center"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <button type="button" title="Search" className={`${btnGhost} !px-3`}>
        <FaSearch size={13} />
      </button>
      <div
        className={`relative overflow-hidden transition-all duration-200 ${
          open ? "w-64 ml-2 opacity-100" : "w-0 ml-0 opacity-0"
        }`}
      >
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          placeholder="Name, ID, TIN, contact, email..."
          className={`${inputCls} pr-8`}
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute text-gray-400 -translate-y-1/2 right-3 top-1/2 hover:text-black"
          >
            <FaTimes size={11} />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── HOVER SORT (icon only → "Arrange by" menu fades in on hover) ────────────
function HoverSort({ value, onChange, options }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        title="Arrange by"
        onClick={() => setOpen(true)} // tap works on touch screens too
        className={`${btnGhost} !px-3 ${open ? "!bg-gray-50 !text-gray-900" : ""}`}
      >
        <FaExchangeAlt size={13} className="rotate-90" />
      </button>

      {/* Always mounted so it can fade/slide smoothly. pt-1 (not margin) = no hover gap */}
      <div
        className={`absolute left-0 z-30 w-56 pt-1 top-full transition-all duration-200 ease-out ${
          open ? "opacity-100 visible translate-y-0" : "opacity-0 invisible -translate-y-1"
        }`}
      >
        <div className="py-1 bg-white border border-gray-200 rounded-md shadow-lg">
          <p className="px-3.5 pt-1.5 pb-1 text-xs text-gray-400">Arrange by</p>
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
              className={`flex items-center justify-between w-full px-3.5 py-2 text-sm text-left transition hover:bg-gray-50 ${
                value === o.value ? "font-medium text-gray-900" : "text-gray-500"
              }`}
            >
              {o.label}
              {value === o.value && <FaCheck size={10} />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── HOVER FILTER (icon only → filter panel fades in on hover) ───────────────
// Stays open while any dropdown inside it is focused, so picking an option
// doesn't make the panel disappear.
function HoverFilter({ filters, activeCount, onClear }) {
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const open = hover || focus;

  return (
    <div
      className="relative"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setFocus(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setFocus(false);
      }}
    >
      <button
        type="button"
        title="Filters"
        className={`${btnGhost} relative !px-3 ${open ? "!bg-gray-50 !text-gray-900" : ""}`}
      >
        <FaFilter size={13} />
        {activeCount > 0 && (
          <span className="absolute flex items-center justify-center w-4 h-4 text-[10px] font-medium text-white bg-gray-900 rounded-full -top-1.5 -right-1.5">
            {activeCount}
          </span>
        )}
      </button>

      <div
        className={`absolute left-0 z-30 w-[min(92vw,460px)] pt-1 top-full transition-all duration-200 ease-out ${
          open ? "opacity-100 visible translate-y-0" : "opacity-0 invisible -translate-y-1"
        }`}
      >
        <div className="p-4 bg-white border border-gray-200 rounded-lg shadow-lg">
          <div className="grid grid-cols-2 gap-3">
            {filters.map((f) => (
              <div key={f.label}>
                <label className={labelCls}>{f.label}</label>
                <select
                  value={f.val}
                  onChange={(e) => f.set(e.target.value)}
                  className={inputCls}
                >
                  {f.opts.map((o) => (
                    <option key={o} value={o}>
                      {o === "all" ? "All" : o}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          {activeCount > 0 && (
            <div className="flex justify-end mt-3">
              <button
                type="button"
                onClick={onClear}
                className="text-xs font-medium text-gray-500 hover:text-black"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ClientInformationReport() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [account, setAccount] = useState("All");
  const [taxType, setTaxType] = useState("all");
  const [lob, setLob] = useState("all");
  const [status, setStatus] = useState("approved");
  const [sortVal, setSortVal] = useState("business_name_asc");
  const [showCols, setShowCols] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [cols, setCols] = useState(
    ALL_COLS.reduce((a, c) => ({ ...a, [c.key]: c.default }), {}),
  );

  // SheetJS for Excel export
  useEffect(() => {
    const src =
      "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    if (document.querySelector(`script[src="${src}"]`)) return;
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    document.head.appendChild(s);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setClients(await fetchAllClients());
    } catch (err) {
      setError(err.message || "Failed to load clients.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const uniq = (field) => [
    "all",
    ...new Set(clients.map((c) => c[field]).filter(Boolean)),
  ];

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    const list = clients.filter((c) => {
      if (account !== "All" && c.account !== account) return false;
      if (taxType !== "all" && c.tax_type !== taxType) return false;
      if (lob !== "all" && c.line_of_business !== lob) return false;
      if (status !== "all" && c.approval_status !== status) return false;
      if (t) {
        return [
          "business_name",
          "trade_name",
          "client_id",
          "tin",
          "contact_person",
          "email_address",
        ].some((k) => (c[k] || "").toLowerCase().includes(t));
      }
      return true;
    });
    return sortClients(list, sortVal);
  }, [clients, search, account, taxType, lob, status, sortVal]);

  const activeCols = ALL_COLS.filter((c) => cols[c.key]);

  // Filters inside the hover panel (Status stays visible next to Account)
  const activeFilterCount = [taxType, lob].filter((v) => v !== "all").length;
  const hasFilters =
    search ||
    account !== "All" ||
    taxType !== "all" ||
    lob !== "all" ||
    status !== "approved";

  const filterDefs = [
    { label: "Tax Type", val: taxType, set: setTaxType, opts: uniq("tax_type") },
    { label: "Line of Business", val: lob, set: setLob, opts: uniq("line_of_business") },
  ];

  const clearPanelFilters = () => {
    setTaxType("all");
    setLob("all");
  };

  const clearFilters = () => {
    setSearch("");
    setAccount("All");
    setTaxType("all");
    setLob("all");
    setStatus("approved");
  };

  const exportExcel = () => {
    const XLSX = window.XLSX;
    if (!XLSX) {
      alert("SheetJS not loaded yet, please try again in a moment.");
      return;
    }
    const aoa = [
      ["#", ...activeCols.map((c) => c.label)],
      ...filtered.map((r, i) => [
        i + 1,
        ...activeCols.map((c) => (c.date ? fmtDate(r[c.key]) : r[c.key] || "")),
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [{ wch: 5 }, ...activeCols.map((c) => ({ wch: Math.max(c.label.length + 6, 16) }))];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Client Information");
    XLSX.writeFile(
      wb,
      `client_information_report_${new Date().toISOString().split("T")[0]}.xlsx`,
    );
  };

  const exportPDF = async () => {
    setPdfBusy(true);
    try {
      const pdfCols = activeCols.filter((c) => c.key !== "approval_status");
      const filterDesc =
        [
          account !== "All" ? `Account: ${account}` : "",
          taxType !== "all" ? `Tax: ${taxType}` : "",
          lob !== "all" ? `LOB: ${lob}` : "",
          search ? `"${search}"` : "",
        ]
          .filter(Boolean)
          .join("  |  ") || "All Clients";
      await exportTablePDF({
        title: "Client Information Report",
        subtitle: filterDesc,
        cols: pdfCols.map((c) => ({ label: c.label, w: PDF_W[c.key] || 1 })),
        groups: [
          {
            label: null,
            rows: filtered.map((r) => pdfCols.map((c) => cellValue(r, c))),
          },
        ],
        format: pdfCols.length > 10 ? "legal" : "a4",
        fileName: `client_information_report_${new Date().toISOString().split("T")[0]}.pdf`,
      });
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-white border-b border-gray-100 print:hidden">
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center rounded-full w-9 h-9"
            style={{ background: LIGHT_GREEN }}
          >
            <FaAddressBook size={14} style={{ color: GREEN }} />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-gray-800">
              Client Information Report
            </h1>
            <p className="text-xs text-gray-400">
              List of client information — {filtered.length} record
              {filtered.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-gray-600 transition border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            <FaSyncAlt size={11} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
          <button
            onClick={exportExcel}
            disabled={loading || filtered.length === 0}
            className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-white transition rounded-md bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40"
          >
            <FaFileExcel size={11} /> Excel
          </button>
          <button
            onClick={exportPDF}
            disabled={loading || pdfBusy || filtered.length === 0}
            className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-white transition bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-40"
          >
            <FaFilePdf size={11} /> {pdfBusy ? "Generating..." : "PDF"}
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-white transition rounded-md"
            style={{ background: GREEN }}
          >
            <FaPrint size={11} /> Print
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center justify-between px-4 py-2.5 mx-6 mt-4 text-sm text-red-700 border-l-4 border-red-500 rounded-md bg-red-50 print:hidden">
          {error}
          <button onClick={() => setError("")}>
            <FaTimes size={11} />
          </button>
        </div>
      )}

      <div className="p-6 space-y-5">
        {/* Print-only header */}
        <div className="hidden print:block">
          <h1 className="text-lg font-bold">Client Information Report</h1>
          <p className="text-xs text-gray-500">
            Generated {new Date().toLocaleString("en-PH")} · {filtered.length} records
          </p>
        </div>

        {/* Toolbar: search · arrange by · filters (icons, reveal on hover) · account · status · columns */}
        <div className="space-y-3 print:hidden">
          <div className="flex flex-wrap items-center gap-3">
            <HoverSearch value={search} onChange={setSearch} />
            <HoverSort value={sortVal} onChange={setSortVal} options={SORT_OPTIONS} />
            <HoverFilter
              filters={filterDefs}
              activeCount={activeFilterCount}
              onClear={clearPanelFilters}
            />

            <select
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              className={`${inputCls} !w-auto`}
            >
              {ACCOUNT_TABS.map((a) => (
                <option key={a} value={a}>
                  {a === "All" ? "All Accounts" : a}
                </option>
              ))}
            </select>

            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              title="Status"
              className={`${inputCls} !w-auto capitalize`}
            >
              {uniq("approval_status").map((o) => (
                <option key={o} value={o}>
                  {o === "all" ? "All Status" : o}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setShowCols((s) => !s)}
              className={`${btnGhost} ${showCols ? "!bg-gray-50 !text-gray-900" : ""}`}
            >
              <FaColumns size={12} /> Columns ({activeCols.length})
            </button>

            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-gray-700"
              >
                <FaTimes size={10} /> Clear all
              </button>
            )}
          </div>

          {showCols && (
            <div className="p-4 bg-white border border-gray-100 rounded-xl">
              <div className="grid grid-cols-2 gap-1.5 md:grid-cols-4">
                {ALL_COLS.map((c) => (
                  <label
                    key={c.key}
                    className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium border rounded-md cursor-pointer transition ${
                      cols[c.key]
                        ? "border-green-300 bg-green-50 text-green-800"
                        : "border-gray-200 text-gray-500"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={cols[c.key]}
                      onChange={(e) =>
                        setCols((p) => ({ ...p, [c.key]: e.target.checked }))
                      }
                    />
                    {c.label}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="overflow-hidden bg-white border border-gray-100 rounded-xl">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16">
              <div className="w-5 h-5 border-2 border-green-600 rounded-full border-t-transparent animate-spin" />
              <p className="text-xs text-gray-400">Loading clients...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm text-gray-400">No clients match your filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-gray-500 bg-gray-50">
                  <tr>
                    <th className="px-3 py-2.5 text-left font-semibold">#</th>
                    {activeCols.map((c) => (
                      <th key={c.key} className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((r, i) => (
                    <tr key={r.id} className="transition hover:bg-gray-50/60">
                      <td className="px-3 py-2 text-gray-300">{i + 1}</td>
                      {activeCols.map((c) => (
                        <td
                          key={c.key}
                          className={`px-3 py-2 text-gray-700 ${
                            ["client_id", "tin"].includes(c.key) ? "font-mono" : ""
                          } ${c.key === "business_name" ? "font-medium" : ""}`}
                        >
                          {cellValue(r, c)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}