import React, { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, X, Check, Search, UserCog, ShieldCheck, AlertTriangle } from "lucide-react";
import { userRoleAPI } from "../lib/supabaseClient";

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

/* ════════════════════════════ */
function UserRole({ onManagePermissions }) {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [modal, setModal] = useState(null); // null | "add" | "edit" | "delete"
  const [activeRow, setActiveRow] = useState(null);
  const [formName, setFormName] = useState("");
  const [formStatus, setFormStatus] = useState(true); // true = Active
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [toast, setToast] = useState(null);
  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  /* ── Fetch ── */
  const loadRoles = async () => {
    setLoading(true);
    try {
      const { data, error } = await userRoleAPI.getAll();
      if (error) {
        console.error("Error loading roles:", error);
        showToast("Failed to load roles.", "error");
      }
      if (data) setRoles(data);
    } catch (err) {
      console.error("Error:", err);
      showToast("Failed to load roles.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadRoles(); }, []);

  const filtered = roles.filter((r) =>
    (r.role_name || "").toLowerCase().includes(search.toLowerCase())
  );

  /* ── Modal helpers ── */
  const openAdd = () => {
    setFormName(""); setFormStatus(true); setFormError(""); setModal("add");
  };
  const openEdit = (role) => {
    setActiveRow(role);
    setFormName(role.role_name);
    setFormStatus(role.status); // boolean from DB
    setFormError(""); setModal("edit");
  };
  const openDelete = (role) => { setActiveRow(role); setModal("delete"); };
  const closeModal = () => {
    setModal(null); setActiveRow(null);
    setFormName(""); setFormStatus(true); setFormError("");
  };

  /* ── CRUD ── */
  const handleSubmit = async () => {
    if (!formName.trim()) { setFormError("Role name is required."); return; }
    const payload = { roleName: formName.trim(), status: formStatus };

    setSaving(true);
    try {
      const result =
        modal === "add"
          ? await userRoleAPI.create(payload)
          : await userRoleAPI.update(activeRow.id, payload);

      if (result.error) {
        setFormError(String(result.error.message || result.error));
      } else {
        showToast(`Role ${modal === "add" ? "created" : "updated"}.`);
        closeModal();
        await loadRoles();
      }
    } catch (err) {
      setFormError("An error occurred. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      const { error } = await userRoleAPI.delete(activeRow.id);
      if (error) {
        showToast(String(error.message || error), "error");
      } else {
        showToast("Role deleted.");
        closeModal();
        await loadRoles();
      }
    } catch (err) {
      showToast("An error occurred.", "error");
    } finally {
      setSaving(false);
    }
  };

  /* ════════════ RENDER ════════════ */
  return (
    <div>
      <Toast toast={toast} />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
        <div className="flex items-center gap-3">
          <UserCog size={26} strokeWidth={1.5} className="text-black" />
          <div>
            <h2 className="text-lg font-semibold text-gray-800">User Role</h2>
            <p className="text-xs text-gray-500">
              {roles.length} role{roles.length !== 1 ? "s" : ""} configured
            </p>
          </div>
        </div>
        <button onClick={openAdd} className={btnPrimary}>
          <Plus size={14} /> Add Role
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm mb-4">
        <Search size={14} className="absolute text-gray-300 -translate-y-1/2 pointer-events-none left-3 top-1/2" />
        <input
          type="text"
          placeholder="Search roles..."
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
              <th className="px-4 py-2.5 text-xs font-medium text-left text-gray-500">Role Name</th>
              <th className="px-4 py-2.5 text-xs font-medium text-left text-gray-500">Status</th>
              <th className="px-4 py-2.5 text-xs font-medium text-right text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={3} className="py-12 text-center text-gray-400">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={3} className="py-12 text-center text-gray-400">
                  {search ? "No roles match your search." : "No roles yet."}
                </td>
              </tr>
            ) : (
              filtered.map((role) => (
                <tr key={role.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{role.role_name}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 text-xs text-gray-600">
                      <span className={`w-1.5 h-1.5 rounded-full ${role.status ? "bg-green-500" : "bg-gray-300"}`} />
                      {role.status ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => onManagePermissions && onManagePermissions(role)}
                        title="Manage permissions"
                        className={iconBtn}
                      >
                        <ShieldCheck size={15} />
                      </button>
                      <button onClick={() => openEdit(role)} title="Edit" className={iconBtn}><Pencil size={15} /></button>
                      <button onClick={() => openDelete(role)} title="Delete" className={iconBtn}><Trash2 size={15} /></button>
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
          title={modal === "add" ? "Add Role" : "Edit Role"}
          subtitle={modal === "add" ? "Create a new user role." : "Update this user role."}
          onClose={closeModal}
        >
          <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
            <div className="mb-4">
              <label className={labelCls}>Role Name</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => { setFormName(e.target.value); setFormError(""); }}
                placeholder="e.g. Manager, Cashier"
                autoFocus
                className={inputCls}
              />
            </div>

            <div className="mb-4">
              <label className={labelCls}>Status</label>
              <select
                value={formStatus ? "Active" : "Inactive"}
                onChange={(e) => setFormStatus(e.target.value === "Active")}
                className={inputCls}
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>

            {formError && (
              <p className="flex items-center gap-1 mb-4 text-xs font-medium text-red-600">
                <AlertTriangle size={13} /> {formError}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button type="button" onClick={closeModal} disabled={saving} className={btnGhost}>Cancel</button>
              <button type="submit" disabled={saving} className={btnPrimary}>
                {saving ? "Saving..." : modal === "add" ? "Create Role" : "Save Changes"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete modal */}
      {modal === "delete" && (
        <ConfirmDelete
          title="Delete role?"
          name={activeRow?.role_name}
          saving={saving}
          onCancel={closeModal}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}

export default UserRole;