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

export default function Step3TaxRegistration({ formData, handleChange }) {
  const isSoleProp = formData.business_registration === "Sole Proprietor";
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">

      <Field label="Business Registration Numbers">
        <input
          type="text"
          name="business_registration_numbers"
          value={formData.business_registration_numbers}
          onChange={handleChange}
          placeholder="Enter registration numbers"
          className={inputCls}
        />
      </Field>

      <Field label="TIN">
        <input
          type="text"
          name="tin"
          value={formData.tin}
          onChange={handleChange}
          placeholder="XXX-XXX-XXX-XXX"
          maxLength="16"
          className={`${inputCls} font-mono`}
        />
      </Field>

 {/* ✅ Sole Prop = DTI only | Others = SEC + Date of Incorporation */}
      {isSoleProp ? (
        <>
          <Field label="DTI Registration">
            <input
              type="text"
              name="dti_registration"
              value={formData.dti_registration}
              onChange={handleChange}
              placeholder="Enter DTI registration"
              className={inputCls}
            />
          </Field>
          <Field label="Date of Expiration">
            <input
              type="date"
              name="date_of_expiration"
              value={formData.date_of_expiration}
              onChange={handleChange}
              className={inputCls}
            />
          </Field>
        </>
      ) : (
        <>
          <Field label="SEC Registration No.">
            <input
              type="text"
              name="sec_registration_no"
              value={formData.sec_registration_no}
              onChange={handleChange}
              placeholder="Enter SEC no."
              className={inputCls}
            />
          </Field>
          <Field label="Date of Incorporation">
            <input
              type="date"
              name="date_of_incorporation"
              value={formData.date_of_incorporation}
              onChange={handleChange}
              className={inputCls}
            />
          </Field>
        </>
      )}

      <Field label="SSS Employer No.">
        <input
          type="text"
          name="sss_employer_no"
          value={formData.sss_employer_no}
          onChange={handleChange}
          placeholder="Enter SSS no."
          className={inputCls}
        />
      </Field>

      <Field label="PHIC Employer No.">
        <input
          type="text"
          name="phic_employer_no"
          value={formData.phic_employer_no}
          onChange={handleChange}
          placeholder="Enter PHIC no."
          className={inputCls}
        />
      </Field>

      <Field label="HDMF Employer No." span2>
        <input
          type="text"
          name="hdmf_employer_no"
          value={formData.hdmf_employer_no}
          onChange={handleChange}
          placeholder="Enter HDMF no."
          className={inputCls}
        />
      </Field>

    </div>
  );
}