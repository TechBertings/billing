import React, { useState, useEffect } from "react";
import { Landmark } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import CustomerMaintenanceTable, {
  MaintenanceModal,
  DeleteModal,
  Toast,
} from "../components/customer_maintenance";

const fmtPct = (n) => `${(Number(n) * 100).toFixed(2)}%`;
const fmtPeso = (n) => `₱${Number(n).toLocaleString("en-PH")}`;

const emptyForm = {
  effective_date: "",
  status: "false",
  // SSS
  sss_msc_min: "5000",
  sss_msc_max: "35000",
  sss_msc_step: "500",
  sss_ee_rate: "0.05",
  sss_er_rate: "0.10",
  sss_ec_threshold: "15000",
  sss_ec_low: "10",
  sss_ec_high: "30",
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

// Adds display-friendly derived fields so they can be shown as plain
// columns in CustomerMaintenanceTable (which just reads row[col.key]).
const withDisplayFields = (row) => ({
  ...row,
  sss_display: `${fmtPct(row.sss_ee_rate)} / ${fmtPct(row.sss_er_rate)}`,
  msc_display: fmtPeso(row.sss_msc_max),
  phic_display: fmtPct(row.phic_rate),
  hdmf_display: fmtPeso(row.hdmf_cap_salary),
});

const ContributionRates = () => {
  const [rates, setRates] = useState([]);
  const [search, setSearch] = useState("");
  const [fetching, setFetching] = useState(true);

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

  useEffect(() => {
    fetchRates();
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
      status: wantsActive, // pansamantalang totoong value, tama pa rin kahit hindi active
      sss_msc_min: parseFloat(form.sss_msc_min) || 0,
      sss_msc_max: parseFloat(form.sss_msc_max) || 0,
      sss_msc_step: parseFloat(form.sss_msc_step) || 0,
      sss_ee_rate: parseFloat(form.sss_ee_rate) || 0,
      sss_er_rate: parseFloat(form.sss_er_rate) || 0,
      sss_ec_threshold: parseFloat(form.sss_ec_threshold) || 0,
      sss_ec_low: parseFloat(form.sss_ec_low) || 0,
      sss_ec_high: parseFloat(form.sss_ec_high) || 0,
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

      // Kung edit, huwag i-deactivate ang sarili niyang row (di naman importante,
      // pero linisin lang natin ang query)
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
    // 1) i-deactivate lahat muna
    const { error: e1 } = await supabase
      .from("contribution_config")
      .update({ status: false })
      .eq("status", true);
    if (e1) {
      showToast(`Failed: ${e1.message}`, "error");
      setLoading(false);
      return;
    }

    // 2) i-activate ang piniling row
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
  const handleDelete = async () => {
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
      <CustomerMaintenanceTable
        title="Contribution Rates"
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
              <span
                className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold tracking-wider ${
                  row.status
                    ? "bg-green-100 text-green-700"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {row.status ? "Active" : "Inactive"}
              </span>
            ),
          },
          { label: "Effective Date", key: "effective_date", badge: true },
          { label: "SSS EE / ER", key: "sss_display" },
          { label: "SSS MSC Max", key: "msc_display" },
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
            label: "Effective Date (YYYY-MM-DD)",
            value: form.effective_date,
            onChange: handleFieldChange("effective_date"),
            placeholder: "2026-07-07",
          },
          {
            label: "Status",
            value: form.status,
            onChange: handleFieldChange("status"),
            type: "select",
            options: [
              { value: "false", label: "Inactive" },
              {
                value: "true",
                label: "Active (only one schedule can be active at a time)",
              },
            ],
          },
          {
            label: "SSS — MSC Min",
            value: form.sss_msc_min,
            onChange: handleFieldChange("sss_msc_min"),
          },
          {
            label: "SSS — MSC Max",
            value: form.sss_msc_max,
            onChange: handleFieldChange("sss_msc_max"),
          },
          {
            label: "SSS — MSC Step",
            value: form.sss_msc_step,
            onChange: handleFieldChange("sss_msc_step"),
          },
          {
            label: "SSS — EE Rate (0.05 = 5%)",
            value: form.sss_ee_rate,
            onChange: handleFieldChange("sss_ee_rate"),
          },
          {
            label: "SSS — ER Rate (0.10 = 10%)",
            value: form.sss_er_rate,
            onChange: handleFieldChange("sss_er_rate"),
          },
          {
            label: "SSS — EC Threshold (MSC)",
            value: form.sss_ec_threshold,
            onChange: handleFieldChange("sss_ec_threshold"),
          },
          {
            label: "SSS — EC Amount (below threshold)",
            value: form.sss_ec_low,
            onChange: handleFieldChange("sss_ec_low"),
          },
          {
            label: "SSS — EC Amount (at/above threshold)",
            value: form.sss_ec_high,
            onChange: handleFieldChange("sss_ec_high"),
          },

          {
            label: "PhilHealth — Rate (0.05 = 5%)",
            value: form.phic_rate,
            onChange: handleFieldChange("phic_rate"),
          },
          {
            label: "PhilHealth — Salary Floor",
            value: form.phic_floor,
            onChange: handleFieldChange("phic_floor"),
          },
          {
            label: "PhilHealth — Salary Ceiling",
            value: form.phic_ceiling,
            onChange: handleFieldChange("phic_ceiling"),
          },

          {
            label: "Pag-IBIG — Low-Salary Threshold",
            value: form.hdmf_low_threshold,
            onChange: handleFieldChange("hdmf_low_threshold"),
          },
          {
            label: "Pag-IBIG — EE Rate Below Threshold",
            value: form.hdmf_ee_rate_low,
            onChange: handleFieldChange("hdmf_ee_rate_low"),
          },
          {
            label: "Pag-IBIG — EE Rate Above Threshold",
            value: form.hdmf_ee_rate_high,
            onChange: handleFieldChange("hdmf_ee_rate_high"),
          },
          {
            label: "Pag-IBIG — ER Rate",
            value: form.hdmf_er_rate,
            onChange: handleFieldChange("hdmf_er_rate"),
          },
          {
            label: "Pag-IBIG — Max Fund Salary (Cap)",
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
