import React from "react";
import { inputCls, Field, RadioGroup } from "./shared_ui";


export default function Step5OwnerDetails({ formData, handleChange }) {
  const isSoleProp  = formData.business_registration === "Sole Proprietor";
  const isCorporate = !!formData.business_registration && !isSoleProp;

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">

      {/* ─── Entity Type — auto-locked from business_registration ─── */}
<Field label="Entity Type" span2>
        <div className="flex gap-3 mt-1">
          {(isSoleProp || isCorporate) && (
            <div className="flex items-center gap-2.5 px-4 py-2 text-sm font-semibold border rounded-md text-slate-700 bg-slate-50 border-slate-300">
              {isSoleProp ? "Sole Proprietor" : "Corporation"}
            </div>
          )}
          {!formData.business_registration && (
            <p className="text-sm text-slate-400">
              Select a Business Registration in Step 2 first.
            </p>
          )}
        </div>
        {formData.business_registration && (
          <p className="mt-1.5 text-xs text-slate-400">
            Auto-set from Business Registration ({formData.business_registration})
          </p>
        )}
      </Field>

      {/* ─── CORPORATION ─── */}
      {isCorporate && (
        <>

          <Field label="Annual Meeting Date">
            <input
              type="date"
              name="annual_meeting_date"
              value={formData.annual_meeting_date}
              onChange={handleChange}
              className={inputCls}
            />
          </Field>

          <Field label="President Name">
            <input
              type="text"
              name="president_name"
              value={formData.president_name}
              onChange={handleChange}
              placeholder="Enter president's full name"
              className={inputCls}
            />
          </Field>

          <Field label="Corporate Secretary Name" >
            <input
              type="text"
              name="corporate_secretary_name"
              value={formData.corporate_secretary_name}
              onChange={handleChange}
              placeholder="Enter corporate secretary's full name"
              className={inputCls}
            />
          </Field>
        </>
      )}

      {/* ─── SOLE PROPRIETOR ─── */}
      {isSoleProp && (
        <>
          <Field label="Signatory Type" >
            <RadioGroup
              name="sole_proprietor_signatory_type"
              value={formData.sole_proprietor_signatory_type}
              onChange={handleChange}
              options={["Owner", "Authorized Representative"]}
            />
          </Field>

          <Field label="Father's Name">
            <input
              type="text"
              name="fathers_name"
              value={formData.fathers_name}
              onChange={handleChange}
              placeholder="Enter father's name"
              className={inputCls}
            />
          </Field>

          <Field label="Mother's Maiden Name">
            <input
              type="text"
              name="mothers_maiden_name"
              value={formData.mothers_maiden_name}
              onChange={handleChange}
              placeholder="Enter mother's maiden name"
              className={inputCls}
            />
          </Field>

          <Field label="Marital Status">
            <input
              type="text"
              name="marital_status"
              value={formData.marital_status}
              onChange={handleChange}
              placeholder="Single / Married / Widowed"
              className={inputCls}
            />
          </Field>

          <Field label="Date of Birth">
            <input
              type="date"
              name="date_of_birth"
              value={formData.date_of_birth}
              onChange={handleChange}
              className={inputCls}
            />
          </Field>

          <Field label="Citizenship">
            <input
              type="text"
              name="citizenship"
              value={formData.citizenship}
              onChange={handleChange}
              placeholder="Enter citizenship"
              className={inputCls}
            />
          </Field>

          <Field label="Gender">
            <input
              type="text"
              name="gender"
              value={formData.gender}
              onChange={handleChange}
              placeholder="Enter gender"
              className={inputCls}
            />
          </Field>

          <Field label="Present Home Address" >
            <input
              type="text"
              name="present_home_address"
              value={formData.present_home_address}
              onChange={handleChange}
              placeholder="Enter present home address"
              className={inputCls}
            />
          </Field>

          <Field label="Permanent Home Address" >
            <input
              type="text"
              name="permanent_home_address"
              value={formData.permanent_home_address}
              onChange={handleChange}
              placeholder="Enter permanent home address"
              className={inputCls}
            />
          </Field>

          <Field label="Personal Email Address" >
            <input
              type="email"
              name="personal_email_address"
              value={formData.personal_email_address}
              onChange={handleChange}
              placeholder="personal@email.com"
              className={inputCls}
            />
          </Field>
        </>
      )}

    </div>
  );
}