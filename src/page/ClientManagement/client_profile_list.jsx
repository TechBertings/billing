import React, { useState, useEffect, useCallback } from 'react';
import {
  Search, Eye, Trash2, FileText, FileSpreadsheet, Filter, X,
  ChevronLeft, ChevronRight,
  ChevronsLeft, ChevronsRight, RefreshCw, Download, Check, AlertTriangle,
  ArrowDownUp,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

/* ── Shared look (same as tax_type / business_registration / etc.) ── */
const inputCls   = "w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-md focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-200";
const labelCls   = "block mb-1 text-xs font-medium text-gray-500";
const btnPrimary = "flex items-center justify-center gap-2 px-3.5 py-2 text-sm font-medium text-white transition bg-gray-900 rounded-md hover:bg-black disabled:opacity-50";
const btnGhost   = "flex items-center justify-center gap-2 px-3.5 py-2 text-sm font-medium text-gray-600 transition bg-white border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50";
const iconBtn    = "p-1.5 text-gray-400 transition rounded-md hover:bg-gray-100 hover:text-black disabled:opacity-30 disabled:cursor-not-allowed";
const thCls      = "px-5 py-3 text-xs font-medium text-left text-gray-500 whitespace-nowrap";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const PAGE_SIZE_OPTIONS = [25, 50, 100];

const SORT_OPTIONS = [
  { value: 'client_id_desc',          label: 'Client ID (Newest)' },
  { value: 'client_id_asc',           label: 'Client ID (Oldest)' },
  { value: 'business_name_asc',       label: 'Business Name A→Z' },
  { value: 'business_name_desc',      label: 'Business Name Z→A' },
  { value: 'date_of_coverage_desc',   label: 'Coverage (Newest)' },
  { value: 'date_of_coverage_asc',    label: 'Coverage (Oldest)' },
  { value: 'date_of_expiration_asc',  label: 'Contract Expiring' },
];

const ACCOUNT_TABS = ['All', 'Summit', 'Horizon'];

// A client counts as "New" if it was added within the last NEW_DAYS days.
// Change this number to adjust what "New" means.
const NEW_DAYS = 30;

const AGE_TABS = [
  { value: 'all',      label: 'All Clients' },
  { value: 'new',      label: 'New' },
  { value: 'existing', label: 'Existing' },
];

// Table headers — `key` makes the column sortable (click to toggle asc/desc)
const TABLE_COLS = [
  { key: null,                       label: '#' },
  { key: 'client_id',                label: 'Client ID' },
  { key: 'business_name',            label: 'Business Name' },
  { key: 'account',                  label: 'Account' },
  { key: 'tax_type',                 label: 'Tax Type' },
  { key: 'tax_payer_classification', label: 'Classification' },
  { key: 'tin',                      label: 'TIN' },
  { key: 'contact_person',           label: 'Contact' },
  { key: 'date_of_coverage',         label: 'Coverage' },
  { key: 'approval_status',          label: 'Status' },
  { key: null,                       label: '' },
];

const isNewClient = (c) =>
  !!c.created_at && Date.now() - new Date(c.created_at).getTime() <= NEW_DAYS * 86400000;

const getInitials = (name = '') =>
  (name || '').split(/\s+/).filter(Boolean).slice(0, 2).map(n => n[0]).join('').toUpperCase() || '—';

const ALL_COLS = [
  { key: 'client_id',                   label: 'Client ID',           default: true  },
  { key: 'business_name',               label: 'Business Name',       default: true  },
  { key: 'trade_name',                  label: 'Trade Name',          default: false },
  { key: 'account',                     label: 'Account',             default: true  },
  { key: 'tax_payer_classification',    label: 'Tax Classification',  default: true  },
  { key: 'tax_type',                    label: 'Tax Type',            default: true  },
  { key: 'line_of_business',            label: 'Line of Business',    default: true  },
  { key: 'business_registration',       label: 'Biz Registration',    default: false },
  { key: 'tin',                         label: 'TIN',                 default: true  },
  { key: 'contact_person',              label: 'Contact Person',      default: true  },
  { key: 'contact_number',              label: 'Contact No.',         default: false },
  { key: 'email_address',               label: 'Email',               default: false },
  { key: 'registered_business_address', label: 'Address',             default: false },
  { key: 'rdo',                         label: 'RDO',                 default: false },
  { key: 'date_of_coverage',            label: 'Date of Coverage',    default: true  },
  // NOTE: the real column in the DB is approval_status (was 'status' before, so exports came out blank)
  { key: 'approval_status',             label: 'Status',              default: true  },
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

function sortClients(arr, val) {
  const parts = val.split('_');
  const dir   = parts.pop();
  const field = parts.join('_');
  return [...arr].sort((a, b) => {
    const av = (a[field] || '').toString();
    const bv = (b[field] || '').toString();
    // Blank values always go to the bottom, whichever direction you sort
    if (!av && !bv) return 0;
    if (!av) return 1;
    if (!bv) return -1;
    const cmp = av.localeCompare(bv, undefined, { numeric: field === 'client_id' });
    return dir === 'asc' ? cmp : -cmp;
  });
}

// Minimal badges: dark = approved, gray = pending / other, red text = inactive
const statusColor = s => ({
  approved: 'bg-gray-900 text-white',
  pending:  'bg-gray-100 text-gray-600',
  inactive: 'bg-red-50 text-red-600',
}[s] || 'bg-gray-100 text-gray-500');

// ─── FETCH ALL (bypass Supabase 1000-row limit) ───────────────────────────────
async function fetchAllClients() {
  const BATCH = 1000;
  let all = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('client_profile')
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, from + BATCH - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < BATCH) break; // last page
    from += BATCH;
  }
  return all;
}

// ─── EXPORT: EXCEL via SheetJS ────────────────────────────────────────────────
function exportExcel(groups, cols, filterDesc) {
  const XLSX = window.XLSX;
  if (!XLSX) { alert('SheetJS not loaded yet, please wait a moment and try again.'); return; }

  const wb = XLSX.utils.book_new();
  const totalRecords = groups.reduce((s, g) => s + g.rows.length, 0);

  // COVER SHEET
  const summaryAoa = [
    ['FORTISERV BUSINESS MANAGEMENT SERVICES', ''],
    ['Client Masterlist Report', ''],
    ['', ''],
    ['REPORT DETAILS', ''],
    ['Generated', new Date().toLocaleString('en-PH')],
    ['Filter Applied', filterDesc],
    ['Total Records', totalRecords],
    ['', ''],
    ['GROUP BREAKDOWN', 'RECORD COUNT'],
    ...groups.map(g => [g.label || 'All Clients', g.rows.length]),
  ];
  const summaryWs = XLSX.utils.aoa_to_sheet(summaryAoa);
  summaryWs['!cols'] = [{ wch: 30 }, { wch: 50 }];
  summaryWs['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } },
  ];
  XLSX.utils.book_append_sheet(wb, summaryWs, 'Cover');

  // DATA SHEETS
  groups.forEach(({ label, rows }) => {
    const sheetName = (label || 'All Clients').replace(/[:/\\?*]/g, '-').slice(0, 31);
    const colHeaders = ['#', ...cols.map(c => c.label)];
    const dataRows = rows.map((r, i) => [
      i + 1,
      ...cols.map(c => c.key === 'date_of_coverage' ? fmtDate(r[c.key]) : (r[c.key] || '')),
    ]);
    const wsAoa = [
      ['FORTISERV', 'CLIENT MASTERLIST', '', '', '', ''],
      [`Group: ${label || 'All Clients'}`, `${rows.length} records`, '', `Filter: ${filterDesc}`, '', `Generated: ${new Date().toLocaleDateString('en-PH')}`],
      [],
      colHeaders,
      ...dataRows,
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsAoa);
    ws['!cols'] = [{ wch: 5 }, ...cols.map(c => ({ wch: Math.max(c.label.length + 6, 16) }))];
    ws['!rows'] = [{ hpt: 22 }, { hpt: 16 }, { hpt: 6 }, { hpt: 18 }];
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });

  XLSX.writeFile(wb, `fortiserv_client_masterlist_${new Date().toISOString().split('T')[0]}.xlsx`);
}

