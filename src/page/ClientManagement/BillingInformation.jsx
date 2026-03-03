import React, { useState, useEffect, useCallback } from 'react';
import {
  FaSearch, FaFilter, FaEye, FaMoneyBillWave, FaFileInvoice,
  FaSpinner, FaSort, FaSortUp, FaSortDown, FaDownload, FaSync
} from 'react-icons/fa';
import { supabase } from '../../lib/supabaseClient';

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const fmt = (n) =>
  isNaN(parseFloat(n))
    ? '₱ 0.00'
    : `₱ ${parseFloat(n).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;

const fmtDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
};

const STATUS_STYLES = {
  Paid:      { badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  Pending:   { badge: 'bg-amber-100 text-amber-700 border-amber-200',       dot: 'bg-amber-500' },
  Overdue:   { badge: 'bg-red-100 text-red-700 border-red-200',             dot: 'bg-red-500' },
  Sent:      { badge: 'bg-blue-100 text-blue-700 border-blue-200',          dot: 'bg-blue-500' },
  Cancelled: { badge: 'bg-slate-100 text-slate-500 border-slate-200',       dot: 'bg-slate-400' },
};

const ALL_STATUSES = ['All', 'Pending', 'Sent', 'Overdue', 'Paid', 'Cancelled'];

const Badge = ({ status }) => {
  const s = STATUS_STYLES[status] || STATUS_STYLES.Pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${s.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {status}
    </span>
  );
};

// ─── VIEW MODAL ───────────────────────────────────────────────────────────────
const ViewModal = ({ record, onClose, onRecordPayment }) => {
  const [lines, setLines] = useState([]);
  const [linesLoading, setLinesLoading] = useState(false);

  useEffect(() => {
    const fetchLines = async () => {
      setLinesLoading(true);
      const { data } = await supabase
        .from('billing_line_items')
        .select('*')
        .eq('billing_id', record.id)
        .order('id');
      setLines(data || []);
      setLinesLoading(false);
    };
    fetchLines();
  }, [record.id]);

  const fmtA = (n) =>
    isNaN(parseFloat(n)) ? '0.00'
      : parseFloat(n).toLocaleString('en-PH', { minimumFractionDigits: 2 });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 flex items-center justify-between px-6 py-4 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-t-2xl">
          <div>
            <p className="text-xs font-bold tracking-wider uppercase text-white/70">Billing Record</p>
            <h2 className="text-lg font-bold text-white">{record.billing_number}</h2>
          </div>
          <div className="flex items-center gap-3">
            {record.billing_status !== 'Paid' && record.billing_status !== 'Cancelled' && (
              <button
                onClick={() => { onClose(); onRecordPayment(record); }}
                className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-blue-600 transition bg-white rounded-lg shadow hover:bg-blue-50">
                <FaMoneyBillWave size={12} /> Record Payment
              </button>
            )}
            <button onClick={onClose}
              className="flex items-center justify-center w-8 h-8 text-lg font-bold text-white transition rounded-full bg-white/20 hover:bg-white/30">
              ×
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          <div className="flex flex-wrap gap-2">
            <Badge status={record.billing_status} />
            {record.payment_terms && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border bg-slate-100 text-slate-600 border-slate-200">
                {record.payment_terms}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              ['Client ID', record.client_id || '—'],
              ['Client Name', record.client_name || '—'],
              ['Invoice Date', fmtDate(record.invoice_date)],
              ['Due Date', fmtDate(record.due_date)],
              ['Billing Period', record.billing_period || '—'],
              ['Billing Month', record.billing_month ? fmtDate(record.billing_month) : '—'],
              ['Prepared By', record.prepared_by || '—'],
              ['Approved By', record.approved_by || '—'],
            ].map(([l, v]) => (
              <div key={l} className="p-3 rounded-lg bg-slate-50">
                <p className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-slate-400">{l}</p>
                <p className="text-xs font-semibold truncate text-slate-700">{v}</p>
              </div>
            ))}
          </div>

          {linesLoading ? (
            <div className="flex justify-center py-6">
              <FaSpinner className="text-blue-500 animate-spin" size={20} />
            </div>
          ) : lines.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-bold tracking-wide uppercase text-slate-500">Service Line Items</p>
              <div className="overflow-hidden border rounded-xl border-slate-200">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50">
                    <tr>
                      {['Service / Description', 'Qty', 'Unit Price', 'VAT', 'Total'].map((h) => (
                        <th key={h} className={`px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 ${h === 'Service / Description' ? 'text-left' : 'text-right'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100">
                    {lines.map((l) => (
                      <tr key={l.id} className="transition hover:bg-slate-50">
                        <td className="px-3 py-2 font-medium text-slate-700">
                          {l.service_type || '—'}
                          {l.description && <p className="font-normal text-slate-400">{l.description}</p>}
                        </td>
                        <td className="px-3 py-2 text-right text-slate-600">{l.qty}</td>
                        <td className="px-3 py-2 text-right text-slate-600">₱ {fmtA(l.unit_price)}</td>
                        <td className="px-3 py-2 text-right text-slate-600">₱ {fmtA(l.vat_amount)}</td>
                        <td className="px-3 py-2 font-semibold text-right text-slate-800">₱ {fmtA(l.line_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : record.service_type ? (
            <div className="p-4 border rounded-xl border-slate-200 bg-slate-50">
              <p className="mb-1 text-xs font-bold tracking-wide uppercase text-slate-400">Service</p>
              <p className="text-sm font-semibold text-slate-700">{record.service_type}</p>
              {record.description && <p className="mt-1 text-xs text-slate-500">{record.description}</p>}
            </div>
          ) : null}

          <div className="p-5 border-2 border-blue-100 rounded-xl bg-blue-50/50">
            <div className="flex flex-col max-w-xs gap-2 ml-auto">
              {record.subtotal > 0 && (
                <div className="flex justify-between text-sm text-slate-500">
                  <span>Subtotal</span><span className="font-semibold text-slate-700">{fmt(record.subtotal)}</span>
                </div>
              )}
              {record.vat_amount > 0 && (
                <div className="flex justify-between text-sm text-slate-500">
                  <span>VAT</span><span className="font-semibold text-slate-700">{fmt(record.vat_amount)}</span>
                </div>
              )}
              {record.discount_amount > 0 && (
                <div className="flex justify-between text-sm text-emerald-600">
                  <span>Discount</span><span className="font-semibold">− {fmt(record.discount_amount)}</span>
                </div>
              )}
              <div className="h-px bg-blue-200" />
              <div className="flex justify-between text-lg font-bold text-blue-600">
                <span>Total Due</span><span>{fmt(record.total_amount)}</span>
              </div>
            </div>
          </div>

          {record.notes && (
            <div className="p-4 border rounded-xl border-amber-200 bg-amber-50">
              <p className="mb-1 text-xs font-bold tracking-wide uppercase text-amber-600">Notes</p>
              <p className="text-sm text-slate-700">{record.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function BillingInformation({ onNavigateToPayment }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortField, setSortField] = useState('created_at');
  const [sortDir, setSortDir] = useState('desc');
  const [viewRecord, setViewRecord] = useState(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('billing_information')
        .select('*')
        .order(sortField, { ascending: sortDir === 'asc' });

      if (statusFilter !== 'All') query = query.eq('billing_status', statusFilter);
      if (search.trim()) {
        query = query.or(
          `billing_number.ilike.%${search}%,client_name.ilike.%${search}%,client_id.ilike.%${search}%`
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      setRecords(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, sortField, sortDir]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const handleSort = (field) => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('asc'); }
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <FaSort className="opacity-30" size={10} />;
    return sortDir === 'asc' ? <FaSortUp size={10} /> : <FaSortDown size={10} />;
  };

  const totalPages = Math.ceil(records.length / PAGE_SIZE);
  const paginated = records.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const stats = {
    total: records.length,
    pending: records.filter((r) => r.billing_status === 'Pending').length,
    overdue: records.filter((r) => r.billing_status === 'Overdue').length,
    paid: records.filter((r) => r.billing_status === 'Paid').length,
    totalDue: records
      .filter((r) => r.billing_status !== 'Paid' && r.billing_status !== 'Cancelled')
      .reduce((s, r) => s + (parseFloat(r.total_amount) || 0), 0),
  };

  const exportCSV = () => {
    const headers = ['Billing #', 'Invoice #', 'Client ID', 'Client Name', 'Invoice Date', 'Due Date', 'Status', 'Total Amount'];
    const rows = records.map((r) => [r.billing_number, r.invoice_number, r.client_id, r.client_name, r.invoice_date, r.due_date, r.billing_status, r.total_amount]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c ?? ''}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'billing_records.csv'; a.click();
  };

  return (
    <div className="min-h-screen p-6 bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="mx-auto space-y-6 max-w-7xl">

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Billing Information</h1>
            <p className="mt-1 text-sm text-slate-500">View and manage all client billing records</p>
          </div>
          <div className="flex gap-2">
            <button onClick={exportCSV}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg border-2 border-slate-200 hover:border-blue-300 hover:text-blue-600 text-slate-600 transition bg-white">
              <FaDownload size={12} /> Export CSV
            </button>
            <button onClick={fetchRecords}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:opacity-90 transition shadow shadow-blue-500/30">
              <FaSync size={11} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          {[
            { label: 'Total Records',     value: stats.total,    color: 'text-slate-700',   bg: 'bg-white' },
            { label: 'Pending',           value: stats.pending,  color: 'text-amber-600',   bg: 'bg-amber-50' },
            { label: 'Overdue',           value: stats.overdue,  color: 'text-red-600',     bg: 'bg-red-50' },
            { label: 'Paid',              value: stats.paid,     color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'Total Outstanding', value: `₱ ${stats.totalDue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`, color: 'text-blue-600', bg: 'bg-blue-50' },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className={`${bg} p-4 rounded-xl border border-slate-200 shadow-sm`}>
              <p className="text-xs font-semibold tracking-wide uppercase text-slate-400">{label}</p>
              <p className={`text-xl font-bold mt-1 ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 p-4 bg-white border shadow-sm rounded-xl border-slate-200">
          <div className="relative flex-1 min-w-[200px]">
            <FaSearch size={12} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search billing #, client name or ID..."
              className="w-full pl-9 pr-4 py-2.5 text-sm border-2 rounded-lg border-slate-200 focus:border-blue-500 focus:outline-none bg-white text-slate-800" />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <FaFilter size={11} className="text-slate-400" />
            {ALL_STATUSES.map((s) => (
              <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition
                  ${statusFilter === s
                    ? s === 'All' ? 'bg-slate-800 border-slate-800 text-white'
                      : s === 'Paid' ? 'bg-emerald-500 border-emerald-500 text-white'
                      : s === 'Pending' ? 'bg-amber-500 border-amber-500 text-white'
                      : s === 'Overdue' ? 'bg-red-500 border-red-500 text-white'
                      : s === 'Sent' ? 'bg-blue-500 border-blue-500 text-white'
                      : 'bg-slate-400 border-slate-400 text-white'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden bg-white border shadow-sm rounded-xl border-slate-200">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <FaSpinner className="mr-3 text-blue-500 animate-spin" size={20} />
              <span className="text-sm text-slate-500">Loading billing records...</span>
            </div>
          ) : paginated.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <FaFileInvoice size={36} className="mb-3 text-slate-300" />
              <p className="text-sm font-semibold text-slate-500">No billing records found</p>
              <p className="mt-1 text-xs text-slate-400">Try adjusting your search or filters</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    {[
                      { label: 'Billing #',     field: 'billing_number' },
                      { label: 'Client',         field: 'client_name' },
                      { label: 'Invoice Date',   field: 'invoice_date' },
                      { label: 'Due Date',       field: 'due_date' },
                      { label: 'Total Amount',   field: 'total_amount' },
                      { label: 'Status',         field: 'billing_status' },
                      { label: 'Actions',        field: null },
                    ].map(({ label, field }) => (
                      <th key={label}
                        onClick={() => field && handleSort(field)}
                        className={`px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500 ${field ? 'cursor-pointer hover:text-slate-700 select-none' : ''}`}>
                        <div className="flex items-center gap-1.5">
                          {label}
                          {field && <SortIcon field={field} />}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginated.map((record) => (
                    <tr key={record.id} className="transition hover:bg-slate-50 group">
                      <td className="px-4 py-3.5">
                        <span className="font-mono text-xs font-bold text-blue-600">{record.billing_number}</span>
                        {record.invoice_number && (
                          <p className="font-mono text-xs text-slate-400">{record.invoice_number}</p>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="font-semibold text-slate-800 truncate max-w-[180px]">{record.client_name || '—'}</p>
                        {record.client_id && (
                          <p className="text-xs text-slate-400 font-mono truncate max-w-[180px]">{record.client_id}</p>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-sm text-slate-600 whitespace-nowrap">{fmtDate(record.invoice_date)}</td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className={`text-sm font-medium ${record.billing_status === 'Overdue' ? 'text-red-600 font-semibold' : 'text-slate-600'}`}>
                          {fmtDate(record.due_date)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="font-bold text-slate-800">{fmt(record.total_amount)}</span>
                      </td>
                      <td className="px-4 py-3.5"><Badge status={record.billing_status} /></td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2 transition opacity-0 group-hover:opacity-100">
                          <button onClick={() => setViewRecord(record)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition">
                            <FaEye size={11} /> View
                          </button>
                          {record.billing_status !== 'Paid' && record.billing_status !== 'Cancelled' && (
                            <button onClick={() => onNavigateToPayment && onNavigateToPayment(record)}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition">
                              <FaMoneyBillWave size={11} /> Pay
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {!loading && records.length > PAGE_SIZE && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
              <p className="text-xs text-slate-500">
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, records.length)} of {records.length}
              </p>
              <div className="flex gap-1">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-100 transition">← Prev</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                  .map((p, idx, arr) => (
                    <React.Fragment key={p}>
                      {idx > 0 && arr[idx - 1] !== p - 1 && <span className="px-2 py-1.5 text-xs text-slate-400">…</span>}
                      <button onClick={() => setPage(p)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${page === p ? 'bg-blue-500 border-blue-500 text-white' : 'border-slate-200 hover:bg-slate-100 text-slate-600'}`}>
                        {p}
                      </button>
                    </React.Fragment>
                  ))}
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-100 transition">Next →</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {viewRecord && (
        <ViewModal
          record={viewRecord}
          onClose={() => setViewRecord(null)}
          onRecordPayment={(r) => { onNavigateToPayment && onNavigateToPayment(r); }}
        />
      )}
    </div>
  );
}