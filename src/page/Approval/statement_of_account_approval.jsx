import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import {
  FaCheckCircle, FaTimes, FaEnvelope, FaEye, FaSearch,
  FaExclamationTriangle, FaClock, FaPrint,
  FaUndo, FaFileInvoiceDollar, FaChevronLeft, FaChevronRight,
  FaSyncAlt,
} from 'react-icons/fa';
import { LOGO_B64 } from '../../logo_b64';
import { useApprovalPermission } from '../../hooks/approval_permission';

// ── reuse same fmt helper ──
function fmt(n) {
  return Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d) {
  return d
    ? new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
    : '—';
}

// ── Override ng default 1000-row limit ng Supabase ──
// Kumukuha nang paisa-isang batch (1000) hanggang maubos ang rows.
// buildQuery = () => supabase.from(...).select(...).eq(...)  (WALANG range)
const fetchAllRows = async (buildQuery, batchSize = 1000) => {
  let all = [];
  let from = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await buildQuery().range(from, from + batchSize - 1);
    if (error) throw error;
    all = all.concat(data || []);
    if (!data || data.length < batchSize) break;
    from += batchSize;
  }
  return all;
};

// Kunin ang page numbers na may "..." (hal. 1 ... 4 5 6 ... 20)
const getPageNumbers = (current, total) => {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) pages.push('...');
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < total - 1) pages.push('...');
  pages.push(total);
  return pages;
};

