import React, { useState, useEffect } from "react";
import {
  Table2,
  Settings,
  History,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import CustomerMaintenanceTable, {
  MaintenanceModal,
  DeleteModal,
  Toast,
} from "../components/customer_maintenance";

const fmtPeso = (n) =>
  `₱${Number(n).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
const fmtPct = (n) => `${(Number(n) * 100).toFixed(2)}%`;
const FieldLabel = ({ main, hint }) => (
  <span className="inline-flex flex-wrap items-baseline gap-1">
    <span className="font-medium text-gray-700">{main}</span>
    {hint && (
      <span className="text-xs font-normal text-gray-400">({hint})</span>
    )}
  </span>
);
// Fallback lang ito kung walang laman ang sss_rate_settings sa DB —
// dapat hindi ito umabot sa production, pero safety net kung sakaling
// hindi pa na-seed yung table.
const FALLBACK_RATES = {
  ee_rate: 0.05,
  er_rate: 0.1,
  ec_threshold_msc: 15000,
  ec_low: 10,
  ec_high: 30,
};

const emptyForm = {
  bracket_min: "",
  bracket_max: "",
  msc: "",
  ee_amount: "",
  er_amount: "",
  ec_amount: "",
};

const emptyRateForm = {
  ee_rate: "",
  er_rate: "",
  ec_threshold_msc: "",
  ec_low: "",
  ec_high: "",
};

// Adds display-friendly derived fields for the table columns.
const withDisplayFields = (row) => ({
  ...row,
  range_display:
    row.bracket_max === null || row.bracket_max === undefined
      ? `${fmtPeso(row.bracket_min)} and up`
      : `${fmtPeso(row.bracket_min)} – ${fmtPeso(row.bracket_max)}`,
  msc_display: fmtPeso(row.msc),
  ee_display: fmtPeso(row.ee_amount),
  er_display: fmtPeso(row.er_amount),
  ec_display: fmtPeso(row.ec_amount),
});

export default function SSSTableSetup() {
  const [brackets, setBrackets] = useState([]);
  const [search, setSearch] = useState("");
  const [fetching, setFetching] = useState(true);

  // Active rates — loaded from DB, hindi na hardcoded
  const [rates, setRates] = useState(FALLBACK_RATES);
  const [ratesLoading, setRatesLoading] = useState(true);

  // Rate history — lahat ng rows (active at inactive), for viewing/reactivating
  const [rateHistory, setRateHistory] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [activatingId, setActivatingId] = useState(null);

  // Bracket Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);

  // Rate Settings Modal
  const [rateModalOpen, setRateModalOpen] = useState(false);
  const [rateForm, setRateForm] = useState(emptyRateForm);
  const [rateSaving, setRateSaving] = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Rate History Delete
  const [deleteRateTarget, setDeleteRateTarget] = useState(null);
  const [deleteRateLoading, setDeleteRateLoading] = useState(false);

  // Toast
  const [toast, setToast] = useState({ msg: "", type: "success" });
  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: "", type: "success" }), 3000);
  };

  // ── Fetch active rate settings ──
  const fetchRates = async () => {
    setRatesLoading(true);
    const { data, error } = await supabase
      .from("sss_rate_settings")
      .select("*")
      .eq("is_active", true)
      .order("effective_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      setRates(data);
    } else {
      // Walang active row sa DB — gamitin muna yung fallback constants
      setRates(FALLBACK_RATES);
    }
    setRatesLoading(false);
  };

  // Fetch lahat ng rate rows (active + inactive) — for the history panel
  const fetchRateHistory = async () => {
    setHistoryLoading(true);
    const { data, error } = await supabase
      .from("sss_rate_settings")
      .select("*")
      .order("effective_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (!error) setRateHistory(data || []);
    setHistoryLoading(false);
  };

  // Reactivate an old/inactive rate schedule: deactivate whatever is
  // currently active, then flip this chosen row back to active.
  // Effective_date is refreshed to today so it's clear kung kailan siya
  // na-reactivate, pero same row lang — walang duplicate insert.
  const handleActivateRate = async (rateRow) => {
    setActivatingId(rateRow.id);

    const { error: deactivateError } = await supabase
      .from("sss_rate_settings")
      .update({ is_active: false })
      .eq("is_active", true);

    if (deactivateError) {
      showToast(`Failed to activate: ${deactivateError.message}`, "error");
      setActivatingId(null);
      return;
    }

    const { error: activateError } = await supabase
      .from("sss_rate_settings")
      .update({
        is_active: true,
        effective_date: new Date().toISOString().slice(0, 10),
      })
      .eq("id", rateRow.id);

    if (activateError) {
      showToast(`Failed to activate: ${activateError.message}`, "error");
    } else {
      showToast("Rate schedule activated!");
      await fetchRates();
      await fetchRateHistory();
    }

    setActivatingId(null);
  };

  // Delete an inactive rate schedule row permanently. Active row can't be
  // deleted here — dapat mag-activate muna ng ibang rate bago madelete ito.
  const handleDeleteRate = async () => {
    if (!deleteRateTarget) return;
    setDeleteRateLoading(true);

    const { error } = await supabase
      .from("sss_rate_settings")
      .delete()
      .eq("id", deleteRateTarget.id);

    if (error) {
      showToast(`Failed to delete rate schedule: ${error.message}`, "error");
    } else {
      showToast("Rate schedule deleted!");
      await fetchRateHistory();
    }

    setDeleteRateLoading(false);
    setDeleteRateTarget(null);
  };

  const toggleHistory = () => {
    const next = !historyOpen;
    setHistoryOpen(next);
    if (next && rateHistory.length === 0) fetchRateHistory();
  };

  // Given an MSC value, derive EE/ER/EC gamit ang *current active rates* (DB-driven, hindi hardcoded)
  const computeFromMSC = (msc) => {
    const m = parseFloat(msc);
    if (isNaN(m) || m <= 0) return { ee: "", er: "", ec: "" };
    return {
      ee: Math.round(m * rates.ee_rate * 100) / 100,
      er: Math.round(m * rates.er_rate * 100) / 100,
      ec: m < rates.ec_threshold_msc ? rates.ec_low : rates.ec_high,
    };
  };

  // ── Fetch brackets ──
  const fetchBrackets = async () => {
    setFetching(true);
    const { data, error } = await supabase
      .from("sss_bracket_table")
      .select("*")
      .order("bracket_min", { ascending: true });
    if (!error) setBrackets((data || []).map(withDisplayFields));
    setFetching(false);
  };

  useEffect(() => {
    fetchRates();
    fetchBrackets();
  }, []);

  // ── Open Add ──
  const openAdd = () => {
    setEditTarget(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  // ── Open Edit ──
  const openEdit = (row) => {
    setEditTarget(row);
    setForm({
      bracket_min: String(row.bracket_min ?? ""),
      bracket_max:
        row.bracket_max === null || row.bracket_max === undefined
          ? ""
          : String(row.bracket_max),
      msc: String(row.msc ?? ""),
      ee_amount: String(row.ee_amount ?? ""),
      er_amount: String(row.er_amount ?? ""),
      ec_amount: String(row.ec_amount ?? ""),
    });
    setModalOpen(true);
  };

  const handleFieldChange = (key) => (val) =>
    setForm((p) => ({ ...p, [key]: val }));

  // MSC has a dedicated handler: typing it auto-fills EE/ER/EC gamit ang
  // kasalukuyang active rates mula sa DB. Editable pa rin pagkatapos
  // kung sakaling may exception sa particular bracket.
  const handleMSCChange = (val) => {
    const { ee, er, ec } = computeFromMSC(val);
    setForm((p) => ({
      ...p,
      msc: val,
      ee_amount: ee === "" ? p.ee_amount : String(ee),
      er_amount: er === "" ? p.er_amount : String(er),
      ec_amount: ec === "" ? p.ec_amount : String(ec),
    }));
  };

  // ── Submit Bracket ──
  const handleSubmit = async () => {
    const min = parseFloat(form.bracket_min);
    const msc = parseFloat(form.msc);
    const ee = parseFloat(form.ee_amount);
    const er = parseFloat(form.er_amount);
    const ec = parseFloat(form.ec_amount);

    if (isNaN(min))
      return showToast("Bracket minimum salary is required.", "error");
    if (isNaN(msc)) return showToast("MSC is required.", "error");
    if (isNaN(ee)) return showToast("EE amount is required.", "error");
    if (isNaN(er)) return showToast("ER amount is required.", "error");
    if (isNaN(ec)) return showToast("EC amount is required.", "error");

    const max =
      form.bracket_max.trim() === "" ? null : parseFloat(form.bracket_max);
    if (max !== null && max <= min) {
      return showToast(
        "Bracket maximum must be greater than the minimum.",
        "error",
      );
    }

    setLoading(true);

    const payload = {
      bracket_min: min,
      bracket_max: max,
      msc,
      ee_amount: ee,
      er_amount: er,
      ec_amount: ec,
    };

    if (editTarget) {
      const { error } = await supabase
        .from("sss_bracket_table")
        .update(payload)
        .eq("id", editTarget.id);
      if (error) showToast(`Update failed: ${error.message}`, "error");
      else {
        showToast("Bracket updated!");
        fetchBrackets();
      }
    } else {
      const { error } = await supabase
        .from("sss_bracket_table")
        .insert(payload);
      if (error) showToast(`Insert failed: ${error.message}`, "error");
      else {
        showToast("Bracket added!");
        fetchBrackets();
      }
    }
    setLoading(false);
    setModalOpen(false);
  };

  // ── Delete ──
  const handleDelete = async () => {
    setDeleteLoading(true);
    const { error } = await supabase
      .from("sss_bracket_table")
      .delete()
      .eq("id", deleteTarget.id);
    if (error) showToast("Delete failed.", "error");
    else {
      showToast("Bracket deleted!");
      fetchBrackets();
    }
    setDeleteLoading(false);
    setDeleteTarget(null);
  };

  // ── Rate Settings: open modal prefilled with current active rates ──
  const openRateSettings = () => {
    setRateForm({
      ee_rate: String((rates.ee_rate * 100).toFixed(2)), // ipapakita bilang % sa UI
      er_rate: String((rates.er_rate * 100).toFixed(2)),
      ec_threshold_msc: String(rates.ec_threshold_msc ?? ""),
      ec_low: String(rates.ec_low ?? ""),
      ec_high: String(rates.ec_high ?? ""),
    });
    setRateModalOpen(true);
  };

  const handleRateFieldChange = (key) => (val) =>
    setRateForm((p) => ({ ...p, [key]: val }));

  // Save new rate schedule: i-deactivate lahat ng dating active row,
  // tapos mag-insert ng bagong row na siyang magiging bagong active rate.
  // Ganito para may audit trail pa rin tayo ng history ng rates (hindi na-overwrite).
  const handleRateSubmit = async () => {
    const eeRate = parseFloat(rateForm.ee_rate) / 100;
    const erRate = parseFloat(rateForm.er_rate) / 100;
    const ecThreshold = parseFloat(rateForm.ec_threshold_msc);
    const ecLow = parseFloat(rateForm.ec_low);
    const ecHigh = parseFloat(rateForm.ec_high);

    if ([eeRate, erRate, ecThreshold, ecLow, ecHigh].some((v) => isNaN(v))) {
      return showToast("Please fill in all rate fields.", "error");
    }

    setRateSaving(true);

    // 1. Deactivate current active rate(s)
    const { error: deactivateError } = await supabase
      .from("sss_rate_settings")
      .update({ is_active: false })
      .eq("is_active", true);

    if (deactivateError) {
      showToast(`Failed to update rates: ${deactivateError.message}`, "error");
      setRateSaving(false);
      return;
    }

    // 2. Insert new active rate schedule
    const { error: insertError } = await supabase
      .from("sss_rate_settings")
      .insert({
        ee_rate: eeRate,
        er_rate: erRate,
        ec_threshold_msc: ecThreshold,
        ec_low: ecLow,
        ec_high: ecHigh,
        effective_date: new Date().toISOString().slice(0, 10),
        is_active: true,
      });

    if (insertError) {
      showToast(`Failed to save new rates: ${insertError.message}`, "error");
    } else {
      showToast(
        "SSS rates updated! This will now be used for auto-compute going forward.",
      );
      await fetchRates();
      if (historyOpen) await fetchRateHistory();
    }

    setRateSaving(false);
    setRateModalOpen(false);
  };

  // ── Filter ──
  const filtered = brackets.filter(
    (b) =>
      b.range_display.toLowerCase().includes(search.toLowerCase()) ||
      b.msc_display.toLowerCase().includes(search.toLowerCase()) ||
      b.ee_display.toLowerCase().includes(search.toLowerCase()) ||
      b.er_display.toLowerCase().includes(search.toLowerCase()) ||
      b.ec_display.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-gray-500">
          {!ratesLoading && (
            <>
              Current rates: EE {fmtPct(rates.ee_rate)} · ER{" "}
              {fmtPct(rates.er_rate)} · EC {fmtPeso(rates.ec_low)} (below{" "}
              {fmtPeso(rates.ec_threshold_msc)}) / {fmtPeso(rates.ec_high)} (at
              or above)
            </>
          )}
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={toggleHistory}
            className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-800 font-medium"
          >
            <History size={16} />
            Rate History
            {historyOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <button
            type="button"
            onClick={openRateSettings}
            className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            <Settings size={16} />
            Edit SSS Rates
          </button>
        </div>
      </div>

      {historyOpen && (
        <div className="mb-4 overflow-hidden border border-gray-200 rounded-lg">
          {historyLoading ? (
            <div className="p-4 text-sm text-gray-500">
              Loading rate history...
            </div>
          ) : rateHistory.length === 0 ? (
            <div className="p-4 text-sm text-gray-500">
              No rate history found.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs text-gray-500 uppercase bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Effective Date</th>
                  <th className="px-3 py-2 text-left">EE Rate</th>
                  <th className="px-3 py-2 text-left">ER Rate</th>
                  <th className="px-3 py-2 text-left">EC Threshold (MSC)</th>
                  <th className="px-3 py-2 text-left">EC Low / High</th>
                  <th className="px-3 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rateHistory.map((r) => (
                  <tr
                    key={r.id}
                    title={
                      r.is_active
                        ? `Currently active since ${r.effective_date}`
                        : `Was active until it was replaced. Effective date on record: ${r.effective_date}`
                    }
                    className={r.is_active ? "bg-green-50/50" : ""}
                  >
                    <td className="px-3 py-2">
                      {r.is_active ? (
                        <span className="inline-flex items-center gap-1 font-medium text-green-700">
                          <CheckCircle2 size={14} />
                          Active
                        </span>
                      ) : (
                        <span className="text-gray-400">Inactive</span>
                      )}
                    </td>
                    <td className="px-3 py-2">{r.effective_date}</td>
                    <td className="px-3 py-2">{fmtPct(r.ee_rate)}</td>
                    <td className="px-3 py-2">{fmtPct(r.er_rate)}</td>
                    <td className="px-3 py-2">{fmtPeso(r.ec_threshold_msc)}</td>
                    <td className="px-3 py-2">
                      {fmtPeso(r.ec_low)} / {fmtPeso(r.ec_high)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-3">
                        {!r.is_active && (
                          <button
                            type="button"
                            onClick={() => handleActivateRate(r)}
                            disabled={activatingId === r.id}
                            title="Reactivate this rate schedule — it will become the current active rate used for auto-compute"
                            className="text-xs font-medium text-blue-600 hover:text-blue-800 disabled:opacity-50"
                          >
                            {activatingId === r.id
                              ? "Activating..."
                              : "Activate"}
                          </button>
                        )}
                        {!r.is_active && (
                          <button
                            type="button"
                            onClick={() => setDeleteRateTarget(r)}
                            title="Permanently delete this rate schedule"
                            className="text-xs font-medium text-red-600 hover:text-red-800"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <CustomerMaintenanceTable
        title="SSS Bracket Table"
        icon={<Table2 size={22} className="text-blue-600" />}
        totalCount={brackets.length}
        search={search}
        onSearchChange={setSearch}
        onAdd={openAdd}
        addLabel="Add Bracket"
        columns={[
          { label: "Salary Range", key: "range_display", badge: true },
          { label: "MSC", key: "msc_display" },
          { label: "EE Share", key: "ee_display" },
          { label: "ER Share", key: "er_display" },
          { label: "EC", key: "ec_display" },
        ]}
        rows={filtered}
        onEdit={openEdit}
        onDelete={setDeleteTarget}
        fetching={fetching}
        emptyMessage="No brackets set up yet. Add each row from your SSS schedule (e.g. Excel table) one at a time."
      />

      <MaintenanceModal
        open={modalOpen}
        title={editTarget ? "Edit Bracket" : "Add Bracket"}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        loading={loading}
        fields={[
          {
            label: <FieldLabel main="Salary Minimum" hint="inclusive" />,
            value: form.bracket_min,
            onChange: handleFieldChange("bracket_min"),
          },
          {
            label: (
              <FieldLabel
                main="Salary Maximum"
                hint="inclusive, leave blank for open-ended/topmost bracket"
              />
            ),
            value: form.bracket_max,
            onChange: handleFieldChange("bracket_max"),
          },
          {
            label: <FieldLabel main="MSC" hint="Monthly Salary Credit" />,
            value: form.msc,
            onChange: handleMSCChange,
          },
          {
            label: (
              <FieldLabel
                main="EE Amount"
                hint="auto-computed from MSC — editable"
              />
            ),
            value: form.ee_amount,
            onChange: handleFieldChange("ee_amount"),
          },
          {
            label: (
              <FieldLabel
                main="ER Amount"
                hint="auto-computed from MSC — editable"
              />
            ),
            value: form.er_amount,
            onChange: handleFieldChange("er_amount"),
          },
          {
            label: (
              <FieldLabel
                main="EC Amount"
                hint="auto-computed from MSC — flat, not %, editable"
              />
            ),
            value: form.ec_amount,
            onChange: handleFieldChange("ec_amount"),
          },
        ]}
      />

      <MaintenanceModal
        open={rateModalOpen}
        title="Edit SSS Contribution Rates"
        onClose={() => setRateModalOpen(false)}
        onSubmit={handleRateSubmit}
        loading={rateSaving}
        fields={[
          {
            label: (
              <FieldLabel main="EE Rate (%)" hint="employee share of MSC" />
            ),
            value: rateForm.ee_rate,
            onChange: handleRateFieldChange("ee_rate"),
            placeholder: "e.g. 5",
          },
          {
            label: (
              <FieldLabel main="ER Rate (%)" hint="employer share of MSC" />
            ),
            value: rateForm.er_rate,
            onChange: handleRateFieldChange("er_rate"),
            placeholder: "e.g. 10",
          },
          {
            label: (
              <FieldLabel
                main="EC Threshold (MSC)"
                hint="below this uses EC Low, at/above uses EC High"
              />
            ),
            value: rateForm.ec_threshold_msc,
            onChange: handleRateFieldChange("ec_threshold_msc"),
            placeholder: "e.g. 15000",
          },
          {
            label: (
              <FieldLabel
                main="EC Amount — Low"
                hint="flat ₱, for MSC below threshold"
              />
            ),
            value: rateForm.ec_low,
            onChange: handleRateFieldChange("ec_low"),
            placeholder: "e.g. 10",
          },
          {
            label: (
              <FieldLabel
                main="EC Amount — High"
                hint="flat ₱, for MSC at/above threshold"
              />
            ),
            value: rateForm.ec_high,
            onChange: handleRateFieldChange("ec_high"),
            placeholder: "e.g. 30",
          },
        ]}
      />

      <DeleteModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleteLoading}
      />

      <DeleteModal
        open={!!deleteRateTarget}
        onClose={() => setDeleteRateTarget(null)}
        onConfirm={handleDeleteRate}
        loading={deleteRateLoading}
      />
      <Toast msg={toast.msg} type={toast.type} />
    </>
  );
}
