    import React, { useState, useEffect } from 'react';
    import { FaCheck, FaTimes, FaEye, FaClock, FaSearch } from 'react-icons/fa';
    import { supabase } from '../../lib/supabaseClient';

    const BADGE = {
    pending:  'bg-amber-50 text-amber-700 border border-amber-200',
    approved: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    rejected: 'bg-red-50 text-red-600 border border-red-200',
    };

    const Detail = ({ label, value }) =>
    value ? (
        <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">{label}</p>
        <p className="text-sm font-medium break-words text-slate-800">{value}</p>
        </div>
    ) : null;

    const PAGE_SIZE = 10;

    const fmtDate = (d) =>
    d ? new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

    export default function ClientApproval() {
    const [clients, setClients]           = useState([]);
    const [filtered, setFiltered]         = useState([]);
    const [loading, setLoading]           = useState(true);
    const [modal, setModal]               = useState(null);
    const [notes, setNotes]               = useState('');
    const [processingId, setProcessingId] = useState(null);
    const [message, setMessage]           = useState({ text: '', type: '' });
    const [search, setSearch]             = useState('');
    const [accountFilter, setAccountFilter] = useState('');
    const [dateFrom, setDateFrom]         = useState('');
    const [dateTo, setDateTo]             = useState('');
    const [page, setPage]                 = useState(1);
    const [accounts, setAccounts]         = useState([]);
    const [approvalStatusFilter, setApprovalStatusFilter] = useState('pending');


    useEffect(() => { fetchClients(); }, []);

    useEffect(() => {
        let data = [...clients];
        if (search)        data = data.filter(c =>
        (c.client_id || '').toLowerCase().includes(search.toLowerCase()) ||
        (c.business_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (c.contact_person || '').toLowerCase().includes(search.toLowerCase())
        );
        if (accountFilter) data = data.filter(c => c.account === accountFilter);
        if (approvalStatusFilter) data = data.filter(c =>
         (c.approval_status || '').toLowerCase() === approvalStatusFilter.toLowerCase()
         );
        if (dateFrom)      data = data.filter(c => new Date(c.created_at) >= new Date(dateFrom));
        if (dateTo)        data = data.filter(c => new Date(c.created_at) <= new Date(dateTo + 'T23:59:59'));
        setFiltered(data);
        setPage(1);
    }, [clients, search, accountFilter, approvalStatusFilter, dateFrom, dateTo]);

    const fetchClients = async () => {
        setLoading(true);
        try {
        const { data, error } = await supabase
            .from('client_profile')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        setClients(data || []);
        const unique = [...new Set((data || []).map(c => c.account).filter(Boolean))];
        setAccounts(unique);
        } catch (err) {
        setMessage({ text: `Error: ${err.message}`, type: 'error' });
        } finally {
        setLoading(false);
        }
    };

    const handleAction = async (clientId, action) => {
        if (action === 'rejected' && !notes.trim()) {
        return;
        }
        setProcessingId(clientId);
        setMessage({ text: '', type: '' });
        try {
        const { error } = await supabase
            .from('client_profile')
            .update({
            approval_status: action,
            approved_by: 'Admin',
            approved_date: new Date().toISOString().split('T')[0],
            })
            .eq('id', clientId);
        if (error) throw error;
        setMessage({ text: `✅ Client ${action} successfully!`, type: 'success' });
        setNotes('');
        setModal(null);
        setTimeout(fetchClients, 1000);
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
            <h1 className="text-xl font-bold text-slate-900">Approvals Management</h1>
            <p className="text-sm text-slate-500 mt-0.5">Review and manage client profile submissions</p>
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
                placeholder="Search ID, business, contact…"
                className="w-full py-2 pr-3 text-sm border rounded-lg pl-9 border-slate-200 focus:border-blue-500 focus:outline-none"
                />
            </div>
            <select value={accountFilter} onChange={e => setAccountFilter(e.target.value)}
                className="px-3 py-2 text-sm bg-white border rounded-lg cursor-pointer border-slate-200 focus:border-blue-500 focus:outline-none">
                <option value="">All Accounts</option>
                {accounts.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <select
  value={approvalStatusFilter}
  onChange={e => setApprovalStatusFilter(e.target.value)}
  className="px-3 py-2 text-sm bg-white border rounded-lg cursor-pointer border-slate-200 focus:border-blue-500 focus:outline-none"
>
  <option value="">All Status</option>
  <option value="pending">Pending</option>
  <option value="approved">Approved</option>
  <option value="rejected">Rejected</option>
</select>
            <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>From</span>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="px-3 py-2 text-sm border rounded-lg border-slate-200 focus:border-blue-500 focus:outline-none" />
                <span>to</span>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className="px-3 py-2 text-sm border rounded-lg border-slate-200 focus:border-blue-500 focus:outline-none" />
            </div>
            <button
                onClick={() => { const t = new Date().toISOString().split('T')[0]; setDateFrom(t); setDateTo(t); }}
                className="px-3 py-2 text-xs font-semibold transition bg-white border rounded-lg border-slate-200 hover:bg-slate-100 text-slate-600">
                Today
            </button>
            {(search || accountFilter || dateFrom || dateTo) && (
                <button onClick={() => { setSearch(''); setAccountFilter(''); setApprovalStatusFilter(''); setDateFrom(''); setDateTo(''); }}
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
                    <tr className="text-left text-white bg-blue-600">
                    {['Client ID','Business Name','Account','Created At', 'Coverage Date','Contact Person','Status','Approved Date','Action'].map(h => (
                        <th key={h} className="px-4 py-3.5 font-semibold text-xs uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {loading ? (
                    <tr><td colSpan={8} className="py-16 text-sm text-center text-slate-400">Loading…</td></tr>
                    ) : paginated.length === 0 ? (
                    <tr><td colSpan={8} className="py-16 text-sm text-center text-slate-400">No records found.</td></tr>
                    ) : paginated.map(client => (
                    <tr key={client.id} className="transition hover:bg-slate-50">
                        <td className="px-4 py-3.5">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-blue-600 text-white whitespace-nowrap">
                            {client.client_id}
                        </span>
                        </td>
                        <td className="px-4 py-3.5 font-medium text-slate-800 max-w-[200px] truncate">{client.business_name || '—'}</td>
                        <td className="px-4 py-3.5 text-slate-600">{client.account || '—'}</td>
                        <td className="px-4 py-3.5 text-slate-500 whitespace-nowrap">{fmtDate(client.created_at)}</td>
                        <td className="px-4 py-3.5 text-slate-500 whitespace-nowrap">{fmtDate(client.date_of_coverage)}</td>
                        <td className="px-4 py-3.5 text-slate-600 uppercase text-xs font-medium">{client.contact_person || '—'}</td>
                        <td className="px-4 py-3.5 text-slate-600 uppercase text-xs font-medium">{client.status || '—'}</td>
                        <td className="px-4 py-3.5 text-slate-500 whitespace-nowrap">{fmtDate(client.approved_date)}</td>
                        <td className="px-4 py-3.5 text-center">
                        <button
                            onClick={() => { setModal(client); setNotes(''); setMessage({ text: '', type: '' }); }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition whitespace-nowrap"
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
                className="px-4 py-2 font-medium text-white transition bg-blue-600 border border-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40">
                Next
            </button>
            </div>
        </div>

        {/* Modal */}
        {modal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setModal(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>

                {/* Modal Header */}
                <div className="flex items-start justify-between px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-t-2xl">
                <div>
                    <p className="text-xs font-bold tracking-widest text-blue-100 uppercase">Client Profile</p>
                    <h2 className="text-white font-bold text-lg leading-tight mt-0.5">{modal.business_name || 'N/A'}</h2>
                    <p className="text-blue-200 text-xs mt-0.5">{modal.client_id}</p>
                </div>
                <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize border ${BADGE[modal.approval_status?.toLowerCase()] || BADGE.pending}`}>
                    {modal.approval_status}
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

                <Section title="Basic Info">
                    <Detail label="Date of Coverage"  value={fmtDate(modal.date_of_coverage)} /> 
                    <Detail label="Month of Coverage" value={fmtDate(modal.month_of_coverage)} /> 
                    <Detail label="Account"           value={modal.account} />
                    <Detail label="Trade Name"        value={modal.trade_name} />
                    <Detail label="Entity Type"       value={modal.entity_type} />
                    <Detail label="Line of Business"  value={modal.line_of_business} />
                    <Detail label="Tax Type"          value={modal.tax_type} />
                    <Detail label="Business Reg."     value={modal.business_registration} />
                    <Detail label="Source of Income"  value={modal.source_of_income} />
                    <Detail label="Taxpayer Class."   value={modal.tax_payer_classification} />
                </Section>

                <Section title="Tax & Registration">
                    <Detail label="TIN"                   value={modal.tin} />
                    <Detail label="SEC No."               value={modal.sec_registration_no} />
                    <Detail label="DTI Registration"      value={modal.dti_registration} />
                    <Detail label="Reg. Numbers"          value={modal.business_registration_numbers} />
                    <Detail label="SSS Employer No."      value={modal.sss_employer_no} />
                    <Detail label="PHIC Employer No."     value={modal.phic_employer_no} />
                    <Detail label="HDMF Employer No."     value={modal.hdmf_employer_no} />
                    <Detail label="Date of Incorporation" value={fmtDate(modal.date_of_incorporation)} />
                    <Detail label="Date of Expiration"    value={fmtDate(modal.date_of_expiration)} />
                </Section>

                <Section title="Address">
                    <Detail label="Registered Address" value={modal.registered_business_address} />
                    <Detail label="RDO"                value={modal.rdo} />
                    <Detail label="District"           value={modal.district} />
                    <Detail label="Zip Code"           value={modal.zip_code} />
                    <Detail label="Renting"            value={modal.renting} />
                    {modal.renting === 'Yes' && <Detail label="VAT Type" value={modal.renting_vat_type} />}
                </Section>

                <Section title="Contact">
                    <Detail label="Contact Person"  value={modal.contact_person} />
                    <Detail label="Designation"     value={modal.designation} />
                    <Detail label="Email"           value={modal.email_address} />
                    <Detail label="Contact No."     value={modal.contact_number} />
                    <Detail label="Office No."      value={modal.official_office_contact_number} />
                </Section>

                {modal.entity_type === 'Sole Proprietor' && (
                    <Section title="Owner Details">
                    <Detail label="Father's Name"   value={modal.fathers_name} />
                    <Detail label="Mother's Maiden" value={modal.mothers_maiden_name} />
                    <Detail label="Marital Status"  value={modal.marital_status} />
                    <Detail label="Date of Birth"   value={fmtDate(modal.date_of_birth)} />
                    <Detail label="Citizenship"     value={modal.citizenship} />
                    <Detail label="Gender"          value={modal.gender} />
                    <Detail label="Personal Email"  value={modal.personal_email_address} />
                    <Detail label="Present Address" value={modal.present_home_address} />
                    <Detail label="Permanent Addr." value={modal.permanent_home_address} />
                    </Section>
                )}

                {/* Actions */}
                {(!modal.approval_status || modal.approval_status?.toLowerCase() === 'pending') ? (
                    <div className="pt-4 border-t border-slate-100">
                    <label className="block mb-2 text-xs font-bold tracking-widest uppercase text-slate-400">
                        Notes <span className="font-normal text-red-400 normal-case">(required for rejection)</span>
                    </label>
                    <textarea
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        placeholder="Add notes here…"
                        rows={2}
                        className="w-full px-3 py-2.5 text-sm border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none resize-none mb-4"
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
                    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
                    modal.approval_status?.toLowerCase() === 'approved'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        : 'bg-red-50 border-red-200 text-red-600'
                    }`}>
                    {modal.approval_status?.toLowerCase() === 'approved' ? <FaCheck size={12} /> : <FaTimes size={12} />}
                   <p className="text-sm font-medium capitalize">
                        {modal.approval_status} by {modal.approved_by || '—'} on {modal.approved_date ? fmtDate(modal.approved_date) : '—'}
                    </p>
                    </div>
                )}
                </div>
            </div>
            </div>
        )}
        </div>
    );
    }

    const Section = ({ title, children }) => (
    <div>
        <p className="pb-2 mb-3 text-xs font-bold tracking-widest uppercase border-b text-slate-400 border-slate-100">{title}</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3">{children}</div>
    </div>
    );