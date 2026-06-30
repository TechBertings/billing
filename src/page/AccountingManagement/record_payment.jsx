import React, { useState, useEffect } from 'react';
import { FaPaperPlane, FaTimes, FaChevronRight, FaChevronLeft, FaCheck, FaSearch } from 'react-icons/fa';
import { supabase } from '../../lib/supabaseClient';

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const genPayId = () => {
  const ts = Date.now().toString().slice(-6);
  const rand = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `PAY-${ts}-${rand}`;
};

const fmt = (n) =>
  isNaN(parseFloat(n)) ? '0.00'
    : parseFloat(n).toLocaleString('en-PH', { minimumFractionDigits: 2 });

const fmtDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
};

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const STEPS = [
  { id: 1, label: 'Billing Lookup' },
  { id: 2, label: 'Payment Details' },
  { id: 3, label: 'Verification' },
];

const PAY_METHODS = [
  { label: 'Cash',          emoji: '💵' },
  { label: 'Bank Transfer', emoji: '🏦' },
  { label: 'GCash',         emoji: '📱' },
  { label: 'Maya',          emoji: '💙' },
  { label: 'Check',         emoji: '📝' },
  { label: 'Credit Card',   emoji: '💳' },
];

const BANKS = ['BDO', 'BPI', 'Metrobank', 'UnionBank', 'LANDBANK', 'PNB', 'Security Bank', 'RCBC', 'Chinabank', 'EastWest'];

const STATUS_BADGE = {
  Paid:      'bg-emerald-100 text-emerald-700 border-emerald-200',
  Pending:   'bg-amber-100 text-amber-700 border-amber-200',
  Overdue:   'bg-red-100 text-red-700 border-red-200',
  Sent:      'bg-blue-100 text-blue-700 border-blue-200',
  Cancelled: 'bg-slate-100 text-slate-500 border-slate-200',
};

