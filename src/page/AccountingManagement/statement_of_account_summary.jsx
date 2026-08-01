import React, { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import { FaSearch, FaTimes, FaUser, FaPrint, FaFileInvoiceDollar } from "react-icons/fa";

const GREEN = "#1a5c2e";
const inputCls =
  "w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 bg-white transition";
const labelCls = "block text-xs font-medium text-gray-500 mb-1";

function fmt(n) {
  return Number(n || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
function fmtLongDate(d) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt)) return d;
  return dt.toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
}
function firstOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0];
}
function today() {
  return new Date().toISOString().split("T")[0];
}

export default function StatementOfAccountSummary() {
  // ── Client ──
  const [clientSearch, setClientSearch] = useState("");
  const [clientResults, setClientResults] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showClientDrop, setShowClientDrop] = useState(false);
  const clientRef = useRef(null);

  // ── Period ──
  const [startDate, setStartDate] = useState(firstOfMonth());
  const [endDate, setEndDate] = useState(today());

  // ── Ledger ──
  const [loading, setLoading] = useState(false);
  const [ledgerRows, setLedgerRows] = useState([]); // rows inside the period, with running balance
  const [previousBalance, setPreviousBalance] = useState(0);
  const [dueDate, setDueDate] = useState(null);

  useEffect(() => {
    const handler = (e) => {
      if (clientRef.current && !clientRef.current.contains(e.target)) setShowClientDrop(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Client search — same query shape as CreateBilling.jsx / RecordPayment.jsx ──
  const searchApprovedClients = useCallback(async (term) => {
    setSearchLoading(true);
    try {
      let query = supabase
        .from("client_profile")
        .select(
          "id, client_id, business_name, trade_name, first_name, middle_name, last_name, registered_business_address, approval_status",
        )
        .eq("approval_status", "approved")
        .limit(8);

      if (term.trim()) {
        query = query.or(
          `business_name.ilike.%${term}%,client_id.ilike.%${term}%,first_name.ilike.%${term}%,last_name.ilike.%${term}%,trade_name.ilike.%${term}%`,
        );
      } else {
        query = query.order("business_name", { ascending: true });
      }
      const { data, error } = await query;
      if (!error) {
        setClientResults(data || []);
        setShowClientDrop(true);
      }
    } finally {
      setSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!clientSearch.trim() || selectedClient) return;
    const t = setTimeout(() => searchApprovedClients(clientSearch), 300);
    return () => clearTimeout(t);
  }, [clientSearch, selectedClient, searchApprovedClients]);

  const getClientPrimaryName = (c) => {
    if (!c) return "";
    if (c.business_name) return c.business_name;
    return [c.first_name, c.middle_name, c.last_name].filter(Boolean).join(" ") || c.client_id;
  };

  const selectClient = (c) => {
    setSelectedClient(c);
    setClientSearch(getClientPrimaryName(c));
    setShowClientDrop(false);
    setClientResults([]);
  };

  const clearClient = () => {
    setSelectedClient(null);
    setClientSearch("");
    setLedgerRows([]);
    setPreviousBalance(0);
    setDueDate(null);
  };

  // ── Build the ledger for the selected client + period ──
  const buildStatement = useCallback(async (client, start, end) => {
    if (!client) return;
    setLoading(true);
    try {
      // Charges — every finalized SOA for this client (any date, so we can compute previous balance)
      const { data: statements, error: stErr } = await supabase
        .from("billing_statements")
        .select("id, soa_number, soa_date, due_date, status")
        .eq("client_id", client.client_id)
        .not("status", "in", "(draft,pending_approval)")
        .order("soa_date", { ascending: true });
      if (stErr) throw stErr;

      const billingIds = (statements || []).map((b) => b.id);
      let items = [];
      if (billingIds.length > 0) {
        const { data: itemRows, error: itErr } = await supabase
          .from("billing_items")
          .select("billing_id, description, amount")
          .in("billing_id", billingIds);
        if (itErr) throw itErr;
        items = itemRows || [];
      }

  const chargeRows = (statements || []).flatMap((b) => {
  const its = items.filter((i) => i.billing_id === b.id);

  if (its.length === 0) {
    return [{
      date: b.soa_date,
      ref: b.soa_number,
      description: "Statement of Account",
      amount: 0,
      payment: 0,
      due_date: b.due_date,
    }];
  }

  return its.map((i) => ({
    date: b.soa_date,
    ref: b.soa_number,
    description: i.description || "Statement of Account",
    amount: Number(i.amount) || 0,
    payment: 0,
    due_date: b.due_date,
  }));
});

      // Payments
      const { data: receipts, error: orErr } = await supabase
        .from("official_receipts")
        .select("or_number, payment_date, amount, notes")
        .eq("client_id", client.client_id)
        .order("payment_date", { ascending: true });
      if (orErr) throw orErr;

      const paymentRows = (receipts || []).map((r) => ({
        date: r.payment_date,
        ref: r.or_number,
        description: r.notes || "Payment Received",
        amount: 0,
        payment: Number(r.amount) || 0,
        due_date: null,
      }));

      // Merge + sort chronologically
      const all = [...chargeRows, ...paymentRows].sort(
        (a, b) => new Date(a.date) - new Date(b.date),
      );

      // Previous balance = running total of everything strictly before start
      let running = 0;
      let prevBal = 0;
      const inPeriod = [];
      all.forEach((t) => {
        if (new Date(t.date) < new Date(start)) {
          running += t.amount - t.payment;
          prevBal = running;
        } else if (new Date(t.date) <= new Date(end)) {
          inPeriod.push(t);
        }
      });

      // Running balance for the printed table, starting from previous balance
      let displayRunning = prevBal;
      const rows = [
        {
          date: start,
          ref: "—",
          description: "Previous Outstanding Balance",
          amount: prevBal,
          payment: null,
          balance: prevBal,
          isOpening: true,
        },
        ...inPeriod.map((t) => {
          displayRunning += t.amount - t.payment;
          return { ...t, balance: displayRunning };
        }),
      ];

      // Due date shown in the summary box = latest due_date among charges within the period (or overall latest unpaid)
      const latestDue = [...chargeRows]
        .filter((c) => c.due_date && new Date(c.date) <= new Date(end))
        .sort((a, b) => new Date(b.due_date) - new Date(a.due_date))[0]?.due_date;

      setPreviousBalance(prevBal);
      setLedgerRows(rows);
      setDueDate(latestDue || null);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (selectedClient) buildStatement(selectedClient, startDate, endDate);
  }, [selectedClient, startDate, endDate, buildStatement]);

  const currentCharges = ledgerRows
    .filter((r) => !r.isOpening)
    .reduce((s, r) => s + (r.amount || 0), 0);
  const totalPayments = ledgerRows
    .filter((r) => !r.isOpening)
    .reduce((s, r) => s + (r.payment || 0), 0);
  const totalBalanceDue = previousBalance + currentCharges - totalPayments;

  const clientAddress = selectedClient?.registered_business_address || "";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Controls — hidden on print */}
      <div className="sticky top-0 z-10 px-6 py-4 bg-white border-b border-gray-200 print:hidden">
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative flex-1 min-w-[240px]" ref={clientRef}>
            <label className={labelCls}>Client</label>
            {!selectedClient ? (
              <>
                <div style={{ position: "relative" }}>
                  <FaSearch className="absolute text-gray-300 -translate-y-1/2 left-3 top-1/2" size={12} />
                  <input
                    type="text"
                    value={clientSearch}
                    onChange={(e) => {
                      setClientSearch(e.target.value);
                      setShowClientDrop(true);
                    }}
                    onFocus={() => {
                      searchApprovedClients(clientSearch);
                      setShowClientDrop(true);
                    }}
                    placeholder="Search business name or client ID..."
                    className="w-full py-2 pr-8 text-sm border border-gray-200 rounded-md pl-9 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
                  />
                  {searchLoading && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                  )}
                </div>
                {showClientDrop && clientResults.length > 0 && (
                  <div className="absolute left-0 right-0 z-30 mt-1 overflow-hidden overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg top-full max-h-56">
                    {clientResults.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => selectClient(c)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50 text-left border-b border-gray-50 last:border-0 transition"
                      >
                        <div className="flex items-center justify-center bg-blue-100 rounded-full w-7 h-7 shrink-0">
                          <FaUser size={10} className="text-blue-500" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-800">{getClientPrimaryName(c)}</p>
                          <p className="font-mono text-xs text-gray-400">{c.client_id}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-between px-3 py-2 border border-gray-200 rounded-md bg-gray-50">
                <div className="flex items-center gap-2.5">
                  <div className="flex items-center justify-center bg-blue-100 rounded-full w-7 h-7 shrink-0">
                    <FaUser size={10} className="text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{getClientPrimaryName(selectedClient)}</p>
                    <p className="font-mono text-xs text-gray-400">{selectedClient.client_id}</p>
                  </div>
                </div>
                <button onClick={clearClient} className="text-gray-300 hover:text-gray-500">
                  <FaTimes size={12} />
                </button>
              </div>
            )}
          </div>

          <div>
            <label className={labelCls}>Period Start</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Period End</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls} />
          </div>

          <button
            onClick={() => window.print()}
            disabled={!selectedClient}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white transition rounded-md disabled:opacity-50"
            style={{ background: GREEN }}
          >
            <FaPrint size={11} /> Print
          </button>
        </div>
      </div>

      {!selectedClient ? (
        <div className="flex flex-col items-center justify-center gap-2 py-24 text-gray-300 print:hidden">
          <FaFileInvoiceDollar size={28} />
          <p className="text-sm">Select a client to generate their Statement of Account Summary.</p>
        </div>
      ) : (
        <div className="p-6">
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-5 h-5 border-2 border-blue-500 rounded-full border-t-transparent animate-spin" />
            </div>
          ) : (
            <div
              className="print-area mx-auto bg-white text-[11px]"
              style={{ maxWidth: 900, fontFamily: "Arial, Helvetica Neue, sans-serif" }}
            >
              {/* ── HEADER ── */}
              <div className="flex items-start justify-between gap-6 p-5" style={{ borderBottom: `3px solid ${GREEN}` }}>
                <div className="flex items-start gap-3">
                  <img
                    src="https://pxzaexutvuatdexgkavk.supabase.co/storage/v1/object/public/assets/fortiserv_logo.png"
                    style={{ width: 60, height: 60, borderRadius: 8, objectFit: "contain", flexShrink: 0 }}
                  />
                  <div>
                    <div style={{ color: GREEN, fontWeight: 900, fontSize: 24, letterSpacing: 1, lineHeight: 1 }}>
                      FORTISERV
                    </div>
                    <div style={{ color: "#cc0000", fontWeight: 700, fontSize: 10, marginBottom: 2 }}>
                      BUSINESS MANAGEMENT ENTERPRISE, Co.
                    </div>
                    <div style={{ color: "#666", fontStyle: "italic", fontSize: 9, marginBottom: 10 }}>
                      "LET'S MAKE THINGS WORK BETTER."
                    </div>
                    <div style={{ borderTop: `2px solid ${GREEN}`, paddingTop: 8, fontSize: 9, color: "#444" }}>
                      <p>📍 Unit 32-A 3rd Floor M. Arce St. Heroes Del 96 Barangay 74</p>
                      <p style={{ color: "#888" }}>1400 City of Caloocan NCR Third District Philippines</p>
                      <p>📞 (02) 8995-0486 &nbsp;&nbsp; 📱 0917-315-9779</p>
                      <p>✉ collectionfbmec@gmail.com &nbsp;&nbsp; ⊕ fortiservbmec@gmail.com</p>
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div style={{ color: GREEN, fontWeight: 900, fontSize: 20, letterSpacing: 2, marginBottom: 10 }}>
                    STATEMENT OF ACCOUNT SUMMARY
                  </div>
                  <table
                    className="ml-auto text-left"
                    style={{ borderCollapse: "collapse", fontSize: 10, minWidth: 260 }}
                  >
                    <tbody>
                      {[
                        ["Date", fmtLongDate(endDate)],
                        ["Customer ID", selectedClient.client_id],
                        ["Client", getClientPrimaryName(selectedClient)],
                        ["Address", clientAddress || "—"],
                      ].map(([k, v]) => (
                        <tr key={k}>
                          <td style={{ padding: "3px 8px 3px 0", color: "#666", fontWeight: 600, whiteSpace: "nowrap" }}>
                            {k}
                          </td>
                          <td style={{ padding: "3px 0", color: "#222" }}>: {v}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <table
                    className="w-full mt-3"
                    style={{ borderCollapse: "collapse", border: `1px solid ${GREEN}`, fontSize: 10 }}
                  >
                    <thead>
                      <tr style={{ background: GREEN }}>
                        <th colSpan={2} style={{ padding: "5px 10px", color: "#fff", textAlign: "left" }}>
                          ACCOUNT SUMMARY
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ["PREVIOUS BALANCE", previousBalance],
                        ["PAYMENTS", totalPayments],
                        ["CURRENT CHARGES", currentCharges],
                      ].map(([k, v]) => (
                        <tr key={k} style={{ borderBottom: "1px solid #dceee3" }}>
                          <td style={{ padding: "5px 10px", color: "#444" }}>{k}</td>
                          <td style={{ padding: "5px 10px", textAlign: "right", fontFamily: "monospace" }}>
                            ₱{fmt(v)}
                          </td>
                        </tr>
                      ))}
                      <tr style={{ background: "#e8f5ec" }}>
                        <td style={{ padding: "6px 10px", fontWeight: 700, color: GREEN }}>TOTAL BALANCE DUE</td>
                        <td style={{ padding: "6px 10px", textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: GREEN }}>
                          ₱{fmt(totalBalanceDue)}
                        </td>
                      </tr>
                      <tr>
                        <td style={{ padding: "5px 10px", color: "#444" }}>DUE DATE</td>
                        <td style={{ padding: "5px 10px", textAlign: "right" }}>{fmtLongDate(dueDate)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ── TRANSACTION TABLE ── */}
              <table className="w-full" style={{ borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: GREEN }}>
                    {["Date", "SOA #", "Description", "Amount", "Payments", "Balance"].map((h, i) => (
                      <th
                        key={h}
                        className="font-semibold text-white"
                        style={{
                          padding: "8px 12px",
                          fontSize: 9.5,
                          textAlign: i >= 3 ? "right" : "left",
                          borderRight: i < 5 ? "1px solid rgba(255,255,255,0.2)" : "none",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ledgerRows.map((r, i) => (
                    <tr
                      key={i}
                      style={{ background: i % 2 === 0 ? "#fff" : "#f4faf6", borderBottom: "1px solid #e0ede5" }}
                    >
                      <td style={{ padding: "7px 12px", borderRight: "1px solid #e0ede5" }}>{fmtLongDate(r.date)}</td>
                      <td style={{ padding: "7px 12px", fontFamily: "monospace", borderRight: "1px solid #e0ede5" }}>
                        {r.ref}
                      </td>
                      <td style={{ padding: "7px 12px", borderRight: "1px solid #e0ede5" }}>{r.description}</td>
                      <td style={{ padding: "7px 12px", textAlign: "right", fontFamily: "monospace", borderRight: "1px solid #e0ede5" }}>
                        {r.amount ? `₱${fmt(r.amount)}` : "—"}
                      </td>
                      <td style={{ padding: "7px 12px", textAlign: "right", fontFamily: "monospace", borderRight: "1px solid #e0ede5" }}>
                        {r.payment ? `₱${fmt(r.payment)}` : "—"}
                      </td>
                      <td style={{ padding: "7px 12px", textAlign: "right", fontFamily: "monospace", fontWeight: 600 }}>
                        ₱{fmt(r.balance)}
                      </td>
                    </tr>
                  ))}
                  {ledgerRows.length <= 1 && (
                    <tr>
                      <td colSpan={6} className="py-6 text-xs text-center text-gray-400">
                        No transactions within this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              <div className="flex items-center justify-end gap-3 p-4" style={{ borderTop: `2px solid ${GREEN}` }}>
                <span className="text-sm font-medium text-gray-600">Account Outstanding Balance</span>
                <span
                  className="px-4 py-2 font-mono text-lg font-bold border-2 rounded-md"
                  style={{ borderColor: GREEN, color: GREEN }}
                >
                  ₱{fmt(totalBalanceDue)}
                </span>
              </div>

              {/* ── FOOTER NOTE ── */}
              <div className="p-5 mx-5 mb-5 text-sm text-center border rounded-lg" style={{ borderColor: "#dceee3" }}>
                <p>
                  Your account balance is <strong>₱{fmt(totalBalanceDue)}</strong>. Please settle your payment on or
                  before <strong>{fmtLongDate(dueDate)}</strong> to avoid service interruption. Please make all
                  checks payable to
                </p>
                <p className="mt-1 font-bold" style={{ color: GREEN }}>
                  Fortiserv Business Management Enterprise Co.
                </p>
                <p className="mt-3 italic" style={{ color: GREEN, fontSize: 16 }}>
                  Thank you for your business!
                </p>
                <p className="mt-3 text-xs text-gray-500">
                  Should you have any inquiries concerning this statement, please contact our Finance Section:
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Email: collectionfbmec@gmail.com &nbsp;·&nbsp; Viber: 0917 315 9779 &nbsp;·&nbsp; Landline: (02) 8985-0488
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: fixed; top: 0; left: 0; width: 100%; font-size: 9px; }
          @page { size: A4 portrait; margin: 8mm; }
        }
      `}</style>
    </div>
  );
}