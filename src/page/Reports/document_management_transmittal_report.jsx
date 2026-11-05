import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { supabase } from "../../lib/supabaseClient";
import { FaPrint, FaFilePdf, FaPlus, FaTrash, FaClone, FaTimes, FaEye, FaUser, FaSave} from "react-icons/fa";

const GREEN = "#1a5c2e";
const LIGHT_GREEN = "#e8f5ec";
export const LOGO_SRC = "/fortiserv_logo.png"; // ilagay ang logo sa /public/fortiserv_logo.png
const MAX_ROWS = 12; // max rows para magkasya ang 2 copies sa isang A4
const SHOW_LOGO_TEXT = true; // false kung kasama na sa logo image yung text

const COMPANY = {
  name: "FORTISERV BUSINESS MANAGEMENT ENT. CO.",
  address: "3/F Unit 32A M.Arce St. Heroes De196 Brgy.74, Caloocan City, Metro Manila",
  email: "fortiservbmec@gmail.com",
  phone: "02 8995 04 86",
};

const COLS = [
  { label: "Period Covered", w: 12 },
  { label: "Form", w: 10 },
  { label: "QTY / Copies", w: 10 },
  { label: "Location", w: 22 },
  { label: "Description", w: 26 },
  { label: "Filing Date", w: 10 },
  { label: "Remarks", w: 10 },
];

const FORM_OPTIONS = ["Renewal", "New", "Registration", "Amendment", "Closure", "Update"];
export const JSPDF_SRC = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
export const AUTOTABLE_SRC = "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js";

const inputCls =
  "w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 bg-white transition";
const cellInputCls =
  "w-full px-2 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:border-blue-400 bg-white";
const labelCls = "block text-xs font-medium text-gray-500 mb-1";

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2);
const getClientName = (c) => {
  if (!c) return "";
  if (c.business_name) return c.business_name;
  return [c.first_name, c.middle_name, c.last_name].filter(Boolean).join(" ") || c.client_id;
};
const todayISO = () => new Date().toLocaleDateString("en-CA");
export const longDate = (iso) =>
  iso
    ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "";

const newRow = (base = {}) => ({
  id: uid(),
  period: String(new Date().getFullYear()),
  form: "",
  qty: "",
  location: "",
  description: "",
  filing_date: "",
  remarks: "",
  ...base,
});

const formatQty = (q) => {
  const v = String(q || "").trim();
  if (/^\d+$/.test(v)) return `${v} ${Number(v) === 1 ? "copy" : "copies"}`;
  return v;
};

