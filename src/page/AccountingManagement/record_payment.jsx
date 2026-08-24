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
  FaUndo,
} from "react-icons/fa";
const inputCls =
  "w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 bg-white transition";
const labelCls = "block text-xs font-medium text-gray-500 mb-1";
const GREEN = "#1a5c2e";
const RED = "#c0392b";

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
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "other", label: "Other" },
];

const RECEIVING_BANKS = [
  { value: "bdo", label: "BDO" },
  { value: "chinabank", label: "Chinabank" },
];

// INV-{YYYYMM}-{0001} — same numbering pattern as generateSOANumber() in CreateBilling.jsx
const generateInvoiceNumber = async () => {
  const now = new Date();
  const yr = now.getFullYear();
  const prefix = `INV-${yr}-`;
  const { data } = await supabase
    .from("official_receipts")
    .select("invoice_number")
    .ilike("invoice_number", `${prefix}%`)
    .order("invoice_number", { ascending: false })
    .limit(1);
  const last = data?.[0]?.invoice_number?.split("-").pop();
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
  const [invoiceNumber, setInvoiceNumber] = useState("Generating...");
  const [collectionDate, setCollectionDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [chequeNumber, setChequeNumber] = useState("");
  const [chequeBank, setChequeBank] = useState("");
  const [draweeBank, setDraweeBank] = useState("");
  const [receivingBank, setReceivingBank] = useState("");
  const [collectedBy, setCollectedBy] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");

  const [showReversalModal, setShowReversalModal] = useState(false);
  const [reversalOrNumber, setReversalOrNumber] = useState("");
  const [reversalDate, setReversalDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [reversalReason, setReversalReason] = useState("");
  const [reversing, setReversing] = useState(false);
  const [reversalSearch, setReversalSearch] = useState("");
  const [reversalResults, setReversalResults] = useState([]);
  const [reversalSearchLoading, setReversalSearchLoading] = useState(false);
  const [showReversalDrop, setShowReversalDrop] = useState(false);
  const [selectedReversalReceipt, setSelectedReversalReceipt] = useState(null);
  const reversalRef = useRef(null);
  const [reversalDateFrom, setReversalDateFrom] = useState("");
  const [reversalDateTo, setReversalDateTo] = useState("");
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  // ── UI ──
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  const userFullName =
    currentUser?.fullName || currentUser?.full_name || "Unknown";

  useEffect(() => {
    generateInvoiceNumber().then(setInvoiceNumber);
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
        chargeTotals[i.billing_id] =
          (chargeTotals[i.billing_id] || 0) + (Number(i.amount) || 0);
      });

      // Payments already applied directly to these SOAs
      const { data: receipts, error: orErr } = await supabase
        .from("official_receipts")
        .select("billing_id, amount")
        .in("billing_id", billingIds);
      if (orErr) throw orErr;
      const paidTotals = {};
      (receipts || []).forEach((r) => {
        paidTotals[r.billing_id] =
          (paidTotals[r.billing_id] || 0) + (Number(r.amount) || 0);
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

  const searchReversalReceipts = useCallback(async (term, dateFrom, dateTo) => {
    setReversalSearchLoading(true);
    try {
      let query = supabase
        .from("official_receipts")
        .select(
          "id, invoice_number, client_id, amount, payment_date, payment_method, notes",
        )
        .order("payment_date", { ascending: false })
        .limit(10);

      if (term.trim()) {
        query = query.ilike("invoice_number", `%${term.trim()}%`);
      }
      if (dateFrom) {
        query = query.gte("payment_date", dateFrom);
      }
      if (dateTo) {
        query = query.lte("payment_date", dateTo);
      }

      const { data, error } = await query;
      if (error || !data) {
        setReversalResults([]);
        return;
      }

      const clientIds = [
        ...new Set(data.map((r) => r.client_id).filter(Boolean)),
      ];
      let clientMap = {};
      if (clientIds.length > 0) {
        const { data: clients } = await supabase
          .from("client_profile")
          .select(
            "client_id, business_name, first_name, middle_name, last_name",
          )
          .in("client_id", clientIds);
        (clients || []).forEach((c) => {
          clientMap[c.client_id] = c;
        });
      }

      setReversalResults(
        data.map((r) => {
          const c = clientMap[r.client_id];
          const clientName = c
            ? c.business_name ||
              [c.first_name, c.middle_name, c.last_name]
                .filter(Boolean)
                .join(" ") ||
              r.client_id
            : r.client_id || "Unknown client";
          return { ...r, clientName };
        }),
      );
    } finally {
      setReversalSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedReversalReceipt) return;
    const t = setTimeout(
      () =>
        searchReversalReceipts(
          reversalSearch,
          reversalDateFrom,
          reversalDateTo,
        ),
      300,
    );
    return () => clearTimeout(t);
  }, [
    reversalSearch,
    reversalDateFrom,
    reversalDateTo,
    selectedReversalReceipt,
    searchReversalReceipts,
  ]);

  useEffect(() => {
    const handler = (e) => {
      if (reversalRef.current && !reversalRef.current.contains(e.target))
        setShowReversalDrop(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const pickReversalReceipt = (r) => {
    setSelectedReversalReceipt(r);
    setReversalOrNumber(r.invoice_number);
    setReversalSearch(r.invoice_number);
    setShowReversalDrop(false);
    setReversalResults([]);
  };

  const clearReversalReceipt = () => {
    setSelectedReversalReceipt(null);
    setReversalOrNumber("");
    setReversalSearch("");
  };

  useEffect(() => {
    setSoaPage(1);
  }, [outstandingSOAs.length, selectedClient]);

  const soaTotalPages = Math.max(
    1,
    Math.ceil(outstandingSOAs.length / SOA_PAGE_SIZE),
  );
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
      const creditInvoiceNumber = await generateInvoiceNumber();

      const { data, error } = await supabase
        .from("official_receipts")
        .insert([
          {
            invoice_number: creditInvoiceNumber,
            client_id: selectedClient.client_id,
            billing_id: selectedBilling.id,
            soa_number: selectedBilling.soa_number,
            amount: amt,
            payment_date: today_(),
            payment_method: "credit",
            reference_number: null,
            notes: "Applied from client credit balance",
            collected_by: null,
            recorded_by: userFullName,
          },
        ])
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
        await supabase
          .from("billing_statements")
          .update({ status: "paid" })
          .eq("id", selectedBilling.id);
      }

      setMessage(
        `₱${fmt(amt)} credit applied to ${selectedBilling.soa_number}.`,
      );
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

  const itemsTotal = billingItems.reduce(
    (sum, it) => sum + Number(it.amount || 0),
    0,
  );
  // FIX: "Use SOA total" should default to the *remaining balance*, not the
  // full original SOA amount — otherwise a partially-paid SOA would let you
  // accidentally overpay by prefilling the original total again.
  const remainingBalance = selectedBilling
    ? selectedBilling.balance
    : itemsTotal;

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
    if (!collectionDate) {
      setMessage("Please select a collection date.");
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
        invoice_number: invoiceNumber,
        client_id: selectedClient.client_id,
        billing_id: selectedBilling?.id || null,
        soa_number: selectedBilling?.soa_number || null,
        amount: paidAmount,
        payment_date: collectionDate,
        payment_method: paymentMethod,
        reference_number: referenceNumber || null,
        cheque_number: paymentMethod === "cheque" ? chequeNumber || null : null,
        cheque_bank: paymentMethod === "cheque" ? chequeBank || null : null,
        drawee_bank:
          paymentMethod === "cheque" || paymentMethod === "bank_transfer"
            ? draweeBank || null
            : null,
        receiving_bank:
          paymentMethod === "bank_transfer" ? receivingBank || null : null,
        notes: notes || null,
        collected_by:
          paymentMethod === "cash" || paymentMethod === "cheque"
            ? collectedBy || null
            : null, // Collected by — manual, cash & cheque
        recorded_by: userFullName,
        deposit_status:
          paymentMethod === "bank_transfer" ? "deposited" : "undeposited",
        deposited_date:
          paymentMethod === "bank_transfer" ? collectionDate : null,
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
          if (statusErr)
            console.error("Failed to update SOA status to paid:", statusErr);
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
              .update({
                balance: Number(existing.balance) + overpayment,
                updated_at: new Date().toISOString(),
              })
              .eq("client_id", selectedClient.client_id);
          } else {
            await supabase
              .from("client_credits")
              .insert([
                { client_id: selectedClient.client_id, balance: overpayment },
              ]);
          }
        }
      }

      setMessage(`Invoice ${invoiceNumber} recorded successfully.`);
      setMessageType("success");
      onSaved?.(data);

      await fetchOutstandingSOAs(selectedClient);
      await fetchClientCredit(selectedClient);
      setSelectedBilling(null);
      setBillingItems([]);
      setAmount("");
      setReferenceNumber("");
      setChequeNumber("");
      setChequeBank("");
      setDraweeBank("");
      setReceivingBank("");
      setCollectedBy("");
      setNotes("");
      generateInvoiceNumber().then(setInvoiceNumber);
    } catch (err) {
      setMessage(`Error: ${err.message}`);
      setMessageType("error");
    }
    setSaving(false);
  };

  const handleReversal = async () => {
    if (!reversalOrNumber.trim() || !reversalDate) {
      setMessage("OR Number and reversal date are required.");
      setMessageType("error");
      return;
    }
    setReversing(true);
    setMessage("");
    try {
      const { data: original, error: findErr } = await supabase
        .from("official_receipts")
        .select("*")
        .eq("invoice_number", reversalOrNumber.trim())
        .maybeSingle();
      if (findErr) throw findErr;
      if (!original) {
        setMessage(`OR ${reversalOrNumber} not found.`);
        setMessageType("error");
        setReversing(false);
        return;
      }

      const reversalInvoiceNumber = await generateInvoiceNumber();
      const { data, error } = await supabase
        .from("official_receipts")
        .insert([
          {
            invoice_number: reversalInvoiceNumber,
            client_id: original.client_id,
            billing_id: original.billing_id,
            soa_number: original.soa_number,
            amount: -Math.abs(original.amount),
            payment_date: paymentDate,
            payment_method: original.payment_method,
            reference_number: original.reference_number,
            notes: `Reversal of Invoice ${original.invoice_number} (recorded ${reversalDate})${reversalReason ? " — " + reversalReason : ""}`,
            collected_by: original.collected_by,
            recorded_by: userFullName,
          },
        ])
        .select()
        .single();
      if (error) throw error;

      if (original.billing_id) {
        await supabase
          .from("billing_statements")
          .update({ status: "approved" })
          .eq("id", original.billing_id);
      }

      setMessage(
        `Reversal recorded against Invoice ${original.invoice_number}.`,
      );
      setMessageType("success");
      onSaved?.(data);
      setShowReversalModal(false);
      setReversalOrNumber("");
      setReversalReason("");
      setReversalDate(new Date().toISOString().split("T")[0]);
      setPaymentDate(new Date().toISOString().split("T")[0]);
      setReversalDateFrom("");
      setReversalDateTo("");
      clearReversalReceipt();
      if (selectedClient) {
        await fetchOutstandingSOAs(selectedClient);
        await fetchClientCredit(selectedClient);
      }
    } catch (err) {
      setMessage(`Error: ${err.message}`);
      setMessageType("error");
    }
    setReversing(false);
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
            <h1 className="text-sm font-semibold text-gray-800">
              Record Payment
            </h1>
            <p className="font-mono text-xs text-gray-400">
              Invoice {invoiceNumber}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowReversalModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-red-600 transition border border-red-200 rounded-md hover:bg-red-50"
          >
            <FaUndo size={12} />
            Reversal Entry
          </button>
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
                            <p className="font-mono text-xs text-gray-400">
                              {c.client_id}
                            </p>
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
            <div
              className="flex items-center justify-between px-4 py-3 border rounded-xl"
              style={{ borderColor: "#bfe3cb", background: "#e8f5ec" }}
            >
              <div>
                <p
                  className="text-xs font-semibold tracking-wide uppercase"
                  style={{ color: GREEN }}
                >
                  Available Credit
                </p>
                <p
                  className="font-mono text-lg font-bold"
                  style={{ color: GREEN }}
                >
                  ₱{fmt(clientCredit)}
                </p>
              </div>
              {selectedBilling && (
                <button
                  onClick={applyCreditToBilling}
                  disabled={applyingCredit}
                  className="px-3 py-2 text-xs font-semibold text-white transition rounded-md disabled:opacity-50"
                  style={{ background: GREEN }}
                >
                  {applyingCredit
                    ? "Applying..."
                    : `Apply to ${selectedBilling.soa_number}`}
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
                    <span className="text-gray-500">
                      General / unapplied payment
                    </span>
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
                          {b.paid > 0 && (
                            <span className="text-blue-500">
                              {" "}
                              · partially paid
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="text-right">
                        {selectedBilling?.id === b.id && (
                          <FaCheckCircle
                            size={11}
                            style={{ color: GREEN }}
                            className="inline mb-1"
                          />
                        )}
                        <p className="font-mono font-semibold text-gray-700">
                          ₱{fmt(b.balance)}
                        </p>
                        <p className="text-[10px] text-gray-400">balance</p>
                      </div>
                    </button>
                  ))}

                  {/* Pagination */}
                  {outstandingSOAs.length > SOA_PAGE_SIZE && (
                    <div className="flex items-center justify-between pt-2 mt-2 border-t border-gray-100">
                      <span className="text-[11px] text-gray-400">
                        {(soaPage - 1) * SOA_PAGE_SIZE + 1}–
                        {Math.min(
                          soaPage * SOA_PAGE_SIZE,
                          outstandingSOAs.length,
                        )}{" "}
                        of {outstandingSOAs.length}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setSoaPage((p) => Math.max(1, p - 1))}
                          disabled={soaPage === 1}
                          className="px-2 py-1 text-[11px] border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
                        >
                          Prev
                        </button>
                        <span className="text-[11px] text-gray-500">
                          {soaPage}/{soaTotalPages}
                        </span>
                        <button
                          onClick={() =>
                            setSoaPage((p) => Math.min(soaTotalPages, p + 1))
                          }
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
                        <th className="px-3 py-2 font-medium text-left">
                          Agency
                        </th>
                        <th className="px-3 py-2 font-medium text-left">
                          Description
                        </th>
                        <th className="px-3 py-2 font-medium text-left">
                          Period
                        </th>
                        <th className="px-3 py-2 font-medium text-right">
                          Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {billingItems.map((it) => (
                        <tr key={it.id} className="border-t border-gray-50">
                          <td className="px-3 py-2 text-gray-700">
                            {it.agency || "—"}
                          </td>
                          <td className="px-3 py-2 text-gray-600">
                            {it.description || "—"}
                          </td>
                          <td className="px-3 py-2 text-gray-400">
                            {it.period_covered || "—"}
                          </td>
                          <td className="px-3 py-2 font-mono text-right text-gray-700">
                            ₱{fmt(it.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-gray-200 bg-gray-50">
                        <td
                          colSpan={3}
                          className="px-3 py-2 font-medium text-right text-gray-600"
                        >
                          SOA Total
                        </td>
                        <td className="px-3 py-2 font-mono font-semibold text-right text-gray-600">
                          ₱{fmt(itemsTotal)}
                        </td>
                      </tr>
                      {selectedBilling.paid > 0 && (
                        <tr className="border-t border-gray-100 bg-gray-50">
                          <td
                            colSpan={3}
                            className="px-3 py-2 text-right text-gray-500"
                          >
                            Already paid
                          </td>
                          <td className="px-3 py-2 font-mono text-right text-gray-500">
                            − ₱{fmt(selectedBilling.paid)}
                          </td>
                        </tr>
                      )}
                      <tr className="border-t border-gray-200 bg-gray-50">
                        <td
                          colSpan={3}
                          className="px-3 py-2 font-semibold text-right text-gray-700"
                        >
                          Remaining Balance
                        </td>
                        <td
                          className="px-3 py-2 font-mono font-bold text-right"
                          style={{ color: GREEN }}
                        >
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
                <label className={labelCls}>Collection Date</label>
                <input
                  type="date"
                  value={collectionDate}
                  onChange={(e) => setCollectionDate(e.target.value)}
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
                {selectedBilling &&
                  parseFloat(amount) > remainingBalance + 0.005 && (
                    <p className="mt-1 text-[11px] text-amber-600">
                      This exceeds the remaining balance by ₱
                      {fmt(parseFloat(amount) - remainingBalance)} — the excess
                      will be recorded but won't apply to this SOA.
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
              {paymentMethod === "cheque" && (
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className={labelCls}>Cheque Number</label>
                    <input
                      type="text"
                      value={chequeNumber}
                      onChange={(e) => setChequeNumber(e.target.value)}
                      placeholder="e.g. 0001234"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Cheque Bank</label>
                    <input
                      type="text"
                      value={chequeBank}
                      onChange={(e) => setChequeBank(e.target.value)}
                      placeholder="Issuing bank"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Drawee Bank</label>
                    <input
                      type="text"
                      value={draweeBank}
                      onChange={(e) => setDraweeBank(e.target.value)}
                      placeholder="Bank the cheque is drawn from"
                      className={inputCls}
                    />
                  </div>
                </div>
              )}

              {paymentMethod === "bank_transfer" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Drawee Bank</label>
                    <input
                      type="text"
                      value={draweeBank}
                      onChange={(e) => setDraweeBank(e.target.value)}
                      placeholder="Client's originating bank"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Receiving Bank</label>
                    <select
                      value={receivingBank}
                      onChange={(e) => setReceivingBank(e.target.value)}
                      className={inputCls}
                    >
                      <option value="">Select bank...</option>
                      {RECEIVING_BANKS.map((b) => (
                        <option key={b.value} value={b.value}>
                          {b.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
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

            <div
              className={`grid gap-3 ${
                paymentMethod === "cash" || paymentMethod === "cheque"
                  ? "grid-cols-2"
                  : "grid-cols-1"
              }`}
            >
              {(paymentMethod === "cash" || paymentMethod === "cheque") && (
                <div>
                  <label className={labelCls}>Collected by:</label>
                  <input
                    type="text"
                    value={collectedBy}
                    onChange={(e) => setCollectedBy(e.target.value)}
                    placeholder={
                      paymentMethod === "cash"
                        ? "Name of person who collected the cash"
                        : "Name of person who collected the cheque"
                    }
                    className={inputCls}
                  />
                </div>
              )}
              <div>
                <label className={labelCls}>Recorded by:</label>
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

      {showReversalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="w-full max-w-md p-5 bg-white shadow-2xl rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-800">
                Reversal Entry
              </h2>
              <button
                onClick={() => setShowReversalModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <FaTimes size={14} />
              </button>
            </div>
            <div className="space-y-3">
              <div className="relative" ref={reversalRef}>
                <label className={labelCls}>Invoice to reverse</label>
                {!selectedReversalReceipt ? (
                  <>
                    <div style={{ position: "relative" }}>
                      <FaSearch
                        className="absolute text-gray-300 -translate-y-1/2 left-3 top-1/2"
                        size={12}
                      />
                      <input
                        type="text"
                        value={reversalSearch}
                        onChange={(e) => {
                          setReversalSearch(e.target.value);
                          setReversalOrNumber(e.target.value);
                          setShowReversalDrop(true);
                        }}
                        onFocus={() => {
                          searchReversalReceipts(
                            reversalSearch,
                            reversalDateFrom,
                            reversalDateTo,
                          );
                          setShowReversalDrop(true);
                        }}
                        placeholder="Search invoice no., client..."
                        className="w-full py-2 pr-8 text-sm border border-gray-200 rounded-md pl-9 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
                      />
                      {reversalSearchLoading && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                      )}
                    </div>
                    {showReversalDrop && reversalResults.length > 0 && (
                      <div className="absolute left-0 right-0 z-30 mt-1 overflow-hidden overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg top-full max-h-56">
                        {reversalResults.map((r) => (
                          <button
                            key={r.id}
                            onClick={() => pickReversalReceipt(r)}
                            className="w-full flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-blue-50 text-left border-b border-gray-50 last:border-0 transition"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-800 truncate">
                                {r.clientName}
                              </p>
                              <p className="font-mono text-xs text-gray-400">
                                {r.invoice_number} · {fmtDate(r.payment_date)}
                              </p>
                            </div>
                            <span className="font-mono text-xs font-semibold text-gray-600 shrink-0">
                              ₱{fmt(r.amount)}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                    {showReversalDrop &&
                      reversalSearch &&
                      reversalResults.length === 0 &&
                      !reversalSearchLoading && (
                        <div className="absolute left-0 right-0 z-30 px-4 py-3 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg top-full">
                          <p className="text-sm text-gray-400">
                            No matching invoices found
                          </p>
                        </div>
                      )}
                  </>
                ) : (
                  <div className="flex items-center justify-between px-3 py-2 border border-gray-200 rounded-md bg-gray-50">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {selectedReversalReceipt.clientName}
                      </p>
                      <p className="font-mono text-xs text-gray-400">
                        {selectedReversalReceipt.invoice_number} ·{" "}
                        {fmtDate(selectedReversalReceipt.payment_date)} · ₱
                        {fmt(selectedReversalReceipt.amount)}
                      </p>
                    </div>
                    <button
                      onClick={clearReversalReceipt}
                      className="text-gray-300 hover:text-gray-500 shrink-0"
                    >
                      <FaTimes size={12} />
                    </button>
                  </div>
                )}
              </div>

              {!selectedReversalReceipt && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Date From</label>
                    <input
                      type="date"
                      value={reversalDateFrom}
                      onChange={(e) => setReversalDateFrom(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Date To</label>
                    <input
                      type="date"
                      value={reversalDateTo}
                      onChange={(e) => setReversalDateTo(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                </div>
              )}

              <div>
                <label className={labelCls}>Reversal Date</label>
                <input
                  type="date"
                  value={reversalDate}
                  onChange={(e) => setReversalDate(e.target.value)}
                  className={inputCls}
                />
              </div>
              {selectedReversalReceipt && (
                <>
                  <div>
                    <label className={labelCls}>
                      Payment Date (for new entry)
                    </label>
                    <input
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Reason (optional)</label>
                    <textarea
                      value={reversalReason}
                      onChange={(e) => setReversalReason(e.target.value)}
                      rows={2}
                      className={`${inputCls} resize-none`}
                    />
                  </div>
                </>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => {
                  setShowReversalModal(false);
                  clearReversalReceipt();
                }}
                className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleReversal}
                disabled={reversing}
                className="px-4 py-2 text-sm font-medium text-white rounded-md disabled:opacity-50"
                style={{ background: RED }}
              >
                {reversing ? "Processing..." : "Confirm Reversal"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
