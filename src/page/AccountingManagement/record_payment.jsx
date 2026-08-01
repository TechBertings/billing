import React, { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../../lib/supabaseClient";
import {
  FaSearch,
  FaTimes,
  FaUser,
  FaMoneyBillWave,
  FaReceipt,
  FaCheckCircle,
  FaArrowLeft,
  FaFileInvoiceDollar,
} from "react-icons/fa";

const inputCls =
  "w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 bg-white transition";
const labelCls = "block text-xs font-medium text-gray-500 mb-1";
const GREEN = "#1a5c2e";

function fmt(n) {
  return Number(n || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "cheque", label: "Cheque" },
  { value: "bank_transfer_chinabank", label: "Bank Transfer — China Bank" },
  { value: "bank_transfer_bdo", label: "Bank Transfer — BDO" },
  { value: "other", label: "Other" },
];

// OR-{YYYYMM}-{0001} — same numbering pattern as generateSOANumber() in CreateBilling.jsx
const generateORNumber = async () => {
  const now = new Date();
  const yr = now.getFullYear();
  const mo = String(now.getMonth() + 1).padStart(2, "0");
  const prefix = `OR-${yr}${mo}-`;
  const { data } = await supabase
    .from("official_receipts")
    .select("or_number")
    .ilike("or_number", `${prefix}%`)
    .order("or_number", { ascending: false })
    .limit(1);
  const last = data?.[0]?.or_number?.split("-").pop();
  const next = String((parseInt(last) || 0) + 1).padStart(4, "0");
  return `${prefix}${next}`;
};

/**
 * Props:
 *  - currentUser: same shape used elsewhere (fullName / full_name)
 *  - onClose(): go back / cancel (wire to your router's back nav)
 *  - onSaved(receipt): called after a successful insert
 *  - preselectedClient (optional): a client_profile row, skips the client search step
 *  - preselectedBillingId (optional): jump straight to a specific SOA (e.g. from AR Aging)
 */
export default function RecordPayment({
  currentUser,
  onClose,
  onSaved,
  preselectedClient = null,
  preselectedBillingId = null,
}) {
  // ── Client ──
  const [clientSearch, setClientSearch] = useState("");
  const [clientResults, setClientResults] = useState([]);
  const [selectedClient, setSelectedClient] = useState(preselectedClient);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showClientDrop, setShowClientDrop] = useState(false);
  const clientRef = useRef(null);

  // ── Outstanding SOAs for the selected client ──
  // Each row here carries a computed `balance` (charges - payments already
  // applied to that specific billing_id), NOT just the raw SOA status.
  const [outstandingSOAs, setOutstandingSOAs] = useState([]);
  const [soaLoading, setSoaLoading] = useState(false);
  const [selectedBilling, setSelectedBilling] = useState(null); // null = unapplied/general payment

  // ── Pagination for the Outstanding Statements list ──
  const [soaPage, setSoaPage] = useState(1);
  const SOA_PAGE_SIZE = 5;

  // ── Client credit balance (from overpayments) ──
  const [clientCredit, setClientCredit] = useState(0);
  const [creditLoading, setCreditLoading] = useState(false);
  const [applyingCredit, setApplyingCredit] = useState(false);

  // ── Line items for the selected SOA ──
  const [billingItems, setBillingItems] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(false);

  // ── Form ──
  const [orNumber, setOrNumber] = useState("Generating...");
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");

  // ── UI ──
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  const userFullName =
    currentUser?.fullName || currentUser?.full_name || "Unknown";

  useEffect(() => {
    generateORNumber().then(setOrNumber);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (clientRef.current && !clientRef.current.contains(e.target))
        setShowClientDrop(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Client search — same query shape as CreateBilling.jsx ──
  const searchApprovedClients = useCallback(async (term) => {
    setSearchLoading(true);
    try {
      let query = supabase
        .from("client_profile")
        .select(
          "id, client_id, business_name, trade_name, first_name, middle_name, last_name, approval_status",
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
    return (
      [c.first_name, c.middle_name, c.last_name].filter(Boolean).join(" ") ||
      c.client_id
    );
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
    setOutstandingSOAs([]);
    setSelectedBilling(null);
    setBillingItems([]);
    setClientCredit(0);
    setSoaPage(1);
  };

  // ── Fetch the client's available credit balance ──
  const fetchClientCredit = useCallback(async (client) => {
    if (!client) return;
    setCreditLoading(true);
    try {
      const { data, error } = await supabase
        .from("client_credits")
        .select("balance")
        .eq("client_id", client.client_id)
        .maybeSingle();
      if (error) throw error;
      setClientCredit(data?.balance ? Number(data.balance) : 0);
    } catch (err) {
      console.error("fetchClientCredit error:", err);
      setClientCredit(0);
    } finally {
      setCreditLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedClient) fetchClientCredit(selectedClient);
  }, [selectedClient, fetchClientCredit]);

  // ── Fetch outstanding SOAs once a client is selected ──────────────────
  // FIX: "outstanding" now means "has a remaining balance > 0", computed as
  // (sum of billing_items.amount) − (sum of official_receipts.amount already
  // applied to that billing_id). A SOA with status "approved"/"unpaid" that
  // has already been fully paid off will no longer show up here.
  const fetchOutstandingSOAs = useCallback(async (client) => {
    if (!client) return;
    setSoaLoading(true);
    try {
      const { data: statements, error: stErr } = await supabase
        .from("billing_statements")
        .select("id, soa_number, soa_date, due_date, status")
        .eq("client_id", client.client_id)
        .in("status", ["approved", "unpaid"])
        .order("soa_date", { ascending: false });
      if (stErr) throw stErr;

      const billingIds = (statements || []).map((s) => s.id);
      if (billingIds.length === 0) {
        setOutstandingSOAs([]);
        return;
      }

      // Charges per SOA
      const { data: items, error: itErr } = await supabase
        .from("billing_items")
        .select("billing_id, amount")
        .in("billing_id", billingIds);
      if (itErr) throw itErr;
      const chargeTotals = {};
      (items || []).forEach((i) => {
        chargeTotals[i.billing_id] = (chargeTotals[i.billing_id] || 0) + (Number(i.amount) || 0);
      });

      // Payments already applied directly to these SOAs
      const { data: receipts, error: orErr } = await supabase
        .from("official_receipts")
        .select("billing_id, amount")
        .in("billing_id", billingIds);
      if (orErr) throw orErr;
      const paidTotals = {};
      (receipts || []).forEach((r) => {
        paidTotals[r.billing_id] = (paidTotals[r.billing_id] || 0) + (Number(r.amount) || 0);
      });

      const withBalance = (statements || [])
        .map((s) => {
          const charges = chargeTotals[s.id] || 0;
          const paid = paidTotals[s.id] || 0;
          return { ...s, charges, paid, balance: charges - paid };
        })
        // Only keep SOAs that still owe something. A fully-settled SOA whose
        // status hasn't been flipped yet (e.g. old data) is filtered out here too.
        .filter((s) => s.balance > 0.005);

      setOutstandingSOAs(withBalance);
    } catch (err) {
      console.error("fetchOutstandingSOAs error:", err);
      setOutstandingSOAs([]);
    } finally {
      setSoaLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedClient) fetchOutstandingSOAs(selectedClient);
  }, [selectedClient, fetchOutstandingSOAs]);

  useEffect(() => {
    setSoaPage(1);
  }, [outstandingSOAs.length, selectedClient]);

  const soaTotalPages = Math.max(1, Math.ceil(outstandingSOAs.length / SOA_PAGE_SIZE));
  const paginatedSOAs = outstandingSOAs.slice(
    (soaPage - 1) * SOA_PAGE_SIZE,
    soaPage * SOA_PAGE_SIZE,
  );

  // Auto-pick a specific SOA when arriving from AR Aging / elsewhere
  useEffect(() => {
    if (preselectedBillingId && outstandingSOAs.length > 0) {
      const match = outstandingSOAs.find((s) => s.id === preselectedBillingId);
      if (match) pickBilling(match);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectedBillingId, outstandingSOAs]);

  // ── Fetch billing_items for the selected SOA ──
  const fetchBillingItems = useCallback(async (billing) => {
    if (!billing) {
      setBillingItems([]);
      return;
    }
    setItemsLoading(true);
    try {
      const { data, error } = await supabase
        .from("billing_items")
        .select("id, account_code, agency, description, period_covered, amount")
        .eq("billing_id", billing.id)
        .order("agency", { ascending: true });
      if (!error) setBillingItems(data || []);
    } finally {
      setItemsLoading(false);
    }
  }, []);

  const pickBilling = (b) => {
    setSelectedBilling(b);
    fetchBillingItems(b);
  };

  // ── Apply available credit toward the selected SOA ──
  // Separate action from the normal cash/bank payment form below — this
  // settles (fully or partially) the SOA using the client's existing credit
  // balance instead of new money. Still creates an official_receipts row
  // (payment_method: "credit") so it shows up in the audit trail / totals.
  const applyCreditToBilling = async () => {
    if (!selectedBilling || clientCredit <= 0) return;
    setApplyingCredit(true);
    setMessage("");
    try {
      const amt = Math.min(clientCredit, selectedBilling.balance);
      const creditOrNumber = await generateORNumber();

      const { data, error } = await supabase
        .from("official_receipts")
        .insert([{
          or_number: creditOrNumber,
          client_id: selectedClient.client_id,
          billing_id: selectedBilling.id,
          soa_number: selectedBilling.soa_number,
          amount: amt,
          payment_date: today_(),
          payment_method: "credit",
          reference_number: null,
          notes: "Applied from client credit balance",
          received_by: userFullName,
        }])
        .select()
        .single();
      if (error) throw error;

      // Deduct the used amount from the credit balance
      const newCredit = clientCredit - amt;
      const { error: creditErr } = await supabase
        .from("client_credits")
        .update({ balance: newCredit, updated_at: new Date().toISOString() })
        .eq("client_id", selectedClient.client_id);
      if (creditErr) throw creditErr;

      // Flip SOA to paid if this fully settles it
      const newBalance = selectedBilling.balance - amt;
      if (newBalance <= 0.005) {
        await supabase.from("billing_statements").update({ status: "paid" }).eq("id", selectedBilling.id);
      }

      setMessage(`₱${fmt(amt)} credit applied to ${selectedBilling.soa_number}.`);
      setMessageType("success");
      onSaved?.(data);

      await fetchOutstandingSOAs(selectedClient);
      await fetchClientCredit(selectedClient);
      setSelectedBilling(null);
      setBillingItems([]);
    } catch (err) {
      setMessage(`Error applying credit: ${err.message}`);
      setMessageType("error");
    }
    setApplyingCredit(false);
    setTimeout(() => setMessage(""), 4000);
  };

  function today_() {
    return new Date().toISOString().split("T")[0];
  }

  const itemsTotal = billingItems.reduce((sum, it) => sum + Number(it.amount || 0), 0);
  // FIX: "Use SOA total" should default to the *remaining balance*, not the
  // full original SOA amount — otherwise a partially-paid SOA would let you
  // accidentally overpay by prefilling the original total again.
  const remainingBalance = selectedBilling ? selectedBilling.balance : itemsTotal;

  // ── Submit ──
  const validate = () => {
    if (!selectedClient) {
      setMessage("Please select a client.");
      setMessageType("error");
      return false;
    }
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      setMessage("Please enter a valid payment amount.");
      setMessageType("error");
      return false;
    }
    if (!paymentDate) {
      setMessage("Please select a payment date.");
      setMessageType("error");
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSaving(true);
    setMessage("");
    try {
      const paidAmount = parseFloat(amount);
      const payload = {
        or_number: orNumber,
        client_id: selectedClient.client_id,
        billing_id: selectedBilling?.id || null,
        soa_number: selectedBilling?.soa_number || null,
        amount: paidAmount,
        payment_date: paymentDate,
        payment_method: paymentMethod,
        reference_number: referenceNumber || null,
        notes: notes || null,
        received_by: userFullName,
      };

      const { data, error } = await supabase
        .from("official_receipts")
        .insert([payload])
        .select()
        .single();

      if (error) throw error;

      // FIX: after the payment is recorded, flip the SOA's status once it's
      // fully settled so it drops out of "Outstanding Statements" / AR Aging
      // on next load — this is the update that was missing before.
      // If the payment OVERPAYS this SOA, the excess is banked as client
      // credit instead of silently disappearing.
      if (selectedBilling) {
        const newBalance = selectedBilling.balance - paidAmount;
        if (newBalance <= 0.005) {
          const { error: statusErr } = await supabase
            .from("billing_statements")
            .update({ status: "paid" })
            .eq("id", selectedBilling.id);
          if (statusErr) console.error("Failed to update SOA status to paid:", statusErr);
        }
        if (newBalance < -0.005) {
          const overpayment = Math.abs(newBalance);
          const { data: existing } = await supabase
            .from("client_credits")
            .select("balance")
            .eq("client_id", selectedClient.client_id)
            .maybeSingle();
          if (existing) {
            await supabase
              .from("client_credits")
              .update({ balance: Number(existing.balance) + overpayment, updated_at: new Date().toISOString() })
              .eq("client_id", selectedClient.client_id);
          } else {
            await supabase
              .from("client_credits")
              .insert([{ client_id: selectedClient.client_id, balance: overpayment }]);
          }
        }
      }

      setMessage(`Payment ${orNumber} recorded successfully.`);
      setMessageType("success");
      onSaved?.(data);

      // FIX: refresh state in place instead of relying on onClose/unmount —
      // previously the Outstanding Statements list only updated if the
      // component re-mounted, so a fully-paid SOA lingered until manual refresh.
      await fetchOutstandingSOAs(selectedClient);
      await fetchClientCredit(selectedClient);
      setSelectedBilling(null);
      setBillingItems([]);
      setAmount("");
      setReferenceNumber("");
      setNotes("");
      generateORNumber().then(setOrNumber);
    } catch (err) {
      setMessage(`Error: ${err.message}`);
      setMessageType("error");
    }
    setSaving(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="sticky top-0 z-20 flex items-center justify-between px-6 py-4 bg-white border-b border-gray-100">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-2 text-gray-400 transition rounded-md hover:text-gray-600 hover:bg-gray-100"
          >
            <FaArrowLeft size={14} />
          </button>
          <div
            className="flex items-center justify-center rounded-full w-9 h-9"
            style={{ background: "#e8f5ec" }}
          >
            <FaMoneyBillWave size={14} style={{ color: GREEN }} />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-gray-800">Record Payment</h1>
            <p className="font-mono text-xs text-gray-400">{orNumber}</p>
          </div>
        </div>
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white transition rounded-md disabled:opacity-50"
          style={{ background: GREEN }}
        >
          <FaReceipt size={12} />
          {saving ? "Saving..." : "Record Payment"}
        </button>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`mx-6 mt-4 px-4 py-2.5 rounded-md text-sm flex items-center justify-between border-l-4
          ${messageType === "success" ? "bg-green-50 border-green-500 text-green-700" : "bg-red-50 border-red-500 text-red-700"}`}
        >
          {message}
          <button onClick={() => setMessage("")}>
            <FaTimes size={11} />
          </button>
        </div>
      )}

      {/* Split view */}
      <div className="grid grid-cols-1 gap-5 p-6 lg:grid-cols-5">
        {/* LEFT — client + SOA list (2/5) */}
        <div className="space-y-5 lg:col-span-2">
          <div className="p-5 bg-white border border-gray-100 rounded-xl">
            <label className={labelCls}>Client</label>
            <div className="relative" ref={clientRef}>
              {!selectedClient ? (
                <>
                  <div style={{ position: "relative" }}>
                    <FaSearch
                      className="absolute text-gray-300 -translate-y-1/2 left-3 top-1/2"
                      size={12}
                    />
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
                            <p className="text-sm font-medium text-gray-800">
                              {getClientPrimaryName(c)}
                            </p>
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
                      <p className="text-sm font-medium text-gray-800">
                        {getClientPrimaryName(selectedClient)}
                      </p>
                      <p className="font-mono text-xs text-gray-400">
                        {selectedClient.client_id}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={clearClient}
                    className="text-gray-300 hover:text-gray-500"
                  >
                    <FaTimes size={12} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Client credit balance — from past overpayments */}
          {selectedClient && !creditLoading && clientCredit > 0.005 && (
            <div className="flex items-center justify-between px-4 py-3 border rounded-xl" style={{ borderColor: "#bfe3cb", background: "#e8f5ec" }}>
              <div>
                <p className="text-xs font-semibold tracking-wide uppercase" style={{ color: GREEN }}>Available Credit</p>
                <p className="font-mono text-lg font-bold" style={{ color: GREEN }}>₱{fmt(clientCredit)}</p>
              </div>
              {selectedBilling && (
                <button
                  onClick={applyCreditToBilling}
                  disabled={applyingCredit}
                  className="px-3 py-2 text-xs font-semibold text-white transition rounded-md disabled:opacity-50"
                  style={{ background: GREEN }}
                >
                  {applyingCredit ? "Applying..." : `Apply to ${selectedBilling.soa_number}`}
                </button>
              )}
            </div>
          )}

          {/* Outstanding SOAs — now shows remaining balance, not just status */}
          {selectedClient && (
            <div className="p-5 bg-white border border-gray-100 rounded-xl">
              <label className={labelCls}>Outstanding Statements</label>
              {soaLoading ? (
                <div className="flex justify-center py-4">
                  <div className="w-4 h-4 border-2 border-blue-500 rounded-full border-t-transparent animate-spin" />
                </div>
              ) : outstandingSOAs.length === 0 ? (
                <p className="px-3 py-2 text-xs text-gray-400 border border-gray-200 border-dashed rounded-md">
                  No outstanding statements found — this will be recorded as a
                  general payment.
                </p>
              ) : (
                <div className="space-y-1.5">
                  <button
                    onClick={() => pickBilling(null)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-md border text-left text-xs transition ${
                      selectedBilling === null
                        ? "border-green-400 bg-green-50"
                        : "border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <span className="text-gray-500">General / unapplied payment</span>
                    {selectedBilling === null && (
                      <FaCheckCircle size={11} style={{ color: GREEN }} />
                    )}
                  </button>
                  {paginatedSOAs.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => pickBilling(b)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-md border text-left text-xs transition ${
                        selectedBilling?.id === b.id
                          ? "border-green-400 bg-green-50"
                          : "border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      <div>
                        <p className="font-mono font-medium text-gray-700">
                          {b.soa_number}
                        </p>
                        <p className="text-gray-400">
                          Due {fmtDate(b.due_date)}
                          {b.paid > 0 && <span className="text-blue-500"> · partially paid</span>}
                        </p>
                      </div>
                      <div className="text-right">
                        {selectedBilling?.id === b.id && (
                          <FaCheckCircle size={11} style={{ color: GREEN }} className="inline mb-1" />
                        )}
                        <p className="font-mono font-semibold text-gray-700">₱{fmt(b.balance)}</p>
                        <p className="text-[10px] text-gray-400">balance</p>
                      </div>
                    </button>
                  ))}

                  {/* Pagination */}
                  {outstandingSOAs.length > SOA_PAGE_SIZE && (
                    <div className="flex items-center justify-between pt-2 mt-2 border-t border-gray-100">
                      <span className="text-[11px] text-gray-400">
                        {(soaPage - 1) * SOA_PAGE_SIZE + 1}–{Math.min(soaPage * SOA_PAGE_SIZE, outstandingSOAs.length)} of {outstandingSOAs.length}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setSoaPage((p) => Math.max(1, p - 1))}
                          disabled={soaPage === 1}
                          className="px-2 py-1 text-[11px] border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
                        >
                          Prev
                        </button>
                        <span className="text-[11px] text-gray-500">{soaPage}/{soaTotalPages}</span>
                        <button
                          onClick={() => setSoaPage((p) => Math.min(soaTotalPages, p + 1))}
                          disabled={soaPage === soaTotalPages}
                          className="px-2 py-1 text-[11px] border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT — SOA breakdown + payment form (3/5) */}
        <div className="space-y-5 lg:col-span-3">
          {/* SOA breakdown */}
          {selectedBilling && (
            <div className="p-5 bg-white border border-gray-100 rounded-xl">
              <div className="flex items-center gap-2 mb-3">
                <FaFileInvoiceDollar size={12} style={{ color: GREEN }} />
                <p className="text-sm font-semibold text-gray-800">
                  {selectedBilling.soa_number}
                </p>
                <span className="text-xs text-gray-400">
                  · SOA date {fmtDate(selectedBilling.soa_date)} · Due{" "}
                  {fmtDate(selectedBilling.due_date)}
                </span>
              </div>

              {itemsLoading ? (
                <div className="flex justify-center py-6">
                  <div className="w-4 h-4 border-2 border-blue-500 rounded-full border-t-transparent animate-spin" />
                </div>
              ) : billingItems.length === 0 ? (
                <p className="px-3 py-2 text-xs text-gray-400 border border-gray-200 border-dashed rounded-md">
                  No line items found for this statement.
                </p>
              ) : (
                <div className="overflow-hidden border border-gray-100 rounded-lg">
                  <table className="w-full text-xs">
                    <thead className="text-gray-500 bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 font-medium text-left">Agency</th>
                        <th className="px-3 py-2 font-medium text-left">Description</th>
                        <th className="px-3 py-2 font-medium text-left">Period</th>
                        <th className="px-3 py-2 font-medium text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {billingItems.map((it) => (
                        <tr key={it.id} className="border-t border-gray-50">
                          <td className="px-3 py-2 text-gray-700">{it.agency || "—"}</td>
                          <td className="px-3 py-2 text-gray-600">{it.description || "—"}</td>
                          <td className="px-3 py-2 text-gray-400">{it.period_covered || "—"}</td>
                          <td className="px-3 py-2 font-mono text-right text-gray-700">
                            ₱{fmt(it.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-gray-200 bg-gray-50">
                        <td colSpan={3} className="px-3 py-2 font-medium text-right text-gray-600">
                          SOA Total
                        </td>
                        <td className="px-3 py-2 font-mono font-semibold text-right text-gray-600">
                          ₱{fmt(itemsTotal)}
                        </td>
                      </tr>
                      {selectedBilling.paid > 0 && (
                        <tr className="border-t border-gray-100 bg-gray-50">
                          <td colSpan={3} className="px-3 py-2 text-right text-gray-500">
                            Already paid
                          </td>
                          <td className="px-3 py-2 font-mono text-right text-gray-500">
                            − ₱{fmt(selectedBilling.paid)}
                          </td>
                        </tr>
                      )}
                      <tr className="border-t border-gray-200 bg-gray-50">
                        <td colSpan={3} className="px-3 py-2 font-semibold text-right text-gray-700">
                          Remaining Balance
                        </td>
                        <td className="px-3 py-2 font-mono font-bold text-right" style={{ color: GREEN }}>
                          ₱{fmt(remainingBalance)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Payment form */}
          <div className="p-5 space-y-4 bg-white border border-gray-100 rounded-xl">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Payment Date</label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Amount</label>
                <div className="relative">
                  <span className="absolute text-sm text-gray-400 -translate-y-1/2 left-3 top-1/2">
                    ₱
                  </span>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    className={`${inputCls} pl-7 font-mono`}
                  />
                </div>
                {selectedBilling && (
                  <button
                    type="button"
                    onClick={() => setAmount(remainingBalance.toFixed(2))}
                    className="mt-1 text-xs text-blue-500 hover:underline"
                  >
                    Use remaining balance (₱{fmt(remainingBalance)})
                  </button>
                )}
                {selectedBilling && parseFloat(amount) > remainingBalance + 0.005 && (
                  <p className="mt-1 text-[11px] text-amber-600">
                    This exceeds the remaining balance by ₱{fmt(parseFloat(amount) - remainingBalance)} — the excess will be recorded but won't apply to this SOA.
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className={inputCls}
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Reference No.</label>
                <input
                  type="text"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  placeholder="Cheque / transfer ref"
                  className={inputCls}
                />
              </div>
            </div>

            <div>
              <label className={labelCls}>Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Optional notes..."
                className={`${inputCls} resize-none`}
              />
            </div>

            <div>
              <label className={labelCls}>Received By</label>
              <input
                type="text"
                value={userFullName}
                readOnly
                disabled
                className="w-full px-3 py-2 text-sm text-gray-500 border border-gray-100 rounded-md cursor-not-allowed bg-gray-50"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}