export const loadScript = (src) =>
  new Promise((resolve, reject) => {
    const ex = document.querySelector(`script[src="${src}"]`);
    if (ex) {
      if (ex.dataset.loaded) return resolve();
      ex.addEventListener("load", resolve);
      ex.addEventListener("error", reject);
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => { s.dataset.loaded = "1"; resolve(); };
    s.onerror = reject;
    document.head.appendChild(s);
  });

export const toDataURL = async (src) => {
  try {
    const res = await fetch(src);
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.type.startsWith("image/")) return null;
    return await new Promise((resolve) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = () => resolve(null);
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

// ─── PRINT / SHEET STYLES ─────────────────────────────────────────────────────
export const CSS = `
.tf-wrap{position:relative;font-family:Cambria,Georgia,serif;color:#000;font-size:11px;display:flex;flex-direction:column;height:100%}
.tf-no{position:absolute;right:0;top:2px;font-weight:700;font-size:12px}
.tf-top{display:flex;align-items:center;gap:6px;width:60%;margin-bottom:3px;padding-bottom:2px;border-bottom:2px solid #e00}
.tf-logo{height:44px}
.tf-brand{font-family:Arial,Helvetica,sans-serif;line-height:1.15}
.tf-brand .n{color:#2e8b3a;font-weight:900;font-size:24px;letter-spacing:.02em}
.tf-brand .s{color:#1f2a8a;font-weight:700;font-size:8.5px}
.tf-brand .t{font-style:italic;font-weight:700;font-size:8.5px}
.tf-box{border:1px solid #000;display:flex;flex-direction:column;flex:1;overflow:hidden}
.tf-head{text-align:center;padding:4px 0;border-bottom:1px solid #000;line-height:1.35}
.tf-co{color:#2e8b3a;font-weight:700;font-size:15px}
.tf-addr{font-style:italic;font-weight:700;font-size:10px}
.tf-mail{font-style:italic;font-size:10px}
.tf-info{display:flex;border-bottom:1px solid #000}
.tf-info-l{flex:1;padding:2px 5px}
.tf-info-l>div{display:flex}
.tf-k{width:46px;font-weight:700}
.tf-info-r{width:22%;border-left:1px solid #000;padding:2px 5px;display:flex;justify-content:space-between;align-items:flex-end;font-weight:700}
.tf-bar{background:#a6a6a6;color:#fff;text-align:center;font-weight:700;padding:1px 0;border-bottom:1px solid #000}
.tf-tbl{width:calc(100% + 2px);margin-left:-1px;border-collapse:collapse;table-layout:fixed}
.tf-tbl th,.tf-tbl td{border:1px solid #000;padding:1px 3px;text-align:center;overflow-wrap:anywhere;font-weight:400}
.tf-tbl th{font-weight:700}
.tf-body{flex:1;min-height:90px}
.tf-nf{color:#e00;font-weight:700;font-style:italic;text-align:center;padding:2px 0}
.tf-foot{display:flex;border-top:1px solid #000;min-height:64px}
.tf-fc{display:flex;flex-direction:column;border-left:1px solid #000}
.tf-fc:first-child{border-left:none}
.tf-fc .c{flex:1;padding:3px 5px;text-align:center;display:flex;flex-direction:column;justify-content:space-between}
.tf-fc .d{border-top:1px solid #000;padding:1px 5px;display:flex;font-weight:700;min-height:14px}
.tf-fc .d span{flex:1;text-align:center;font-weight:400}
#tf-print{display:none}
@media print{
  @page{size:A4 portrait;margin:8mm}
  *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  body *{visibility:hidden}
  #tf-print,#tf-print *{visibility:visible}
  #tf-print{display:block;position:absolute;left:0;top:0;width:100%}
  .tf-page-copy{height:135mm;box-sizing:border-box}
  .tf-cut{border-top:1px dashed #777;margin:2.5mm 0}
  .tf-wrap{font-size:9px}
  .tf-logo{height:11mm}
.tf-brand .n{font-size:17px}
.tf-brand .s,.tf-brand .t{font-size:6.5px}
  .tf-body{min-height:0}
}
`;

// ─── SHEET (one copy of the form) ─────────────────────────────────────────────
export function Sheet({ d }) {
  return (
        <div className="tf-wrap">
      {d.tfNo && <div className="tf-no">TF No.: {d.tfNo}</div>}
      <div className="tf-top">
        <img
          src={LOGO_SRC}
          alt=""
          className="tf-logo"
          onError={(e) => { e.currentTarget.style.visibility = "hidden"; }}
        />
        {SHOW_LOGO_TEXT && (
          <div className="tf-brand">
            <div className="n">FORTISERV</div>
            <div className="s">BUSINESS MANAGEMENT ENTERPRISE, Co.</div>
            <div className="t">“LET’S MAKE THINGS WORK BETTER...”</div>
          </div>
        )}
      </div>

      <div className="tf-box">
        <div className="tf-head">
          <div className="tf-co">{COMPANY.name}</div>
          <div className="tf-addr">{COMPANY.address}</div>
          <div className="tf-mail">{COMPANY.email} &nbsp;|&nbsp; {COMPANY.phone}</div>
        </div>

        <div className="tf-info">
          <div className="tf-info-l">
            <div><span className="tf-k">TO</span><b><i>{d.client}</i></b></div>
            <div><span className="tf-k">ATTN</span><span>{d.attn}</span></div>
            <div><span className="tf-k">RE</span><span>{d.re}</span></div>
          </div>
          <div className="tf-info-r">
            <span>DATE</span>
            <span style={{ fontWeight: 400 }}>{d.dateLabel}</span>
          </div>
        </div>

        <div className="tf-bar">TRANSMITTAL FORM</div>

        <table className="tf-tbl">
          <colgroup>
            {COLS.map((c) => <col key={c.label} style={{ width: `${c.w}%` }} />)}
          </colgroup>
          <thead>
            <tr>{COLS.map((c) => <th key={c.label}>{c.label}</th>)}</tr>
          </thead>
          <tbody>
            {d.rows.map((r, i) => (
              <tr key={i}>
                {r.map((v, j) => <td key={j}>{v}</td>)}
              </tr>
            ))}
          </tbody>
        </table>

        <div className="tf-body">
          <div className="tf-nf">
            --------------------------------nothing follows--------------------------------
          </div>
        </div>

        <div className="tf-foot">
          <div className="tf-fc" style={{ width: "28%" }}>
            <div className="c">
              <b>Prepared &amp; Issued by:</b>
              <b>{d.preparedBy}</b>
            </div>
            <div className="d">DATE:<span>{d.dateLabel}</span></div>
          </div>
          <div className="tf-fc" style={{ width: "21%" }}>
            <div className="c" />
          </div>
          <div className="tf-fc" style={{ width: "51%" }}>
            <div className="c">
              <div>
                On behalf of <b><u>{d.client}</u></b>
                <br />
                the document/s mentioned above is/are received by:
              </div>
              <b>Signature over printed name:</b>
            </div>
            <div className="d">DATE:</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── PDF DRAWING (one copy) ───────────────────────────────────────────────────
export function drawCopy(doc, y0, d, logo) {
  const L = 8, W = 194, H = 138;
  const bx = L, by = y0 + 13;

  // logo + copy label
let logoW = 0;
  if (logo) {
    try {
      const p = doc.getImageProperties(logo);
      const fmt = (logo.match(/data:image\/(\w+)/)?.[1] || "png").toUpperCase();
      const h = 11;
      logoW = Math.min((h * p.width) / p.height, 80);
      doc.addImage(logo, fmt === "JPG" ? "JPEG" : fmt, L, y0, logoW, h);
    } catch { logoW = 0; }
  }
  if (SHOW_LOGO_TEXT) {
    const tx = L + logoW + 2;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(17);
    doc.setTextColor(46, 139, 58);
    doc.text("FORTISERV", tx, y0 + 6);
    doc.setFontSize(6.5);
    doc.setTextColor(31, 42, 138);
    doc.text("BUSINESS MANAGEMENT ENTERPRISE, Co.", tx, y0 + 9);
    doc.setFont("helvetica", "bolditalic");
    doc.setTextColor(0, 0, 0);
    doc.text("“LET’S MAKE THINGS WORK BETTER...”", tx, y0 + 11.7);
  }
  doc.setDrawColor(224, 0, 0);
  doc.setLineWidth(0.5);
  doc.line(L, y0 + 12.5, L + W * 0.6, y0 + 12.5);
  doc.setTextColor(0, 0, 0);
  if (d.tfNo) {
    doc.setFont("times", "bold");
    doc.setFontSize(10);
    doc.text(`TF No.: ${d.tfNo}`, L + W, y0 + 6, { align: "right" });
  }


  // outer box
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.25);
  doc.rect(bx, by, W, H - 13);

  // header
  doc.setFont("times", "bold");
  doc.setFontSize(12);
  doc.setTextColor(46, 139, 58);
  doc.text(COMPANY.name, L + W / 2, by + 5.5, { align: "center" });
  doc.setTextColor(0, 0, 0);
  doc.setFont("times", "bolditalic");
  doc.setFontSize(8);
  doc.text(COMPANY.address, L + W / 2, by + 10, { align: "center" });
  doc.setFont("times", "italic");
  doc.text(`${COMPANY.email}   |   ${COMPANY.phone}`, L + W / 2, by + 14, { align: "center" });
  doc.line(bx, by + 17, bx + W, by + 17);

  // info block
  const splitX = bx + W * 0.78;
  doc.line(bx, by + 31, bx + W, by + 31);
  doc.line(splitX, by + 17, splitX, by + 31);
  doc.setFont("times", "bold");
  doc.setFontSize(8.5);
  doc.text("TO", bx + 2, by + 21.5);
  doc.text("ATTN", bx + 2, by + 26);
  doc.text("RE", bx + 2, by + 30);
  doc.setFont("times", "bolditalic");
  doc.setFontSize(10);
  doc.text(d.client, bx + 16, by + 21.5, { maxWidth: splitX - bx - 18 });
  doc.setFont("times", "normal");
  doc.setFontSize(8.5);
  doc.text(d.attn, bx + 16, by + 26, { maxWidth: splitX - bx - 18 });
  doc.text(d.re, bx + 16, by + 30, { maxWidth: splitX - bx - 18 });
  doc.setFont("times", "bold");
  doc.text("DATE", splitX + 2, by + 30);
  doc.setFont("times", "normal");
  doc.text(d.dateLabel, bx + W - 2, by + 30, { align: "right" });

  // gray bar
  doc.setFillColor(166, 166, 166);
  doc.rect(bx, by + 31, W, 5, "F");
  doc.line(bx, by + 36, bx + W, by + 36);
  doc.setTextColor(255, 255, 255);
  doc.setFont("times", "bold");
  doc.setFontSize(8.5);
  doc.text("TRANSMITTAL FORM", bx + W / 2, by + 34.7, { align: "center" });

  // items table
  doc.autoTable({
    startY: by + 36,
    margin: { left: bx, right: 210 - bx - W },
    tableWidth: W,
    head: [COLS.map((c) => c.label)],
    body: d.rows,
    theme: "grid",
    styles: {
      font: "times",
      fontSize: 7,
      cellPadding: 0.8,
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
      textColor: [0, 0, 0],
      halign: "center",
      valign: "middle",
    },
    headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: "bold" },
    columnStyles: COLS.reduce((acc, c, i) => ({ ...acc, [i]: { cellWidth: (W * c.w) / 100 } }), {}),
  });

  const endY = doc.lastAutoTable.finalY;
  doc.setTextColor(224, 0, 0);
  doc.setFont("times", "bolditalic");
  doc.setFontSize(7.5);
  doc.text(
    "--------------------------------nothing follows--------------------------------",
    bx + W / 2,
    endY + 4,
    { align: "center" }
  );

  // footer
  doc.setTextColor(0, 0, 0);
  const footTop = y0 + H - 22;
  const x1 = bx + W * 0.28;
  const x2 = bx + W * 0.49;
  doc.line(bx, footTop, bx + W, footTop);
  doc.line(x1, footTop, x1, y0 + H);
  doc.line(x2, footTop, x2, y0 + H);
  doc.line(bx, y0 + H - 5, x1, y0 + H - 5);
  doc.line(x2, y0 + H - 5, bx + W, y0 + H - 5);

  const c1 = (bx + x1) / 2;
  doc.setFont("times", "bold");
  doc.setFontSize(8);
  doc.text("Prepared & Issued by:", c1, footTop + 5, { align: "center" });
  doc.text(d.preparedBy, c1, y0 + H - 8, { align: "center", maxWidth: x1 - bx - 4 });
  doc.text("DATE:", bx + 2, y0 + H - 1.5);
  doc.setFont("times", "normal");
  doc.text(d.dateLabel, c1, y0 + H - 1.5, { align: "center" });

  const rx = bx + W;
  const c3 = (x2 + rx) / 2;
  doc.setFont("times", "normal");
  const pre = "On behalf of ";
  doc.setFont("times", "normal");
  const w1 = doc.getTextWidth(pre);
  doc.setFont("times", "bold");
  const w2 = doc.getTextWidth(d.client);
  const sx = c3 - (w1 + w2) / 2;
  doc.setFont("times", "normal");
  doc.text(pre, sx, footTop + 5);
  doc.setFont("times", "bold");
  doc.text(d.client, sx + w1, footTop + 5);
  doc.line(sx + w1, footTop + 5.6, sx + w1 + w2, footTop + 5.6);
  doc.setFont("times", "normal");
  doc.text("the document/s mentioned above is/are received by:", c3, footTop + 9, { align: "center" });
  doc.setFont("times", "bold");
  doc.text("Signature over printed name:", c3, y0 + H - 8, { align: "center" });
  doc.text("DATE:", x2 + 2, y0 + H - 1.5);
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function TransmittalReport() {
  const [client, setClient] = useState("");
  const [clientId, setClientId] = useState(null);
  const [savedId, setSavedId] = useState(null);
  const [tfNo, setTfNo] = useState("");
  const [savedKey, setSavedKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [clientResults, setClientResults] = useState([]);
const [showClientDrop, setShowClientDrop] = useState(false);
const clientRef = useRef(null);
  const [attn, setAttn] = useState("");
  const [re, setRe] = useState("");
  const [date, setDate] = useState(todayISO());
  const [preparedBy, setPreparedBy] = useState("");
  const [rows, setRows] = useState(() => Array.from({ length: 5 }, () => newRow()));
  const [pdfBusy, setPdfBusy] = useState(false);
const [error, setError] = useState("");
const [showPreview, setShowPreview] = useState(false);


 // Client search (same query as Billing Summary)
const searchClients = useCallback(async (term) => {
  let q = supabase
    .from("client_profile")
    .select("id, client_id, business_name, first_name, middle_name, last_name")
    .eq("approval_status", "approved")
    .limit(8);
  if (term.trim()) {
    q = q.or(
      `business_name.ilike.%${term}%,client_id.ilike.%${term}%,first_name.ilike.%${term}%,last_name.ilike.%${term}%,trade_name.ilike.%${term}%`
    );
  } else {
    q = q.order("business_name", { ascending: true });
  }
  const { data, error: err } = await q;
  if (!err) setClientResults(data || []);
}, []);

useEffect(() => {
  if (!showClientDrop) return;
  const t = setTimeout(() => searchClients(client), 300);
  return () => clearTimeout(t);
}, [client, showClientDrop, searchClients]);

useEffect(() => {
  const handler = (e) => {
    if (clientRef.current && !clientRef.current.contains(e.target)) setShowClientDrop(false);
  };
  document.addEventListener("mousedown", handler);
  return () => document.removeEventListener("mousedown", handler);
}, []);

const pickClient = async (c) => {
  setClient(getClientName(c));
  setClientId(c.client_id);
  setShowClientDrop(false);
  // contact_person is fetched separately so a missing column can't break the list
  const { data, error: err } = await supabase
    .from("client_profile")
    .select("contact_person")
    .eq("id", c.id)
    .maybeSingle();
  if (!err && data?.contact_person) setAttn(data.contact_person);
};

  // Rows
  const updateRow = (id, field, value) =>
    setRows((p) => p.map((r) => (r.id === id ? { ...r, [field]: value } : r)));

  const addRow = () =>
    setRows((p) => {
      if (p.length >= MAX_ROWS) return p;
      const last = p[p.length - 1] || {};
      return [...p, newRow({ period: last.period, form: last.form, location: last.location })];
    });

  const dupRow = (id) =>
    setRows((p) => {
      if (p.length >= MAX_ROWS) return p;
      const i = p.findIndex((r) => r.id === id);
      const copy = { ...p[i], id: uid() };
      return [...p.slice(0, i + 1), copy, ...p.slice(i + 1)];
    });

  const removeRow = (id) =>
    setRows((p) => (p.length === 1 ? [newRow()] : p.filter((r) => r.id !== id)));

  // Cleaned data used by preview, print, and PDF
  const d = useMemo(
    () => ({
      client: client.trim(),
      attn: attn.trim(),
      re: re.trim(),
      dateLabel: longDate(date),
      preparedBy: preparedBy.trim(),
      rows: rows
        .filter((r) => [r.period, r.form, r.qty, r.location, r.description].some((v) => String(v).trim()))
        .map((r) => [
          r.period.trim(),
          r.form.trim(),
          formatQty(r.qty),
          r.location.trim(),
          r.description.trim(),
          r.filing_date.trim() || "N/A",
          r.remarks.trim() || "N/A",
        ]),
    }),
    [client, attn, re, date, preparedBy, rows]
  );

  const validate = () => {
    if (!d.client) { setError("Client name is required."); return false; }
    if (!d.rows.some((r) => r[4])) { setError("Add at least one document with a Description."); return false; }
    setError("");
    return true;
  };

  // Saved lang kapag walang binago mula sa huling save
  const currentKey = useMemo(() => JSON.stringify({ d, clientId }), [d, clientId]);
  const isSaved = !!savedId && savedKey === currentKey;

  // Data para sa sheet/print/PDF (kasama ang TF No.)
  const sheetD = useMemo(() => ({ ...d, tfNo }), [d, tfNo]);

  const logAction = async (transmittalId, action) => {
    const { error: err } = await supabase
      .from("transmittal_logs")
      .insert({ transmittal_id: transmittalId, action });
    if (err) console.error("log failed:", err);
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    const record = {
      client_id: clientId,
      client_name: d.client,
      attn: d.attn,
      re: d.re,
      tf_date: date || null,
      prepared_by: d.preparedBy,
      rows: d.rows,
      updated_at: new Date().toISOString(),
    };
    try {
      if (savedId) {
        const { error: err } = await supabase.from("transmittals").update(record).eq("id", savedId);
        if (err) throw err;
        await logAction(savedId, "updated");
      } else {
        const { data, error: err } = await supabase
          .from("transmittals")
          .insert(record)
          .select("id, tf_no")
          .single();
        if (err) throw err;
        setSavedId(data.id);
        setTfNo(data.tf_no);
        await logAction(data.id, "saved");
      }
      setSavedKey(currentKey);
      setError("");
    } catch (err) {
      console.error(err);
      setError("Failed to save: " + (err.message || "unknown error"));
    }
    setSaving(false);
  };

  const handleNew = () => {
        if (savedId && !isSaved && !window.confirm("You have unsaved changes. Start a new transmittal?")) return;
    setSavedId(null);
    setTfNo("");
    setSavedKey("");
    setClientId(null);
    setClient("");
    setAttn("");
    setRe("");
    setPreparedBy("");
    setDate(todayISO());
    setRows(Array.from({ length: 5 }, () => newRow()));
    setError("");
  };

  const handlePrint = async () => {
    if (!isSaved) { setError("Please save the transmittal first."); return; }
    await logAction(savedId, "printed");
    window.print();
  };

  const exportPDF = async () => {
    if (!isSaved) { setError("Please save the transmittal first."); return; }
    setPdfBusy(true);
    try {
      await loadScript(JSPDF_SRC);
      await loadScript(AUTOTABLE_SRC);
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const logo = await toDataURL(LOGO_SRC);

      drawCopy(doc, 8, sheetD, logo);
      doc.setDrawColor(120, 120, 120);
      doc.setLineWidth(0.2);
      doc.setLineDash([2, 2], 0);
      doc.line(8, 148.5, 202, 148.5);
      doc.setLineDash([], 0);
      drawCopy(doc, 151, sheetD, logo);
      const slug = d.client.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "").slice(0, 40);
      doc.save(`${tfNo}_${slug}_${date}.pdf`);
      await logAction(savedId, "pdf");
    } catch (err) {
      console.error(err);
      setError("Failed to generate PDF. Check your internet connection and try again.");
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <style>{CSS}</style>

 

{/* Top bar */}
<div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
  <div className="flex items-center justify-between max-w-6xl gap-4 px-6 mx-auto h-16">
    <h1 className="text-lg font-semibold tracking-tight text-gray-800">
      Transmittal Form
    </h1>

      <div className="flex items-center gap-2">
      {tfNo && (
        <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${isSaved ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
          {tfNo} · {isSaved ? "Saved" : "Unsaved changes"}
        </span>
      )}
      <button
        onClick={handleNew}
        className="flex items-center gap-2 h-9 px-4 text-sm font-medium text-gray-700 transition bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
      >
        <FaPlus size={11} /> New
      </button>
      <button
        onClick={() => setShowPreview(true)}
        className="flex items-center gap-2 h-9 px-4 text-sm font-medium text-gray-700 transition bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
      >
        <FaEye size={12} /> Preview
      </button>
      <button
        onClick={handleSave}
        disabled={saving || isSaved}
        className="flex items-center gap-2 h-9 px-4 text-sm font-medium text-white transition bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40"
      >
        <FaSave size={12} /> {saving ? "Saving..." : savedId ? "Update" : "Save"}
      </button>
      <button
        onClick={exportPDF}
        disabled={pdfBusy || !isSaved}
        title={!isSaved ? "Save first" : ""}
        className="flex items-center gap-2 h-9 px-4 text-sm font-medium text-red-600 transition bg-white border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-40"
      >
        <FaFilePdf size={12} /> {pdfBusy ? "Generating..." : "Export PDF"}
      </button>
      <button
        onClick={handlePrint}
        disabled={!isSaved}
        title={!isSaved ? "Save first" : ""}
        className="flex items-center gap-2 h-9 px-4 text-sm font-medium text-white transition rounded-lg shadow-sm hover:opacity-90 disabled:opacity-40"
        style={{ background: GREEN }}
      >
        <FaPrint size={12} /> Print
      </button>
    </div>
  </div>
</div>

<div className="max-w-6xl px-6 pt-5 mx-auto">
  {error && (
    <div className="flex items-center justify-between px-4 py-2.5 mb-5 text-sm text-red-700 border-l-4 border-red-500 rounded-md bg-red-50">
      {error}
      <button onClick={() => setError("")}><FaTimes size={11} /></button>
    </div>
  )}
</div>

<div className="max-w-6xl p-6 pt-0 mx-auto space-y-5">
        {/* Details */}
        <div className="p-5 bg-white border border-gray-200 shadow-sm rounded-xl">
          <p className="mb-3 text-xs font-semibold tracking-wide text-gray-400 uppercase">Details</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
         <div className="relative" ref={clientRef}>
  <label className={labelCls}>To (Client) <span className="text-red-500">*</span></label>
  <input
    value={client}
       onChange={(e) => { setClient(e.target.value); setClientId(null); setShowClientDrop(true); }}
    onFocus={() => setShowClientDrop(true)}
    placeholder="Type or pick a client..."
    className={inputCls}
  />
  {showClientDrop && clientResults.length > 0 && (
    <div className="absolute left-0 right-0 z-30 mt-1 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg top-full max-h-56">
      {clientResults.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => pickClient(c)}
          className="flex items-center w-full gap-3 px-4 py-2.5 text-left transition border-b hover:bg-blue-50 border-gray-50 last:border-0"
        >
          <div className="flex items-center justify-center bg-blue-100 rounded-full w-7 h-7 shrink-0">
            <FaUser size={10} className="text-blue-500" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate">{getClientName(c)}</p>
            <p className="font-mono text-xs text-gray-400">{c.client_id}</p>
          </div>
        </button>
      ))}
    </div>
  )}
</div>
            <div>
              <label className={labelCls}>Attn</label>
              <input value={attn} onChange={(e) => setAttn(e.target.value)} placeholder="Contact person" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Re</label>
              <input value={re} onChange={(e) => setRe(e.target.value)} placeholder="e.g. Business Permit Renewal (Original Documents)" className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Date</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Prepared &amp; Issued by</label>
                <input value={preparedBy} onChange={(e) => setPreparedBy(e.target.value)} placeholder="Full name" className={inputCls} />
              </div>
            </div>
          </div>
        </div>

        {/* Documents */}
        <div className="p-4 bg-white border border-gray-100 rounded-xl">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold tracking-wide text-gray-400 uppercase">
              Documents ({rows.length}/{MAX_ROWS})
            </p>
            <button
              onClick={addRow}
              disabled={rows.length >= MAX_ROWS}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white rounded-md disabled:opacity-40"
              style={{ background: GREEN }}
            >
              <FaPlus size={9} /> Add row
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: 900 }}>
              <thead className="text-left text-gray-500 bg-gray-50">
                <tr>
                  {COLS.map((c) => (
                    <th key={c.label} className="px-2 py-2 text-[11px] font-semibold">{c.label}</th>
                  ))}
                  <th className="w-16" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-gray-50">
                    <td className="p-1"><input className={cellInputCls} value={r.period} onChange={(e) => updateRow(r.id, "period", e.target.value)} /></td>
                    <td className="p-1">
                      <input className={cellInputCls} list="tf-forms" value={r.form} onChange={(e) => updateRow(r.id, "form", e.target.value)} />
                    </td>
                    <td className="p-1"><input className={cellInputCls} value={r.qty} onChange={(e) => updateRow(r.id, "qty", e.target.value)} placeholder="1" /></td>
                    <td className="p-1"><input className={cellInputCls} value={r.location} onChange={(e) => updateRow(r.id, "location", e.target.value)} /></td>
                    <td className="p-1"><input className={cellInputCls} value={r.description} onChange={(e) => updateRow(r.id, "description", e.target.value)} /></td>
                    <td className="p-1"><input className={cellInputCls} value={r.filing_date} onChange={(e) => updateRow(r.id, "filing_date", e.target.value)} placeholder="N/A" /></td>
                    <td className="p-1"><input className={cellInputCls} value={r.remarks} onChange={(e) => updateRow(r.id, "remarks", e.target.value)} placeholder="N/A" /></td>
                    <td className="p-1">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => dupRow(r.id)} title="Duplicate row" className="p-1.5 text-gray-400 hover:text-gray-700">
                          <FaClone size={11} />
                        </button>
                        <button onClick={() => removeRow(r.id)} title="Remove row" className="p-1.5 text-gray-400 hover:text-red-600">
                          <FaTrash size={11} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <datalist id="tf-forms">
              {FORM_OPTIONS.map((o) => <option key={o} value={o} />)}
            </datalist>
          </div>
        </div>

        </div>

      {/* Preview modal */}
      {showPreview && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center p-6 overflow-y-auto bg-black/50"
          onClick={() => setShowPreview(false)}
        >
          <div
            className="w-full max-w-5xl p-4 bg-white rounded-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold tracking-wide text-gray-400 uppercase">Preview</p>
              <button onClick={() => setShowPreview(false)} className="p-1 text-gray-400 hover:text-gray-700">
                <FaTimes size={14} />
              </button>
            </div>
                   <Sheet d={sheetD} />
          </div>
        </div>
      )}

      {/* PRINT-ONLY: 2 copies on one A4 */}
      <div id="tf-print">
<div className="tf-page-copy"><Sheet d={sheetD} /></div>
<div className="tf-cut" />
<div className="tf-page-copy"><Sheet d={sheetD} /></div>
      </div>
    </div>
  );
}