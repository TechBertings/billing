import React from "react";
import { inputCls, Field } from "./shared_ui";

const errorInputCls =
  "w-full px-3 py-2 text-sm border border-red-300 rounded-md bg-red-50 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-red-500 transition";

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

export default function Step6ContactInfo({ formData, handleChange }) {
  const emailTouched = formData.email_address && formData.email_address.trim().length > 0;
  const emailInvalid = emailTouched && !isValidEmail(formData.email_address);

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

      <Field label="Email Address" required>
        <input
          type="email"
          name="email_address"
          value={formData.email_address}
          onChange={handleChange}
          placeholder="email@example.com"
          className={emailInvalid ? errorInputCls : inputCls}
        />
        {emailInvalid && (
          <p className="mt-1 text-xs text-red-500">Please enter a valid email address.</p>
        )}
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