import React, { useState, useEffect } from 'react';
import {
  FaFileInvoiceDollar, FaMoneyBillWave, FaBell, FaIdCard,
  FaExclamationTriangle, FaCheckCircle, FaClock, FaChevronRight,
  FaSearch, FaCalendarAlt, FaPhoneAlt, FaArrowUp, FaArrowDown,
  FaChevronLeft, FaTimes
} from 'react-icons/fa';
import { supabase } from '../lib/supabaseClient';
import { getDataScope } from '../Maintenance/role_permission';

// ─── PALETTE — deep teal (dark/primary) + mint green (accent/positive) only.
// Red is used sparingly, inline-text-only, for overdue/negative deltas — matching
// the reference: everything else stays teal/mint/neutral. ──────────────────────
const TEAL_DARK   = '#0d3b3b';   // hero card background, dark icon chips
const TEAL_DEEPER = '#0a2f2f';   // gradient end for hero card
const MINT        = '#22c55e';   // bright accent — positive, buttons, success pill
const MINT_SOFT   = '#e9f9ef';   // soft mint background for chips/pills
const RED_TEXT    = '#dc2626';   // negative delta / overdue — text only, no big blocks

// ─── DATA SCOPE ───────────────────────────────────────────────────────────────
// Columns na nagsasabi kung kanino ang record (para sa "Own only" scope).
// I-adjust kung iba ang pangalan ng columns sa database mo.
const OWNER_COLS = {
  billing_statements: ['created_by', 'approved_by'],
  fund_requests:      ['requested_by', 'approved_by'],
  follow_ups:         ['created_by'],
  client_profile:     ['created_by', 'approved_by'],
};

