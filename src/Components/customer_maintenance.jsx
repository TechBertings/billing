import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Search, X, Check, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";

/* ── Shared look (same as tax_type / secret_question / user_role / status) ── */
const inputCls   = "w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-md focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-200";
const labelCls   = "block mb-1 text-xs font-medium text-gray-500";
const btnPrimary = "flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-white transition bg-gray-900 rounded-md hover:bg-black disabled:opacity-50";
const btnGhost   = "px-3.5 py-2 text-sm font-medium text-gray-600 transition bg-white border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50";
const btnDanger  = "flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-white transition bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50";
const iconBtn    = "p-1.5 text-gray-400 transition rounded-md hover:bg-gray-100 hover:text-black";

// ─── Base Modal ───────────────────────────────────────────────────────
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

// ─── Add/Edit Modal ───────────────────────────────────────────────────
export const MaintenanceModal = ({
  open,
  title,
  subtitle,
  onClose,
  onSubmit,
  loading,
  fields, // [{ label, value, onChange, placeholder, readOnly, type, options }]
}) => {
  if (!open) return null;
  return (
    <Modal title={title} subtitle={subtitle} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
        {fields.map((field, i) => (
          <div key={i} className="mb-4">
            <label className={labelCls}>{field.label}</label>
            {field.readOnly ? (
              <input
                type="text"
                value={field.value}
                readOnly
                className={`${inputCls} font-mono bg-gray-50 text-gray-500`}
              />
            ) : field.type === "select" ? (
              <select
                value={field.value}
                onChange={(e) => field.onChange(e.target.value)}
                className={inputCls}
              >
                {field.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={field.value}
                onChange={(e) => field.onChange(e.target.value)}
                placeholder={field.placeholder || ""}
                autoFocus={i === fields.findIndex((f) => !f.readOnly)}
                className={inputCls}
              />
            )}
          </div>
        ))}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={loading} className={btnGhost}>
            Cancel
          </button>
          <button type="submit" disabled={loading} className={btnPrimary}>
            {loading ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  );
};

// ─── Delete Modal ─────────────────────────────────────────────────────
export const DeleteModal = ({ open, onClose, onConfirm, loading, title = "Confirm delete?", name }) => {
  if (!open) return null;
  return (
    <Modal title={title} subtitle="This action cannot be undone." onClose={onClose}>
      {name && (
        <p className="px-3 py-2 mb-5 text-sm text-gray-700 border border-gray-200 rounded-md bg-gray-50">
          {name}
        </p>
      )}
      <div className={`flex justify-end gap-2 ${name ? "" : "mt-2"}`}>
        <button onClick={onClose} disabled={loading} className={btnGhost}>Cancel</button>
        <button onClick={onConfirm} disabled={loading} className={btnDanger}>
          {loading ? "Deleting..." : <><Trash2 size={14} /> Delete</>}
        </button>
      </div>
    </Modal>
  );
};

// ─── Toast ────────────────────────────────────────────────────────────
export const Toast = ({ msg, type }) => {
  if (!msg) return null;
  return (
    <div
      className={`fixed z-50 flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-white border rounded-md shadow-lg bottom-6 right-6 ${
        type === "error" ? "text-red-700 border-red-200" : "text-gray-800 border-gray-200"
      }`}
    >
      {type === "error" ? <AlertTriangle size={14} /> : <Check size={14} />}
      {msg}
    </div>
  );
};

// ─── Main Reusable Table Layout ───────────────────────────────────────
/**
 * Props:
 * - title: string
 * - icon: ReactNode (optional, shown beside the title)
 * - totalCount: number
 * - search / onSearchChange
 * - onAdd, addLabel?: string (default "Add")
 * - columns: [{ label, key, badge?, render? }] — badge=true renders a mono code pill
 * - rows, onEdit(row), onDelete(row), fetching
 * - emptyMessage?: string
 * - pageSize?: number (default 10)
 */
const CustomerMaintenanceTable = ({
  title,
  icon,
  totalCount,
  search,
  onSearchChange,
  onAdd,
  columns = [],
  rows = [],
  onEdit,
  onDelete,
  fetching,
  addLabel = "Add",
  emptyMessage = "No records found.",
  pageSize = 10,
}) => {
  const [currentPage, setCurrentPage] = useState(1);

  // Back to page 1 whenever the search changes
  useEffect(() => { setCurrentPage(1); }, [search]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));

  // Clamp if rows shrink (e.g. after a delete)
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [totalPages, currentPage]);

  const paginatedRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const rangeStart = rows.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(currentPage * pageSize, rows.length);

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
        <div className="flex items-center gap-3">
          {icon}
          <div>
            <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
            <p className="text-xs text-gray-500">
              {totalCount} record{totalCount !== 1 ? "s" : ""} configured
            </p>
          </div>
        </div>
        <button onClick={onAdd} className={btnPrimary}>
          <Plus size={14} /> {addLabel}
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm mb-4">
        <Search size={14} className="absolute text-gray-300 -translate-y-1/2 pointer-events-none left-3 top-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={`Search ${title.toLowerCase()}...`}
          className={`${inputCls} pl-9`}
        />
      </div>

      {/* Table */}
      <div className="overflow-hidden bg-white border border-gray-200 rounded-lg">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-100 bg-gray-50">
            <tr>
              {columns.map((col) => (
                <th key={col.key} className="px-4 py-2.5 text-xs font-medium text-left text-gray-500">
                  {col.label}
                </th>
              ))}
              <th className="px-4 py-2.5 text-xs font-medium text-right text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {fetching ? (
              <tr>
                <td colSpan={columns.length + 1} className="py-12 text-center text-gray-400">Loading...</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="py-12 text-center text-gray-400">
                  {search ? "No records match your search." : emptyMessage}
                </td>
              </tr>
            ) : (
              paginatedRows.map((row) => (
                <tr key={row.id} className="border-t border-gray-100 hover:bg-gray-50">
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3">
                      {col.render ? (
                        col.render(row)
                      ) : col.badge ? (
                        <span className="px-2 py-0.5 font-mono text-xs text-gray-600 bg-gray-100 rounded">
                          {row[col.key] || "—"}
                        </span>
                      ) : (
                        <span className="text-gray-800">{row[col.key] || "—"}</span>
                      )}
                    </td>
                  ))}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => onEdit(row)} title="Edit" className={iconBtn}>
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => onDelete(row)} title="Delete" className={iconBtn}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination bar */}
        {!fetching && rows.length > pageSize && (
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-100 bg-gray-50">
            <span className="text-xs text-gray-500">
              Showing {rangeStart}–{rangeEnd} of {rows.length}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className={`${btnGhost} flex items-center gap-1 !px-2.5 !py-1 text-xs`}
              >
                <ChevronLeft size={12} /> Prev
              </button>
              <span className="px-2 text-xs text-gray-500">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className={`${btnGhost} flex items-center gap-1 !px-2.5 !py-1 text-xs`}
              >
                Next <ChevronRight size={12} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerMaintenanceTable;