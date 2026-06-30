import React, { useState, useEffect } from 'react';
import { FaPaperPlane, FaTimes, FaChevronRight, FaChevronLeft, FaCheck } from 'react-icons/fa';
import { supabase } from '../../lib/supabaseClient';

// ─── INITIAL STATE ─────────────────────────────────────────────────────────
const initialForm = {
  emp_code: '',
  emp_name: '',
  tin: '',
  date_of_birth: '',
  start_of_employment: '',
  start_of_contribution: '',
  salary_bracket: '',
  sss_emp_no: '',
  phic_emp_no: '',
  hdmf_emp_no: '',
  // Services Availed
  dti_registration: false,
  sec_registration: false,
  bir_registration: false,
  mayors_permit_registration: false,
  sss_registration: false,
  philhealth_registration: false,
  pagibig_registration: false,
  monthly_rent_fees: false,
  bookkeeping: false,
  financial_statement: false,
  general_information_sheet: false,
};

// ─── 2 STEPS ───────────────────────────────────────────────────────────────
const STEPS = [
  { id: 1, label: 'Employee Info' },
  { id: 2, label: 'Services Availed' },
];

const SERVICES = [
  { key: 'dti_registration',          label: 'DTI Registration' },
  { key: 'sec_registration',          label: 'SEC Registration' },
  { key: 'bir_registration',          label: 'BIR Registration' },
  { key: 'mayors_permit_registration',label: 'Mayors Permit Registration' },
  { key: 'sss_registration',          label: 'SSS Registration' },
  { key: 'philhealth_registration',   label: 'Philhealth Registration' },
  { key: 'pagibig_registration',      label: 'Pag-Ibig Registration' },
  { key: 'monthly_rent_fees',         label: 'Monthly Ret Fees' },
  { key: 'bookkeeping',               label: 'Bookkeeping' },
  { key: 'financial_statement',       label: 'Financial Statement' },
  { key: 'general_information_sheet', label: 'General Information Sheet' },
];

const genEmpCode = () => {
  const ts = Date.now().toString().slice(-6);
  const rand = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `EMP-${ts}-${rand}`;
};

const formatTIN = (val) => {
  let f = val.replace(/[^0-9]/g, '').slice(0, 12);
  if (f.length > 9) f = `${f.slice(0,3)}-${f.slice(3,6)}-${f.slice(6,9)}-${f.slice(9)}`;
  else if (f.length > 6) f = `${f.slice(0,3)}-${f.slice(3,6)}-${f.slice(6)}`;
  else if (f.length > 3) f = `${f.slice(0,3)}-${f.slice(3)}`;
  return f;
};

// ─── SHARED STYLES ─────────────────────────────────────────────────────────
const inputCls = "w-full px-3 py-2 text-sm border-2 rounded-lg border-slate-200 focus:border-blue-500 focus:outline-none transition bg-white text-slate-800 placeholder-slate-400";
const selectCls = "w-full px-3 py-2 text-sm border-2 rounded-lg border-slate-200 focus:border-blue-500 focus:outline-none transition bg-white text-slate-800 cursor-pointer";

const Field = ({ label, children, span2, span3 }) => (
  <div className={span2 ? 'md:col-span-2' : span3 ? 'md:col-span-3' : ''}>
    <label className="block mb-1 text-xs font-semibold tracking-wide uppercase text-slate-500">
      {label}
    </label>
    {children}
  </div>
);

const SectionTitle = ({ children, colSpan = 3 }) => (
  <div className={`md:col-span-${colSpan} flex items-center gap-3 pt-2`}>
    <span className="text-xs font-bold tracking-widest text-blue-500 uppercase">{children}</span>
    <div className="flex-1 h-px bg-blue-100" />
  </div>
);

