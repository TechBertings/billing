import React, { useState, useEffect, useCallback } from 'react';
import {
  FaSearch, FaEye, FaTrashAlt, FaFilePdf, FaFileExcel,
  FaFilter, FaTimes, FaChevronDown, FaChevronUp, FaBuilding,
  FaUser, FaMapMarkerAlt, FaPhone, FaChevronLeft, FaChevronRight,
  FaAngleDoubleLeft, FaAngleDoubleRight, FaSync
} from 'react-icons/fa';
import { supabase } from '../../lib/supabaseClient';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const PAGE_SIZE_OPTIONS = [25, 50, 100];

const SORT_OPTIONS = [
  { value: 'client_id_desc',        label: 'Client ID (Newest)' },
  { value: 'client_id_asc',         label: 'Client ID (Oldest)' },
  { value: 'business_name_asc',     label: 'Business Name A→Z' },
  { value: 'business_name_desc',    label: 'Business Name Z→A' },
  { value: 'date_of_coverage_desc', label: 'Coverage (Newest)' },
  { value: 'date_of_coverage_asc',  label: 'Coverage (Oldest)' },
];

const GROUP_OPTIONS = [
  { value: 'none',                     label: 'No Grouping' },
  { value: 'tax_payer_classification', label: 'Per Tax Classification' },
  { value: 'tax_type',                 label: 'Per Tax Type' },
  { value: 'line_of_business',         label: 'Per Line of Business' },
  { value: 'business_registration',    label: 'Per Business Registration' },
];

const ACCOUNT_TABS = ['All', 'Summit', 'Horizon'];

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
  { key: 'status',                      label: 'Status',              default: true  },
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
    const cmp = av.localeCompare(bv, undefined, { numeric: field === 'client_id' });
    return dir === 'asc' ? cmp : -cmp;
  });
}

function groupClients(arr, by) {
  if (by === 'none') return [{ label: null, rows: arr }];
  const map = {};
  arr.forEach(c => {
    const k = c[by] || '(Unspecified)';
    if (!map[k]) map[k] = [];
    map[k].push(c);
  });
  return Object.entries(map)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([label, rows]) => ({ label, rows }));
}

const statusColor = s => ({
  approved: 'bg-emerald-100 text-emerald-700',
  pending:  'bg-amber-100 text-amber-700',
  inactive: 'bg-red-100 text-red-600',
}[s] || 'bg-slate-100 text-slate-500');

const accountColor = a => ({
  Summit:  'bg-sky-100 text-sky-700',
  Horizon: 'bg-violet-100 text-violet-700',
}[a] || 'bg-slate-100 text-slate-500');

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