const Badge = ({ status }) => (
  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${STATUS_BADGE[status] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
    {status}
  </span>
);

const inputCls = 'w-full px-4 py-2.5 text-sm border-2 rounded-lg border-slate-200 focus:border-blue-500 focus:outline-none transition bg-white text-slate-800 placeholder-slate-400';
const selectCls = 'w-full px-4 py-2.5 text-sm border-2 rounded-lg border-slate-200 focus:border-blue-500 focus:outline-none transition bg-white text-slate-800 cursor-pointer';

const Field = ({ label, children, span2 }) => (
  <div className={span2 ? 'md:col-span-2' : ''}>
    <label className="block mb-1.5 text-xs font-semibold tracking-wide uppercase text-slate-500">{label}</label>
    {children}
  </div>
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
            <button type="button" onClick={() => onStepClick(step.id)}
              className={`flex items-center gap-2 group transition-all duration-200 rounded-lg px-2 py-1.5 cursor-pointer
                ${active ? 'opacity-100' : done ? 'opacity-90 hover:opacity-100' : 'opacity-60 hover:opacity-80'}`}>
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

// ─── INITIAL PAYMENT FORM ─────────────────────────────────────────────────────
const initPay = () => ({
  payment_id: genPayId(),
  billing_id: '',
  billing_number: '',
  client_id: '',
  client_name: '',
  total_amount: '',
  payment_date: new Date().toISOString().split('T')[0],
  amount_paid: '',
  balance: '',
  payment_status: '',
  payment_method: '',
  reference_number: '',
  bank_name: '',
  check_number: '',
  check_date: '',
  official_receipt_number: '',
  receipt_file_url: '',
  received_by: '',
  verified_by: '',
  remarks: '',
});

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function RecordPayment({ prefillBilling }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(initPay());
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');

  // Billing lookup
  const [billInput, setBillInput] = useState('');
  const [billLoading, setBillLoading] = useState(false);
  const [billStatus, setBillStatus] = useState(null); // null | 'found' | 'notfound'
  const [billingRecord, setBillingRecord] = useState(null);

  // Auto-prefill if navigated from Billing Information with a record
  useEffect(() => {
    if (prefillBilling) {
      setBillingRecord(prefillBilling);
      setBillStatus('found');
      setBillInput(prefillBilling.billing_number);
      const outstanding = parseFloat(prefillBilling.total_amount) || 0;
      setForm((prev) => ({
        ...prev,
        billing_id: String(prefillBilling.id),
        billing_number: prefillBilling.billing_number,
        client_id: prefillBilling.client_id || '',
        client_name: prefillBilling.client_name || '',
        total_amount: String(outstanding),
        amount_paid: String(outstanding),
        balance: '0.00',
        payment_status: 'Full',
      }));
    }
  }, [prefillBilling]);

  // Auto-compute balance
  useEffect(() => {
    const total = parseFloat(form.total_amount) || 0;
    const paid = parseFloat(form.amount_paid) || 0;
    const bal = Math.max(0, total - paid);
    const status = paid >= total ? 'Full' : paid > 0 ? 'Partial' : '';
    setForm((prev) => ({ ...prev, balance: bal.toFixed(2), payment_status: status }));
  }, [form.amount_paid, form.total_amount]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  // Billing lookup
  const lookupBilling = async () => {
    if (!billInput.trim()) return;
    setBillLoading(true);
    setBillStatus(null);
    setBillingRecord(null);
    try {
      const { data, error } = await supabase
        .from('billing_information')
        .select('*')
        .eq('billing_number', billInput.trim())
        .single();
      if (error || !data) {
        setBillStatus('notfound');
      } else {
        setBillStatus('found');
        setBillingRecord(data);
        const outstanding = parseFloat(data.total_amount) || 0;
        setForm((prev) => ({
          ...prev,
          billing_id: String(data.id),
          billing_number: data.billing_number,
          client_id: data.client_id || '',
          client_name: data.client_name || '',
          total_amount: String(outstanding),
          amount_paid: String(outstanding),
          balance: '0.00',
          payment_status: 'Full',
        }));
      }
    } catch {
      setBillStatus('notfound');
    } finally {
      setBillLoading(false);
    }
  };

  const handleReset = () => {
    setForm(initPay());
    setBillInput('');
    setBillStatus(null);
    setBillingRecord(null);
    setStep(1);
    setMessage('');
  };

  const handleSubmit = async () => {
    setLoading(true);
    setMessage('');
    try {
      // 1. Insert payment record
      const { error: payErr } = await supabase.from('payment_records').insert([{
        payment_id: form.payment_id,
        billing_id: form.billing_id ? parseInt(form.billing_id) : null,
        billing_number: form.billing_number || null,
        client_id: form.client_id || null,
        client_name: form.client_name || null,
        payment_date: form.payment_date || null,
        amount_paid: parseFloat(form.amount_paid) || 0,
        balance: parseFloat(form.balance) || 0,
        payment_status: form.payment_status || null,
        payment_method: form.payment_method || null,
        reference_number: form.reference_number || null,
        bank_name: form.bank_name || null,
        check_number: form.check_number || null,
        check_date: form.check_date || null,
        official_receipt_number: form.official_receipt_number || null,
        receipt_file_url: form.receipt_file_url || null,
        received_by: form.received_by || null,
        verified_by: form.verified_by || null,
        remarks: form.remarks || null,
        created_at: new Date().toISOString(),
      }]);
      if (payErr) throw payErr;

      // 2. Update billing status to Paid if fully paid
      if (form.billing_id && form.payment_status === 'Full') {
        await supabase
          .from('billing_information')
          .update({ billing_status: 'Paid', updated_at: new Date().toISOString() })
          .eq('id', parseInt(form.billing_id));
      }

      setMessage(`✅ Payment recorded! ID: ${form.payment_id}`);
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
    // ── STEP 1: Billing Lookup ─────────────────────────────────────────────
    if (step === 1) return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Field label="Payment ID" span2>
            <input value={form.payment_id} disabled
              className="w-full px-4 py-2.5 text-sm font-mono font-semibold text-blue-600 bg-blue-50 border-2 border-blue-200 rounded-lg cursor-not-allowed" />
          </Field>

          <Field label="Billing # Lookup" span2>
            <div className="flex gap-2">
              <input type="text" value={billInput}
                onChange={(e) => setBillInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') lookupBilling(); }}
                placeholder="e.g. BILL-996630-001"
                className={`${inputCls} flex-1`} />
              <button type="button" onClick={lookupBilling} disabled={billLoading}
                className="px-5 py-2.5 text-sm font-semibold text-white rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 hover:opacity-90 transition shadow shadow-blue-500/30 disabled:opacity-50 whitespace-nowrap flex items-center gap-2">
                <FaSearch size={11} /> {billLoading ? 'Searching...' : 'Look Up'}
              </button>
            </div>
            {billStatus === 'notfound' && (
              <p className="mt-1.5 text-xs font-semibold text-red-500">❌ Billing # not found.</p>
            )}
          </Field>
        </div>

        {/* Billing Record Preview */}
        {billingRecord && (
          <div className="p-5 space-y-4 border-2 border-blue-200 rounded-xl bg-blue-50/50">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-bold text-slate-700">✅ Billing Record Found</p>
              <Badge status={billingRecord.billing_status} />
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                ['Billing #', billingRecord.billing_number],
                ['Client', billingRecord.client_name || '—'],
                ['Invoice Date', fmtDate(billingRecord.invoice_date)],
                ['Due Date', fmtDate(billingRecord.due_date)],
                ['Billing Period', billingRecord.billing_period || '—'],
                ['Payment Terms', billingRecord.payment_terms || '—'],
              ].map(([l, v]) => (
                <div key={l} className="p-3 bg-white border border-blue-100 rounded-lg">
                  <p className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-slate-400">{l}</p>
                  <p className="text-xs font-bold truncate text-slate-700">{v}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between p-4 bg-white border border-blue-200 rounded-xl">
              <div>
                <p className="text-xs text-slate-500">Total Amount Due</p>
                <p className="text-2xl font-bold text-blue-600">₱ {fmt(billingRecord.total_amount)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500">Status</p>
                <Badge status={billingRecord.billing_status} />
              </div>
            </div>
          </div>
        )}

        {/* Manual fields if no lookup */}
        {!billingRecord && (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <Field label="Client ID">
              <input type="text" name="client_id" value={form.client_id} onChange={handleChange} placeholder="e.g. CLIENT-717896-2862" className={inputCls} />
            </Field>
            <Field label="Client Name">
              <input type="text" name="client_name" value={form.client_name} onChange={handleChange} placeholder="Enter client name" className={inputCls} />
            </Field>
            <Field label="Total Amount Due (₱)" span2>
              <input type="number" name="total_amount" value={form.total_amount} onChange={handleChange} placeholder="0.00" min="0" step="0.01" className={inputCls} />
            </Field>
          </div>
        )}
      </div>
    );

    // ── STEP 2: Payment Details ───────────────────────────────────────────
    if (step === 2) return (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Field label="Payment Date">
          <input type="date" name="payment_date" value={form.payment_date} onChange={handleChange} className={inputCls} />
        </Field>
        <Field label="Amount Paid (₱)">
          <input type="number" name="amount_paid" value={form.amount_paid} onChange={handleChange}
            placeholder="0.00" min="0" step="0.01" className={inputCls} />
        </Field>

        {/* Auto-computed */}
        <Field label="Outstanding Balance (₱)">
          <input value={form.balance ? `₱ ${form.balance}` : ''}  disabled
            className="w-full px-4 py-2.5 text-sm bg-slate-50 border-2 border-slate-200 rounded-lg cursor-not-allowed text-slate-500" />
        </Field>
        <Field label="Payment Status">
          <div className={`w-full px-4 py-2.5 text-sm border-2 rounded-lg font-semibold ${
            form.payment_status === 'Full' ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
            : form.payment_status === 'Partial' ? 'bg-amber-50 border-amber-200 text-amber-700'
            : 'bg-slate-50 border-slate-200 text-slate-500'
          }`}>
            {form.payment_status || '— Auto computed —'}
          </div>
        </Field>

        {/* Payment Method */}
        <Field label="Payment Method" span2>
          <div className="grid grid-cols-3 gap-3 mt-1 md:grid-cols-6">
            {PAY_METHODS.map(({ label, emoji }) => (
              <button key={label} type="button"
                onClick={() => setForm((p) => ({ ...p, payment_method: label }))}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-xs font-semibold transition-all cursor-pointer
                  ${form.payment_method === label
                    ? 'border-blue-500 bg-blue-50 text-blue-600'
                    : 'border-slate-200 hover:border-blue-300 text-slate-600'}`}>
                <span className="text-xl">{emoji}</span>{label}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Reference / Transaction #">
          <input type="text" name="reference_number" value={form.reference_number} onChange={handleChange}
            placeholder="Bank ref, GCash ref, etc." className={inputCls} />
        </Field>

        {form.payment_method === 'Bank Transfer' && (
          <Field label="Bank Name">
            <select name="bank_name" value={form.bank_name} onChange={handleChange} className={selectCls}>
              <option value="">— Select Bank —</option>
              {BANKS.map((o) => <option key={o}>{o}</option>)}
            </select>
          </Field>
        )}

        {form.payment_method === 'Check' && (
          <>
            <Field label="Check Number">
              <input type="text" name="check_number" value={form.check_number} onChange={handleChange}
                placeholder="Enter check number" className={inputCls} />
            </Field>
            <Field label="Check Date">
              <input type="date" name="check_date" value={form.check_date} onChange={handleChange} className={inputCls} />
            </Field>
          </>
        )}

        <Field label="Official Receipt Number">
          <input type="text" name="official_receipt_number" value={form.official_receipt_number} onChange={handleChange}
            placeholder="Enter OR number" className={inputCls} />
        </Field>

        <Field label="Receipt / Proof File (URL)">
          <input type="text" name="receipt_file_url" value={form.receipt_file_url} onChange={handleChange}
            placeholder="Paste file link or filename" className={inputCls} />
        </Field>
      </div>
    );

    // ── STEP 3: Verification ──────────────────────────────────────────────
    if (step === 3) return (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Field label="Received By">
          <input type="text" name="received_by" value={form.received_by} onChange={handleChange}
            placeholder="Staff who received payment" className={inputCls} />
        </Field>
        <Field label="Verified By">
          <input type="text" name="verified_by" value={form.verified_by} onChange={handleChange}
            placeholder="Staff who verified" className={inputCls} />
        </Field>
        <Field label="Remarks" span2>
          <textarea name="remarks" value={form.remarks} onChange={handleChange} rows={3}
            placeholder="Additional notes..." className={`${inputCls} resize-none`} />
        </Field>

        {/* Summary */}
        <div className="space-y-4 md:col-span-2">
          {/* Payment summary cards */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { l: 'Payment ID',   v: form.payment_id,               c: 'blue' },
              { l: 'Billing #',    v: form.billing_number || '—',     c: 'slate' },
              { l: 'Client',       v: form.client_name || form.client_id || '—', c: 'slate' },
              { l: 'Method',       v: form.payment_method || '—',     c: 'slate' },
            ].map(({ l, v, c }) => (
              <div key={l} className={`p-4 rounded-xl border-2 ${c === 'blue' ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-slate-50'}`}>
                <p className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-slate-400">{l}</p>
                <p className={`text-sm font-bold truncate ${c === 'blue' ? 'text-blue-600' : 'text-slate-800'}`}>{v}</p>
              </div>
            ))}
          </div>

          {/* Amount breakdown */}
          <div className="p-5 border-2 border-blue-100 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2">
                <div>
                  <p className="text-xs text-slate-400">Total Amount Due</p>
                  <p className="text-base font-bold text-slate-700">₱ {fmt(form.total_amount)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Amount Paid</p>
                  <p className="text-2xl font-bold text-emerald-600">₱ {fmt(form.amount_paid)}</p>
                </div>
                {parseFloat(form.balance) > 0 && (
                  <div>
                    <p className="text-xs text-slate-400">Remaining Balance</p>
                    <p className="text-base font-bold text-red-500">₱ {fmt(form.balance)}</p>
                  </div>
                )}
              </div>
              <div className="flex flex-col items-end gap-2">
                {form.payment_status && (
                  <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold border ${
                    form.payment_status === 'Full'
                      ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                      : 'bg-amber-100 text-amber-700 border-amber-200'
                  }`}>
                    {form.payment_status === 'Full' ? '✅ Fully Paid' : '⚠️ Partial Payment'}
                  </span>
                )}
                {form.official_receipt_number && (
                  <p className="text-xs text-slate-500">OR # <span className="font-bold text-slate-700">{form.official_receipt_number}</span></p>
                )}
              </div>
            </div>
          </div>

          {form.payment_status === 'Full' && (
            <div className="flex items-center gap-3 p-4 border rounded-xl border-emerald-200 bg-emerald-50">
              <span className="text-xl text-emerald-500">🎉</span>
              <div>
                <p className="text-sm font-bold text-emerald-700">Billing will be marked as Paid</p>
                <p className="text-xs text-emerald-600">The billing record will automatically update to Paid status upon submission.</p>
              </div>
            </div>
          )}
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
          <h1 className="text-3xl font-bold text-slate-900">Record Payment</h1>
          <p className="mt-1 text-sm text-slate-500">
            Record client payment and automatically update billing status
          </p>
        </div>

        <StepBar current={step} onStepClick={setStep} />

        <div className="overflow-hidden bg-white shadow-lg rounded-xl">
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
                    <FaPaperPlane size={12} /> {loading ? 'Submitting...' : 'Record Payment'}
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