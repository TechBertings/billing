import React, { useState, useEffect } from "react";
import { FaPaperPlane, FaTimes, FaChevronRight, FaChevronLeft, FaCheck } from "react-icons/fa";
import { supabase } from "../../lib/supabaseClient";
import Step1CoverageStatus   from "../../client_steps/step_1_coverage_status";
import Step2BusinessInfo     from "../../client_steps/step_2_business_info";
import Step3TaxRegistration  from "../../client_steps/step_3_tax_registration";
import Step4AddressLocation  from "../../client_steps/step_4_address_location";
import Step5OwnerDetails     from "../../client_steps/step_5_owner_details";
import Step6ContactInfo      from "../../client_steps/step_6_contact_info";
import Step7Fees                    from "../../client_steps/step_7_fees";
import Step8GovernmentRemittances   from "../../client_steps/step_8_government_remittances";

// ─── FEE / REMITTANCE FIELD KEYS ──────────────────────────────────────────────
// Kept here as flat lists so initialForm and the Supabase insert payload can't
// silently drift out of sync with the Step7/Step8 components.
const FEE_FIELD_KEYS = [
  "fee_sec_registration",
  "fee_sec_gis_renewal",
  "fee_sec_business_closure",
  "fee_dti_registration",
  "fee_dti_renewal",
  "fee_dti_business_closure",
  "fee_municipality_registration",
  "fee_municipality_permit_renewal",
  "fee_municipality_business_closure",
  "fee_fire_certificate",
  "fee_sanitary_permit",
  "fee_barangay_permit",
  "fee_bir_registration",
  "fee_bir_fs_prep_filing",
  "fee_bir_audit_certificate",
  "fee_bir_loa_vat_audit",
  "fee_bir_loa",
  "fee_bir_open_case",
  "fee_bir_books_renewal",
  "fee_bir_cor_updating",
  "fee_bir_business_closure",
  "fee_bir_atp",
  "fee_bir_invoice_booklets",
  "fee_bir_quarterly_esubmission",
  "fee_bir_annual_esubmission",
  "fee_bir_annual_form_2316",
  "fee_bir_form_2316_by_request",
  "fee_bir_lessee_info_sheet",
  "fee_bookkeeping",
  "fee_inventory_list",
  "fee_sss_registration",
  "fee_philhealth_registration",
  "fee_pagibig_registration",
  "fee_sss_maternity_submission",
  "fee_sss_record_updating",
  "fee_philhealth_record_updating",
  "fee_pagibig_record_updating",
  "fee_sss_closure",
  "fee_philhealth_closure",
  "fee_pagibig_closure",
  "fee_tin_card_existing",
  "fee_tin_card_new",
  "fee_admin_miscellaneous",
  "fee_sap_support_monitoring",
  "fee_municipal_updates",
  "fee_retainer_tax_filing",
  "fee_retainer_govt_contributions",
];

const REMITTANCE_FIELD_KEYS = [
  "remit_sec_registration",
  "remit_dti_barangay",
  "remit_dti_municipality",
  "remit_dti_regional",
  "remit_dti_national",
  "remit_bir_income_tax",
  "remit_bir_vat",
  "remit_bir_percentage_tax",
  "remit_bir_wtax_rental",
  "remit_bir_wtax_compensation",
  "remit_bir_wtax_final",
  "remit_bir_documentary_stamp",
  "remit_bir_loa_assessment",
  "remit_bir_open_cases",
  "remit_mayors_permit",
  "remit_cedula",
  "remit_insurance",
  "remit_barangay",
  "remit_fire",
  "remit_sanitary",
  "remit_sss_contributions",
  "remit_sss_loan",
  "remit_sss_personal_contribution",
  "remit_philhealth_contributions",
  "remit_philhealth_personal_contribution",
  "remit_pagibig_contributions",
  "remit_pagibig_personal_contribution",
  "remit_pagibig_loan",
  "remit_mp2",
];

