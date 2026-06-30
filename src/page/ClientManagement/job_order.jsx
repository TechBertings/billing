import React, { useState, useEffect, useCallback } from 'react';
import {
  FaPlus, FaTimes, FaSearch, FaFilter, FaEdit, FaTrashAlt,
  FaChevronDown, FaChevronUp, FaEye, FaCheck, FaClock,
  FaExclamationTriangle, FaPause, FaBan, FaClipboardList,
  FaUser, FaCalendarAlt, FaTag, FaBuilding, FaSync,
  FaChevronLeft, FaChevronRight, FaAngleDoubleLeft, FaAngleDoubleRight,
  FaStickyNote, FaFileAlt
} from 'react-icons/fa';
import { supabase } from '../../lib/supabaseClient';

// ─── CONSTANTS ─────────────────────────────────────────────────────────────────
const JOB_TYPES = [
  'BIR Filing',
  'Payroll Processing',
  'Financial Statement Preparation',
  'Permits Renewal',
  'Audit Assistance',
  'Tax Compliance Review',
  'SEC Compliance',
  'DTI Registration',
  'Business Registration Renewal',
  'SSS / PhilHealth / HDMF Filing',
  'Bank Reconciliation',
  'Bookkeeping',
  'General Consultation',
  'Others',
];

const STATUSES = [
  { value: 'not_started',  label: 'Not Started',  color: 'bg-slate-100 text-slate-600',    dot: 'bg-slate-400',    icon: FaBan },
  { value: 'in_progress',  label: 'In Progress',  color: 'bg-blue-100 text-blue-700',      dot: 'bg-blue-500',     icon: FaClock },
  { value: 'for_review',   label: 'For Review',   color: 'bg-violet-100 text-violet-700',  dot: 'bg-violet-500',   icon: FaEye },
  { value: 'completed',    label: 'Completed',    color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500', icon: FaCheck },
  { value: 'on_hold',      label: 'On Hold',      color: 'bg-amber-100 text-amber-700',    dot: 'bg-amber-400',    icon: FaPause },
  { value: 'cancelled',    label: 'Cancelled',    color: 'bg-red-100 text-red-600',        dot: 'bg-red-400',      icon: FaBan },
];

const PRIORITIES = [
  { value: 'low',    label: 'Low',    color: 'bg-slate-100 text-slate-500' },
  { value: 'normal', label: 'Normal', color: 'bg-sky-100 text-sky-600' },
  { value: 'high',   label: 'High',   color: 'bg-orange-100 text-orange-600' },
  { value: 'urgent', label: 'Urgent', color: 'bg-red-100 text-red-600' },
];

const EMPTY_FORM = {
  job_type: '',
  custom_job_type: '',
  client_id: '',
  client_name: '',
  assigned_to: '',
  priority: 'normal',
  status: 'not_started',
  date_assigned: new Date().toISOString().split('T')[0],
  due_date: '',
  description: '',
  remarks: '',
};

// ─── HELPERS ───────────────────────────────────────────────────────────────────
const fmtDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
};

const daysUntil = (d) => {
  if (!d) return null;
  return Math.ceil((new Date(d) - new Date()) / 86400000);
};

const statusInfo = (val) => STATUSES.find(s => s.value === val) || STATUSES[0];
const priorityInfo = (val) => PRIORITIES.find(p => p.value === val) || PRIORITIES[1];

const dueBadge = (dueDate, status) => {
  if (status === 'completed' || status === 'cancelled') return null;
  const days = daysUntil(dueDate);
  if (days === null) return null;
  if (days < 0)  return { label: `${Math.abs(days)}d overdue`, cls: 'bg-red-100 text-red-600' };
  if (days === 0) return { label: 'Due today', cls: 'bg-red-100 text-red-600' };
  if (days <= 3)  return { label: `${days}d left`, cls: 'bg-orange-100 text-orange-600' };
  if (days <= 7)  return { label: `${days}d left`, cls: 'bg-amber-100 text-amber-600' };
  return null;
};

// Generate Job Order number: JO-MMYYYY-XXXX
const genJobNo = (seq) => {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yy = now.getFullYear();
  return `JO-${mm}${yy}-${String(seq).padStart(4, '0')}`;
};

// ─── STATUS BADGE ──────────────────────────────────────────────────────────────
const StatusBadge = ({ value, size = 'sm' }) => {
  const s = statusInfo(value);
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1 font-semibold rounded-full ${s.color} ${size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1'}`}>
      <Icon size={size === 'sm' ? 8 : 10} />
      {s.label}
    </span>
  );
};

