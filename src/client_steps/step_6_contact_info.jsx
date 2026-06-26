import React from "react";

const inputCls =
  "w-full px-4 py-2.5 text-sm border-2 rounded-lg border-slate-200 focus:border-blue-500 focus:outline-none transition bg-white text-slate-800 placeholder-slate-400";

const Field = ({ label, children, span2 }) => (
  <div className={span2 ? "md:col-span-2" : ""}>
    <label className="block mb-1.5 text-xs font-semibold tracking-wide uppercase text-slate-500">
      {label}
    </label>
    {children}
  </div>
);

export default function Step6ContactInfo({ formData, handleChange }) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">

      <Field label="Contact Person">
        <input
          type="text"
          name="contact_person"
          value={formData.contact_person}
          onChange={handleChange}
          placeholder="Full name"
          className={inputCls}
        />
      </Field>

      <Field label="Designation">
        <input
          type="text"
          name="designation"
          value={formData.designation}
          onChange={handleChange}
          placeholder="e.g. Owner, Manager"
          className={inputCls}
        />
      </Field>

      <Field label="Email Address">
        <input
          type="email"
          name="email_address"
          value={formData.email_address}
          onChange={handleChange}
          placeholder="email@example.com"
          className={inputCls}
        />
      </Field>

      <Field label="Contact Number">
        <input
          type="text"
          name="contact_number"
          value={formData.contact_number}
          onChange={handleChange}
          placeholder="09XX-XXX-XXXX"
          className={inputCls}
        />
      </Field>

      <Field label="Official Office Contact Number">
        <input
          type="text"
          name="official_office_contact_number"
          value={formData.official_office_contact_number}
          onChange={handleChange}
          placeholder="Office landline or number"
          className={inputCls}
        />
      </Field>

    </div>
  );
}