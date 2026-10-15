import React, { useState, useEffect } from "react";
import { Plus, Trash2, Pencil, Search, X, Home } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { DeleteModal, Toast } from "../components/customer_maintenance";

/* ── Shared look (same as tax_type / business_registration / etc.) ── */
const inputCls   = "w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-md focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-200";
const cellInput  = "w-full px-2 py-1.5 text-xs bg-white border border-gray-200 rounded-md focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-200";
const btnPrimary = "flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-white transition bg-gray-900 rounded-md hover:bg-black disabled:opacity-50";
const btnGhost   = "px-3.5 py-2 text-sm font-medium text-gray-600 transition bg-white border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50";
const iconBtn    = "p-1.5 text-gray-400 transition rounded-md hover:bg-gray-100 hover:text-black";

// ─── Auto-generate next rf_code ──────────────────────────────────────
const generateNextCode = (existingList) => {
  const prefix = "RF_";
  let maxNum = 0;
  existingList.forEach((v) => {
    if (v.rf_code?.startsWith(prefix)) {
      const num = parseInt(v.rf_code.replace(prefix, ""), 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }
  });
  return `${prefix}${String(maxNum + 1).padStart(3, "0")}`;
};

const emptyRow = (year) => ({
  id: null,
  year,
  period_start: "",
  period_end: "",
  net_of_vat: "",
  vat: "",
  wtax: "",
});

const formatDisplayDate = (dateStr) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
};

const fmtMoney = (n) =>
  Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 });

// ─── Number input that shows comma-formatted digits while typing,
//     but stores/returns the raw numeric string (no commas) ──────────
const NumberField = ({ value, onChange, placeholder = "0.00" }) => {
  const [focused, setFocused] = useState(false);

  const display =
    focused || value === "" || value === null || value === undefined
      ? value
      : Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <input
      type="text"
      inputMode="decimal"
      value={display ?? ""}
      placeholder={placeholder}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(e) => {
        const raw = e.target.value.replace(/,/g, "");
        if (raw === "" || /^\d*\.?\d*$/.test(raw)) onChange(raw);
      }}
      className={`${cellInput} text-right`}
    />
  );
};

