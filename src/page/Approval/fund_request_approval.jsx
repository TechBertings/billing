import React, { useState, useEffect } from 'react';
import { FaCheck, FaTimes, FaEye, FaSearch, FaMoneyCheckAlt } from 'react-icons/fa';
import { supabase } from '../../lib/supabaseClient';

const GREEN = '#1a5c2e';

const BADGE = {
  pending:  'bg-amber-50 text-amber-700 border border-amber-200',
  approved: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  rejected: 'bg-red-50 text-red-600 border border-red-200',
};

const FUND_TYPE_LABEL = {
  operating_expenses: 'Operating Expenses',
  remittances: 'Remittances',
};

const PAGE_SIZE = 10;

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

const fmt = (n) =>
  Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const Detail = ({ label, value }) =>
  value || value === 0 ? (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">{label}</p>
      <p className="text-sm font-medium break-words text-slate-800">{value}</p>
    </div>
  ) : null;

const Section = ({ title, children }) => (
  <div>
    <p className="pb-2 mb-3 text-xs font-bold tracking-widest uppercase border-b text-slate-400 border-slate-100">{title}</p>
    <div className="grid grid-cols-2 gap-x-6 gap-y-3">{children}</div>
  </div>
);

export default function FundRequestApproval({ currentUser }) {
  const [requests, setRequests]     = useState([]);
  const [filtered, setFiltered]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [modal, setModal]           = useState(null);
  const [notes, setNotes]           = useState('');
  const [processingId, setProcessingId] = useState(null);
  const [message, setMessage]       = useState({ text: '', type: '' });
  const [search, setSearch]         = useState('');
  const [fundTypeFilter, setFundTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [dateFrom, setDateFrom]     = useState('');
  const [dateTo, setDateTo]         = useState('');
  const [page, setPage]             = useState(1);

  useEffect(() => { fetchRequests(); }, []);

  useEffect(() => {
    let data = [...requests];
    if (search) data = data.filter(r =>
      (r.slip_number || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.tax_payer || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.particulars || '').toLowerCase().includes(search.toLowerCase())
    );
    if (fundTypeFilter) data = data.filter(r => r.fund_type === fundTypeFilter);
    if (statusFilter) data = data.filter(r => (r.status || '').toLowerCase() === statusFilter.toLowerCase());
    if (dateFrom) data = data.filter(r => new Date(r.request_date) >= new Date(dateFrom));
    if (dateTo) data = data.filter(r => new Date(r.request_date) <= new Date(dateTo + 'T23:59:59'));
    setFiltered(data);
    setPage(1);
  }, [requests, search, fundTypeFilter, statusFilter, dateFrom, dateTo]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('fund_requests')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setRequests(data || []);
    } catch (err) {
      setMessage({ text: `Error: ${err.message}`, type: 'error' });
    } finally {
      setLoading(false);
    }
  };
const FUND_TYPE_TO_POOL = {
  operating_expenses: 'income',
  remittances: 'remittance',
};
const handleAction = async (requestId, action) => {
  if (action === 'rejected' && !notes.trim()) {
    return;
  }
  setProcessingId(requestId);
  setMessage({ text: '', type: '' });
  try {
    const request = requests.find((r) => r.id === requestId);

    const { error } = await supabase
      .from('fund_requests')
      .update({
        status: action,
        approved_by: currentUser?.full_name || currentUser?.fullName || 'Admin',
        approved_date: new Date().toISOString().split('T')[0],
        approval_notes: notes || null,
      })
      .eq('id', requestId);
    if (error) throw error;

    // Bawas sa fund pool lang pag na-approve — same RPC ginamit sa
    // RecordPayment.jsx, negative amount para mag-deduct
    if (action === 'approved' && request) {
      const pool = FUND_TYPE_TO_POOL[request.fund_type] || 'income';
      const { error: poolErr } = await supabase.rpc('increment_fund_pool', {
        p_pool_type: pool,
        p_amount: -Math.abs(request.total_amount),
      });
      if (poolErr) console.error('Failed to deduct fund pool:', poolErr);
    }

    setMessage({ text: `✅ Fund request ${action} successfully!`, type: 'success' });
    setNotes('');
    setModal(null);
    setTimeout(fetchRequests, 1000);
  } catch (err) {
    setMessage({ text: `❌ ${err.message}`, type: 'error' });
  } finally {
    setProcessingId(null);
  }
};

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="min-h-screen bg-slate-50">

      {/* Header */}
      <div className="px-6 py-5 bg-white border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center rounded-full w-9 h-9"
            style={{ background: '#e8f5ec' }}
          >
            <FaMoneyCheckAlt size={14} style={{ color: GREEN }} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Fund Request Approvals</h1>
            <p className="text-sm text-slate-500 mt-0.5">Review and approve fund request slips</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-4">

        {/* Alert */}
        {message.text && (
          <div className={`px-4 py-3 rounded-lg text-sm font-medium border ${
            message.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}>{message.text}</div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 bg-white border shadow-sm rounded-xl border-slate-200">
          <div className="relative flex-1 min-w-[180px]">
            <FaSearch size={11} className="absolute -translate-y-1/2 left-3 top-1/2 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search slip no., tax payer, particulars…"
              className="w-full py-2 pr-3 text-sm border rounded-lg pl-9 border-slate-200 focus:border-teal-500 focus:outline-none"
            />
          </div>
          <select value={fundTypeFilter} onChange={e => setFundTypeFilter(e.target.value)}
            className="px-3 py-2 text-sm bg-white border rounded-lg cursor-pointer border-slate-200 focus:border-teal-500 focus:outline-none">
            <option value="">All Fund Types</option>
            <option value="operating_expenses">Operating Expenses</option>
            <option value="remittances">Remittances</option>
          </select>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm bg-white border rounded-lg cursor-pointer border-slate-200 focus:border-teal-500 focus:outline-none"
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>From</span>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="px-3 py-2 text-sm border rounded-lg border-slate-200 focus:border-teal-500 focus:outline-none" />
            <span>to</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="px-3 py-2 text-sm border rounded-lg border-slate-200 focus:border-teal-500 focus:outline-none" />
          </div>
          <button
            onClick={() => { const t = new Date().toISOString().split('T')[0]; setDateFrom(t); setDateTo(t); }}
            className="px-3 py-2 text-xs font-semibold transition bg-white border rounded-lg border-slate-200 hover:bg-slate-100 text-slate-600">
            Today
          </button>
          {(search || fundTypeFilter || dateFrom || dateTo) && (
            <button onClick={() => { setSearch(''); setFundTypeFilter(''); setStatusFilter(''); setDateFrom(''); setDateTo(''); }}
              className="px-3 py-2 text-xs font-semibold text-red-500 transition border border-red-200 rounded-lg hover:bg-red-50">
              Clear
            </button>
          )}
        </div>

        {/* Table */}
        <div className="overflow-hidden bg-white border shadow-sm rounded-xl border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-white bg-teal-700">
                  {['Slip No.', 'Tax Payer', 'Fund Type', 'Date', 'Total Amount', 'Status', 'Approved Date', 'Action'].map(h => (
                    <th key={h} className="px-4 py-3.5 font-semibold text-xs uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={8} className="py-16 text-sm text-center text-slate-400">Loading…</td></tr>
                ) : paginated.length === 0 ? (
                  <tr><td colSpan={8} className="py-16 text-sm text-center text-slate-400">No records found.</td></tr>
                ) : paginated.map(req => (
                  <tr key={req.id} className="transition hover:bg-slate-50">
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-teal-700 text-white whitespace-nowrap font-mono">
                        {req.slip_number}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-medium text-slate-800 max-w-[200px] truncate">{req.tax_payer || '—'}</td>
                    <td className="px-4 py-3.5 text-slate-600">{FUND_TYPE_LABEL[req.fund_type] || req.fund_type || '—'}</td>
                    <td className="px-4 py-3.5 text-slate-500 whitespace-nowrap">{fmtDate(req.request_date)}</td>
                    <td className="px-4 py-3.5 font-mono text-slate-700 whitespace-nowrap">₱{fmt(req.total_amount)}</td>
                    <td className="px-4 py-3.5">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize border ${BADGE[(req.status || 'pending').toLowerCase()] || BADGE.pending}`}>
                        {req.status || 'pending'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-slate-500 whitespace-nowrap">{fmtDate(req.approved_date)}</td>
                    <td className="px-4 py-3.5 text-center">
                      <button
                        onClick={() => { setModal(req); setNotes(''); setMessage({ text: '', type: '' }); }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition whitespace-nowrap"
                      >
                        <FaEye size={10} /> View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-end gap-3 text-sm">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="px-4 py-2 font-medium transition bg-white border rounded-lg border-slate-200 hover:bg-slate-100 disabled:opacity-40 text-slate-600">
            Prev
          </button>
          <span className="text-xs text-slate-500">Page {page} of {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="px-4 py-2 font-medium text-white transition bg-teal-700 border border-teal-700 rounded-lg hover:bg-teal-800 disabled:opacity-40">
            Next
          </button>
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>

            {/* Modal Header */}
            <div className="flex items-start justify-between px-6 py-4 bg-gradient-to-r from-teal-800 to-emerald-700 rounded-t-2xl">
              <div>
                <p className="text-xs font-bold tracking-widest text-teal-100 uppercase">Fund Request Slip</p>
                <h2 className="text-white font-bold text-lg leading-tight mt-0.5">{modal.tax_payer || 'N/A'}</h2>
                <p className="text-teal-200 text-xs mt-0.5 font-mono">{modal.slip_number}</p>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize border ${BADGE[(modal.status || 'pending').toLowerCase()] || BADGE.pending}`}>
                  {modal.status || 'pending'}
                </span>
                <button onClick={() => setModal(null)} className="flex items-center justify-center w-8 h-8 text-white transition rounded-full bg-white/20 hover:bg-white/30">
                  <FaTimes size={12} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">

              {/* In-modal alert */}
              {message.text && (
                <div className={`px-4 py-3 rounded-lg text-sm font-medium border ${
                  message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'
                }`}>{message.text}</div>
              )}

              <Section title="Request Info">
                <Detail label="Fund Type"   value={FUND_TYPE_LABEL[modal.fund_type] || modal.fund_type} />
                <Detail label="Date"        value={fmtDate(modal.request_date)} />
                <Detail label="Due Date"    value={fmtDate(modal.due_date)} />
                <Detail label="Form Type"   value={modal.form_type} />
                <Detail label="Particulars" value={modal.particulars} />
              </Section>

              <Section title="Amount Breakdown">
                <Detail label="Principal"  value={`₱${fmt(modal.amount_principal)}`} />
                <Detail label="Surcharge"  value={`₱${fmt(modal.amount_surcharge)}`} />
                <Detail label="Interest"   value={`₱${fmt(modal.amount_interest)}`} />
                <Detail label="Compromise" value={`₱${fmt(modal.amount_compromise)}`} />
                {Array.isArray(modal.amount_other) && modal.amount_other.length > 0 && (
                  <div className="col-span-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Other</p>
                    <div className="space-y-0.5">
                      {modal.amount_other.map((it, i) => (
                        <p key={i} className="text-sm font-medium text-slate-800">
                          {it.label || 'Other'} — ₱{fmt(it.amount)}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between col-span-2 pt-2 mt-1 border-t border-slate-100">
                  <span className="text-sm font-semibold text-slate-700">Total</span>
                  <span className="font-mono text-lg font-bold" style={{ color: GREEN }}>
                    ₱{fmt(modal.total_amount)}
                  </span>
                </div>
              </Section>

              <Section title="Fund Details">
                <Detail label="Care of / Bank / Mode" value={modal.care_of_bank_mode} />
                <Detail label="Fund Details"          value={modal.fund_details} />
                <Detail label="Note"                  value={modal.note} />
              </Section>

              <Section title="Signatories">
                <Detail label="Requestioner"                value={modal.requestioner} />
                <Detail label="Authorized by"               value={modal.authorized_by} />
                <Detail label="Billing Verification by"     value={modal.billing_verification_by} />
                <Detail label="Receipt Acknowledgement by"  value={modal.receipt_acknowledgement_by} />
                <Detail label="Recorded by"                 value={modal.recorded_by} />
              </Section>

              {/* Actions */}
              {(!modal.status || modal.status?.toLowerCase() === 'pending') ? (
                <div className="pt-4 border-t border-slate-100">
                  <label className="block mb-2 text-xs font-bold tracking-widest uppercase text-slate-400">
                    Notes <span className="font-normal text-red-400 normal-case">(required for rejection)</span>
                  </label>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Add notes here…"
                    rows={2}
                    className="w-full px-3 py-2.5 text-sm border-2 border-slate-200 rounded-xl focus:border-teal-500 focus:outline-none resize-none mb-4"
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleAction(modal.id, 'approved')}
                      disabled={processingId === modal.id}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition disabled:opacity-50"
                    >
                      <FaCheck size={11} /> Approve
                    </button>
                    <button
                      onClick={() => handleAction(modal.id, 'rejected')}
                      disabled={processingId === modal.id || !notes.trim()}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 rounded-xl transition disabled:opacity-50"
                    >
                      <FaTimes size={11} /> Reject
                    </button>
                  </div>
                </div>
              ) : (
                <div className={`flex flex-col gap-1 px-4 py-3 rounded-xl border ${
                  modal.status?.toLowerCase() === 'approved'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : 'bg-red-50 border-red-200 text-red-600'
                }`}>
                  <div className="flex items-center gap-3">
                    {modal.status?.toLowerCase() === 'approved' ? <FaCheck size={12} /> : <FaTimes size={12} />}
                    <p className="text-sm font-medium capitalize">
                      {modal.status} by {modal.approved_by || '—'} on {modal.approved_date ? fmtDate(modal.approved_date) : '—'}
                    </p>
                  </div>
                  {modal.approval_notes && (
                    <p className="pl-6 text-xs">{modal.approval_notes}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}