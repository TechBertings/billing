import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
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
  FaLayerGroup,
  FaBuilding,
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

// ─── Export CSV (scoped to the accounts currently loaded, i.e. active agency) ─
const exportCSV = (accounts, agencyName) => {
  const headers = ["Code", "Account Name", "Status"];
  const rows = accounts.map((a) => [
    a.code || "",
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
  const safeAgency = (agencyName || "accounts").replace(/[^a-z0-9]+/gi, "_");
  a.download = `chart_of_accounts_${safeAgency}_${new Date().toISOString().slice(0, 10)}.csv`;
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
  // ── LEVEL 1: Groups ──────────────────────────────────────────────────────
  const [groups, setGroups] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [activeGroupId, setActiveGroupId] = useState(null);

  const [showGroupModal, setShowGroupModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [groupForm, setGroupForm] = useState({ label: "", is_active: true });
  const [deleteConfirmGroup, setDeleteConfirmGroup] = useState(null);
  const [savingGroup, setSavingGroup] = useState(false);

  // ── LEVEL 2: Agencies (scoped to active group) ──────────────────────────
  const [agencies, setAgencies] = useState([]);
  const [loadingAgencies, setLoadingAgencies] = useState(true);
  const [activeAgencyId, setActiveAgencyId] = useState(null);

  const [showAgencyModal, setShowAgencyModal] = useState(false);
  const [editingAgency, setEditingAgency] = useState(null);
  const [agencyForm, setAgencyForm] = useState({
    name: "",
    description: "",
    is_active: true,
  });
  const [deleteConfirmAgency, setDeleteConfirmAgency] = useState(null);
  const [savingAgency, setSavingAgency] = useState(false);

  // ── LEVEL 3: Accounts (scoped to active agency) ─────────────────────────
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
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
    const [taxTypes, setTaxTypes] = useState([]);


const emptyForm = {
    code: "",
    account_name: "",
    is_active: true,
    billing_mode: "flat",
    tax_setup_id: "",
    contribution_key: "",
  };
  const [form, setForm] = useState(emptyForm);

  const activeGroup = groups.find((g) => g.id === activeGroupId) || null;
  const activeAgency = agencies.find((a) => a.id === activeAgencyId) || null;

  // ── Flash ──────────────────────────────────────────────────────────────
  const flash = (msg, type = "success") => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => setMessage(""), 3500);
  };

  // ── FETCH: Groups ─────────────────────────────────────────────────────
  const fetchGroups = useCallback(async () => {
    setLoadingGroups(true);
    const { data, error } = await supabase
      .from("fee_groups")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("label", { ascending: true });

    if (error) {
      flash(`Error loading groups: ${error.message}`, "error");
    } else {
      setGroups(data || []);
      setActiveGroupId((prev) => prev ?? (data && data[0] ? data[0].id : null));
    }
    setLoadingGroups(false);
  }, []);

  // ── FETCH: Agencies (scoped to active group) ────────────────────────────
  const fetchAgencies = useCallback(async () => {
    if (!activeGroupId) {
      setAgencies([]);
      setActiveAgencyId(null);
      setLoadingAgencies(false);
      return;
    }
    setLoadingAgencies(true);
    const { data, error } = await supabase
      .from("government_agencies")
      .select("*")
      .eq("group_id", activeGroupId)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      flash(`Error loading agencies: ${error.message}`, "error");
    } else {
      setAgencies(data || []);
      setActiveAgencyId(data && data[0] ? data[0].id : null);
    }
    setLoadingAgencies(false);
  }, [activeGroupId]);

  // ── FETCH: Accounts (scoped to active agency) ───────────────────────────
  const fetchAccounts = useCallback(async () => {
    if (!activeAgencyId) {
      setAccounts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("chart_of_accounts")
      .select("*, government_agencies(id, name), tax_setup(id, label, computation_type)")
      .eq("agency_id", activeAgencyId)
      .order("code", { ascending: true, nullsFirst: false });
    if (error) flash(`Error: ${error.message}`, "error");
    else setAccounts(data || []);
    setLoading(false);
  }, [activeAgencyId]);

const fetchTaxTypes = useCallback(async () => {
    const { data, error } = await supabase
      .from("tax_setup")
      .select("id, label, computation_type")
      .eq("is_active", true)
      .order("label", { ascending: true });
    if (!error) setTaxTypes(data || []);
  }, []);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);
  useEffect(() => {
    fetchAgencies();
  }, [fetchAgencies]);
  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);
  useEffect(() => {
    fetchTaxTypes();
  }, [fetchTaxTypes]);

  useEffect(() => {
    setCurrentPage(1);
    setSelected(new Set());
  }, [search, pageSize, activeAgencyId]);

  // ── Filter + Sort ────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return accounts.filter(
      (a) =>
        !q ||
        [a.code, a.account_name].some((v) =>
          (v || "").toLowerCase().includes(q),
        ),
    );
  }, [accounts, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = (a[sortField] || "").toString().toLowerCase();
      const bv = (b[sortField] || "").toString().toLowerCase();
      const cmp = av.localeCompare(bv, undefined, {
        numeric: sortField === "code",
      });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paginated = sorted.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
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

  // ── Selection ────────────────────────────────────────────────────────────
  const allChecked =
    paginated.length > 0 && paginated.every((a) => selected.has(a.id));
  const toggleAll = () =>
    allChecked
      ? setSelected((p) => {
          const n = new Set(p);
          paginated.forEach((a) => n.delete(a.id));
          return n;
        })
      : setSelected((p) => new Set([...p, ...paginated.map((a) => a.id)]));
  const toggleOne = (id) =>
    setSelected((p) => {
      const n = new Set(p);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  // ── GROUP CRUD ───────────────────────────────────────────────────────────
  const openAddGroup = () => {
    setEditingGroup(null);
    setGroupForm({ label: "", is_active: true });
    setShowGroupModal(true);
  };
  const openEditGroup = (g) => {
    setEditingGroup(g);
    setGroupForm({ label: g.label || "", is_active: g.is_active });
    setShowGroupModal(true);
  };

  const handleSaveGroup = async () => {
    if (!groupForm.label.trim()) {
      flash("Group name is required.", "error");
      return;
    }
    setSavingGroup(true);
    const payload = {
      label: groupForm.label.trim(),
      is_active: groupForm.is_active,
      sort_order: editingGroup ? editingGroup.sort_order : groups.length,
    };
    const { error } = editingGroup
      ? await supabase
          .from("fee_groups")
          .update(payload)
          .eq("id", editingGroup.id)
      : await supabase.from("fee_groups").insert([payload]);

    if (error) {
      flash(`Error: ${error.message}`, "error");
    } else {
      flash(editingGroup ? "✓ Group updated." : "✓ Group added.");
      setShowGroupModal(false);
      fetchGroups();
    }
    setSavingGroup(false);
  };

  const handleDeleteGroup = async (g) => {
    const { error } = await supabase.from("fee_groups").delete().eq("id", g.id);
    if (error) {
      flash("Cannot delete: agencies still reference this group.", "error");
    } else {
      flash("✓ Group deleted.");
      if (activeGroupId === g.id) setActiveGroupId(null);
      fetchGroups();
    }
    setDeleteConfirmGroup(null);
  };

  // ── AGENCY CRUD ──────────────────────────────────────────────────────────
  const openAddAgency = () => {
    setEditingAgency(null);
    setAgencyForm({ name: "", description: "", is_active: true });
    setShowAgencyModal(true);
  };
  const openEditAgency = (a) => {
    setEditingAgency(a);
    setAgencyForm({
      name: a.name || "",
      description: a.description || "",
      is_active: a.is_active,
    });
    setShowAgencyModal(true);
  };

  const handleSaveAgency = async () => {
    if (!agencyForm.name.trim()) {
      flash("Agency name is required.", "error");
      return;
    }
    if (!activeGroupId) {
      flash("Pick a group first.", "error");
      return;
    }
    setSavingAgency(true);
    const payload = {
      group_id: activeGroupId,
      name: agencyForm.name.trim(),
      description: agencyForm.description.trim() || null,
      is_active: agencyForm.is_active,
      sort_order: editingAgency ? editingAgency.sort_order : agencies.length,
    };
    const { error } = editingAgency
      ? await supabase
          .from("government_agencies")
          .update(payload)
          .eq("id", editingAgency.id)
      : await supabase.from("government_agencies").insert([payload]);

    if (error) {
      flash(`Error: ${error.message}`, "error");
    } else {
      flash(editingAgency ? "✓ Agency updated." : "✓ Agency added.");
      setShowAgencyModal(false);
      fetchAgencies();
    }
    setSavingAgency(false);
  };

  const handleDeleteAgency = async (a) => {
    const { error } = await supabase
      .from("government_agencies")
      .delete()
      .eq("id", a.id);
    if (error) {
      flash("Cannot delete: accounts still reference this agency.", "error");
    } else {
      flash("✓ Agency deleted.");
      if (activeAgencyId === a.id) setActiveAgencyId(null);
      fetchAgencies();
    }
    setDeleteConfirmAgency(null);
  };

  // ── ACCOUNT CRUD ─────────────────────────────────────────────────────────
  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowModal(true);
  };
const openEdit = (a) => {
  setEditing(a);
  setForm({
    code: a.code || "",
    account_name: a.account_name || "",
    is_active: a.is_active,
    billing_mode: a.billing_mode || "flat",
    tax_setup_id: a.tax_setup_id || "",
    contribution_key: a.contribution_key || "",   // ← bago
  });
  setShowModal(true);
};

const handleSave = async () => {
  if (!form.account_name.trim()) {
    flash("Account name is required.", "error");
    return;
  }
  if (!activeAgencyId) {
    flash("Pick a group and agency first.", "error");
    return;
  }
  if (form.billing_mode === "contribution" && !form.contribution_key) {
    flash("Pick a contribution type to link.", "error");
    return;
  }
  setSaving(true);
  const payload = {
    code: form.code.trim() || null,
    agency_id: activeAgencyId,
    agency: activeAgency?.name || "",
    account_name: form.account_name.trim(),
    is_active: form.is_active,
    billing_mode: form.billing_mode || "flat",
    tax_setup_id: form.tax_setup_id || null,
    contribution_key:
      form.billing_mode === "contribution"
        ? form.contribution_key || null
        : null,
  };
  const { error } = editing
    ? await supabase
        .from("chart_of_accounts")
        .update(payload)
        .eq("id", editing.id)
    : await supabase.from("chart_of_accounts").insert([payload]);

  if (error) {
    flash(`Error: ${error.message}`, "error");
    setSaving(false);
    return;
  }
  flash(editing ? "✓ Account updated." : "✓ Account added.");
  setShowModal(false);
  fetchAccounts();
  setSaving(false);
};

  const handleDelete = async (id) => {
    const { error } = await supabase
      .from("chart_of_accounts")
      .delete()
      .eq("id", id);
    if (error) {
      flash(`Cannot delete: ${error.message}`, "error");
    } else {
      setSelected((p) => {
        const n = new Set(p);
        n.delete(id);
        return n;
      });
      fetchAccounts();
      flash("✓ Account deleted.");
    }
    setDeleteConfirm(null);
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Delete ${selected.size} selected account(s)?`)) return;
    const { error } = await supabase
      .from("chart_of_accounts")
      .delete()
      .in("id", [...selected]);
    if (error) {
      flash(`Cannot delete: ${error.message}`, "error");
      return;
    }
    const count = selected.size;
    setSelected(new Set());
    fetchAccounts();
    flash(`${count} account(s) deleted.`);
  };

  // ── Print / PDF (current agency's accounts only) ────────────────────────
  const buildPrintHTML = () => {
    const rows = [...accounts]
      .filter((a) => a.is_active)
      .sort((a, b) =>
        (a.code || "").localeCompare(b.code || "", undefined, {
          numeric: true,
        }),
      )
      .map(
        (a) => `
    <tr>
      <td class="code">${a.code || "—"}</td>
      <td class="name">${a.account_name}</td>
    </tr>`,
      )
      .join("");

    const now = fmtDate();
    const generated = new Date().toLocaleString("en-PH", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    const totalActive = accounts.filter((a) => a.is_active).length;
    const scopeLabel = `${activeGroup?.label || "—"} → ${activeAgency?.name || "—"}`;

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
    .doc-title h1 { font-size: 18pt; font-weight: 700; color: #111; letter-spacing: -0.5pt; }
    .doc-title .as-at { font-size: 9pt; color: #6b7280; margin-top: 3px; }
    table { width: 100%; border-collapse: collapse; font-size: 9pt; table-layout: fixed; }
    thead tr { background: #f3f4f6; border-top: 1px solid #d1d5db; border-bottom: 1px solid #d1d5db; }
    thead th { text-align: left; padding: 7px 10px; font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #6b7280; }
    tbody tr:nth-child(even) { background: #f9fafb; }
    tbody td { padding: 5px 10px; border-bottom: 1px solid #f3f4f6; }
    td.code { font-family: 'Courier New', monospace; font-size: 8.5pt; color: #6b7280; width: 80px; }
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
        <div>Chart of Accounts — ${scopeLabel}</div>
        <div>As at ${now}</div>
        <div>Generated: ${generated}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width:80px">Code</th>
          <th>Account Name</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
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

  const handleExportPdf = async () => {
    const iframe = document.createElement("iframe");
    iframe.style.cssText =
      "position:fixed;left:-9999px;top:0;width:794px;height:1123px;border:none;visibility:hidden;";
    document.body.appendChild(iframe);

    iframe.contentDocument.open();
    iframe.contentDocument.write(buildPrintHTML());
    iframe.contentDocument.close();

    await new Promise((r) => setTimeout(r, 600));
    const actualHeight = iframe.contentDocument.body.scrollHeight;
    iframe.style.height = actualHeight + "px";

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
      const safeAgency = (activeAgency?.name || "accounts").replace(
        /[^a-z0-9]+/gi,
        "_",
      );
      pdf.save(`chart_of_accounts_${safeAgency}_${date}.pdf`);
    } finally {
      document.body.removeChild(iframe);
    }
  };

  // ── Export CSV (current agency's accounts) ───────────────────────────────
  const handleExportCSV = () => exportCSV(accounts, activeAgency?.name);

  // ── Import CSV (imports into the current agency) ─────────────────────────
  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    if (!activeAgencyId) {
      flash("Pick a group and agency first.", "error");
      return;
    }
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
      if (nameIdx === -1) {
        flash('CSV must have an "Account Name" column.', "error");
        setImporting(false);
        return;
      }
      const toInsert = [];
      const errors = [];
      lines.slice(1).forEach((line, i) => {
        const row = parseRow(line);
        const name = row[nameIdx];
        if (!name) {
          errors.push(`Row ${i + 2}: missing account name`);
          return;
        }
        toInsert.push({
          code: codeIdx !== -1 ? row[codeIdx] || null : null,
          account_name: name,
          agency_id: activeAgencyId,
          agency: activeAgency?.name || "",
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

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen px-4 py-4 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        {/* TOP BAR */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-gray-900">
              Chart of Accounts
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              As at {fmtDate()} · Group → Agency → Accounts
            </p>
          </div>
        </div>

        {/* LEVEL 1 TABS: GROUPS */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {loadingGroups ? (
            <span className="text-xs text-gray-400">Loading groups…</span>
          ) : (
            groups.map((g) => (
              <div key={g.id} className="relative group/tab">
                <button
                  onClick={() => setActiveGroupId(g.id)}
                  className={`px-4 py-2 text-sm font-bold rounded-lg transition flex items-center gap-2
                    ${
                      activeGroupId === g.id
                        ? "bg-gray-900 text-white shadow-sm"
                        : "bg-white text-gray-500 border border-gray-200 hover:border-gray-400"
                    }`}
                >
                  <FaLayerGroup size={11} /> {g.label}
                  {!g.is_active && (
                    <span className="text-[9px] font-bold uppercase opacity-70">
                      (inactive)
                    </span>
                  )}
                </button>
                <span className="absolute items-center hidden gap-1 -top-2 -right-2 group-hover/tab:flex">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditGroup(g);
                    }}
                    className="p-1 text-gray-600 bg-white border border-gray-200 rounded-full shadow"
                    title="Edit group"
                  >
                    <FaEdit size={8} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirmGroup(g);
                    }}
                    className="p-1 text-red-400 bg-white border border-gray-200 rounded-full shadow"
                    title="Delete group"
                  >
                    <FaTrash size={8} />
                  </button>
                </span>
              </div>
            ))
          )}
          <button
            onClick={openAddGroup}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-gray-600 transition bg-white border border-gray-300 border-dashed rounded-lg hover:bg-gray-100"
          >
            <FaPlus size={9} /> Add Group
          </button>
        </div>

        {/* LEVEL 2 TABS: AGENCIES */}
        <div className="flex flex-wrap items-center gap-1.5 mb-5 p-1.5 bg-white border border-gray-200 rounded-xl">
          {loadingAgencies ? (
            <span className="px-2 text-xs text-gray-400">
              Loading agencies…
            </span>
          ) : agencies.length === 0 ? (
            <span className="px-2 text-xs text-gray-400">
              No agencies under {activeGroup?.label || "this group"} yet — add
              one.
            </span>
          ) : (
            agencies.map((a) => (
              <div key={a.id} className="relative group/tab">
                <button
                  onClick={() => setActiveAgencyId(a.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition
                    ${activeAgencyId === a.id ? "bg-gray-100 text-gray-900" : "text-gray-500 hover:bg-gray-50"}`}
                >
                  {a.name}
                  {!a.is_active && (
                    <span className="ml-1 text-[9px] font-bold uppercase opacity-70">
                      (inactive)
                    </span>
                  )}
                </button>
                <span className="absolute items-center hidden gap-1 -top-2 -right-2 group-hover/tab:flex">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditAgency(a);
                    }}
                    className="p-1 text-gray-600 bg-white border border-gray-200 rounded-full shadow"
                    title="Edit agency"
                  >
                    <FaEdit size={7} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirmAgency(a);
                    }}
                    className="p-1 text-red-400 bg-white border border-gray-200 rounded-full shadow"
                    title="Delete agency"
                  >
                    <FaTrash size={7} />
                  </button>
                </span>
              </div>
            ))
          )}
          <button
            onClick={openAddAgency}
            disabled={!activeGroupId}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-gray-600 transition bg-white border border-gray-300 border-dashed rounded-lg hover:bg-gray-100 disabled:opacity-40"
          >
            <FaPlus size={8} /> Add Agency
          </button>
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

        {/* MAIN CARD: LEVEL 3 — ACCOUNTS */}
        <div className="overflow-hidden bg-white border border-gray-200 rounded-xl">
          {/* HEADER / TOOLBAR */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-gray-100">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                <FaBuilding size={12} className="text-gray-400" />
                {activeGroup ? activeGroup.label : "—"}{" "}
                {activeAgency ? `→ ${activeAgency.name}` : ""}
              </h2>
              <span className="text-xs text-gray-400">
                {sorted.length} account{sorted.length !== 1 ? "s" : ""}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <PdfDropdown
                onPrint={handlePrint}
                onExportPdf={handleExportPdf}
              />
              <button
                onClick={handleExportCSV}
                disabled={!activeAgencyId}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition disabled:opacity-40"
              >
                <FaFileExport size={10} className="text-gray-400" /> Export CSV
              </button>
              <button
                onClick={() => importRef.current?.click()}
                disabled={importing || !activeAgencyId}
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
              <div className="w-px h-5 mx-1 bg-gray-200" />
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
              <button
                onClick={openAdd}
                disabled={!activeAgencyId}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-700 transition disabled:opacity-40"
              >
                <FaPlus size={9} /> Add Account
              </button>
            </div>
          </div>

          {/* BULK BAR */}
          {selected.size > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 text-xs border-b border-gray-50 bg-gray-50/60">
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
            </div>
          )}

          {/* TABLE */}
          {!activeGroupId || !activeAgencyId ? (
            <div className="py-24 text-center">
              <p className="text-sm font-medium text-gray-300">
                Pick a group and an agency above
              </p>
              <p className="mt-1 text-xs text-gray-200">
                Add one if the lists are empty
              </p>
            </div>
          ) : loading ? (
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
                      { label: "Account Name", field: "account_name", w: "" },
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
                    <th className="w-24 px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                      Status
                    </th>
                    <th className="w-28 px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                      Billing Type
                    </th>
                    <th className="w-24 px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((acct) => (
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
                      <td className="px-4 py-3 text-sm font-medium text-gray-800">
                        {acct.account_name}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                            acct.is_active
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-400"
                          }`}
                        >
                          {acct.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                  <td className="px-4 py-3">
  <span
    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
      acct.billing_mode === "schedule"
        ? "bg-blue-100 text-blue-700"
        : acct.billing_mode === "contribution"
        ? "bg-purple-100 text-purple-700"
        : "bg-gray-100 text-gray-500"
    }`}
  >
    {acct.billing_mode === "schedule"
      ? "Schedule"
      : acct.billing_mode === "contribution"
      ? "Contribution"
      : "Flat"}
  </span>
