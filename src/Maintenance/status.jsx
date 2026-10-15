import React, { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, X, Check, Search, BadgeCheck, AlertTriangle } from "lucide-react";
import { supabase } from "../lib/supabaseClient";

/* ── Shared look (same block is used in secret_question / user_role / status) ── */
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
    <div className="w-full max-w-md bg-white border border-gray-200 rounded-lg shadow-xl">
      <div className="flex items-start justify-between px-6 pt-5">
        <div>
          <h2 className="text-base font-semibold text-gray-800">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
        </div>
        <button type="button" onClick={onClose} className={iconBtn}>
          <X size={16} />
        </button>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  </div>
);

const ConfirmDelete = ({ title, name, saving, onCancel, onConfirm }) => (
  <Modal title={title} subtitle="This action cannot be undone." onClose={onCancel}>
    <p className="px-3 py-2 mb-5 text-sm text-gray-700 border border-gray-200 rounded-md bg-gray-50">{name}</p>
    <div className="flex justify-end gap-2">
      <button onClick={onCancel} disabled={saving} className={btnGhost}>Cancel</button>
      <button onClick={onConfirm} disabled={saving} className={btnDanger}>
        {saving ? "Deleting..." : <><Trash2 size={14} /> Delete</>}
      </button>
    </div>
  </Modal>
);

/* ── Auto-generate next stat_code ── */
const generateNextCode = (existingList) => {
  const prefix = "STS_";
  let maxNum = 0;
  existingList.forEach((s) => {
    if (s.stat_code?.startsWith(prefix)) {
      const num = parseInt(s.stat_code.replace(prefix, ""), 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }
  });
  return `${prefix}${String(maxNum + 1).padStart(3, "0")}`;
};

/* ════════════════════════════ */
const Status = () => {
  const [statuses, setStatuses] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [search, setSearch] = useState("");

  const [modal, setModal] = useState(null); // null | "add" | "edit" | "delete"
  const [activeRow, setActiveRow] = useState(null);
  const [statCode, setStatCode] = useState("");
  const [statusLabel, setStatusLabel] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [toast, setToast] = useState(null);
  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  /* ── Fetch ── */
  const fetchStatuses = async () => {
    setFetching(true);
    const { data, error } = await supabase
      .from("status")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) showToast("Failed to load statuses.", "error");
    else setStatuses(data || []);
    setFetching(false);
  };

  useEffect(() => { fetchStatuses(); }, []);

  const filtered = statuses.filter(
    (s) =>
      (s.stat_code || "").toLowerCase().includes(search.toLowerCase()) ||
      (s.status || "").toLowerCase().includes(search.toLowerCase())
  );

  /* ── Modal helpers ── */
  const openAdd = () => {
    setStatCode(generateNextCode(statuses));
    setStatusLabel(""); setFormError(""); setModal("add");
  };
  const openEdit = (row) => {
    setActiveRow(row);
    setStatCode(row.stat_code || "");
    setStatusLabel(row.status || "");
    setFormError(""); setModal("edit");
  };
  const openDelete = (row) => { setActiveRow(row); setModal("delete"); };
  const closeModal = () => {
    setModal(null); setActiveRow(null);
    setStatCode(""); setStatusLabel(""); setFormError("");
  };

  /* ── CRUD ── */
  const handleSubmit = async () => {
    const label = statusLabel.trim();
    if (!label) { setFormError("Status label is required."); return; }

    setSaving(true);
    const { error } =
      modal === "edit"
        ? await supabase.from("status").update({ status: label }).eq("id", activeRow.id)
        : await supabase.from("status").insert({ stat_code: statCode, status: label });
    setSaving(false);

    if (error) {
      setFormError(modal === "edit" ? "Update failed. Please try again." : "Save failed. Please try again.");
      return;
    }
    showToast(modal === "edit" ? "Status updated." : "Status added.");
    closeModal(); fetchStatuses();
  };

  const handleDelete = async () => {
    setSaving(true);
    const { error } = await supabase.from("status").delete().eq("id", activeRow.id);
    setSaving(false);
    if (error) { showToast("Delete failed.", "error"); return; }
    showToast("Status deleted.");
    closeModal(); fetchStatuses();
  };

  /* ════════════ RENDER ════════════ */
  return (
    <div>
      <Toast toast={toast} />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
        <div className="flex items-center gap-3">
          <BadgeCheck size={26} strokeWidth={1.5} className="text-black" />
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Status</h2>
            <p className="text-xs text-gray-500">
              {statuses.length} status{statuses.length !== 1 ? "es" : ""} configured
            </p>
          </div>
        </div>
        <button onClick={openAdd} className={btnPrimary}>
          <Plus size={14} /> Add Status
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm mb-4">
        <Search size={14} className="absolute text-gray-300 -translate-y-1/2 pointer-events-none left-3 top-1/2" />
        <input
          type="text"
          placeholder="Search statuses..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`${inputCls} pl-9`}
        />
      </div>

      {/* Table */}
      <div className="overflow-hidden bg-white border border-gray-200 rounded-lg">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-100 bg-gray-50">
            <tr>
              <th className="px-4 py-2.5 text-xs font-medium text-left text-gray-500">Status Code</th>
              <th className="px-4 py-2.5 text-xs font-medium text-left text-gray-500">Status Label</th>
              <th className="px-4 py-2.5 text-xs font-medium text-right text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {fetching ? (
              <tr><td colSpan={3} className="py-12 text-center text-gray-400">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={3} className="py-12 text-center text-gray-400">
                  {search ? "No statuses match your search." : "No statuses found."}
                </td>
              </tr>
            ) : (
              filtered.map((s) => (
                <tr key={s.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 font-mono text-xs text-gray-600 bg-gray-100 rounded">
                      {s.stat_code}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-800">{s.status}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(s)} title="Edit" className={iconBtn}><Pencil size={15} /></button>
                      <button onClick={() => openDelete(s)} title="Delete" className={iconBtn}><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add / Edit modal */}
      {(modal === "add" || modal === "edit") && (
        <Modal
          title={modal === "add" ? "Add Status" : "Edit Status"}
          subtitle={modal === "add" ? "Create a new status." : "Update this status label."}
          onClose={closeModal}
        >
          <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
            <div className="mb-4">
              <label className={labelCls}>Status Code</label>
              <input type="text" value={statCode} readOnly className={`${inputCls} font-mono bg-gray-50 text-gray-500`} />
            </div>

            <div className="mb-4">
              <label className={labelCls}>Status Label</label>
              <input
                type="text"
                value={statusLabel}
                onChange={(e) => { setStatusLabel(e.target.value); setFormError(""); }}
                placeholder="e.g. Active"
                autoFocus
                className={inputCls}
              />
            </div>

            {formError && (
              <p className="flex items-center gap-1 mb-4 text-xs font-medium text-red-600">
                <AlertTriangle size={13} /> {formError}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button type="button" onClick={closeModal} disabled={saving} className={btnGhost}>Cancel</button>
              <button type="submit" disabled={saving} className={btnPrimary}>
                {saving ? "Saving..." : modal === "add" ? "Add Status" : "Save Changes"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete modal */}
      {modal === "delete" && (
        <ConfirmDelete
          title="Delete status?"
          name={activeRow?.status}
          saving={saving}
          onCancel={closeModal}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
};

export default Status;