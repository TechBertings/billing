import React, { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { FaDownload, FaUpload, FaCheck, FaTimes } from "react-icons/fa";
import { supabase } from "../lib/supabaseClient";

// ─── COLUMN DEFINITIONS ───────────────────────────────────────────────────────
// key   = column name in the client_profile table
// label = header shown in the Excel file
// type  = text | date | money | yesno | tin | dropdown (validated against DB list)
const COLUMNS = [
  { key: "date_of_coverage", label: "Date of Coverage", type: "date", sample: "2026-01-01" },
    { key: "month_of_coverage", label: "Month of Coverage", type: "date", sample: "2026-01-01" },
  { key: "status", label: "Status", type: "dropdown" },
  { key: "account", label: "Account", type: "dropdown" },
  { key: "business_registration", label: "Business Registration", type: "dropdown", required: true },
  { key: "line_of_business", label: "Line of Business", type: "dropdown" },
  { key: "first_name", label: "First Name", type: "text", note: "Sole Proprietor only" },
  { key: "middle_name", label: "Middle Name", type: "text", note: "Sole Proprietor only" },
  { key: "last_name", label: "Last Name", type: "text", note: "Sole Proprietor only" },
  { key: "business_name", label: "Business Name", type: "text", note: "Non-Sole Proprietor only" },
  { key: "trade_name", label: "Trade Name", type: "text" },
  { key: "tax_type", label: "Tax Type", type: "dropdown" },
  { key: "source_of_income", label: "Source of Income", type: "dropdown" },
  { key: "tax_payer_classification", label: "Tax Payer Classification", type: "dropdown" },
  { key: "business_registration_numbers", label: "Business Registration Numbers", type: "text" },
  { key: "tin", label: "TIN", type: "tin", sample: "123-456-789-000" },
  { key: "sec_registration_no", label: "SEC Registration No", type: "text" },
  { key: "date_of_incorporation", label: "Date of Incorporation", type: "date" },
  { key: "dti_registration", label: "DTI Registration", type: "text" },
  { key: "date_of_expiration", label: "Date of Expiration", type: "date" },
  { key: "sss_employer_no", label: "SSS Employer No", type: "text" },
  { key: "phic_employer_no", label: "PHIC Employer No", type: "text" },
  { key: "hdmf_employer_no", label: "HDMF Employer No", type: "text" },
  { key: "corporation_signatory_type", label: "Corporation Signatory Type", type: "text" },
  { key: "sole_proprietor_signatory_type", label: "Sole Proprietor Signatory Type", type: "text" },
  { key: "registered_business_address", label: "Registered Business Address", type: "text" },
  { key: "rdo", label: "RDO", type: "text" },
  { key: "district", label: "District", type: "text" },
  { key: "zip_code", label: "Zip Code", type: "text" },
  { key: "google_map_location", label: "Google Map Location", type: "text" },
  { key: "fathers_name", label: "Father's Name", type: "text" },
  { key: "mothers_maiden_name", label: "Mother's Maiden Name", type: "text" },
  { key: "marital_status", label: "Marital Status", type: "text" },
  { key: "date_of_birth", label: "Date of Birth", type: "date" },
  { key: "citizenship", label: "Citizenship", type: "text" },
  { key: "gender", label: "Gender", type: "text" },
  { key: "present_home_address", label: "Present Home Address", type: "text" },
  { key: "permanent_home_address", label: "Permanent Home Address", type: "text" },
  { key: "personal_email_address", label: "Personal Email Address", type: "text" },
  { key: "contact_person", label: "Contact Person", type: "text" },
  { key: "designation", label: "Designation", type: "text" },
  { key: "email_address", label: "Email Address", type: "text", required: true, sample: "name@example.com" },
  { key: "contact_number", label: "Contact Number", type: "text" },
  { key: "official_office_contact_number", label: "Official Office Contact Number", type: "text" },
  { key: "annual_meeting_date", label: "Annual Meeting Date", type: "date" },
  { key: "president_name", label: "President Name", type: "text" },
  { key: "corporate_secretary_name", label: "Corporate Secretary Name", type: "text" },
];

const DATE_KEYS = COLUMNS.filter((c) => c.type === "date").map((c) => c.key);

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const norm = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

// header text (label or db key, any casing/spacing) -> column
const HEADER_MAP = {};
COLUMNS.forEach((c) => {
  HEADER_MAP[norm(c.label)] = c;
  HEADER_MAP[norm(c.key)] = c;
});

const formatTIN = (val) => {
  let f = String(val).replace(/[^0-9]/g, "").slice(0, 12);
  if (f.length > 9) f = `${f.slice(0, 3)}-${f.slice(3, 6)}-${f.slice(6, 9)}-${f.slice(9)}`;
  else if (f.length > 6) f = `${f.slice(0, 3)}-${f.slice(3, 6)}-${f.slice(6)}`;
  else if (f.length > 3) f = `${f.slice(0, 3)}-${f.slice(3)}`;
  return f;
};

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

const toISODate = (raw) => {
  if (!raw) return { value: null };
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return { value: raw };
  const d = new Date(raw);
  if (isNaN(d.getTime())) return { error: true };
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return { value: `${y}-${m}-${day}` };
};

const getLastCounter = async (year) => {
  const { data } = await supabase
    .from("client_profile")
    .select("client_id")
    .ilike("client_id", `${year}-%`)
    .order("client_id", { ascending: false })
    .limit(1);
  return data && data.length > 0 ? parseInt(data[0].client_id?.split("-")[1]) || 0 : 0;
};

// ─── VALIDATE ONE ROW ─────────────────────────────────────────────────────────
const validateRow = (rec, rowNum, dropdowns) => {
  const errors = [];
  const data = {};

  COLUMNS.forEach((col) => {
    const raw = String(rec[col.key] ?? "").trim();

    switch (col.type) {
      case "date": {
        const r = toISODate(raw);
        if (r.error) errors.push(`${col.label}: invalid date "${raw}" (use YYYY-MM-DD)`);
        data[col.key] = r.error ? null : r.value;
        break;
      }
      case "money": {
        if (!raw) { data[col.key] = null; break; }
        const n = parseFloat(raw.replace(/,/g, ""));
        if (isNaN(n)) errors.push(`${col.label}: "${raw}" is not a number`);
        data[col.key] = isNaN(n) ? null : n;
        break;
      }
      case "yesno": {
        const v = raw.toLowerCase();
        if (!v) data[col.key] = "No";
        else if (["yes", "y", "true", "1"].includes(v)) data[col.key] = "Yes";
        else if (["no", "n", "false", "0"].includes(v)) data[col.key] = "No";
        else { errors.push(`${col.label}: use Yes or No`); data[col.key] = "No"; }
        break;
      }
      case "tin":
        data[col.key] = formatTIN(raw);
        break;
      case "dropdown": {
        const list = (dropdowns[col.key] || []).map((o) => o[col.key]);
        if (!raw) { data[col.key] = ""; break; }
        if (list.length === 0) { data[col.key] = raw; break; } // list not loaded; skip check
        const match = list.find((v) => norm(v) === norm(raw));
        if (!match) errors.push(`${col.label}: "${raw}" is not in the list`);
        data[col.key] = match || raw;
        break;
      }
      default:
        data[col.key] = raw;
    }
  });

  // Business rules (same as the single-entry form)
  const isSoleProp = data.business_registration === "Sole Proprietor";
  if (!data.business_registration) errors.push("Business Registration is required");

  if (isSoleProp) {
    if (!data.first_name) errors.push("First Name is required for Sole Proprietor");
    if (!data.last_name) errors.push("Last Name is required for Sole Proprietor");
    data.business_name = `${data.first_name} ${data.middle_name} ${data.last_name}`
      .replace(/\s+/g, " ")
      .trim();
  } else if (data.business_registration && !data.business_name) {
    errors.push("Business Name is required");
  }

  data.entity_type = isSoleProp ? "Sole Proprietor" : data.business_registration ? "Corporation" : "";

  if (!data.email_address) errors.push("Email Address is required");
  else if (!isValidEmail(data.email_address)) errors.push("Email Address is invalid");

  return { rowNum, data, errors, warnings: [] };
};

// ─── COMPONENT ────────────────────────────────────────────────────────────────
export default function ClientBulkImport({ dropdowns, ddLoading }) {
  const fileRef = useRef(null);
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState("");
  const [unknownHeaders, setUnknownHeaders] = useState([]);
  const [parsing, setParsing] = useState(false);
   const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  const flash = (text, type) => { setMessage(text); setMessageType(type); };

  // ── Export existing clients ───────────────────────────────────────────────
  const exportClients = async () => {
    setExporting(true);
    setMessage("");
    try {
      const all = [];
      const pageSize = 1000;
      for (let from = 0; ; from += pageSize) {
        const { data, error } = await supabase
          .from("client_profile")
          .select("*")
          .order("client_id", { ascending: true })
          .range(from, from + pageSize - 1);
        if (error) throw error;
        all.push(...(data || []));
        if (!data || data.length < pageSize) break;
      }
      const header = COLUMNS.map((c) => c.label);
      const body = all.map((r) => COLUMNS.map((c) => r[c.key] ?? ""));
      const ws = XLSX.utils.aoa_to_sheet([header, ...body]);
      ws["!cols"] = header.map((h) => ({ wch: Math.max(h.length + 4, 18) }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Clients");
      const stamp = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `client_profiles_${stamp}.xlsx`);
      flash(
        all.length === 0
          ? "No clients yet. Downloaded a blank file with the correct columns."
          : `Exported ${all.length} client${all.length === 1 ? "" : "s"}.`,
        "success"
      );
    } catch (err) {
      flash(`Export failed: ${err.message}`, "error");
    } finally {
      setExporting(false);
    }
  };

  // ── Read the uploaded file ────────────────────────────────────────────────
  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParsing(true);
    setMessage("");
    setRows([]);
    setFileName(file.name);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, {
        defval: "",
        raw: false,
        dateNF: "yyyy-mm-dd",
      });
      if (json.length === 0) { flash("The file has no rows.", "error"); return; }

      // map headers -> column keys
      const unknown = new Set();
      const mapped = json.map((row) => {
        const rec = {};
        Object.entries(row).forEach(([h, v]) => {
          const col = HEADER_MAP[norm(h)];
          if (col) rec[col.key] = v;
          else if (!/^(clientid|approvalstatus|__empty.*)$/.test(norm(h))) unknown.add(h);
        });
        return rec;
      });
      setUnknownHeaders([...unknown]);

      const checked = mapped
        .map((rec, i) => ({ rec, rowNum: i + 2 }))
        .filter(({ rec }) => Object.values(rec).some((v) => String(v).trim() !== ""))
        .map(({ rec, rowNum }) => validateRow(rec, rowNum, dropdowns));

      // duplicate TIN checks (in file + in database)
      const seen = {};
      checked.forEach((r) => {
        const t = r.data.tin;
        if (!t) return;
        if (seen[t]) r.warnings.push(`TIN also appears in row ${seen[t]}`);
        else seen[t] = r.rowNum;
      });
      const tins = [...new Set(checked.map((r) => r.data.tin).filter(Boolean))];
       if (tins.length) {
        const existing = [];
        for (let i = 0; i < tins.length; i += 200) {
          const { data } = await supabase
            .from("client_profile")
            .select("tin, client_id")
            .in("tin", tins.slice(i, i + 200));
          existing.push(...(data || []));
        }
        const byTin = {};
        (existing || []).forEach((x) => { byTin[x.tin] = x.client_id; });
        checked.forEach((r) => {
          if (byTin[r.data.tin]) r.warnings.push(`TIN already exists (${byTin[r.data.tin]})`);
        });
      }

      setRows(checked);
    } catch (err) {
      flash(`Could not read file: ${err.message}`, "error");
    } finally {
      setParsing(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  // ── Import valid rows ─────────────────────────────────────────────────────
  const validRows = rows.filter((r) => r.errors.length === 0);
  const invalidRows = rows.filter((r) => r.errors.length > 0);

  const runImport = async () => {
    if (validRows.length === 0) return;
    setImporting(true);
    setMessage("");
    try {
      const year = String(new Date().getFullYear());
      let counter = await getLastCounter(year);

      const payload = validRows.map((r) => {
        counter += 1;
        return {
          client_id: `${year}-${String(counter).padStart(5, "0")}`,
          ...r.data,
          account: r.data.account || null,
          approval_status: "pending",
        };
      });

      const chunkSize = 100;
      let inserted = 0;
      setProgress({ done: 0, total: payload.length });
      for (let i = 0; i < payload.length; i += chunkSize) {
        const chunk = payload.slice(i, i + chunkSize);
        const { error } = await supabase.from("client_profile").insert(chunk);
        if (error) {
          throw new Error(
            `${error.message} (${inserted} of ${payload.length} were saved before the error)`
          );
        }
              inserted += chunk.length;
        setProgress({ done: inserted, total: payload.length });
      }

      flash(
        `Imported ${inserted} client${inserted === 1 ? "" : "s"} for approval` +
          (invalidRows.length ? `. ${invalidRows.length} row(s) with errors were skipped.` : "."),
        "success"
      );
      setRows([]);
      setFileName("");
    } catch (err) {
      flash(`Import failed: ${err.message}`, "error");

        } finally {
      setImporting(false);
      setProgress({ done: 0, total: 0 });
    }
  };

  const displayName= (r) =>
    r.data.business_name || [r.data.first_name, r.data.last_name].filter(Boolean).join(" ") || "—";

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="bg-white border rounded-lg border-slate-200">
      <div className="px-6 py-5 border-b border-slate-100 md:px-8 bg-slate-50/50">
        <h2 className="text-lg font-semibold text-slate-900">Import or export clients</h2>
        <p className="mt-1 text-sm text-slate-500">
          Add many clients at once from an Excel file, or download your current client list.
        </p>
      </div>

      <div className="p-6 md:p-8">
        {message && (
          <div
            className={`mb-6 p-4 rounded-md border-l-4 text-sm ${
              messageType === "success"
                ? "bg-emerald-50 border-emerald-500 text-emerald-700"
                : "bg-red-50 border-red-500 text-red-700"
            }`}
          >
            {message}
          </div>
        )}

        {/* Actions */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="p-5 border rounded-md border-slate-200">
            <p className="text-sm font-semibold text-slate-900">Import from Excel</p>
            <p className="mt-1 mb-4 text-sm text-slate-500">
              .xlsx, .xls or .csv. Use the same columns as the export file. Client IDs are
              generated automatically, and you can review the rows before anything is saved.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFile}
              className="hidden"
              id="client-import-file"
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={ddLoading || parsing || importing}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-md bg-teal-700 hover:bg-teal-800 text-white transition disabled:opacity-50"
            >
              <FaUpload size={12} /> {parsing ? "Reading file..." : "Choose Excel file"}
            </button>
          </div>

          <div className="p-5 border rounded-md border-slate-200">
            <p className="text-sm font-semibold text-slate-900">Export all clients</p>
            <p className="mt-1 mb-4 text-sm text-slate-500">
              Download every client profile as an Excel file. You can edit it and import it again
              as a starting point for new clients.
            </p>
            <button
              type="button"
              onClick={exportClients}
              disabled={exporting}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-md border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 transition disabled:opacity-50"
            >
              <FaDownload size={12} /> {exporting ? "Exporting..." : "Export to Excel"}
            </button>
          </div>
        </div>

        {/* Preview */}
        {rows.length > 0 && (
          <div className="mt-8">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">{fileName}</p>
                <p className="text-sm text-slate-500">
                  {rows.length} rows read:{" "}
                  <span className="font-medium text-emerald-700">{validRows.length} ready</span>
                  {invalidRows.length > 0 && (
                    <>, <span className="font-medium text-red-700">{invalidRows.length} with errors (will be skipped)</span></>
                  )}
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                                   onClick={() => { setRows([]); setFileName(""); }}
                  disabled={importing}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FaTimes size={11} /> Clear
                </button>
                <button
                  type="button"
                  onClick={runImport}
                  disabled={importing || validRows.length === 0}
                  className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-md bg-teal-700 hover:bg-teal-800 text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FaCheck size={11} />
                  {importing ? "Importing..." : `Import ${validRows.length} client${validRows.length === 1 ? "" : "s"}`}
                </button>
              </div>
            </div>

                        {importing && (
              <div className="mb-4">
                <div className="flex justify-between mb-1 text-xs text-slate-500">
                  <span>Importing clients... huwag munang isara ang page</span>
                  <span>{progress.done} / {progress.total}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full transition-all bg-teal-700"
                    style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            )}

            {unknownHeaders.length > 0 && (
              <p className="mb-3 text-xs text-amber-700">
                Ignored columns that don't match the template: {unknownHeaders.join(", ")}
              </p>
            )}

            <div className="overflow-auto border rounded-md border-slate-200 max-h-[28rem]">
              <table className="w-full text-sm text-left">
                <thead className="sticky top-0 bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-2 font-medium">Row</th>
                    <th className="px-4 py-2 font-medium">Name</th>
                    <th className="px-4 py-2 font-medium">Registration</th>
                    <th className="px-4 py-2 font-medium">TIN</th>
                    <th className="px-4 py-2 font-medium">Email</th>
                    <th className="px-4 py-2 font-medium">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.rowNum} className="align-top border-t border-slate-100">
                      <td className="px-4 py-2 text-slate-400">{r.rowNum}</td>
                      <td className="px-4 py-2 text-slate-800">{displayName(r)}</td>
                      <td className="px-4 py-2 text-slate-600">{r.data.business_registration || "—"}</td>
                      <td className="px-4 py-2 text-slate-600">{r.data.tin || "—"}</td>
                      <td className="px-4 py-2 text-slate-600">{r.data.email_address || "—"}</td>
                      <td className="px-4 py-2">
                        {r.errors.length === 0 ? (
                          <span className="text-emerald-700">Ready</span>
                        ) : (
                          <ul className="space-y-0.5 text-red-700">
                            {r.errors.map((m, i) => <li key={i}>{m}</li>)}
                          </ul>
                        )}
                        {r.warnings.length > 0 && (
                          <ul className="mt-1 space-y-0.5 text-amber-700">
                            {r.warnings.map((m, i) => <li key={i}>{m}</li>)}
                          </ul>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}