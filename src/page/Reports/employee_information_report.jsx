import React, { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "../../lib/supabaseClient";
import {
  FaSearch,
  FaTimes,
  FaPrint,
  FaSyncAlt,
  FaFileExcel,
  FaUsers,
  FaFilePdf,
  FaFilter,
  FaExchangeAlt,
  FaCheck,
} from "react-icons/fa";
import { exportTablePDF } from "../../utils/report_pdf";

const GREEN = "#1a5c2e";
const LIGHT_GREEN = "#e8f5ec";

const inputCls =
  "w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 bg-white transition";
const labelCls = "block text-xs font-medium text-gray-500 mb-1";
const btnGhost =
  "flex items-center justify-center gap-2 px-3.5 py-2 text-sm font-medium text-gray-600 transition bg-white border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50";

// Sorting applies to the employees inside each client group
const SORT_OPTIONS = [
  { value: "last_name_asc", label: "Name A→Z" },
  { value: "last_name_desc", label: "Name Z→A" },
  { value: "emp_code_asc", label: "Emp Code (Low→High)" },
  { value: "emp_code_desc", label: "Emp Code (High→Low)" },
  { value: "position_asc", label: "Position A→Z" },
  { value: "start_of_employment_desc", label: "Start of Employment (Newest)" },
  { value: "start_of_employment_asc", label: "Start of Employment (Oldest)" },
];

const COLS = [
  { key: "emp_code", label: "Emp Code", mono: true },
  { key: "emp_name", label: "Full Name" },
  { key: "position", label: "Position" },
  { key: "status", label: "Status" },
  { key: "date_of_birth", label: "Date of Birth", date: true },
  { key: "start_of_employment", label: "Start of Employment", date: true },
  { key: "start_of_contribution", label: "Start of Contribution", date: true },
  { key: "tin", label: "TIN", mono: true },
  { key: "sss_emp_no", label: "SSS No.", mono: true },
  { key: "phic_emp_no", label: "PHIC No.", mono: true },
  { key: "hdmf_emp_no", label: "HDMF No.", mono: true },
  { key: "remarks", label: "Remarks" },
];

// relative column widths for the PDF (default 1)
const PDF_W = {
  emp_code: 1, emp_name: 2.4, position: 1.6, status: 0.8,
  date_of_birth: 1.2, start_of_employment: 1.3, start_of_contribution: 1.3,
  tin: 1.4, sss_emp_no: 1.4, phic_emp_no: 1.5, hdmf_emp_no: 1.4, remarks: 1.8,
};

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const clientName = (c) =>
  c.business_name ||
  [c.first_name, c.middle_name, c.last_name].filter(Boolean).join(" ") ||
  c.client_id;

const composeEmpName = (f) => {
  const last = [f.last_name, f.suffix].filter(Boolean).join(" ");
  const first = [f.first_name, f.middle_name].filter(Boolean).join(" ");
  return [last, first].filter(Boolean).join(", ");
};

const empCell = (e, c) => {
  if (c.key === "emp_name") return e.emp_name || composeEmpName(e) || "—";
  if (c.date) return fmtDate(e[c.key]);
  return e[c.key] || "—";
};

// "field_asc" / "field_desc" → sorted copy. Blank values always go to the bottom.
function sortEmployees(arr, val) {
  const parts = val.split("_");
  const dir = parts.pop();
  const field = parts.join("_");
  return [...arr].sort((a, b) => {
    const av = (a[field] || "").toString();
    const bv = (b[field] || "").toString();
    if (!av && !bv) return 0;
    if (!av) return 1;
    if (!bv) return -1;
    const cmp = av.localeCompare(bv, undefined, { numeric: field === "emp_code" });
    return dir === "asc" ? cmp : -cmp;
  });
}

// bypass Supabase 1000-row limit
async function fetchAllEmployees() {
  const BATCH = 1000;
  let all = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("employee_profile")
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
          placeholder="Name, position, code, TIN..."
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
        className={`absolute left-0 z-30 w-64 pt-1 top-full transition-all duration-200 ease-out ${
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
        className={`absolute left-0 z-30 w-[min(92vw,260px)] pt-1 top-full transition-all duration-200 ease-out ${
          open ? "opacity-100 visible translate-y-0" : "opacity-0 invisible -translate-y-1"
        }`}
      >
        <div className="p-4 bg-white border border-gray-200 rounded-lg shadow-lg">
          <div className="grid grid-cols-1 gap-3">
            {filters.map((f) => (
              <div key={f.label}>
                <label className={labelCls}>{f.label}</label>
                <select
                  value={f.val}
                  onChange={(e) => f.set(e.target.value)}
                  className={inputCls}
                >
                  {f.opts.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
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

export default function EmployeeInformationReport() {
  const [clients, setClients] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [clientFilter, setClientFilter] = useState("all"); // client_id or "all"
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [sortVal, setSortVal] = useState("last_name_asc");
  const [pdfBusy, setPdfBusy] = useState(false);

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
      const [{ data: cl, error: cErr }, emps] = await Promise.all([
        supabase
          .from("client_profile")
          .select(
            "id, client_id, business_name, trade_name, first_name, middle_name, last_name, tin, account, approval_status",
          )
          .eq("approval_status", "approved")
          .order("business_name", { ascending: true }),
        fetchAllEmployees(),
      ]);
      if (cErr) throw cErr;
      setClients(cl || []);
      setEmployees(emps);
    } catch (err) {
      setError(err.message || "Failed to load report.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // groups: [{ client, rows }]
  const groups = useMemo(() => {
    const t = search.trim().toLowerCase();
    const matches = (e) => {
      if (status !== "all" && (e.status || "Active") !== status) return false;
      if (!t) return true;
      return [e.emp_name, e.last_name, e.first_name, e.position, e.emp_code, e.tin]
        .some((v) => (v || "").toLowerCase().includes(t));
    };
    const byClient = {};
    employees.forEach((e) => {
      if (clientFilter !== "all" && e.client_id !== clientFilter) return;
      if (!matches(e)) return;
      (byClient[e.client_id] ||= []).push(e);
    });
    return clients
      .filter((c) => byClient[c.client_id])
      .map((c) => ({
        client: c,
        rows: sortEmployees(byClient[c.client_id], sortVal),
      }));
  }, [clients, employees, clientFilter, search, status, sortVal]);

  const totalEmployees = groups.reduce((s, g) => s + g.rows.length, 0);
  const selectedClient = clients.find((c) => c.client_id === clientFilter);

  const activeFilterCount = status !== "all" ? 1 : 0;
  const hasFilters = clientFilter !== "all" || search || status !== "all";

  const filterDefs = [
    {
      label: "Status",
      val: status,
      set: setStatus,
      opts: [
        { value: "all", label: "All" },
        { value: "Active", label: "Active" },
        { value: "Inactive", label: "Inactive" },
      ],
    },
  ];

  const clearPanelFilters = () => setStatus("all");

  const clearFilters = () => {
    setClientFilter("all");
    setSearch("");
    setStatus("all");
  };

  const exportExcel = () => {
    const XLSX = window.XLSX;
    if (!XLSX) {
      alert("SheetJS not loaded yet, please try again in a moment.");
      return;
    }
    const aoa = [["Client ID", "Client", ...COLS.map((c) => c.label)]];
    groups.forEach(({ client, rows }) =>
      rows.forEach((e) =>
        aoa.push([
          client.client_id,
          clientName(client),
          ...COLS.map((c) =>
            c.key === "emp_name"
              ? e.emp_name || composeEmpName(e)
              : c.date
              ? fmtDate(e[c.key])
              : e[c.key] || "",
          ),
        ]),
      ),
    );
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = aoa[0].map((h) => ({ wch: Math.max(String(h).length + 6, 16) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Employee Information");
    XLSX.writeFile(
      wb,
      `employee_information_report_${new Date().toISOString().split("T")[0]}.xlsx`,
    );
  };

  const exportPDF = async () => {
    setPdfBusy(true);
    try {
      const pdfCols = COLS.filter((c) => c.key !== "status");
      const subtitle = [
        selectedClient
          ? `${clientName(selectedClient)} (${selectedClient.client_id})`
          : "All Clients",
        search ? `"${search}"` : "",
      ]
        .filter(Boolean)
        .join("  |  ");
      await exportTablePDF({
        title: "Employee Information Report",
        subtitle,
        cols: pdfCols.map((c) => ({ label: c.label, w: PDF_W[c.key] || 1 })),
        groups: groups.map(({ client, rows }) => ({
          label: clientName(client),
          sublabel: `${client.client_id}${client.tin ? `  |  TIN ${client.tin}` : ""}`,
          countLabel: `${rows.length} employee${rows.length === 1 ? "" : "s"}`,
          rows: rows.map((e) => pdfCols.map((c) => empCell(e, c))),
        })),
        fileName: `employee_information_report_${new Date().toISOString().split("T")[0]}.pdf`,
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
            <FaUsers size={14} style={{ color: GREEN }} />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-gray-800">
              Employee Information Report
            </h1>
            <p className="text-xs text-gray-400">
              Employees per client — {totalEmployees} employee
              {totalEmployees === 1 ? "" : "s"} across {groups.length} client
              {groups.length === 1 ? "" : "s"}
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
            disabled={loading || totalEmployees === 0}
            className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-white transition rounded-md bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40"
          >
            <FaFileExcel size={11} /> Excel
          </button>
          <button
            onClick={exportPDF}
            disabled={loading || pdfBusy || totalEmployees === 0}
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
          <h1 className="text-lg font-bold">Employee Information Report</h1>
          <p className="text-xs text-gray-500">
            {selectedClient
              ? `${clientName(selectedClient)} (${selectedClient.client_id})`
              : "All Clients"}{" "}
            · Generated {new Date().toLocaleString("en-PH")}
          </p>
        </div>

        {/* Toolbar: search · arrange by · filters (icons, reveal on hover) · client */}
        <div className="flex flex-wrap items-center gap-3 print:hidden">
          <HoverSearch value={search} onChange={setSearch} />
          <HoverSort value={sortVal} onChange={setSortVal} options={SORT_OPTIONS} />
          <HoverFilter
            filters={filterDefs}
            activeCount={activeFilterCount}
            onClear={clearPanelFilters}
          />

          <select
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            className={`${inputCls} !w-auto max-w-xs`}
          >
            <option value="all">All Clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.client_id}>
                {clientName(c)} ({c.client_id})
              </option>
            ))}
          </select>

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

        {/* Groups */}
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 bg-white border border-gray-100 rounded-xl">
            <div className="w-5 h-5 border-2 border-green-600 rounded-full border-t-transparent animate-spin" />
            <p className="text-xs text-gray-400">Loading employees...</p>
          </div>
        ) : groups.length === 0 ? (
          <div className="py-16 text-center bg-white border border-gray-100 rounded-xl">
            <p className="text-sm text-gray-400">
              {employees.length === 0
                ? "No employees recorded yet."
                : "No employees match your filters."}
            </p>
          </div>
        ) : (
          groups.map(({ client, rows }) => (
            <div
              key={client.client_id}
              className="overflow-hidden bg-white border border-gray-100 rounded-xl break-inside-avoid-page"
            >
              <div
                className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100"
                style={{ background: LIGHT_GREEN }}
              >
                <div>
                  <p className="text-sm font-semibold" style={{ color: GREEN }}>
                    {clientName(client)}
                  </p>
                  <p className="font-mono text-[11px] text-gray-500">
                    {client.client_id}
                    {client.tin ? ` · TIN ${client.tin}` : ""}
                  </p>
                </div>
                <span className="text-xs font-semibold" style={{ color: GREEN }}>
                  {rows.length} employee{rows.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-gray-500 bg-gray-50">
                    <tr>
                      <th className="px-3 py-2.5 text-left font-semibold">#</th>
                      {COLS.map((c) => (
                        <th key={c.key} className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {rows.map((e, i) => (
                      <tr key={e.id} className="transition hover:bg-gray-50/60">
                        <td className="px-3 py-2 text-gray-300">{i + 1}</td>
                        {COLS.map((c) => (
                          <td
                            key={c.key}
                            className={`px-3 py-2 text-gray-700 whitespace-nowrap ${
                              c.mono ? "font-mono" : ""
                            } ${c.key === "emp_name" ? "font-medium" : ""}`}
                          >
                            {empCell(e, c)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}