// ── Email HTML builder (same as CreateBilling) ──
function buildSOAEmailHTML({
  billTo, tradeName = '', address = '',
  soaNumber, soaDate, dueDate,
  items, subtotal, downPayment, withholdingTax, totalDue,
   notes, approvedBy, preparedBy = '',
}) {
  const fmtN = (n) =>
    Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fDate = (d) => d
    ? new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
    : '—';

  const green = '#1a5c2e';
  const lightGreen = '#e8f5ec';
  const headerGreen = '#2d7a4f';

  const tableRows = [...items];
  while (tableRows.length < 15) tableRows.push(null);

  const itemRows = tableRows.map((item, i) => `
    <tr style="background:${i % 2 === 0 ? '#fff' : '#f9fdf9'};border-bottom:1px solid #e0ede5;">
      <td style="padding:7px 12px;color:#555;font-family:monospace;text-align:center;border-right:1px solid #e0ede5;">${item?.account_code || ''}</td>
      <td style="padding:7px 12px;color:#444;border-right:1px solid #e0ede5;">${item?.agency || ''}</td>
      <td style="padding:7px 12px;color:#222;font-weight:${item ? 500 : 400};border-right:1px solid #e0ede5;">${item?.description || ''}</td>
      <td style="padding:7px 12px;color:#555;border-right:1px solid #e0ede5;">${item?.period_covered || ''}</td>
      <td style="padding:7px 12px;text-align:right;font-family:monospace;font-weight:${item ? 600 : 400};">${item ? fmtN(item.amount) : ''}</td>
    </tr>`).join('');

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>
<title>Statement of Account – ${soaNumber}</title></head>
<body style="margin:0;padding:0;background:#f0f0f0;font-family:Arial,'Helvetica Neue',sans-serif;">
<div style="max-width:780px;margin:24px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.1);">
  <table width="100%" cellpadding="0" cellspacing="0" style="border-bottom:3px solid ${green};">
    <tr><td style="padding:20px 24px 16px;">
      <table cellpadding="0" cellspacing="0" width="100%"><tr>
        <td valign="top" style="width:55%;">
          <table cellpadding="0" cellspacing="0"><tr>
            <td valign="top" style="padding-right:12px;">
              <img src="https://pxzaexutvuatdexgkavk.supabase.co/storage/v1/object/public/assets/fortiserv_logo.png" width="60" height="60" style="border-radius:8px;display:block;object-fit:contain;" />
            </td>
            <td valign="top">
              <div style="color:${green};font-weight:900;font-size:20px;letter-spacing:1px;line-height:1;">FORTISERV</div>
              <div style="color:${green};font-weight:700;font-size:9px;margin-bottom:4px;">BUSINESS MANAGEMENT ENTERPRISE, Co.</div>
              <div style="color:#666;font-style:italic;font-size:8.5px;margin-bottom:8px;">"LET'S MAKE THINGS WORK BETTER..."</div>
              <div style="border-top:1px solid ${green};padding-top:6px;font-size:8.5px;color:#444;line-height:1.7;">
                📍 Unit 32-A 3rd Floor M. Arce St. Heroes Del 96 Barangay 74<br/>
                &nbsp;&nbsp;&nbsp;&nbsp;1400 City of Caloocan NCR Third District Philippines<br/>
                📞 (02) 8995-0486 &nbsp; 📱 0917-315-9779<br/>
                ✉ collectionfbmec@gmail.com &nbsp; 🌐 fortiservbmec@gmail.com<br/>
                📋 <strong>Tax Registration</strong> – Non-VAT Registered – TIN: 008-778-733-00000
              </div>
            </td>
          </tr></table>
        </td>
        <td valign="top" align="right" style="width:45%;">
          <div style="color:${green};font-weight:900;font-size:18px;letter-spacing:2px;margin-bottom:10px;">STATEMENT OF ACCOUNT</div>
          <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid ${green};margin-left:auto;font-size:9.5px;">
            <tr style="border-bottom:1px solid ${green};"><td style="padding:5px 10px;color:${green};font-weight:600;background:${lightGreen};white-space:nowrap;border-right:1px solid ${green};">Statement of Account No. :</td><td style="padding:5px 10px;min-width:150px;">${soaNumber}</td></tr>
            <tr style="border-bottom:1px solid ${green};"><td style="padding:5px 10px;color:${green};font-weight:600;background:${lightGreen};border-right:1px solid ${green};">Bill To :</td><td style="padding:5px 10px;"><strong>${billTo}</strong>${tradeName ? `<br/><span style="color:#666;font-style:italic;font-size:8.5px;">${tradeName}</span>` : ''}</td></tr>
            <tr style="border-bottom:1px solid ${green};"><td style="padding:5px 10px;color:${green};font-weight:600;background:${lightGreen};border-right:1px solid ${green};">Address :</td><td style="padding:5px 10px;">${address || '—'}</td></tr>
            <tr style="border-bottom:1px solid ${green};"><td style="padding:5px 10px;color:${green};font-weight:600;background:${lightGreen};border-right:1px solid ${green};">Statement of Account Date :</td><td style="padding:5px 10px;">${fDate(soaDate)}</td></tr>
            <tr><td style="padding:5px 10px;color:${green};font-weight:600;background:${lightGreen};border-right:1px solid ${green};">Due Date :</td><td style="padding:5px 10px;">${fDate(dueDate)}</td></tr>
          </table>
        </td>
      </tr></table>
    </td></tr>
  </table>
  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
    <thead><tr style="background:${headerGreen};">
      <th style="padding:8px 12px;color:#fff;font-weight:700;font-size:9.5px;text-align:left;border-right:1px solid rgba(255,255,255,0.2);">Account Code</th>
      <th style="padding:8px 12px;color:#fff;font-weight:700;font-size:9.5px;text-align:left;border-right:1px solid rgba(255,255,255,0.2);">Agency</th>
      <th style="padding:8px 12px;color:#fff;font-weight:700;font-size:9.5px;text-align:left;border-right:1px solid rgba(255,255,255,0.2);">Description of Services</th>
      <th style="padding:8px 12px;color:#fff;font-weight:700;font-size:9.5px;text-align:left;border-right:1px solid rgba(255,255,255,0.2);">Period Covered</th>
      <th style="padding:8px 12px;color:#fff;font-weight:700;font-size:9.5px;text-align:right;">Amount</th>
    </tr></thead>
    <tbody>${itemRows}</tbody>
  </table>
  <table width="100%" cellpadding="0" cellspacing="0" style="border-top:2px solid ${green};">
    <tr>
      <td width="33%" valign="top" style="padding:14px 16px;border-right:1px solid #dceee3;font-size:8.5px;">
        <div style="color:${green};font-weight:700;font-size:9px;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid ${green};">Payment Details</div>
        <table cellpadding="0" cellspacing="0" style="margin-bottom:8px;"><tr>
          <td style="padding-right:8px;vertical-align:top;"><div style="width:26px;height:26px;background:${lightGreen};border-radius:50%;border:1px solid ${green};text-align:center;line-height:26px;font-size:12px;">💵</div></td>
          <td><div style="font-weight:700;color:#222;font-size:8.5px;">PICK UP (cash / cheque)</div><div style="color:#666;font-style:italic;font-size:8px;">(Kindly advise when to schedule your payment)</div><div style="color:#222;font-size:8px;">Our schedule for collection is every<br/><strong>Monday, Wednesday, and Friday.</strong></div></td>
        </tr></table>
        <hr style="border:none;border-top:1px dashed #cde3d4;margin:6px 0;"/>
        <table cellpadding="0" cellspacing="0" style="margin-bottom:6px;"><tr>
          <td style="padding-right:8px;vertical-align:top;"><div style="width:26px;height:26px;background:${lightGreen};border-radius:50%;border:1px solid ${green};text-align:center;line-height:26px;font-size:12px;">🏦</div></td>
          <td><div style="font-weight:700;color:#222;font-size:8.5px;">BANK TRANSFER/DEPOSIT</div><div style="color:#555;font-size:8px;">Account Name:</div><div style="font-weight:700;color:#222;font-size:8px;">FORTISERV BUSINESS MANAGEMENT ENTERPRISE CO.</div></td>
        </tr></table>
        <table cellpadding="0" cellspacing="0" style="background:#fef2f2;border-radius:4px;padding:4px 6px;margin-bottom:4px;width:100%;"><tr>
          <td style="padding-right:8px;"><img src="https://pxzaexutvuatdexgkavk.supabase.co/storage/v1/object/public/assets/chinabank.png" height="20" style="display:block;object-fit:contain;" /></td>
          <td><div style="font-size:7.5px;color:#333;">Bank: China Bank Corporation</div><div style="font-size:7.5px;color:#555;">Account Number: 1307000000077</div></td>
        </tr></table>
        <table cellpadding="0" cellspacing="0" style="background:#eff4fb;border-radius:4px;padding:4px 6px;width:100%;"><tr>
          <td style="padding-right:8px;"><img src="https://pxzaexutvuatdexgkavk.supabase.co/storage/v1/object/public/assets/bdo_logo.jpg" height="20" style="display:block;object-fit:contain;" /></td>
          <td><div style="font-size:7.5px;color:#333;">Bank: Banco De Oro</div><div style="font-size:7.5px;color:#555;">Account Number: 004500601972</div></td>
        </tr></table>
      </td>
      <td width="33%" valign="top" style="padding:14px 16px;border-right:1px solid #dceee3;font-size:8.5px;">
        <div style="color:${green};font-weight:700;font-size:9px;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid ${green};">📋 Notes</div>
        <div style="color:#444;line-height:1.7;white-space:pre-line;">${notes}</div>
      </td>
      <td width="34%" valign="top" style="padding:14px 16px;font-size:9.5px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr style="border-bottom:1px solid #e0ede5;"><td style="padding:6px 0;color:#444;">SUBTOTAL</td><td style="padding:6px 0;text-align:right;font-family:monospace;font-weight:600;">₱${fmtN(subtotal)}</td></tr>
          <tr style="border-bottom:1px solid #e0ede5;"><td style="padding:6px 0;color:#444;">Less: Down Payment</td><td style="padding:6px 0;text-align:right;font-family:monospace;">₱${fmtN(downPayment)}</td></tr>
          <tr style="border-bottom:2px solid ${green};"><td style="padding:6px 0;color:#444;">Less: 10% Withholding Tax</td><td style="padding:6px 0;text-align:right;font-family:monospace;">₱${fmtN(withholdingTax)}</td></tr>
          <tr style="background:${green};"><td style="padding:8px 6px;color:#fff;font-weight:700;font-size:9px;text-transform:uppercase;">TOTAL AMOUNT DUE</td><td style="padding:8px 6px;text-align:right;font-family:monospace;font-weight:900;font-size:13px;color:#fff;">₱${fmtN(totalDue)}</td></tr>
        </table>
      </td>
    </tr>
  </table>
  <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #dceee3;">
    <tr>
      <td style="padding:16px 24px;font-size:9.5px;color:#555;width:50%;">Prepared by:<br/><div style="border-bottom:1px solid #999;height:32px;margin:6px 0;"></div><strong style="color:#333;">${preparedBy || '—'}</strong><br/><span>Billing Officer</span></td>
      <td style="padding:16px 24px;font-size:9.5px;color:#555;width:50%;">Received By:<br/><div style="border-bottom:1px solid #999;height:32px;margin:6px 0;"></div>Designation: <span style="display:inline-block;width:130px;border-bottom:1px solid #999;vertical-align:bottom;">&nbsp;</span><br/><br/>Date Received: <span style="display:inline-block;width:100px;border-bottom:1px solid #999;vertical-align:bottom;">&nbsp;</span></td>
    </tr>
  </table>
</div>
<div style="max-width:780px;margin:12px auto;text-align:center;font-size:8.5px;color:#999;">
  This is a system-generated Statement of Account from Fortiserv Business Management Enterprise, Co.<br/>
  For inquiries, contact us at collectionfbmec@gmail.com.
</div>
</body></html>`;
}

// ── Status badge ──
const StatusBadge = ({ status }) => {
  const map = {
    pending_approval: { label: 'Pending Approval', cls: 'bg-amber-100 text-amber-700 border border-amber-200', icon: <FaExclamationTriangle size={9} /> },
    approved:         { label: 'Approved',         cls: 'bg-blue-100 text-blue-700 border border-blue-200',   icon: <FaCheckCircle size={9} /> },
    sent:             { label: 'Sent',             cls: 'bg-green-100 text-green-700 border border-green-200', icon: <FaEnvelope size={9} /> },
    draft:            { label: 'Draft',            cls: 'bg-gray-100 text-gray-500 border border-gray-200',   icon: <FaClock size={9} /> },
    rejected:         { label: 'Rejected',         cls: 'bg-red-100 text-red-600 border border-red-200',      icon: <FaTimes size={9} /> },
  };
  const s = map[status] || map.draft;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ${s.cls}`}>
      {s.icon} {s.label}
    </span>
  );
};

