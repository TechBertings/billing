import React, { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../../lib/supabaseClient";
import {
  FaPlus,
  FaEdit,
  FaTrash,
  FaTimes,
  FaCheck,
  FaSearch,
  FaSort,
  FaSortUp,
  FaSortDown,
  FaFilePdf,
  FaFileImport,
  FaFileExport,
  FaChevronDown,
  FaPrint,
  FaDownload,
} from "react-icons/fa";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

// ─── Styles ──────────────────────────────────────────────────────────────────
const inputCls =
  "w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-200 transition bg-white";
const selectCls =
  "w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 transition bg-white cursor-pointer";

const COMPANY = "Fortiserv Business Management Enterprise Co.";


// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmtDate = () =>
  new Date().toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

const fmtDateShort = () =>
  new Date().toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });

// ─── Export CSV ───────────────────────────────────────────────────────────────
const exportCSV = (accounts) => {
  const headers = ["Code", "Government Agency", "Account Name", "Status"];
  const rows = accounts.map((a) => [
    a.code || "",
    a.government_agencies?.name || "",
    a.account_name || "",
    a.is_active ? "Active" : "Inactive",
  ]);
  const csv = [headers, ...rows]
    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `chart_of_accounts_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

// ─── PDF Dropdown ─────────────────────────────────────────────────────────────
function PdfDropdown({ onPrint, onExportPdf }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();

  useEffect(() => {
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition select-none"
      >
        <FaFilePdf size={11} className="text-gray-400" />
        PDF
        <FaChevronDown
          size={8}
          className={`text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-1.5 w-44 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          <button
            onClick={() => {
              setOpen(false);
              onPrint();
            }}
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-gray-700 hover:bg-gray-50 transition"
          >
            <FaPrint size={11} className="text-gray-400" />
            Print
          </button>
          <div className="mx-3 border-t border-gray-100" />
          <button
            onClick={() => {
              setOpen(false);
              onExportPdf();
            }}
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-gray-700 hover:bg-gray-50 transition"
          >
            <FaDownload size={11} className="text-gray-400" />
            Export as PDF
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ChartOfAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [agencies, setAgencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("All");
  const [sortField, setSortField] = useState("code");
  const [sortDir, setSortDir] = useState("asc");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [importing, setImporting] = useState(false);
  const [hoveredId, setHoveredId] = useState(null);
  const importRef = useRef();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const emptyForm = {
    code: "",
    agency_id: "",
    account_name: "",
    is_active: true,
  };
  const [form, setForm] = useState(emptyForm);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchAgencies = useCallback(async () => {
    const { data } = await supabase
      .from("government_agencies")
      .select("*")
      .eq("is_active", true)
      .order("name");
    setAgencies(data || []);
  }, []);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("chart_of_accounts")
      .select("*, government_agencies(id, name)")
      .order("code", { ascending: true, nullsFirst: false });
    if (error) flash(`Error: ${error.message}`, "error");
    else setAccounts(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAgencies();
    fetchAccounts();
  }, [fetchAgencies, fetchAccounts]);

  useEffect(() => {
  setCurrentPage(1);
}, [search, activeTab, pageSize]);

  // ── Filter + Sort ──────────────────────────────────────────────────────────
  const filtered = accounts.filter((a) => {
    const ag = a.government_agencies?.name || "";
    const matchTab = activeTab === "All" || ag === activeTab;
    const q = search.toLowerCase();
    return (
      matchTab &&
      (!q ||
        [a.code, a.account_name, ag].some((v) =>
          (v || "").toLowerCase().includes(q),
        ))
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    const av = (a[sortField] || "").toString().toLowerCase();
    const bv = (b[sortField] || "").toString().toLowerCase();
    const cmp = av.localeCompare(bv, undefined, {
      numeric: sortField === "code",
    });
    return sortDir === "asc" ? cmp : -cmp;
  });


  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paginated = sorted.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
    );
    
  const handleSort = (field) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field)
      return <FaSort size={9} className="ml-1 text-gray-300" />;
    return sortDir === "asc" ? (
      <FaSortUp size={9} className="ml-1 text-gray-500" />
    ) : (
      <FaSortDown size={9} className="ml-1 text-gray-500" />
    );
  };

  // ── Selection ──────────────────────────────────────────────────────────────
