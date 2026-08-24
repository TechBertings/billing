import React, { useState, useEffect } from "react";
import { Landmark, ExternalLink, CheckCircle2, Zap } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import CustomerMaintenanceTable, {
  MaintenanceModal,
  DeleteModal,
  Toast,
} from "../components/customer_maintenance";

const fmtPct = (n) => `${(Number(n) * 100).toFixed(2)}%`;
const fmtPeso = (n) => `₱${Number(n).toLocaleString("en-PH")}`;

// SSS is no longer part of this config — fully managed sa hiwalay na
// SSS Bracket Table page (SSSTableSetup.jsx / sss_bracket_table +
// sss_rate_settings). Dito, PhilHealth at Pag-IBIG na lang ang natitira.
const emptyForm = {
  effective_date: "",
  status: "false",
  // PhilHealth
  phic_rate: "0.05",
  phic_floor: "10000",
  phic_ceiling: "100000",
  // Pag-IBIG
  hdmf_low_threshold: "1500",
  hdmf_ee_rate_low: "0.01",
  hdmf_ee_rate_high: "0.02",
  hdmf_er_rate: "0.02",
  hdmf_cap_salary: "10000",
};

const FieldLabel = ({ main, hint }) => (
  <span className="inline-flex flex-wrap items-baseline gap-1">
    <span className="font-medium text-gray-700">{main}</span>
    {hint && <span className="text-xs font-normal text-gray-400">({hint})</span>}
  </span>
);

// Section divider label — embedded inside a field's label (not a
// standalone field entry) since MaintenanceModal renders every field
// object as an input row, sections included.
const SectionLabel = ({ children }) => (
  <div className="mb-2 mt-1 border-b border-gray-200 pb-1 text-xs font-bold uppercase tracking-wider text-gray-800">
    {children}
  </div>
);
// Adds display-friendly derived fields so they can be shown as plain
// columns in CustomerMaintenanceTable (which just reads row[col.key]).
const withDisplayFields = (row) => ({
  ...row,
  phic_display: fmtPct(row.phic_rate),
  hdmf_display: fmtPeso(row.hdmf_cap_salary),
});

// Change this to wherever the SSS Bracket Table page actually lives in
// your router (e.g. react-router path). Left as a prop so it's easy to
// wire up without hardcoding routing assumptions here.
const DEFAULT_SSS_ROUTE = "/sss-table-setup";