function exportPDF(groups, cols, filterDesc, sortLabel, groupLabel) {
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
      doc.setFillColor(12, 84, 185);
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
      doc.setFillColor(12, 84, 185);
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
        doc.setFillColor(240, 246, 255);
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
      doc.setFillColor(220, 234, 255);
      doc.rect(mL, y, usableW, 15, 'F');
      doc.setFillColor(12, 84, 185);
      doc.rect(mL, y, 3, 15, 'F');
      doc.setTextColor(20, 60, 160);
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
const Section = ({ icon: Icon, title, children }) => (
  <div className="mb-6">
    <div className="flex items-center gap-2 pb-2 mb-3 border-b border-slate-100">
      <div className="flex items-center justify-center w-6 h-6 rounded-md bg-blue-50 shrink-0">
        <Icon size={11} className="text-blue-600" />
      </div>
      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{title}</span>
    </div>
    <div className="grid grid-cols-2 gap-x-8 gap-y-3">{children}</div>
  </div>
);

const DField = ({ label, value, mono, span2 }) => value ? (
  <div className={span2 ? 'col-span-2' : ''}>
    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">{label}</p>
    <p className={`text-sm text-slate-800 font-medium break-words ${mono ? 'font-mono' : ''}`}>{value}</p>
  </div>
) : null;

// ─── PAGINATION COMPONENT ─────────────────────────────────────────────────────
function Pagination({ currentPage, totalPages, onPageChange, pageSize, onPageSizeChange, totalRecords }) {
  const from = totalRecords === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const to   = Math.min(currentPage * pageSize, totalRecords);

  const pages = [];
  const delta = 2;
  for (let i = Math.max(1, currentPage - delta); i <= Math.min(totalPages, currentPage + delta); i++) {
    pages.push(i);
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-white border-t border-slate-200">
      <div className="flex items-center gap-3 text-sm text-slate-500">
        <span>Rows per page:</span>
        <select value={pageSize} onChange={e => { onPageSizeChange(Number(e.target.value)); onPageChange(1); }}
          className="px-2 py-1 text-xs bg-white border rounded-lg cursor-pointer border-slate-200 focus:outline-none focus:border-blue-400">
          {PAGE_SIZE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="text-xs">{from}–{to} of {totalRecords}</span>
      </div>

      <div className="flex items-center gap-1">
        <button onClick={() => onPageChange(1)} disabled={currentPage === 1}
          className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition">
          <FaAngleDoubleLeft size={11} />
        </button>
        <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1}
          className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition">
          <FaChevronLeft size={11} />
        </button>

        {pages[0] > 1 && (
          <>
            <button onClick={() => onPageChange(1)} className="w-8 h-8 text-xs transition rounded-lg text-slate-600 hover:bg-slate-100">1</button>
            {pages[0] > 2 && <span className="px-1 text-xs text-slate-300">…</span>}
          </>
        )}

        {pages.map(p => (
          <button key={p} onClick={() => onPageChange(p)}
            className={`w-8 h-8 text-xs rounded-lg font-medium transition ${
              p === currentPage
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}>
            {p}
          </button>
        ))}

        {pages[pages.length - 1] < totalPages && (
          <>
            {pages[pages.length - 1] < totalPages - 1 && <span className="px-1 text-xs text-slate-300">…</span>}
            <button onClick={() => onPageChange(totalPages)} className="w-8 h-8 text-xs transition rounded-lg text-slate-600 hover:bg-slate-100">{totalPages}</button>
          </>
        )}

        <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages || totalPages === 0}
          className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition">
          <FaChevronRight size={11} />
        </button>
        <button onClick={() => onPageChange(totalPages)} disabled={currentPage === totalPages || totalPages === 0}
          className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition">
          <FaAngleDoubleRight size={11} />
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
  const [groupBy, setGroupBy]       = useState('none');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize]     = useState(50);
  const [selectedClient, setSelectedClient] = useState(null);
  const [message, setMessage]       = useState('');
  const [messageType, setMessageType] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [libsLoaded, setLibsLoaded] = useState(false);
  const [exportCols, setExportCols] = useState(
    ALL_COLS.reduce((acc, c) => ({ ...acc, [c.key]: c.default }), {})
  );

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
  useEffect(() => { setCurrentPage(1); }, [searchTerm, filterAccount, filterTaxType, filterTaxClass, filterLOB, filterStatus, sortVal, groupBy]);

  const handleDelete = async (id) => {
    if (!window.confirm('Deactivate this client?')) return;
    try {
      const { error } = await supabase.from('client_profile').update({ approval_status: 'inactive' }).eq('id', id);
      if (error) throw error;
      setMessage('✅ Client deactivated'); setMessageType('success');
      fetchClients(); setSelectedClient(null);
    } catch (err) { setMessage(`❌ ${err.message}`); setMessageType('error'); }
  };

  // Unique dropdown values from all loaded clients
  const uniq = field => ['all', ...new Set(clients.map(c => c[field]).filter(Boolean))];

  // Filter all clients
  const filtered = clients.filter(c => {
    if (filterAccount !== 'All' && c.account !== filterAccount) return false;
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
  const groups      = groupClients(paginated, groupBy);        // groups for display (paginated)
  const allGroups   = groupClients(sorted, groupBy);           // groups for export (all records)
  const activeCols  = ALL_COLS.filter(c => exportCols[c.key]);

  const filterDesc = [
    filterAccount !== 'All' ? `Account: ${filterAccount}` : '',
    filterTaxType !== 'all' ? `Tax: ${filterTaxType}` : '',
    filterTaxClass !== 'all' ? `Class: ${filterTaxClass}` : '',
    filterLOB !== 'all' ? `LOB: ${filterLOB}` : '',
    filterStatus !== 'all' ? `Status: ${filterStatus}` : '',
    searchTerm ? `"${searchTerm}"` : '',
  ].filter(Boolean).join(' · ') || 'All Clients';

  const sortLabel  = SORT_OPTIONS.find(s => s.value === sortVal)?.label || '';
  const groupLabel = GROUP_OPTIONS.find(g => g.value === groupBy)?.label || '';
  const activeFilterCount = [filterTaxType, filterTaxClass, filterLOB, filterStatus].filter(v => v !== 'all').length;

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <div className="text-center">
        <div className="w-10 h-10 mx-auto mb-3 border-2 border-blue-600 rounded-full border-t-transparent animate-spin" />
        <p className="text-sm text-slate-500">Loading all client records...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── TOP BAR ── */}
      <div className="sticky top-0 z-20 bg-white border-b shadow-sm border-slate-200">
        <div className="flex items-center justify-between max-w-screen-xl gap-4 px-6 py-3 mx-auto">
          <div>
            <h1 className="text-base font-bold leading-tight text-slate-900">Client Masterlist</h1>
            <p className="text-xs text-slate-400">
              {filtered.length} of {clients.length} records · {filterDesc}
              {fetching && <span className="ml-2 text-blue-400">⟳ refreshing...</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchClients} disabled={fetching}
              className="p-2 transition rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-40" title="Refresh">
              <FaSync size={12} className={fetching ? 'animate-spin' : ''} />
            </button>
            <button onClick={() => setShowExport(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white transition rounded-lg shadow bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-90 shadow-blue-400/30">
              Export ↓
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-screen-xl px-6 py-5 mx-auto space-y-4">

        {/* ── MESSAGE ── */}
        {message && (
          <div className={`flex items-center justify-between p-3 rounded-lg text-sm border-l-4 ${
            messageType === 'success' ? 'bg-emerald-50 border-emerald-400 text-emerald-700' : 'bg-red-50 border-red-400 text-red-700'
          }`}>
            {message}
            <button onClick={() => setMessage('')}><FaTimes size={11} /></button>
          </div>
        )}

        {/* ── STATS ── */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {[
            { label: 'Total',    val: clients.length, cls: 'text-slate-800' },
            { label: 'Approved', val: clients.filter(c => c.approval_status === 'approved').length, cls: 'text-emerald-600' },
            { label: 'Pending',  val: clients.filter(c => c.approval_status === 'pending').length,  cls: 'text-amber-600' },
            { label: 'Summit',   val: clients.filter(c => c.account === 'Summit').length,  cls: 'text-sky-600' },
            { label: 'Horizon',  val: clients.filter(c => c.account === 'Horizon').length, cls: 'text-violet-600' },
          ].map(s => (
            <div key={s.label} className="px-4 py-3 bg-white border rounded-xl border-slate-200">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{s.label}</p>
              <p className={`text-2xl font-bold mt-0.5 ${s.cls}`}>{s.val}</p>
            </div>
          ))}
        </div>

        {/* ── SEARCH / SORT / FILTERS ── */}
        <div className="p-4 space-y-3 bg-white border rounded-xl border-slate-200">

          {/* ACCOUNT TABS */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 w-fit">
            {ACCOUNT_TABS.map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => setFilterAccount(tab)}
                className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-all ${
                  filterAccount === tab
                    ? tab === 'Summit'
                      ? 'bg-sky-600 text-white shadow-sm'
                      : tab === 'Horizon'
                        ? 'bg-violet-600 text-white shadow-sm'
                        : 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab}
                {tab !== 'All' && (
                  <span className={`ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    filterAccount === tab ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-500'
                  }`}>
                    {clients.filter(c => c.account === tab).length}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-52">
              <FaSearch className="absolute -translate-y-1/2 left-3 top-1/2 text-slate-400" size={12} />
              <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search name, ID, TIN, email, contact..."
                className="w-full py-2 pr-4 text-sm border rounded-lg pl-9 border-slate-200 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-50" />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="absolute -translate-y-1/2 right-3 top-1/2 text-slate-400 hover:text-slate-600">
                  <FaTimes size={11} />
                </button>
              )}
            </div>
            <select value={sortVal} onChange={e => setSortVal(e.target.value)}
              className="px-3 py-2 text-sm bg-white border rounded-lg cursor-pointer border-slate-200 text-slate-700 focus:border-blue-400 focus:outline-none">
              {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select value={groupBy} onChange={e => setGroupBy(e.target.value)}
              className="px-3 py-2 text-sm bg-white border rounded-lg cursor-pointer border-slate-200 text-slate-700 focus:border-blue-400 focus:outline-none">
              {GROUP_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <button onClick={() => setShowFilters(f => !f)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border transition ${
                activeFilterCount > 0 ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'
              }`}>
              <FaFilter size={11} /> Filters
              {activeFilterCount > 0 && (
                <span className="w-4 h-4 text-[10px] font-bold bg-blue-500 text-white rounded-full flex items-center justify-center">{activeFilterCount}</span>
              )}
              {showFilters ? <FaChevronUp size={9} /> : <FaChevronDown size={9} />}
            </button>
          </div>

          {showFilters && (
            <div className="grid grid-cols-2 gap-3 pt-3 border-t md:grid-cols-5 border-slate-100">
              {[
                { label: 'Tax Type',         val: filterTaxType,  set: setFilterTaxType,  opts: uniq('tax_type') },
                { label: 'Classification',   val: filterTaxClass, set: setFilterTaxClass, opts: uniq('tax_payer_classification') },
                { label: 'Line of Business', val: filterLOB,      set: setFilterLOB,      opts: uniq('line_of_business') },
                { label: 'Status',           val: filterStatus,   set: setFilterStatus,   opts: uniq('approval_status') },
              ].map(f => (
                <div key={f.label}>
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 block mb-1">{f.label}</label>
                  <select value={f.val} onChange={e => f.set(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:border-blue-400 focus:outline-none cursor-pointer">
                    {f.opts.map(o => <option key={o} value={o}>{o === 'all' ? 'All' : o}</option>)}
                  </select>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── TABLE ── */}
        <div className="overflow-hidden bg-white border rounded-xl border-slate-200">
          {paginated.length === 0 ? (
            <div className="py-20 text-center">
              <FaSearch size={28} className="mx-auto mb-3 text-slate-200" />
              <p className="font-semibold text-slate-400">No clients found</p>
              <p className="mt-1 text-xs text-slate-300">Try adjusting your filters or search</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80">
                      {['#','Client ID','Business Name','Account','Tax Type','Classification','TIN','Contact Person','Coverage','Status',''].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map(({ label, rows }, gi) => (
                      <React.Fragment key={gi}>
                        {label && (
                          <tr>
                            <td colSpan={11} className="px-4 py-2 border-blue-100 bg-blue-50/60 border-y">
                              <span className="text-xs font-bold text-blue-700">{label}</span>
                              <span className="ml-2 text-xs text-blue-400">({rows.length} on this page)</span>
                            </td>
                          </tr>
                        )}
                        {rows.map((c, idx) => {
                          const globalIdx = (currentPage - 1) * pageSize + (
                            gi === 0 ? idx : groups.slice(0, gi).reduce((s, g) => s + g.rows.length, 0) + idx
                          );
                          return (
                            <tr key={c.id} className="transition-colors border-b border-slate-100 hover:bg-blue-50/30 group">
                              <td className="px-4 py-3 text-xs text-slate-300 tabular-nums">{globalIdx + 1}</td>
                              <td className="px-4 py-3">
                                <span className="font-mono text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded">{c.client_id}</span>
                              </td>
                              <td className="px-4 py-3 min-w-[160px]">
                                <p className="font-semibold leading-snug text-slate-800">{c.business_name || '—'}</p>
                                {c.trade_name && <p className="text-xs text-slate-400 mt-0.5 italic">{c.trade_name}</p>}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${accountColor(c.account)}`}>{c.account || '—'}</span>
                              </td>
                              <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{c.tax_type || '—'}</td>
                              <td className="px-4 py-3 text-xs text-slate-600 max-w-[150px]">
                                <span title={c.tax_payer_classification} className="block truncate">{c.tax_payer_classification || '—'}</span>
                              </td>
                              <td className="px-4 py-3 font-mono text-xs text-slate-600 whitespace-nowrap">{c.tin || '—'}</td>
                              <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{c.contact_person || '—'}</td>
                              <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{fmtDate(c.date_of_coverage)}</td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${statusColor(c.approval_status)}`}>{c.approval_status || 'N/A'}</span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1 transition-opacity opacity-0 group-hover:opacity-100">
                                  <button onClick={() => setSelectedClient(c)}
                                    className="p-1.5 text-blue-500 hover:bg-blue-100 rounded-lg transition" title="View">
                                    <FaEye size={13} />
                                  </button>
                                  <button onClick={() => handleDelete(c.id)}
                                    className="p-1.5 text-red-400 hover:bg-red-100 rounded-lg transition" title="Deactivate">
                                    <FaTrashAlt size={12} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ── PAGINATION ── */}
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
      </div>

      {/* ── DETAIL MODAL ── */}
      {selectedClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[88vh] overflow-hidden">
            <div className="py-5 px-7 bg-gradient-to-r from-blue-700 to-indigo-700 rounded-t-2xl shrink-0">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    {selectedClient.account && (
                      <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${accountColor(selectedClient.account)}`}>{selectedClient.account}</span>
                    )}
                    {selectedClient.approval_status && (
                      <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${statusColor(selectedClient.approval_status)}`}>{selectedClient.approval_status}</span>
                    )}
                  </div>
                  <h2 className="text-xl font-bold leading-tight text-white truncate">{selectedClient.business_name || 'Client Details'}</h2>
                  <p className="mt-1 font-mono text-xs text-blue-200">{selectedClient.client_id}</p>
                </div>
                <button onClick={() => setSelectedClient(null)} className="mt-1 ml-4 text-xl transition text-white/50 hover:text-white shrink-0">✕</button>
              </div>
            </div>

            <div className="flex-1 py-6 overflow-y-auto px-7">
              <Section icon={FaBuilding} title="Business Info">
                <DField label="Business Name" value={selectedClient.business_name} />
                <DField label="Trade Name" value={selectedClient.trade_name} />
                <DField label="Line of Business" value={selectedClient.line_of_business} />
                <DField label="Business Registration" value={selectedClient.business_registration} />
                <DField label="Entity Type" value={selectedClient.entity_type} />
                <DField label="Source of Income" value={selectedClient.source_of_income} />
                <DField label="Date of Coverage" value={fmtDate(selectedClient.date_of_coverage)} />
                <DField label="Month of Coverage" value={fmtDate(selectedClient.month_of_coverage)} />
              </Section>
              <Section icon={FaBuilding} title="Tax & Registration">
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
              <Section icon={FaMapMarkerAlt} title="Address">
                <DField label="Registered Business Address" value={selectedClient.registered_business_address} span2 />
                <DField label="RDO" value={selectedClient.rdo} />
                <DField label="District" value={selectedClient.district} />
                <DField label="Zip Code" value={selectedClient.zip_code} />
                <DField label="Renting?" value={selectedClient.renting} />
                {selectedClient.renting === 'Yes' && <DField label="VAT Type" value={selectedClient.renting_vat_type} />}
              </Section>
              {selectedClient.entity_type === 'Sole Proprietor' && (
                <Section icon={FaUser} title="Owner Details">
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
              <Section icon={FaPhone} title="Contact">
                <DField label="Contact Person" value={selectedClient.contact_person} />
                <DField label="Designation" value={selectedClient.designation} />
                <DField label="Email Address" value={selectedClient.email_address} />
                <DField label="Contact Number" value={selectedClient.contact_number} mono />
                <DField label="Office Contact No." value={selectedClient.official_office_contact_number} mono />
                <DField label="Contact Information" value={selectedClient.contact_information} span2 />
              </Section>
              <div className="flex items-center justify-between text-[10px] text-slate-300 pt-2 border-t border-slate-100">
                <span>Record ID: {selectedClient.id}</span>
                <span>Added: {fmtDate(selectedClient.created_at)}</span>
              </div>
            </div>

            <div className="py-4 border-t px-7 border-slate-100 shrink-0">
              <button onClick={() => setSelectedClient(null)}
                className="w-full py-2.5 rounded-xl text-sm font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── EXPORT MODAL ── */}
      {showExport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden bg-white shadow-2xl rounded-2xl">
            <div className="px-6 py-5 bg-gradient-to-r from-blue-700 to-indigo-700">
              <h2 className="text-base font-bold text-white">Export Masterlist</h2>
              <p className="text-xs text-blue-200 mt-0.5">{sorted.length} records (all pages) · {filterDesc}</p>
            </div>
            <div className="p-6">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-2">Columns to include</p>
              <div className="grid grid-cols-2 gap-1.5 mb-5 max-h-52 overflow-y-auto">
                {ALL_COLS.map(col => (
                  <label key={col.key} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition text-xs font-medium ${
                    exportCols[col.key] ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}>
                    <input type="checkbox" checked={exportCols[col.key]}
                      onChange={e => setExportCols(p => ({ ...p, [col.key]: e.target.checked }))}
                      className="accent-blue-600 shrink-0" />
                    {col.label}
                  </label>
                ))}
              </div>
              {!libsLoaded && (
                <p className="text-center text-xs text-amber-500 mb-3 flex items-center justify-center gap-1.5">
                  <span className="animate-spin">⟳</span> Loading export libraries...
                </p>
              )}
              <div className="flex gap-2">
                <button onClick={() => setShowExport(false)}
                  className="flex-1 py-2.5 text-sm font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition">
                  Cancel
                </button>
                <button
                  onClick={() => { setShowExport(false); exportExcel(allGroups, activeCols, filterDesc); }}
                  disabled={!libsLoaded}
                  className="flex items-center justify-center gap-2 flex-1 py-2.5 text-sm font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition disabled:opacity-40">
                  <FaFileExcel size={13} /> Excel
                </button>
                <button
                  onClick={() => { setShowExport(false); exportPDF(allGroups, activeCols, filterDesc, sortLabel, groupLabel); }}
                  disabled={!libsLoaded}
                  className="flex items-center justify-center gap-2 flex-1 py-2.5 text-sm font-semibold rounded-xl bg-red-600 hover:bg-red-700 text-white transition disabled:opacity-40">
                  <FaFilePdf size={13} /> PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}