// ─── PRIORITY BADGE ────────────────────────────────────────────────────────────
const PriorityBadge = ({ value }) => {
  const p = priorityInfo(value);
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${p.color}`}>{p.label}</span>
  );
};

// ─── LABEL + INPUT ────────────────────────────────────────────────────────────
const Field = ({ label, required, children }) => (
  <div>
    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
      {label}{required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
    {children}
  </div>
);

const inputCls = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 bg-white transition";
const selectCls = inputCls + " cursor-pointer";

// ─── MODAL ────────────────────────────────────────────────────────────────────
function JobOrderModal({ mode, job, clients, onClose, onSave }) {
  const [form, setForm] = useState(mode === 'edit' ? { ...job } : { ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const set = (key, val) => setForm(p => ({ ...p, [key]: val }));

  // When client is selected, auto-fill client_name
  const handleClientSelect = (clientId) => {
    const c = clients.find(c => c.client_id === clientId);
    set('client_id', clientId);
    set('client_name', c?.business_name || '');
  };

  const validate = () => {
    const e = {};
    if (!form.job_type) e.job_type = 'Required';
    if (form.job_type === 'Others' && !form.custom_job_type) e.custom_job_type = 'Please specify';
    if (!form.assigned_to?.trim()) e.assigned_to = 'Required';
    if (!form.due_date) e.due_date = 'Required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    const payload = {
      ...form,
      job_type: form.job_type === 'Others' ? form.custom_job_type : form.job_type,
    };
    delete payload.custom_job_type;
    await onSave(payload);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">

        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-700 to-indigo-700 shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white">
                {mode === 'edit' ? 'Edit Job Order' : mode === 'view' ? 'Job Order Details' : 'New Job Order'}
              </h2>
              {form.job_order_no && (
                <p className="text-xs text-blue-200 font-mono mt-0.5">{form.job_order_no}</p>
              )}
            </div>
            <button onClick={onClose} className="text-xl transition text-white/60 hover:text-white">✕</button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 px-6 py-5 space-y-4 overflow-y-auto">

          {/* Row 1: Job Type */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Job Type" required>
              <select value={form.job_type} onChange={e => set('job_type', e.target.value)}
                disabled={mode === 'view'} className={`${selectCls} ${errors.job_type ? 'border-red-400' : ''}`}>
                <option value="">— Select Job Type —</option>
                {JOB_TYPES.map(j => <option key={j} value={j}>{j}</option>)}
              </select>
              {errors.job_type && <p className="text-[10px] text-red-500 mt-1">{errors.job_type}</p>}
            </Field>

            {form.job_type === 'Others' ? (
              <Field label="Specify Job Type" required>
                <input value={form.custom_job_type} onChange={e => set('custom_job_type', e.target.value)}
                  disabled={mode === 'view'} placeholder="Enter job type..."
                  className={`${inputCls} ${errors.custom_job_type ? 'border-red-400' : ''}`} />
                {errors.custom_job_type && <p className="text-[10px] text-red-500 mt-1">{errors.custom_job_type}</p>}
              </Field>
            ) : (
              <Field label="Priority">
                <select value={form.priority} onChange={e => set('priority', e.target.value)}
                  disabled={mode === 'view'} className={selectCls}>
                  {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </Field>
            )}
          </div>

          {/* Row 2: Client */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Client">
              <select value={form.client_id} onChange={e => handleClientSelect(e.target.value)}
                disabled={mode === 'view'} className={selectCls}>
                <option value="">— Select Client (optional) —</option>
                {clients.map(c => (
                  <option key={c.client_id} value={c.client_id}>{c.business_name} ({c.client_id})</option>
                ))}
              </select>
            </Field>
            <Field label="Assigned To" required>
              <input value={form.assigned_to} onChange={e => set('assigned_to', e.target.value)}
                disabled={mode === 'view'} placeholder="Staff name..."
                className={`${inputCls} ${errors.assigned_to ? 'border-red-400' : ''}`} />
              {errors.assigned_to && <p className="text-[10px] text-red-500 mt-1">{errors.assigned_to}</p>}
            </Field>
          </div>

          {/* Row 3: Dates */}
          <div className="grid grid-cols-3 gap-4">
            <Field label="Date Assigned">
              <input type="date" value={form.date_assigned} onChange={e => set('date_assigned', e.target.value)}
                disabled={mode === 'view'} className={inputCls} />
            </Field>
            <Field label="Due Date" required>
              <input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)}
                disabled={mode === 'view'} className={`${inputCls} ${errors.due_date ? 'border-red-400' : ''}`} />
              {errors.due_date && <p className="text-[10px] text-red-500 mt-1">{errors.due_date}</p>}
            </Field>
            <Field label="Status">
              <select value={form.status} onChange={e => set('status', e.target.value)}
                disabled={mode === 'view'} className={selectCls}>
                {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </Field>
          </div>

          {/* Row 4: Priority (if Others was chosen above) */}
          {form.job_type === 'Others' && (
            <Field label="Priority">
              <select value={form.priority} onChange={e => set('priority', e.target.value)}
                disabled={mode === 'view'} className={selectCls}>
                {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </Field>
          )}

          {/* Row 5: Description */}
          <Field label="Description / Scope of Work">
            <textarea value={form.description} onChange={e => set('description', e.target.value)}
              disabled={mode === 'view'} rows={3} placeholder="Describe the job order..."
              className={`${inputCls} resize-none`} />
          </Field>

          {/* Row 6: Remarks */}
          <Field label="Remarks / Notes">
            <textarea value={form.remarks} onChange={e => set('remarks', e.target.value)}
              disabled={mode === 'view'} rows={2} placeholder="Additional notes..."
              className={`${inputCls} resize-none`} />
          </Field>

          {/* View mode: timestamps */}
          {mode === 'view' && (
            <div className="flex justify-between text-[10px] text-slate-400 pt-2 border-t border-slate-100">
              <span>Created: {fmtDate(job.created_at)}</span>
              <span>Updated: {fmtDate(job.updated_at)}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-6 py-4 border-t border-slate-100 shrink-0">
          <button onClick={onClose}
            className="flex-1 py-2.5 text-sm font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition">
            {mode === 'view' ? 'Close' : 'Cancel'}
          </button>
          {mode !== 'view' && (
            <button onClick={handleSave} disabled={saving}
              className="flex-1 py-2.5 text-sm font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition disabled:opacity-50">
              {saving ? 'Saving...' : mode === 'edit' ? 'Save Changes' : 'Create Job Order'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── DELETE CONFIRM ────────────────────────────────────────────────────────────
function DeleteConfirm({ job, onClose, onConfirm }) {
  const [deleting, setDeleting] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="w-full max-w-sm overflow-hidden bg-white shadow-2xl rounded-2xl">
        <div className="p-6 text-center">
          <div className="flex items-center justify-center mx-auto mb-4 bg-red-100 rounded-full w-14 h-14">
            <FaTrashAlt size={20} className="text-red-500" />
          </div>
          <h3 className="mb-1 text-base font-bold text-slate-800">Delete Job Order?</h3>
          <p className="mb-1 text-sm text-slate-500">{job.job_order_no}</p>
          <p className="mb-6 text-xs text-slate-400">{job.job_type} — {job.assigned_to}</p>
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 py-2.5 text-sm font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition">
              Cancel
            </button>
            <button onClick={async () => { setDeleting(true); await onConfirm(); setDeleting(false); }}
              disabled={deleting}
              className="flex-1 py-2.5 text-sm font-semibold rounded-xl bg-red-600 hover:bg-red-700 text-white transition disabled:opacity-50">
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN ──────────────────────────────────────────────────────────────────────
export default function JobOrder({ currentUser }) {
  const [jobs, setJobs]             = useState([]);
  const [clients, setClients]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [fetching, setFetching]     = useState(false);
  const [modal, setModal]           = useState(null); // null | { mode: 'create'|'edit'|'view', job }
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [message, setMessage]       = useState('');
  const [msgType, setMsgType]       = useState('');

  // Filters
  const [search, setSearch]         = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [sortBy, setSortBy]         = useState('created_desc');
  const [showFilters, setShowFilters] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize]       = useState(25);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchJobs = useCallback(async () => {
    setFetching(true);
    try {
      const { data, error } = await supabase
        .from('job_orders')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setJobs(data || []);
    } catch (e) {
      showMsg(`Error: ${e.message}`, 'error');
    } finally {
      setLoading(false);
      setFetching(false);
    }
  }, []);

  const fetchClients = useCallback(async () => {
    const { data } = await supabase
      .from('client_profile')
      .select('client_id, business_name')
      .eq('approval_status', 'approved')
      .order('business_name');
    if (data) setClients(data);
  }, []);

  useEffect(() => {
    fetchJobs();
    fetchClients();
  }, [fetchJobs, fetchClients]);

  useEffect(() => { setCurrentPage(1); }, [search, filterStatus, filterPriority, filterType, sortBy]);

  const showMsg = (msg, type) => {
    setMessage(msg); setMsgType(type);
    setTimeout(() => setMessage(''), 3500);
  };

  // ── CRUD ───────────────────────────────────────────────────────────────────
  const handleCreate = async (form) => {
    try {
      const jobNo = genJobNo(jobs.length + 1);
      const { error } = await supabase.from('job_orders').insert([{
        ...form,
        job_order_no: jobNo,
        created_by: currentUser?.username || currentUser?.fullName || 'System',
      }]);
      if (error) throw error;
      showMsg('✅ Job order created successfully!', 'success');
      setModal(null);
      fetchJobs();
    } catch (e) { showMsg(`❌ ${e.message}`, 'error'); }
  };

  const handleUpdate = async (form) => {
    try {
      const { error } = await supabase
        .from('job_orders').update({ ...form, updated_at: new Date().toISOString() }).eq('id', form.id);
      if (error) throw error;
      showMsg('✅ Job order updated!', 'success');
      setModal(null);
      fetchJobs();
    } catch (e) { showMsg(`❌ ${e.message}`, 'error'); }
  };

  const handleDelete = async () => {
    try {
      const { error } = await supabase.from('job_orders').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      showMsg('✅ Job order deleted.', 'success');
      setDeleteTarget(null);
      fetchJobs();
    } catch (e) { showMsg(`❌ ${e.message}`, 'error'); }
  };

  const handleStatusChange = async (job, newStatus) => {
    try {
      await supabase.from('job_orders').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', job.id);
      setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: newStatus } : j));
    } catch (e) { showMsg(`❌ ${e.message}`, 'error'); }
  };

  // ── Filter + Sort ──────────────────────────────────────────────────────────
  const filtered = jobs.filter(j => {
    if (filterStatus !== 'all' && j.status !== filterStatus) return false;
    if (filterPriority !== 'all' && j.priority !== filterPriority) return false;
    if (filterType !== 'all' && j.job_type !== filterType) return false;
    if (search.trim()) {
      const t = search.toLowerCase();
      return [j.job_order_no, j.job_type, j.client_name, j.assigned_to, j.description]
        .some(f => (f || '').toLowerCase().includes(t));
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'created_desc') return new Date(b.created_at) - new Date(a.created_at);
    if (sortBy === 'created_asc')  return new Date(a.created_at) - new Date(b.created_at);
    if (sortBy === 'due_asc')      return new Date(a.due_date || '9999') - new Date(b.due_date || '9999');
    if (sortBy === 'due_desc')     return new Date(b.due_date || '0000') - new Date(a.due_date || '0000');
    if (sortBy === 'priority')     return ['urgent','high','normal','low'].indexOf(a.priority) - ['urgent','high','normal','low'].indexOf(b.priority);
    return 0;
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paginated  = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const activeFilters = [filterStatus, filterPriority, filterType].filter(v => v !== 'all').length;
  const uniqueJobTypes = [...new Set(jobs.map(j => j.job_type).filter(Boolean))];

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = [
    { label: 'Total',       val: jobs.length,                                              cls: 'text-slate-800' },
    { label: 'In Progress', val: jobs.filter(j => j.status === 'in_progress').length,      cls: 'text-blue-600' },
    { label: 'For Review',  val: jobs.filter(j => j.status === 'for_review').length,       cls: 'text-violet-600' },
    { label: 'Completed',   val: jobs.filter(j => j.status === 'completed').length,        cls: 'text-emerald-600' },
    { label: 'Overdue',     val: jobs.filter(j => daysUntil(j.due_date) < 0 && !['completed','cancelled'].includes(j.status)).length, cls: 'text-red-500' },
  ];

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <div className="w-10 h-10 mx-auto mb-3 border-2 border-blue-600 rounded-full border-t-transparent animate-spin" />
        <p className="text-sm text-slate-500">Loading job orders...</p>
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
              <div className="flex items-center justify-center bg-blue-600 rounded-lg w-7 h-7">
                <FaClipboardList size={13} className="text-white" />
              </div>
              <h1 className="text-base font-bold text-slate-900">Job Order Tracking</h1>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 ml-9">
              {filtered.length} of {jobs.length} orders
              {fetching && <span className="ml-2 text-blue-400 animate-pulse">· syncing...</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchJobs} disabled={fetching}
              className="p-2 transition rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-40">
              <FaSync size={12} className={fetching ? 'animate-spin' : ''} />
            </button>
            <button onClick={() => setModal({ mode: 'create', job: null })}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white transition bg-blue-600 rounded-lg shadow hover:bg-blue-700 shadow-blue-400/30">
              <FaPlus size={11} /> New Job Order
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
            {message}
            <button onClick={() => setMessage('')}><FaTimes size={11} /></button>
          </div>
        )}

        {/* ── STATS ── */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {stats.map(s => (
            <div key={s.label} className="px-4 py-3 bg-white border shadow-sm rounded-xl border-slate-200">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{s.label}</p>
              <p className={`text-2xl font-bold mt-0.5 ${s.cls}`}>{s.val}</p>
            </div>
          ))}
        </div>

        {/* ── SEARCH + FILTERS ── */}
        <div className="p-4 space-y-3 bg-white border shadow-sm rounded-xl border-slate-200">
          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative flex-1 min-w-52">
              <FaSearch className="absolute -translate-y-1/2 left-3 top-1/2 text-slate-400" size={11} />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search job order, client, assigned staff..."
                className="w-full py-2 pl-8 pr-4 text-sm border rounded-lg border-slate-200 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50" />
              {search && <button onClick={() => setSearch('')} className="absolute -translate-y-1/2 right-3 top-1/2 text-slate-400 hover:text-slate-600"><FaTimes size={10} /></button>}
            </div>

            {/* Sort */}
            <select value={sortBy} onChange={e => setSortBy(e.target.value)}
              className="px-3 py-2 text-sm bg-white border rounded-lg cursor-pointer border-slate-200 text-slate-700 focus:outline-none">
              <option value="created_desc">Newest First</option>
              <option value="created_asc">Oldest First</option>
              <option value="due_asc">Due Date (Soonest)</option>
              <option value="due_desc">Due Date (Latest)</option>
              <option value="priority">By Priority</option>
            </select>

            {/* Filter toggle */}
            <button onClick={() => setShowFilters(f => !f)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border transition ${
                activeFilters > 0 ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'
              }`}>
              <FaFilter size={10} /> Filters
              {activeFilters > 0 && <span className="w-4 h-4 text-[10px] font-bold bg-blue-500 text-white rounded-full flex items-center justify-center">{activeFilters}</span>}
              {showFilters ? <FaChevronUp size={9} /> : <FaChevronDown size={9} />}
            </button>
          </div>

          {showFilters && (
            <div className="grid grid-cols-2 gap-3 pt-3 border-t md:grid-cols-3 border-slate-100">
              {/* Status filter */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wide text-slate-400 block mb-1">Status</label>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none cursor-pointer">
                  <option value="all">All Statuses</option>
                  {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              {/* Priority filter */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wide text-slate-400 block mb-1">Priority</label>
                <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none cursor-pointer">
                  <option value="all">All Priorities</option>
                  {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              {/* Job Type filter */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wide text-slate-400 block mb-1">Job Type</label>
                <select value={filterType} onChange={e => setFilterType(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none cursor-pointer">
                  <option value="all">All Types</option>
                  {uniqueJobTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* ── TABLE ── */}
        <div className="overflow-hidden bg-white border shadow-sm rounded-xl border-slate-200">
          {paginated.length === 0 ? (
            <div className="py-20 text-center">
              <FaClipboardList size={32} className="mx-auto mb-3 text-slate-200" />
              <p className="font-semibold text-slate-400">No job orders found</p>
              <p className="mt-1 text-xs text-slate-300">Try adjusting your filters or create a new one</p>
              <button onClick={() => setModal({ mode: 'create', job: null })}
                className="px-4 py-2 mt-4 text-sm font-semibold text-white transition bg-blue-600 rounded-lg hover:bg-blue-700">
                + New Job Order
              </button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80">
                      {['#', 'Job Order No.', 'Job Type', 'Client', 'Assigned To', 'Due Date', 'Priority', 'Status', 'Actions'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((job, idx) => {
                      const due = dueBadge(job.due_date, job.status);
                      const globalIdx = (currentPage - 1) * pageSize + idx + 1;
                      return (
                        <tr key={job.id} className="transition border-b border-slate-100 hover:bg-blue-50/20 group">
                          <td className="px-4 py-3 text-xs text-slate-300 tabular-nums">{globalIdx}</td>
                          <td className="px-4 py-3">
                            <span className="font-mono text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{job.job_order_no || '—'}</span>
                          </td>
                          <td className="px-4 py-3 max-w-[160px]">
                            <p className="text-sm font-semibold truncate text-slate-800" title={job.job_type}>{job.job_type || '—'}</p>
                            {job.description && <p className="text-xs text-slate-400 truncate mt-0.5" title={job.description}>{job.description}</p>}
                          </td>
                          <td className="px-4 py-3">
                            {job.client_name ? (
                              <div>
                                <p className="text-xs font-semibold text-slate-700 truncate max-w-[120px]" title={job.client_name}>{job.client_name}</p>
                                {job.client_id && <p className="text-[10px] font-mono text-slate-400">{job.client_id}</p>}
                              </div>
                            ) : <span className="text-xs text-slate-300">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <div className="flex items-center justify-center w-6 h-6 bg-blue-100 rounded-full shrink-0">
                                <FaUser size={9} className="text-blue-600" />
                              </div>
                              <span className="text-xs text-slate-700 whitespace-nowrap">{job.assigned_to || '—'}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <p className="text-xs text-slate-600">{fmtDate(job.due_date)}</p>
                            {due && <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${due.cls}`}>{due.label}</span>}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <PriorityBadge value={job.priority} />
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {/* Inline status quick-change */}
                            <div className="relative group/status">
                              <StatusBadge value={job.status} />
                              {/* Hover dropdown */}
                              <div className="absolute left-0 z-10 hidden mt-1 overflow-hidden bg-white border shadow-xl top-full group-hover/status:block border-slate-200 rounded-xl min-w-36">
                                {STATUSES.map(s => (
                                  <button key={s.value} onClick={() => handleStatusChange(job, s.value)}
                                    className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-medium hover:bg-slate-50 transition text-left ${job.status === s.value ? 'bg-blue-50 text-blue-600' : 'text-slate-700'}`}>
                                    <div className={`w-2 h-2 rounded-full ${s.dot}`} />
                                    {s.label}
                                    {job.status === s.value && <FaCheck size={9} className="ml-auto text-blue-500" />}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1 transition-opacity opacity-0 group-hover:opacity-100">
                              <button onClick={() => setModal({ mode: 'view', job })}
                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-100 rounded-lg transition" title="View">
                                <FaEye size={12} />
                              </button>
                              <button onClick={() => setModal({ mode: 'edit', job })}
                                className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-100 rounded-lg transition" title="Edit">
                                <FaEdit size={12} />
                              </button>
                              <button onClick={() => setDeleteTarget(job)}
                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-100 rounded-lg transition" title="Delete">
                                <FaTrashAlt size={11} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* ── PAGINATION ── */}
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-white border-t border-slate-200">
                <div className="flex items-center gap-3 text-sm text-slate-500">
                  <span>Rows per page:</span>
                  <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                    className="px-2 py-1 text-xs bg-white border rounded-lg cursor-pointer border-slate-200 focus:outline-none">
                    {[10, 25, 50, 100].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <span className="text-xs">
                    {sorted.length === 0 ? '0' : (currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, sorted.length)} of {sorted.length}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {[
                    { icon: FaAngleDoubleLeft,  action: () => setCurrentPage(1),               disabled: currentPage === 1 },
                    { icon: FaChevronLeft,       action: () => setCurrentPage(p => p - 1),       disabled: currentPage === 1 },
                    { icon: FaChevronRight,      action: () => setCurrentPage(p => p + 1),       disabled: currentPage === totalPages },
                    { icon: FaAngleDoubleRight,  action: () => setCurrentPage(totalPages),       disabled: currentPage === totalPages },
                  ].map((btn, i) => (
                    <button key={i} onClick={btn.action} disabled={btn.disabled}
                      className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition">
                      <btn.icon size={11} />
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── MODAL ── */}
      {modal && (
        <JobOrderModal
          mode={modal.mode}
          job={modal.job}
          clients={clients}
          onClose={() => setModal(null)}
          onSave={modal.mode === 'edit' ? handleUpdate : handleCreate}
        />
      )}

      {/* ── DELETE CONFIRM ── */}
      {deleteTarget && (
        <DeleteConfirm
          job={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}