// ─── STEP BAR (same as ClientProfile) ─────────────────────────────────────
const StepBar = ({ current }) => (
  <div className="flex items-center justify-between px-8 py-4 mb-0 shadow-lg bg-gradient-to-r from-blue-500 to-indigo-600 shadow-blue-500/30 rounded-t-xl">
    {STEPS.map((step, idx) => {
      const done = current > step.id;
      const active = current === step.id;
      return (
        <React.Fragment key={step.id}>
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all flex-shrink-0
              ${done || active ? 'bg-white text-blue-600 shadow' : 'bg-white/20 text-white'}`}>
              {done ? <FaCheck size={10} /> : step.id}
            </div>
            <span className={`text-sm font-medium
              ${active ? 'text-white font-bold' : done ? 'text-white' : 'text-blue-100'}`}>
              {step.label}
            </span>
          </div>
          {idx < STEPS.length - 1 && (
            <div className={`flex-1 mx-3 h-px transition-all ${done ? 'bg-white' : 'bg-white/30'}`} />
          )}
        </React.Fragment>
      );
    })}
  </div>
);

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────
export default function EmployeeProfile() {
  const [formData, setFormData] = useState({ ...initialForm, emp_code: genEmpCode() });
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');

  const [salaryBrackets, setSalaryBrackets] = useState([]);
  const [ddLoading, setDdLoading] = useState(true);

  // ── Fetch salary bracket dropdown ──
  useEffect(() => {
    const fetchDropdowns = async () => {
      setDdLoading(true);
      try {
        const { data } = await supabase
          .from('salary_bracket')
          .select('id, sb_code, salary_bracket_amount')
          .order('salary_bracket_amount', { ascending: true });
        setSalaryBrackets(data || []);
      } catch (err) { console.error(err); }
      finally { setDdLoading(false); }
    };
    fetchDropdowns();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (type === 'checkbox') {
      setFormData(p => ({ ...p, [name]: checked }));
    } else if (name === 'tin') {
      setFormData(p => ({ ...p, tin: formatTIN(value) }));
    } else {
      setFormData(p => ({ ...p, [name]: value }));
    }
  };

  const handleReset = () => {
    setFormData({ ...initialForm, emp_code: genEmpCode() });
    setStep(1);
    setMessage('');
  };

  const handleSubmit = async () => {
    setLoading(true);
    setMessage('');
    try {
      const { error } = await supabase.from('employee_profile').insert([{
        emp_code:               formData.emp_code,
        emp_name:               formData.emp_name,
        tin:                    formData.tin,
        date_of_birth:          formData.date_of_birth || null,
        start_of_employment:    formData.start_of_employment || null,
        start_of_contribution:  formData.start_of_contribution || null,
        salary_bracket:         formData.salary_bracket,
        sss_emp_no:             formData.sss_emp_no ? parseInt(formData.sss_emp_no) : null,
        phic_emp_no:            formData.phic_emp_no ? parseInt(formData.phic_emp_no) : null,
        hdmf_emp_no:            formData.hdmf_emp_no ? parseInt(formData.hdmf_emp_no) : null,
        dti_registration:           formData.dti_registration,
        sec_registration:           formData.sec_registration,
        bir_registration:           formData.bir_registration,
        mayors_permit_registration: formData.mayors_permit_registration,
        sss_registration:           formData.sss_registration,
        philhealth_registration:    formData.philhealth_registration,
        pagibig_registration:       formData.pagibig_registration,
        monthly_rent_fees:          formData.monthly_rent_fees,
        bookkeeping:                formData.bookkeeping,
        financial_statement:        formData.financial_statement,
        general_information_sheet:  formData.general_information_sheet,
        created_at: new Date().toISOString(),
      }]);
      if (error) throw error;
      setMessage(`✅ Employee profile submitted! Code: ${formData.emp_code}`);
      setMessageType('success');
      setTimeout(() => handleReset(), 2500);
    } catch (err) {
      setMessage(`❌ Error: ${err.message}`);
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  // ─── renderStep1 : Employee Info ─────────────────────────────────────────────────
  const renderStep1   = () => (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <SectionTitle>Employee Information</SectionTitle>

      {/* Employee Code — auto generated */}
      <Field label="Employee Code" span3>
        <input type="text" value={formData.emp_code} disabled
          className="w-full px-3 py-2 font-mono text-sm font-semibold text-blue-600 border-2 border-blue-200 rounded-lg cursor-not-allowed bg-blue-50" />
      </Field>

      <Field label="Employee Name" span2>
        <input type="text" name="emp_name" value={formData.emp_name}
          onChange={handleChange} placeholder="Enter full name" className={inputCls} />
      </Field>
      <Field label="TIN">
        <input type="text" name="tin" value={formData.tin}
          onChange={handleChange} placeholder="XXX-XXX-XXX-XXX" maxLength="16"
          className={`${inputCls} font-mono`} />
      </Field>

      <Field label="Date of Birth">
        <input type="date" name="date_of_birth" value={formData.date_of_birth}
          onChange={handleChange} className={inputCls} />
      </Field>
      <Field label="Start of Employment">
        <input type="date" name="start_of_employment" value={formData.start_of_employment}
          onChange={handleChange} className={inputCls} />
      </Field>
      <Field label="Start of Contribution">
        <input type="date" name="start_of_contribution" value={formData.start_of_contribution}
          onChange={handleChange} className={inputCls} />
      </Field>

      <Field label="Salary Bracket" span3>
        <select name="salary_bracket" value={formData.salary_bracket}
          onChange={handleChange} className={selectCls} disabled={ddLoading}>
          <option value="">— Select Salary Bracket —</option>
          {salaryBrackets.map(o => (
            <option key={o.id} value={o.sb_code}>
              {o.sb_code} — ₱{Number(o.salary_bracket_amount).toLocaleString('en-PH')}
            </option>
          ))}
        </select>
      </Field>

      <SectionTitle>Government Numbers</SectionTitle>

      <Field label="SSS Employee No.">
        <input type="text" name="sss_emp_no" value={formData.sss_emp_no}
          onChange={handleChange} placeholder="Enter SSS no." className={inputCls} />
      </Field>
      <Field label="PHIC Employee No.">
        <input type="text" name="phic_emp_no" value={formData.phic_emp_no}
          onChange={handleChange} placeholder="Enter PHIC no." className={inputCls} />
      </Field>
      <Field label="HDMF Employee No.">
        <input type="text" name="hdmf_emp_no" value={formData.hdmf_emp_no}
          onChange={handleChange} placeholder="Enter HDMF no." className={inputCls} />
      </Field>
    </div>
  );

  // ─── STEP 2: Services Availed ──────────────────────────────────────────────
  const renderStep2 = () => (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <SectionTitle>Services Availed</SectionTitle>

      <div className="md:col-span-3">
        <p className="mb-4 text-xs text-slate-400">
          Tick all services availed by this employee.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
          {SERVICES.map(({ key, label }) => (
            <label
              key={key}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all
                ${formData[key]
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-slate-200 hover:border-blue-300 text-slate-600 hover:bg-slate-50'}`}
            >
              {/* Custom checkbox styled as a tick box */}
              <div
                onClick={() => setFormData(p => ({ ...p, [key]: !p[key] }))}
                className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all
                  ${formData[key]
                    ? 'bg-gradient-to-r from-blue-500 to-indigo-600 border-blue-500'
                    : 'border-slate-300 bg-white'}`}
              >
                {formData[key] && <FaCheck size={9} className="text-white" />}
              </div>
              <span className="text-sm font-medium">{label}</span>
            </label>
          ))}
        </div>

        {/* Summary count */}
        <div className="flex items-center gap-2 mt-5">
          <div className="flex-1 h-px bg-slate-100" />
          <span className="text-xs text-slate-400 whitespace-nowrap">
            {SERVICES.filter(s => formData[s.key]).length} of {SERVICES.length} services selected
          </span>
          <div className="flex-1 h-px bg-slate-100" />
        </div>

        {/* Select all / Clear all shortcuts */}
        <div className="flex gap-3 mt-3">
          <button
            type="button"
            onClick={() => {
              const all = {};
              SERVICES.forEach(s => { all[s.key] = true; });
              setFormData(p => ({ ...p, ...all }));
            }}
            className="text-xs font-semibold text-blue-500 transition hover:text-blue-700"
          >
            ✓ Select All
          </button>
          <span className="text-slate-300">|</span>
          <button
            type="button"
            onClick={() => {
              const none = {};
              SERVICES.forEach(s => { none[s.key] = false; });
              setFormData(p => ({ ...p, ...none }));
            }}
            className="text-xs font-semibold transition text-slate-400 hover:text-slate-600"
          >
            ✕ Clear All
          </button>
        </div>
      </div>
    </div>
  );

  const renderStep = () => {
    switch (step) {
        case 1: return renderStep1();
        case 2: return renderStep2();
      default: return null;
    }
  };

  const isLastStep = step === STEPS.length;
  const isFirstStep = step === 1;

  return (
    <div className="min-h-screen p-6 bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-5xl mx-auto">

        {/* Page Header */}
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-slate-900">Employee Profile</h1>
          <p className="mt-0.5 text-sm text-slate-500">Complete all steps to submit employee information for approval</p>
        </div>

        {/* Card */}
        <div className="overflow-hidden bg-white shadow-lg rounded-xl">

          {/* Step Bar */}
          <StepBar current={step} />

          {/* Step sub-header */}
          <div className="px-8 py-3 bg-[#1e2a4a]">
            <span className="text-xs font-bold tracking-widest text-blue-400 uppercase">
              Step {step} of {STEPS.length}
            </span>
            <h2 className="text-white font-semibold text-base mt-0.5">{STEPS[step - 1].label}</h2>
          </div>

          {/* Form Body */}
          <div className="p-6">
            {message && (
              <div className={`mb-5 p-3.5 rounded-lg border-l-4 text-sm
                ${messageType === 'success'
                  ? 'bg-green-50 border-green-500 text-green-700'
                  : 'bg-red-50 border-red-500 text-red-700'}`}>
                {message}
              </div>
            )}

            {renderStep()}

            {/* Navigation */}
            <div className="flex gap-3 pt-5 mt-6 border-t border-slate-100">
              <button type="button" onClick={handleReset}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold transition rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700">
                <FaTimes size={11} /> Reset
              </button>

              <div className="flex gap-2.5 ml-auto">
                {!isFirstStep && (
                  <button type="button" onClick={() => setStep(s => s - 1)}
                    className="flex items-center gap-2 px-5 py-2 text-sm font-semibold transition border-2 rounded-lg border-slate-200 hover:border-blue-300 hover:text-blue-600 text-slate-700">
                    <FaChevronLeft size={11} /> Back
                  </button>
                )}
                {!isLastStep ? (
                  <button type="button" onClick={() => setStep(s => s + 1)}
                    className="flex items-center gap-2 px-6 py-2 text-sm font-semibold text-white transition rounded-lg shadow bg-gradient-to-r from-blue-500 to-indigo-600 hover:opacity-90 shadow-blue-500/30">
                    Next <FaChevronRight size={11} />
                  </button>
                ) : (
                  <button type="button" onClick={handleSubmit} disabled={loading}
                    className="flex items-center gap-2 py-2 text-sm font-semibold text-white transition rounded-lg shadow-lg px-7 bg-gradient-to-r from-blue-500 to-indigo-600 hover:opacity-90 shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed">
                    <FaPaperPlane size={11} /> {loading ? 'Submitting...' : 'Submit for Approval'}
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