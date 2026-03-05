import { Plus, Pencil, Trash2, Search, X} from "lucide-react";

// ─── Add/Edit Modal ───────────────────────────────────────────────────
export const MaintenanceModal = ({
  open,
  title,
  onClose,
  onSubmit,
  loading,
  fields, // [{ label, value, onChange, placeholder, readOnly }]
}) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="w-full max-w-md p-6 mx-4 bg-white border border-green-100 shadow-2xl rounded-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-slate-800">{title}</h2>
          <button
            onClick={onClose}
            className="transition-colors text-slate-400 hover:text-slate-600"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          {fields.map((field, i) => (
            <div key={i}>
              <label className="block mb-1 text-xs font-semibold tracking-wider uppercase text-slate-500">
                {field.label}
              </label>
              {field.readOnly ? (
                <>
                  <div className="flex items-center w-full px-1 py-2.5 border border-slate-200 rounded-xl bg-slate-50 text-sm tracking-widest select-none">
                    <span className="w-2 h-2 mr-2 rounded-full shrink-0" />
                    {field.value}
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    Auto-generated · read only
                  </p>
                </>
              ) : (
                <input
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.value)}
                  placeholder={field.placeholder || ""}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-green-300 focus:border-green-400 transition"
                />
              )}
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold transition text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white transition bg-green-500 rounded-xl hover:bg-green-600 disabled:opacity-60"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 rounded-full border-white/40 border-t-white animate-spin" />
            ) : null}
            {loading ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Delete Modal ─────────────────────────────────────────────────────
export const DeleteModal = ({ open, onClose, onConfirm, loading }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="w-full max-w-sm p-6 mx-4 bg-white border border-red-100 shadow-2xl rounded-2xl">
        <h2 className="mb-2 text-lg font-bold text-slate-800">
          Confirm Delete
        </h2>
        <p className="mb-6 text-sm text-slate-500">
          This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold transition text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white transition bg-red-500 rounded-xl hover:bg-red-600 disabled:opacity-60"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 rounded-full border-white/40 border-t-white animate-spin" />
            ) : (
              <Trash2 size={14} />
            )}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Toast ────────────────────────────────────────────────────────────
export const Toast = ({ msg, type }) => {
  if (!msg) return null;
  const color = type === "error" ? "bg-red-500" : "bg-green-500";
  return (
    <div
      className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl text-white text-sm font-semibold shadow-lg ${color} animate-bounce`}
    >
      {msg}
    </div>
  );
};

// ─── Main Reusable Table Layout ───────────────────────────────────────
/**
 * Props:
 * - title: string
 * - icon: ReactNode
 * - totalCount: number
 * - search: string
 * - onSearchChange: fn
 * - onAdd: fn
 * - columns: [{ label, key, badge? }]  — badge=true renders green pill
 * - rows: array of data objects
 * - onEdit: fn(row)
 * - onDelete: fn(row)
 * - fetching: bool
 * - addLabel?: string  (default "Add")
 * - emptyMessage?: string
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
}) => {
  return (
    <div className="min-h-screen px-6 py-8 ">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3 px-3">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-800">
                {title}
              </h1>
              <p className="text-xs font-medium text-slate-400">
                Total: {totalCount} record{totalCount !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <button
            onClick={onAdd}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-green-500 rounded-xl hover:bg-green-600 shadow-md shadow-green-200 transition-all hover:-translate-y-0.5"
          >
            <Plus size={16} />
            {addLabel}
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-5">
          <Search
            size={15}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={`Search ${title.toLowerCase()}...`}
            className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-green-300 focus:border-green-400 transition"
          />
        </div>

        {/* Table */}
        <div className="overflow-hidden bg-white border shadow-sm rounded-2xl border-slate-200">
          {/* Head — dynamic columns + Actions */}
          <div
            className="px-6 py-3 border-b bg-slate-50 border-slate-100"
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr)) 160px`,
            }}
          >
            {columns.map((col) => (
              <span
                key={col.key}
                className="text-xs font-bold tracking-wider uppercase text-slate-500"
              >
                {col.label}
              </span>
            ))}
                <span className="flex justify-center text-xs font-bold tracking-wider text-right uppercase text-slate-500">
                 Actions
                </span>
          </div>

          {/* Body */}
          {fetching ? (
            <div className="flex justify-center py-16">
              <span className="w-8 h-8 border-4 border-green-200 rounded-full border-t-green-500 animate-spin" />
            </div>
          ) : rows.length === 0 ? (
            <div className="py-16 text-sm font-medium text-center text-slate-400">
              {emptyMessage}
            </div>
          ) : (
            rows.map((row, i) => (
              <div
                key={row.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr)) 160px`,
                }}
                className={`items-center px-6 py-4 transition hover:bg-green-50/50 ${
                  i !== rows.length - 1 ? "border-b border-slate-100" : ""
                }`}
              >
                {columns.map((col) => (
                  <div key={col.key}>
                    {col.badge ? (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg  text-xs font-bold tracking-wider">
                        {row[col.key] || "—"}
                      </span>
                    ) : (
                      <span className="text-sm font-semibold text-slate-700">
                        {row[col.key] || "—"}
                      </span>
                    )}
                  </div>
                ))}

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 w-[160px]">
                  <button
                    onClick={() => onEdit(row)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition"
                  >
                    <Pencil size={12} /> Edit
                  </button>
                  <button
                    onClick={() => onDelete(row)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition"
                  >
                    <Trash2 size={12} /> Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 mt-5 text-center bg-white border border-slate-200 rounded-2xl">
          <span className="text-sm font-semibold">
            {totalCount} record{totalCount !== 1 ? "s" : ""} available
          </span>
        </div>
      </div>
    </div>
  );
};

export default CustomerMaintenanceTable;
