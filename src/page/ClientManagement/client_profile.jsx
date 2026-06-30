import React, { useState, useEffect } from "react";
import { FaPaperPlane, FaTimes, FaChevronRight, FaChevronLeft, FaCheck } from "react-icons/fa";
import { supabase } from "../../lib/supabaseClient";
import Step1CoverageStatus   from "../../client_steps/step_1_coverage_status";
import Step2BusinessInfo     from "../../client_steps/step_2_business_info";
import Step3TaxRegistration  from "../../client_steps/step_3_tax_registration";
import Step4AddressLocation  from "../../client_steps/step_4_address_location";
import Step5OwnerDetails     from "../../client_steps/step_5_owner_details";
import Step6ContactInfo      from "../../client_steps/step_6_contact_info";

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
  renting_vat_type: "",
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
};

const STEPS = [
  { id: 1, label: "Coverage & Status" },
  { id: 2, label: "Business Info" },
  { id: 3, label: "Tax & Registration" },
  { id: 4, label: "Address & Location" },
  { id: 5, label: "Owner Details" },
  { id: 6, label: "Contact Info" },
];

const generateNextID = async () => {
  const now = new Date();
  const day   = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year  = String(now.getFullYear()).slice(-2);
  const datePart = `${day}${month}${year}`;

  const { data } = await supabase
    .from("client_profile")
    .select("client_id")
    .ilike("client_id", `${datePart}-%`)
    .order("client_id", { ascending: false })
    .limit(1);

  let counter = 1;
  if (data && data.length > 0) {
    const last = parseInt(data[0].client_id?.split("-")[1]) || 0;
    counter = last + 1;
  }
  return `${datePart}-${String(counter).padStart(3, "0")}`;
};

const formatTIN = (val) => {
  let f = val.replace(/[^0-9]/g, "").slice(0, 12);
  if (f.length > 9) f = `${f.slice(0,3)}-${f.slice(3,6)}-${f.slice(6,9)}-${f.slice(9)}`;
  else if (f.length > 6) f = `${f.slice(0,3)}-${f.slice(3,6)}-${f.slice(6)}`;
  else if (f.length > 3) f = `${f.slice(0,3)}-${f.slice(3)}`;
  return f;
};

// ─── STEP BAR ─────────────────────────────────────────────────────────────────
const StepBar = ({ current, onStepClick }) => (
  <div className="px-4 py-3 mb-8 shadow-lg bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl shadow-blue-500/30">
    <div className="flex items-center justify-between w-full">
      {STEPS.map((step, idx) => {
        const done   = current > step.id;
        const active = current === step.id;
        return (
          <React.Fragment key={step.id}>
            <button
              type="button"
              onClick={() => onStepClick(step.id)}
              className={`flex items-center gap-2 group transition-all duration-200 rounded-lg px-2 py-1.5 cursor-pointer
                ${active ? "opacity-100" : done ? "opacity-90 hover:opacity-100" : "opacity-60 hover:opacity-80"}`}
            >
              <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all
                ${done || active ? "bg-white text-blue-600 shadow" : "bg-white/20 text-white group-hover:bg-white/30"}`}>
                {done ? <FaCheck size={10} /> : step.id}
              </div>
              <span className={`text-xs font-medium transition-all hidden sm:block whitespace-nowrap
                ${active ? "text-white font-bold" : done ? "text-white" : "text-blue-100 group-hover:text-white"}`}>
                {step.label}
              </span>
            </button>
            {idx < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 rounded-full transition-all
                ${current > step.id ? "bg-white/70" : "bg-white/20"}`} />
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
    vat_type: [], account: [],
  });

  // Fetch dropdowns
  useEffect(() => {
    const fetchDropdowns = async () => {
      setDdLoading(true);
      try {
        const [stat, br, lob, tt, soi, tpc, vt, acct] = await Promise.all([
          supabase.from("status").select("id, status").order("id"),
          supabase.from("business_registration").select("id, business_registration").order("id"),
          supabase.from("line_of_business").select("id, line_of_business").order("id"),
          supabase.from("tax_type").select("id, tax_type").order("id"),
          supabase.from("source_of_income").select("id, source_of_income").order("id"),
          supabase.from("tax_payer_classification").select("id, tax_payer_classification").order("id"),
          supabase.from("vat_type").select("id, vat_type").order("id"),
          supabase.from("account").select("id, account").order("account"),
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
      setFormData((p) => ({ ...p, status: p.status || "Existing" }));
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

  // ─── SUBMIT ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setLoading(true);
    setMessage("");
    try {
      const freshID = await generateNextID();
      const isSoleProp = formData.business_registration === "Sole Proprietor";

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
        renting_vat_type: formData.renting_vat_type || null,
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
      default: return null;
    }
  };

  const isLastStep  = step === STEPS.length;
  const isFirstStep = step === 1;

  return (
    <div className="min-h-screen p-6 bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">Client Profile</h1>
          <p className="mt-1 text-sm text-slate-500">
            Complete all steps to submit client information for approval
          </p>
        </div>

        <StepBar current={step} onStepClick={setStep} />

        <div className="overflow-hidden bg-white shadow-lg rounded-xl">
          {/* Step Title Bar */}
          <div className="flex items-center justify-between px-8 py-4 bg-gradient-to-r from-blue-500 to-indigo-600">
            <div>
              <span className="text-xs font-bold tracking-wider text-white uppercase">
                Step {step} of {STEPS.length}
              </span>
              <h2 className="text-white font-semibold text-lg mt-0.5">
                {STEPS[step - 1].label}
              </h2>
            </div>
            <div className="flex gap-1">
              {STEPS.map((s) => (
                <div key={s.id} className={`h-1.5 w-8 rounded-full transition-all
                  ${s.id < step ? "bg-white" : s.id === step ? "bg-blue-300" : "bg-white/20"}`} />
              ))}
            </div>
          </div>

          <div className="p-8">
            {message && (
              <div className={`mb-6 p-4 rounded-lg border-l-4 text-sm
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
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
              >
                <FaTimes size={12} /> Reset
              </button>
              <div className="flex gap-3 ml-auto">
                {!isFirstStep && (
                  <button
                    type="button"
                    onClick={() => setStep((s) => s - 1)}
                    className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold rounded-lg border-2 border-slate-200 hover:border-blue-300 hover:text-blue-600 text-slate-700 transition"
                  >
                    <FaChevronLeft size={11} /> Back
                  </button>
                )}
                {!isLastStep ? (
                  <button
                    type="button"
                    onClick={() => setStep((s) => s + 1)}
                    className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 text-white transition"
                  >
                    Next <FaChevronRight size={11} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={loading}
                    className="flex items-center gap-2 px-8 py-2.5 text-sm font-semibold rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 text-white transition hover:opacity-90 shadow-lg shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
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