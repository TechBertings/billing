import React, { useState, useEffect } from "react";
import { Plus, Trash2, Pencil, Search } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import {
  DeleteModal,
  Toast,
} from "../components/customer_maintenance";


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
      className="w-full px-2 py-1.5 text-xs text-right border rounded-md border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-200"
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
    setModalOpen(true);
  };

  // ── Row helpers ──
  const updateRow = (index, field, value) => {
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
      return showToast("Each row needs a period start and end date.", "error");
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
        showToast("Rent fee updated!");
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
        showToast("Rent fee added!");
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
      showToast("Schedule row deleted!");
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
    <>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-800">Rent Fees</h1>
            <p className="mt-0.5 text-sm font-medium text-slate-400">
              Total: {rentFees.length} record{rentFees.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white transition-all bg-blue-600 rounded-xl hover:bg-blue-700"
          >
            <Plus size={16} />
            Add Rent Fee
          </button>
        </div>

        <div className="relative mb-6">
          <Search size={16} className="absolute -translate-y-1/2 left-4 top-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search rent fees..."
            className="w-full py-3 pr-4 text-sm font-medium bg-white border pl-11 rounded-xl border-slate-200 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300"
          />
        </div>

        {fetching ? (
          <div className="py-16 text-sm font-semibold text-center text-slate-400">Loading rent fees...</div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-4 text-sm font-bold text-center bg-white border border-slate-200 rounded-2xl text-slate-500">
            No rent fee schedules found.
          </div>
        ) : (
          <div className="space-y-5">
            {filtered.map((rf) => {
              const details = (rf.rent_fee_details || []).slice().sort((a, b) => a.year - b.year);
              return (
                <div key={rf.id} className="overflow-hidden bg-white border rounded-2xl border-slate-200">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-slate-400">
                          <th className="px-5 py-2 font-bold text-left">Code</th>
                          <th className="px-5 py-2 font-bold text-left">Year</th>
                          <th className="px-5 py-2 font-bold text-left">Period</th>
                          <th className="px-5 py-2 font-bold text-right">Net of VAT</th>
                          <th className="px-5 py-2 font-bold text-right">VAT</th>
                          <th className="px-5 py-2 font-bold text-right">WTAX</th>
                          <th className="px-5 py-2 font-bold text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {details.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-5 py-4 text-center text-slate-400">
                              No schedule rows yet.
                            </td>
                          </tr>
                        ) : (
                          details.map((d) => (
                            <tr key={d.id} className="border-t border-slate-100">
                              <td className="px-5 py-2.5 font-bold text-blue-700">{rf.rf_code}</td>
                              <td className="px-5 py-2.5 font-bold text-slate-700">{d.year}</td>
                              <td className="px-5 py-2.5 font-medium text-slate-600">
                                {formatDisplayDate(d.period_start)} - {formatDisplayDate(d.period_end)}
                              </td>
                              <td className="px-5 py-2.5 font-semibold text-right text-slate-700">
                                {Number(d.net_of_vat || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                              <td className="px-5 py-2.5 font-semibold text-right text-slate-700">
                                {Number(d.vat || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                              <td className="px-5 py-2.5 font-semibold text-right text-slate-700">
                                {Number(d.wtax || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                              <td className="px-5 py-2.5 text-right whitespace-nowrap">
                                <button
                                  onClick={() => openEdit(rf)}
                                  className="inline-flex items-center gap-1 px-2 py-1 mr-1.5 text-xs font-bold text-amber-600 bg-amber-50 rounded-md hover:bg-amber-100"
                                >
                                  <Pencil size={12} />
                                  Edit
                                </button>
                                <button
                                  onClick={() => setDeleteRowTarget(d)}
                                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-bold text-red-600 rounded-md bg-red-50 hover:bg-red-100"
                                >
                                  <Trash2 size={12} />
                                  Delete
                                </button>
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
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="w-full max-w-4xl overflow-hidden bg-white shadow-xl rounded-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-black text-slate-800">
                {editTarget ? "Edit Rent Fee" : "Add Rent Fee"}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="text-sm font-semibold text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 px-6 py-5 overflow-y-auto">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold tracking-wide uppercase text-slate-500">
                  Rental Schedule
                </span>
                <button
                  onClick={addRow}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-600 transition-all bg-blue-50 rounded-lg hover:bg-blue-100"
                >
                  <Plus size={14} />
                  Add Row
                </button>
              </div>

              <div className="overflow-x-auto border rounded-xl border-slate-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500">
                      <th className="px-3 py-2 font-bold text-left">Code</th>
                      <th className="px-3 py-2 font-bold text-left">Year</th>
                      <th className="px-3 py-2 font-bold text-left">Period Start</th>
                      <th className="px-3 py-2 font-bold text-left">Period End</th>
                      <th className="px-3 py-2 font-bold text-right">Net of VAT</th>
                      <th className="px-3 py-2 font-bold text-right">VAT</th>
                      <th className="px-3 py-2 font-bold text-right">WTAX</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={i} className="border-t border-slate-100">
                        <td className="px-3 py-2 text-xs font-bold text-blue-700">
                          {rfCode}
                        </td>
                        <td className="px-3 py-2 font-bold text-center text-slate-700">
                          {row.year}
                        </td>
                        <td className="px-3 py-1.5">
                          <input
                            type="date"
                            value={row.period_start}
                            onChange={(e) => updateRow(i, "period_start", e.target.value)}
                            className="w-full px-2 py-1.5 text-xs border rounded-md border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-200"
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <input
                            type="date"
                            value={row.period_end}
                            onChange={(e) => updateRow(i, "period_end", e.target.value)}
                            className="w-full px-2 py-1.5 text-xs border rounded-md border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-200"
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <NumberField
                            value={row.net_of_vat}
                            onChange={(v) => updateRow(i, "net_of_vat", v)}
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <NumberField
                            value={row.vat}
                            onChange={(v) => updateRow(i, "vat", v)}
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <NumberField
                            value={row.wtax}
                            onChange={(v) => updateRow(i, "wtax", v)}
                          />
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <button
                            onClick={() => removeRow(i)}
                            disabled={rows.length <= 1}
                            className="text-slate-300 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {rows.length > 0 && (
                <p className="mt-2 text-xs font-medium text-slate-400">
                  e.g. Year {rows[0].year}: {formatDisplayDate(rows[0].period_start) || "Jan 01"} -{" "}
                  {formatDisplayDate(rows[0].period_end) || "Dec 31"}
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 text-sm font-semibold rounded-lg text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="px-5 py-2 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      <DeleteModal
        open={!!deleteRowTarget}
        onClose={() => setDeleteRowTarget(null)}
        onConfirm={handleDeleteRow}
        loading={deleteRowLoading}
      />

      <Toast msg={toast.msg} type={toast.type} />
    </>
  );
};

export default RentFees;