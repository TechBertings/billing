import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../lib/supabaseClient';
import {
  FaSearch, FaTimes, FaPlus, FaTrash, FaPrint, FaSave,
  FaChevronDown, FaUser, FaCheckCircle, FaEnvelope, FaClock,
  FaExclamationTriangle,
} from 'react-icons/fa';
import { LOGO_B64 } from '../../logo_b64';
import { useApprovalPermission } from '../../hooks/approval_permission';



function fmt(n) {
  return Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function newRow() {
  return {
    id: Date.now() + Math.random(),
    account_code: '',
    agency: '',
    description: '',
    period_covered: 'Not Applicable',
    amount: '',
  };
}

const generateSOANumber = async () => {
  const now = new Date();
  const yr = now.getFullYear();
  const mo = String(now.getMonth() + 1).padStart(2, '0');
  const prefix = `FBMEC-${yr}${mo}-`;
  const { data } = await supabase
    .from('billing_statements')
    .select('soa_number')
    .ilike('soa_number', `${prefix}%`)
    .order('soa_number', { ascending: false })
    .limit(1);
  const last = data?.[0]?.soa_number?.split('-').pop();
  const next = String((parseInt(last) || 0) + 1).padStart(4, '0');
  return `${prefix}${next}`;
};

// ── Build email HTML string (used by handleApproveAndEmail) ──────────────────
function buildSOAEmailHTML({
  clientFirstName, billTo, tradeName = '', address = '',
  soaNumber, soaDate, dueDate,
  items, subtotal, downPayment, withholdingTax, totalDue,
  notes, approvedBy,
}) {
  const fmtN = (n) =>
    Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const fmtDate = (d) => d
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

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Statement of Account – ${soaNumber}</title></head>
<body style="margin:0;padding:0;background:#f0f0f0;font-family:Arial,'Helvetica Neue',sans-serif;">
<div style="max-width:780px;margin:24px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.1);">

  <!-- HEADER -->
  <table width="100%" cellpadding="0" cellspacing="0" style="border-bottom:3px solid ${green};">
    <tr><td style="padding:20px 24px 16px;">
      <table cellpadding="0" cellspacing="0" width="100%"><tr>
        <td valign="top" style="width:55%;">
          <table cellpadding="0" cellspacing="0"><tr>
            <td valign="top" style="padding-right:12px;">
              <!-- 🔁 Replace with: <img src="cid:fortiserv-logo" width="60" height="60" style="border-radius:8px;display:block;" /> -->
           <img src="https://pxzaexutvuatdexgkavk.supabase.co/storage/v1/object/public/assets/fortiserv_logo.png" 
  width="60" height="60" 
  style="border-radius:8px;display:block;object-fit:contain;" />
            </td>
            <td valign="top">
              <div style="color:${green};font-weight:900;font-size:20px;letter-spacing:1px;line-height:1;">FORTISERV</div>
              <div style="color:${green};font-weight:700;font-size:9px;margin-bottom:4px;">BUSINESS MANAGEMENT ENTERPRISE, Co.</div>
              <div style="color:#666;font-style:italic;font-size:8.5px;margin-bottom:8px;">"LET'S MAKE THINGS WORK BETTER..."</div>
              <div style="border-top:1px solid ${green};padding-top:6px;font-size:8.5px;color:#444;line-height:1.7;">
📍 Unit 32-A 3rd Floor M. Arce St. Heroes Del 96 Barangay 74<br/>             
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
            <tr style="border-bottom:1px solid ${green};">
              <td style="padding:5px 10px;color:${green};font-weight:600;background:${lightGreen};white-space:nowrap;border-right:1px solid ${green};">Statement of Account No. :</td>
              <td style="padding:5px 10px;min-width:150px;">${soaNumber}</td>
            </tr>
            <tr style="border-bottom:1px solid ${green};">
              <td style="padding:5px 10px;color:${green};font-weight:600;background:${lightGreen};border-right:1px solid ${green};">Bill To :</td>
              <td style="padding:5px 10px;"><strong>${billTo}</strong>${tradeName ? `<br/><span style="color:#666;font-style:italic;font-size:8.5px;">${tradeName}</span>` : ''}</td>
            </tr>
            <tr style="border-bottom:1px solid ${green};">
              <td style="padding:5px 10px;color:${green};font-weight:600;background:${lightGreen};border-right:1px solid ${green};">Address :</td>
              <td style="padding:5px 10px;">${address || '—'}</td>
            </tr>
            <tr style="border-bottom:1px solid ${green};">
              <td style="padding:5px 10px;color:${green};font-weight:600;background:${lightGreen};border-right:1px solid ${green};">Statement of Account Date :</td>
              <td style="padding:5px 10px;">${fmtDate(soaDate)}</td>
            </tr>
            <tr>
              <td style="padding:5px 10px;color:${green};font-weight:600;background:${lightGreen};border-right:1px solid ${green};">Due Date :</td>
              <td style="padding:5px 10px;">${fmtDate(dueDate)}</td>
            </tr>
          </table>
        </td>
      </tr></table>
    </td></tr>
  </table>

  <!-- ITEMS TABLE -->
  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
    <thead>
      <tr style="background:${headerGreen};">
        <th style="padding:8px 12px;color:#fff;font-weight:700;font-size:9.5px;text-align:left;border-right:1px solid rgba(255,255,255,0.2);">Account Code</th>
        <th style="padding:8px 12px;color:#fff;font-weight:700;font-size:9.5px;text-align:left;border-right:1px solid rgba(255,255,255,0.2);">Agency</th>
        <th style="padding:8px 12px;color:#fff;font-weight:700;font-size:9.5px;text-align:left;border-right:1px solid rgba(255,255,255,0.2);">Description of Services</th>
        <th style="padding:8px 12px;color:#fff;font-weight:700;font-size:9.5px;text-align:left;border-right:1px solid rgba(255,255,255,0.2);">Period Covered</th>
        <th style="padding:8px 12px;color:#fff;font-weight:700;font-size:9.5px;text-align:right;">Amount</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <!-- FOOTER -->
  <table width="100%" cellpadding="0" cellspacing="0" style="border-top:2px solid ${green};">
    <tr>
      <td width="33%" valign="top" style="padding:14px 16px;border-right:1px solid #dceee3;font-size:8.5px;">
        <div style="color:${green};font-weight:700;font-size:9px;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid ${green};">Payment Details</div>
        <table cellpadding="0" cellspacing="0" style="margin-bottom:8px;"><tr>
          <td style="padding-right:8px;vertical-align:top;">
            <div style="width:26px;height:26px;background:${lightGreen};border-radius:50%;border:1px solid ${green};text-align:center;line-height:26px;font-size:12px;">💵</div>
          </td>
          <td>
            <div style="font-weight:700;color:#222;font-size:8.5px;">PICK UP (cash / cheque)</div>
            <div style="color:#666;font-style:italic;font-size:8px;">(Kindly advise when to schedule your payment)</div>
            <div style="color:#222;font-size:8px;">Our schedule for collection is every<br/><strong>Monday, Wednesday, and Friday.</strong></div>
          </td>
        </tr></table>
        <hr style="border:none;border-top:1px dashed #cde3d4;margin:6px 0;"/>
        <table cellpadding="0" cellspacing="0" style="margin-bottom:6px;"><tr>
          <td style="padding-right:8px;vertical-align:top;">
            <div style="width:26px;height:26px;background:${lightGreen};border-radius:50%;border:1px solid ${green};text-align:center;line-height:26px;font-size:12px;">🏦</div>
          </td>
          <td>
            <div style="font-weight:700;color:#222;font-size:8.5px;">BANK TRANSFER/DEPOSIT</div>
            <div style="color:#555;font-size:8px;">Account Name:</div>
            <div style="font-weight:700;color:#222;font-size:8px;">FORTISERV BUSINESS MANAGEMENT ENTERPRISE CO.</div>
          </td>
        </tr></table>
        <!-- 🔁 Replace colored div with: <img src="cid:chinabank-logo" height="20" /> -->
        <table cellpadding="0" cellspacing="0" style="background:#fef2f2;border-radius:4px;padding:4px 6px;margin-bottom:4px;width:100%;"><tr>
          <td style="padding-right:8px;"><div style="background:#CC0000;border-radius:3px;padding:2px 6px;color:#fff;font-weight:700;font-size:7.5px;white-space:nowrap;">CHINABANK</div></td>
          <td><div style="font-size:7.5px;color:#333;">Bank: China Bank Corporation</div><div style="font-size:7.5px;color:#555;">Account Number: 1307000000077</div></td>
        </tr></table>
        <!-- 🔁 Replace colored div with: <img src="cid:bdo-logo" height="20" /> -->
        <table cellpadding="0" cellspacing="0" style="background:#eff4fb;border-radius:4px;padding:4px 6px;width:100%;"><tr>
          <td style="padding-right:8px;"><div style="background:#003087;border-radius:3px;padding:2px 8px;color:#fff;font-weight:900;font-size:9px;white-space:nowrap;">BDO</div></td>
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

  <!-- SIGNATURES -->
  <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #dceee3;">
    <tr>
      <td style="padding:16px 24px;font-size:9.5px;color:#555;width:50%;">
        Prepared by:<br/>
        <div style="border-bottom:1px solid #999;height:32px;margin:6px 0;"></div>
        <strong style="color:#333;">${approvedBy || 'Billing Officer'}</strong><br/>
        <span>Billing Officer</span>
      </td>
      <td style="padding:16px 24px;font-size:9.5px;color:#555;width:50%;">
        Received By:<br/>
        <div style="border-bottom:1px solid #999;height:32px;margin:6px 0;"></div>
        Designation: <span style="display:inline-block;width:130px;border-bottom:1px solid #999;vertical-align:bottom;">&nbsp;</span><br/><br/>
        Date Received: <span style="display:inline-block;width:100px;border-bottom:1px solid #999;vertical-align:bottom;">&nbsp;</span>
      </td>
    </tr>
  </table>

</div>
<div style="max-width:780px;margin:12px auto;text-align:center;font-size:8.5px;color:#999;">
  This is a system-generated Statement of Account from Fortiserv Business Management Enterprise, Co.<br/>
  For inquiries, contact us at collectionfbmec@gmail.com.
</div>
</body></html>`;
}

const inputCls = "w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 bg-white transition";
const labelCls = "block text-xs font-medium text-gray-500 mb-1";

// ── Status badge ──
const StatusBadge = ({ status }) => {
  const map = {
    draft:            { label: 'Draft',            cls: 'bg-gray-100 text-gray-500',   icon: <FaClock size={9} /> },
    pending_approval: { label: 'Pending Approval', cls: 'bg-amber-100 text-amber-600', icon: <FaExclamationTriangle size={9} /> },
    approved:         { label: 'Approved',         cls: 'bg-green-100 text-green-600', icon: <FaCheckCircle size={9} /> },
    unpaid:           { label: 'Unpaid',           cls: 'bg-red-100 text-red-500',     icon: <FaClock size={9} /> },
  };
  const s = map[status] || map.draft;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ${s.cls}`}>
      {s.icon} {s.label}
    </span>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
export default function CreateBilling({ currentUser }) {
  // ── Client ──
  const [clientSearch, setClientSearch]     = useState('');
  const [clientResults, setClientResults]   = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [searchLoading, setSearchLoading]   = useState(false);
  const [showClientDrop, setShowClientDrop] = useState(false);
  const clientRef = useRef(null);

  // ── COA portal ──
  const [coaAccounts, setCoaAccounts] = useState([]);
  const [coaLoading, setCoaLoading]   = useState(false);
  const [activeCoaRow, setActiveCoaRow] = useState(null);
  const [coaSearch, setCoaSearch]     = useState('');
  const [coaDropPos, setCoaDropPos]   = useState({ top: 0, left: 0, width: 0 });
  const coaPortalRef = useRef(null);

  // ── Add-row dropdown ──
  const [showAddDrop, setShowAddDrop] = useState(false);
  const addDropRef = useRef(null);

  // ── Save dropdown ──
  const [showSaveDrop, setShowSaveDrop] = useState(false);
  const saveDropRef = useRef(null);

  // ── Form ──
  const [soaNumber, setSoaNumber]           = useState('Generating...');
  const [soaDate, setSoaDate]               = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate]               = useState('');
  const [billTo, setBillTo]                 = useState('');
  const [address, setAddress]               = useState('');
  const [notes, setNotes]                   = useState(
    'Payment is due within 15 days from invoice date.\n\nPlease send proof of payment for proper acknowledgment.\n\nThank you for your continuous trust and support to our accounting services.'
  );
  const [downPayment, setDownPayment]       = useState('');
  const [withholdingTax, setWithholdingTax] = useState('');
  const [items, setItems]                   = useState([newRow()]);
  const [soaStatus, setSoaStatus]           = useState('draft');
  const [savedBillingId, setSavedBillingId] = useState(null);

  // ── UI ──
  const [saving, setSaving]           = useState(false);
  const [approving, setApproving]     = useState(false);
  const [message, setMessage]         = useState('');
  const [messageType, setMessageType] = useState('');
  const [showPrint, setShowPrint]     = useState(false);
  const [savedBilling, setSavedBilling] = useState(null);

const { canApprove: isApprover } = useApprovalPermission(currentUser, 'SOAApproval');
const userFullName = currentUser?.fullName || currentUser?.full_name || 'Unknown';

const logoBase64 = LOGO_B64;

  useEffect(() => { generateSOANumber().then(setSoaNumber); }, []);

  // ── Outside click ──
  useEffect(() => {
    const handler = (e) => {
      if (clientRef.current && !clientRef.current.contains(e.target))   setShowClientDrop(false);
      if (addDropRef.current && !addDropRef.current.contains(e.target)) setShowAddDrop(false);
      if (saveDropRef.current && !saveDropRef.current.contains(e.target)) setShowSaveDrop(false);
      if (coaPortalRef.current && !coaPortalRef.current.contains(e.target)) {
        setActiveCoaRow(null);
        setCoaSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Client search ──
  const searchApprovedClients = useCallback(async (term) => {
    setSearchLoading(true);
    try {
      let query = supabase
        .from('client_profile')
        .select('id, client_id, business_name, trade_name, first_name, middle_name, last_name, registered_business_address, approval_status, email_address')
        .eq('approval_status', 'approved')
        .limit(8);

      if (term.trim()) {
        query = query.or(
          `business_name.ilike.%${term}%,client_id.ilike.%${term}%,first_name.ilike.%${term}%,last_name.ilike.%${term}%,trade_name.ilike.%${term}%`
        );
      } else {
        query = query.order('business_name', { ascending: true });
      }

      const { data, error } = await query;
      if (!error) { setClientResults(data || []); setShowClientDrop(true); }
    } finally {
      setSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!clientSearch.trim()) return;
    const t = setTimeout(() => searchApprovedClients(clientSearch), 300);
    return () => clearTimeout(t);
  }, [clientSearch, searchApprovedClients]);

  const getClientPrimaryName = (c) => {
    if (c.business_name) return c.business_name;
    return [c.first_name, c.middle_name, c.last_name].filter(Boolean).join(' ') || c.client_id;
  };

  const selectClient = (c) => {
    setSelectedClient(c);
    setBillTo(getClientPrimaryName(c));
    setAddress(c.registered_business_address || '');
    setClientSearch(getClientPrimaryName(c));
    setShowClientDrop(false);
    setClientResults([]);
  };

  const clearClient = () => {
    setSelectedClient(null);
    setBillTo('');
    setAddress('');
    setClientSearch('');
  };

  // ── COA ──
  const fetchCOA = useCallback(async () => {
    if (coaAccounts.length > 0) return;
    setCoaLoading(true);
    const { data, error } = await supabase
      .from('chart_of_accounts')
      .select('*')
      .eq('is_active', true)
      .order('agency', { ascending: true })
      .order('account_name', { ascending: true });
    if (!error) setCoaAccounts(data || []);
    setCoaLoading(false);
  }, [coaAccounts.length]);

  const openCoaForRow = (rowId, e) => {
    fetchCOA();
    if (activeCoaRow === rowId) { setActiveCoaRow(null); return; }
    const rect = e.currentTarget.getBoundingClientRect();
    setCoaDropPos({ top: rect.bottom + window.scrollY + 4, left: rect.left + window.scrollX, width: 320 });
    setActiveCoaRow(rowId);
    setCoaSearch('');
  };

  const pickCoaForRow = (rowId, acct) => {
    setItems(p => p.map(i => i.id === rowId ? {
      ...i,
      account_code: acct.code || '',
      agency:       acct.agency || '',
      description:  acct.account_name || '',
      amount:       acct.default_amount || '',
    } : i));
    setActiveCoaRow(null);
    setCoaSearch('');
  };

  // ── Items ──
  const updateItem = (id, field, val) => setItems(p => p.map(i => i.id === id ? { ...i, [field]: val } : i));
  const removeItem = (id) => setItems(p => { const n = p.filter(i => i.id !== id); return n.length === 0 ? [newRow()] : n; });
  const addRows    = (count) => { setItems(p => [...p, ...Array.from({ length: count }, newRow)]); setShowAddDrop(false); };

  // ── Totals ──
  const subtotal = items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
  const dp       = parseFloat(downPayment) || 0;
  const wht      = parseFloat(withholdingTax) || 0;
  const totalDue = subtotal - dp - wht;

  // ── COA filter ──
  const filteredCOA = coaAccounts.filter(a =>
    a.account_name.toLowerCase().includes(coaSearch.toLowerCase()) ||
    (a.agency || '').toLowerCase().includes(coaSearch.toLowerCase())
  );
  const groupedCOA = filteredCOA.reduce((acc, a) => {
    if (!acc[a.agency]) acc[a.agency] = [];
    acc[a.agency].push(a);
    return acc;
  }, {});

  // ── Validation ──
  const validate = () => {
    if (!selectedClient) { setMessage('Please select a client first.'); setMessageType('error'); return false; }
    const filled = items.filter(i => i.description || i.amount);
    if (filled.length === 0) { setMessage('Please add at least one billing item.'); setMessageType('error'); return false; }
    return filled;
  };

  // ── Build snapshot ──
  // FIX: always falls back to current items so Preview button works before saving
  const buildSnapshot = (filledItems) => ({
    soaNumber,
    billTo,
    tradeName: selectedClient?.trade_name || '',
    address,
    soaDate,
    dueDate,
    items: filledItems ?? items.filter(i => i.description || i.amount),
    subtotal,
    dp,
    wht,
    totalDue,
    notes,
  });

  // ── Core DB upsert ──
  const upsertBilling = async (status, filledItems) => {
    const payload = {
      soa_number:      soaNumber,
      client_id:       selectedClient.client_id,
      bill_to:         billTo,
      address,
      soa_date:        soaDate || null,
      due_date:        dueDate || null,
      down_payment:    dp,
      withholding_tax: wht,
      notes,
      status,
    };

    let bill;
    if (savedBillingId) {
      const { data, error } = await supabase
        .from('billing_statements')
        .update(payload)
        .eq('id', savedBillingId)
        .select()
        .single();
      if (error) throw error;
      bill = data;
        await supabase
        .from('billing_statements')
        .update({ approved_by: userFullName, approved_at: new Date().toISOString() })
        .eq('soa_number', soaNumber);
    } else {
      const { data, error } = await supabase
        .from('billing_statements')
        .insert([payload])
        .select()
        .single();
      if (error) throw error;
      bill = data;
      setSavedBillingId(bill.id);
    }

    const { error: itemErr } = await supabase.from('billing_items').insert(
      filledItems.map(i => ({
        billing_id:     bill.id,
        account_code:   i.account_code || null,
        agency:         i.agency,
        description:    i.description,
        period_covered: i.period_covered,
        amount:         parseFloat(i.amount) || 0,
      }))
    );
    if (itemErr) throw itemErr;
    return bill;
  };

  // ── Save as Draft ──
  const handleSaveDraft = async () => {
    const filledItems = validate();
    if (!filledItems) return;
    setSaving(true);
    setShowSaveDrop(false);
    try {
      await upsertBilling('draft', filledItems);
      setSoaStatus('draft');
      setMessage('SOA saved as draft.');
      setMessageType('success');
      setSavedBilling(buildSnapshot(filledItems));
    } catch (err) {
      setMessage(`Error: ${err.message}`); setMessageType('error');
    }
    setSaving(false);
    setTimeout(() => setMessage(''), 4000);
  };

  // ── Submit for Approval ──
  const handleSubmitForApproval = async () => {
    const filledItems = validate();
    if (!filledItems) return;
    setSaving(true);
    setShowSaveDrop(false);
    try {
      await upsertBilling('pending_approval', filledItems);
      setSoaStatus('pending_approval');
      setMessage('SOA submitted for approval.');
      setMessageType('success');
      setSavedBilling(buildSnapshot(filledItems));
    } catch (err) {
      setMessage(`Error: ${err.message}`); setMessageType('error');
    }
    setSaving(false);
    setTimeout(() => setMessage(''), 4000);
  };

  // ── Save & Add Another ──
  const handleSaveAndAddAnother = async () => {
    const filledItems = validate();
    if (!filledItems) return;
    setSaving(true);
    setShowSaveDrop(false);
    try {
      await upsertBilling('draft', filledItems);
      setSoaStatus('draft');
      setSavedBillingId(null);
      setSelectedClient(null);
      setBillTo(''); setAddress(''); setClientSearch('');
      setSoaDate(new Date().toISOString().split('T')[0]);
      setDueDate('');
      setDownPayment(''); setWithholdingTax('');
      setItems([newRow()]);
      generateSOANumber().then(setSoaNumber);
      setMessage('SOA saved! Form reset for new entry.');
      setMessageType('success');
    } catch (err) {
      setMessage(`Error: ${err.message}`); setMessageType('error');
    }
    setSaving(false);
    setTimeout(() => setMessage(''), 4000);
  };

  // ── Approve & Email ──
  // FIX: now generates htmlBody via buildSOAEmailHTML and passes it to the edge function
  const handleApproveAndEmail = async () => {
    if (!isApprover) return;

    const filledItems = items.filter(i => i.description || i.amount);
    if (!selectedClient) { setMessage('Please select a client first.'); setMessageType('error'); return; }
    if (filledItems.length === 0) { setMessage('Please add at least one billing item.'); setMessageType('error'); return; }

    const clientEmail = selectedClient?.email_address;
    if (!clientEmail) {
      setMessage('Client has no email address on file. Cannot send email.');
      setMessageType('error');
      return;
    }

    setApproving(true);
    try {
      await upsertBilling('approved', filledItems);
      setSoaStatus('approved');

      // Generate the styled HTML email body
      const htmlBody = buildSOAEmailHTML({
        clientFirstName: selectedClient.first_name || getClientPrimaryName(selectedClient),
        billTo,
        tradeName: selectedClient?.trade_name || '',
        address,
        soaNumber,
        soaDate,
        dueDate,
        items: filledItems,
        subtotal,
        downPayment: dp,
        withholdingTax: wht,
        totalDue,
        notes,
        approvedBy: userFullName,
      });

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
            clientFirstName: selectedClient.first_name || getClientPrimaryName(selectedClient),
            billTo,
            soaNumber,
            soaDate,
            dueDate,
            totalDue,
            subtotal,
            downPayment: dp,
            withholdingTax: wht,
            items: filledItems,
            notes,
            approvedBy: userFullName,
            htmlBody, // ← styled SOA HTML for the email body
          }),
        }
      );

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to send email');

      setMessage(`✅ SOA approved and email sent to ${clientEmail}!`);
      setMessageType('success');
      setSavedBilling(buildSnapshot(filledItems));
    } catch (err) {
      setMessage(`Error: ${err.message}`); setMessageType('error');
    }
    setApproving(false);
    setTimeout(() => setMessage(''), 6000);
  };

  // ── Approve only ──
  const [showApproveDrop, setShowApproveDrop] = useState(false);
  const approveDropRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (approveDropRef.current && !approveDropRef.current.contains(e.target)) setShowApproveDrop(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleApproveOnly = async () => {
    const filledItems = items.filter(i => i.description || i.amount);
    if (!selectedClient || filledItems.length === 0) return;
    setApproving(true);
    setShowApproveDrop(false);
    try {
     await upsertBilling('approved', filledItems);
      setSoaStatus('approved');
      setMessage('SOA approved successfully.');
      setMessageType('success');
    } catch (err) {
      setMessage(`Error: ${err.message}`); setMessageType('error');
    }
    setApproving(false);
    setTimeout(() => setMessage(''), 4000);
  };

  // ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">

      {/* TOP BAR */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-3.5 bg-white border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-base font-semibold text-gray-800">Statement of Account</h1>
            <p className="text-xs text-gray-400 mt-0.5 font-mono">{soaNumber}</p>
          </div>
          <StatusBadge status={soaStatus} />
        </div>

        <div className="flex gap-2">
          {/* Preview — FIX: passes current items even before saving */}
          <button
            onClick={() => {
              setSavedBilling(buildSnapshot());
              setShowPrint(true);
            }}
            className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-gray-600 transition border border-gray-200 rounded-md hover:bg-gray-50"
          >
            <FaPrint size={11} /> Preview
          </button>

          {/* Save split button */}
          <div className="flex" ref={saveDropRef}>
            <button
              onClick={handleSaveDraft}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 transition bg-white border border-gray-300 rounded-l-md hover:bg-gray-50 disabled:opacity-50"
            >
              <FaSave size={11} /> {saving ? 'Saving...' : 'Save draft'}
            </button>
            <button
              onClick={() => setShowSaveDrop(v => !v)}
              className="flex items-center px-2 py-2 text-sm text-gray-600 bg-white border border-l-0 border-gray-300 rounded-r-md hover:bg-gray-50"
            >
              <FaChevronDown size={10} />
            </button>
            {showSaveDrop && (
              <div className="absolute right-0 z-30 mt-10 overflow-hidden bg-white border border-gray-200 rounded-lg shadow-xl w-52"
                style={{ top: '3.5rem', right: isApprover ? '10rem' : '0' }}>
                <button
                  onClick={handleSaveAndAddAnother}
                  className="flex items-center w-full gap-3 px-4 py-3 text-sm text-left text-gray-700 transition border-b hover:bg-gray-50 border-gray-50"
                >
                  <FaPlus size={11} className="text-gray-400" />
                  <div>
                    <p className="font-medium">Save &amp; add another</p>
                    <p className="text-xs text-gray-400">Save as draft, reset form</p>
                  </div>
                </button>
                <button
                  onClick={handleSubmitForApproval}
                  className="flex items-center w-full gap-3 px-4 py-3 text-sm text-left text-gray-700 transition hover:bg-amber-50"
                >
                  <FaExclamationTriangle size={11} className="text-amber-500" />
                  <div>
                    <p className="font-medium">Submit for approval</p>
                    <p className="text-xs text-gray-400">Send to approver</p>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Approve & email — APPROVER ONLY */}
          {isApprover && (
            <div className="flex" ref={approveDropRef}>
              <button
                onClick={handleApproveAndEmail}
                disabled={approving}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white transition rounded-l-md disabled:opacity-50"
                style={{ background: '#1a5c2e' }}
              >
                <FaEnvelope size={11} />
                {approving ? 'Sending...' : 'Approve & email'}
              </button>
              <button
                onClick={() => setShowApproveDrop(v => !v)}
                className="flex items-center px-2 py-2 text-sm text-white rounded-r-md"
                style={{ background: '#1a5c2e', borderLeft: '1px solid #145224' }}
              >
                <FaChevronDown size={10} />
              </button>
              {showApproveDrop && (
                <div className="absolute z-30 mt-10 overflow-hidden bg-white border border-gray-200 rounded-lg shadow-xl w-44"
                  style={{ top: '3.5rem', right: 0 }}>
                  <button
                    onClick={handleApproveOnly}
                    className="flex items-center w-full gap-3 px-4 py-3 text-sm text-left text-gray-700 transition hover:bg-green-50"
                  >
                    <FaCheckCircle size={11} className="text-green-500" />
                    <div>
                      <p className="font-medium">Approve only</p>
                      <p className="text-xs text-gray-400">No email sent</p>
                    </div>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* MESSAGE */}
      {message && (
        <div className={`mx-6 mt-4 px-4 py-3 rounded-md text-sm flex items-center justify-between border-l-4
          ${messageType === 'success' ? 'bg-green-50 border-green-500 text-green-700' : 'bg-red-50 border-red-500 text-red-700'}`}>
          {message}
          <button onClick={() => setMessage('')}><FaTimes size={11} /></button>
        </div>
      )}

      <div className="px-6 py-6 space-y-5">

        {/* SOA DETAILS + CLIENT */}
        <div className="grid grid-cols-2 gap-5">

          {/* SOA Details */}
          <div className="p-5 bg-white border border-gray-200 rounded-lg">
            <p className="mb-4 text-xs font-semibold tracking-wider text-gray-400 uppercase">SOA Details</p>
            <div className="space-y-3">
              <div>
                <label className={labelCls}>SOA Number</label>
                <input type="text" value={soaNumber} readOnly
                  className="w-full px-3 py-2 font-mono text-sm text-gray-400 border border-gray-100 rounded-md cursor-not-allowed bg-gray-50" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>SOA Date</label>
                  <input type="date" value={soaDate} onChange={e => setSoaDate(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Due Date</label>
                  <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={inputCls} />
                </div>
              </div>
            </div>
          </div>

          {/* Bill To */}
          <div className="p-5 bg-white border border-gray-200 rounded-lg">
            <p className="mb-4 text-xs font-semibold tracking-wider text-gray-400 uppercase">Bill To</p>
            <div className="space-y-3">
              <div className="relative" ref={clientRef}>
                <label className={labelCls}>Search client</label>
<div style={{ position: 'relative', overflow: 'hidden' }}>

                  <FaSearch className="absolute text-gray-300 -translate-y-1/2 left-3 top-1/2" size={12} />
                  <input
                    type="text"
                    value={clientSearch}
                    onChange={e => { setClientSearch(e.target.value); setShowClientDrop(true); if (!e.target.value) clearClient(); }}
                    onFocus={() => { searchApprovedClients(clientSearch); setShowClientDrop(true); }}
                    placeholder="Type business name or client ID..."
                    className="w-full py-2 pr-8 text-sm border border-gray-200 rounded-md pl-9 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
                  />
                  {searchLoading && <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />}
                  {clientSearch && !searchLoading && (
                    <button onClick={clearClient} className="absolute text-gray-300 -translate-y-1/2 right-3 top-1/2 hover:text-gray-500">
                      <FaTimes size={11} />
                    </button>
                  )}
                </div>
                {showClientDrop && clientResults.length > 0 && (
                  <div className="absolute left-0 right-0 z-30 mt-1 overflow-hidden bg-white border border-gray-200 rounded-lg shadow-lg top-full">
                    {clientResults.map(c => (
                      <button key={c.id} onClick={() => selectClient(c)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50 text-left border-b border-gray-50 last:border-0 transition">
                        <div className="flex items-center justify-center bg-blue-100 rounded-full w-7 h-7 shrink-0">
                          <FaUser size={10} className="text-blue-500" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-800">{getClientPrimaryName(c)}</p>
                          {c.trade_name && <p className="text-xs text-gray-500">{c.trade_name}</p>}
                          <p className="font-mono text-xs text-gray-400">{c.client_id}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {showClientDrop && clientSearch && clientResults.length === 0 && !searchLoading && (
                  <div className="absolute left-0 right-0 z-30 px-4 py-3 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg top-full">
                    <p className="text-sm text-gray-400">No approved clients found</p>
                  </div>
                )}
              </div>

              {!selectedClient && (
                <div className="px-3 py-3 text-center border border-gray-200 border-dashed rounded-md">
                  <p className="text-xs text-gray-300">No client selected</p>
                </div>
              )}

              {selectedClient && (
                <div className="space-y-2">
                  <div>
                    <label className={labelCls}>{selectedClient.business_name ? 'Business Name' : 'Name'}</label>
                    <input type="text" value={billTo} readOnly disabled
                      className="w-full px-3 py-2 text-sm text-gray-700 border border-gray-100 rounded-md cursor-not-allowed bg-gray-50" />
                  </div>
                  {selectedClient.trade_name && (
                    <div>
                      <label className={labelCls}>Trade Name</label>
                      <input type="text" value={selectedClient.trade_name} readOnly disabled
                        className="w-full px-3 py-2 text-sm text-gray-500 border border-gray-100 rounded-md cursor-not-allowed bg-gray-50" />
                    </div>
                  )}
                  {selectedClient.email_address && (
                    <div>
                      <label className={labelCls}>Email</label>
                      <input type="text" value={selectedClient.email_address} readOnly disabled
                        className="w-full px-3 py-2 text-sm text-gray-500 border border-gray-100 rounded-md cursor-not-allowed bg-gray-50" />
                    </div>
                  )}
                  {address && (
                    <div>
                      <label className={labelCls}>Address</label>
                      <input type="text" value={address} readOnly disabled
                        className="w-full px-3 py-2 text-sm text-gray-500 border border-gray-100 rounded-md cursor-not-allowed bg-gray-50" />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* BILLING ITEMS */}
        <div className="overflow-visible bg-white border border-gray-200 rounded-lg">
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
            <p className="text-xs font-semibold tracking-wider text-gray-400 uppercase">Billing Items</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-400 w-20">Code</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-400 w-36">Agency</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-400">Description of Services</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-400 w-32">Period</th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-gray-400 w-36">Amount</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.map((item) => (
                  <tr key={item.id} className="relative transition group hover:bg-gray-50/50">
                    <td className="px-3 py-2">
                      <input type="text" value={item.account_code}
                        onChange={e => updateItem(item.id, 'account_code', e.target.value)}
                        placeholder="001"
                        className="w-full px-2 py-1.5 text-xs border border-transparent rounded focus:border-blue-300 focus:outline-none focus:bg-white bg-transparent transition" />
                    </td>
                    <td className="px-3 py-2">
                      <div onClick={(e) => openCoaForRow(item.id, e)}
                        className="w-full px-2 py-1.5 text-xs border border-transparent rounded hover:border-blue-200 hover:bg-white cursor-pointer flex items-center justify-between transition">
                        <span className={item.agency ? 'text-gray-700' : 'text-gray-300'}>
                          {item.agency || 'Select agency...'}
                        </span>
                        <FaChevronDown size={8} className="ml-1 text-gray-300 shrink-0" />
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <input type="text" value={item.description}
                        onChange={e => updateItem(item.id, 'description', e.target.value)}
                        placeholder="Add description..."
                        className="w-full px-2 py-1.5 text-xs border border-transparent rounded focus:border-blue-300 focus:outline-none focus:bg-white bg-transparent transition" />
                    </td>
                    <td className="px-3 py-2">
                      <input type="text" value={item.period_covered}
                        onChange={e => updateItem(item.id, 'period_covered', e.target.value)}
                        placeholder="Not Applicable"
                        className="w-full px-2 py-1.5 text-xs border border-transparent rounded focus:border-blue-300 focus:outline-none focus:bg-white bg-transparent transition" />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" value={item.amount}
                        onChange={e => updateItem(item.id, 'amount', e.target.value)}
                        placeholder="0.00" min="0" step="0.01"
                        className="w-full px-2 py-1.5 text-xs text-right border border-transparent rounded focus:border-blue-300 focus:outline-none focus:bg-white bg-transparent font-mono transition" />
                    </td>
                    <td className="px-2 py-2">
                      <button onClick={() => removeItem(item.id)}
                        className="p-1 text-gray-200 transition rounded opacity-0 hover:text-red-400 group-hover:opacity-100">
                        <FaTrash size={10} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* COA Portal */}
          {activeCoaRow !== null && createPortal(
            <div ref={coaPortalRef}
              style={{ position: 'absolute', top: coaDropPos.top, left: coaDropPos.left, width: coaDropPos.width, zIndex: 9999 }}
              className="flex flex-col overflow-hidden bg-white border border-gray-200 rounded-lg shadow-xl max-h-72">
              <div className="p-2 border-b border-gray-100 shrink-0">
                <div style={{ position: 'relative' }}>

                  <FaSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300" size={10} />
                  <input type="text" value={coaSearch} onChange={e => setCoaSearch(e.target.value)}
                    placeholder="Search accounts..." autoFocus
                    className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:border-blue-400" />
                </div>
              </div>
              <div className="flex-1 p-2 space-y-2 overflow-y-auto">
                {coaLoading ? (
                  <div className="flex justify-center py-4">
                    <div className="w-4 h-4 border-2 border-blue-500 rounded-full border-t-transparent animate-spin" />
                  </div>
                ) : Object.keys(groupedCOA).length === 0 ? (
                  <p className="py-4 text-xs text-center text-gray-400">No accounts found</p>
                ) : Object.entries(groupedCOA).map(([agency, accts]) => (
                  <div key={agency}>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-1 px-1">{agency}</p>
                    {accts.map(a => (
                      <button key={a.id}
                        onMouseDown={e => { e.preventDefault(); pickCoaForRow(activeCoaRow, a); }}
                        className="w-full flex items-center justify-between px-2 py-1.5 rounded hover:bg-blue-50 transition text-left">
                        <div className="min-w-0">
                          <p className="text-xs text-gray-700 truncate">{a.account_name}</p>
                          {a.code && <p className="text-[10px] text-gray-400 font-mono">Code: {a.code}</p>}
                        </div>
                        {a.default_amount > 0 && (
                          <span className="text-[10px] font-mono font-semibold text-blue-500 shrink-0 ml-2">
                            ₱{fmt(a.default_amount)}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>,
            document.body
          )}

          {/* ADD ROW */}
          <div className="flex items-center gap-2 px-4 py-3 border-t border-gray-50" ref={addDropRef}>
            <button onClick={() => addRows(1)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600 rounded-md transition">
              <FaPlus size={9} /> Add row
            </button>
            <div className="relative">
              <button onClick={() => setShowAddDrop(v => !v)}
                className="flex items-center px-2 py-1.5 text-xs font-medium border border-gray-200 text-gray-500 hover:border-blue-300 hover:text-blue-600 rounded-md transition">
                <FaChevronDown size={9} />
              </button>
              {showAddDrop && (
                <div className="absolute left-0 z-20 mt-1 overflow-hidden bg-white border border-gray-200 rounded-lg shadow-lg top-full w-36">
                  {[5, 10, 20].map(n => (
                    <button key={n} onClick={() => addRows(n)}
                      className="w-full px-4 py-2 text-sm text-left text-gray-700 transition hover:bg-gray-50">
                      Add {n} rows
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* TOTALS */}
          <div className="px-5 py-4 border-t border-gray-100">
            <div className="flex justify-end">
              <div className="space-y-2 w-72">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Subtotal</span>
                  <span className="font-mono font-medium text-gray-800">₱{fmt(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Less: Down Payment</span>
                  <input type="number" value={downPayment} onChange={e => setDownPayment(e.target.value)}
                    placeholder="0.00" min="0" step="0.01"
                    className="w-32 px-2 py-1 font-mono text-sm text-right border border-gray-200 rounded focus:border-blue-300 focus:outline-none" />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Less: Withholding Tax</span>
                  <input type="number" value={withholdingTax} onChange={e => setWithholdingTax(e.target.value)}
                    placeholder="0.00" min="0" step="0.01"
                    className="w-32 px-2 py-1 font-mono text-sm text-right border border-gray-200 rounded focus:border-blue-300 focus:outline-none" />
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                  <span className="font-semibold text-gray-800">Total Amount Due</span>
                  <span className="font-mono text-lg font-bold" style={{ color: '#1a5c2e' }}>₱{fmt(totalDue)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* ════════════════════════════════════════════════════════
          PRINT PREVIEW MODAL
          ════════════════════════════════════════════════════════ */}
 {showPrint && savedBilling && (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
    <style>{`
      @media print {
        body * { visibility: hidden; }
        .print-area, .print-area * { visibility: visible; }
        .print-area {
          position: fixed;
          top: 0; left: 0;
          width: 100%;
          font-size: 9px;
        }
        @page {
          size: A4 portrait;
          margin: 8mm;
        }
      }
    `}</style>
    <div className="w-full max-w-4xl bg-white rounded-xl shadow-2xl flex flex-col max-h-[95vh] overflow-hidden">


            {/* Modal top bar */}
            <div className="flex items-center justify-between px-6 py-3.5 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-semibold text-gray-800">Statement of Account Preview</h2>
                <StatusBadge status={soaStatus} />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white rounded-md transition"
                  style={{ background: '#1a5c2e' }}
                >
                  <FaPrint size={11} /> Print
                </button>
                <button onClick={() => setShowPrint(false)} className="p-1.5 text-gray-400 hover:text-gray-600 transition">
                  <FaTimes size={14} />
                </button>
              </div>
            </div>

            {/* Scrollable SOA body */}
          <div className="flex-1 p-6 overflow-y-auto bg-gray-100">
  <div className="print-area mx-auto bg-white text-[11px]" style={{ maxWidth: '760px', fontFamily: 'Arial, Helvetica Neue, sans-serif' }}>
                
             {/* ── HEADER ── */}
<div className="flex items-start justify-between gap-4 p-5" style={{ borderBottom: '3px solid #1a5c2e' }}>
  <div className="flex items-start gap-3">
    <img src="/fortiserv_logo.png" style={{ width: 60, height: 60, borderRadius: 8, objectFit: 'contain', flexShrink: 0 }} />
    <div>
      <div style={{ color: '#1a5c2e', fontWeight: 900, fontSize: 20, letterSpacing: 1, lineHeight: 1 }}>FORTISERV</div>
<div style={{ color: '#cc0000', fontWeight: 700, fontSize: 9, marginBottom: 2 }}>BUSINESS MANAGEMENT ENTERPRISE, Co.</div>
      <div style={{ color: '#666', fontStyle: 'italic', fontSize: 8.5, marginBottom: 8 }}>"LET'S MAKE THINGS WORK BETTER..."</div>
      <div style={{ borderTop: '1px solid #1a5c2e', paddingTop: 6 }}>
    <div style={{ borderTop: '1px solid #1a5c2e', paddingTop: 6 }}>
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 16px', fontSize: 8.5, color: '#444' }}>
    <div><span style={{ color: '#1a5c2e', marginRight: 4 }}>●</span> Unit 32-A 3rd Floor M. Arce St. Heroes Del 96 Barangay 74</div>
    <div><span style={{ color: '#1a5c2e', marginRight: 4 }}>✆</span> (02) 8995-0486</div>
    <div style={{ color: '#888', paddingLeft: 12 }}>1400 City of Caloocan NCR Third District Philippines</div>
    <div><span style={{ color: '#1a5c2e', marginRight: 4 }}>✆</span> 0917-315-9779</div>
    <div><span style={{ color: '#1a5c2e', marginRight: 4 }}>✉</span> collectionfbmec@gmail.com</div>
    <div><span style={{ color: '#1a5c2e', marginRight: 4 }}>⊕</span> fortiservbmec@gmail.com</div>
    <div><span style={{ color: '#1a5c2e', marginRight: 4 }}>▣</span> <strong>Tax Registration</strong></div>
    <div><span style={{ color: '#1a5c2e', marginRight: 4 }}>◉</span> FSBMEC Finance</div>
    <div style={{ paddingLeft: 12 }}>Non-VAT Registered</div>
    <div></div>
    <div style={{ paddingLeft: 12 }}>TIN: 008-778-733-00000</div>
  </div>
</div>
      </div>
    </div>
  </div>

  <div className="text-right shrink-0">
    <div style={{ color: '#1a5c2e', fontWeight: 900, fontSize: 18, letterSpacing: 2, marginBottom: 10 }}>
      STATEMENT OF ACCOUNT
    </div>
    <table className="ml-auto text-left" style={{ borderCollapse: 'collapse', border: '1px solid #1a5c2e', fontSize: 9.5, minWidth: 270 }}>
      <tbody>
        {[
          ['Statement of Account No. :', savedBilling.soaNumber],
          ['Bill To :', savedBilling.billTo],
          ...(savedBilling.tradeName ? [['', savedBilling.tradeName]] : []),
          ['Address :', savedBilling.address || '—'],
          ['Statement of Account Date :', savedBilling.soaDate
            ? new Date(savedBilling.soaDate).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
            : '—'],
          ['Due Date :', savedBilling.dueDate
            ? new Date(savedBilling.dueDate).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
            : '—'],
        ].map(([k, v], i) => (
          <tr key={i} style={{ borderBottom: '1px solid #1a5c2e' }}>
            <td style={{ padding: '5px 10px', color: '#1a5c2e', fontWeight: 600, background: '#e8f5ec', whiteSpace: 'nowrap', borderRight: '1px solid #1a5c2e' }}>{k}</td>
            <td style={{ padding: '5px 10px', minWidth: 160, fontStyle: k === '' ? 'italic' : 'normal', color: k === '' ? '#888' : '#222' }}>{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
</div>

                {/* ── BILLING ITEMS ── */}
                <div className="relative">
  

{/* FS watermark seal */}
<div style={{
  position: 'absolute',
  top: '40%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 400,
  height: 200,
  pointerEvents: 'none',
  zIndex: 2,
}}>
  <img
    src={logoBase64}
    style={{
      width: 400,
      height: 300,
      objectFit: 'contain',
      opacity: 0.08,
      mixBlendMode: 'multiply',
    }}
  />
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
                      {Array.from({ length: 15 }).map((_, i) => {
                        const item = savedBilling.items[i];
                        return (
<tr key={i} style={{ 
  background: i % 2 === 0 ? '#fff' : '#f4faf6', 
  borderBottom: '1px solid #e0ede5',
  height: 24,
}}>                            <td style={{ padding: '7px 12px', fontFamily: 'monospace', color: '#555', textAlign: 'center', borderRight: '1px solid #e0ede5' }}>
                              {item?.account_code || ''}
                            </td>
                            <td style={{ padding: '7px 12px', color: '#444', borderRight: '1px solid #e0ede5' }}>
                              {item?.agency || ''}
                            </td>
                            <td style={{ padding: '7px 12px', color: '#222', fontWeight: item ? 500 : 400, borderRight: '1px solid #e0ede5' }}>
                              {item?.description || ''}
                            </td>
                            <td style={{ padding: '7px 12px', color: '#555', borderRight: '1px solid #e0ede5' }}>
                              {item?.period_covered || ''}
                            </td>
                            <td style={{ padding: '7px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: item ? 600 : 400 }}>
                              {item ? `₱${fmt(item.amount)}` : ''}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* ── FOOTER ── */}
                <div className="grid grid-cols-3" style={{ borderTop: '2px solid #1a5c2e' }}>

                  {/* Payment Details */}
                  <div className="p-4" style={{ borderRight: '1px solid #dceee3', fontSize: 8.5 }}>
                    <div style={{ color: '#1a5c2e', fontWeight: 700, fontSize: 9, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, paddingBottom: 4, borderBottom: '1px solid #1a5c2e' }}>
                      Payment Details
                    </div>
                    <div className="flex gap-2 items-start mb-2.5">
                      <div className="flex items-center justify-center rounded-full shrink-0"
                        style={{ width: 26, height: 26, background: '#e8f5ec', border: '1px solid #1a5c2e', fontSize: 12 }}>💵</div>
                      <div>
                        <div style={{ fontWeight: 700, color: '#222' }}>PICK UP (cash / cheque)</div>
                        <div style={{ color: '#666', fontStyle: 'italic' }}>(Kindly advise when to schedule your payment)</div>
                        <div style={{ color: '#222' }}>Our schedule for collection is every<br />
                          <strong>Monday, Wednesday, and Friday.</strong>
                        </div>
                      </div>
                    </div>
                    <div style={{ borderTop: '1px dashed #cde3d4', margin: '6px 0' }} />
                    <div className="flex gap-2 items-start mb-2.5">
                      <div className="flex items-center justify-center rounded-full shrink-0"
                        style={{ width: 26, height: 26, background: '#e8f5ec', border: '1px solid #1a5c2e', fontSize: 12 }}>🏦</div>
                      <div>
                        <div style={{ fontWeight: 700, color: '#222' }}>BANK TRANSFER/DEPOSIT</div>
                        <div style={{ color: '#555' }}>Account Name:</div>
                        <div style={{ fontWeight: 700, color: '#222' }}>FORTISERV BUSINESS MANAGEMENT ENTERPRISE CO.</div>
                      </div>
                    </div>
                    {/* 🔁 Chinabank: replace div with <img src="/assets/chinabank-logo.png" height="20" /> */}
  <div className="flex items-center gap-2 rounded mb-1.5 p-1.5" style={{ 
  background: '#fef2f2',
  overflow: 'hidden',
  maxHeight: 32
}}>
  <img 
    src="/chinabank_logo.jpg" 
    style={{ 
      height: 16, 
      width: 'auto', 
      maxWidth: 40,
      objectFit: 'contain', 
      flexShrink: 0,
      display: 'block'
    }} 
  />
  <div>
    <div style={{ fontSize: 8, color: '#333' }}>Bank: China Bank Corporation</div>
    <div style={{ fontSize: 8, color: '#555' }}>Account Number: 1307000000077</div>
  </div>
</div>
                    {/* 🔁 BDO: replace div with <img src="/assets/bdo-logo.png" height="20" /> */}
<div className="flex items-center gap-2 rounded p-1.5" style={{ 
  background: '#eff4fb',
  overflow: 'hidden',
  maxHeight: 32
}}>
  <img 
    src="/bdo_logo.jpg" 
    style={{ 
      height: 16, 
      width: 'auto', 
      maxWidth: 40,
      objectFit: 'contain', 
      flexShrink: 0,
      display: 'block'
    }} 
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
                    <div className="whitespace-pre-line" style={{ color: '#444', lineHeight: 1.7 }}>
                      {savedBilling.notes}
                    </div>
                  </div>

                  {/* Totals */}
                  <div className="p-4">
                    <table className="w-full" style={{ borderCollapse: 'collapse', fontSize: 9.5 }}>
                      <tbody>
                        <tr style={{ borderBottom: '1px solid #e0ede5' }}>
                          <td style={{ padding: '6px 0', color: '#444' }}>SUBTOTAL</td>
                          <td style={{ padding: '6px 0', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>
                            ₱{fmt(savedBilling.subtotal)}
                          </td>
                        </tr>
                        <tr style={{ borderBottom: '1px solid #e0ede5' }}>
                          <td style={{ padding: '6px 0', color: '#444' }}>Less: Down Payment</td>
                          <td style={{ padding: '6px 0', textAlign: 'right', fontFamily: 'monospace' }}>
                            ₱{fmt(savedBilling.dp)}
                          </td>
                        </tr>
                        <tr style={{ borderBottom: '2px solid #1a5c2e' }}>
                          <td style={{ padding: '6px 0', color: '#444' }}>Less: 10% Withholding Tax</td>
                          <td style={{ padding: '6px 0', textAlign: 'right', fontFamily: 'monospace' }}>
                            ₱{fmt(savedBilling.wht)}
                          </td>
                        </tr>
                        <tr style={{ background: '#1a5c2e' }}>
                          <td style={{ padding: '8px 6px', color: '#fff', fontWeight: 700, fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            TOTAL AMOUNT DUE
                          </td>
                          <td style={{ padding: '8px 6px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 900, fontSize: 13, color: '#fff' }}>
                            ₱{fmt(savedBilling.totalDue)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* ── SIGNATURES ── */}
                <div className="grid grid-cols-2 gap-8 p-5" style={{ borderTop: '1px solid #dceee3', fontSize: 9.5, color: '#555' }}>
                  <div>
                    <div style={{ marginBottom: 4 }}>Prepared by:</div>
                    <div style={{ borderBottom: '1px solid #999', height: 32, marginBottom: 6 }} />
                    <div style={{ color: '#333', fontWeight: 600 }}>{userFullName}</div>
                    <div>Billing Officer</div>
                  </div>
                  <div>
                    <div style={{ marginBottom: 4 }}>Received By:</div>
                    <div style={{ borderBottom: '1px solid #999', height: 32, marginBottom: 8 }} />
                    <div style={{ marginBottom: 4 }}>
                      Designation:{' '}
                      <span style={{ display: 'inline-block', width: 130, borderBottom: '1px solid #999', verticalAlign: 'bottom' }} />
                    </div>
                    <div>
                      Date Received:{' '}
                      <span style={{ display: 'inline-block', width: 100, borderBottom: '1px solid #999', verticalAlign: 'bottom' }} />
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}