function exportPDF(groups, cols, filterDesc) {
  const jsPDFLib = window.jspdf;
  if (!jsPDFLib || !jsPDFLib.jsPDF) {
    alert('jsPDF not loaded yet, please wait a moment and try again.');
    return;
  }
  const { jsPDF } = jsPDFLib;

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
    canvas.getContext('2d').drawImage(img, 0, 0);
    renderPDF(jsPDF, canvas.toDataURL('image/png'));
  };
  img.onerror = () => renderPDF(jsPDF, null);
  img.src = '/fs.png';

  function renderPDF(jsPDF, logoB64) {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();   // 841.89
    const pageH = doc.internal.pageSize.getHeight();  // 595.28
    const mL = 30, mR = 30;
    const usableW = pageW - mL - mR;
    let page = 1;

    // ── Column layout ─────────────────────────────────────────────────────
    // Short header labels to prevent overlap
    const SHORT_LABELS = {
      client_id: 'Client ID', business_name: 'Biz Name', trade_name: 'Trade Name',
      account: 'Account', tax_payer_classification: 'Tax Class.', tax_type: 'Tax Type',
      line_of_business: 'Line of Biz', business_registration: 'Biz Reg.',
      tin: 'TIN', contact_person: 'Contact', contact_number: 'Contact No.',
      email_address: 'Email', registered_business_address: 'Address',
      rdo: 'RDO', date_of_coverage: 'Coverage', approval_status: 'Status',
    };

    // Fixed col widths — don't scale, just ensure total fits
    const colW_map = {
      client_id: 52, business_name: 85, trade_name: 65, account: 44,
      tax_payer_classification: 72, tax_type: 44, line_of_business: 72,
      business_registration: 60, tin: 65, contact_person: 65,
      contact_number: 55, email_address: 75, registered_business_address: 85,
      rdo: 30, date_of_coverage: 58, approval_status: 44,
    };
    const rawWidths = cols.map(c => colW_map[c.key] || 60);
    const totalRaw  = rawWidths.reduce((a, b) => a + b, 0) + 18;
    const scale     = usableW / totalRaw;
    const scaledW   = rawWidths.map(w => Math.round(w * scale));
    const numColW   = Math.round(18 * scale);

    const ROW_H  = 14;
    const HEAD_H = 24; // taller to allow 2-line wrapped labels
    const totalRecords = groups.reduce((s, g) => s + g.rows.length, 0);

    // ── Page header ───────────────────────────────────────────────────────
    const drawPageHeader = () => {
      // Thin top bar
      doc.setFillColor(15, 96, 90);
      doc.rect(0, 0, pageW, 34, 'F');

      // Logo
      if (logoB64) {
        doc.addImage(logoB64, 'PNG', mL, 2, 28, 28);
      }
      const lOff = logoB64 ? 34 : 0;

      // Company name
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(11); doc.setFont('helvetica', 'bold');
      doc.text('FORTISERV', mL + lOff, 15);
      doc.setFontSize(6.5); doc.setFont('helvetica', 'normal');
      doc.text('Business Management Services', mL + lOff, 25);

      // Center: report title
      doc.setFontSize(9); doc.setFont('helvetica', 'bold');
      doc.text('CLIENT MASTERLIST', pageW / 2, 14, { align: 'center' });
      doc.setFontSize(6); doc.setFont('helvetica', 'normal');
      const fd = filterDesc.length > 90 ? filterDesc.slice(0, 88) + '...' : filterDesc;
      doc.text(fd, pageW / 2, 24, { align: 'center' });

      // Right: page + date
      doc.setFontSize(7);
      doc.text(`Page ${page}`, pageW - mR, 14, { align: 'right' });
      doc.text(new Date().toLocaleDateString('en-PH'), pageW - mR, 24, { align: 'right' });

      return 40; // startY
    };

    // ── Page footer ───────────────────────────────────────────────────────
    const drawPageFooter = () => {
      doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.5);
      doc.line(mL, pageH - 18, pageW - mR, pageH - 18);
      doc.setFontSize(6); doc.setTextColor(160, 160, 160);
      doc.text('Confidential — Fortiserv Business Management Services', mL, pageH - 8);
      doc.text(`${totalRecords} total records  ·  Page ${page}`, pageW - mR, pageH - 8, { align: 'right' });
    };

    // ── Table column headers (wrapped to prevent overlap) ─────────────────
    const drawTableHead = (y) => {
      doc.setFillColor(15, 96, 90);
      doc.rect(mL, y, usableW, HEAD_H, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(5.8); doc.setFont('helvetica', 'bold');

      let cx = mL + 2;
      // # column
      doc.text('#', cx, y + HEAD_H - 6);
      cx += numColW;

      cols.forEach((c, i) => {
        const label = (SHORT_LABELS[c.key] || c.label).toUpperCase();
        const cellW = scaledW[i] - 3;
        const x = cx + 2;

        // Split into 2 lines if label is wider than cell (approx 5.5pt per char at 5.8pt font)
        const charW = 3.4;
        const maxPerLine = Math.floor(cellW / charW);

        let line1 = label, line2 = '';
        if (label.length > maxPerLine) {
          // Try to break at a space near the middle
          const mid = Math.floor(label.length / 2);
          let breakAt = label.lastIndexOf(' ', mid + 4);
          if (breakAt <= 0) breakAt = label.indexOf(' ');
          if (breakAt > 0) {
            line1 = label.slice(0, breakAt);
            line2 = label.slice(breakAt + 1);
          } else {
            // No space, force break
            line1 = label.slice(0, maxPerLine);
            line2 = label.slice(maxPerLine);
          }
        }

        if (line2) {
          doc.text(line1, x, y + 9);
          doc.text(line2, x, y + 18);
        } else {
          doc.text(line1, x, y + HEAD_H - 7);
        }
        cx += scaledW[i];
      });
      return y + HEAD_H;
    };

    // ── Data row ──────────────────────────────────────────────────────────
    const drawRow = (row, rowNum, y, isEven) => {
      if (isEven) {
        doc.setFillColor(236, 247, 245);
        doc.rect(mL, y, usableW, ROW_H, 'F');
      }
      // Row bottom border
      doc.setDrawColor(230, 230, 230); doc.setLineWidth(0.3);
      doc.line(mL, y + ROW_H, mL + usableW, y + ROW_H);

      doc.setFontSize(6.0); doc.setFont('helvetica', 'normal');

      let cx = mL + 2;
      doc.setTextColor(180, 180, 190);
      doc.text(String(rowNum), cx, y + ROW_H - 4);
      cx += numColW;

      cols.forEach((c, i) => {
        let val = c.key === 'date_of_coverage' ? fmtDate(row[c.key]) : (row[c.key] || '');
        const isEmpty = !val;
        doc.setTextColor(isEmpty ? 200 : 30, isEmpty ? 200 : 41, isEmpty ? 200 : 59);
        if (isEmpty) val = '-';
        // Hard truncate to fit cell
        const maxChars = Math.floor((scaledW[i] - 4) / 3.6);
        if (val.length > maxChars) val = val.slice(0, maxChars - 1) + '\u2026';
        doc.text(val, cx + 2, y + ROW_H - 4);
        cx += scaledW[i];
      });
    };

    // ── Group section header ───────────────────────────────────────────────
    const drawGroupHeader = (label, count, y) => {
      doc.setFillColor(214, 240, 235);
      doc.rect(mL, y, usableW, 15, 'F');
      doc.setFillColor(15, 96, 90);
      doc.rect(mL, y, 3, 15, 'F');
      doc.setTextColor(13, 79, 74);
      doc.setFontSize(7.5); doc.setFont('helvetica', 'bold');
      doc.text(label, mL + 8, y + 10.5);
      doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 116, 139);
      doc.text(`${count} records`, mL + usableW - 4, y + 10.5, { align: 'right' });
      return y + 19;
    };

    // ── RENDER ────────────────────────────────────────────────────────────
    let y = drawPageHeader();
    drawPageFooter();

    groups.forEach(({ label, rows }) => {
      // Group header
      if (label) {
        if (y + 20 > pageH - 26) {
          doc.addPage(); page++; y = drawPageHeader(); drawPageFooter();
        }
        y = drawGroupHeader(label, rows.length, y);
      }

      // Column header
      if (y + HEAD_H > pageH - 26) {
        doc.addPage(); page++; y = drawPageHeader(); drawPageFooter();
      }
      y = drawTableHead(y);

      // Rows
      rows.forEach((row, idx) => {
        if (y + ROW_H > pageH - 24) {
          doc.addPage(); page++;
          y = drawPageHeader(); drawPageFooter();
          y = drawTableHead(y);
        }
        drawRow(row, idx + 1, y, idx % 2 === 1);
        y += ROW_H;
      });

      y += 10; // gap between groups
    });

    doc.save(`fortiserv_masterlist_${new Date().toISOString().split('T')[0]}.pdf`);
  }
}