const RentFees = () => {
  const [rentFees, setRentFees] = useState([]);
  const [search, setSearch] = useState("");
  const [fetching, setFetching] = useState(true);

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [rfCode, setRfCode] = useState("");
  const [rows, setRows] = useState([emptyRow(1)]);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState("");

  // Delete (single schedule row from the list view — removes the parent
  // rent fee record too, automatically, if it was the last row left)
  const [deleteRowTarget, setDeleteRowTarget] = useState(null);
  const [deleteRowLoading, setDeleteRowLoading] = useState(false);

  // Toast
  const [toast, setToast] = useState({ msg: "", type: "success" });
  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: "", type: "success" }), 3000);
  };

  // ── Fetch ──
  const fetchRentFees = async () => {
    setFetching(true);
    const { data, error } = await supabase
      .from("rent_fees")
      .select("*, rent_fee_details(*)")
      .order("created_at", { ascending: false });
    if (!error) setRentFees(data || []);
    setFetching(false);
  };

  useEffect(() => {
    fetchRentFees();
  }, []);

  // ── Open Add ──
  const openAdd = () => {
    setEditTarget(null);
    setRfCode(generateNextCode(rentFees));
    setRows([emptyRow(1)]);
    setFormError("");
    setModalOpen(true);
  };

  // ── Open Edit ──
  const openEdit = (row) => {
    setEditTarget(row);
    setRfCode(row.rf_code || "");
    const details = (row.rent_fee_details || [])
      .slice()
      .sort((a, b) => a.year - b.year)
      .map((d) => ({
        id: d.id,
        year: d.year,
        period_start: d.period_start || "",
        period_end: d.period_end || "",
        net_of_vat: d.net_of_vat ?? "",
        vat: d.vat ?? "",
        wtax: d.wtax ?? "",
      }));
    setRows(details.length ? details : [emptyRow(1)]);
    setFormError("");
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setFormError("");
  };

  // ── Row helpers ──
  const updateRow = (index, field, value) => {
    setFormError("");
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  };

  const addRow = () => {
    setRows((prev) => [...prev, emptyRow(prev.length + 1)]);
  };

  const removeRow = (index) => {
    setRows((prev) => {
      const next = prev.filter((_, i) => i !== index).map((r, i) => ({ ...r, year: i + 1 }));
      return next.length ? next : [emptyRow(1)];
    });
  };

  // ── Submit ──
  const handleSubmit = async () => {
    if (rows.some((r) => !r.period_start || !r.period_end)) {
      setFormError("Each row needs a period start and end date.");
      return;
    }

    setLoading(true);

    if (editTarget) {
      const { error: headerError } = await supabase
        .from("rent_fees")
        .update({ term: rows.length })
        .eq("id", editTarget.id);

      if (headerError) {
        showToast("Update failed.", "error");
        setLoading(false);
        return;
      }

      // Simplest sync strategy: wipe old detail rows and reinsert current state
      await supabase.from("rent_fee_details").delete().eq("rent_fee_id", editTarget.id);

      const detailPayload = rows.map((r) => ({
        rent_fee_id: editTarget.id,
        year: r.year,
        period_start: r.period_start,
        period_end: r.period_end,
        net_of_vat: parseFloat(r.net_of_vat) || 0,
        vat: parseFloat(r.vat) || 0,
        wtax: parseFloat(r.wtax) || 0,
      }));

      const { error: detailError } = await supabase.from("rent_fee_details").insert(detailPayload);

      if (detailError) showToast("Rental schedule rows failed to save.", "error");
      else {
        showToast("Rent fee updated.");
        fetchRentFees();
      }
    } else {
      const { data: headerData, error: headerError } = await supabase
        .from("rent_fees")
        .insert({ rf_code: rfCode, term: rows.length })
        .select()
        .single();

      if (headerError) {
        showToast("Insert failed.", "error");
        setLoading(false);
        return;
      }

      const detailPayload = rows.map((r) => ({
        rent_fee_id: headerData.id,
        year: r.year,
        period_start: r.period_start,
        period_end: r.period_end,
        net_of_vat: parseFloat(r.net_of_vat) || 0,
        vat: parseFloat(r.vat) || 0,
        wtax: parseFloat(r.wtax) || 0,
      }));

      const { error: detailError } = await supabase.from("rent_fee_details").insert(detailPayload);

      if (detailError) showToast("Rental schedule rows failed to save.", "error");
      else {
        showToast("Rent fee added.");
        fetchRentFees();
      }
    }

    setLoading(false);
    setModalOpen(false);
  };

  // ── Delete a single schedule row (from the list view).
  //    If it was the last row for that rent fee, remove the now-empty
  //    parent record too, so we never leave an orphaned header behind. ──
  const handleDeleteRow = async () => {
    setDeleteRowLoading(true);
    const rentFeeId = deleteRowTarget.rent_fee_id;

    const { error } = await supabase.from("rent_fee_details").delete().eq("id", deleteRowTarget.id);

    if (error) {
      showToast("Delete failed.", "error");
    } else {
      const parent = rentFees.find((rf) => rf.id === rentFeeId);
      const remaining = (parent?.rent_fee_details || []).filter((d) => d.id !== deleteRowTarget.id);
      if (remaining.length === 0 && rentFeeId) {
        await supabase.from("rent_fees").delete().eq("id", rentFeeId);
      }
      showToast("Schedule row deleted.");
      fetchRentFees();
    }

    setDeleteRowLoading(false);
    setDeleteRowTarget(null);
  };

  // ── Filter ──
  const filtered = rentFees.filter((v) =>
    (v.rf_code || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <Toast msg={toast.msg} type={toast.type} />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
        <div className="flex items-center gap-3">
          <Home size={26} strokeWidth={1.5} className="text-black" />
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Rent Fees</h2>
            <p className="text-xs text-gray-500">
              {rentFees.length} rent fee{rentFees.length !== 1 ? "s" : ""} configured
            </p>
          </div>
        </div>
        <button onClick={openAdd} className={btnPrimary}>
          <Plus size={14} /> Add Rent Fee
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm mb-4">
        <Search size={14} className="absolute text-gray-300 -translate-y-1/2 pointer-events-none left-3 top-1/2" />
        <input
          type="text"
          placeholder="Search rent fees..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`${inputCls} pl-9`}
        />
      </div>

      {/* List */}
      {fetching ? (
        <div className="py-12 text-center text-gray-400 bg-white border border-gray-200 rounded-lg">
          Loading...
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-gray-400 bg-white border border-gray-200 rounded-lg">
          {search ? "No rent fees match your search." : "No rent fee schedules found."}
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((rf) => {
            const details = (rf.rent_fee_details || []).slice().sort((a, b) => a.year - b.year);
            return (
              <div key={rf.id} className="overflow-hidden bg-white border border-gray-200 rounded-lg">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-gray-100 bg-gray-50">
                      <tr>
                        <th className="px-4 py-2.5 text-xs font-medium text-left text-gray-500">Code</th>
                        <th className="px-4 py-2.5 text-xs font-medium text-left text-gray-500">Year</th>
                        <th className="px-4 py-2.5 text-xs font-medium text-left text-gray-500">Period</th>
                        <th className="px-4 py-2.5 text-xs font-medium text-right text-gray-500">Net of VAT</th>
                        <th className="px-4 py-2.5 text-xs font-medium text-right text-gray-500">VAT</th>
                        <th className="px-4 py-2.5 text-xs font-medium text-right text-gray-500">WTAX</th>
                        <th className="px-4 py-2.5 text-xs font-medium text-right text-gray-500">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {details.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-gray-400">
                            No schedule rows yet.
                          </td>
                        </tr>
                      ) : (
                        details.map((d) => (
                          <tr key={d.id} className="border-t border-gray-100 hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <span className="px-2 py-0.5 font-mono text-xs text-gray-600 bg-gray-100 rounded">
                                {rf.rf_code}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-800">{d.year}</td>
                            <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                              {formatDisplayDate(d.period_start)} - {formatDisplayDate(d.period_end)}
                            </td>
                            <td className="px-4 py-3 text-right text-gray-800">{fmtMoney(d.net_of_vat)}</td>
                            <td className="px-4 py-3 text-right text-gray-800">{fmtMoney(d.vat)}</td>
                            <td className="px-4 py-3 text-right text-gray-800">{fmtMoney(d.wtax)}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-1">
                                <button onClick={() => openEdit(rf)} title="Edit" className={iconBtn}>
                                  <Pencil size={15} />
                                </button>
                                <button onClick={() => setDeleteRowTarget(d)} title="Delete" className={iconBtn}>
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/40"
          onClick={(e) => e.target === e.currentTarget && closeModal()}
        >
          <div className="w-full max-w-4xl max-h-[90vh] flex flex-col bg-white border border-gray-200 rounded-lg shadow-xl">
            <div className="flex items-start justify-between px-6 pt-5 shrink-0">
              <div>
                <h2 className="text-base font-semibold text-gray-800">
                  {editTarget ? "Edit Rent Fee" : "Add Rent Fee"}
                </h2>
                <p className="mt-0.5 text-xs text-gray-500">
                  {editTarget ? "Update this rental schedule." : "Create a new rental schedule."}
                </p>
              </div>
              <button type="button" onClick={closeModal} className={iconBtn}>
                <X size={16} />
              </button>
            </div>

            <form
              onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}
              className="flex flex-col flex-1 min-h-0"
            >
              <div className="flex-1 px-6 py-5 overflow-y-auto">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-gray-500">Rental Schedule</span>
                  <button type="button" onClick={addRow} className={`${btnGhost} flex items-center gap-1.5 !px-3 !py-1.5 text-xs`}>
                    <Plus size={13} /> Add Row
                  </button>
                </div>

                <div className="overflow-x-auto border border-gray-200 rounded-md">
                  <table className="w-full text-sm">
                    <thead className="border-b border-gray-100 bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-xs font-medium text-left text-gray-500">Code</th>
                        <th className="px-3 py-2 text-xs font-medium text-center text-gray-500">Year</th>
                        <th className="px-3 py-2 text-xs font-medium text-left text-gray-500">Period Start</th>
                        <th className="px-3 py-2 text-xs font-medium text-left text-gray-500">Period End</th>
                        <th className="px-3 py-2 text-xs font-medium text-right text-gray-500">Net of VAT</th>
                        <th className="px-3 py-2 text-xs font-medium text-right text-gray-500">VAT</th>
                        <th className="px-3 py-2 text-xs font-medium text-right text-gray-500">WTAX</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, i) => (
                        <tr key={i} className="border-t border-gray-100">
                          <td className="px-3 py-2">
                            <span className="px-2 py-0.5 font-mono text-xs text-gray-600 bg-gray-100 rounded">
                              {rfCode}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center text-gray-800">{row.year}</td>
                          <td className="px-3 py-1.5">
                            <input
                              type="date"
                              value={row.period_start}
                              onChange={(e) => updateRow(i, "period_start", e.target.value)}
                              className={cellInput}
                            />
                          </td>
                          <td className="px-3 py-1.5">
                            <input
                              type="date"
                              value={row.period_end}
                              onChange={(e) => updateRow(i, "period_end", e.target.value)}
                              className={cellInput}
                            />
                          </td>
                          <td className="px-3 py-1.5">
                            <NumberField value={row.net_of_vat} onChange={(v) => updateRow(i, "net_of_vat", v)} />
                          </td>
                          <td className="px-3 py-1.5">
                            <NumberField value={row.vat} onChange={(v) => updateRow(i, "vat", v)} />
                          </td>
                          <td className="px-3 py-1.5">
                            <NumberField value={row.wtax} onChange={(v) => updateRow(i, "wtax", v)} />
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <button
                              type="button"
                              onClick={() => removeRow(i)}
                              disabled={rows.length <= 1}
                              title="Remove row"
                              className={`${iconBtn} disabled:opacity-30 disabled:cursor-not-allowed`}
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {rows.length > 0 && (
                  <p className="mt-2 text-xs text-gray-400">
                    e.g. Year {rows[0].year}: {formatDisplayDate(rows[0].period_start) || "Jan 01"} -{" "}
                    {formatDisplayDate(rows[0].period_end) || "Dec 31"}
                  </p>
                )}

                {formError && (
                  <p className="mt-3 text-xs font-medium text-red-600">{formError}</p>
                )}
              </div>

              <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 shrink-0">
                <button type="button" onClick={closeModal} disabled={loading} className={btnGhost}>
                  Cancel
                </button>
                <button type="submit" disabled={loading} className={btnPrimary}>
                  {loading ? "Saving..." : editTarget ? "Save Changes" : "Add Rent Fee"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <DeleteModal
        open={!!deleteRowTarget}
        onClose={() => setDeleteRowTarget(null)}
        onConfirm={handleDeleteRow}
        loading={deleteRowLoading}
        title="Delete schedule row?"
        name={
          deleteRowTarget
            ? `Year ${deleteRowTarget.year} · ${formatDisplayDate(deleteRowTarget.period_start)} - ${formatDisplayDate(deleteRowTarget.period_end)}`
            : undefined
        }
      />
    </div>
  );
};

export default RentFees;