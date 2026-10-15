import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
  AlertTriangle,
  Link2,
  ToggleLeft,
  ToggleRight,
  Calculator,
} from "lucide-react";

/* ── Shared look (same as tax_type / business_registration / etc.) ── */
const inputCls   = "w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-md focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-200";
const labelCls   = "block mb-1 text-xs font-medium text-gray-500";
const btnPrimary = "flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-white transition bg-gray-900 rounded-md hover:bg-black disabled:opacity-50";
const btnGhost   = "px-3.5 py-2 text-sm font-medium text-gray-600 transition bg-white border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50";
const btnDanger  = "flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-white transition bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50";
const iconBtn    = "p-1.5 text-gray-400 transition rounded-md hover:bg-gray-100 hover:text-black";

const Toast = ({ toast }) =>
  toast && (
    <div
      className={`fixed z-50 flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-white border rounded-md shadow-lg bottom-6 right-6 ${
        toast.type === "error" ? "text-red-700 border-red-200" : "text-gray-800 border-gray-200"
      }`}
    >
      {toast.type === "error" ? <AlertTriangle size={14} /> : <Check size={14} />}
      {toast.msg}
    </div>
  );

const Modal = ({ title, subtitle, onClose, children }) => (
  <div
    className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/40"
    onClick={(e) => e.target === e.currentTarget && onClose()}
  >
    <div className="w-full max-w-md max-h-[90vh] flex flex-col bg-white border border-gray-200 rounded-lg shadow-xl">
      <div className="flex items-start justify-between px-6 pt-5 shrink-0">
        <div>
          <h2 className="text-base font-semibold text-gray-800">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
        </div>
        <button type="button" onClick={onClose} className={iconBtn}>
          <X size={16} />
        </button>
      </div>
      {children}
    </div>
  </div>
);

const COMPUTATION_TYPES = [
  { value: "fixed", label: "Fixed Amount" },
  { value: "percentage", label: "Percentage" },
  { value: "table", label: "Table (Sales/Purchase)" },
  { value: "manual", label: "Manual (editable per billing)" },
];

function emptyForm() {
  return {
    id: null,
    coa_id: "",          // <- source of truth na ngayon, hindi na freeform text
    tax_type: "",
    label: "",
    computation_type: "fixed",
    default_fixed_amount: "",
    default_rate: "",
    is_active: true,
  };
}

// gumawa ng safe internal key mula sa account name (para sa tax_type column)
const slugify = (s) =>
  s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

// ── Live preview: Percentage — para makita agad ang tax kapag nag-set ng rate ──
function PercentagePreview({ form, setForm }) {
  const [previewAmount, setPreviewAmount] = useState("");
  const rate = parseFloat(form.default_rate) || 0;
  const base = parseFloat(previewAmount) || 0;
  const tax = base * (rate / 100);
  const fmt = (n) => Number(n).toLocaleString("en-PH", { minimumFractionDigits: 2 });

  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Default Rate (%)</label>
          <input
            type="number"
            step="0.01"
            value={form.default_rate}
            onChange={(e) => setForm((f) => ({ ...f, default_rate: e.target.value }))}
            placeholder="0"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Try an Amount (₱)</label>
          <input
            type="number"
            step="0.01"
            value={previewAmount}
            onChange={(e) => setPreviewAmount(e.target.value)}
            placeholder="e.g. 20000"
            className={inputCls}
          />
        </div>
      </div>
      <div className="flex items-center justify-between px-3 py-2 mt-2 text-xs border border-gray-200 rounded-md bg-gray-50">
        <span className="text-gray-500">Preview Tax Due</span>
        <span className="font-mono font-semibold text-gray-800">₱{fmt(tax)}</span>
      </div>
      <p className="mt-1 text-xs text-gray-400">
        Ang "Try an Amount" ay para lang sa pag-preview — hindi ito nase-save.
      </p>
    </div>
  );
}