// Kapag scope === 'own', limitahan sa records na isinumite/na-approve ng user.
const applyScope = (query, table, scope, name) => {
  if (scope !== 'own') return query;
  const safe = String(name || '').replace(/"/g, '\\"');
  return query.or(OWNER_COLS[table].map((c) => `${c}.eq."${safe}"`).join(','));
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const fmtPeso = (n) =>
  '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d) => {
  if (!d) return '—';
  // "YYYY-MM-DD" lang → i-parse bilang local para walang timezone shift
  const s = String(d);
  const date = s.length === 10 ? new Date(s + 'T00:00:00') : new Date(d);
  return date.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
};

const daysUntil = (d) => {
  if (!d) return null;
  const diff = new Date(d) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

// ── Billing summary — built from billing_statements + billing_items + official_receipts,
// same convention as ReceivablesList.jsx (computed status, not a raw column) ──
function isPastDue(dueDate) {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date(new Date().toDateString());
}
function computeBillingStatus(charge, paid, dueDate) {
  const balance = Math.max(0, charge - paid);
  if (balance <= 0.005) return 'paid';
  if (paid > 0.005) return 'partial';
  if (isPastDue(dueDate)) return 'overdue';
  return 'unpaid';
}
function clientDisplayName(c) {
  if (!c) return 'Unknown client';
  return (
    c.business_name ||
    c.trade_name ||
    [c.first_name, c.middle_name, c.last_name].filter(Boolean).join(' ') ||
    'Unknown client'
  );
}

async function fetchBillingSummary(scope, ownerName) {
  let stQuery = supabase
    .from('billing_statements')
    .select('id, soa_number, client_id, soa_date, due_date, status')
    .not('status', 'in', '(draft,pending_approval)')
    .order('soa_date', { ascending: false });
  stQuery = applyScope(stQuery, 'billing_statements', scope, ownerName);

  const { data: statements, error: stErr } = await stQuery;
  if (stErr) throw stErr;

  const billingIds = (statements || []).map((s) => s.id);
  const clientIds = [...new Set((statements || []).map((s) => s.client_id))];

  let chargeTotals = {};
  if (billingIds.length > 0) {
    const { data: items, error: itErr } = await supabase
      .from('billing_items')
      .select('billing_id, amount')
      .in('billing_id', billingIds);
    if (itErr) throw itErr;
    (items || []).forEach((i) => {
      chargeTotals[i.billing_id] = (chargeTotals[i.billing_id] || 0) + (Number(i.amount) || 0);
    });
  }

  let paidTotals = {};
  if (billingIds.length > 0) {
    const { data: receipts, error: orErr } = await supabase
      .from('official_receipts')
      .select('billing_id, amount')
      .in('billing_id', billingIds);
    if (orErr) throw orErr;
    (receipts || []).forEach((r) => {
      if (!r.billing_id) return;
      paidTotals[r.billing_id] = (paidTotals[r.billing_id] || 0) + (Number(r.amount) || 0);
    });
  }

  let clientMap = {};
  if (clientIds.length > 0) {
    const { data: clients } = await supabase
      .from('client_profile')
      .select('client_id, business_name, trade_name, first_name, middle_name, last_name')
      .in('client_id', clientIds);
    (clients || []).forEach((c) => { clientMap[c.client_id] = c; });
  }

  return (statements || []).map((s) => {
    const charge = chargeTotals[s.id] || 0;
    const paid = paidTotals[s.id] || 0;
    return {
      id: s.id,
      soa_number: s.soa_number,
      client_name: clientDisplayName(clientMap[s.client_id]),
      billing_date: s.soa_date,
      due_date: s.due_date,
      amount: charge,
      paid,
      status: computeBillingStatus(charge, paid, s.due_date),
    };
  });
}

// ─── STATUS PILL — soft mint for good states, soft neutral for pending, red text-only for alerts ──
const StatusPill = ({ status }) => {
  const map = {
    paid:     { bg: MINT_SOFT, color: '#15803d', label: 'Paid' },
    partial:  { bg: '#eef2f7', color: '#475569', label: 'Partial' },
    unpaid:   { bg: '#eef2f7', color: '#475569', label: 'Unpaid' },
    overdue:  { bg: '#fdecec', color: RED_TEXT,  label: 'Overdue' },
    approved: { bg: MINT_SOFT, color: '#15803d', label: 'Approved' },
    pending:  { bg: '#eef2f7', color: '#475569', label: 'Pending' },
    rejected: { bg: '#fdecec', color: RED_TEXT,  label: 'Rejected' },
  };
  const m = map[status] || map.pending;
  return (
    <span
      className="text-[10px] font-bold px-2.5 py-1 rounded-full capitalize"
      style={{ background: m.bg, color: m.color }}
    >
      {m.label}
    </span>
  );
};

// ─── COMPACT STAT CARD — white, minimal, small delta text like the reference mini-cards ──
const StatCard = ({ icon: Icon, label, value, sub, deltaLabel, deltaPositive }) => (
  <div className="p-5 bg-white border shadow-sm rounded-2xl border-slate-100">
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center justify-center w-9 h-9 rounded-xl" style={{ background: MINT_SOFT }}>
        <Icon size={14} style={{ color: TEAL_DARK }} />
      </div>
      {deltaLabel && (
        <span
          className="flex items-center gap-1 text-[11px] font-semibold"
          style={{ color: deltaPositive ? MINT : RED_TEXT }}
        >
          {deltaPositive ? <FaArrowUp size={8} /> : <FaArrowDown size={8} />}
          {deltaLabel}
        </span>
      )}
    </div>
    <p className="text-xl font-bold text-slate-800">{value}</p>
    <p className="mt-1 text-xs font-medium text-slate-400">{label}{sub ? ` · ${sub}` : ''}</p>
  </div>
);

// ─── SECTION HEADER ───────────────────────────────────────────────────────────
const SectionHeader = ({ icon: Icon, title, count, action, onAction }) => (
  <div className="flex items-center justify-between mb-4">
    <div className="flex items-center gap-2.5">
      <div className="flex items-center justify-center w-8 h-8 rounded-lg" style={{ background: TEAL_DARK }}>
        <Icon size={13} className="text-white" />
      </div>
      <h2 className="text-base font-bold text-slate-800">{title}</h2>
      {count !== undefined && (
        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">{count}</span>
      )}
    </div>
    {action && (
      <button onClick={onAction} className="flex items-center gap-1 text-xs font-semibold transition hover:opacity-70" style={{ color: TEAL_DARK }}>
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

// ─── TASK CALENDAR ────────────────────────────────────────────────────────────
const TASK_STATUS = {
  pending:     { label: 'Pending',     color: '#d97706' },
  in_progress: { label: 'In Progress', color: '#2563eb' },
  for_review:  { label: 'For Review',  color: '#7c3aed' },
  done:        { label: 'Done',        color: '#15803d' },
};
const TASK_TYPE_LABEL = {
  create_billing: 'Create Billing',
  record_payment: 'Record Payment',
  undeposited_funds: 'Undeposited Funds',
  other: 'Other',
};
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const WEEKDAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const pad = (n) => String(n).padStart(2, '0');
const toKey = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;

const DetailRow = ({ label, children }) => (
  <div>
    <p className="text-[10px] font-semibold tracking-wide uppercase text-slate-400">{label}</p>
    <div className="text-sm text-slate-800 mt-0.5">{children}</div>
  </div>
);

function TaskCalendar({ tasks, onNavigate }) {
  const now = new Date();
  const todayKey = toKey(now.getFullYear(), now.getMonth(), now.getDate());
  const [cursor, setCursor]     = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [selected, setSelected] = useState(todayKey);
  const [detail, setDetail]     = useState(null);

  // tasks grouped by due date
  const byDate = {};
  tasks.forEach((t) => {
    if (!t.due_date) return;
    const k = String(t.due_date).slice(0, 10);
    (byDate[k] ||= []).push(t);
  });

  const firstDay    = new Date(cursor.y, cursor.m, 1).getDay();
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const cells = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const prevMonth = () => setCursor(({ y, m }) => (m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 }));
  const nextMonth = () => setCursor(({ y, m }) => (m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 }));
  const goToday = () => {
    setCursor({ y: now.getFullYear(), m: now.getMonth() });
    setSelected(todayKey);
  };

  const isOverdue = (t) =>
    t.status !== 'done' && t.due_date && String(t.due_date).slice(0, 10) < todayKey;

  const chipColor = (t) => (isOverdue(t) ? RED_TEXT : (TASK_STATUS[t.status]?.color || '#475569'));

  const selectedTasks = byDate[selected] || [];

  return (
    <div className="p-5 bg-white border shadow-sm rounded-2xl border-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg" style={{ background: TEAL_DARK }}>
            <FaCalendarAlt size={13} className="text-white" />
          </div>
          <h2 className="text-base font-bold text-slate-800">Task Calendar</h2>
          <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-slate-100 text-slate-500">{tasks.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={goToday} className="px-3 py-1.5 text-[11px] font-semibold border rounded-lg border-slate-200 text-slate-600 hover:bg-slate-50">
            Today
          </button>
          <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"><FaChevronLeft size={11} /></button>
          <span className="w-36 text-sm font-semibold text-center text-slate-800">{MONTHS[cursor.m]} {cursor.y}</span>
          <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"><FaChevronRight size={11} /></button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Month grid */}
        <div className="lg:col-span-2">
          <div className="grid grid-cols-7 mb-1">
            {WEEKDAYS.map((w) => (
              <div key={w} className="py-1 text-[10px] font-semibold text-center uppercase text-slate-400">{w}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, i) => {
              if (!day) return <div key={`b${i}`} />;
              const key = toKey(cursor.y, cursor.m, day);
              const list = byDate[key] || [];
              const isToday = key === todayKey;
              const isSel = key === selected;
              return (
                <button
                  key={key}
                  onClick={() => setSelected(key)}
                  className="min-h-[72px] p-1.5 text-left transition border rounded-lg hover:bg-slate-50"
                  style={{
                    borderColor: isSel ? TEAL_DARK : '#f1f5f9',
                    background: isSel ? MINT_SOFT : '#fff',
                  }}
                >
                  <span
                    className="inline-flex items-center justify-center text-[11px] font-semibold rounded-full w-5 h-5"
                    style={isToday ? { background: TEAL_DARK, color: '#fff' } : { color: '#475569' }}
                  >
                    {day}
                  </span>
                  <div className="mt-1 space-y-0.5">
                    {list.slice(0, 2).map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center gap-1 text-[9px] truncate"
                        style={{ color: chipColor(t) }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: chipColor(t) }} />
                        <span className="truncate">{t.title}</span>
                      </div>
                    ))}
                    {list.length > 2 && (
                      <div className="text-[9px] font-semibold text-slate-400">+{list.length - 2} more</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 mt-3">
            {Object.entries(TASK_STATUS).map(([k, v]) => (
              <div key={k} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ background: v.color }} />
                <span className="text-[10px] text-slate-500">{v.label}</span>
              </div>
            ))}
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: RED_TEXT }} />
              <span className="text-[10px] text-slate-500">Overdue</span>
            </div>
          </div>
        </div>

        {/* Selected day list */}
        <div className="pl-0 lg:pl-5 lg:border-l border-slate-100">
          <p className="mb-3 text-xs font-semibold text-slate-500">
            {fmtDate(selected)} · {selectedTasks.length} task{selectedTasks.length !== 1 ? 's' : ''}
          </p>
          <div className="pr-1 space-y-2 overflow-y-auto max-h-80">
            {selectedTasks.length === 0 ? (
              <Empty label="No tasks on this day" />
            ) : selectedTasks.map((t) => {
              const st = TASK_STATUS[t.status] || TASK_STATUS.pending;
              const over = isOverdue(t);
              return (
                <button
                  key={t.id}
                  onClick={() => setDetail(t)}
                  className="w-full p-3 text-left transition border rounded-xl border-slate-100 hover:bg-slate-50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-800">{t.title}</p>
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                      style={{ background: over ? '#fdecec' : '#eef2f7', color: over ? RED_TEXT : st.color }}
                    >
                      {over ? 'Overdue' : st.label}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {TASK_TYPE_LABEL[t.task_type] || 'Task'}
                    {t.target_client_name ? ` · ${t.target_client_name}` : ''}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Task details modal */}
      {detail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={(e) => e.target === e.currentTarget && setDetail(null)}
        >
          <div className="w-full max-w-md bg-white shadow-2xl rounded-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between px-5 pt-5">
              <div>
                <p className="text-[10px] font-semibold tracking-wide uppercase text-slate-400">
                  {TASK_TYPE_LABEL[detail.task_type] || 'Task'}
                </p>
                <h3 className="text-base font-bold text-slate-800">{detail.title}</h3>
              </div>
              <button onClick={() => setDetail(null)} className="p-1.5 text-slate-400 hover:text-slate-600">
                <FaTimes size={14} />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <div className="flex flex-wrap gap-2">
                <span
                  className="text-[11px] font-bold px-2.5 py-1 rounded-full"
                  style={{ background: '#eef2f7', color: TASK_STATUS[detail.status]?.color }}
                >
                  {TASK_STATUS[detail.status]?.label || detail.status}
                </span>
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 capitalize">
                  {detail.priority || 'normal'} priority
                </span>
              </div>

              {detail.target_client_name && <DetailRow label="Client">{detail.target_client_name}</DetailRow>}
              {detail.description && (
                <DetailRow label="Description"><span className="whitespace-pre-line">{detail.description}</span></DetailRow>
              )}

              <div className="grid grid-cols-2 gap-3">
                <DetailRow label="Assigned by">{detail.assigned_by || '—'}</DetailRow>
                <DetailRow label="Assigned to">{detail.assigned_to || '—'}</DetailRow>
                <DetailRow label="Start">{fmtDate(detail.start_date)}</DetailRow>
                <DetailRow label="Due">{fmtDate(detail.due_date)}</DetailRow>
              </div>

              {detail.review_note && detail.status === 'in_progress' && (
                <DetailRow label="Returned note"><span style={{ color: RED_TEXT }}>{detail.review_note}</span></DetailRow>
              )}
              {detail.completed_at && (
                <DetailRow label="Completed">
                  {fmtDate(detail.completed_at)}
                  {detail.completed_ref_id ? ` · Ref #${detail.completed_ref_id}` : ''}
                </DetailRow>
              )}
              {detail.completed_remarks && <DetailRow label="Remarks">{detail.completed_remarks}</DetailRow>}
              {detail.completed_attachment_url && (
                <DetailRow label="Attachment">
                  <a href={detail.completed_attachment_url} target="_blank" rel="noreferrer" className="font-semibold hover:underline" style={{ color: TEAL_DARK }}>
                    📎 {detail.completed_attachment_name || 'View attachment'}
                  </a>
                </DetailRow>
              )}

              <button
                onClick={() => { setDetail(null); onNavigate?.('JobPosting'); }}
                className="w-full py-2.5 mt-2 text-xs font-semibold text-white rounded-lg"
                style={{ background: TEAL_DARK }}
              >
                Open in Job Posting
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function FinanceDashboard({ currentUser, onNavigate }) {
  const [billing, setBilling]         = useState([]); // full computed set, used for totals
  const [fundRequests, setFundReqs]   = useState([]);
  const [followUps, setFollowUps]     = useState([]);
  const [permits, setPermits]         = useState([]);
  const [tasks, setTasks]             = useState([]);
  const [loading, setLoading]         = useState(true);
  const [permitFilter, setPermitFilter] = useState('all'); // all | expiring | expired
  const [search, setSearch]           = useState('');

  // ── Data scope galing sa Role Permissions: 'own' (submitted/approved ko lang) o 'all' ──
  const ownerName = currentUser?.fullName || currentUser?.full_name || '';
  const scope     = getDataScope(currentUser?.role, 'dashboard');

  // ── Fetch data ───────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [billingData, frRes, fuRes, pmRes] = await Promise.all([
          fetchBillingSummary(scope, ownerName),
          applyScope(
            supabase.from('fund_requests').select('*').order('created_at', { ascending: false }).limit(10),
            'fund_requests', scope, ownerName
          ),
          applyScope(
            supabase.from('follow_ups').select('*').order('follow_up_date', { ascending: true }).limit(10),
            'follow_ups', scope, ownerName
          ),
          applyScope(
            supabase.from('client_profile')
              .select('id,client_id,business_name,date_of_expiration,business_registration,account')
              .not('date_of_expiration', 'is', null)
              .order('date_of_expiration', { ascending: true })
              .limit(50),
            'client_profile', scope, ownerName
          ),
        ]);
        setBilling(billingData || []);
        setFundReqs(frRes.data || []);
        setFollowUps(fuRes.data || []);
        setPermits(pmRes.data || []);
      } catch (e) {
        console.error('Dashboard fetch error:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [scope, ownerName]);

  // ── Tasks para sa calendar (naka-assign sa akin o ako ang nag-assign) ──
  useEffect(() => {
    const loadTasks = async () => {
      const myId = currentUser?.id != null ? String(currentUser.id) : '';
      const conds = [];
      if (myId) conds.push(`assigned_to_id.eq."${myId}"`, `assigned_by_id.eq."${myId}"`);
      if (ownerName) conds.push(`assigned_to.eq."${ownerName}"`, `assigned_by.eq."${ownerName}"`);
      if (conds.length === 0) { setTasks([]); return; }

      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .or(conds.join(','))
        .order('due_date', { ascending: true });
      if (error) console.error('Dashboard tasks error:', error);
      setTasks(data || []);
    };
    loadTasks();
  }, [currentUser?.id, ownerName]);

  // ── Derived — billing totals computed over the FULL set, list shows latest 10 ──
  const totalBilled        = billing.reduce((s, b) => s + Number(b.amount || 0), 0);
  const totalCollected     = billing.reduce((s, b) => s + Number(b.paid || 0), 0);
  const paidBillingCount    = billing.filter(b => b.status === 'paid').length;
  const pendingBillingCount = billing.filter(b => b.status === 'unpaid' || b.status === 'partial').length;
  const overdueBillingCount = billing.filter(b => b.status === 'overdue').length;
  const collectionRate = totalBilled > 0.005 ? (totalCollected / totalBilled) * 100 : 0;
  const displayBilling  = billing.slice(0, 8);

  const pendingFR         = fundRequests.filter(f => f.status === 'pending').length;
  const overdueFollowUps  = followUps.filter(f => daysUntil(f.follow_up_date) < 0).length;
  const expiringPermitsCount = permits.filter(p => { const d = daysUntil(p.date_of_expiration); return d !== null && d >= 0 && d <= 30; }).length;

  const filteredPermits = permits.filter(p => {
    const days = daysUntil(p.date_of_expiration);
    if (permitFilter === 'expired')  return days !== null && days < 0;
    if (permitFilter === 'expiring') return days !== null && days >= 0 && days <= 30;
    return true;
  }).filter(p => !search || (p.business_name || '').toLowerCase().includes(search.toLowerCase()));

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <div className="w-10 h-10 mx-auto mb-3 border-2 rounded-full animate-spin" style={{ borderColor: TEAL_DARK, borderTopColor: 'transparent' }} />
        <p className="text-sm text-slate-500">Loading dashboard...</p>
      </div>
    </div>
  );

  return (
    <div className="max-w-screen-xl px-6 py-5 mx-auto space-y-6 bg-slate-50">

      {/* ── TOP GREETING ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold leading-tight text-slate-900">
            Finance Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {new Date().toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            {currentUser && <span className="ml-2" style={{ color: TEAL_DARK }}>· {currentUser.fullName || currentUser.username}</span>}
            {scope === 'own' && <span className="ml-2 text-xs text-slate-400">· Showing my activity only</span>}
          </p>
        </div>
      </div>

      {/* ── HERO CARD — Total Billed, dark teal gradient, mint action button ── */}
      <div
        className="relative p-6 overflow-hidden text-white rounded-2xl"
        style={{ background: `linear-gradient(135deg, ${TEAL_DARK}, ${TEAL_DEEPER})` }}
      >
        <div
          className="absolute rounded-full -right-10 -top-16 w-52 h-52 opacity-10"
          style={{ background: MINT }}
        />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium tracking-wide uppercase text-white/60">Total Billed</p>
            <p className="mt-1 text-3xl font-bold">{fmtPeso(totalBilled)}</p>
            <div className="flex items-center gap-3 mt-2 text-xs text-white/70">
              <span>{billing.length} statements</span>
              <span className="w-1 h-1 rounded-full bg-white/30" />
              <span style={{ color: MINT }}>{collectionRate.toFixed(1)}% collected</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigate?.('RecordPayment')}
              className="px-4 py-2 text-xs font-semibold rounded-lg"
              style={{ background: MINT, color: TEAL_DEEPER }}
            >
              + Record Payment
            </button>
            <button
              onClick={() => onNavigate?.('ReceivablesList')}
              className="px-4 py-2 text-xs font-semibold text-white transition border rounded-lg border-white/20 bg-white/10 hover:bg-white/20"
            >
              View Receivables
            </button>
          </div>
        </div>

        {/* Quick breakdown pills */}
        <div className="relative grid grid-cols-3 gap-3 pt-4 mt-5 border-t border-white/10">
          {[
            { label: 'Paid', val: paidBillingCount },
            { label: 'Pending', val: pendingBillingCount },
            { label: 'Overdue', val: overdueBillingCount },
          ].map((s) => (
            <div key={s.label}>
              <p className="text-lg font-bold" style={{ color: s.label === 'Overdue' ? '#f87171' : s.label === 'Paid' ? MINT : '#fff' }}>
                {s.val}
              </p>
              <p className="text-[10px] uppercase tracking-wide text-white/50 font-semibold">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── STAT CARDS ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard
          icon={FaMoneyBillWave}
          label="Fund Requests"
          value={pendingFR}
          sub="pending approval"
        />
        <StatCard
          icon={FaBell}
          label="Follow-ups"
          value={overdueFollowUps}
          sub="overdue items"
          deltaLabel={overdueFollowUps > 0 ? `${overdueFollowUps} due` : undefined}
          deltaPositive={overdueFollowUps === 0}
        />
        <StatCard
          icon={FaIdCard}
          label="Expiring Permits"
          value={expiringPermitsCount}
          sub="within 30 days"
          deltaLabel={expiringPermitsCount > 0 ? 'needs review' : undefined}
          deltaPositive={expiringPermitsCount === 0}
        />
      </div>

      {/* ── TASK CALENDAR ── */}
      <TaskCalendar tasks={tasks} onNavigate={onNavigate} />

      {/* ── ROW: Billing (Recent Activity style) + Fund Requests ── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">

        {/* BILLING — styled like the "Recent Activity" table in the reference */}
        <div className="p-5 bg-white border shadow-sm rounded-2xl border-slate-100">
          <SectionHeader
            icon={FaFileInvoiceDollar}
            title="Recent Billing"
            count={billing.length}
            action="View All"
            onAction={() => onNavigate?.('ReceivablesList')}
          />

          {displayBilling.length === 0 ? <Empty label="No billing records" /> : (
            <div className="overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-400">
                    <th className="pb-2 font-medium text-left">Client</th>
                    <th className="pb-2 font-medium text-left">Amount</th>
                    <th className="pb-2 font-medium text-left">Status</th>
                    <th className="pb-2 font-medium text-right">Due</th>
                  </tr>
                </thead>
                <tbody>
                  {displayBilling.map((b) => (
                    <tr key={b.id} className="border-t border-slate-50">
                      <td className="py-2.5">
                        <p className="text-sm font-semibold text-slate-800">{b.client_name}</p>
                        <p className="text-[10px] text-slate-400">{b.soa_number}</p>
                      </td>
                      <td className="py-2.5 text-sm font-semibold text-slate-700">{fmtPeso(b.amount)}</td>
                      <td className="py-2.5"><StatusPill status={b.status} /></td>
                      <td className="py-2.5 text-right text-slate-500">{fmtDate(b.due_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* FUND REQUESTS */}
        <div className="p-5 bg-white border shadow-sm rounded-2xl border-slate-100">
          <SectionHeader
            icon={FaMoneyBillWave}
            title="Fund Requests"
            count={fundRequests.length}
          />
          <div className="pr-1 space-y-1 overflow-y-auto max-h-72">
            {fundRequests.length === 0 ? <Empty label="No fund requests" /> : fundRequests.map((f, i) => (
              <div key={f.id || i} className="flex items-start gap-3 p-2.5 transition rounded-xl hover:bg-slate-50">
                <div className="flex items-center justify-center w-8 h-8 mt-0.5 rounded-lg shrink-0" style={{ background: MINT_SOFT }}>
                  {f.status === 'approved' ? <FaCheckCircle size={12} style={{ color: '#15803d' }} /> :
                   f.status === 'rejected' ? <FaExclamationTriangle size={12} style={{ color: RED_TEXT }} /> :
                   <FaClock size={12} style={{ color: TEAL_DARK }} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate text-slate-800">{f.title || f.description || `Request #${f.id}`}</p>
                  <p className="text-xs text-slate-400">{f.requested_by || '—'} · {fmtDate(f.created_at)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-slate-800">{fmtPeso(f.amount)}</p>
                  <StatusPill status={f.status || 'pending'} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── ROW: Follow-ups + Permits Expiration ── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">

        {/* FOLLOW-UPS */}
        <div className="p-5 bg-white border shadow-sm rounded-2xl border-slate-100">
          <SectionHeader
            icon={FaBell}
            title="Follow Ups"
            count={followUps.length}
          />
          <div className="pr-1 space-y-1 overflow-y-auto max-h-80">
            {followUps.length === 0 ? <Empty label="No follow-ups scheduled" /> : followUps.map((f, i) => {
              const days = daysUntil(f.follow_up_date);
              const urgent = days !== null && days <= 0;
              return (
                <div key={f.id || i} className="flex items-start gap-3 p-2.5 transition rounded-xl hover:bg-slate-50">
                  <div
                    className="flex flex-col items-center justify-center w-10 h-10 text-center shrink-0 rounded-xl"
                    style={{ background: urgent ? '#fdecec' : MINT_SOFT }}
                  >
                    {days !== null ? (
                      <span className="text-[10px] font-bold leading-none" style={{ color: urgent ? RED_TEXT : '#15803d' }}>
                        {days < 0 ? 'OVER' : days === 0 ? 'TODAY' : `${days}d`}
                      </span>
                    ) : <FaCalendarAlt size={12} className="text-slate-400" />}
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
                  <span
                    className="text-[10px] font-bold px-2 py-1 rounded-full shrink-0"
                    style={{ background: urgent ? '#fdecec' : '#eef2f7', color: urgent ? RED_TEXT : '#475569' }}
                  >
                    {days === null ? 'No date' : days < 0 ? 'Overdue' : days === 0 ? 'Today' : 'Upcoming'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* PERMITS EXPIRATION */}
        <div className="p-5 bg-white border shadow-sm rounded-2xl border-slate-100">
          <SectionHeader
            icon={FaIdCard}
            title="Permits Expiration"
            count={filteredPermits.length}
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
                className="w-full pl-7 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-slate-400"
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

          <div className="pr-1 space-y-1 overflow-y-auto max-h-64">
            {filteredPermits.length === 0 ? <Empty label="No permits to show" /> : filteredPermits.map((p, i) => {
              const days = daysUntil(p.date_of_expiration);
              const urgent = days !== null && days <= 30;
              return (
                <div key={p.id || i} className="flex items-center gap-3 p-2.5 transition rounded-xl hover:bg-slate-50">
                  <div
                    className="flex items-center justify-center rounded-lg w-9 h-9 shrink-0"
                    style={{ background: urgent ? '#fdecec' : MINT_SOFT }}
                  >
                    <FaIdCard size={13} style={{ color: urgent ? RED_TEXT : '#15803d' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate text-slate-800">{p.business_name || p.client_id}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {p.account && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                          {p.account}
                        </span>
                      )}
                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                        <FaCalendarAlt size={8} /> {fmtDate(p.date_of_expiration)}
                      </span>
                    </div>
                  </div>
                  <span
                    className="text-[10px] font-bold px-2 py-1 rounded-full shrink-0"
                    style={{ background: urgent ? '#fdecec' : MINT_SOFT, color: urgent ? RED_TEXT : '#15803d' }}
                  >
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
              { color: RED_TEXT, label: 'Expired / ≤30 days' },
              { color: '#15803d', label: 'OK' },
            ].map(l => (
              <div key={l.label} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ background: l.color }} />
                <span className="text-[10px] text-slate-500">{l.label}</span>
              </div>
            ))}
            <span className="ml-auto text-[10px] text-slate-400">
              {permits.filter(p => daysUntil(p.date_of_expiration) < 0).length} expired ·{' '}
              {expiringPermitsCount} expiring soon
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}