// ── Reject Modal ──
const RejectModal = ({ soa, onConfirm, onClose, loading }) => {
  const [reason, setReason] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden bg-white shadow-2xl rounded-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 bg-red-100 rounded-full">
              <FaUndo size={12} className="text-red-500" />
            </div>
            <h3 className="text-sm font-semibold text-gray-800">Return to Draft</h3>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
            <FaTimes size={13} />
          </button>
        </div>
        <div className="p-5">
          <p className="mb-1 text-sm text-gray-600">
            SOA <span className="font-mono font-semibold text-gray-800">{soa?.soa_number}</span> will be returned to draft.
          </p>
          <p className="mb-4 text-xs text-gray-400">The billing officer will need to resubmit for approval.</p>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Reason for rejection <span className="text-gray-400">(optional)</span></label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={3}
            placeholder="e.g. Incorrect amount, missing description..."
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none focus:outline-none focus:border-red-300 focus:ring-1 focus:ring-red-100"
          />
        </div>
        <div className="flex gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50">
          <button onClick={onClose} className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 transition bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={() => onConfirm(reason)}
            disabled={loading}
            className="flex-1 px-4 py-2 text-sm font-medium text-white transition bg-red-500 rounded-lg hover:bg-red-600 disabled:opacity-50"
          >
            {loading ? 'Returning...' : 'Return to Draft'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════
export default function SOAApproval({ currentUser }) {
  const [soaList, setSoaList]           = useState([]);
  const [totalsMap, setTotalsMap]       = useState({});
  const [loading, setLoading]           = useState(true);
  const [searchInput, setSearchInput]   = useState('');
  const [search, setSearch]             = useState('');
  const [filterStatus, setFilterStatus] = useState('pending_approval');

  // Pagination
  const [page, setPage]             = useState(1);
  const [pageSize, setPageSize]     = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [pendingCount, setPendingCount]   = useState(0);
  const [approvedCount, setApprovedCount] = useState(0);

  // Preview modal
  const [previewSOA, setPreviewSOA]     = useState(null);
  const [previewItems, setPreviewItems] = useState([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Reject modal
  const [rejectTarget, setRejectTarget] = useState(null);

  // Action states
  const [actionLoading, setActionLoading] = useState({});
  const [message, setMessage]             = useState('');
  const [messageType, setMessageType]     = useState('');

  const userFullName = currentUser?.fullName || currentUser?.full_name || 'Unknown';
  const { canApprove: isApprover } = useApprovalPermission(currentUser, 'SOAApproval');
  const logoBase64   = LOGO_B64;

  // ── Debounce search (balik sa page 1 kapag nag-search) ──
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // ── Tab counts (hiwalay na query, hindi apektado ng tab/page) ──
  const fetchCounts = useCallback(async () => {
    const [pending, approved] = await Promise.all([
      supabase
        .from('billing_statements')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending_approval'),
      supabase
        .from('billing_statements')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'approved'),
    ]);
    setPendingCount(pending.count || 0);
    setApprovedCount(approved.count || 0);
  }, []);

  // ── Fetch SOAs (server-side pagination + search) ──
  const fetchSOAs = useCallback(async () => {
    setLoading(true);
    try {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from('billing_statements')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .order('id', { ascending: false });

      if (filterStatus !== 'all') query = query.eq('status', filterStatus);

      if (search) {
        // tanggalin ang mga character na sumisira sa .or() filter
        const q = search.replace(/[,()%]/g, ' ').trim();
        if (q) {
          query = query.or(
            `soa_number.ilike.%${q}%,bill_to.ilike.%${q}%,client_id.ilike.%${q}%`
          );
        }
      }

      const { data, count, error } = await query.range(from, to);
      if (error) throw error;

      // Kung wala nang laman ang page na ito (hal. na-reject ang huling item), umatras
      if ((data || []).length === 0 && page > 1 && (count || 0) > 0) {
        setPage(Math.max(1, Math.ceil(count / pageSize)));
        return;
      }

      const list = data || [];
      setSoaList(list);
      setTotalCount(count || 0);

      // Totals: sum ng items ng mga SOA sa page na ito (lampas 1000 rows OK)
      if (list.length) {
        const ids = list.map((s) => s.id);
        const allItems = await fetchAllRows(() =>
          supabase
            .from('billing_items')
            .select('id, billing_id, amount')
            .in('billing_id', ids)
            .order('id', { ascending: true })
        );
        const sums = {};
        allItems.forEach((i) => {
          sums[i.billing_id] = (sums[i.billing_id] || 0) + (parseFloat(i.amount) || 0);
        });
        setTotalsMap(sums);
      } else {
        setTotalsMap({});
      }

      fetchCounts();
    } catch (err) {
      setMessage(`Failed to load SOAs: ${err.message}`);
      setMessageType('error');
    }
    setLoading(false);
  }, [filterStatus, search, page, pageSize, fetchCounts]);

  useEffect(() => { fetchSOAs(); }, [fetchSOAs]);

  // ── Open Preview ──
  const openPreview = async (soa) => {
    setPreviewLoading(true);
    setPreviewSOA(soa);
    setPreviewItems([]);
    try {
      const data = await fetchAllRows(() =>
        supabase
          .from('billing_items')
          .select('*')
          .eq('billing_id', soa.id)
          .order('id', { ascending: true })
      );
      setPreviewItems(data || []);
    } catch (err) {
      setMessage(`Failed to load items: ${err.message}`);
      setMessageType('error');
    }
    setPreviewLoading(false);
  };

  // ── Computed totals from items ──
  const computeTotals = (soa, items) => {
    const subtotal       = items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
    const downPayment    = parseFloat(soa.down_payment) || 0;
    const withholdingTax = parseFloat(soa.withholding_tax) || 0;
    const totalDue       = subtotal - downPayment - withholdingTax;
    return { subtotal, downPayment, withholdingTax, totalDue };
  };

  // ── Approve & Email ──
  const handleApproveAndEmail = async (soa) => {
    setActionLoading(p => ({ ...p, [soa.id]: 'approving' }));
    try {
      // 1. Fetch items (walang 1000 limit)
      const items = await fetchAllRows(() =>
        supabase
          .from('billing_items')
          .select('*')
          .eq('billing_id', soa.id)
          .order('id', { ascending: true })
      );

      const { subtotal, downPayment, withholdingTax, totalDue } = computeTotals(soa, items || []);

      // 2. Fetch client email
      const { data: clientData } = await supabase
        .from('client_profile')
        .select('email_address, first_name, trade_name')
        .eq('client_id', soa.client_id)
        .single();

      const clientEmail = clientData?.email_address;
      if (!clientEmail) throw new Error('Client has no email address on file.');

      // 3. Build HTML
      const htmlBody = buildSOAEmailHTML({
        billTo:          soa.bill_to,
        tradeName:       clientData?.trade_name || '',
        address:         soa.address,
        soaNumber:       soa.soa_number,
        soaDate:         soa.soa_date,
        dueDate:         soa.due_date,
        items:           items || [],
        subtotal,
        downPayment,
        withholdingTax,
        totalDue,
        notes:           soa.notes,
        approvedBy:      userFullName,
        preparedBy:      soa.created_by_name || '',
      });


      // 4. Update status → approved
      const { error: updateErr } = await supabase
        .from('billing_statements')
        .update({ status: 'approved', approved_by: userFullName, approved_at: new Date().toISOString() })
        .eq('id', soa.id);
      if (updateErr) throw updateErr;

      // 5. Send email
      const res = await fetch(
        `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/send-soa-email`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            clientEmail,
            clientFirstName: clientData?.first_name || soa.bill_to,
            billTo:          soa.bill_to,
            soaNumber:       soa.soa_number,
            soaDate:         soa.soa_date,
            dueDate:         soa.due_date,
            totalDue,
            subtotal,
            downPayment,
            withholdingTax,
            items:           items || [],
            notes:           soa.notes,
            approvedBy:      userFullName,
            htmlBody,
          }),
        }
      );
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to send email');

      setMessage(`✅ SOA ${soa.soa_number} approved and emailed to ${clientEmail}!`);
      setMessageType('success');
      fetchSOAs();

      if (previewSOA?.id === soa.id) setPreviewSOA(p => ({ ...p, status: 'approved' }));

    } catch (err) {
      setMessage(`Error: ${err.message}`);
      setMessageType('error');
    }
    setActionLoading(p => ({ ...p, [soa.id]: null }));
    setTimeout(() => setMessage(''), 6000);
  };

  // ── Reject / Return to Draft ──
  const handleReject = async (reason) => {
    const soa = rejectTarget;
    setActionLoading(p => ({ ...p, [soa.id]: 'rejecting' }));
    try {
      const { error } = await supabase
        .from('billing_statements')
        .update({
          status:           'draft',
          rejection_reason: reason || null,
          rejected_by:      userFullName,
          rejected_at:      new Date().toISOString(),
        })
        .eq('id', soa.id);
      if (error) throw error;

      setMessage(`SOA ${soa.soa_number} returned to draft.`);
      setMessageType('success');
      setRejectTarget(null);
      fetchSOAs();
      if (previewSOA?.id === soa.id) setPreviewSOA(null);
    } catch (err) {
      setMessage(`Error: ${err.message}`);
      setMessageType('error');
    }
    setActionLoading(p => ({ ...p, [soa.id]: null }));
    setTimeout(() => setMessage(''), 5000);
  };

  const statusTabs = [
    { key: 'pending_approval', label: 'Pending'  },
    { key: 'approved',         label: 'Approved' },
    { key: 'all',              label: 'All'      },
  ];

  const tabCounts = {
    pending_approval: pendingCount,
    approved:         approvedCount,
  };

  const changeTab = (key) => {
    setFilterStatus(key);
    setPage(1);
  };

  // Pagination values
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd   = Math.min(page * pageSize, totalCount);

  // ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── TOP BAR ── */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-3.5 bg-white border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 bg-gray-100 rounded-lg">
            <FaFileInvoiceDollar size={14} className="text-black" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-gray-800">SOA Approval Queue</h1>
            <p className="text-xs text-gray-400 mt-0.5">Review and approve pending statements of account</p>
          </div>
        </div>
       <button
  onClick={fetchSOAs}
  disabled={loading}
  title="Refresh"
  aria-label="Refresh"
  className="flex items-center justify-center w-8 h-8 text-gray-500 transition border border-gray-200 rounded-md hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50"
>
  <FaSyncAlt size={12} className={loading ? 'animate-spin' : ''} />
</button>
      </div>

      {/* ── MESSAGE ── */}
      {message && (
        <div className={`mx-6 mt-4 px-4 py-3 rounded-md text-sm flex items-center justify-between border-l-4
          ${messageType === 'success' ? 'bg-green-50 border-green-500 text-green-700' : 'bg-red-50 border-red-500 text-red-700'}`}>
          {message}
          <button onClick={() => setMessage('')}><FaTimes size={11} /></button>
        </div>
      )}

      <div className="px-6 py-6">

        {/* ── FILTERS ── */}
        <div className="flex items-center justify-between gap-4 mb-5">
          {/* Status tabs */}
          <div className="flex items-center gap-1 p-1 bg-white border border-gray-200 rounded-lg">
            {statusTabs.map(tab => {
              const count = tabCounts[tab.key];
              const active = filterStatus === tab.key;
          const badgeCls = tab.key === 'approved'
              ? (active ? 'bg-blue-500 text-white' : 'bg-blue-100 text-blue-700')
              : (active ? 'bg-amber-400 text-white' : 'bg-amber-100 text-amber-700');
              return (
                <button
                  key={tab.key}
                  onClick={() => changeTab(tab.key)}
                  className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition ${
                    active
                      ? 'bg-gray-800 text-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {tab.label}
                  {count > 0 && (
                    <span className={`ml-1.5 inline-flex items-center justify-center min-w-[16px] h-4 px-1 text-[9px] font-bold rounded-full ${badgeCls}`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Search */}
          <div className="relative w-64">
            <FaSearch className="absolute text-gray-300 -translate-y-1/2 left-3 top-1/2" size={11} />
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Search SOA number or client..."
              className="w-full py-2 pl-8 pr-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-green-400 focus:ring-1 focus:ring-green-100"
            />
          </div>
        </div>

        {/* ── TABLE ── */}
        <div className="overflow-hidden bg-white border border-gray-200 rounded-xl">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20">
              <div className="w-8 h-8 border-2 border-green-500 rounded-full border-t-transparent animate-spin" />
              <p className="text-sm text-gray-400">Loading SOAs...</p>
            </div>
          ) : soaList.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-20">
              <FaFileInvoiceDollar size={32} className="text-gray-200" />
              <p className="text-sm font-medium text-gray-400">No SOAs found</p>
              <p className="text-xs text-gray-300">
                {filterStatus === 'pending_approval' && !search ? 'No pending SOAs for approval.' : 'Try changing the filter or search.'}
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">SOA Number</th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Client</th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Date</th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Due Date</th>
                  <th className="px-5 py-3 text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Amount Due</th>
                  <th className="px-5 py-3 text-center text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3 text-center text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {soaList.map(soa => {
                  const isActing = actionLoading[soa.id];
                  const totalDue =
                    (totalsMap[soa.id] || 0) -
                    (parseFloat(soa.down_payment) || 0) -
                    (parseFloat(soa.withholding_tax) || 0);

                  return (
                    <tr key={soa.id} className="transition hover:bg-gray-50/60 group">
                      <td className="px-5 py-3.5">
                        <span className="font-mono text-xs font-semibold text-gray-700">{soa.soa_number}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="text-sm font-medium text-gray-800">{soa.bill_to}</div>
                        <div className="font-mono text-xs text-gray-400">{soa.client_id}</div>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-gray-500">
                        {soa.soa_date ? new Date(soa.soa_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-gray-500">
                        {soa.due_date ? new Date(soa.due_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span className="font-mono text-sm font-semibold text-gray-800">
                          ₱{fmt(totalDue)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <StatusBadge status={soa.status} />
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => openPreview(soa)}
                            title="Preview SOA"
                            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 transition"
                          >
                            <FaEye size={10} />
                          </button>

                          {soa.status === 'pending_approval' && isApprover && (
                            <>
                              <button
                                onClick={() => handleApproveAndEmail(soa)}
                                disabled={!!isActing}
                                title="Approve & Email client"
                                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-white rounded-md transition disabled:opacity-50"
                                style={{ background: '#1a5c2e' }}
                              >
                                {isActing === 'approving' ? (
                                  <div className="w-3 h-3 border border-white rounded-full border-t-transparent animate-spin" />
                                ) : (
                                  <FaEnvelope size={10} />
                                )}
                                {isActing === 'approving' ? 'Sending...' : 'Approve & Email'}
                              </button>

                              <button
                                onClick={() => setRejectTarget(soa)}
                                disabled={!!isActing}
                                title="Return to draft"
                                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-red-500 border border-red-200 rounded-md hover:bg-red-50 transition disabled:opacity-50"
                              >
                                {isActing === 'rejecting' ? (
                                  <div className="w-3 h-3 border border-red-400 rounded-full border-t-transparent animate-spin" />
                                ) : (
                                  <FaUndo size={10} />
                                )}
                                Reject
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* ── PAGINATION ── */}
        {!loading && totalCount > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span>
                Showing <span className="font-semibold text-gray-700">{rangeStart}–{rangeEnd}</span> of{' '}
                <span className="font-semibold text-gray-700">{totalCount}</span>{' '}
                {totalCount === 1 ? 'record' : 'records'}
                {filterStatus !== 'all' ? ` · ${filterStatus.replace('_', ' ')}` : ''}
              </span>
              <div className="flex items-center gap-1.5">
                <span>Rows:</span>
                <select
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                  className="px-2 py-1 text-xs bg-white border border-gray-200 rounded-md focus:outline-none focus:border-green-400"
                >
                  {[10, 25, 50, 100].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex items-center justify-center w-8 h-8 text-gray-500 bg-white border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <FaChevronLeft size={10} />
              </button>

              {getPageNumbers(page, totalPages).map((p, i) =>
                p === '...' ? (
                  <span key={`dots-${i}`} className="px-1 text-xs text-gray-400">…</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`min-w-[32px] h-8 px-2 text-xs font-medium rounded-md border transition ${
                      p === page
                        ? 'text-white border-transparent'
                        : 'text-gray-600 bg-white border-gray-200 hover:bg-gray-50'
                    }`}
                    style={p === page ? { background: '#1a5c2e' } : undefined}
                  >
                    {p}
                  </button>
                )
              )}

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="flex items-center justify-center w-8 h-8 text-gray-500 bg-white border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <FaChevronRight size={10} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════
          PREVIEW MODAL
          ══════════════════════════════════════════════ */}
      {previewSOA && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <style>{`
            @media print {
              body * { visibility: hidden; }
              .soa-print-area, .soa-print-area * { visibility: visible; }
              .soa-print-area { position: fixed; top: 0; left: 0; width: 100%; font-size: 9px; }
              @page { size: A4 portrait; margin: 8mm; }
            }
          `}</style>
          <div className="w-full max-w-4xl bg-white rounded-xl shadow-2xl flex flex-col max-h-[95vh] overflow-hidden">

            {/* Modal top bar */}
            <div className="flex items-center justify-between px-6 py-3.5 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-semibold text-gray-800">
                  {previewSOA.soa_number}
                </h2>
                <StatusBadge status={previewSOA.status} />
              </div>
              <div className="flex items-center gap-2">
                {previewSOA.status === 'pending_approval' && isApprover && (
                  <>
                    <button
                      onClick={() => { handleApproveAndEmail(previewSOA); }}
                      disabled={!!actionLoading[previewSOA.id]}
                      className="flex items-center gap-2 px-3.5 py-1.5 text-sm font-medium text-white rounded-md transition disabled:opacity-50"
                      style={{ background: '#1a5c2e' }}
                    >
                      <FaEnvelope size={11} />
                      {actionLoading[previewSOA.id] === 'approving' ? 'Sending...' : 'Approve & Email'}
                    </button>
                    <button
                      onClick={() => setRejectTarget(previewSOA)}
                      className="flex items-center gap-2 px-3.5 py-1.5 text-sm font-medium text-red-500 border border-red-200 rounded-md hover:bg-red-50 transition"
                    >
                      <FaUndo size={11} /> Reject
                    </button>
                  </>
                )}
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 transition"
                >
                  <FaPrint size={11} /> Print
                </button>
                <button onClick={() => setPreviewSOA(null)} className="p-1.5 text-gray-400 hover:text-gray-600 transition">
                  <FaTimes size={14} />
                </button>
              </div>
            </div>

            {/* SOA body */}
            <div className="flex-1 p-6 overflow-y-auto bg-gray-100">
              {previewLoading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="w-8 h-8 border-2 border-green-500 rounded-full border-t-transparent animate-spin" />
                </div>
              ) : (() => {
                const items = previewItems;
                const subtotal        = items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
                const downPayment     = parseFloat(previewSOA.down_payment) || 0;
                const withholdingTax  = parseFloat(previewSOA.withholding_tax) || 0;
                const totalDue        = subtotal - downPayment - withholdingTax;
                const rowCount        = Math.max(15, items.length);

                return (
                  <div className="soa-print-area mx-auto bg-white text-[11px]"
                    style={{ maxWidth: '760px', fontFamily: 'Arial, Helvetica Neue, sans-serif' }}>

                    {/* HEADER */}
                    <div className="flex items-start justify-between gap-4 p-5" style={{ borderBottom: '3px solid #1a5c2e' }}>
                      <div className="flex items-start gap-3">
                        <img src="/fortiserv_logo.png" style={{ width: 60, height: 60, borderRadius: 8, objectFit: 'contain', flexShrink: 0 }} alt="logo" />
                        <div>
                          <div style={{ color: '#1a5c2e', fontWeight: 900, fontSize: 20, letterSpacing: 1, lineHeight: 1 }}>FORTISERV</div>
                          <div style={{ color: '#cc0000', fontWeight: 700, fontSize: 9, marginBottom: 2 }}>BUSINESS MANAGEMENT ENTERPRISE, Co.</div>
                          <div style={{ color: '#666', fontStyle: 'italic', fontSize: 8.5, marginBottom: 8 }}>"LET'S MAKE THINGS WORK BETTER..."</div>
                          <div style={{ borderTop: '1px solid #1a5c2e', paddingTop: 6 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 16px', fontSize: 8.5, color: '#444' }}>
                              <div><span style={{ color: '#1a5c2e', marginRight: 4 }}>●</span> Unit 32-A 3rd Floor M. Arce St. Heroes Del 96 Barangay 74</div>
                              <div><span style={{ color: '#1a5c2e', marginRight: 4 }}>✆</span> (02) 8995-0486</div>
                              <div style={{ color: '#888', paddingLeft: 12 }}>1400 City of Caloocan NCR Third District Philippines</div>
                              <div><span style={{ color: '#1a5c2e', marginRight: 4 }}>✆</span> 0917-315-9779</div>
                              <div><span style={{ color: '#1a5c2e', marginRight: 4 }}>✉</span> collectionfbmec@gmail.com</div>
                              <div><span style={{ color: '#1a5c2e', marginRight: 4 }}>⊕</span> fortiservbmec@gmail.com</div>
                              <div><span style={{ color: '#1a5c2e', marginRight: 4 }}>▣</span> <strong>Tax Registration</strong> – Non-VAT Registered</div>
                              <div><span style={{ color: '#1a5c2e', marginRight: 4 }}>◉</span> TIN: 008-778-733-00000</div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div style={{ color: '#1a5c2e', fontWeight: 900, fontSize: 18, letterSpacing: 2, marginBottom: 10 }}>STATEMENT OF ACCOUNT</div>
                        <table className="ml-auto text-left" style={{ borderCollapse: 'collapse', border: '1px solid #1a5c2e', fontSize: 9.5, minWidth: 270 }}>
                          <tbody>
                            {[
                              ['Statement of Account No. :', previewSOA.soa_number],
                              ['Bill To :', previewSOA.bill_to],
                              ['Address :', previewSOA.address || '—'],
                              ['SOA Date :', fmtDate(previewSOA.soa_date)],
                              ['Due Date :', fmtDate(previewSOA.due_date)],
                            ].map(([k, v], i) => (
                              <tr key={i} style={{ borderBottom: '1px solid #1a5c2e' }}>
                                <td style={{ padding: '5px 10px', color: '#1a5c2e', fontWeight: 600, background: '#e8f5ec', whiteSpace: 'nowrap', borderRight: '1px solid #1a5c2e' }}>{k}</td>
                                <td style={{ padding: '5px 10px', minWidth: 160 }}>{v}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* ITEMS */}
                    <div className="relative">
                      <div style={{ position: 'absolute', top: '40%', left: '50%', transform: 'translate(-50%, -50%)', width: 400, height: 200, pointerEvents: 'none', zIndex: 2 }}>
                        <img src={logoBase64} style={{ width: 400, height: 300, objectFit: 'contain', opacity: 0.08, mixBlendMode: 'multiply' }} alt="" />
                      </div>
                      <table className="w-full" style={{ borderCollapse: 'collapse', position: 'relative', zIndex: 1 }}>
                        <thead>
                          <tr style={{ background: '#2d7a4f' }}>
                            {['Account Code', 'Agency', 'Description of Services', 'Period Covered', 'Amount'].map((h, i) => (
                              <th key={h} className="font-semibold text-left text-white"
                                style={{ padding: '8px 12px', fontSize: 9.5, borderRight: i < 4 ? '1px solid rgba(255,255,255,0.2)' : 'none' }}>
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {Array.from({ length: rowCount }).map((_, i) => {
                            const item = items[i];
                            return (
                              <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f4faf6', borderBottom: '1px solid #e0ede5', height: 24 }}>
                                <td style={{ padding: '7px 12px', fontFamily: 'monospace', color: '#555', textAlign: 'center', borderRight: '1px solid #e0ede5' }}>{item?.account_code || ''}</td>
                                <td style={{ padding: '7px 12px', color: '#444', borderRight: '1px solid #e0ede5' }}>{item?.agency || ''}</td>
                                <td style={{ padding: '7px 12px', color: '#222', fontWeight: item ? 500 : 400, borderRight: '1px solid #e0ede5' }}>{item?.description || ''}</td>
                                <td style={{ padding: '7px 12px', color: '#555', borderRight: '1px solid #e0ede5' }}>{item?.period_covered || ''}</td>
                                <td style={{ padding: '7px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: item ? 600 : 400 }}>{item ? `₱${fmt(item.amount)}` : ''}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* FOOTER */}
                    <div className="grid grid-cols-3" style={{ borderTop: '2px solid #1a5c2e' }}>
                      {/* Payment */}
                      <div className="p-4" style={{ borderRight: '1px solid #dceee3', fontSize: 8.5 }}>
                        <div style={{ color: '#1a5c2e', fontWeight: 700, fontSize: 9, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, paddingBottom: 4, borderBottom: '1px solid #1a5c2e' }}>Payment Details</div>
                        <div className="flex gap-2 items-start mb-2.5">
                          <div className="flex items-center justify-center rounded-full shrink-0" style={{ width: 26, height: 26, background: '#e8f5ec', border: '1px solid #1a5c2e', fontSize: 12 }}>💵</div>
                          <div>
                            <div style={{ fontWeight: 700, color: '#222' }}>PICK UP (cash / cheque)</div>
                            <div style={{ color: '#666', fontStyle: 'italic' }}>(Kindly advise when to schedule)</div>
                            <div style={{ color: '#222' }}>Collection: <strong>Mon, Wed, Fri</strong></div>
                          </div>
                        </div>
                        <div style={{ borderTop: '1px dashed #cde3d4', margin: '6px 0' }} />
                        <div className="flex gap-2 items-start mb-2.5">
                          <div className="flex items-center justify-center rounded-full shrink-0" style={{ width: 26, height: 26, background: '#e8f5ec', border: '1px solid #1a5c2e', fontSize: 12 }}>🏦</div>
                          <div>
                            <div style={{ fontWeight: 700, color: '#222' }}>BANK TRANSFER/DEPOSIT</div>
                            <div style={{ fontWeight: 700, color: '#222', fontSize: 7.5 }}>FORTISERV BUSINESS MANAGEMENT ENTERPRISE CO.</div>
                          </div>
                        </div>

                        {/* China Bank */}
                        <div className="flex items-center gap-2 rounded mb-1.5 p-1.5" style={{ background: '#fef2f2', overflow: 'hidden', maxHeight: 32 }}>
                          <img
                            src="https://pxzaexutvuatdexgkavk.supabase.co/storage/v1/object/public/assets/chinabank.png"
                            alt="China Bank"
                            style={{ height: 16, width: 'auto', maxWidth: 40, objectFit: 'contain', display: 'block' }}
                          />
                          <div>
                            <div style={{ fontSize: 8, color: '#333' }}>Bank: China Bank Corporation</div>
                            <div style={{ fontSize: 8, color: '#555' }}>Account Number: 1307000000077</div>
                          </div>
                        </div>

                        {/* BDO */}
                        <div className="flex items-center gap-2 rounded p-1.5" style={{ background: '#eff4fb', overflow: 'hidden', maxHeight: 32 }}>
                          <img
                            src="https://pxzaexutvuatdexgkavk.supabase.co/storage/v1/object/public/assets/bdo_logo.jpg"
                            alt="BDO"
                            style={{ height: 16, width: 'auto', maxWidth: 40, objectFit: 'contain', display: 'block' }}
                          />
                          <div>
                            <div style={{ fontSize: 8, color: '#333' }}>Bank: Banco De Oro</div>
                            <div style={{ fontSize: 8, color: '#555' }}>Account Number: 004500601972</div>
                          </div>
                        </div>
                      </div>

                      {/* Notes */}
                      <div className="p-4" style={{ borderRight: '1px solid #dceee3', fontSize: 8.5 }}>
                        <div className="flex items-center gap-1.5 mb-2" style={{ paddingBottom: 4, borderBottom: '1px solid #1a5c2e' }}>
                          <span style={{ fontSize: 12 }}>📋</span>
                          <span style={{ color: '#1a5c2e', fontWeight: 700, fontSize: 9, textTransform: 'uppercase', letterSpacing: 1 }}>Notes</span>
                        </div>
                        <div className="whitespace-pre-line" style={{ color: '#444', lineHeight: 1.7 }}>{previewSOA.notes}</div>
                      </div>

                      {/* Totals */}
                      <div className="p-4">
                        <table className="w-full" style={{ borderCollapse: 'collapse', fontSize: 9.5 }}>
                          <tbody>
                            <tr style={{ borderBottom: '1px solid #e0ede5' }}>
                              <td style={{ padding: '6px 0', color: '#444' }}>SUBTOTAL</td>
                              <td style={{ padding: '6px 0', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>₱{fmt(subtotal)}</td>
                            </tr>
                            <tr style={{ borderBottom: '1px solid #e0ede5' }}>
                              <td style={{ padding: '6px 0', color: '#444' }}>Less: Down Payment</td>
                              <td style={{ padding: '6px 0', textAlign: 'right', fontFamily: 'monospace' }}>₱{fmt(downPayment)}</td>
                            </tr>
                            <tr style={{ borderBottom: '2px solid #1a5c2e' }}>
                              <td style={{ padding: '6px 0', color: '#444' }}>Less: 10% Withholding Tax</td>
                              <td style={{ padding: '6px 0', textAlign: 'right', fontFamily: 'monospace' }}>₱{fmt(withholdingTax)}</td>
                            </tr>
                            <tr style={{ background: '#1a5c2e' }}>
                              <td style={{ padding: '8px 6px', color: '#fff', fontWeight: 700, fontSize: 9, textTransform: 'uppercase' }}>TOTAL AMOUNT DUE</td>
                              <td style={{ padding: '8px 6px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 900, fontSize: 13, color: '#fff' }}>₱{fmt(totalDue)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* SIGNATURES */}
                    <div className="grid grid-cols-2 gap-8 p-5" style={{ borderTop: '1px solid #dceee3', fontSize: 9.5, color: '#555' }}>
                      <div>
                        <div style={{ marginBottom: 4 }}>Prepared by:</div>
                        <div style={{ borderBottom: '1px solid #999', height: 32, marginBottom: 6 }} />
                       <div style={{ color: '#333', fontWeight: 600 }}>{previewSOA.created_by_name || '—'}</div>
                      <div>Billing Officer</div>
                      </div>
                      <div>
                        <div style={{ marginBottom: 4 }}>Received By:</div>
                        <div style={{ borderBottom: '1px solid #999', height: 32, marginBottom: 8 }} />
                        <div style={{ marginBottom: 4 }}>Designation: <span style={{ display: 'inline-block', width: 130, borderBottom: '1px solid #999', verticalAlign: 'bottom' }} /></div>
                        <div>Date Received: <span style={{ display: 'inline-block', width: 100, borderBottom: '1px solid #999', verticalAlign: 'bottom' }} /></div>
                      </div>
                    </div>

                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ── REJECT MODAL ── */}
      {rejectTarget && (
        <RejectModal
          soa={rejectTarget}
          onConfirm={handleReject}
          onClose={() => setRejectTarget(null)}
          loading={!!actionLoading[rejectTarget?.id]}
        />
      )}
    </div>
  );
}