// ─── INITIAL STATE ────────────────────────────────────────────────────────────
const initialForm = {
  client_id_number: "",
  account: "",
  date_of_coverage: "",
  month_of_coverage: "",
  status: "",
  business_registration: "",
  line_of_business: "",
  // Sole Proprietor name fields
  first_name: "",
  middle_name: "",
  last_name: "",
  // Non-sole-prop
  business_name: "",
  trade_name: "",
  tax_type: "",
  source_of_income: "",
  tax_payer_classification: "",
  business_registration_numbers: "",
  tin: "",
  sec_registration_no: "",
  date_of_incorporation: "",
  dti_registration: "",
  date_of_expiration: "",
  sss_employer_no: "",
  phic_employer_no: "",
  hdmf_employer_no: "",
  corporation_signatory_type: "",
  sole_proprietor_signatory_type: "",
  registered_business_address: "",
  renting: "No",
  renting_rent_fee: "",
  rdo: "",
  district: "",
  zip_code: "",
  google_map_location: "",
  entity_type: "",
  fathers_name: "",
  mothers_maiden_name: "",
  marital_status: "",
  date_of_birth: "",
  citizenship: "",
  gender: "",
  present_home_address: "",
  permanent_home_address: "",
  personal_email_address: "",
  contact_person: "",
  designation: "",
  email_address: "",
  contact_number: "",
  official_office_contact_number: "",
  annual_meeting_date: "",
  president_name: "",
  corporate_secretary_name: "",
  // ✅ Fees (Step 7) — all default to empty, rendered as 0.00 placeholder
  ...Object.fromEntries(FEE_FIELD_KEYS.map((k) => [k, ""])),
  // ✅ Government Remittances (Step 8)
  ...Object.fromEntries(REMITTANCE_FIELD_KEYS.map((k) => [k, ""])),
};

const STEPS = [
  { id: 1, label: "Coverage & Status" },
  { id: 2, label: "Business Info" },
  { id: 3, label: "Tax & Registration" },
  { id: 4, label: "Address & Location" },
  { id: 5, label: "Owner Details" },
  { id: 6, label: "Contact Info" },
  { id: 7, label: "Fees" },
  { id: 8, label: "Government Remittances" },
];

const generateNextID = async () => {
  const year = String(new Date().getFullYear());

  const { data } = await supabase
    .from("client_profile")
    .select("client_id")
    .ilike("client_id", `${year}-%`)
    .order("client_id", { ascending: false })
    .limit(1);

  let counter = 1;
  if (data && data.length > 0) {
    const last = parseInt(data[0].client_id?.split("-")[1]) || 0;
    counter = last + 1;
  }
  return `${year}-${String(counter).padStart(5, "0")}`;
};

const formatTIN = (val) => {
  let f = val.replace(/[^0-9]/g, "").slice(0, 12);
  if (f.length > 9) f = `${f.slice(0,3)}-${f.slice(3,6)}-${f.slice(6,9)}-${f.slice(9)}`;
  else if (f.length > 6) f = `${f.slice(0,3)}-${f.slice(3,6)}-${f.slice(6)}`;
  else if (f.length > 3) f = `${f.slice(0,3)}-${f.slice(3)}`;
  return f;
};

