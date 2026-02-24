import React, { useState, useEffect } from 'react';
import { FaPaperPlane, FaTimes, FaChevronRight, FaChevronLeft, FaCheck } from 'react-icons/fa';
import { supabase } from '../../lib/supabaseClient';

// ─── INITIAL STATE ────────────────────────────────────────────────────────────
const initialForm = {
  client_id_number: '',
  date_of_coverage: '',
  month_of_coverage: '',
  status: '',
  business_registration: '',
  line_of_business: '',
  business_name: '',
  trade_name: '',
  tax_type: '',
  source_of_income: '',
  tax_payer_classification: '',
  business_registration_numbers: '',
  tin: '',
  sec_registration_no: '',
  date_of_incorporation: '',
  dti_registration: '',
  date_of_expiration: '',
  sss_employer_no: '',
  phic_employer_no: '',
  hdmf_employer_no: '',
  corporation_signatory_type: '',
  sole_proprietor_signatory_type: '',
  registered_business_address: '',
  renting: 'No',
  renting_vat_type: '',
  rdo: '',
  district: '',
  zip_code: '',
  google_map_location: '',
  fathers_name: '',
  mothers_maiden_name: '',
  marital_status: '',
  date_of_birth: '',
  citizenship: '',
  gender: '',
  present_home_address: '',
  permanent_home_address: '',
  personal_email_address: '',
  contact_information: '',
  contact_person: '',
  designation: '',
  email_address: '',
  contact_number: '',
  official_office_contact_number: '',
  entity_type: '',
};

const STEPS = [
  { id: 1, label: 'Coverage & Status' },
  { id: 2, label: 'Business Info' },
  { id: 3, label: 'Tax & Registration' },
  { id: 4, label: 'Address & Location' },
  { id: 5, label: 'Owner Details' },
  { id: 6, label: 'Contact Info' },
];

const genID = () => {
  const ts = Date.now().toString().slice(-6);
  const rand = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `CLIENT-${ts}-${rand}`;
};

const formatTIN = (val) => {
  let f = val.replace(/[^0-9]/g, '').slice(0, 12);
  if (f.length > 9) f = `${f.slice(0,3)}-${f.slice(3,6)}-${f.slice(6,9)}-${f.slice(9)}`;
  else if (f.length > 6) f = `${f.slice(0,3)}-${f.slice(3,6)}-${f.slice(6)}`;
  else if (f.length > 3) f = `${f.slice(0,3)}-${f.slice(3)}`;
  return f;
};

const inputCls = "w-full px-4 py-2.5 text-sm border-2 rounded-lg border-slate-200 focus:border-teal-500 focus:outline-none transition bg-white text-slate-800 placeholder-slate-400";
const selectCls = "w-full px-4 py-2.5 text-sm border-2 rounded-lg border-slate-200 focus:border-teal-500 focus:outline-none transition bg-white text-slate-800 cursor-pointer";

const Field = ({ label, children, span2 }) => (
  <div className={span2 ? 'md:col-span-2' : ''}>
    <label className="block mb-1.5 text-xs font-semibold tracking-wide uppercase text-slate-500">
      {label}
    </label>
    {children}
  </div>
);

const RadioGroup = ({ name, value, onChange, options }) => (
  <div className="flex flex-col gap-2 mt-1">
    {options.map(opt => (
      <label key={opt} className="flex items-center gap-3 cursor-pointer group">
        <div onClick={() => onChange({ target: { name, value: opt } })}
          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition cursor-pointer
            ${value === opt ? 'border-teal-500 bg-teal-500' : 'border-slate-300 group-hover:border-teal-400'}`}>
          {value === opt && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
        </div>
        <span className="text-sm text-slate-700">{opt}</span>
      </label>
    ))}
  </div>
);

const StepBar = ({ current }) => (
  <div className="flex items-center gap-0 px-6 py-4 mb-8 overflow-x-auto bg-slate-900 rounded-xl">
    {STEPS.map((step, idx) => {
      const done = current > step.id;
      const active = current === step.id;
      return (
        <React.Fragment key={step.id}>
          <div className="flex items-center gap-2 whitespace-nowrap">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all
              ${done ? 'bg-teal-500 text-white' : active ? 'bg-teal-400 text-slate-900' : 'bg-slate-700 text-slate-400'}`}>
              {done ? <FaCheck size={10} /> : step.id}
            </div>
            <span className={`text-sm font-medium transition-all
              ${done ? 'text-teal-400' : active ? 'text-white' : 'text-slate-500'}`}>
              {step.label}
            </span>
          </div>
          {idx < STEPS.length - 1 && (
            <FaChevronRight className="flex-shrink-0 mx-3 text-slate-600" size={10} />
          )}
        </React.Fragment>
      );
    })}
  </div>
);