// ─── UI COMPONENTS ────────────────────────────────────────────────────────────
const Toast = ({ msg, type }) =>
  msg ? (
    <div
      className={`fixed z-50 flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-white border rounded-md shadow-lg bottom-6 right-6 ${
        type === 'error' ? 'text-red-700 border-red-200' : 'text-gray-800 border-gray-200'
      }`}
    >
      {type === 'error' ? <AlertTriangle size={14} /> : <Check size={14} />}
      {msg}
    </div>
  ) : null;

const Modal = ({ title, subtitle, onClose, wide, children }) => (
  <div
    className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/40"
    onClick={(e) => e.target === e.currentTarget && onClose()}
  >
    <div
      className={`w-full ${wide ? 'max-w-2xl' : 'max-w-md'} max-h-[90vh] flex flex-col bg-white border border-gray-200 rounded-lg shadow-xl`}
    >
      <div className="flex items-start justify-between px-6 pt-5 shrink-0">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-gray-800 truncate">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
        </div>
        <button type="button" onClick={onClose} className={iconBtn}>
          <X size={16} />
        </button>
      </div>
      {children}
    </div>
  </div>
);

const Section = ({ title, children }) => (
  <div className="mb-6">
    <p className="pb-1 mb-3 text-xs font-semibold text-gray-800 border-b border-gray-200">{title}</p>
    <div className="grid grid-cols-2 gap-x-8 gap-y-3">{children}</div>
  </div>
);

const DField = ({ label, value, mono, span2 }) => value ? (
  <div className={span2 ? 'col-span-2' : ''}>
    <p className="mb-0.5 text-xs text-gray-500">{label}</p>
    <p className={`text-sm text-gray-800 break-words ${mono ? 'font-mono' : ''}`}>{value}</p>
  </div>
) : null;

