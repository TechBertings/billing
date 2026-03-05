import React from "react";

const inputCls =
  "w-full px-4 py-2.5 text-sm border-2 rounded-lg border-slate-200 focus:border-blue-500 focus:outline-none transition bg-white text-slate-800 placeholder-slate-400";
const selectCls =
  "w-full px-4 py-2.5 text-sm border-2 rounded-lg border-slate-200 focus:border-blue-500 focus:outline-none transition bg-white text-slate-800 cursor-pointer";

const Field = ({ label, children, span2 }) => (
  <div className={span2 ? "md:col-span-2" : ""}>
    <label className="block mb-1.5 text-xs font-semibold tracking-wide uppercase text-slate-500">
      {label}
    </label>
    {children}
  </div>
);

export default function Step1CoverageStatus({ formData, handleChange, dropdowns, ddLoading }) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <Field label="Client ID Number" span2>
        <input
          type="text"
          value={formData.client_id_number}
          disabled
          className="w-full px-4 py-2.5 text-sm font-mono font-semibold text-blue-600 bg-blue-50 border-2 border-blue-200 rounded-lg cursor-not-allowed"
        />
      </Field>

      <Field label="Date of Coverage">
        <input
          type="date"
          name="date_of_coverage"
          value={formData.date_of_coverage}
          onChange={handleChange}
          className={inputCls}
        />
      </Field>

      <Field label="Month of Coverage">
        <input
          type="date"
          name="month_of_coverage"
          value={formData.month_of_coverage}
          onChange={handleChange}
          className={inputCls}
        />
      </Field>

      <Field label="Account">
        <select
          name="account"
          value={formData.account}
          onChange={handleChange}
          className={selectCls}
          disabled={ddLoading}
        >
          <option value="">— Select Account —</option>
          {dropdowns.account.map((o) => (
            <option key={o.id} value={o.account}>
              {o.acct_code ? `${o.acct_code} — ${o.account}` : o.account}
            </option>
          ))}
        </select>
      </Field>

      {/* ✅ CHANGE 1: Status defaults to "Existing" — set in ClientProfile.jsx via useEffect */}
      <Field label="Status">
        <select
          name="status"
          value={formData.status}
          onChange={handleChange}
          className={selectCls}
          disabled={true}
        >
          <option value="">— Select Status —</option>
          {dropdowns.status.map((o) => (
            <option key={o.id} value={o.status}>
              {o.status}
            </option>
          ))}
        </select>
      </Field>
    </div>
  );
}