const ContributionRates = ({ onNavigateToSSS }) => {
    const [rates, setRates] = useState([]);
  const [search, setSearch] = useState("");
  const [fetching, setFetching] = useState(true);

  // Read-only summary of the SSS bracket table, for context lang dito —
  // hindi na ito editable sa page na ito.
  const [sssSummary, setSssSummary] = useState({ bracketCount: 0, activeRate: null });
  const [sssSummaryLoading, setSssSummaryLoading] = useState(true);

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Toast
  const [toast, setToast] = useState({ msg: "", type: "success" });
  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: "", type: "success" }), 3000);
  };

  // ── Fetch ──
  const fetchRates = async () => {
    setFetching(true);
    const { data, error } = await supabase
      .from("contribution_config")
      .select("*")
      .order("effective_date", { ascending: false });
    if (!error) setRates((data || []).map(withDisplayFields));
    setFetching(false);
  };

  // Read-only glance at the SSS side — just enough to show on this page
  // without duplicating any of the actual management logic.
  const fetchSssSummary = async () => {
    setSssSummaryLoading(true);

    const [{ count }, { data: activeRate }] = await Promise.all([
      supabase.from("sss_bracket_table").select("*", { count: "exact", head: true }),
      supabase
        .from("sss_rate_settings")
        .select("*")
        .eq("is_active", true)
        .order("effective_date", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    setSssSummary({ bracketCount: count || 0, activeRate: activeRate || null });
    setSssSummaryLoading(false);
  };

  useEffect(() => {
    fetchRates();
    fetchSssSummary();
  }, []);

  // ── Open Add ──
  const openAdd = () => {
    setEditTarget(null);
    setForm({
      ...emptyForm,
      effective_date: new Date().toISOString().slice(0, 10),
      status: "false",
    });
    setModalOpen(true);
  };

  // ── Open Edit ──
  const openEdit = (row) => {
    setEditTarget(row);
    setForm({
      ...emptyForm,
      ...Object.fromEntries(
        Object.keys(emptyForm).map((k) => [
          k,
          k === "status"
            ? String(!!row.status)
            : row[k] === null || row[k] === undefined
              ? ""
              : String(row[k]),
        ]),
      ),
    });
    setModalOpen(true);
  };

  const handleFieldChange = (key) => (val) =>
    setForm((p) => ({ ...p, [key]: val }));

  // ── Submit ──
  const handleSubmit = async () => {
    if (!form.effective_date.trim())
      return showToast("Effective date is required (YYYY-MM-DD).", "error");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.effective_date.trim())) {
      return showToast("Effective date must be in YYYY-MM-DD format.", "error");
    }
    setLoading(true);

    const wantsActive = form.status === "true";

    const payload = {
      effective_date: form.effective_date.trim(),
      status: wantsActive,
      phic_rate: parseFloat(form.phic_rate) || 0,
      phic_floor: parseFloat(form.phic_floor) || 0,
      phic_ceiling: parseFloat(form.phic_ceiling) || 0,
      hdmf_low_threshold: parseFloat(form.hdmf_low_threshold) || 0,
      hdmf_ee_rate_low: parseFloat(form.hdmf_ee_rate_low) || 0,
      hdmf_ee_rate_high: parseFloat(form.hdmf_ee_rate_high) || 0,
      hdmf_er_rate: parseFloat(form.hdmf_er_rate) || 0,
      hdmf_cap_salary: parseFloat(form.hdmf_cap_salary) || 0,
    };

    // Kung gustong gawing Active nitong row, i-deactivate muna lahat ng iba
    // (kailangan bago mag-insert/update dahil sa unique index constraint)
    if (wantsActive) {
      const deactivateQuery = supabase
        .from("contribution_config")
        .update({ status: false })
        .eq("status", true);

      const { error: deactivateError } = editTarget
        ? await deactivateQuery.neq("id", editTarget.id)
        : await deactivateQuery;

      if (deactivateError) {
        showToast(
          `Failed to update active schedule: ${deactivateError.message}`,
          "error",
        );
        setLoading(false);
        return;
      }
    }

    if (editTarget) {
      const { error } = await supabase
        .from("contribution_config")
        .update(payload)
        .eq("id", editTarget.id);
      if (error) showToast(`Update failed: ${error.message}`, "error");
      else {
        showToast("Contribution rates updated!");
        fetchRates();
      }
    } else {
      const { error } = await supabase
        .from("contribution_config")
        .insert(payload);
      if (error) showToast(`Insert failed: ${error.message}`, "error");
      else {
        showToast("Contribution rates added!");
        fetchRates();
      }
    }
    setLoading(false);
    setModalOpen(false);
  };

  const handleSetActive = async (row) => {
    if (row.status) return; // active na, wala nang gagawin
    setLoading(true);
    const { error: e1 } = await supabase
      .from("contribution_config")
      .update({ status: false })
      .eq("status", true);
    if (e1) {
      showToast(`Failed: ${e1.message}`, "error");
      setLoading(false);
      return;
    }

    const { error: e2 } = await supabase
      .from("contribution_config")
      .update({ status: true })
      .eq("id", row.id);
    if (e2) showToast(`Failed: ${e2.message}`, "error");
    else showToast(`"${row.effective_date}" is now the active schedule.`);

    fetchRates();
    setLoading(false);
  };

  // ── Delete ──
// ── Delete ──
const handleDelete = async () => {
  if (deleteTarget?.status) {
    showToast("Can't delete the active schedule. Activate another one first.", "error");
    setDeleteTarget(null);
    return;
  }
  setDeleteLoading(true);
  const { error } = await supabase
    .from("contribution_config")
    .delete()
    .eq("id", deleteTarget.id);
  if (error) showToast("Delete failed.", "error");
  else {
    showToast("Contribution rate schedule deleted!");
    fetchRates();
  }
  setDeleteLoading(false);
  setDeleteTarget(null);
};

  // ── Filter ──
  const filtered = rates.filter((r) =>
    (r.effective_date || "").toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <>
   {/* Read-only SSS summary + link to the dedicated SSS page. SSS is
    no longer configured here — this card is just for visibility. */}
<div className="mb-4 flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-600">
    <span className="font-semibold text-gray-800">SSS</span>
    <span className="text-gray-400">managed separately ·</span>
    {sssSummaryLoading ? (
      <span className="text-gray-400">loading…</span>
    ) : (
      <>
        <span className="inline-flex items-center rounded-md bg-white px-2 py-0.5 text-xs font-medium text-gray-700 ring-1 ring-gray-200">
          {sssSummary.bracketCount} bracket{sssSummary.bracketCount === 1 ? "" : "s"}
        </span>
        {sssSummary.activeRate && (
          <span className="inline-flex items-center rounded-md bg-white px-2 py-0.5 text-xs font-medium text-gray-700 ring-1 ring-gray-200">
            EE {fmtPct(sssSummary.activeRate.ee_rate)} / ER {fmtPct(sssSummary.activeRate.er_rate)}
          </span>
        )}
      </>
    )}
  </div>
  <button
    type="button"
    onClick={onNavigateToSSS}
    className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap"
  >
    Manage SSS Brackets & Rates
    <ExternalLink size={14} />
  </button>
</div>


      <CustomerMaintenanceTable
        title="Contribution Rates (PhilHealth & Pag-IBIG)"
        icon={<Landmark size={22} className="text-blue-600" />}
        totalCount={rates.length}
        search={search}
        onSearchChange={setSearch}
        onAdd={openAdd}
        addLabel="Add Rate Schedule"
        columns={[
  {
  label: "Status",
  key: "status",
  render: (row) => (
    <div className="flex items-center gap-2">
      <span
        className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold tracking-wider ${
          row.status
            ? "bg-green-100 text-green-700"
            : "bg-slate-100 text-slate-500"
        }`}
      >
        {row.status ? "Active" : "Inactive"}
      </span>
      {!row.status && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleSetActive(row);
          }}
          disabled={loading}
          title="Make this the active schedule"
          className="text-xs font-medium text-blue-600 hover:text-blue-800 disabled:opacity-50"
        >
          Activate
        </button>
      )}
    </div>
  ),
},
          { label: "Effective Date", key: "effective_date", badge: true },
          { label: "PHIC Rate", key: "phic_display" },
          { label: "HDMF Cap", key: "hdmf_display" },
        ]}
        rows={filtered}
        onEdit={openEdit}
        onDelete={setDeleteTarget}
        fetching={fetching}
        emptyMessage="No contribution rate schedules found."
      />

      <MaintenanceModal
        open={modalOpen}
        title={
          editTarget
            ? "Edit Contribution Rate Schedule"
            : "Add Contribution Rate Schedule"
        }
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        loading={loading}
fields={[
  {
    label: <FieldLabel main="Effective Date" hint="YYYY-MM-DD" />,
    value: form.effective_date,
    onChange: handleFieldChange("effective_date"),
    placeholder: "2026-07-07",
  },
  {
    label: <FieldLabel main="Status" hint="only one schedule can be active at a time" />,
    value: form.status,
    onChange: handleFieldChange("status"),
    type: "select",
    options: [
      { value: "false", label: "Inactive" },
      { value: "true", label: "Active" },
    ],
  },
  {
    label: (
      <>
        <SectionLabel>PhilHealth</SectionLabel>
        <FieldLabel main="Rate" hint="0.05 = 5%" />
      </>
    ),
    value: form.phic_rate,
    onChange: handleFieldChange("phic_rate"),
  },
  {
    label: <FieldLabel main="Salary Floor" />,
    value: form.phic_floor,
    onChange: handleFieldChange("phic_floor"),
  },
  {
    label: <FieldLabel main="Salary Ceiling" />,
    value: form.phic_ceiling,
    onChange: handleFieldChange("phic_ceiling"),
  },
  {
    label: (
      <>
        <SectionLabel>Pag-IBIG</SectionLabel>
        <FieldLabel main="Low-Salary Threshold" />
      </>
    ),
    value: form.hdmf_low_threshold,
    onChange: handleFieldChange("hdmf_low_threshold"),
  },
  {
    label: <FieldLabel main="EE Rate" hint="below threshold" />,
    value: form.hdmf_ee_rate_low,
    onChange: handleFieldChange("hdmf_ee_rate_low"),
  },
  {
    label: <FieldLabel main="EE Rate" hint="above threshold" />,
    value: form.hdmf_ee_rate_high,
    onChange: handleFieldChange("hdmf_ee_rate_high"),
  },
  {
    label: <FieldLabel main="ER Rate" />,
    value: form.hdmf_er_rate,
    onChange: handleFieldChange("hdmf_er_rate"),
  },
  {
    label: <FieldLabel main="Max Fund Salary" hint="cap" />,
    value: form.hdmf_cap_salary,
    onChange: handleFieldChange("hdmf_cap_salary"),
  },
]}
      />

      <DeleteModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleteLoading}
      />

      <Toast msg={toast.msg} type={toast.type} />
    </>
  );
};

export default ContributionRates;