</td>

                      <td className="px-4 py-3 text-right">
                        <div
                          className={`flex items-center justify-end gap-0.5 transition-opacity
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

          {/* PAGINATION */}
          {sorted.length > 0 && (
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-50 text-[11px] text-gray-400">
              <div className="flex items-center gap-3">
                <span>
                  Showing {(currentPage - 1) * pageSize + 1}–
                  {Math.min(currentPage * pageSize, sorted.length)} of{" "}
                  {sorted.length}
                </span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="px-2 py-1 text-[11px] border border-gray-200 rounded-md bg-white cursor-pointer"
                >
                  {[10, 25, 50, 100].map((n) => (
                    <option key={n} value={n}>
                      {n} / page
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
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
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
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

      {/* GROUP ADD/EDIT MODAL */}
      {showGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-sm overflow-hidden bg-white shadow-2xl rounded-2xl">
            <div className="flex items-center justify-between px-6 py-5 bg-gray-900">
              <h2 className="text-base font-bold text-white">
                {editingGroup ? "Edit Group" : "Add New Group"}
              </h2>
              <button
                onClick={() => setShowGroupModal(false)}
                className="text-white/60 hover:text-white"
              >
                <FaTimes />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">
                  Group Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={groupForm.label}
                  onChange={(e) =>
                    setGroupForm((p) => ({ ...p, label: e.target.value }))
                  }
                  placeholder="e.g. Fees"
                  className={inputCls}
                />
              </div>
              <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
                <button
                  onClick={() =>
                    setGroupForm((p) => ({ ...p, is_active: !p.is_active }))
                  }
                  className={`relative w-10 h-5 rounded-full transition-colors ${groupForm.is_active ? "bg-gray-800" : "bg-gray-200"}`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${groupForm.is_active ? "translate-x-5" : ""}`}
                  />
                </button>
                <span className="text-sm text-gray-600">
                  {groupForm.is_active ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
              <button
                onClick={() => setShowGroupModal(false)}
                className="flex-1 py-2.5 text-sm font-semibold rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveGroup}
                disabled={savingGroup}
                className="flex-1 py-2.5 text-sm font-semibold rounded-xl bg-gray-900 hover:bg-gray-700 text-white transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {savingGroup ? (
                  <span className="w-4 h-4 border-2 border-white rounded-full border-t-transparent animate-spin" />
                ) : (
                  <FaCheck size={12} />
                )}
                {editingGroup ? "Save Changes" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GROUP DELETE CONFIRM */}
      {deleteConfirmGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-sm p-6 bg-white shadow-2xl rounded-2xl">
            <h3 className="mb-1 text-base font-bold text-gray-800">
              Delete Group?
            </h3>
            <p className="mb-5 text-sm text-gray-500">
              "
              <span className="font-semibold text-gray-700">
                {deleteConfirmGroup.label}
              </span>
              " will be removed. Agencies still linked to it must be deleted
              first.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirmGroup(null)}
                className="flex-1 py-2.5 text-sm font-semibold rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteGroup(deleteConfirmGroup)}
                className="flex-1 py-2.5 text-sm font-semibold rounded-xl bg-red-600 hover:bg-red-700 text-white transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AGENCY ADD/EDIT MODAL */}
      {showAgencyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-sm overflow-hidden bg-white shadow-2xl rounded-2xl">
            <div className="flex items-center justify-between px-6 py-5 bg-gray-900">
              <h2 className="flex items-center gap-2 text-base font-bold text-white">
                <FaBuilding size={14} />{" "}
                {editingAgency ? "Edit Agency" : "Add New Agency"}
              </h2>
              <button
                onClick={() => setShowAgencyModal(false)}
                className="text-white/60 hover:text-white"
              >
                <FaTimes />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">
                  Agency Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={agencyForm.name}
                  onChange={(e) =>
                    setAgencyForm((p) => ({ ...p, name: e.target.value }))
                  }
                  placeholder="e.g. SEC"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">
                  Description{" "}
                  <span className="font-normal text-gray-300">(optional)</span>
                </label>
                <input
                  type="text"
                  value={agencyForm.description}
                  onChange={(e) =>
                    setAgencyForm((p) => ({
                      ...p,
                      description: e.target.value,
                    }))
                  }
                  placeholder="e.g. Securities and Exchange Commission"
                  className={inputCls}
                />
              </div>
              <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
                <button
                  onClick={() =>
                    setAgencyForm((p) => ({ ...p, is_active: !p.is_active }))
                  }
                  className={`relative w-10 h-5 rounded-full transition-colors ${agencyForm.is_active ? "bg-gray-800" : "bg-gray-200"}`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${agencyForm.is_active ? "translate-x-5" : ""}`}
                  />
                </button>
                <span className="text-sm text-gray-600">
                  {agencyForm.is_active ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
              <button
                onClick={() => setShowAgencyModal(false)}
                className="flex-1 py-2.5 text-sm font-semibold rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAgency}
                disabled={savingAgency}
                className="flex-1 py-2.5 text-sm font-semibold rounded-xl bg-gray-900 hover:bg-gray-700 text-white transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {savingAgency ? (
                  <span className="w-4 h-4 border-2 border-white rounded-full border-t-transparent animate-spin" />
                ) : (
                  <FaCheck size={12} />
                )}
                {editingAgency ? "Save Changes" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AGENCY DELETE CONFIRM */}
      {deleteConfirmAgency && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-sm p-6 bg-white shadow-2xl rounded-2xl">
            <h3 className="mb-1 text-base font-bold text-gray-800">
              Delete Agency?
            </h3>
            <p className="mb-5 text-sm text-gray-500">
              "
              <span className="font-semibold text-gray-700">
                {deleteConfirmAgency.name}
              </span>
              " will be removed. Accounts still linked to it must be deleted
              first.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirmAgency(null)}
                className="flex-1 py-2.5 text-sm font-semibold rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteAgency(deleteConfirmAgency)}
                className="flex-1 py-2.5 text-sm font-semibold rounded-xl bg-red-600 hover:bg-red-700 text-white transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ACCOUNT ADD/EDIT MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-[2px]">
          <div className="w-full max-w-md overflow-hidden bg-white border border-gray-100 shadow-xl rounded-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-sm font-semibold text-gray-800">
                  {editing ? "Edit account" : "Add account"}
                </h2>
                <p className="text-xs text-gray-400">
                  {activeGroup?.label} → {activeAgency?.name}
                </p>
              </div>
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
<div>
  <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
    Billing Type
  </label>
  <select
    value={form.billing_mode || "flat"}
    onChange={(e) => setForm((p) => ({ ...p, billing_mode: e.target.value }))}
    className={selectCls}
  >
    <option value="flat">Flat Amount (single input)</option>
    <option value="schedule">Schedule (Year / Period / VAT breakdown)</option>
    <option value="contribution">Government Contribution (from Employee Management)</option>
  </select>
  <p className="text-[10px] text-gray-300 mt-1">
    "Schedule" shows a Year/Period/Net-of-VAT/VAT/WTAX table in Batch Billing instead of a plain amount box.
  </p>
</div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                  Link to Tax Type{" "}
                  <span className="font-normal text-gray-300 normal-case">(optional)</span>
                </label>
                <select
                  value={form.tax_setup_id || ""}
                  onChange={(e) => setForm((p) => ({ ...p, tax_setup_id: e.target.value }))}
                  className={selectCls}
                >
                  <option value="">— None —</option>
                  {taxTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label} ({t.computation_type})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-gray-300 mt-1">
                  Pulls computation rules from Tax Setup instead of re-typing them here.
                </p>
              </div>
              <div className="flex items-center gap-3 pt-1 border-t border-gray-50">
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
{form.billing_mode === "contribution" && (
  <div>
    <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
      Link to Contribution Type{" "}
      <span className="font-normal tracking-normal text-red-400 normal-case">*</span>
    </label>
    <select
      value={form.contribution_key || ""}
      onChange={(e) => setForm((p) => ({ ...p, contribution_key: e.target.value }))}
      className={selectCls}
    >
      <option value="">— Select —</option>
      <option value="sss_total">SSS Total</option>
      <option value="phic_total">PHIC Total</option>
      <option value="hdmf_total">HDMF Total</option>
      <option value="sss_loan">SSS Loan</option>
      <option value="pagibig_loan">Pag-IBIG Loan</option>
    </select>
    <p className="text-[10px] text-gray-300 mt-1">
      Kukunin ang amount galing sa Employee Management (per-client total), hindi na manual typing sa Batch Billing.
    </p>
  </div>
)}
                  <span className="text-xs text-gray-500">{form.is_active ? "Active" : "Inactive"}</span>
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

      {/* ACCOUNT DELETE CONFIRM */}
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