// ── Live preview: Table (Sales/Purchase) — Output/Input/Payable ──
function TablePreview({ form, setForm }) {
  const [previewSales, setPreviewSales] = useState("");
  const [previewPurchase, setPreviewPurchase] = useState("");
  const rate = parseFloat(form.default_rate) || 0;
  const sales = parseFloat(previewSales) || 0;
  const purchase = parseFloat(previewPurchase) || 0;
  const outputTax = sales * (rate / 100);
  const inputTax = purchase * (rate / 100);
  const payable = outputTax - inputTax;
  const fmt = (n) => Number(n).toLocaleString("en-PH", { minimumFractionDigits: 2 });

  return (
    <div>
      <div>
        <label className={labelCls}>Default Rate (%)</label>
        <input
          type="number"
          step="0.01"
          value={form.default_rate}
          onChange={(e) => setForm((f) => ({ ...f, default_rate: e.target.value }))}
          placeholder="0"
          className={`${inputCls} max-w-[120px]`}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 mt-3">
        <div>
          <label className={labelCls}>Try Sales (₱)</label>
          <input
            type="number"
            step="0.01"
            value={previewSales}
            onChange={(e) => setPreviewSales(e.target.value)}
            placeholder="e.g. 20000"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Try Purchase (₱)</label>
          <input
            type="number"
            step="0.01"
            value={previewPurchase}
            onChange={(e) => setPreviewPurchase(e.target.value)}
            placeholder="e.g. 10000"
            className={inputCls}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 px-3 py-2 mt-2 text-xs border border-gray-200 rounded-md bg-gray-50">
        <div>
          <p className="text-xs text-gray-400">Output Tax</p>
          <p className="font-mono font-semibold text-gray-800">₱{fmt(outputTax)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Input Tax</p>
          <p className="font-mono font-semibold text-gray-800">₱{fmt(inputTax)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Payable</p>
          <p className={`font-mono font-semibold ${payable < 0 ? "text-red-600" : "text-gray-800"}`}>
            ₱{fmt(payable)}
          </p>
        </div>
      </div>
      <p className="mt-1 text-xs text-gray-400">
        Ang "Try Sales/Purchase" ay para lang sa pag-preview — hindi ito nase-save.
      </p>
    </div>
  );
}

/* ════════════════════════════ */
export default function TaxSetup() {
  const [rows, setRows] = useState([]);
  const [linkedCoaByTaxId, setLinkedCoaByTaxId] = useState({}); // { [tax_setup.id]: [coaRow, ...] }
  const [coaOptions, setCoaOptions] = useState([]); // mga COA account na pwede pang i-link (walang tax_setup_id)
  const [loading, setLoading] = useState(true);
  const [loadingCoaOptions, setLoadingCoaOptions] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [deletingRow, setDeletingRow] = useState(null);
  const [deleteSaving, setDeleteSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const flash = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ── FETCH: tax_setup rows ────────────────────────────────────────────────
  const fetchRows = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("tax_setup")
      .select("*")
      .order("label", { ascending: true });
    if (!error) setRows(data || []);
    setLoading(false);
  }, []);

  // ── FETCH: COA accounts already linked to a tax_setup (para sa "Linked Account" column) ──
  const fetchLinkedCoa = useCallback(async () => {
    const { data, error } = await supabase
      .from("chart_of_accounts")
      .select("id, code, account_name, tax_setup_id, agency_id, government_agencies(name)")
      .not("tax_setup_id", "is", null);
    if (error) return;
    const map = {};
    (data || []).forEach((c) => {
      if (!map[c.tax_setup_id]) map[c.tax_setup_id] = [];
      map[c.tax_setup_id].push(c);
    });
    setLinkedCoaByTaxId(map);
  }, []);

  // ── FETCH: COA accounts na WALA pang tax_setup_id (pwedeng i-link) ───────
  const fetchCoaOptions = useCallback(async () => {
    setLoadingCoaOptions(true);
    const { data, error } = await supabase
      .from("chart_of_accounts")
      .select("id, code, account_name, agency_id, government_agencies(name)")
      .is("tax_setup_id", null)
      .eq("is_active", true)
      .order("account_name", { ascending: true });
    if (!error) setCoaOptions(data || []);
    setLoadingCoaOptions(false);
  }, []);

  const refreshAll = useCallback(() => {
    fetchRows();
    fetchLinkedCoa();
    fetchCoaOptions();
  }, [fetchRows, fetchLinkedCoa, fetchCoaOptions]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const openAdd = () => {
    setForm(emptyForm());
    setShowForm(true);
  };

  const openEdit = (row) => {
    const linkedCoa = (linkedCoaByTaxId[row.id] || [])[0] || null;
    setForm({
      id: row.id,
      coa_id: linkedCoa?.id || "",
      tax_type: row.tax_type,
      label: row.label,
      computation_type: row.computation_type,
      default_fixed_amount: row.default_fixed_amount ?? "",
      default_rate: row.default_rate ?? "",
      is_active: row.is_active,
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setForm(emptyForm());
  };

  // kapag pumili ng account sa dropdown, auto-fill agad ang label
  const handleSelectCoa = (coaId) => {
    const coa = coaOptions.find((c) => String(c.id) === String(coaId));
    setForm((f) => ({
      ...f,
      coa_id: coaId,
      label: coa ? coa.account_name : f.label,
    }));
  };

  const handleSave = async () => {
    if (!form.id && !form.coa_id) {
      flash("Pumili muna ng account mula sa Chart of Accounts.", "error");
      return;
    }
    if (!form.label.trim()) {
      flash("Label is required.", "error");
      return;
    }

    setSaving(true);
    try {
      if (form.id) {
        // ── EDIT: computation rules lang ang binabago, hindi na yung account link ──
        const payload = {
          computation_type: form.computation_type,
          default_fixed_amount:
            form.computation_type === "fixed" ? parseFloat(form.default_fixed_amount) || 0 : null,
          default_rate:
            form.computation_type !== "fixed" ? parseFloat(form.default_rate) || 0 : null,
          is_active: form.is_active,
          updated_at: new Date().toISOString(),
        };
        const { error } = await supabase.from("tax_setup").update(payload).eq("id", form.id);
        if (error) throw error;
        flash("Tax config updated.");
      } else {
        // ── ADD: gumawa ng tax_setup row batay sa napiling COA account ──
        const selectedCoa = coaOptions.find((c) => String(c.id) === String(form.coa_id));
        const payload = {
          tax_type: slugify(selectedCoa.account_name),
          label: selectedCoa.account_name,
          computation_type: form.computation_type,
          default_fixed_amount:
            form.computation_type === "fixed" ? parseFloat(form.default_fixed_amount) || 0 : null,
          default_rate:
            form.computation_type !== "fixed" ? parseFloat(form.default_rate) || 0 : null,
          is_active: form.is_active,
          updated_at: new Date().toISOString(),
        };
        const { data: inserted, error } = await supabase
          .from("tax_setup")
          .insert([payload])
          .select()
          .single();
        if (error) throw error;

        // i-link pabalik sa chart_of_accounts
        const { error: linkError } = await supabase
          .from("chart_of_accounts")
          .update({ tax_setup_id: inserted.id })
          .eq("id", selectedCoa.id);
        if (linkError) throw linkError;

        flash(`"${selectedCoa.account_name}" naka-configure na bilang tax.`);
      }
      closeForm();
      refreshAll();
    } catch (err) {
      if (err.message?.includes("duplicate") || err.code === "23505") {
        flash("May existing na config na ang account na ito.", "error");
      } else {
        flash(`Error: ${err.message}`, "error");
      }
    }
    setSaving(false);
  };

  const toggleActive = async (row) => {
    const { error } = await supabase
      .from("tax_setup")
      .update({ is_active: !row.is_active })
      .eq("id", row.id);
    if (!error) fetchRows();
  };

  const handleDelete = async () => {
    if (!deletingRow) return;
    setDeleteSaving(true);

    // 1. tanggalin muna ang link sa mga naka-connect na COA account
    const linked = linkedCoaByTaxId[deletingRow.id] || [];
    if (linked.length) {
      const { error: unlinkError } = await supabase
        .from("chart_of_accounts")
        .update({ tax_setup_id: null })
        .in("id", linked.map((c) => c.id));
      if (unlinkError) {
        flash(`Error unlinking account: ${unlinkError.message}`, "error");
        setDeleteSaving(false);
        return;
      }
    }

    // 2. saka i-delete ang tax_setup row
    const { error } = await supabase.from("tax_setup").delete().eq("id", deletingRow.id);
    if (!error) {
      flash("Tax config deleted — account is now available for re-linking.");
      refreshAll();
    } else {
      flash(`Error: ${error.message}`, "error");
    }
    setDeleteSaving(false);
    setDeletingRow(null);
  };

  const renderDefault = (row) =>
    row.computation_type === "fixed"
      ? `₱${Number(row.default_fixed_amount || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`
      : `${Number(row.default_rate || 0)}%`;

  /* ════════════ RENDER ════════════ */
  return (
    <div>
      <Toast toast={toast} />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
        <div className="flex items-center gap-3">
          <Calculator size={26} strokeWidth={1.5} className="text-black" />
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Tax Setup</h2>
            <p className="text-xs text-gray-500">
              Ilink ang computation rules (Fixed / Percentage / Table / Manual) sa isang existing account mula sa Chart of Accounts
            </p>
          </div>
        </div>
        <button onClick={openAdd} className={btnPrimary}>
          <Plus size={14} /> Configure Tax
        </button>
      </div>

      {/* Table */}
      <div className="overflow-hidden bg-white border border-gray-200 rounded-lg">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-100 bg-gray-50">
            <tr>
              <th className="px-4 py-2.5 text-xs font-medium text-left text-gray-500">Linked Account</th>
              <th className="px-4 py-2.5 text-xs font-medium text-left text-gray-500">Computation</th>
              <th className="px-4 py-2.5 text-xs font-medium text-left text-gray-500">Default</th>
              <th className="w-24 px-4 py-2.5 text-xs font-medium text-left text-gray-500">Status</th>
              <th className="w-24 px-4 py-2.5 text-xs font-medium text-right text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="py-12 text-center text-gray-400">Loading...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={5} className="py-12 text-center text-gray-400">Wala pang naka-configure na tax.</td></tr>
            ) : (
              rows.map((row) => {
                const linked = (linkedCoaByTaxId[row.id] || [])[0];
                return (
                  <tr key={row.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="flex items-center gap-1.5 text-gray-800">
                        <Link2 size={12} className="text-gray-300" />
                        {linked ? linked.account_name : row.label}
                      </p>
                      <p className="mt-0.5 font-mono text-xs text-gray-400">
                        {linked?.code || "—"} · {linked?.government_agencies?.name || "unlinked"}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-gray-600 capitalize">{row.computation_type}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 font-mono text-xs text-gray-600 bg-gray-100 rounded">
                        {renderDefault(row)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleActive(row)}
                        title={row.is_active ? "Active" : "Inactive"}
                        className="flex items-center"
                      >
                        {row.is_active ? (
                          <ToggleRight size={24} strokeWidth={1.5} className="text-gray-900" />
                        ) : (
                          <ToggleLeft size={24} strokeWidth={1.5} className="text-gray-300" />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(row)} title="Edit" className={iconBtn}>
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => setDeletingRow(row)} title="Delete" className={iconBtn}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Add / Edit modal */}
      {showForm && (
        <Modal
          title={form.id ? "Edit Tax Config" : "Configure Tax for an Account"}
          subtitle={form.id ? "Update the computation rules." : "Pick an account and set how its tax is computed."}
          onClose={closeForm}
        >
          <form
            onSubmit={(e) => { e.preventDefault(); handleSave(); }}
            className="flex flex-col flex-1 min-h-0"
          >
            <div className="flex-1 px-6 py-5 space-y-4 overflow-y-auto">
              {/* Account selection — DROPDOWN na mula sa Chart of Accounts, hindi na text input */}
              <div>
                <label className={labelCls}>Account (from Chart of Accounts)</label>
                {form.id ? (
                  // hindi na pwedeng palitan ang link pag edit — para hindi masira ang existing na billing history
                  <input
                    type="text"
                    value={form.label}
                    disabled
                    className={`${inputCls} bg-gray-50 text-gray-500 cursor-not-allowed`}
                  />
                ) : loadingCoaOptions ? (
                  <p className="text-xs text-gray-400">Loading accounts…</p>
                ) : coaOptions.length === 0 ? (
                  <p className="text-xs text-red-600">
                    Wala nang available na account — lahat naka-configure na, o wala pang gawang account sa Chart of Accounts.
                  </p>
                ) : (
                  <select value={form.coa_id} onChange={(e) => handleSelectCoa(e.target.value)} className={inputCls}>
                    <option value="">— Pumili ng account —</option>
                    {Object.entries(
                      coaOptions.reduce((acc, c) => {
                        const agency = c.government_agencies?.name || "Other";
                        (acc[agency] ??= []).push(c);
                        return acc;
                      }, {})
                    ).map(([agency, accts]) => (
                      <optgroup key={agency} label={agency}>
                        {accts.map((c) => (
                          <option key={c.id} value={c.id}>{c.account_name}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                )}
                <p className="mt-1 text-xs text-gray-400">
                  Ang listahan lang dito ay mga account na wala pang naka-link na tax computation.
                </p>
              </div>

              <div>
                <label className={labelCls}>Computation Type</label>
                <select
                  value={form.computation_type}
                  onChange={(e) => setForm((f) => ({ ...f, computation_type: e.target.value }))}
                  className={inputCls}
                >
                  {COMPUTATION_TYPES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              {form.computation_type === "fixed" && (
                <div>
                  <label className={labelCls}>Default Amount (₱)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.default_fixed_amount}
                    onChange={(e) => setForm((f) => ({ ...f, default_fixed_amount: e.target.value }))}
                    placeholder="0.00"
                    className={inputCls}
                  />
                </div>
              )}

              {form.computation_type === "percentage" && (
                <PercentagePreview form={form} setForm={setForm} />
              )}

              {form.computation_type === "table" && (
                <TablePreview form={form} setForm={setForm} />
              )}

              {form.computation_type === "manual" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Default Rate (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={form.default_rate}
                      onChange={(e) => setForm((f) => ({ ...f, default_rate: e.target.value }))}
                      placeholder="0"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Default Amount (₱)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={form.default_fixed_amount}
                      onChange={(e) => setForm((f) => ({ ...f, default_fixed_amount: e.target.value }))}
                      placeholder="0.00"
                      className={inputCls}
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <span className="text-sm text-gray-600">Active</span>
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, is_active: !f.is_active }))}
                  className="flex items-center"
                >
                  {form.is_active ? (
                    <ToggleRight size={26} strokeWidth={1.5} className="text-gray-900" />
                  ) : (
                    <ToggleLeft size={26} strokeWidth={1.5} className="text-gray-300" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 shrink-0">
              <button type="button" onClick={closeForm} disabled={saving} className={btnGhost}>
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || (!form.id && !form.coa_id)}
                className={btnPrimary}
              >
                {saving ? "Saving..." : form.id ? "Save Changes" : "Save"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete modal */}
      {deletingRow && (
        <Modal
          title="Alisin ang tax config?"
          subtitle="This action cannot be undone."
          onClose={() => setDeletingRow(null)}
        >
          <div className="px-6 py-5">
            <p className="px-3 py-2 mb-3 text-sm text-gray-700 border border-gray-200 rounded-md bg-gray-50">
              {deletingRow.label}
            </p>
            <p className="mb-5 text-xs text-gray-500">
              Ang naka-link na account ay babalik sa "unlinked" state (magagamit ulit sa dropdown).
              Hindi mata-touch ang existing client tax data — ipapayo lang na i-review iyon.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeletingRow(null)} disabled={deleteSaving} className={btnGhost}>
                Cancel
              </button>
              <button onClick={handleDelete} disabled={deleteSaving} className={btnDanger}>
                {deleteSaving ? "Deleting..." : <><Trash2 size={14} /> Delete</>}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}