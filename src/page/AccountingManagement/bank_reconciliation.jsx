import React, { useState, useEffect, useCallback } from 'react';
import {
  FaPlus, FaTimes, FaSearch, FaEdit, FaTrashAlt, FaSync,FaCheck, FaExclamationTriangle,
  FaCheckCircle, FaTimesCircle, FaUniversity, FaCalculator, FaEye,
  FaChevronLeft, FaChevronRight, FaAngleDoubleLeft, FaAngleDoubleRight,
  
} from 'react-icons/fa';
import { supabase } from '../../lib/supabaseClient';

// ─── CONSTANTS ─────────────────────────────────────────────────────────────────
const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

const TRANSACTION_TYPES = [
  'Deposit', 'Withdrawal', 'Check Payment', 'Bank Charge',
  'Interest Income', 'Fund Transfer', 'Client Payment',
  'Government Remittance', 'Payroll', 'Utilities', 'Others'
];

const EMPTY_TXN = {
  date: '', description: '', type: 'Deposit',
  reference_no: '', amount: '', is_outstanding: false, notes: '',
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const fmtPeso = (n) =>
  '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
};

const parseNum = (v) => parseFloat(String(v).replace(/,/g, '')) || 0;

// ─── INPUT FIELD ──────────────────────────────────────────────────────────────
const Field = ({ label, required, children, error }) => (
  <div>
    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
      {label}{required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
    {children}
    {error && <p className="text-[10px] text-red-500 mt-1">{error}</p>}
  </div>
);

const inputCls = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 bg-white transition";

// ─── BALANCE INDICATOR ────────────────────────────────────────────────────────
const BalanceChip = ({ diff }) => {
  if (Math.abs(diff) < 0.01) return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">
      <FaCheckCircle size={11} /> Reconciled
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-100 text-red-600 text-xs font-bold">
      <FaTimesCircle size={11} /> {diff > 0 ? `+${fmtPeso(diff)}` : fmtPeso(diff)} Variance
    </span>
  );
};

