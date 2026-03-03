import React, { useState, useEffect } from 'react';
import { FaPaperPlane, FaTimes, FaChevronRight, FaChevronLeft, FaCheck, FaPlus, FaTrash } from 'react-icons/fa';
import { supabase } from '../../lib/supabaseClient';

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const genBillId = () => {
  const ts = Date.now().toString().slice(-6);
  const rand = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `BILL-${ts}-${rand}`;
};
const genInvId = () => `INV-${Date.now().toString().slice(-6)}`;
const genLineId = () => `_${Math.random().toString(36).slice(2, 7)}`;

const fmt = (n) =>
  isNaN(parseFloat(n))
    ? '0.00'
    : parseFloat(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const STEPS = [
  { id: 1, label: 'Client Info' },
  { id: 2, label: 'Line Items' },
  { id: 3, label: 'Summary & Terms' },
];

const SERVICES = [
  'Bookkeeping', 'Payroll Processing', 'BIR Tax Filing', 'SEC Filing',
  'Audit Assistance', 'Financial Statement Prep', 'Business Registration',
  'Consultation', 'Others',
];

const VAT_OPTIONS = ['VAT (12%)', 'Non-VAT', 'Zero-Rated', 'Exempt'];
const BILLING_PERIODS = ['Monthly', 'Quarterly', 'Semi-Annual', 'Annual', 'One-Time'];
const PAYMENT_TERMS = ['Due on Receipt', 'Net 7', 'Net 15', 'Net 30', 'Net 60'];
const BILLING_STATUSES = ['Pending', 'Sent', 'Overdue', 'Paid', 'Cancelled'];

const STATUS_COLORS = {
  Paid: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Pending: 'bg-amber-100 text-amber-700 border-amber-200',
  Overdue: 'bg-red-100 text-red-700 border-red-200',
  Sent: 'bg-blue-100 text-blue-700 border-blue-200',
  Cancelled: 'bg-slate-100 text-slate-500 border-slate-200',
};

// ─── EMPTY LINE ITEM ──────────────────────────────────────────────────────────
const emptyLine = () => ({
  _id: genLineId(),
  service_type: '',
  description: '',
  qty: 1,
  unit_price: '',
  vat_type: 'Non-VAT',
  vat_amount: 0,
  line_total: 0,
});

// ─── INITIAL FORM ─────────────────────────────────────────────────────────────
const initForm = () => ({
  billing_number: genBillId(),
  invoice_number: genInvId(),
  client_id: '',
  client_name: '',
  billing_period: '',
  billing_month: '',
  due_date: '',
  invoice_date: new Date().toISOString().split('T')[0],
  billing_status: 'Pending',
  payment_terms: 'Net 30',
  discount_type: 'none',
  discount_value: '',
  notes: '',
  prepared_by: '',
  approved_by: '',
});

// ─── SHARED STYLES ────────────────────────────────────────────────────────────
const inputCls = 'w-full px-4 py-2.5 text-sm border-2 rounded-lg border-slate-200 focus:border-blue-500 focus:outline-none transition bg-white text-slate-800 placeholder-slate-400';
const selectCls = 'w-full px-4 py-2.5 text-sm border-2 rounded-lg border-slate-200 focus:border-blue-500 focus:outline-none transition bg-white text-slate-800 cursor-pointer';

const Field = ({ label, children, span2, span3, span4 }) => (
  <div className={span4 ? 'md:col-span-4' : span3 ? 'md:col-span-3' : span2 ? 'md:col-span-2' : ''}>
    <label className="block mb-1.5 text-xs font-semibold tracking-wide uppercase text-slate-500">{label}</label>
    {children}
  </div>
);

const Badge = ({ status }) => (
  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${STATUS_COLORS[status] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
    {status}
  </span>
);

// ─── STEP BAR ─────────────────────────────────────────────────────────────────
const StepBar = ({ current, onStepClick }) => (
  <div className="px-4 py-3 mb-8 shadow-lg bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl shadow-blue-500/30">
    <div className="flex items-center justify-between w-full">
      {STEPS.map((step, idx) => {
        const done = current > step.id;
        const active = current === step.id;
        return (
          <React.Fragment key={step.id}>
            <button
              type="button"
              onClick={() => onStepClick(step.id)}
              className={`flex items-center gap-2 group transition-all duration-200 rounded-lg px-2 py-1.5 cursor-pointer
                ${active ? 'opacity-100' : done ? 'opacity-90 hover:opacity-100' : 'opacity-60 hover:opacity-80'}`}
            >
              <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all
                ${done || active ? 'bg-white text-blue-600 shadow' : 'bg-white/20 text-white group-hover:bg-white/30'}`}>
                {done ? <FaCheck size={10} /> : step.id}
              </div>
              <span className={`text-xs font-medium hidden sm:block whitespace-nowrap
                ${active ? 'text-white font-bold' : done ? 'text-white' : 'text-blue-100 group-hover:text-white'}`}>
                {step.label}
              </span>
            </button>
            {idx < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 rounded-full transition-all ${current > step.id ? 'bg-white/70' : 'bg-white/20'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  </div>
);

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function CreateBilling() {
  const [form, setForm] = useState(initForm());
  const [lines, setLines] = useState([emptyLine()]);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [clientInput, setClientInput] = useState('');
  const [clientLoading, setClientLoading] = useState(false);
  const [clientStatus, setClientStatus] = useState(null);
  const [vatOptions, setVatOptions] = useState(VAT_OPTIONS);

  useEffect(() => {
    supabase.from('vat_type').select('vat_type').order('id').then(({ data }) => {
      if (data && data.length > 0) setVatOptions(data.map((d) => d.vat_type));
    });
  }, []);

  // ── Line item compute ───────────────────────────────────────────────────────
  const computeLine = (line) => {
    const qty = parseFloat(line.qty) || 0;
    const price = parseFloat(line.unit_price) || 0;
    const subtotal = qty * price;
    const vat = line.vat_type === 'VAT (12%)' ? subtotal * 0.12 : 0;
    return { ...line, vat_amount: vat, line_total: subtotal + vat };
  };

  const updateLine = (id, field, value) => {
    setLines((prev) => prev.map((l) => l._id !== id ? l : computeLine({ ...l, [field]: value })));
  };

  const addLine = () => setLines((prev) => [...prev, emptyLine()]);
  const removeLine = (id) => setLines((prev) => prev.filter((l) => l._id !== id));

  // ── Financials ──────────────────────────────────────────────────────────────
  const subtotal = lines.reduce((s, l) => s + (parseFloat(l.qty) || 0) * (parseFloat(l.unit_price) || 0), 0);
  const totalVat = lines.reduce((s, l) => s + (l.vat_amount || 0), 0);
  const beforeDiscount = subtotal + totalVat;
  const discountAmt = (() => {
    if (form.discount_type === 'percent') return beforeDiscount * ((parseFloat(form.discount_value) || 0) / 100);
    if (form.discount_type === 'fixed') return parseFloat(form.discount_value) || 0;
    return 0;
  })();
  const grandTotal = Math.max(0, beforeDiscount - discountAmt);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  // ── Client lookup ───────────────────────────────────────────────────────────
  const lookupClient = async () => {
    if (!clientInput.trim()) return;
    setClientLoading(true);
    setClientStatus(null);
    try {
      const { data, error } = await supabase
        .from('client_profile')
        .select('client_id, business_name, contact_person')
        .eq('client_id', clientInput.trim())
        .single();
      if (error || !data) {
        setClientStatus('notfound');
      } else {
        setClientStatus('found');
        setForm((prev) => ({
          ...prev,
          client_id: data.client_id,
          client_name: data.business_name || data.contact_person || '',
        }));
      }
    } catch {
      setClientStatus('notfound');
    } finally {
      setClientLoading(false);
    }
  };

  const handleReset = () => {
    setForm(initForm());
    setLines([emptyLine()]);
    setClientInput('');
    setClientStatus(null);
    setStep(1);
    setMessage('');
  };

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setLoading(true);
    setMessage('');
    try {
      const { data: billRow, error: billErr } = await supabase
        .from('billing_information')
        .insert([{
          billing_number: form.billing_number,
          invoice_number: form.invoice_number,
          client_id: form.client_id || null,
          client_name: form.client_name || null,
          billing_period: form.billing_period || null,
          billing_month: form.billing_month || null,
          due_date: form.due_date || null,
          invoice_date: form.invoice_date || null,
          billing_status: form.billing_status,
          payment_terms: form.payment_terms || null,
          discount_type: form.discount_type !== 'none' ? form.discount_type : null,
          discount_value: form.discount_type !== 'none' ? (parseFloat(form.discount_value) || 0) : null,
          discount_amount: discountAmt,
          subtotal: subtotal,
          vat_amount: totalVat,
          total_amount: grandTotal,
          notes: form.notes || null,
          prepared_by: form.prepared_by || null,
          approved_by: form.approved_by || null,
          created_at: new Date().toISOString(),
        }])
        .select()
        .single();

      if (billErr) throw billErr;

      if (billRow?.id) {
        const linePayload = lines
          .filter((l) => l.service_type || l.description || l.unit_price)
          .map((l) => ({
            billing_id: billRow.id,
            billing_number: form.billing_number,
            service_type: l.service_type || null,
            description: l.description || null,
            qty: parseFloat(l.qty) || 1,
            unit_price: parseFloat(l.unit_price) || 0,
            vat_type: l.vat_type || null,
            vat_amount: l.vat_amount || 0,
            line_total: l.line_total || 0,
          }));

        if (linePayload.length > 0) {
          const { error: lineErr } = await supabase.from('billing_line_items').insert(linePayload);
          if (lineErr) console.warn('Line items insert warning:', lineErr.message);
        }
      }

      setMessage(`✅ Billing created! ID: ${form.billing_number}`);
      setMessageType('success');
      setTimeout(() => handleReset(), 2500);
    } catch (err) {
      setMessage(`❌ Error: ${err.message}`);
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  // ─── STEP RENDERS ──────────────────────────────────────────────────────────
  const renderStep = () => {
    // ── STEP 1 ────────────────────────────────────────────────────────────────
    if (step === 1) return (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Field label="Billing Number">
          <input value={form.billing_number} disabled
            className="w-full px-4 py-2.5 text-sm font-mono font-semibold text-blue-600 bg-blue-50 border-2 border-blue-200 rounded-lg cursor-not-allowed" />
        </Field>
        <Field label="Invoice Number">
          <input value={form.invoice_number} disabled
            className="w-full px-4 py-2.5 text-sm font-mono font-semibold text-blue-600 bg-blue-50 border-2 border-blue-200 rounded-lg cursor-not-allowed" />
        </Field>

        <Field label="Client ID Lookup" span2>
          <div className="flex gap-2">
            <input type="text" value={clientInput}
              onChange={(e) => setClientInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') lookupClient(); }}
              placeholder="e.g. CLIENT-717896-2862"
              className={`${inputCls} flex-1`} />
            <button type="button" onClick={lookupClient} disabled={clientLoading}
              className="px-5 py-2.5 text-sm font-semibold text-white rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 hover:opacity-90 transition shadow shadow-blue-500/30 disabled:opacity-50 whitespace-nowrap">
              {clientLoading ? 'Searching...' : 'Look Up'}
            </button>
          </div>
          {clientStatus === 'found' && (
            <p className="mt-1.5 text-xs font-semibold text-emerald-600">
              ✅ Client found: <span className="font-bold">{form.client_name}</span>
            </p>
          )}
          {clientStatus === 'notfound' && (
            <p className="mt-1.5 text-xs font-semibold text-red-500">
              ❌ Client ID not found. You may type manually below.
            </p>
          )}
        </Field>

        <Field label="Client / Business Name" span2>
          <input type="text" name="client_name" value={form.client_name} onChange={handleChange}
            placeholder="Auto-filled or type manually" className={inputCls} />
        </Field>

        <Field label="Invoice Date">
          <input type="date" name="invoice_date" value={form.invoice_date} onChange={handleChange} className={inputCls} />
        </Field>
        <Field label="Due Date">
          <input type="date" name="due_date" value={form.due_date} onChange={handleChange} className={inputCls} />
        </Field>
        <Field label="Billing Period">
          <select name="billing_period" value={form.billing_period} onChange={handleChange} className={selectCls}>
            <option value="">— Select Period —</option>
            {BILLING_PERIODS.map((o) => <option key={o}>{o}</option>)}
          </select>
        </Field>
        <Field label="Billing Month">
          <input type="month" name="billing_month" value={form.billing_month} onChange={handleChange} className={inputCls} />
        </Field>
        <Field label="Payment Terms">
          <select name="payment_terms" value={form.payment_terms} onChange={handleChange} className={selectCls}>
            {PAYMENT_TERMS.map((o) => <option key={o}>{o}</option>)}
          </select>
        </Field>
        <Field label="Billing Status">
          <select name="billing_status" value={form.billing_status} onChange={handleChange} className={selectCls}>
            {BILLING_STATUSES.map((o) => <option key={o}>{o}</option>)}
          </select>
        </Field>
        <Field label="Prepared By">
          <input type="text" name="prepared_by" value={form.prepared_by} onChange={handleChange} placeholder="Staff name" className={inputCls} />
        </Field>
        <Field label="Approved By">
          <input type="text" name="approved_by" value={form.approved_by} onChange={handleChange} placeholder="Approver name" className={inputCls} />
        </Field>
      </div>
    );

    // ── STEP 2 ────────────────────────────────────────────────────────────────
    if (step === 2) return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-600">
            {lines.length} service item{lines.length !== 1 ? 's' : ''}
          </p>
          <button type="button" onClick={addLine}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-blue-600 transition border-2 border-blue-200 rounded-lg bg-blue-50 hover:bg-blue-100">
            <FaPlus size={11} /> Add Item
          </button>
        </div>

        <div className="space-y-3">
          {lines.map((line, idx) => (
            <div key={line._id} className="p-5 transition border-2 border-slate-200 rounded-xl hover:border-blue-300 bg-slate-50/50">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold tracking-wider uppercase text-slate-400">Item #{idx + 1}</span>
                {lines.length > 1 && (
                  <button type="button" onClick={() => removeLine(line._id)}
                    className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition">
                    <FaTrash size={10} /> Remove
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
                <div className="md:col-span-2">
                  <label className="block mb-1 text-xs font-semibold tracking-wide uppercase text-slate-400">Service Type</label>
                  <select value={line.service_type} onChange={(e) => updateLine(line._id, 'service_type', e.target.value)} className={selectCls}>
                    <option value="">— Select —</option>
                    {SERVICES.map((o) => <option key={o}>{o}</option>)}
                  </select>
                </div>
                <div className="md:col-span-4">
                  <label className="block mb-1 text-xs font-semibold tracking-wide uppercase text-slate-400">Description</label>
                  <input type="text" value={line.description}
                    onChange={(e) => updateLine(line._id, 'description', e.target.value)}
                    placeholder="Describe the service..." className={inputCls} />
                </div>
                <div className="md:col-span-1">
                  <label className="block mb-1 text-xs font-semibold tracking-wide uppercase text-slate-400">Qty</label>
                  <input type="number" min="1" value={line.qty}
                    onChange={(e) => updateLine(line._id, 'qty', e.target.value)} className={inputCls} />
                </div>
                <div className="md:col-span-2">
                  <label className="block mb-1 text-xs font-semibold tracking-wide uppercase text-slate-400">Unit Price (₱)</label>
                  <input type="number" min="0" step="0.01" value={line.unit_price}
                    onChange={(e) => updateLine(line._id, 'unit_price', e.target.value)}
                    placeholder="0.00" className={inputCls} />
                </div>
                <div className="md:col-span-2">
                  <label className="block mb-1 text-xs font-semibold tracking-wide uppercase text-slate-400">VAT Type</label>
                  <select value={line.vat_type} onChange={(e) => updateLine(line._id, 'vat_type', e.target.value)} className={selectCls}>
                    {vatOptions.map((o) => <option key={o}>{o}</option>)}
                  </select>
                </div>
                <div className="md:col-span-1">
                  <label className="block mb-1 text-xs font-semibold tracking-wide uppercase text-slate-400">Line Total</label>
                  <div className="w-full px-4 py-2.5 text-sm font-bold text-blue-600 bg-blue-50 border-2 border-blue-200 rounded-lg text-right">
                    ₱ {fmt(line.line_total)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Running totals */}
        <div className="p-5 bg-white border-2 rounded-xl border-slate-200">
          <div className="flex flex-col max-w-xs gap-2 ml-auto">
            <div className="flex justify-between text-sm text-slate-500">
              <span>Subtotal</span>
              <span className="font-semibold text-slate-700">₱ {fmt(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-slate-500">
              <span>Total VAT</span>
              <span className="font-semibold text-slate-700">₱ {fmt(totalVat)}</span>
            </div>
            <div className="h-px bg-slate-200" />
            <div className="flex justify-between text-base font-bold text-blue-600">
              <span>Running Total</span>
              <span>₱ {fmt(beforeDiscount)}</span>
            </div>
          </div>
        </div>
      </div>
    );

    // ── STEP 3 ────────────────────────────────────────────────────────────────
    if (step === 3) return (
      <div className="space-y-6">
        {/* Discount */}
        <div>
          <label className="block mb-3 text-xs font-semibold tracking-wide uppercase text-slate-500">Discount</label>
          <div className="flex flex-wrap items-center gap-3">
            {[
              { val: 'none', label: 'No Discount' },
              { val: 'percent', label: '% Percent' },
              { val: 'fixed', label: '₱ Fixed Amount' },
            ].map(({ val, label }) => (
              <label key={val}
                onClick={() => setForm((p) => ({ ...p, discount_type: val, discount_value: '' }))}
                className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border-2 cursor-pointer transition-all text-sm font-semibold
                  ${form.discount_type === val
                    ? 'border-blue-500 bg-blue-50 text-blue-600'
                    : 'border-slate-200 hover:border-blue-300 text-slate-600'}`}>
                <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center transition
                  ${form.discount_type === val ? 'border-blue-500 bg-blue-500' : 'border-slate-300'}`}>
                  {form.discount_type === val && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                {label}
              </label>
            ))}
            {form.discount_type !== 'none' && (
              <input type="number" min="0" step={form.discount_type === 'percent' ? '1' : '0.01'}
                max={form.discount_type === 'percent' ? '100' : undefined}
                value={form.discount_value}
                onChange={(e) => setForm((p) => ({ ...p, discount_value: e.target.value }))}
                placeholder={form.discount_type === 'percent' ? 'e.g. 10' : 'e.g. 500.00'}
                className="w-44 px-4 py-2.5 text-sm border-2 rounded-lg border-blue-300 focus:border-blue-500 focus:outline-none bg-white text-slate-800" />
            )}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block mb-1.5 text-xs font-semibold tracking-wide uppercase text-slate-500">
            Notes / Instructions to Client
          </label>
          <textarea name="notes" value={form.notes} onChange={handleChange} rows={3}
            placeholder="e.g. Please remit payment to BDO Account No. XXXX. Thank you!"
            className={`${inputCls} resize-none`} />
        </div>

        {/* Final Invoice Summary */}
        <div className="p-6 border-2 border-blue-200 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-bold text-slate-700">Invoice Summary</p>
            <Badge status={form.billing_status} />
          </div>

          {/* Line items mini table */}
          <div className="mb-4 overflow-hidden border border-blue-100 rounded-lg">
            <table className="w-full text-xs">
              <thead className="bg-blue-100/60">
                <tr>
                  <th className="px-3 py-2 font-semibold tracking-wide text-left uppercase text-slate-500">Service</th>
                  <th className="px-3 py-2 font-semibold tracking-wide text-right uppercase text-slate-500">Qty</th>
                  <th className="px-3 py-2 font-semibold tracking-wide text-right uppercase text-slate-500">Unit Price</th>
                  <th className="px-3 py-2 font-semibold tracking-wide text-right uppercase text-slate-500">VAT</th>
                  <th className="px-3 py-2 font-semibold tracking-wide text-right uppercase text-slate-500">Total</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-blue-50">
                {lines.map((l, i) => (
                  <tr key={l._id} className="transition hover:bg-blue-50/40">
                    <td className="px-3 py-2 font-medium text-slate-700">
                      {l.service_type || <span className="italic text-slate-400">Item {i + 1}</span>}
                      {l.description && <p className="max-w-xs font-normal truncate text-slate-400">{l.description}</p>}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-600">{l.qty}</td>
                    <td className="px-3 py-2 text-right text-slate-600">₱ {fmt(l.unit_price)}</td>
                    <td className="px-3 py-2 text-right text-slate-600">₱ {fmt(l.vat_amount)}</td>
                    <td className="px-3 py-2 font-semibold text-right text-slate-800">₱ {fmt(l.line_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals breakdown */}
          <div className="max-w-xs ml-auto space-y-2">
            <div className="flex justify-between text-sm text-slate-500">
              <span>Subtotal</span>
              <span className="font-semibold text-slate-700">₱ {fmt(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-slate-500">
              <span>VAT</span>
              <span className="font-semibold text-slate-700">₱ {fmt(totalVat)}</span>
            </div>
            {form.discount_type !== 'none' && discountAmt > 0 && (
              <div className="flex justify-between text-sm text-emerald-600">
                <span>Discount {form.discount_type === 'percent' && `(${form.discount_value}%)`}</span>
                <span className="font-semibold">− ₱ {fmt(discountAmt)}</span>
              </div>
            )}
            <div className="h-px bg-blue-200" />
            <div className="flex justify-between text-lg font-bold text-blue-600">
              <span>Grand Total</span>
              <span>₱ {fmt(grandTotal)}</span>
            </div>
          </div>
        </div>

        {/* Meta summary */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            ['Billing #', form.billing_number],
            ['Client', form.client_name || form.client_id || '—'],
            ['Payment Terms', form.payment_terms],
            ['Due Date', form.due_date || '—'],
          ].map(([l, v]) => (
            <div key={l} className="p-3 border rounded-lg bg-slate-50 border-slate-200">
              <p className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-slate-400">{l}</p>
              <p className="text-xs font-bold truncate text-slate-700">{v}</p>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const isFirst = step === 1;
  const isLast = step === STEPS.length;

  return (
    <div className="min-h-screen p-6 bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">Create Billing</h1>
          <p className="mt-1 text-sm text-slate-500">Generate a new invoice with line-item breakdown for a client</p>
        </div>

        <StepBar current={step} onStepClick={setStep} />

        <div className="overflow-hidden bg-white shadow-lg rounded-xl">
          {/* Step header */}
          <div className="flex items-center justify-between px-8 py-4 bg-gradient-to-r from-blue-500 to-indigo-600">
            <div>
              <span className="text-xs font-bold tracking-wider text-white uppercase">Step {step} of {STEPS.length}</span>
              <h2 className="text-white font-semibold text-lg mt-0.5">{STEPS[step - 1].label}</h2>
            </div>
            <div className="flex gap-1">
              {STEPS.map((s) => (
                <div key={s.id}
                  className={`h-1.5 w-10 rounded-full transition-all ${s.id < step ? 'bg-white' : s.id === step ? 'bg-blue-300' : 'bg-white/20'}`} />
              ))}
            </div>
          </div>

          <div className="p-8">
            {message && (
              <div className={`mb-6 p-4 rounded-lg border-l-4 text-sm ${messageType === 'success' ? 'bg-green-50 border-green-500 text-green-700' : 'bg-red-50 border-red-500 text-red-700'}`}>
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
                {!isFirst && (
                  <button type="button" onClick={() => setStep((s) => s - 1)}
                    className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold rounded-lg border-2 border-slate-200 hover:border-blue-300 hover:text-blue-600 text-slate-700 transition">
                    <FaChevronLeft size={11} /> Back
                  </button>
                )}
                {!isLast ? (
                  <button type="button" onClick={() => setStep((s) => s + 1)}
                    className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 text-white transition">
                    Next <FaChevronRight size={11} />
                  </button>
                ) : (
                  <button type="button" onClick={handleSubmit} disabled={loading}
                    className="flex items-center gap-2 px-8 py-2.5 text-sm font-semibold rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 text-white transition hover:opacity-90 shadow-lg shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed">
                    <FaPaperPlane size={12} /> {loading ? 'Submitting...' : 'Create Billing'}
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