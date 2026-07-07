import React from "react";
import { inputCls, selectCls, disabledInputCls, Field } from "./shared_ui";

export default function Step1CoverageStatus({ formData, handleChange, dropdowns, ddLoading }) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">

      <Field label="Client ID Number" span2>
        <input
          type="text"
          value={formData.client_id_number}
          disabled
          className={disabledInputCls}
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

      <Field label="Status">
        <select
          name="status"
          value={formData.status}
          onChange={handleChange}
          className={selectCls}
          disabled={ddLoading}
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