// ─── TRANSACTION MODAL ────────────────────────────────────────────────────────
function TransactionModal({ mode, txn, onClose, onSave }) {
  const [form, setForm] = useState(mode === 'edit' ? { ...txn } : { ...EMPTY_TXN });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const validate = () => {
    const e = {};
    if (!form.date) e.date = 'Required';
    if (!form.description?.trim()) e.description = 'Required';
    if (!form.amount || isNaN(parseNum(form.amount))) e.amount = 'Enter valid amount';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    await onSave({ ...form, amount: parseNum(form.amount) });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-blue-700 to-indigo-700 shrink-0">
          <div>
            <h2 className="text-sm font-bold text-white">
              {mode === 'edit' ? 'Edit Transaction' : mode === 'view' ? 'Transaction Details' : 'Add Transaction'}
            </h2>
            <p className="text-xs text-blue-200 mt-0.5">Bank Reconciliation Entry</p>
          </div>
          <button onClick={onClose} className="text-xl transition text-white/60 hover:text-white">✕</button>
        </div>

        <div className="flex-1 px-6 py-5 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Date" required error={errors.date}>
              <input type="date" value={form.date} onChange={e => set('date', e.target.value)}
                disabled={mode === 'view'} className={inputCls} />
            </Field>
            <Field label="Type">
              <select value={form.type} onChange={e => set('type', e.target.value)}
                disabled={mode === 'view'} className={inputCls + ' cursor-pointer'}>
                {TRANSACTION_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Description" required error={errors.description}>
            <input value={form.description} onChange={e => set('description', e.target.value)}
              disabled={mode === 'view'} placeholder="Transaction description..."
              className={inputCls} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Reference No.">
              <input value={form.reference_no} onChange={e => set('reference_no', e.target.value)}
                disabled={mode === 'view'} placeholder="Check no., OR no., etc."
                className={inputCls} />
            </Field>
            <Field label="Amount (₱)" required error={errors.amount}>
              <input value={form.amount} onChange={e => set('amount', e.target.value)}
                disabled={mode === 'view'} placeholder="0.00" className={inputCls} />
            </Field>
          </div>

          <Field label="Notes">
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
              disabled={mode === 'view'} rows={2} placeholder="Additional notes..."
              className={inputCls + ' resize-none'} />
          </Field>

          <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${
            form.is_outstanding ? 'border-amber-400 bg-amber-50' : 'border-slate-200 hover:border-slate-300'
          } ${mode === 'view' ? 'pointer-events-none opacity-60' : ''}`}>
            <input type="checkbox" checked={form.is_outstanding}
              onChange={e => set('is_outstanding', e.target.checked)}
              className="w-4 h-4 accent-amber-500" />
            <div>
              <p className="text-sm font-semibold text-slate-700">Outstanding / Unpresented</p>
              <p className="text-xs text-slate-400">Mark if not yet cleared in bank statement</p>
            </div>
          </label>
        </div>

        <div className="flex gap-2 px-6 py-4 border-t border-slate-100 shrink-0">
          <button onClick={onClose}
            className="flex-1 py-2.5 text-sm font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition">
            {mode === 'view' ? 'Close' : 'Cancel'}
          </button>
          {mode !== 'view' && (
            <button onClick={handleSave} disabled={saving}
              className="flex-1 py-2.5 text-sm font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition disabled:opacity-50">
              {saving ? 'Saving...' : mode === 'edit' ? 'Save Changes' : 'Add Transaction'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── RECONCILIATION SHEET (matches the classic bank recon image layout) ───────
function ReconciliationSheet({ rec, transactions, onClose }) {
  const RECEIPT_TYPES = ['Deposit', 'Client Payment', 'Interest Income', 'Fund Transfer'];
  const receipts    = transactions.filter(t => RECEIPT_TYPES.includes(t.type));
  const payments    = transactions.filter(t => !RECEIPT_TYPES.includes(t.type));
  const unpresented = transactions.filter(t => t.is_outstanding);

  const totalReceipts      = receipts.reduce((s, t) => s + t.amount, 0);
  const totalPayments      = payments.reduce((s, t) => s + t.amount, 0);
  const totalUnpresented   = unpresented.reduce((s, t) => s + t.amount, 0);
  const outstandingDeposits = parseNum(rec.total_deposits_not_posted || 0);
  const depositsNotPosted  = 0; // kept as 0 unless stored separately
  const adjustments        = parseNum(rec.adjustments || 0);

  // Cash Book side
  const cashbookBalance = parseNum(rec.beginning_balance) + totalReceipts - totalPayments;
  // Bank Statement side
  const adjustedBank = parseNum(rec.bank_statement_balance)
    - totalUnpresented
    + outstandingDeposits
    - depositsNotPosted
    + adjustments;

  const diff = cashbookBalance - adjustedBank;
  const reconciled = Math.abs(diff) < 0.01;

  // ── Row component for form-style fields ──
  const FormRow = ({ label, value, bold, isDate, indent }) => (
    <div className={`flex items-center justify-between py-1.5 border-b border-slate-200 last:border-0 ${indent ? 'pl-4' : ''}`}>
      <span className={`text-xs ${bold ? 'font-bold text-slate-800' : 'text-slate-600'}`}>{label}</span>
      <div className={`min-w-[130px] text-right px-2 py-0.5 border border-slate-300 rounded bg-white text-xs font-mono font-semibold text-slate-800`}>
        {isDate ? value : fmtPeso(value)}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-slate-100 rounded-xl shadow-2xl flex flex-col max-h-[95vh] overflow-hidden border border-slate-300">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-3 bg-slate-700 shrink-0">
          <div>
            <p className="text-[10px] font-mono text-slate-400 tracking-widest uppercase">
              Fortiserv Business Management Enterprise Co.
            </p>
            <h2 className="text-sm font-bold text-white mt-0.5">Bank Reconciliation Statement</h2>
            <p className="text-xs text-slate-300 mt-0.5">
              {rec.bank_name}{rec.account_no ? ` · ${rec.account_no}` : ''} · {MONTHS[rec.month - 1]} {rec.year}
              {rec.client_name && <span className="ml-2 text-blue-300">· {rec.client_name}</span>}
            </p>
          </div>
          <button onClick={onClose} className="text-xl transition text-slate-400 hover:text-white">✕</button>
        </div>

        <div className="flex-1 p-5 space-y-4 overflow-y-auto">

          {/* ── Period selector row (mirrors image top bar) ── */}
          <div className="flex items-center gap-4 px-4 py-2 text-xs bg-white border rounded-lg border-slate-300 text-slate-600">
            <span className="font-semibold">Previous Months:</span>
            <span className="px-3 py-1 font-mono border rounded border-slate-300 bg-slate-50">Current</span>
            <span className="ml-auto font-semibold">As at:</span>
            <span className="px-3 py-1 font-mono border rounded border-slate-300 bg-slate-50">
              {String(rec.month).padStart(2,'0')}/{rec.year}
            </span>
          </div>

          {/* ── CASH BOOK SECTION ── */}
          <div className="overflow-hidden bg-white border rounded-lg border-slate-300">
            <div className="px-4 py-2 border-b bg-slate-200 border-slate-300">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Cash Book</span>
            </div>
            <div className="px-4 py-1 space-y-0.5">
              <FormRow label="Cash book balance brought forward" value={rec.beginning_balance} />
              <FormRow label="Total receipts"  value={totalReceipts}  indent />
              <FormRow label="Total Payments"  value={totalPayments}  indent />
              <FormRow label="Cash Book Balance" value={cashbookBalance} bold />
            </div>
          </div>

          {/* ── BANK STATEMENT SECTION ── */}
          <div className="overflow-hidden bg-white border rounded-lg border-slate-300">
            <div className="px-4 py-2 border-b bg-slate-200 border-slate-300">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Bank Statement</span>
            </div>
            <div className="px-4 py-1 space-y-0.5">
              {/* Date of bank statement */}
              <div className="flex items-center justify-between py-1.5 border-b border-slate-200">
                <span className="text-xs text-slate-600">Date of bank statement</span>
                <div className="min-w-[130px] text-right px-2 py-0.5 border border-slate-300 rounded bg-white text-xs font-mono font-semibold text-slate-800">
                  {String(rec.month).padStart(2,'0')}/{rec.year}
                </div>
              </div>
              <FormRow label="Balance from bank statement"           value={rec.bank_statement_balance} />
              <FormRow label="Total unpresented cheques"             value={totalUnpresented}       indent />
              <FormRow label="Total outstanding deposits"            value={outstandingDeposits}    indent />
              <FormRow label="Total deposits banked not posted"      value={depositsNotPosted}      indent />
              <FormRow label="Adjustments - total from Adj screen"   value={adjustments}            indent />
              <FormRow label="Total"                                 value={adjustedBank}           bold />
            </div>
          </div>

          {/* ── RECONCILIATION STATUS (mirrors image bottom bar) ── */}
          <div className={`rounded-lg overflow-hidden border-2 ${reconciled ? 'border-emerald-500' : 'border-red-600'}`}>
            <div className={`flex items-center justify-between px-4 py-3 ${reconciled ? 'bg-emerald-600' : 'bg-red-600'}`}>
              <div className="flex items-center gap-2">
                {reconciled
                  ? <FaCheckCircle size={15} className="text-white" />
                  : <FaExclamationTriangle size={15} className="text-white" />}
                <span className="text-sm font-bold tracking-wide text-white uppercase">
                  {reconciled ? 'RECONCILIATION OK' : 'RECONCILIATION BALANCE ERROR'}
                </span>
              </div>
              <span className="font-mono text-lg font-bold text-white">
                {reconciled ? '₱0.00' : fmtPeso(Math.abs(diff))}
              </span>
            </div>
            {!reconciled && (
              <div className="px-4 py-2 bg-red-50">
                <p className="text-xs text-red-700">
                  ⚠ Difference of <strong>{fmtPeso(Math.abs(diff))}</strong> must be investigated before closing this period.
                  {diff > 0 ? ' Cash book is higher than bank.' : ' Bank statement is higher than cash book.'}
                </p>
              </div>
            )}
          </div>

          {/* ── UNPRESENTED CHEQUES DETAIL ── */}
          {unpresented.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-bold tracking-wide uppercase text-slate-500">
                Unpresented Cheques / Outstanding Items ({unpresented.length})
              </p>
              <div className="overflow-hidden border rounded-lg border-amber-200">
                <table className="w-full text-xs">
                  <thead className="border-b bg-amber-50 border-amber-200">
                    <tr>
                      {['Date','Description','Reference No.','Type','Amount'].map(h => (
                        <th key={h} className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-amber-700">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {unpresented.map((t, i) => (
                      <tr key={i} className={`border-t border-amber-100 ${i%2===1?'bg-amber-50/50':'bg-white'}`}>
                        <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{fmtDate(t.date)}</td>
                        <td className="px-3 py-2 font-medium text-slate-700">{t.description}</td>
                        <td className="px-3 py-2 font-mono text-slate-500">{t.reference_no || '—'}</td>
                        <td className="px-3 py-2">
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold">{t.type}</span>
                        </td>
                        <td className="px-3 py-2 font-mono font-bold text-right text-slate-800">{fmtPeso(t.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-amber-300 bg-amber-100">
                      <td colSpan={4} className="px-3 py-2 text-xs font-bold text-amber-800">Total Unpresented</td>
                      <td className="px-3 py-2 font-mono font-bold text-right text-amber-800">{fmtPeso(totalUnpresented)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* ── SUMMARY ROW ── */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total Receipts', val: totalReceipts,  cls: 'text-emerald-700' },
              { label: 'Total Payments', val: totalPayments,  cls: 'text-red-600'     },
              { label: 'Net Movement',   val: totalReceipts - totalPayments, cls: 'text-blue-700' },
            ].map(s => (
              <div key={s.label} className="px-4 py-3 text-center bg-white border rounded-lg border-slate-200">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">{s.label}</p>
                <p className={`text-sm font-bold font-mono ${s.cls}`}>{fmtPeso(s.val)}</p>
              </div>
            ))}
          </div>

          {/* ── SIGNATORIES ── */}
          <div className="grid grid-cols-2 gap-8 pt-2">
            {['Prepared By', 'Reviewed By'].map(s => (
              <div key={s} className="text-center">
                <div className="h-10 mb-1 border-b-2 border-slate-700" />
                <p className="text-xs font-bold text-slate-700">{s}</p>
                <p className="text-[10px] text-slate-400">Signature over Printed Name / Date</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex gap-2 px-5 py-3 border-t border-slate-300 bg-slate-100 shrink-0">
          <button onClick={onClose}
            className="flex-1 py-2 text-sm font-semibold transition rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN ──────────────────────────────────────────────────────────────────────
export default function BankReconciliation({ currentUser }) {
  const [records, setRecords]         = useState([]);
  const [clients, setClients]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [fetching, setFetching]       = useState(false);
  const [message, setMessage]         = useState('');
  const [msgType, setMsgType]         = useState('');

  // Active record & its transactions
  const [activeRec, setActiveRec]     = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [txnModal, setTxnModal]       = useState(null);
  const [sheetOpen, setSheetOpen]     = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // New/edit reconciliation header form
  const [showRecForm, setShowRecForm] = useState(false);
  const [recForm, setRecForm]         = useState({
    bank_name: '', account_no: '', month: new Date().getMonth() + 1,
    year: new Date().getFullYear(), beginning_balance: '',
    bank_statement_balance: '', total_deposits_not_posted: '',
    adjustments: '', notes: '', client_id: '', client_name: '',
  });
  const [recErrors, setRecErrors]     = useState({});
  const [savingRec, setSavingRec]     = useState(false);

  // Filters
  const [search, setSearch]           = useState('');
  const [filterYear, setFilterYear]   = useState('all');
  const [filterMonth, setFilterMonth] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchRecords = useCallback(async () => {
    setFetching(true);
    try {
      const { data, error } = await supabase
        .from('bank_reconciliations')
        .select('*')
        .order('year', { ascending: false })
        .order('month', { ascending: false });
      if (error) throw error;
      setRecords(data || []);
    } catch (e) { showMsg(`Error: ${e.message}`, 'error'); }
    finally { setLoading(false); setFetching(false); }
  }, []);

  const fetchClients = useCallback(async () => {
    const { data } = await supabase
      .from('client_profile')
      .select('client_id,business_name')
      .eq('approval_status', 'approved')
      .order('business_name');
    if (data) setClients(data);
  }, []);

  const fetchTransactions = useCallback(async (recId) => {
    const { data } = await supabase
      .from('bank_reconciliation_transactions')
      .select('*')
      .eq('reconciliation_id', recId)
      .order('date', { ascending: true });
    setTransactions(data || []);
  }, []);

  useEffect(() => { fetchRecords(); fetchClients(); }, [fetchRecords, fetchClients]);
  useEffect(() => { if (activeRec) fetchTransactions(activeRec.id); }, [activeRec, fetchTransactions]);
  useEffect(() => { setCurrentPage(1); }, [search, filterYear, filterMonth]);

  const showMsg = (msg, type) => {
    setMessage(msg); setMsgType(type);
    setTimeout(() => setMessage(''), 3000);
  };

  // ── Reconciliation header CRUD ─────────────────────────────────────────────
  const validateRec = () => {
    const e = {};
    if (!recForm.bank_name?.trim()) e.bank_name = 'Required';
    if (!recForm.beginning_balance) e.beginning_balance = 'Required';
    if (!recForm.bank_statement_balance) e.bank_statement_balance = 'Required';
    setRecErrors(e);
    return !Object.keys(e).length;
  };

  const handleSaveRec = async () => {
    if (!validateRec()) return;
    setSavingRec(true);
    try {
      const payload = {
        ...recForm,
        beginning_balance: parseNum(recForm.beginning_balance),
        bank_statement_balance: parseNum(recForm.bank_statement_balance),
        total_deposits_not_posted: parseNum(recForm.total_deposits_not_posted),
        adjustments: parseNum(recForm.adjustments),
        created_by: currentUser?.username || 'System',
      };
      const { error } = recForm.id
        ? await supabase.from('bank_reconciliations').update(payload).eq('id', recForm.id)
        : await supabase.from('bank_reconciliations').insert([payload]);
      if (error) throw error;
      showMsg('✅ Reconciliation record saved!', 'success');
      setShowRecForm(false);
      setRecForm({ bank_name:'', account_no:'', month: new Date().getMonth()+1, year: new Date().getFullYear(), beginning_balance:'', bank_statement_balance:'', total_deposits_not_posted:'', adjustments:'', notes:'', client_id:'', client_name:'' });
      fetchRecords();
    } catch (e) { showMsg(`❌ ${e.message}`, 'error'); }
    finally { setSavingRec(false); }
  };

  const handleDeleteRec = async (rec) => {
    if (!window.confirm(`Delete reconciliation for ${rec.bank_name} — ${MONTHS[rec.month-1]} ${rec.year}?`)) return;
    await supabase.from('bank_reconciliation_transactions').delete().eq('reconciliation_id', rec.id);
    await supabase.from('bank_reconciliations').delete().eq('id', rec.id);
    if (activeRec?.id === rec.id) { setActiveRec(null); setTransactions([]); }
    showMsg('✅ Record deleted.', 'success');
    fetchRecords();
  };

  // ── Transaction CRUD ───────────────────────────────────────────────────────
  const handleSaveTxn = async (form) => {
    try {
      const payload = { ...form, reconciliation_id: activeRec.id };
      const { error } = form.id
        ? await supabase.from('bank_reconciliation_transactions').update(payload).eq('id', form.id)
        : await supabase.from('bank_reconciliation_transactions').insert([payload]);
      if (error) throw error;
      showMsg('✅ Transaction saved!', 'success');
      setTxnModal(null);
      fetchTransactions(activeRec.id);
    } catch (e) { showMsg(`❌ ${e.message}`, 'error'); }
  };

  const handleDeleteTxn = async (txn) => {
    await supabase.from('bank_reconciliation_transactions').delete().eq('id', txn.id);
    showMsg('✅ Transaction deleted.', 'success');
    fetchTransactions(activeRec.id);
  };

  // ── Derived: computed totals ───────────────────────────────────────────────
  const computeTotals = (txns) => {
    const deposits  = txns.filter(t => ['Deposit','Client Payment','Interest Income','Fund Transfer'].includes(t.type));
    const payments  = txns.filter(t => !['Deposit','Client Payment','Interest Income','Fund Transfer'].includes(t.type));
    const outstanding = txns.filter(t => t.is_outstanding);
    const totalDep  = deposits.reduce((s, t) => s + t.amount, 0);
    const totalPay  = payments.reduce((s, t) => s + t.amount, 0);
    const totalOut  = outstanding.reduce((s, t) => s + t.amount, 0);
    return { totalDep, totalPay, totalOut };
  };

  const getCashbookBalance = (rec, txns) => {
    const { totalDep, totalPay } = computeTotals(txns);
    return parseNum(rec.beginning_balance) + totalDep - totalPay;
  };

  const getAdjustedBank = (rec, txns) => {
    const { totalOut } = computeTotals(txns);
    return parseNum(rec.bank_statement_balance) - totalOut + parseNum(rec.total_deposits_not_posted || 0) + parseNum(rec.adjustments || 0);
  };

  // ── Filter records ─────────────────────────────────────────────────────────
  const filtered = records.filter(r => {
    if (filterYear !== 'all' && String(r.year) !== filterYear) return false;
    if (filterMonth !== 'all' && String(r.month) !== filterMonth) return false;
    if (search.trim()) {
      const t = search.toLowerCase();
      return [r.bank_name, r.account_no, r.client_name].some(f => (f||'').toLowerCase().includes(t));
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((currentPage-1)*PAGE_SIZE, currentPage*PAGE_SIZE);
  const uniqueYears = [...new Set(records.map(r => r.year))].sort((a,b) => b-a);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <div className="w-10 h-10 mx-auto mb-3 border-2 border-blue-600 rounded-full border-t-transparent animate-spin" />
        <p className="text-sm text-slate-500">Loading reconciliation records...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── TOP BAR ── */}
      <div className="sticky top-0 z-20 bg-white border-b shadow-sm border-slate-200">
        <div className="flex items-center justify-between max-w-screen-xl gap-4 px-6 py-3 mx-auto">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center bg-indigo-600 rounded-lg w-7 h-7">
                <FaUniversity size={12} className="text-white" />
              </div>
              <h1 className="text-base font-bold text-slate-900">Bank Reconciliation</h1>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 ml-9">
              {records.length} records{fetching && <span className="ml-2 text-blue-400 animate-pulse">· syncing...</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchRecords} disabled={fetching}
              className="p-2 transition rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-40">
              <FaSync size={12} className={fetching ? 'animate-spin' : ''} />
            </button>
            <button onClick={() => setShowRecForm(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white transition bg-indigo-600 rounded-lg shadow hover:bg-indigo-700 shadow-indigo-400/30">
              <FaPlus size={11} /> New Record
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-screen-xl px-6 py-5 mx-auto space-y-4">

        {/* ── MESSAGE ── */}
        {message && (
          <div className={`flex items-center justify-between p-3 rounded-lg text-sm border-l-4 ${
            msgType === 'success' ? 'bg-emerald-50 border-emerald-400 text-emerald-700' : 'bg-red-50 border-red-400 text-red-700'
          }`}>
            {message}<button onClick={() => setMessage('')}><FaTimes size={11} /></button>
          </div>
        )}

        {/* ── LAYOUT: List left, Detail right ── */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">

          {/* ── LEFT: Records List ── */}
          <div className="space-y-3 lg:col-span-2">

            {/* Search + filter */}
            <div className="p-3 space-y-2 bg-white border shadow-sm rounded-xl border-slate-200">
              <div className="relative">
                <FaSearch className="absolute -translate-y-1/2 left-3 top-1/2 text-slate-400" size={11} />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search bank, account..."
                  className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select value={filterYear} onChange={e => setFilterYear(e.target.value)}
                  className="px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none cursor-pointer">
                  <option value="all">All Years</option>
                  {uniqueYears.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
                  className="px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none cursor-pointer">
                  <option value="all">All Months</option>
                  {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
                </select>
              </div>
            </div>

            {/* Record cards */}
            <div className="space-y-2">
              {paginated.length === 0 ? (
                <div className="p-8 text-center bg-white border shadow-sm rounded-xl border-slate-200">
                  <FaUniversity size={28} className="mx-auto mb-2 text-slate-200" />
                  <p className="text-sm font-semibold text-slate-400">No records found</p>
                  <button onClick={() => setShowRecForm(true)}
                    className="px-4 py-2 mt-3 text-xs font-semibold text-white transition bg-indigo-600 rounded-lg hover:bg-indigo-700">
                    + New Record
                  </button>
                </div>
              ) : paginated.map(rec => {
                const isActive = activeRec?.id === rec.id;
                return (
                  <div key={rec.id}
                    onClick={() => setActiveRec(rec)}
                    className={`bg-white rounded-xl border p-4 cursor-pointer shadow-sm transition-all ${
                      isActive ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-slate-200 hover:border-indigo-300 hover:shadow-md'
                    }`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-bold truncate text-slate-800">{rec.bank_name}</span>
                        </div>
                        {rec.account_no && <p className="text-[10px] font-mono text-slate-400">{rec.account_no}</p>}
                        <p className="mt-1 text-xs text-slate-500">{MONTHS[rec.month-1]} {rec.year}</p>
                        {rec.client_name && (
                          <p className="text-[10px] text-slate-400 mt-0.5 truncate">{rec.client_name}</p>
                        )}
                      </div>
                      <div className="ml-2 text-right shrink-0">
                        <p className="font-mono text-xs font-bold text-slate-800">{fmtPeso(rec.bank_statement_balance)}</p>
                        <p className="text-[10px] text-slate-400">Bank Stmt</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-3 py-2 bg-white border shadow-sm rounded-xl border-slate-200">
                <span className="text-xs text-slate-400">{filtered.length} records</span>
                <div className="flex items-center gap-1">
                  {[
                    { icon: FaAngleDoubleLeft, action: () => setCurrentPage(1), disabled: currentPage===1 },
                    { icon: FaChevronLeft, action: () => setCurrentPage(p=>p-1), disabled: currentPage===1 },
                    { icon: FaChevronRight, action: () => setCurrentPage(p=>p+1), disabled: currentPage===totalPages },
                    { icon: FaAngleDoubleRight, action: () => setCurrentPage(totalPages), disabled: currentPage===totalPages },
                  ].map((btn, i) => (
                    <button key={i} onClick={btn.action} disabled={btn.disabled}
                      className="p-1 transition rounded text-slate-400 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed">
                      <btn.icon size={10} />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT: Active Record Detail ── */}
          <div className="lg:col-span-3">
            {!activeRec ? (
              <div className="flex flex-col items-center justify-center h-full p-16 text-center bg-white border shadow-sm rounded-xl border-slate-200">
                <FaUniversity size={40} className="mb-4 text-slate-200" />
                <p className="font-semibold text-slate-400">Select a record to view</p>
                <p className="mt-1 text-xs text-slate-300">or create a new reconciliation</p>
                <button onClick={() => setShowRecForm(true)}
                  className="px-4 py-2 mt-4 text-sm font-semibold text-white transition bg-indigo-600 rounded-lg hover:bg-indigo-700">
                  + New Record
                </button>
              </div>
            ) : (
              <div className="space-y-4">

                {/* Record header card */}
                <div className="p-5 bg-white border shadow-sm rounded-xl border-slate-200">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className="text-base font-bold text-slate-900">{activeRec.bank_name}</h2>
                      {activeRec.account_no && <p className="font-mono text-xs text-slate-400">{activeRec.account_no}</p>}
                      <p className="mt-1 text-xs text-slate-500">{MONTHS[activeRec.month-1]} {activeRec.year}
                        {activeRec.client_name && <span className="ml-2 text-blue-500">· {activeRec.client_name}</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Reconciliation status */}
                      <BalanceChip diff={getCashbookBalance(activeRec, transactions) - getAdjustedBank(activeRec, transactions)} />
                      <button onClick={() => setSheetOpen(true)}
                        className="p-2 transition rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50" title="View Statement">
                        <FaEye size={13} />
                      </button>
                      <button onClick={() => { setRecForm({ ...activeRec, beginning_balance: activeRec.beginning_balance, bank_statement_balance: activeRec.bank_statement_balance, total_deposits_not_posted: activeRec.total_deposits_not_posted||'', adjustments: activeRec.adjustments||'' }); setShowRecForm(true); }}
                        className="p-2 transition rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50" title="Edit">
                        <FaEdit size={13} />
                      </button>
                      <button onClick={() => handleDeleteRec(activeRec)}
                        className="p-2 transition rounded-lg text-slate-500 hover:text-red-500 hover:bg-red-50" title="Delete">
                        <FaTrashAlt size={12} />
                      </button>
                    </div>
                  </div>

                  {/* Quick summary grid */}
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    {[
                      { label: 'Beginning Balance', val: fmtPeso(activeRec.beginning_balance), cls: 'text-slate-800' },
                      { label: 'Bank Statement', val: fmtPeso(activeRec.bank_statement_balance), cls: 'text-slate-800' },
                      { label: 'Cashbook Balance', val: fmtPeso(getCashbookBalance(activeRec, transactions)), cls: 'text-blue-700' },
                      { label: 'Adjusted Bank', val: fmtPeso(getAdjustedBank(activeRec, transactions)), cls: 'text-indigo-700' },
                    ].map(s => (
                      <div key={s.label} className="p-3 border rounded-lg bg-slate-50 border-slate-100">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{s.label}</p>
                        <p className={`text-sm font-bold font-mono mt-0.5 ${s.cls}`}>{s.val}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Transactions */}
                <div className="overflow-hidden bg-white border shadow-sm rounded-xl border-slate-200">
                  <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <FaCalculator size={13} className="text-slate-500" />
                      <h3 className="text-sm font-bold text-slate-800">Transactions</h3>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">{transactions.length}</span>
                    </div>
                    <button onClick={() => setTxnModal({ mode: 'create', txn: null })}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                      <FaPlus size={9} /> Add
                    </button>
                  </div>

                  {transactions.length === 0 ? (
                    <div className="py-10 text-center">
                      <p className="text-sm text-slate-400">No transactions yet</p>
                      <button onClick={() => setTxnModal({ mode: 'create', txn: null })}
                        className="mt-2 px-3 py-1.5 text-xs font-semibold bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition">
                        + Add Transaction
                      </button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-slate-50/80 border-slate-200">
                            {['Date','Description','Type','Ref No.','Amount','Outstanding',''].map(h => (
                              <th key={h} className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-slate-400">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {transactions.map((txn, i) => (
                            <tr key={txn.id} className="transition border-b border-slate-100 hover:bg-slate-50/50 group">
                              <td className="px-3 py-2.5 text-xs text-slate-500 whitespace-nowrap">{fmtDate(txn.date)}</td>
                              <td className="px-3 py-2.5 max-w-[160px]">
                                <p className="text-xs font-semibold truncate text-slate-800" title={txn.description}>{txn.description}</p>
                                {txn.notes && <p className="text-[10px] text-slate-400 truncate">{txn.notes}</p>}
                              </td>
                              <td className="px-3 py-2.5 whitespace-nowrap">
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{txn.type}</span>
                              </td>
                              <td className="px-3 py-2.5 font-mono text-xs text-slate-500">{txn.reference_no || '—'}</td>
                              <td className="px-3 py-2.5 font-mono text-xs font-bold text-slate-800 whitespace-nowrap">{fmtPeso(txn.amount)}</td>
                              <td className="px-3 py-2.5 text-center">
                                {txn.is_outstanding
                                  ? <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700"><FaExclamationTriangle size={7} /> Pending</span>
                                  : <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700"><FaCheck size={7} /> Cleared</span>}
                              </td>
                              <td className="px-3 py-2.5">
                                <div className="flex items-center gap-1 transition-opacity opacity-0 group-hover:opacity-100">
                                  <button onClick={() => setTxnModal({ mode: 'view', txn })}
                                    className="p-1 transition rounded text-slate-400 hover:text-blue-500 hover:bg-blue-50"><FaEye size={11} /></button>
                                  <button onClick={() => setTxnModal({ mode: 'edit', txn })}
                                    className="p-1 transition rounded text-slate-400 hover:text-emerald-500 hover:bg-emerald-50"><FaEdit size={11} /></button>
                                  <button onClick={() => handleDeleteTxn(txn)}
                                    className="p-1 transition rounded text-slate-400 hover:text-red-500 hover:bg-red-50"><FaTrashAlt size={10} /></button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        {/* Totals footer */}
                        <tfoot>
                          <tr className="border-t-2 bg-slate-50 border-slate-300">
                            <td colSpan={4} className="px-3 py-2.5 text-xs font-bold text-slate-600">
                              {transactions.length} transaction{transactions.length !== 1 ? 's' : ''} ·{' '}
                              {transactions.filter(t=>t.is_outstanding).length} outstanding
                            </td>
                            <td className="px-3 py-2.5 font-mono text-sm font-bold text-slate-800">
                              {fmtPeso(transactions.reduce((s,t)=>s+t.amount, 0))}
                            </td>
                            <td colSpan={2} />
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── NEW/EDIT RECONCILIATION FORM ── */}
      {showRecForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-indigo-700 to-blue-700 shrink-0">
              <div>
                <h2 className="text-sm font-bold text-white">
                  {recForm.id ? 'Edit Reconciliation Record' : 'New Bank Reconciliation'}
                </h2>
                <p className="text-xs text-blue-200 mt-0.5">Enter bank and period details</p>
              </div>
              <button onClick={() => setShowRecForm(false)} className="text-xl transition text-white/60 hover:text-white">✕</button>
            </div>

            <div className="flex-1 px-6 py-5 space-y-4 overflow-y-auto">

              {/* Client */}
              <Field label="Client (Optional)">
                <select value={recForm.client_id}
                  onChange={e => {
                    const c = clients.find(x => x.client_id === e.target.value);
                    setRecForm(p => ({ ...p, client_id: e.target.value, client_name: c?.business_name || '' }));
                  }}
                  className={inputCls + ' cursor-pointer'}>
                  <option value="">— Select Client —</option>
                  {clients.map(c => <option key={c.client_id} value={c.client_id}>{c.business_name}</option>)}
                </select>
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Bank Name" required error={recErrors.bank_name}>
                  <input value={recForm.bank_name} onChange={e => setRecForm(p=>({...p,bank_name:e.target.value}))}
                    placeholder="BDO, BPI, Metrobank..." className={inputCls} />
                </Field>
                <Field label="Account Number">
                  <input value={recForm.account_no} onChange={e => setRecForm(p=>({...p,account_no:e.target.value}))}
                    placeholder="xxxx-xxxx-xx" className={inputCls} />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Month">
                  <select value={recForm.month} onChange={e => setRecForm(p=>({...p,month:Number(e.target.value)}))}
                    className={inputCls + ' cursor-pointer'}>
                    {MONTHS.map((m,i) => <option key={i} value={i+1}>{m}</option>)}
                  </select>
                </Field>
                <Field label="Year">
                  <input type="number" value={recForm.year} onChange={e => setRecForm(p=>({...p,year:Number(e.target.value)}))}
                    placeholder="2025" className={inputCls} />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Beginning Balance (₱)" required error={recErrors.beginning_balance}>
                  <input value={recForm.beginning_balance} onChange={e => setRecForm(p=>({...p,beginning_balance:e.target.value}))}
                    placeholder="0.00" className={inputCls} />
                </Field>
                <Field label="Bank Statement Balance (₱)" required error={recErrors.bank_statement_balance}>
                  <input value={recForm.bank_statement_balance} onChange={e => setRecForm(p=>({...p,bank_statement_balance:e.target.value}))}
                    placeholder="0.00" className={inputCls} />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Deposits Not Yet Posted (₱)">
                  <input value={recForm.total_deposits_not_posted} onChange={e => setRecForm(p=>({...p,total_deposits_not_posted:e.target.value}))}
                    placeholder="0.00" className={inputCls} />
                </Field>
                <Field label="Adjustments (₱)">
                  <input value={recForm.adjustments} onChange={e => setRecForm(p=>({...p,adjustments:e.target.value}))}
                    placeholder="0.00" className={inputCls} />
                </Field>
              </div>

              <Field label="Notes">
                <textarea value={recForm.notes} onChange={e => setRecForm(p=>({...p,notes:e.target.value}))}
                  rows={2} placeholder="Additional notes..." className={inputCls + ' resize-none'} />
              </Field>
            </div>

            <div className="flex gap-2 px-6 py-4 border-t border-slate-100 shrink-0">
              <button onClick={() => setShowRecForm(false)}
                className="flex-1 py-2.5 text-sm font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition">
                Cancel
              </button>
              <button onClick={handleSaveRec} disabled={savingRec}
                className="flex-1 py-2.5 text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition disabled:opacity-50">
                {savingRec ? 'Saving...' : recForm.id ? 'Save Changes' : 'Create Record'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TRANSACTION MODAL ── */}
      {txnModal && (
        <TransactionModal
          mode={txnModal.mode}
          txn={txnModal.txn}
          onClose={() => setTxnModal(null)}
          onSave={handleSaveTxn}
        />
      )}

      {/* ── RECONCILIATION SHEET MODAL ── */}
      {sheetOpen && activeRec && (
        <ReconciliationSheet
          rec={activeRec}
          transactions={transactions}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </div>
  );
}