export default function ClientProfile() {
  const [formData, setFormData] = useState({ ...initialForm, client_id_number: genID() });
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');

  // ── Map state ──
  const [mapInput, setMapInput] = useState('');
  const [mapQuery, setMapQuery] = useState('Philippines');

  const [dropdowns, setDropdowns] = useState({
    status: [],
    business_registration: [],
    line_of_business: [],
    tax_type: [],
    source_of_income: [],
    tax_payer_classification: [],
  });
  const [ddLoading, setDdLoading] = useState(true);

  useEffect(() => {
    const fetchDropdowns = async () => {
      setDdLoading(true);
      try {
        const [stat, br, lob, tt, soi, tpc] = await Promise.all([
          supabase.from('status').select('id, status').order('id'),
          supabase.from('business_registration').select('id, business_registration').order('id'),
          supabase.from('line_of_business').select('id, line_of_business').order('id'),
          supabase.from('tax_type').select('id, tax_type').order('id'),
          supabase.from('source_of_income').select('id, source_of_income').order('id'),
          supabase.from('tax_payer_classification').select('id, tax_payer_classification').order('id'),
        ]);
        setDropdowns({
          status: stat.data || [],
          business_registration: br.data || [],
          line_of_business: lob.data || [],
          tax_type: tt.data || [],
          source_of_income: soi.data || [],
          tax_payer_classification: tpc.data || [],
        });
      } catch (err) {
        console.error('Failed to load dropdowns', err);
      } finally {
        setDdLoading(false);
      }
    };
    fetchDropdowns();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (type === 'checkbox') {
      setFormData(p => ({ ...p, [name]: checked ? 'Yes' : 'No' }));
    } else if (name === 'tin') {
      setFormData(p => ({ ...p, tin: formatTIN(value) }));
    } else {
      setFormData(p => ({ ...p, [name]: value }));
    }
  };

  // ── Map search handler ──
  const handleMapSearch = () => {
    if (!mapInput.trim()) return;
    setMapQuery(mapInput.trim());
    setFormData(p => ({ ...p, google_map_location: mapInput.trim() }));
  };

  const handleReset = () => {
    setFormData({ ...initialForm, client_id_number: genID() });
    setMapInput('');
    setMapQuery('Philippines');
    setStep(1);
    setMessage('');
  };

  const handleSubmit = async () => {
    setLoading(true);
    setMessage('');
    try {
      const { error } = await supabase.from('client_profile').insert([{
        client_id: formData.client_id_number,
        date_of_coverage: formData.date_of_coverage || null,
        month_of_coverage: formData.month_of_coverage || null,
        status: formData.status,
        business_registration: formData.business_registration,
        line_of_business: formData.line_of_business,
        business_name: formData.business_name,
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
        fathers_name: formData.fathers_name,
        mothers_maiden_name: formData.mothers_maiden_name,
        marital_status: formData.marital_status,
        date_of_birth: formData.date_of_birth || null,
        citizenship: formData.citizenship,
        gender: formData.gender,
        present_home_address: formData.present_home_address,
        permanent_home_address: formData.permanent_home_address,
        personal_email_address: formData.personal_email_address,
        contact_information: formData.contact_information,
        contact_person: formData.contact_person,
        designation: formData.designation,
        email_address: formData.email_address,
        contact_number: formData.contact_number,
        official_office_contact_number: formData.official_office_contact_number,
        created_at: new Date().toISOString(),
      }]);
      if (error) throw error;
      setMessage(`✅ Client profile submitted! ID: ${formData.client_id_number}`);
      setMessageType('success');
      setTimeout(() => handleReset(), 2500);
    } catch (err) {
      setMessage(`❌ Error: ${err.message}`);
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1: return (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Field label="Client ID Number" span2>
            <input type="text" value={formData.client_id_number} disabled
              className="w-full px-4 py-2.5 text-sm font-mono font-semibold text-teal-600 bg-teal-50 border-2 border-teal-200 rounded-lg cursor-not-allowed" />
          </Field>
          <Field label="Date of Coverage">
            <input type="date" name="date_of_coverage" value={formData.date_of_coverage} onChange={handleChange} className={inputCls} />
          </Field>
          <Field label="Month of Coverage">
            <input type="date" name="month_of_coverage" value={formData.month_of_coverage} onChange={handleChange} className={inputCls} />
          </Field>
          <Field label="Status" span2>
            <select name="status" value={formData.status} onChange={handleChange} className={selectCls} disabled={ddLoading}>
              <option value="">— Select Status —</option>
              {dropdowns.status.map(o => <option key={o.id} value={o.status}>{o.status}</option>)}
            </select>
          </Field>
        </div>
      );

      case 2: return (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Field label="Business Registration">
            <select name="business_registration" value={formData.business_registration} onChange={handleChange} className={selectCls} disabled={ddLoading}>
              <option value="">— Select —</option>
              {dropdowns.business_registration.map(o => <option key={o.id} value={o.business_registration}>{o.business_registration}</option>)}
            </select>
          </Field>
          <Field label="Line of Business">
            <select name="line_of_business" value={formData.line_of_business} onChange={handleChange} className={selectCls} disabled={ddLoading}>
              <option value="">— Select —</option>
              {dropdowns.line_of_business.map(o => <option key={o.id} value={o.line_of_business}>{o.line_of_business}</option>)}
            </select>
          </Field>
          <Field label="Business Name">
            <input type="text" name="business_name" value={formData.business_name} onChange={handleChange} placeholder="Enter business name" className={inputCls} />
          </Field>
          <Field label="Trade Name">
            <input type="text" name="trade_name" value={formData.trade_name} onChange={handleChange} placeholder="Enter trade name" className={inputCls} />
          </Field>
          <Field label="Tax Type">
            <select name="tax_type" value={formData.tax_type} onChange={handleChange} className={selectCls} disabled={ddLoading}>
              <option value="">— Select —</option>
              {dropdowns.tax_type.map(o => <option key={o.id} value={o.tax_type}>{o.tax_type}</option>)}
            </select>
          </Field>
          <Field label="Source of Income">
            <select name="source_of_income" value={formData.source_of_income} onChange={handleChange} className={selectCls} disabled={ddLoading}>
              <option value="">— Select —</option>
              {dropdowns.source_of_income.map(o => <option key={o.id} value={o.source_of_income}>{o.source_of_income}</option>)}
            </select>
          </Field>
          <Field label="Tax Payer Classification (RA 11976)" span2>
            <select name="tax_payer_classification" value={formData.tax_payer_classification} onChange={handleChange} className={selectCls} disabled={ddLoading}>
              <option value="">— Select —</option>
              {dropdowns.tax_payer_classification.map(o => <option key={o.id} value={o.tax_payer_classification}>{o.tax_payer_classification}</option>)}
            </select>
          </Field>
        </div>
      );

      case 3: return (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Field label="Business Registration Numbers">
            <input type="text" name="business_registration_numbers" value={formData.business_registration_numbers} onChange={handleChange} placeholder="Enter registration numbers" className={inputCls} />
          </Field>
          <Field label="TIN">
            <input type="text" name="tin" value={formData.tin} onChange={handleChange} placeholder="XXX-XXX-XXX-XXX" maxLength="16" className={`${inputCls} font-mono`} />
          </Field>
          <Field label="SEC Registration No.">
            <input type="text" name="sec_registration_no" value={formData.sec_registration_no} onChange={handleChange} placeholder="Enter SEC no." className={inputCls} />
          </Field>
          <Field label="Date of Incorporation">
            <input type="date" name="date_of_incorporation" value={formData.date_of_incorporation} onChange={handleChange} className={inputCls} />
          </Field>
          <Field label="DTI Registration">
            <input type="text" name="dti_registration" value={formData.dti_registration} onChange={handleChange} placeholder="Enter DTI registration" className={inputCls} />
          </Field>
          <Field label="Date of Expiration">
            <input type="date" name="date_of_expiration" value={formData.date_of_expiration} onChange={handleChange} className={inputCls} />
          </Field>
          <Field label="SSS Employer No.">
            <input type="text" name="sss_employer_no" value={formData.sss_employer_no} onChange={handleChange} placeholder="Enter SSS no." className={inputCls} />
          </Field>
          <Field label="PHIC Employer No.">
            <input type="text" name="phic_employer_no" value={formData.phic_employer_no} onChange={handleChange} placeholder="Enter PHIC no." className={inputCls} />
          </Field>
          <Field label="HDMF Employer No." span2>
            <input type="text" name="hdmf_employer_no" value={formData.hdmf_employer_no} onChange={handleChange} placeholder="Enter HDMF no." className={inputCls} />
          </Field>
        </div>
      );

      case 4: return (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Field label="Registered Business Address" span2>
            <input type="text" name="registered_business_address" value={formData.registered_business_address} onChange={handleChange} placeholder="Enter registered business address" className={inputCls} />
          </Field>
          <Field label="Renting" span2>
            <div className="flex items-center gap-6 mt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="renting" checked={formData.renting === 'Yes'} onChange={handleChange} className="w-4 h-4 accent-teal-500" />
                <span className="text-sm text-slate-700">Yes, currently renting</span>
              </label>
              {formData.renting === 'Yes' && (
                <select name="renting_vat_type" value={formData.renting_vat_type} onChange={handleChange}
                  className="flex-1 px-3 py-2 text-sm bg-white border-2 rounded-lg border-slate-200 focus:border-teal-500 focus:outline-none">
                  <option value="">— VAT Type —</option>
                  {['Net of VAT', 'VAT', 'Withholding'].map(o => <option key={o}>{o}</option>)}
                </select>
              )}
            </div>
          </Field>
          <Field label="RDO">
            <input type="text" name="rdo" value={formData.rdo} onChange={handleChange} placeholder="Enter RDO" className={inputCls} />
          </Field>
          <Field label="District">
            <input type="text" name="district" value={formData.district} onChange={handleChange} placeholder="Enter district" className={inputCls} />
          </Field>
          <Field label="Zip Code">
            <input type="text" name="zip_code" value={formData.zip_code} onChange={handleChange} placeholder="Enter zip code" className={inputCls} />
          </Field>

          {/* ── Embedded Map ── */}
          <Field label="Office Location (Map)" span2>
            <div className="overflow-hidden border-2 border-slate-200 rounded-xl">
              {/* Search Bar */}
              <div className="flex gap-2 p-3 border-b bg-slate-50 border-slate-200">
                <input
                  type="text"
                  value={mapInput}
                  onChange={(e) => setMapInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleMapSearch(); }}
                  placeholder="Type address then press Enter or click Search..."
                  className="flex-1 px-3 py-2 text-sm transition border-2 rounded-lg border-slate-200 focus:border-teal-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleMapSearch}
                  className="px-4 py-2 text-sm font-semibold text-white transition bg-teal-500 rounded-lg hover:bg-teal-600 whitespace-nowrap"
                >
                  Search
                </button>
                {formData.google_map_location && (
                  <a
                    href={`https://maps.google.com/maps?q=${encodeURIComponent(formData.google_map_location)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 text-sm font-semibold text-teal-600 transition border-2 border-teal-200 rounded-lg hover:bg-teal-50 whitespace-nowrap"
                  >
                    Open ↗
                  </a>
                )}
              </div>

              {/* Map iframe */}
              <iframe
                key={mapQuery}
                src={`https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&output=embed&z=16`}
                width="100%"
                height="350"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Office Location Map"
              />

              {/* Footer */}
              <div className="flex items-center justify-between px-4 py-2 border-t bg-slate-50 border-slate-200">
                <p className="text-xs text-slate-400">
                  💡 Type an address above then press <strong>Enter</strong> or click <strong>Search</strong>
                </p>
                {formData.google_map_location && (
                  <span className="text-xs font-semibold text-teal-600">
                    📍 {formData.google_map_location}
                  </span>
                )}
              </div>
            </div>
          </Field>
        </div>
      );

      case 5: return (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Entity Type Selector */}
          <Field label="Entity Type" span2>
            <div className="flex gap-4 mt-1">
              {['Corporation', 'Sole Proprietor'].map((type) => (
                <label key={type} onClick={() => setFormData(p => ({ ...p, entity_type: type }))}
                  className={`flex items-center gap-3 px-5 py-3 rounded-xl border-2 cursor-pointer transition-all
                    ${formData.entity_type === type
                      ? 'border-teal-500 bg-teal-50 text-teal-700'
                      : 'border-slate-200 hover:border-slate-300 text-slate-600'}`}>
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition
                    ${formData.entity_type === type ? 'border-teal-500 bg-teal-500' : 'border-slate-300'}`}>
                    {formData.entity_type === type && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <span className="text-sm font-semibold">{type}</span>
                </label>
              ))}
            </div>
          </Field>

          {/* ── CORPORATION ── */}
          {formData.entity_type === 'Corporation' && (
            <Field label="Signatory Type" span2>
              <RadioGroup
                name="corporation_signatory_type"
                value={formData.corporation_signatory_type}
                onChange={handleChange}
                options={['Annual Meeting President', 'Corporate Secretary (Signatory)']}
              />
            </Field>
          )}

          {/* ── SOLE PROPRIETOR ── */}
          {formData.entity_type === 'Sole Proprietor' && (
            <>
              <Field label="Signatory Type" span2>
                <RadioGroup
                  name="sole_proprietor_signatory_type"
                  value={formData.sole_proprietor_signatory_type}
                  onChange={handleChange}
                  options={['Owner', 'Authorized Representative']}
                />
              </Field>
              <Field label="Father's Name">
                <input type="text" name="fathers_name" value={formData.fathers_name}
                  onChange={handleChange} placeholder="Enter father's name" className={inputCls} />
              </Field>
              <Field label="Mother's Maiden Name">
                <input type="text" name="mothers_maiden_name" value={formData.mothers_maiden_name}
                  onChange={handleChange} placeholder="Enter mother's maiden name" className={inputCls} />
              </Field>
              <Field label="Marital Status">
                <input type="text" name="marital_status" value={formData.marital_status}
                  onChange={handleChange} placeholder="Single / Married / Widowed" className={inputCls} />
              </Field>
              <Field label="Date of Birth">
                <input type="date" name="date_of_birth" value={formData.date_of_birth}
                  onChange={handleChange} className={inputCls} />
              </Field>
              <Field label="Citizenship">
                <input type="text" name="citizenship" value={formData.citizenship}
                  onChange={handleChange} placeholder="Enter citizenship" className={inputCls} />
              </Field>
              <Field label="Gender">
                <input type="text" name="gender" value={formData.gender}
                  onChange={handleChange} placeholder="Enter gender" className={inputCls} />
              </Field>
              <Field label="Present Home Address" span2>
                <input type="text" name="present_home_address" value={formData.present_home_address}
                  onChange={handleChange} placeholder="Enter present home address" className={inputCls} />
              </Field>
              <Field label="Permanent Home Address" span2>
                <input type="text" name="permanent_home_address" value={formData.permanent_home_address}
                  onChange={handleChange} placeholder="Enter permanent home address" className={inputCls} />
              </Field>
              <Field label="Personal Email Address" span2>
                <input type="email" name="personal_email_address" value={formData.personal_email_address}
                  onChange={handleChange} placeholder="personal@email.com" className={inputCls} />
              </Field>
            </>
          )}

          {/* Walang napili pa */}
          {!formData.entity_type && (
            <div className="py-10 text-sm text-center md:col-span-2 text-slate-400">
              ⚠️ Please select an entity type above to continue.
            </div>
          )}
        </div>
      );

      case 6: return (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Field label="Contact Information">
            <input type="text" name="contact_information" value={formData.contact_information} onChange={handleChange} placeholder="Enter contact information" className={inputCls} />
          </Field>
          <Field label="Contact Person">
            <input type="text" name="contact_person" value={formData.contact_person} onChange={handleChange} placeholder="Enter contact person name" className={inputCls} />
          </Field>
          <Field label="Designation">
            <input type="text" name="designation" value={formData.designation} onChange={handleChange} placeholder="Enter designation" className={inputCls} />
          </Field>
          <Field label="Email Address">
            <input type="email" name="email_address" value={formData.email_address} onChange={handleChange} placeholder="office@email.com" className={inputCls} />
          </Field>
          <Field label="Contact Number">
            <input type="tel" name="contact_number" value={formData.contact_number} onChange={handleChange} placeholder="Enter contact number" className={inputCls} />
          </Field>
          <Field label="Official Office Contact Number">
            <input type="tel" name="official_office_contact_number" value={formData.official_office_contact_number} onChange={handleChange} placeholder="Enter office contact number" className={inputCls} />
          </Field>
        </div>
      );

      default: return null;
    }
  };

  const isLastStep = step === STEPS.length;
  const isFirstStep = step === 1;

  return (
    <div className="min-h-screen p-6 bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">Client Profile</h1>
          <p className="mt-1 text-sm text-slate-500">Complete all steps to submit client information for approval</p>
        </div>

        <StepBar current={step} />

        <div className="overflow-hidden bg-white shadow-lg rounded-xl">
          {/* Step Title Bar */}
          <div className="flex items-center justify-between px-8 py-4 bg-slate-900">
            <div>
              <span className="text-xs font-semibold tracking-widest text-teal-400 uppercase">Step {step} of {STEPS.length}</span>
              <h2 className="text-white font-semibold text-lg mt-0.5">{STEPS[step - 1].label}</h2>
            </div>
            <div className="flex gap-1">
              {STEPS.map(s => (
                <div key={s.id} className={`h-1.5 w-8 rounded-full transition-all
                  ${s.id < step ? 'bg-teal-500' : s.id === step ? 'bg-teal-400' : 'bg-slate-700'}`} />
              ))}
            </div>
          </div>

          <div className="p-8">
            {message && (
              <div className={`mb-6 p-4 rounded-lg border-l-4 text-sm
                ${messageType === 'success' ? 'bg-green-50 border-green-500 text-green-700' : 'bg-red-50 border-red-500 text-red-700'}`}>
                {message}
              </div>
            )}

            {renderStep()}

            {/* Navigation */}
            <div className="flex gap-4 pt-6 mt-10 border-t border-slate-100">
              <button type="button" onClick={handleReset}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition">
                <FaTimes size={12} /> Reset
              </button>

              <div className="flex gap-3 ml-auto">
                {!isFirstStep && (
                  <button type="button" onClick={() => setStep(s => s - 1)}
                    className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold rounded-lg border-2 border-slate-200 hover:border-slate-300 text-slate-700 transition">
                    <FaChevronLeft size={11} /> Back
                  </button>
                )}
                {!isLastStep ? (
                  <button type="button" onClick={() => setStep(s => s + 1)}
                    className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 text-white transition">
                    Next <FaChevronRight size={11} />
                  </button>
                ) : (
                  <button type="button" onClick={handleSubmit} disabled={loading}
                    className="flex items-center gap-2 px-8 py-2.5 text-sm font-semibold rounded-lg bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white transition disabled:opacity-50 disabled:cursor-not-allowed">
                    <FaPaperPlane size={12} /> {loading ? 'Submitting...' : 'Submit for Approval'}
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