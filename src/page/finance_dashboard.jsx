import React, { useState, useEffect } from 'react';
import {
  FaFileInvoiceDollar, FaMoneyBillWave, FaBell, FaIdCard,
  FaExclamationTriangle, FaCheckCircle, FaClock, FaChevronRight,
  FaArrowUp, FaArrowDown, FaEllipsisH, FaSearch, FaFilter,
  FaCalendarAlt, FaBuilding, FaPhoneAlt, FaEnvelope
} from 'react-icons/fa';
import { supabase } from '../lib/supabaseClient';

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const fmtPeso = (n) =>
  '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
};

const daysUntil = (d) => {
  if (!d) return null;
  const diff = new Date(d) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

const urgencyColor = (days) => {
  if (days === null) return 'text-slate-400';
  if (days < 0)  return 'text-red-600';
  if (days <= 7)  return 'text-red-500';
  if (days <= 30) return 'text-amber-500';
  return 'text-emerald-500';
};

const urgencyBg = (days) => {
  if (days === null) return 'bg-slate-100 text-slate-500';
  if (days < 0)  return 'bg-red-100 text-red-700';
  if (days <= 7)  return 'bg-red-50 text-red-600';
  if (days <= 30) return 'bg-amber-50 text-amber-600';
  return 'bg-emerald-50 text-emerald-600';
};

// ─── STAT CARD ────────────────────────────────────────────────────────────────
const StatCard = ({ icon: Icon, label, value, sub, accent, trend, trendVal }) => (
  <div className={`bg-white rounded-2xl border border-slate-200 p-5 relative overflow-hidden shadow-sm hover:shadow-md transition-shadow`}>
    <div className={`absolute top-0 right-0 w-24 h-24 rounded-full opacity-5 -translate-y-6 translate-x-6 ${accent}`} />
    <div className="flex items-start justify-between mb-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${accent} bg-opacity-10`}>
        <Icon size={17} className={accent.replace('bg-', 'text-')} />
      </div>
      {trend !== undefined && (
        <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${trend >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
          {trend >= 0 ? <FaArrowUp size={9} /> : <FaArrowDown size={9} />}
          {Math.abs(trendVal)}%
        </div>
      )}
    </div>
    <p className="text-2xl font-bold text-slate-800 mb-0.5">{value}</p>
    <p className="text-xs font-semibold tracking-wide uppercase text-slate-500">{label}</p>
    {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
  </div>
);

// ─── SECTION HEADER ───────────────────────────────────────────────────────────
const SectionHeader = ({ icon: Icon, title, count, accent, action, onAction }) => (
  <div className="flex items-center justify-between mb-4">
    <div className="flex items-center gap-2.5">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${accent}`}>
        <Icon size={14} className="text-white" />
      </div>
      <h2 className="text-base font-bold text-slate-800">{title}</h2>
      {count !== undefined && (
        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">{count}</span>
      )}
    </div>
    {action && (
      <button onClick={onAction} className="flex items-center gap-1 text-xs font-semibold text-blue-600 transition hover:text-blue-700">
        {action} <FaChevronRight size={9} />
      </button>
    )}
  </div>
);

// ─── EMPTY STATE ──────────────────────────────────────────────────────────────
const Empty = ({ label }) => (
  <div className="py-8 text-center text-slate-400">
    <p className="text-sm">{label}</p>
  </div>
);

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function FinanceDashboard({ currentUser, onNavigate }) {
  const [billing, setBilling]         = useState([]);
  const [fundRequests, setFundReqs]   = useState([]);
  const [followUps, setFollowUps]     = useState([]);
  const [permits, setPermits]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [permitFilter, setPermitFilter] = useState('all'); // all | expiring | expired
  const [search, setSearch]           = useState('');

  // ── Fetch data ───────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [bilRes, frRes, fuRes, pmRes] = await Promise.all([
          supabase.from('billing').select('*').order('created_at', { ascending: false }).limit(10),
          supabase.from('fund_requests').select('*').order('created_at', { ascending: false }).limit(10),
          supabase.from('follow_ups').select('*').order('follow_up_date', { ascending: true }).limit(10),
          supabase.from('client_profile').select('id,client_id,business_name,date_of_expiration,business_registration,account').not('date_of_expiration', 'is', null).order('date_of_expiration', { ascending: true }).limit(50),
        ]);
        if (bilRes.data)  setBilling(bilRes.data);
        if (frRes.data)   setFundReqs(frRes.data);
        if (fuRes.data)   setFollowUps(fuRes.data);
        if (pmRes.data)   setPermits(pmRes.data);
      } catch (e) {
        console.error('Dashboard fetch error:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  // ── Derived ──────────────────────────────────────────────────────────────
  const totalBilled   = billing.reduce((s, b) => s + Number(b.amount || 0), 0);
  const pendingBilling = billing.filter(b => b.status === 'pending').length;
  const pendingFR     = fundRequests.filter(f => f.status === 'pending').length;
  const overdueFollowUps = followUps.filter(f => daysUntil(f.follow_up_date) < 0).length;

  const filteredPermits = permits.filter(p => {
    const days = daysUntil(p.date_of_expiration);
    if (permitFilter === 'expired')  return days !== null && days < 0;
    if (permitFilter === 'expiring') return days !== null && days >= 0 && days <= 30;
    return true;
  }).filter(p => !search || (p.business_name || '').toLowerCase().includes(search.toLowerCase()));

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <div className="w-10 h-10 mx-auto mb-3 border-2 border-blue-600 rounded-full border-t-transparent animate-spin" />
        <p className="text-sm text-slate-500">Loading dashboard...</p>
      </div>
    </div>
  );

  return (
    <div className="max-w-screen-xl px-6 py-2 mx-auto space-y-6">

      {/* ── TOP GREETING ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold leading-tight text-slate-900">
            Finance Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {new Date().toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            {currentUser && <span className="ml-2 text-blue-500">· {currentUser.fullName || currentUser.username}</span>}
          </p>
        </div>
      </div>

      {/* ── STAT CARDS ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={FaFileInvoiceDollar}
          label="Total Billed"
          value={fmtPeso(totalBilled)}
          sub={`${billing.length} billing records`}
          accent="bg-blue-500"
          trend={1} trendVal={8.2}
        />
        <StatCard
          icon={FaMoneyBillWave}
          label="Fund Requests"
          value={pendingFR}
          sub="pending approval"
          accent="bg-violet-500"
        />
        <StatCard
          icon={FaBell}
          label="Follow-ups Due"
          value={overdueFollowUps}
          sub="overdue items"
          accent="bg-amber-500"
        />
        <StatCard
          icon={FaIdCard}
          label="Expiring Permits"
          value={permits.filter(p => { const d = daysUntil(p.date_of_expiration); return d !== null && d >= 0 && d <= 30; }).length}
          sub="within 30 days"
          accent="bg-red-500"
        />
      </div>

      {/* ── ROW 1: Billing + Fund Requests ── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">

        {/* BILLING */}
        <div className="p-5 bg-white border shadow-sm rounded-2xl border-slate-200">
          <SectionHeader
            icon={FaFileInvoiceDollar}
            title="Billing"
            count={billing.length}
            accent="bg-blue-500"
            action="View All"
            onAction={() => onNavigate?.('CreateBilling')}
          />
          <div className="pr-1 space-y-2 overflow-y-auto max-h-72">
            {billing.length === 0 ? <Empty label="No billing records" /> : billing.map((b, i) => (
              <div key={b.id || i} className="flex items-center justify-between p-3 transition border border-transparent rounded-xl hover:bg-slate-50 hover:border-slate-100 group">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate text-slate-800">{b.client_name || b.business_name || `Billing #${b.id}`}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{fmtDate(b.billing_date || b.created_at)}</p>
                </div>
                <div className="flex items-center gap-2 ml-3 shrink-0">
                  <span className="text-sm font-bold text-slate-800">{fmtPeso(b.amount)}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                    b.status === 'paid'    ? 'bg-emerald-100 text-emerald-700' :
                    b.status === 'overdue' ? 'bg-red-100 text-red-600' :
                    'bg-amber-100 text-amber-600'
                  }`}>
                    {b.status || 'pending'}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Mini totals */}
          <div className="grid grid-cols-3 gap-2 pt-3 mt-3 border-t border-slate-100">
            {[
              { label: 'Paid',    val: billing.filter(b => b.status === 'paid').length,    cls: 'text-emerald-600' },
              { label: 'Pending', val: pendingBilling, cls: 'text-amber-600' },
              { label: 'Overdue', val: billing.filter(b => b.status === 'overdue').length, cls: 'text-red-500' },
            ].map(s => (
              <div key={s.label} className="text-center">
                <p className={`text-lg font-bold ${s.cls}`}>{s.val}</p>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* FUND REQUESTS */}
        <div className="p-5 bg-white border shadow-sm rounded-2xl border-slate-200">
          <SectionHeader
            icon={FaMoneyBillWave}
            title="Fund Requests"
            count={fundRequests.length}
            accent="bg-violet-500"
          />
          <div className="pr-1 space-y-2 overflow-y-auto max-h-72">
            {fundRequests.length === 0 ? <Empty label="No fund requests" /> : fundRequests.map((f, i) => (
              <div key={f.id || i} className="flex items-start gap-3 p-3 transition border border-transparent rounded-xl hover:bg-slate-50 hover:border-slate-100">
                <div className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  f.status === 'approved' ? 'bg-emerald-100' :
                  f.status === 'rejected' ? 'bg-red-100' : 'bg-violet-100'
                }`}>
                  {f.status === 'approved' ? <FaCheckCircle size={13} className="text-emerald-600" /> :
                   f.status === 'rejected' ? <FaExclamationTriangle size={13} className="text-red-500" /> :
                   <FaClock size={13} className="text-violet-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate text-slate-800">{f.title || f.description || `Request #${f.id}`}</p>
                  <p className="text-xs text-slate-400">{f.requested_by || '—'} · {fmtDate(f.created_at)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-slate-800">{fmtPeso(f.amount)}</p>
                  <span className={`text-[10px] font-bold capitalize ${
                    f.status === 'approved' ? 'text-emerald-600' :
                    f.status === 'rejected' ? 'text-red-500' : 'text-violet-500'
                  }`}>
                    {f.status || 'pending'}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2 pt-3 mt-3 border-t border-slate-100">
            {[
              { label: 'Approved', val: fundRequests.filter(f => f.status === 'approved').length, cls: 'text-emerald-600' },
              { label: 'Pending',  val: pendingFR, cls: 'text-violet-500' },
              { label: 'Rejected', val: fundRequests.filter(f => f.status === 'rejected').length, cls: 'text-red-500' },
            ].map(s => (
              <div key={s.label} className="text-center">
                <p className={`text-lg font-bold ${s.cls}`}>{s.val}</p>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── ROW 2: Follow-ups + Permits Expiration ── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">

        {/* FOLLOW-UPS */}
        <div className="p-5 bg-white border shadow-sm rounded-2xl border-slate-200">
          <SectionHeader
            icon={FaBell}
            title="Follow Ups"
            count={followUps.length}
            accent="bg-amber-500"
          />
          <div className="pr-1 space-y-2 overflow-y-auto max-h-80">
            {followUps.length === 0 ? <Empty label="No follow-ups scheduled" /> : followUps.map((f, i) => {
              const days = daysUntil(f.follow_up_date);
              return (
                <div key={f.id || i} className="flex items-start gap-3 p-3 transition border border-transparent rounded-xl hover:bg-slate-50 hover:border-slate-100">
                  {/* Day indicator */}
                  <div className={`shrink-0 w-10 h-10 rounded-xl flex flex-col items-center justify-center text-center ${
                    days === null ? 'bg-slate-100' :
                    days < 0     ? 'bg-red-100' :
                    days <= 7    ? 'bg-amber-100' : 'bg-blue-50'
                  }`}>
                    {days !== null ? (
                      <>
                        <span className={`text-[10px] font-bold leading-none ${urgencyColor(days)}`}>
                          {days < 0 ? 'OVER' : days === 0 ? 'TODAY' : `${days}d`}
                        </span>
                      </>
                    ) : <FaCalendarAlt size={13} className="text-slate-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate text-slate-800">{f.client_name || f.title || `Follow-up #${f.id}`}</p>
                    <p className="text-xs text-slate-500 truncate mt-0.5">{f.notes || f.description || '—'}</p>
                    <div className="flex items-center gap-3 mt-1">
                      {f.contact_person && (
                        <span className="flex items-center gap-1 text-[10px] text-slate-400">
                          <FaPhoneAlt size={8} /> {f.contact_person}
                        </span>
                      )}
                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                        <FaCalendarAlt size={8} /> {fmtDate(f.follow_up_date)}
                      </span>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full shrink-0 ${urgencyBg(days)}`}>
                    {days === null ? 'No date' : days < 0 ? 'Overdue' : days === 0 ? 'Today' : 'Upcoming'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* PERMITS EXPIRATION */}
        <div className="p-5 bg-white border shadow-sm rounded-2xl border-slate-200">
          <SectionHeader
            icon={FaIdCard}
            title="Permits Expiration"
            count={filteredPermits.length}
            accent="bg-red-500"
          />

          {/* Filter + Search */}
          <div className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <FaSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={10} />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search client..."
                className="w-full pl-7 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400"
              />
            </div>
            <div className="flex gap-1 p-0.5 bg-slate-100 rounded-lg">
              {[
                { val: 'all',      label: 'All' },
                { val: 'expiring', label: '≤30d' },
                { val: 'expired',  label: 'Expired' },
              ].map(f => (
                <button
                  key={f.val}
                  onClick={() => setPermitFilter(f.val)}
                  className={`px-2.5 py-1 text-[10px] font-semibold rounded-md transition ${
                    permitFilter === f.val ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="pr-1 space-y-2 overflow-y-auto max-h-64">
            {filteredPermits.length === 0 ? <Empty label="No permits to show" /> : filteredPermits.map((p, i) => {
              const days = daysUntil(p.date_of_expiration);
              return (
                <div key={p.id || i} className="flex items-center gap-3 p-3 transition border border-transparent rounded-xl hover:bg-slate-50 hover:border-slate-100">
                  <div className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${
                    days < 0 ? 'bg-red-100' : days <= 7 ? 'bg-red-50' : days <= 30 ? 'bg-amber-50' : 'bg-emerald-50'
                  }`}>
                    <FaIdCard size={13} className={urgencyColor(days)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate text-slate-800">{p.business_name || p.client_id}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {p.account && (
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                          p.account === 'Summit' ? 'bg-sky-100 text-sky-700' : 'bg-violet-100 text-violet-700'
                        }`}>{p.account}</span>
                      )}
                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                        <FaCalendarAlt size={8} /> {fmtDate(p.date_of_expiration)}
                      </span>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full shrink-0 ${urgencyBg(days)}`}>
                    {days < 0
                      ? `${Math.abs(days)}d ago`
                      : days === 0 ? 'Today'
                      : `${days}d left`}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 pt-3 mt-3 border-t border-slate-100">
            {[
              { dot: 'bg-red-500',   label: 'Expired' },
              { dot: 'bg-amber-400', label: '≤30 days' },
              { dot: 'bg-emerald-500', label: 'OK' },
            ].map(l => (
              <div key={l.label} className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${l.dot}`} />
                <span className="text-[10px] text-slate-500">{l.label}</span>
              </div>
            ))}
            <span className="ml-auto text-[10px] text-slate-400">
              {permits.filter(p => daysUntil(p.date_of_expiration) < 0).length} expired ·{' '}
              {permits.filter(p => { const d = daysUntil(p.date_of_expiration); return d !== null && d >= 0 && d <= 30; }).length} expiring soon
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}