const allChecked = paginated.length > 0 && paginated.every((a) => selected.has(a.id));
const toggleAll = () =>
  allChecked
    ? setSelected((p) => { const n = new Set(p); paginated.forEach((a) => n.delete(a.id)); return n; })
    : setSelected((p) => new Set([...p, ...paginated.map((a) => a.id)]));
  const toggleOne = (id) =>
    setSelected((p) => {
      const n = new Set(p);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  // ── Flash ──────────────────────────────────────────────────────────────────
  const flash = (msg, type = "success") => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => setMessage(""), 3500);
  };

  // ── CRUD ───────────────────────────────────────────────────────────────────
  const openAdd = () => {
    setEditing(null);
    setForm({ ...emptyForm, agency_id: agencies[0]?.id || "" });
    setShowModal(true);
  };
  const openEdit = (a) => {
    setEditing(a);
    setForm({
      code: a.code || "",
      agency_id: a.agency_id || a.government_agencies?.id || "",
      account_name: a.account_name || "",
      is_active: a.is_active,
    });
    setShowModal(true);
  };

const handleSave = async () => {
  if (!form.name.trim()) { flash('Agency name is required.', 'error'); return; }
  setSaving(true);
  const newName = form.name.trim();
  const payload = {
    name:        newName,
    description: form.description.trim(),
    is_active:   form.is_active,
  };
  const { error } = editing
    ? await supabase.from('government_agencies').update(payload).eq('id', editing.id)
    : await supabase.from('government_agencies').insert([payload]);

  if (error) { flash(`Error: ${error.message}`, 'error'); setSaving(false); return; }

  // Cascade: kung nag-edit at nagbago ang pangalan, i-update din ang lahat
  // ng chart_of_accounts rows na gumagamit ng dating pangalan ng agency na ito,
  // para hindi mawala ang koneksyon nila sa Billing form.
  if (editing && editing.name !== newName) {
    const { error: coaError } = await supabase
      .from('chart_of_accounts')
      .update({ agency: newName })
      .eq('agency', editing.name);

    if (coaError) {
      flash(`Agency saved, pero may error sa pag-sync ng Chart of Accounts: ${coaError.message}`, 'error');
      setShowModal(false);
      fetchAgencies();
      setSaving(false);
      return;
    }
  }

  flash(editing ? '✓ Agency updated (kasama ang naka-link na Chart of Accounts).' : '✓ Agency added.');
  setShowModal(false);
  fetchAgencies();
  setSaving(false);
};

  const handleDelete = async (id) => {
    await supabase.from("chart_of_accounts").delete().eq("id", id);
    setDeleteConfirm(null);
    setSelected((p) => {
      const n = new Set(p);
      n.delete(id);
      return n;
    });
    fetchAccounts();
    flash("Account deleted.");
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Delete ${selected.size} selected account(s)?`)) return;
    await supabase
      .from("chart_of_accounts")
      .delete()
      .in("id", [...selected]);
    const count = selected.size;
    setSelected(new Set());
    fetchAccounts();
    flash(`${count} account(s) deleted.`);
  };

  const buildPrintHTML = () => {
    const grouped = {};
    [...accounts]
      .filter((a) => a.is_active)
      .sort((a, b) => {
        const an = a.government_agencies?.name || "";
        const bn = b.government_agencies?.name || "";
        return (
          an.localeCompare(bn) ||
          (a.code || "").localeCompare(b.code || "", undefined, {
            numeric: true,
          })
        );
      })
      .forEach((a) => {
        const ag = a.government_agencies?.name || "Uncategorized";
        if (!grouped[ag]) grouped[ag] = [];
        grouped[ag].push(a);
      });

    const agencyBlocks = Object.entries(grouped)
      .map(([agency, items]) =>
        items
          .map(
            (a) => `
    <tr>
      <td class="code">${a.code || "—"}</td>
      <td class="agency">${a.government_agencies?.name || "—"}</td>
      <td class="name">${a.account_name}</td>
    </tr>
  `,
          )
          .join(""),
      )
      .join("");

    const now = new Date().toLocaleDateString("en-PH", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const generated = new Date().toLocaleString("en-PH", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    const totalActive = accounts.filter((a) => a.is_active).length;

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Chart of Accounts – ${COMPANY}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 10pt; color: #111; background: #fff; }
.page { max-width: 100%; margin: 0; padding: 32px 32px 48px; }
    .letterhead { display: flex; align-items: flex-start; justify-content: space-between; padding-bottom: 18px; border-bottom: 3px solid #111; margin-bottom: 24px; }
    .lh-left .company { font-size: 13pt; font-weight: 700; color: #111; letter-spacing: -0.3pt; }
    .lh-left .tagline { font-size: 8pt; color: #6b7280; margin-top: 2px; }
    .lh-right { text-align: right; font-size: 8pt; color: #6b7280; line-height: 1.6; }
    .doc-title { margin-bottom: 20px; }
    .doc-title h1 { font-size: 18pt; font-weight: 700; color: #111; letter-spacing: -0.5pt; }
    .doc-title .as-at { font-size: 9pt; color: #6b7280; margin-top: 3px; }
table { width: 100%; border-collapse: collapse; font-size: 9pt; table-layout: fixed; }
    thead tr { background: #f3f4f6; border-top: 1px solid #d1d5db; border-bottom: 1px solid #d1d5db; }
    thead th { text-align: left; padding: 7px 10px; font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #6b7280; }
    tbody tr:nth-child(even):not(.agency-header) { background: #f9fafb; }
    tbody td { padding: 5px 10px; border-bottom: 1px solid #f3f4f6; }
td.code { font-family: 'Courier New', monospace; font-size: 8.5pt; color: #6b7280; }
td.agency { color: #6b7280; font-size: 8.5pt; white-space: nowrap; }
td.name { color: #111; word-wrap: break-word; }
    .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; font-size: 7.5pt; color: #9ca3af; }
    .sig-line { display: inline-block; width: 180px; border-top: 1px solid #9ca3af; margin-top: 28px; font-size: 7pt; color: #6b7280; text-align: center; }
    @media print {
      body { padding: 0; }
      .page { padding: 0; max-width: 100%; }
      @page { margin: 15mm 18mm; size: A4; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="letterhead">
      <div class="lh-left">
        <div class="company">${COMPANY}</div>
        <div class="tagline">Business Management &amp; Accounting Services</div>
      </div>
      <div class="lh-right">
        <div>Chart of Accounts</div>
        <div>As at ${now}</div>
        <div>Generated: ${generated}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
      <th style="width:60px">Code</th>
      <th style="width:180px">Government Agency</th>
      <th>Account Name</th>
        </tr>
      </thead>
      <tbody>
        ${agencyBlocks}
      </tbody>
    </table>
    <div class="footer">
      <div>
        <div>${totalActive} active account(s) · Generated ${generated}</div>
        <div style="margin-top:4px">${COMPANY}</div>
      </div>
      <div>
        <div class="sig-line">Prepared by</div>
      </div>
    </div>
  </div>
</body>
</html>`;
  };

  const handlePrint = () => {
    const win = window.open("", "_blank", "width=900,height=700");
    win.document.write(buildPrintHTML());
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
    }, 400);
  };

  // Separate function para sa export
  const buildExportHTML = () => {
    const base = buildPrintHTML();
    // Inject auto-print script na configured for PDF save
    return base.replace(
      "</body>",
      `<script>
      window.onload = function() {
        window.print();
        window.onafterprint = function() { window.close(); };
      };
    </script></body>`,
    );
  };

  const handleExportPdf = async () => {
    const iframe = document.createElement("iframe");
    iframe.style.cssText =
      "position:fixed;left:-9999px;top:0;width:794px;height:1123px;border:none;visibility:hidden;";
    document.body.appendChild(iframe);

    iframe.contentDocument.open();
    iframe.contentDocument.write(buildPrintHTML());
    iframe.contentDocument.close();

    // Wait for render, then adjust height to actual content
    await new Promise((r) => setTimeout(r, 600));
    const actualHeight = iframe.contentDocument.body.scrollHeight;
    iframe.style.height = actualHeight + "px";

    // Extra wait after resize
    await new Promise((r) => setTimeout(r, 200));

    try {
      const canvas = await html2canvas(iframe.contentDocument.body, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        width: 794,
        height: actualHeight,
        windowWidth: 794,
        windowHeight: actualHeight,
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = (canvas.height * pdfW) / canvas.width;
      const pageHeight = pdf.internal.pageSize.getHeight();

      if (pdfH <= pageHeight) {
        pdf.addImage(imgData, "PNG", 0, 0, pdfW, pdfH);
      } else {
        let yOffset = 0;
        let remaining = pdfH;
        while (remaining > 0) {
          pdf.addImage(imgData, "PNG", 0, -yOffset, pdfW, pdfH);
          remaining -= pageHeight;
          yOffset += pageHeight;
          if (remaining > 0) pdf.addPage();
        }
      }

      const date = new Date().toISOString().slice(0, 10);
      pdf.save(`chart_of_accounts_${date}.pdf`);
    } finally {
      document.body.removeChild(iframe);
    }
  };

  // ── Export CSV ─────────────────────────────────────────────────────────────
  const handleExportCSV = () => exportCSV(accounts);

  // ── Import CSV ─────────────────────────────────────────────────────────────
  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setImporting(true);
    try {
      const text = await file.text();
      const lines = text.trim().split("\n");
      if (lines.length < 2) {
        flash("CSV has no data rows.", "error");
        setImporting(false);
        return;
      }
      const parseRow = (line) =>
        line
          .split(",")
          .map((v) => v.trim().replace(/^"|"$/g, "").replace(/""/g, '"'));
      const headers = parseRow(lines[0]).map((h) => h.toLowerCase());
      const codeIdx = headers.indexOf("code");
      const nameIdx = headers.indexOf("account name");
      const agencyIdx = headers.indexOf("government agency");
      if (nameIdx === -1) {
        flash('CSV must have an "Account Name" column.', "error");
        setImporting(false);
        return;
      }
      const { data: agList } = await supabase
        .from("government_agencies")
        .select("id, name");
      const agencyMap = {};
      (agList || []).forEach((a) => {
        agencyMap[a.name.toLowerCase()] = a.id;
      });
      const toInsert = [];
      const errors = [];
      lines.slice(1).forEach((line, i) => {
        const row = parseRow(line);
        const name = nameIdx !== -1 ? row[nameIdx] : "";
        if (!name) {
          errors.push(`Row ${i + 2}: missing account name`);
          return;
        }
        toInsert.push({
          code: codeIdx !== -1 ? row[codeIdx] || null : null,
          account_name: name,
          agency_id:
            agencyIdx !== -1
              ? agencyMap[(row[agencyIdx] || "").toLowerCase()] || null
              : null,
          agency: agencyIdx !== -1 ? row[agencyIdx] || "" : "",
          is_active: true,
        });
      });
      if (errors.length) {
        flash(`Import errors: ${errors.slice(0, 3).join(", ")}`, "error");
        setImporting(false);
        return;
      }
      if (!toInsert.length) {
        flash("No valid rows to import.", "error");
        setImporting(false);
        return;
      }
      const { error } = await supabase
        .from("chart_of_accounts")
        .insert(toInsert);
      if (error) flash(`Import failed: ${error.message}`, "error");
      else {
        flash(`Imported ${toInsert.length} account(s).`);
        fetchAccounts();
      }
    } catch (err) {
      flash(`Import error: ${err.message}`, "error");
    }
    setImporting(false);
  };

  const tabs = ["All", ...agencies.map((a) => a.name)];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen px-4 py-4 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        {/* TOP BAR */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-gray-900">
              Chart of Accounts
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              As at {fmtDate()} · {accounts.length} accounts
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* PDF Dropdown */}
            <PdfDropdown onPrint={handlePrint} onExportPdf={handleExportPdf} />

            {/* Export CSV */}
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition"
            >
              <FaFileExport size={10} className="text-gray-400" /> Export CSV
            </button>

            {/* Import CSV */}
            <button
              onClick={() => importRef.current?.click()}
              disabled={importing}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition disabled:opacity-50"
            >
              {importing ? (
                <span className="w-3 h-3 border border-gray-400 rounded-full border-t-transparent animate-spin" />
              ) : (
                <FaFileImport size={10} className="text-gray-400" />
              )}
              Import CSV
            </button>
            <input
              ref={importRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleImportFile}
            />

            {/* Divider */}
            <div className="w-px h-5 mx-1 bg-gray-200" />

            {/* Add Account */}
            <button
              onClick={openAdd}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-700 transition"
            >
              <FaPlus size={9} /> Add Account
            </button>
          </div>
        </div>

        {/* MESSAGE */}
        {message && (
          <div
            className={`mb-4 px-4 py-2.5 rounded-lg text-xs flex items-center justify-between border
            ${
              messageType === "success"
                ? "bg-white border-gray-200 text-gray-700"
                : "bg-red-50 border-red-100 text-red-700"
            }`}
          >
            <span className="flex items-center gap-2">
              {messageType === "success" && (
                <FaCheck size={9} className="text-gray-400" />
              )}
              {message}
            </span>
            <button
              onClick={() => setMessage("")}
              className="ml-4 text-gray-300 hover:text-gray-500"
            >
              <FaTimes size={10} />
            </button>
          </div>
        )}

        {/* IMPORT HINT */}
        <div className="mb-4 px-3 py-2 rounded-lg text-[11px] text-gray-400 flex items-center gap-2"></div>

        {/* MAIN CARD */}
        <div className="overflow-hidden bg-white border border-gray-200 rounded-xl">
          {/* TABS */}
          <div className="flex flex-wrap items-center px-1 border-b border-gray-100">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  setSelected(new Set());
                }}
                className={`px-4 py-3 text-xs font-medium whitespace-nowrap transition border-b-2 -mb-px
                  ${
                    activeTab === tab
                      ? "text-gray-900 border-gray-900"
                      : "text-gray-400 border-transparent hover:text-gray-600 hover:border-gray-300"
                  }`}
              >
                {tab === "All" ? "All Accounts" : tab}
              </button>
            ))}
          </div>

          {/* SEARCH + BULK */}
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-50">
            <div className="flex items-center gap-2 text-xs text-gray-400">
              {selected.size > 0 ? (
                <>
                  <span className="font-medium text-gray-500">
                    {selected.size} selected
                  </span>
                  <button
                    onClick={handleBulkDelete}
                    className="flex items-center gap-1 px-2.5 py-1 text-red-500 border border-red-100 rounded-lg hover:bg-red-50 transition"
                  >
                    <FaTrash size={9} /> Delete
                  </button>
                  <button
                    onClick={() => setSelected(new Set())}
                    className="px-2.5 py-1 text-gray-400 border border-gray-100 rounded-lg hover:bg-gray-50 transition"
                  >
                    Clear
                  </button>
                </>
              ) : (
                <span>
                  {sorted.length !== accounts.length
                    ? `${sorted.length} of ${accounts.length}`
                    : `${accounts.length}`}{" "}
                  accounts
                </span>
              )}
            </div>
            <div className="relative w-56">
              <FaSearch
                className="absolute text-gray-300 -translate-y-1/2 left-3 top-1/2"
                size={10}
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search…"
                className="w-full py-1.5 pl-8 pr-7 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-100 bg-white"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
                >
                  <FaTimes size={9} />
                </button>
              )}
            </div>
          </div>

          {/* TABLE */}
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <div className="w-5 h-5 border border-gray-300 rounded-full border-t-gray-700 animate-spin" />
            </div>
          ) : sorted.length === 0 ? (
            <div className="py-24 text-center">
              <p className="text-sm font-medium text-gray-300">
                No accounts found
              </p>
              <p className="mt-1 text-xs text-gray-200">
                Adjust your search or add a new account
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="w-10 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={allChecked}
                        onChange={toggleAll}
                        className="w-3.5 h-3.5 rounded border-gray-300 cursor-pointer accent-gray-700"
                      />
                    </th>
                    {[
                      { label: "Code", field: "code", w: "w-32" },
                      {
                        label: "Government Agency",
                        field: "agency",
                        w: "w-56",
                      },
                      {
                        label: "Account Name",
                        field: "account_name",
                        w: "w-72",
                      },
                    ].map((col) => (
                      <th
                        key={col.field}
                        onClick={() => handleSort(col.field)}
                        className={`${col.w} px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-gray-400 cursor-pointer hover:text-gray-600 select-none`}
                      >
                        <span className="flex items-center">
                          {col.label}
                          <SortIcon field={col.field} />
                        </span>
                      </th>
                    ))}
                    <th className="w-24 px-32 py-3 text-right text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginated  .map((acct, idx) => (
                    <tr
                      key={acct.id}
                      onMouseEnter={() => setHoveredId(acct.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      className={`border-b border-gray-50 transition-colors
    ${selected.has(acct.id) ? "bg-gray-50" : hoveredId === acct.id ? "bg-gray-50/60" : ""}`}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selected.has(acct.id)}
                          onChange={() => toggleOne(acct.id)}
                          className="w-3.5 h-3.5 rounded border-gray-300 cursor-pointer accent-gray-700"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-[11px] text-gray-400 bg-gray-50 border border-gray-100 px-1.5 py-0.5 rounded">
                          {acct.code || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                        {acct.government_agencies?.name || "—"}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-800">
                        {acct.account_name}
                      </td>
                      <td className="w-24 px-4 py-3 text-right">
                        <div
                          className={`flex items-center justify-end px-28 gap-0.5 transition-opacity
                          ${hoveredId === acct.id ? "opacity-100" : "opacity-0"}`}
                        >
                          <button
                            onClick={() => openEdit(acct)}
                            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
                            title="Edit"
                          >
                            <FaEdit size={11} />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(acct)}
                            className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                            title="Delete"
                          >
                            <FaTrash size={10} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

 {sorted.length > 0 && (
  <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-50 text-[11px] text-gray-400">
    <div className="flex items-center gap-3">
      <span>
        Showing {(currentPage - 1) * pageSize + 1}–
        {Math.min(currentPage * pageSize, sorted.length)} of {sorted.length}
        {activeTab !== "All" ? ` · ${activeTab}` : ""}
      </span>
      <select
        value={pageSize}
        onChange={(e) => setPageSize(Number(e.target.value))}
        className="px-2 py-1 text-[11px] border border-gray-200 rounded-md bg-white cursor-pointer"
      >
        {[10, 25, 50, 100].map((n) => (
          <option key={n} value={n}>{n} / page</option>
        ))}
      </select>
    </div>

    <div className="flex items-center gap-2">
      {selected.size > 0 && <span>{selected.size} selected</span>}
      <button
        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
        disabled={currentPage === 1}
        className="px-2.5 py-1 border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
      >
        Prev
      </button>
      <span className="px-2">
        Page {currentPage} of {totalPages}
      </span>
      <button
        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
        disabled={currentPage === totalPages}
        className="px-2.5 py-1 border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
      >
        Next
      </button>
    </div>
  </div>
)}
        </div>
      </div>

      {/* ADD / EDIT MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-[2px]">
          <div className="w-full max-w-md overflow-hidden bg-white border border-gray-100 shadow-xl rounded-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-800">
                {editing ? "Edit account" : "Add account"}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-300 transition hover:text-gray-600"
              >
                <FaTimes size={13} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                  Code
                </label>
                <input
                  type="text"
                  value={form.code}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, code: e.target.value }))
                  }
                  placeholder="e.g. 001"
                  maxLength={10}
                  className={inputCls}
                />
                <p className="text-[10px] text-gray-300 mt-1">
                  Optional · max 10 characters
                </p>
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                  Government Agency{" "}
                  <span className="font-normal tracking-normal text-red-400 normal-case">
                    *
                  </span>
                </label>
                <select
                  value={form.agency_id}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, agency_id: e.target.value }))
                  }
                  className={selectCls}
                >
                  <option value="">Select agency</option>
                  {agencies.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                  Account Name{" "}
                  <span className="font-normal tracking-normal text-red-400 normal-case">
                    *
                  </span>
                </label>
                <input
                  type="text"
                  value={form.account_name}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, account_name: e.target.value }))
                  }
                  placeholder="e.g. Income Tax"
                  maxLength={150}
                  className={inputCls}
                />
              </div>
              <div className="flex items-center gap-3 pt-1 border-t border-gray-50">
                <button
                  onClick={() =>
                    setForm((p) => ({ ...p, is_active: !p.is_active }))
                  }
                  className={`relative w-9 h-5 rounded-full transition-colors ${form.is_active ? "bg-gray-800" : "bg-gray-200"}`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${form.is_active ? "translate-x-4" : ""}`}
                  />
                </button>
                <span className="text-xs text-gray-500">
                  {form.is_active ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
            <div className="flex gap-2 px-6 py-4 border-t border-gray-50 bg-gray-50/50">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-2 text-xs font-medium text-gray-600 transition border border-gray-200 rounded-lg hover:bg-white"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2 text-xs font-medium rounded-lg bg-gray-900 text-white hover:bg-gray-700 transition disabled:opacity-40 flex items-center justify-center gap-1.5"
              >
                {saving ? (
                  <span className="w-3.5 h-3.5 border border-white rounded-full border-t-transparent animate-spin" />
                ) : (
                  <FaCheck size={10} />
                )}
                {editing ? "Save changes" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-[2px]">
          <div className="w-full max-w-sm p-6 bg-white border border-gray-100 shadow-xl rounded-2xl">
            <h3 className="mb-1 text-sm font-semibold text-gray-800">
              Delete account?
            </h3>
            <p className="mb-5 text-xs text-gray-500">
              "
              <span className="font-medium text-gray-700">
                {deleteConfirm.account_name}
              </span>
              " will be permanently removed.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2 text-xs font-medium text-gray-600 transition border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm.id)}
                className="flex-1 py-2 text-xs font-medium text-white transition bg-red-600 rounded-lg hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
