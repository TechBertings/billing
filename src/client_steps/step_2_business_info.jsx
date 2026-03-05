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

export default function Step2BusinessInfo({ formData, handleChange, dropdowns, ddLoading }) {
  const isSoleProp = formData.business_registration === "Sole Proprietor";

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">

      <Field label="Business Registration">
        <select
          name="business_registration"
          value={formData.business_registration}
          onChange={handleChange}
          className={selectCls}
          disabled={ddLoading}
        >
          <option value="">— Select —</option>
          {dropdowns.business_registration.map((o) => (
            <option key={o.id} value={o.business_registration}>
              {o.business_registration}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Line of Business">
        <select
          name="line_of_business"
          value={formData.line_of_business}
          onChange={handleChange}
          className={selectCls}
          disabled={ddLoading}
        >
          <option value="">— Select —</option>
          {dropdowns.line_of_business.map((o) => (
            <option key={o.id} value={o.line_of_business}>
              {o.line_of_business}
            </option>
          ))}
        </select>
      </Field>

      {/* ✅ CHANGE 2: Sole Proprietor = First/Middle/Last; others = Business Name */}
      {isSoleProp ? (
        <>
          <Field label="First Name">
            <input
              type="text"
              name="first_name"
              value={formData.first_name}
              onChange={handleChange}
              placeholder="Enter first name"
              className={inputCls}
            />
          </Field>
          <Field label="Middle Name">
            <input
              type="text"
              name="middle_name"
              value={formData.middle_name}
              onChange={handleChange}
              placeholder="Enter middle name"
              className={inputCls}
            />
          </Field>
          <Field label="Last Name">
            <input
              type="text"
              name="last_name"
              value={formData.last_name}
              onChange={handleChange}
              placeholder="Enter last name"
              className={inputCls}
            />
          </Field>
        </>
      ) : (
        <Field label="Business Name">
          <input
            type="text"
            name="business_name"
            value={formData.business_name}
            onChange={handleChange}
            placeholder="Enter business name"
            className={inputCls}
          />
        </Field>
      )}

      <Field label="Trade Name">
        <input
          type="text"
          name="trade_name"
          value={formData.trade_name}
          onChange={handleChange}
          placeholder="Enter trade name"
          className={inputCls}
        />
      </Field>

      <Field label="Tax Type">
        <select
          name="tax_type"
          value={formData.tax_type}
          onChange={handleChange}
          className={selectCls}
          disabled={ddLoading}
        >
          <option value="">— Select —</option>
          {dropdowns.tax_type.map((o) => (
            <option key={o.id} value={o.tax_type}>
              {o.tax_type}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Source of Income">
        <select
          name="source_of_income"
          value={formData.source_of_income}
          onChange={handleChange}
          className={selectCls}
          disabled={ddLoading}
        >
          <option value="">— Select —</option>
          {dropdowns.source_of_income.map((o) => (
            <option key={o.id} value={o.source_of_income}>
              {o.source_of_income}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Tax Payer Classification (RA 11976)">
        <select
          name="tax_payer_classification"
          value={formData.tax_payer_classification}
          onChange={handleChange}
          className={selectCls}
          disabled={ddLoading}
        >
          <option value="">— Select —</option>
          {dropdowns.tax_payer_classification.map((o) => (
            <option key={o.id} value={o.tax_payer_classification}>
              {o.tax_payer_classification}
            </option>
          ))}
        </select>
      </Field>

    </div>
  );
}