// ─── STEP BAR ─────────────────────────────────────────────────────────────────
// Minimal, non-overflowing step indicator. Numbers + a thin connecting line;
// labels are shown only for the active step so long labels (like "Government
// Remittances") never get clipped at the edge of the container.
const StepBar = ({ current, onStepClick }) => (
  <div className="mb-6">
    <div className="flex items-center w-full">
      {STEPS.map((step, idx) => {
        const done   = current > step.id;
        const active = current === step.id;
        return (
          <React.Fragment key={step.id}>
            <button
              type="button"
              onClick={() => onStepClick(step.id)}
              title={step.label}
              className="flex flex-col items-center gap-2 shrink-0 group"
            >
              <div
                className={`flex items-center justify-center w-9 h-9 rounded-full text-xs font-semibold border transition-colors
                  ${active
                    ? "bg-slate-900 border-slate-900 text-white ring-4 ring-slate-100"
                    : done
                    ? "bg-slate-900 border-slate-900 text-white"
                    : "bg-white border-slate-300 text-slate-400 group-hover:border-slate-400 group-hover:text-slate-600"}`}
              >
                {done ? <FaCheck size={10} /> : step.id}
              </div>
              <span
                className={`hidden md:block text-[11px] leading-tight text-center w-24 h-7 transition-colors
                  ${active ? "text-slate-900 font-semibold" : "text-slate-400 font-medium"}`}
              >
                {step.label}
              </span>
            </button>
            {idx < STEPS.length - 1 && (
              <div className={`flex-1 h-px mx-1 md:mx-2 mb-7 transition-colors ${done ? "bg-slate-900" : "bg-slate-200"}`} />
            )}
            {idx < STEPS.length - 1 && (
              <div className={`flex-1 h-px mx-1 md:mx-2 mb-4 md:mb-5 transition-colors ${done ? "bg-slate-900" : "bg-slate-200"}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  </div>
);

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function ClientProfile() {
  const [formData, setFormData]   = useState({ ...initialForm, client_id_number: "Generating..." });
  const [step, setStep]           = useState(1);
  const [loading, setLoading]     = useState(false);
  const [message, setMessage]     = useState("");
  const [messageType, setMessageType] = useState("");
  const [mapInput, setMapInput]   = useState("");
  const [mapQuery, setMapQuery]   = useState("Philippines");
  const [ddLoading, setDdLoading] = useState(true);
  const [dropdowns, setDropdowns] = useState({
    status: [], business_registration: [], line_of_business: [],
    tax_type: [], source_of_income: [], tax_payer_classification: [],
    vat_type: [], account: [], rent_fees: [],
  });

  // Fetch dropdowns
  useEffect(() => {
    const fetchDropdowns = async () => {
      setDdLoading(true);
      try {
        const [stat, br, lob, tt, soi, tpc, vt, acct, rf] = await Promise.all([
          supabase.from("status").select("id, status").order("id"),
          supabase.from("business_registration").select("id, business_registration").order("id"),
          supabase.from("line_of_business").select("id, line_of_business").order("id"),
          supabase.from("tax_type").select("id, tax_type").order("id"),
          supabase.from("source_of_income").select("id, source_of_income").order("id"),
          supabase.from("tax_payer_classification").select("id, tax_payer_classification").order("id"),
          supabase.from("vat_type").select("id, vat_type").order("id"),
          supabase.from("account").select("id, account").order("account"),
          supabase.from("rent_fees").select("id, rf_code").order("rf_code"),
        ]);
        setDropdowns({
          status: stat.data || [],
          business_registration: br.data || [],
          line_of_business: lob.data || [],
          tax_type: tt.data || [],
          source_of_income: soi.data || [],
          tax_payer_classification: tpc.data || [],
          vat_type: vt.data || [],
          account: acct.data || [],
          rent_fees: rf.data || [],
        });
      } catch (err) {
        console.error(err);
      } finally {
        setDdLoading(false);
      }
    };
    fetchDropdowns();
  }, []);

  // ✅ CHANGE 1: Auto-set status to "Existing" after dropdowns load
  useEffect(() => {
    if (!ddLoading && dropdowns.status.length > 0) {
      setFormData((p) => ({ ...p, status: p.status || "Active" }));
    }
  }, [ddLoading]);

  // Generate client ID on mount
  useEffect(() => {
    generateNextID().then((id) =>
      setFormData((p) => ({ ...p, client_id_number: id }))
    );
  }, []);

  // ─── HANDLE CHANGE ──────────────────────────────────────────────────────────
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (type === "checkbox") {
      setFormData((p) => ({ ...p, [name]: checked ? "Yes" : "No" }));

    } else if (name === "tin") {
      setFormData((p) => ({ ...p, tin: formatTIN(value) }));

    } else if (name === "business_registration") {
      // ✅ CHANGE 3: Auto-set entity_type from business_registration
      const entityType =
        value === "Sole Proprietor" ? "Sole Proprietor"
        : value ? "Corporation"
        : "";
      setFormData((p) => ({
        ...p,
        business_registration: value,
        entity_type: entityType,
        // Reset name fields when registration type changes
        business_name: "",
        first_name: "",
        middle_name: "",
        last_name: "",
      }));

    } else {
      setFormData((p) => ({ ...p, [name]: value }));
    }
  };

  // ─── RESET ──────────────────────────────────────────────────────────────────
  const handleReset = () => {
    setFormData({ ...initialForm, client_id_number: "Generating..." });
    setMapInput(""); setMapQuery("Philippines"); setStep(1); setMessage("");
    generateNextID().then((id) =>
      setFormData((p) => ({ ...p, client_id_number: id, status: "Existing" }))
    );
  };

  const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  // Convert an amount field to a number for storage, or null if left blank.
  const parseMoney = (val) => {
    if (val === "" || val === null || val === undefined) return null;
    const n = parseFloat(val);
    return isNaN(n) ? null : n;
  };

  // ─── SUBMIT ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
  // ✅ Required email validation
  if (!formData.email_address || !formData.email_address.trim()) {
    setMessage("❌ Email Address is required. Please go to Step 6 (Contact Info) and enter a valid email.");
    setMessageType("error");
    setStep(6);
    return;
  }
  if (!isValidEmail(formData.email_address)) {
    setMessage("❌ Please enter a valid email address (e.g. name@example.com).");
    setMessageType("error");
    setStep(6);
    return;
  }
    setLoading(true);
    setMessage("");
    try {
      const freshID = await generateNextID();
      const isSoleProp = formData.business_registration === "Sole Proprietor";

      // ✅ Build fee_* / remit_* payload from the field-key lists so Step 7/8
      // stay in sync with what actually gets saved.
      const feePayload = Object.fromEntries(
        FEE_FIELD_KEYS.map((k) => [k, parseMoney(formData[k])])
      );
      const remittancePayload = Object.fromEntries(
        REMITTANCE_FIELD_KEYS.map((k) => [k, parseMoney(formData[k])])
      );

      const { error } = await supabase.from("client_profile").insert([{
        client_id: freshID,
        date_of_coverage: formData.date_of_coverage || null,
        month_of_coverage: formData.month_of_coverage || null,
        status: formData.status,
        business_registration: formData.business_registration,
        line_of_business: formData.line_of_business,
        
        // ✅ CHANGE 2: Combine first/mid/last for sole prop
        business_name: isSoleProp
          ? `${formData.first_name} ${formData.middle_name} ${formData.last_name}`.replace(/\s+/g, " ").trim()
          : formData.business_name,
        first_name: formData.first_name,
        middle_name: formData.middle_name,
        last_name: formData.last_name,
        trade_name: formData.trade_name,
        tax_type: formData.tax_type,
        source_of_income: formData.source_of_income,
        tax_payer_classification: formData.tax_payer_classification,
        business_registration_numbers: formData.business_registration_numbers,
        tin: formData.tin,
        sec_registration_no: formData.sec_registration_no,
        date_of_incorporation: formData.date_of_incorporation || null,
        dti_registration: formData.dti_registration,
        date_of_expiration: formData.date_of_expiration || null,
        sss_employer_no: formData.sss_employer_no,
        phic_employer_no: formData.phic_employer_no,
        hdmf_employer_no: formData.hdmf_employer_no,
        corporation_signatory_type: formData.corporation_signatory_type,
        sole_proprietor_signatory_type: formData.sole_proprietor_signatory_type,
        registered_business_address: formData.registered_business_address,
        renting: formData.renting,
        renting_rent_fee: formData.renting_rent_fee || null,
        rdo: formData.rdo,
        district: formData.district,
        zip_code: formData.zip_code,
        google_map_location: formData.google_map_location,
        entity_type: formData.entity_type,
        fathers_name: formData.fathers_name,
        mothers_maiden_name: formData.mothers_maiden_name,
        marital_status: formData.marital_status,
        date_of_birth: formData.date_of_birth || null,
        citizenship: formData.citizenship,
        gender: formData.gender,
        present_home_address: formData.present_home_address,
        permanent_home_address: formData.permanent_home_address,
        personal_email_address: formData.personal_email_address,
        contact_person: formData.contact_person,
        designation: formData.designation,
        email_address: formData.email_address,
        contact_number: formData.contact_number,
        official_office_contact_number: formData.official_office_contact_number,
        annual_meeting_date: formData.annual_meeting_date || null,
        president_name: formData.president_name,
        corporate_secretary_name: formData.corporate_secretary_name,    
        approval_status: "pending",
        account: formData.account || null,
        created_at: new Date().toISOString(),
        // ✅ Fees (Step 7) and Government Remittances (Step 8)
        ...feePayload,
        ...remittancePayload,
      }]);

      if (error) throw error;
      setMessage(`✅ Client profile submitted! ID: ${freshID}`);
      setMessageType("success");
      setTimeout(() => handleReset(), 2500);
    } catch (err) {
      setMessage(`❌ Error: ${err.message}`);
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  };

  // ─── RENDER STEP ────────────────────────────────────────────────────────────
  const renderStep = () => {
    switch (step) {
      case 1: return <Step1CoverageStatus formData={formData} handleChange={handleChange} dropdowns={dropdowns} ddLoading={ddLoading} />;
      case 2: return <Step2BusinessInfo   formData={formData} handleChange={handleChange} dropdowns={dropdowns} ddLoading={ddLoading} />;
      case 3: return <Step3TaxRegistration formData={formData} handleChange={handleChange} />;
      case 4: return <Step4AddressLocation formData={formData} handleChange={handleChange} setFormData={setFormData} dropdowns={dropdowns} mapInput={mapInput} setMapInput={setMapInput} mapQuery={mapQuery} setMapQuery={setMapQuery} />;
      case 5: return <Step5OwnerDetails   formData={formData} handleChange={handleChange} setFormData={setFormData} />;
      case 6: return <Step6ContactInfo    formData={formData} handleChange={handleChange} />;
      case 7: return <Step7Fees           formData={formData} handleChange={handleChange} />;
      case 8: return <Step8GovernmentRemittances formData={formData} handleChange={handleChange} />;
      default: return null;
    }
  };

  const isLastStep  = step === STEPS.length;
  const isFirstStep = step === 1;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="w-full px-6 py-8 mx-auto max-w-none lg:px-12">
        {/* Header */}
<div className="pb-5 mb-8 border-b border-slate-200">
          <p className="text-[11px] font-semibold tracking-widest text-slate-400 uppercase mb-1">
            Client Onboarding
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Client Profile</h1>
          <p className="mt-1 text-sm text-slate-500">
            Complete all steps to submit client information for approval
          </p>
        </div>
        <StepBar current={step} onStepClick={setStep} />

        <div className="bg-white border rounded-lg border-slate-200">
          {/* Step Title Bar — flat, minimal, no gradient */}
<div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 md:px-8 bg-slate-50/50">
            <div>
              <span className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                Step {step} of {STEPS.length} — {STEPS[step - 1].label}
              </span>
              <h2 className="mt-1 text-lg font-semibold text-slate-900">
                {STEPS[step - 1].label}
              </h2>
            </div>
            <div className="hidden gap-1 sm:flex">
              {STEPS.map((s) => (
                <div key={s.id} className={`h-1 w-6 rounded-full transition-colors
                  ${s.id <= step ? "bg-slate-900" : "bg-slate-200"}`} />
              ))}
            </div>
          </div>

          <div className="p-6 md:p-8">
            {message && (
              <div className={`mb-6 p-4 rounded-md border-l-4 text-sm
                ${messageType === "success" ? "bg-green-50 border-green-500 text-green-700" : "bg-red-50 border-red-500 text-red-700"}`}>
                {message}
              </div>
            )}

            {renderStep()}

            {/* Navigation */}
            <div className="flex gap-4 pt-6 mt-10 border-t border-slate-100">
              <button
                type="button"
                onClick={handleReset}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
              >
                <FaTimes size={12} /> Reset
              </button>
              <div className="flex gap-3 ml-auto">
                {!isFirstStep && (
                  <button
                    type="button"
                    onClick={() => setStep((s) => s - 1)}
                    className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium rounded-md border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 transition"
                  >
                    <FaChevronLeft size={11} /> Back
                  </button>
                )}
                {!isLastStep ? (
                  <button
                    type="button"
                    onClick={() => setStep((s) => s + 1)}
                    className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium rounded-md bg-slate-900 hover:bg-slate-800 text-white transition"
                  >
                    Next <FaChevronRight size={11} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={loading}
                    className="flex items-center gap-2 px-8 py-2.5 text-sm font-medium rounded-md bg-slate-900 text-white transition hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <FaPaperPlane size={12} />
                    {loading ? "Submitting..." : "Submit for Approval"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}