// ─── HOVER SEARCH ─────────────────────────────────────────────────────────────
// Icon only. Hover it and the input slides out. Stays open while you're typing
// (focused) or while there's still text in the search box.
function HoverSearch({ value, onChange }) {
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const open = hover || focus || !!value;

  return (
    <div
      className="flex items-center"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <button type="button" title="Search" className={`${btnGhost} !px-2.5`}>
        <Search size={15} />
      </button>
      <div
        className={`relative overflow-hidden transition-all duration-200 ${
          open ? 'w-64 ml-2 opacity-100' : 'w-0 ml-0 opacity-0'
        }`}
      >
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          placeholder="Search name, ID, TIN, email..."
          className={`${inputCls} pr-8`}
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute text-gray-400 -translate-y-1/2 right-3 top-1/2 hover:text-black"
          >
            <X size={13} />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── HOVER SORT (icon only → "Arrange by" menu fades in on hover) ────────────
function HoverSort({ value, onChange, options }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        title="Arrange by"
        onClick={() => setOpen(true)} // tap works on touch screens too
        className={`${btnGhost} !px-2.5 ${open ? '!bg-gray-50 !text-gray-900' : ''}`}
      >
        <ArrowDownUp size={15} />
      </button>

      {/* Always mounted so it can fade/slide smoothly. pt-1 (not margin) = no hover gap */}
      <div
        className={`absolute left-0 z-30 w-56 pt-1 top-full transition-all duration-200 ease-out ${
          open ? 'opacity-100 visible translate-y-0' : 'opacity-0 invisible -translate-y-1'
        }`}
      >
        <div className="py-1 bg-white border border-gray-200 rounded-md shadow-lg">
          <p className="px-3.5 pt-1.5 pb-1 text-xs text-gray-400">Arrange by</p>
          {options.map(o => (
            <button
              key={o.value}
              type="button"
              onClick={() => { onChange(o.value); setOpen(false); }}
              className={`flex items-center justify-between w-full px-3.5 py-2 text-sm text-left transition hover:bg-gray-50 ${
                value === o.value ? 'font-medium text-gray-900' : 'text-gray-500'
              }`}
            >
              {o.label}
              {value === o.value && <Check size={13} />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── HOVER FILTER (icon only → filter panel fades in on hover) ───────────────
// Stays open while any dropdown inside it is focused, so picking an option
// doesn't make the panel disappear.
function HoverFilter({ filters, activeCount, onClear }) {
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const open = hover || focus;

  return (
    <div
      className="relative"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setFocus(true)}
      onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setFocus(false); }}
    >
      <button
        type="button"
        title="Filters"
        className={`${btnGhost} relative !px-2.5 ${open ? '!bg-gray-50 !text-gray-900' : ''}`}
      >
        <Filter size={15} />
        {activeCount > 0 && (
          <span className="absolute flex items-center justify-center w-4 h-4 text-[10px] font-medium text-white bg-gray-900 rounded-full -top-1.5 -right-1.5">
            {activeCount}
          </span>
        )}
      </button>

      <div
        className={`absolute left-0 z-30 w-[min(92vw,560px)] pt-1 top-full transition-all duration-200 ease-out ${
          open ? 'opacity-100 visible translate-y-0' : 'opacity-0 invisible -translate-y-1'
        }`}
      >
        <div className="p-4 bg-white border border-gray-200 rounded-lg shadow-lg">
          <div className="grid grid-cols-2 gap-3">
            {filters.map(f => (
              <div key={f.label}>
                <label className={labelCls}>{f.label}</label>
                <select value={f.val} onChange={e => f.set(e.target.value)} className={inputCls}>
                  {f.opts.map(o => <option key={o} value={o}>{o === 'all' ? 'All' : o}</option>)}
                </select>
              </div>
            ))}
          </div>
          {activeCount > 0 && (
            <div className="flex justify-end mt-3">
              <button type="button" onClick={onClear} className="text-xs font-medium text-gray-500 hover:text-black">
                Clear filters
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── PAGINATION COMPONENT ─────────────────────────────────────────────────────
function Pagination({ currentPage, totalPages, onPageChange, pageSize, onPageSizeChange, totalRecords }) {
  const from = totalRecords === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const to   = Math.min(currentPage * pageSize, totalRecords);

  const pages = [];
  const delta = 2;
  for (let i = Math.max(1, currentPage - delta); i <= Math.min(totalPages, currentPage + delta); i++) {
    pages.push(i);
  }

  const pageBtn = (active) =>
    `w-8 h-8 text-xs rounded-md transition ${
      active ? 'bg-gray-900 text-white font-medium' : 'text-gray-600 hover:bg-gray-100'
    }`;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-t border-gray-100 bg-gray-50">
      <div className="flex items-center gap-3 text-xs text-gray-500">
        <span>Rows per page</span>
        <select value={pageSize} onChange={e => { onPageSizeChange(Number(e.target.value)); onPageChange(1); }}
          className="px-2 py-1 text-xs bg-white border border-gray-200 rounded-md cursor-pointer focus:outline-none focus:border-gray-400">
          {PAGE_SIZE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <span>{from}–{to} of {totalRecords}</span>
      </div>

      <div className="flex items-center gap-1">
        <button onClick={() => onPageChange(1)} disabled={currentPage === 1} className={iconBtn}>
          <ChevronsLeft size={14} />
        </button>
        <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} className={iconBtn}>
          <ChevronLeft size={14} />
        </button>

        {pages[0] > 1 && (
          <>
            <button onClick={() => onPageChange(1)} className={pageBtn(false)}>1</button>
            {pages[0] > 2 && <span className="px-1 text-xs text-gray-300">…</span>}
          </>
        )}

        {pages.map(p => (
          <button key={p} onClick={() => onPageChange(p)} className={pageBtn(p === currentPage)}>
            {p}
          </button>
        ))}

        {pages[pages.length - 1] < totalPages && (
          <>
            {pages[pages.length - 1] < totalPages - 1 && <span className="px-1 text-xs text-gray-300">…</span>}
            <button onClick={() => onPageChange(totalPages)} className={pageBtn(false)}>{totalPages}</button>
          </>
        )}

        <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages || totalPages === 0} className={iconBtn}>
          <ChevronRight size={14} />
        </button>
        <button onClick={() => onPageChange(totalPages)} disabled={currentPage === totalPages || totalPages === 0} className={iconBtn}>
          <ChevronsRight size={14} />
        </button>
      </div>
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function ClientProfileList() {
  const [clients, setClients]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [fetching, setFetching]     = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAccount, setFilterAccount]   = useState('All');
  const [filterTaxType, setFilterTaxType]   = useState('all');
  const [filterTaxClass, setFilterTaxClass] = useState('all');
  const [filterLOB, setFilterLOB]           = useState('all');
  const [filterStatus, setFilterStatus]     = useState('all');
  const [sortVal, setSortVal]       = useState('client_id_desc');
  const [ageTab, setAgeTab]         = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize]     = useState(50);
  const [selectedClient, setSelectedClient] = useState(null);
  const [message, setMessage]       = useState('');
  const [messageType, setMessageType] = useState('');
  const [showExport, setShowExport] = useState(false);
  const [libsLoaded, setLibsLoaded] = useState(false);
  const [exportCols, setExportCols] = useState(
    ALL_COLS.reduce((acc, c) => ({ ...acc, [c.key]: c.default }), {})
  );

  // Auto-hide toast
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(''), 3500);
    return () => clearTimeout(t);
  }, [message]);

  // Load export libraries (SheetJS + jsPDF only — no autoTable)
  useEffect(() => {
    const urls = [
      'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    ];
    let done = 0;
    const checkDone = () => { done++; if (done === urls.length) setLibsLoaded(true); };
    urls.forEach(src => {
      if (document.querySelector(`script[src="${src}"]`)) { checkDone(); return; }
      const s = document.createElement('script');
      s.src = src; s.async = true;
      s.onload = checkDone;
      s.onerror = checkDone; // don't block on error
      document.head.appendChild(s);
    });
  }, []);

  const fetchClients = useCallback(async () => {
    try {
      setFetching(true);
      const data = await fetchAllClients();
      setClients(data);
    } catch (err) {
      setMessage(`Error: ${err.message}`);
      setMessageType('error');
    } finally {
      setLoading(false);
      setFetching(false);
    }
  }, []);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  // Reset to page 1 when filters/sort change
  useEffect(() => { setCurrentPage(1); }, [searchTerm, filterAccount, filterTaxType, filterTaxClass, filterLOB, filterStatus, ageTab, sortVal]);

  const handleDelete = async (id) => {
    if (!window.confirm('Deactivate this client?')) return;
    try {
      const { error } = await supabase.from('client_profile').update({ approval_status: 'inactive' }).eq('id', id);
      if (error) throw error;
      setMessage('Client deactivated.'); setMessageType('success');
      fetchClients(); setSelectedClient(null);
    } catch (err) { setMessage(err.message); setMessageType('error'); }
  };

  // Unique dropdown values from all loaded clients
  const uniq = field => ['all', ...new Set(clients.map(c => c[field]).filter(Boolean))];

  // Tab counts follow the Account filter so they match what each tab will show
  const baseClients = clients.filter(c => filterAccount === 'All' || c.account === filterAccount);
  const newCount    = baseClients.filter(isNewClient).length;
  const tabCounts   = { all: baseClients.length, new: newCount, existing: baseClients.length - newCount };

  // Filter all clients
  const filtered = clients.filter(c => {
    if (filterAccount !== 'All' && c.account !== filterAccount) return false;
    if (ageTab === 'new' && !isNewClient(c)) return false;
    if (ageTab === 'existing' && isNewClient(c)) return false;
    if (filterTaxType !== 'all' && c.tax_type !== filterTaxType) return false;
    if (filterTaxClass !== 'all' && c.tax_payer_classification !== filterTaxClass) return false;
    if (filterLOB !== 'all' && c.line_of_business !== filterLOB) return false;
    if (filterStatus !== 'all' && c.approval_status !== filterStatus) return false;
    if (searchTerm.trim()) {
      const t = searchTerm.toLowerCase();
      return ['business_name','client_id','email_address','tin','contact_person']
        .some(k => (c[k] || '').toLowerCase().includes(t));
    }
    return true;
  });

  const sorted      = sortClients(filtered, sortVal);
  const totalPages  = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paginated   = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const allGroups   = [{ label: null, rows: sorted }];          // export (all records)
  const activeCols  = ALL_COLS.filter(c => exportCols[c.key]);

  const filterDesc = [
    filterAccount !== 'All' ? `Account: ${filterAccount}` : '',
    filterTaxType !== 'all' ? `Tax: ${filterTaxType}` : '',
    filterTaxClass !== 'all' ? `Class: ${filterTaxClass}` : '',
    filterLOB !== 'all' ? `LOB: ${filterLOB}` : '',
    filterStatus !== 'all' ? `Status: ${filterStatus}` : '',
    searchTerm ? `"${searchTerm}"` : '',
  ].filter(Boolean).join(' · ') || 'All Clients';

  const activeFilterCount = [filterTaxType, filterTaxClass, filterLOB, filterStatus].filter(v => v !== 'all').length;

  const filterDefs = [
    { label: 'Tax Type',         val: filterTaxType,  set: setFilterTaxType,  opts: uniq('tax_type') },
    { label: 'Classification',   val: filterTaxClass, set: setFilterTaxClass, opts: uniq('tax_payer_classification') },
    { label: 'Line of Business', val: filterLOB,      set: setFilterLOB,      opts: uniq('line_of_business') },
    { label: 'Status',           val: filterStatus,   set: setFilterStatus,   opts: uniq('approval_status') },
  ];
  const clearFilters = () => {
    setFilterTaxType('all'); setFilterTaxClass('all'); setFilterLOB('all'); setFilterStatus('all');
  };

  if (loading) return (
    <div className="flex items-center justify-center gap-2 py-24 text-sm text-gray-400">
      <RefreshCw size={14} className="animate-spin" /> Loading all client records...
    </div>
  );

  return (
    <div className="px-6 py-6 mx-auto max-w-screen-2xl">
      <Toast msg={message} type={messageType} />

      {/* ── HEADER ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Client Masterlist</h2>
          <p className="text-xs text-gray-500">
            {filtered.length} of {clients.length} records · {filterDesc}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchClients} disabled={fetching} title="Refresh" className={iconBtn}>
            <RefreshCw size={15} className={fetching ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => setShowExport(true)} className={btnPrimary}>
            <Download size={14} /> Export
          </button>
        </div>
      </div>

      {/* ── CLIENT TABS: All / New / Existing ── */}
      <div className="flex items-center gap-6 mb-5 border-b border-gray-200">
        {AGE_TABS.map(t => (
          <button
            key={t.value}
            type="button"
            onClick={() => setAgeTab(t.value)}
            className={`flex items-center gap-2 pb-3 -mb-px text-sm font-medium border-b-2 transition ${
              ageTab === t.value
                ? 'text-gray-900 border-gray-900'
                : 'text-gray-500 border-transparent hover:text-gray-800'
            }`}
          >
            {t.label}
            <span className={`px-1.5 text-xs rounded ${
              ageTab === t.value ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500'
            }`}>
              {tabCounts[t.value]}
            </span>
          </button>
        ))}
      </div>

      {/* ── TOOLBAR: search · arrange by · filters (icons, reveal on hover) · account ── */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <HoverSearch value={searchTerm} onChange={setSearchTerm} />
        <HoverSort value={sortVal} onChange={setSortVal} options={SORT_OPTIONS} />
        <HoverFilter filters={filterDefs} activeCount={activeFilterCount} onClear={clearFilters} />
        <select value={filterAccount} onChange={e => setFilterAccount(e.target.value)} className={`${inputCls} !w-auto`}>
          {ACCOUNT_TABS.map(a => <option key={a} value={a}>{a === 'All' ? 'All Accounts' : a}</option>)}
        </select>
      </div>

      {/* ── TABLE ── */}
      <div className="overflow-hidden bg-white border border-gray-200 rounded-lg">
        {paginated.length === 0 ? (
          <div className="py-12 text-center text-gray-400">
            {searchTerm || activeFilterCount > 0 || filterAccount !== 'All' || ageTab !== 'all'
              ? 'No clients match your search.'
              : 'No clients found.'}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-100 bg-gray-50">
                  <tr>
                    {TABLE_COLS.map((col, i) => (
                      <th key={i} className={thCls}>{col.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((c, idx) => {
                    const globalIdx = (currentPage - 1) * pageSize + idx;
                    return (
                      <tr key={c.id} className="border-t border-gray-100 group hover:bg-gray-50">
                        <td className="px-5 py-4 text-xs text-gray-300 tabular-nums">{globalIdx + 1}</td>
                        <td className="px-5 py-4">
                          <span className="px-2 py-0.5 font-mono text-xs text-gray-600 bg-gray-100 rounded">{c.client_id}</span>
                        </td>
                        <td className="px-5 py-4 min-w-[220px]">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center text-xs font-medium text-gray-600 bg-gray-100 rounded-full w-9 h-9 shrink-0">
                              {getInitials(c.business_name)}
                            </div>
                            <div className="min-w-0">
                              <p className="flex items-center gap-2 text-gray-800">
                                {c.business_name || '—'}
                                {isNewClient(c) && (
                                  <span className="px-1.5 py-0.5 text-xs font-medium text-white bg-gray-900 rounded">New</span>
                                )}
                              </p>
                              {c.trade_name && <p className="mt-0.5 text-xs text-gray-400">{c.trade_name}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-gray-600 whitespace-nowrap">{c.account || '—'}</td>
                        <td className="px-5 py-4 text-gray-600 whitespace-nowrap">{c.tax_type || '—'}</td>
                        <td className="px-5 py-4 text-gray-600 max-w-[150px]">
                          <span title={c.tax_payer_classification} className="block truncate">{c.tax_payer_classification || '—'}</span>
                        </td>
                        <td className="px-5 py-4 font-mono text-xs text-gray-600 whitespace-nowrap">{c.tin || '—'}</td>
                        <td className="px-5 py-4 text-gray-600 whitespace-nowrap">
                          <p>{c.contact_person || '—'}</p>
                          {(c.email_address || c.contact_number) && (
                            <p className="mt-0.5 text-xs text-gray-400">
                              {[c.email_address, c.contact_number].filter(Boolean).join(' · ')}
                            </p>
                          )}
                        </td>
                        <td className="px-5 py-4 text-gray-500 whitespace-nowrap">{fmtDate(c.date_of_coverage)}</td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span className={`px-2 py-0.5 text-xs font-medium rounded capitalize ${statusColor(c.approval_status)}`}>
                            {c.approval_status || 'N/A'}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center justify-end gap-1 transition-opacity opacity-0 group-hover:opacity-100">
                            <button onClick={() => setSelectedClient(c)} title="View" className={iconBtn}>
                              <Eye size={15} />
                            </button>
                            <button onClick={() => handleDelete(c.id)} title="Deactivate" className={iconBtn}>
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              pageSize={pageSize}
              onPageSizeChange={setPageSize}
              totalRecords={filtered.length}
            />
          </>
        )}
      </div>

      {/* ── DETAIL MODAL ── */}
      {selectedClient && (
        <Modal
          wide
          title={selectedClient.business_name || 'Client Details'}
          subtitle={selectedClient.client_id}
          onClose={() => setSelectedClient(null)}
        >
          <div className="flex-1 px-6 py-5 overflow-y-auto">
            <div className="flex flex-wrap items-center gap-2 mb-5">
              {selectedClient.account && (
                <span className="px-2 py-0.5 text-xs font-medium text-gray-600 bg-gray-100 rounded">{selectedClient.account}</span>
              )}
              {selectedClient.approval_status && (
                <span className={`px-2 py-0.5 text-xs font-medium rounded capitalize ${statusColor(selectedClient.approval_status)}`}>
                  {selectedClient.approval_status}
                </span>
              )}
            </div>

            <Section title="Business Info">
              <DField label="Business Name" value={selectedClient.business_name} />
              <DField label="Trade Name" value={selectedClient.trade_name} />
              <DField label="Line of Business" value={selectedClient.line_of_business} />
              <DField label="Business Registration" value={selectedClient.business_registration} />
              <DField label="Entity Type" value={selectedClient.entity_type} />
              <DField label="Source of Income" value={selectedClient.source_of_income} />
              <DField label="Date of Coverage" value={fmtDate(selectedClient.date_of_coverage)} />
              <DField label="Month of Coverage" value={fmtDate(selectedClient.month_of_coverage)} />
            </Section>
            <Section title="Tax & Registration">
              <DField label="Tax Type" value={selectedClient.tax_type} />
              <DField label="Tax Payer Classification" value={selectedClient.tax_payer_classification} span2 />
              <DField label="TIN" value={selectedClient.tin} mono />
              <DField label="SEC Reg. No." value={selectedClient.sec_registration_no} mono />
              <DField label="DTI Registration" value={selectedClient.dti_registration} />
              <DField label="Biz Reg. Numbers" value={selectedClient.business_registration_numbers} />
              <DField label="Date of Incorporation" value={fmtDate(selectedClient.date_of_incorporation)} />
              <DField label="Date of Expiration" value={fmtDate(selectedClient.date_of_expiration)} />
              <DField label="SSS Employer No." value={selectedClient.sss_employer_no} mono />
              <DField label="PHIC Employer No." value={selectedClient.phic_employer_no} mono />
              <DField label="HDMF Employer No." value={selectedClient.hdmf_employer_no} mono />
              <DField label="Corporation Signatory" value={selectedClient.corporation_signatory_type} />
              <DField label="Sole Prop. Signatory" value={selectedClient.sole_proprietor_signatory_type} />
            </Section>
            <Section title="Address">
              <DField label="Registered Business Address" value={selectedClient.registered_business_address} span2 />
              <DField label="RDO" value={selectedClient.rdo} />
              <DField label="District" value={selectedClient.district} />
              <DField label="Zip Code" value={selectedClient.zip_code} />
              <DField label="Renting?" value={selectedClient.renting} />
              {selectedClient.renting === 'Yes' && <DField label="VAT Type" value={selectedClient.renting_vat_type} />}
            </Section>
            {selectedClient.entity_type === 'Sole Proprietor' && (
              <Section title="Owner Details">
                <DField label="Father's Name" value={selectedClient.fathers_name} />
                <DField label="Mother's Maiden Name" value={selectedClient.mothers_maiden_name} />
                <DField label="Marital Status" value={selectedClient.marital_status} />
                <DField label="Date of Birth" value={fmtDate(selectedClient.date_of_birth)} />
                <DField label="Citizenship" value={selectedClient.citizenship} />
                <DField label="Gender" value={selectedClient.gender} />
                <DField label="Present Home Address" value={selectedClient.present_home_address} span2 />
                <DField label="Permanent Home Address" value={selectedClient.permanent_home_address} span2 />
                <DField label="Personal Email" value={selectedClient.personal_email_address} span2 />
              </Section>
            )}
            <Section title="Contact">
              <DField label="Contact Person" value={selectedClient.contact_person} />
              <DField label="Designation" value={selectedClient.designation} />
              <DField label="Email Address" value={selectedClient.email_address} />
              <DField label="Contact Number" value={selectedClient.contact_number} mono />
              <DField label="Office Contact No." value={selectedClient.official_office_contact_number} mono />
              <DField label="Contact Information" value={selectedClient.contact_information} span2 />
            </Section>
            <div className="flex items-center justify-between pt-2 text-xs text-gray-300 border-t border-gray-100">
              <span>Record ID: {selectedClient.id}</span>
              <span>Added: {fmtDate(selectedClient.created_at)}</span>
            </div>
          </div>

          <div className="flex justify-end px-6 py-4 border-t border-gray-100 shrink-0">
            <button onClick={() => setSelectedClient(null)} className={btnGhost}>Close</button>
          </div>
        </Modal>
      )}

      {/* ── EXPORT MODAL ── */}
      {showExport && (
        <Modal
          title="Export Masterlist"
          subtitle={`${sorted.length} records (all pages) · ${filterDesc}`}
          onClose={() => setShowExport(false)}
        >
          <div className="px-6 py-5 overflow-y-auto">
            <p className={labelCls}>Columns to include</p>
            <div className="grid grid-cols-2 gap-1.5 mb-5 overflow-y-auto max-h-52">
              {ALL_COLS.map(col => (
                <label key={col.key} className={`flex items-center gap-2 px-3 py-2 text-xs border rounded-md cursor-pointer transition ${
                  exportCols[col.key]
                    ? 'border-gray-900 bg-gray-50 text-gray-800'
                    : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                }`}>
                  <input
                    type="checkbox"
                    checked={exportCols[col.key]}
                    onChange={e => setExportCols(p => ({ ...p, [col.key]: e.target.checked }))}
                    className="accent-gray-900 shrink-0"
                  />
                  {col.label}
                </label>
              ))}
            </div>

            {!libsLoaded && (
              <p className="flex items-center justify-center gap-1.5 mb-3 text-xs text-gray-400">
                <RefreshCw size={12} className="animate-spin" /> Loading export libraries...
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button onClick={() => setShowExport(false)} className={btnGhost}>Cancel</button>
              <button
                onClick={() => { setShowExport(false); exportExcel(allGroups, activeCols, filterDesc); }}
                disabled={!libsLoaded}
                className={btnGhost}
              >
                <FileSpreadsheet size={14} /> Excel
              </button>
              <button
                onClick={() => { setShowExport(false); exportPDF(allGroups, activeCols, filterDesc); }}
                disabled={!libsLoaded}
                className={btnPrimary}
              >
                <FileText size={14} /> PDF
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}