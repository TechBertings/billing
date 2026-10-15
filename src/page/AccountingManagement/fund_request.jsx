import React, { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../../lib/supabaseClient";
import {
  FaMoneyCheckAlt,
  FaArrowLeft,
  FaTimes,
  FaPlus,
  FaTrash,
  FaFileSignature,
  FaSearch,
  FaUser,
} from "react-icons/fa";

const inputCls =
  "w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 bg-white transition";
const labelCls = "block text-xs font-medium text-gray-500 mb-1";
const GREEN = "#1a5c2e";

// SOA statuses na kasama sa auto-populate (draft / pending approval hindi pa billed)
const BILLED_STATUSES = ["approved", "unpaid", "paid"];
// true = isama lang ang SOAs na may deposited na payment (may remittance_amount > 0)
const ONLY_DEPOSITED_SOAS = false;

function fmt(n) {
  return Number(n || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// FR-{YYYY}-{0001} — same numbering pattern as generateInvoiceNumber() in RecordPayment.jsx
const generateSlipNumber = async () => {
  const now = new Date();
  const yr = now.getFullYear();
  const prefix = `FR-${yr}-`;
  const { data } = await supabase
    .from("fund_requests")
    .select("slip_number")
    .ilike("slip_number", `${prefix}%`)
    .order("slip_number", { ascending: false })
    .limit(1);
  const last = data?.[0]?.slip_number?.split("-").pop();
  const next = String((parseInt(last) || 0) + 1).padStart(4, "0");
  return `${prefix}${next}`;
};

const FUND_TYPES = [
  { value: "operating_expenses", label: "Operating Expenses" },
  { value: "remittances", label: "Remittances" },
];

const emptyOtherItem = () => ({
  id: crypto.randomUUID(),
  label: "",
  amount: "",
});

/**
 * Props:
 *  - currentUser: same shape used elsewhere (fullName / full_name)
 *  - onClose(): go back / cancel (wire to your router's back nav)
 *  - onSaved(request): called after a successful insert
 *
 * Every new request is created as "pending" and moves through
 * approved/rejected via the FundRequestApproval screen.
 *
 * Requires:
 *   alter table fund_requests add column if not exists account_code text;
 *   alter table fund_requests add column if not exists client_id text;
 *   alter table fund_requests add column if not exists remittance_items jsonb;
 */
export default function FundRequest({ currentUser, onClose, onSaved }) {
  const [slipNumber, setSlipNumber] = useState("Generating...");
  const [requestDate, setRequestDate] = useState(
    new Date().toISOString().split("T")[0],
  );

  // ── Required: what kind of fund request is this ──
  const [fundType, setFundType] = useState("operating_expenses");

  // ── Remittances only: multiple accounts, { [account_code]: amount string }
  // A code that exists as a key = checked.
  const [selectedAccounts, setSelectedAccounts] = useState({});
  const [accounts, setAccounts] = useState([]);

  // ── Billed remittances ng napiling client:
  // { [account_code]: { billed, requested, outstanding } }
  const [billedMap, setBilledMap] = useState({});
  const [billedLoading, setBilledLoading] = useState(false);
  const [billedLoaded, setBilledLoaded] = useState(false);

  const [taxPayer, setTaxPayer] = useState("");
  const [particulars, setParticulars] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [formType, setFormType] = useState("");

  // ── Client picker (remittances only) — same as RecordPayment ──
  const [clientSearch, setClientSearch] = useState("");
  const [clientResults, setClientResults] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showClientDrop, setShowClientDrop] = useState(false);
  const clientRef = useRef(null);

  // ── Amount breakdown (operating expenses) ──
  const [principal, setPrincipal] = useState("");
  const [surcharge, setSurcharge] = useState("");
  const [interest, setInterest] = useState("");
  const [compromise, setCompromise] = useState("");
  const [otherItems, setOtherItems] = useState([emptyOtherItem()]);

  const [note, setNote] = useState("");
  const [careOfBankMode, setCareOfBankMode] = useState("");
  const [fundDetails, setFundDetails] = useState("");

  const [requestioner, setRequestioner] = useState("");
  const [authorizedBy, setAuthorizedBy] = useState("");
  const [billingVerificationBy, setBillingVerificationBy] = useState("");
  const [receiptAcknowledgementBy, setReceiptAcknowledgementBy] =
    useState("");

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  const userFullName =
    currentUser?.fullName || currentUser?.full_name || "Unknown";

  useEffect(() => {
    generateSlipNumber().then(setSlipNumber);
  }, []);

  // Close client dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (clientRef.current && !clientRef.current.contains(e.target))
        setShowClientDrop(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Client search — same query shape as RecordPayment.jsx ──
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

  // ── Auto-populate: kunin lahat ng remittance items na nabill sa client ──
  // billed      = sum ng billing_items (item_type = 'remittance') per account_code
  // requested   = sum ng fund_requests (pending/approved/released) per account_code
  // outstanding = billed - requested  → ito ang i-prefill
  const loadBilledRemittances = useCallback(async (client) => {
    setBilledLoading(true);
    setBilledLoaded(false);
    try {
      // 1. SOAs ng client
      const { data: soas, error: soaErr } = await supabase
        .from("billing_statements")
        .select("id")
        .eq("client_id", client.client_id)
        .in("status", BILLED_STATUSES);
      if (soaErr) throw soaErr;
      let billingIds = (soas || []).map((s) => s.id);

      // 2. (optional) limitahan sa SOAs na may deposited payment
      if (ONLY_DEPOSITED_SOAS && billingIds.length) {
        const { data: rcpts, error: rErr } = await supabase
          .from("official_receipts")
          .select("billing_id, remittance_amount, payment_method, deposit_status")
          .in("billing_id", billingIds);
        if (rErr) throw rErr;
        const paid = new Set(
          (rcpts || [])
            .filter(
              (r) =>
                (r.payment_method === "credit" ||
                  r.deposit_status === "deposited") &&
                Number(r.remittance_amount) > 0,
            )
            .map((r) => r.billing_id),
        );
        billingIds = billingIds.filter((id) => paid.has(id));
      }

      // 3. Remittance billing items per account
      const billed = {};
      if (billingIds.length) {
        const { data: items, error: iErr } = await supabase
          .from("billing_items")
          .select("account_code, amount")
          .in("billing_id", billingIds)
          .eq("item_type", "remittance");
        if (iErr) throw iErr;
        (items || []).forEach((i) => {
          if (!i.account_code) return;
          billed[i.account_code] =
            (billed[i.account_code] || 0) + (Number(i.amount) || 0);
        });
      }

      // 4. Nakarequest na (huwag i-double request)
      const requested = {};
      const { data: frs, error: fErr } = await supabase
        .from("fund_requests")
        .select("account_code, total_amount, remittance_items")
        .eq("fund_type", "remittances")
        .eq("client_id", client.client_id)
        .in("status", ["pending", "approved", "released"]);
      if (fErr) throw fErr;
      (frs || []).forEach((fr) => {
        const lines =
          Array.isArray(fr.remittance_items) && fr.remittance_items.length
            ? fr.remittance_items
            : fr.account_code
              ? [{ account_code: fr.account_code, amount: fr.total_amount }]
              : [];
        lines.forEach((l) => {
          if (!l.account_code) return;
          requested[l.account_code] =
            (requested[l.account_code] || 0) + (Number(l.amount) || 0);
        });
      });

      // 5. Combine
      const map = {};
      Object.keys(billed).forEach((code) => {
        const b = billed[code];
        const r = requested[code] || 0;
        map[code] = { billed: b, requested: r, outstanding: b - r };
      });
      setBilledMap(map);

      // 6. Auto-check + prefill ang may natitira pa
      const next = {};
      Object.keys(map).forEach((code) => {
        if (map[code].outstanding > 0.005)
          next[code] = map[code].outstanding.toFixed(2);
      });
      setSelectedAccounts(next);
      setBilledLoaded(true);
    } catch (err) {
      setMessage(`Error loading billed remittances: ${err.message}`);
      setMessageType("error");
      setBilledMap({});
    } finally {
      setBilledLoading(false);
    }
  }, []);

  const selectClient = (c) => {
    setSelectedClient(c);
    setClientSearch(getClientPrimaryName(c));
    setTaxPayer(getClientPrimaryName(c));
    setShowClientDrop(false);
    setClientResults([]);
    if (fundType === "remittances") loadBilledRemittances(c);
  };

  const clearClient = () => {
    setSelectedClient(null);
    setClientSearch("");
    setTaxPayer("");
    setBilledMap({});
    setBilledLoaded(false);
    setSelectedAccounts({});
  };

  // Pag nagpalit ng fund type, linisin ang client / accounts
  const handleFundTypeChange = (value) => {
    setFundType(value);
    clearClient();
  };

  // Load every account under a group whose category = 'remittance'
  useEffect(() => {
    (async () => {
      const { data: groups } = await supabase
        .from("fee_groups")
        .select("id")
        .eq("category", "remittance");
      const groupIds = (groups || []).map((g) => g.id);
      if (!groupIds.length) return;

      const { data: ags } = await supabase
        .from("government_agencies")
        .select("id, name")
        .in("group_id", groupIds);
      const agName = {};
      (ags || []).forEach((a) => (agName[a.id] = a.name));
      const agIds = (ags || []).map((a) => a.id);
      if (!agIds.length) return;

      const { data: accts } = await supabase
        .from("chart_of_accounts")
        .select("code, account_name, agency_id")
        .in("agency_id", agIds)
        .eq("is_active", true)
        .order("code", { ascending: true });

      setAccounts(
        (accts || [])
          .filter((a) => a.code)
          .map((a) => ({
            code: a.code,
            label: a.account_name,
            agency: agName[a.agency_id] || "",
          })),
      );
    })();
  }, []);

  // Billed accounts muna sa listahan, tapos yung iba
  const sortedAccounts = [...accounts].sort((a, b) => {
    const ab = billedMap[a.code] ? 0 : 1;
    const bb = billedMap[b.code] ? 0 : 1;
    return ab - bb;
  });

  // ── Remittance accounts (multi-select) ──
  const toggleAccount = (code) =>
    setSelectedAccounts((prev) => {
      const next = { ...prev };
      if (code in next) delete next[code];
      else {
        const out = billedMap[code]?.outstanding;
        next[code] = out > 0.005 ? out.toFixed(2) : "";
      }
      return next;
    });

  const setAccountAmount = (code, value) =>
    setSelectedAccounts((prev) => ({ ...prev, [code]: value }));

  const selectedAccountList = accounts.filter(
    (a) => a.code in selectedAccounts,
  );

  const remittanceTotal = selectedAccountList.reduce(
    (sum, a) => sum + (parseFloat(selectedAccounts[a.code]) || 0),
    0,
  );

  // ── Operating expenses total ──
  const otherTotal = otherItems.reduce(
    (sum, it) => sum + (parseFloat(it.amount) || 0),
    0,
  );

  const operatingTotal =
    (parseFloat(principal) || 0) +
    (parseFloat(surcharge) || 0) +
    (parseFloat(interest) || 0) +
    (parseFloat(compromise) || 0) +
    otherTotal;

  const total = fundType === "remittances" ? remittanceTotal : operatingTotal;

  const addOtherItem = () =>
    setOtherItems((prev) => [...prev, emptyOtherItem()]);

  const updateOtherItem = (id, field, value) =>
    setOtherItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, [field]: value } : it)),
    );

  const removeOtherItem = (id) =>
    setOtherItems((prev) =>
      prev.length > 1 ? prev.filter((it) => it.id !== id) : prev,
    );

  const resetForm = () => {
    setFundType("operating_expenses");
    setParticulars("");
    setDueDate("");
    setFormType("");
    setPrincipal("");
    setSurcharge("");
    setInterest("");
    setCompromise("");
    setOtherItems([emptyOtherItem()]);
    setNote("");
    setCareOfBankMode("");
    setFundDetails("");
    setRequestioner("");
    setAuthorizedBy("");
    setBillingVerificationBy("");
    setReceiptAcknowledgementBy("");
    clearClient();
  };

  const validate = () => {
    if (!fundType) {
      setMessage(
        "Please select a Fund Request Type — Operating Expenses or Remittances.",
      );
      setMessageType("error");
      return false;
    }

    if (fundType === "remittances") {
      if (!selectedClient) {
        setMessage("Please select a Client for this remittance.");
        setMessageType("error");
        return false;
      }
      if (selectedAccountList.length === 0) {
        setMessage("Please select at least one Account for this remittance.");
        setMessageType("error");
        return false;
      }
      const missing = selectedAccountList.find(
        (a) => !(parseFloat(selectedAccounts[a.code]) > 0),
      );
      if (missing) {
        setMessage(`Please enter an amount for ${missing.label}.`);
        setMessageType("error");
        return false;
      }
    } else if (!taxPayer.trim()) {
      setMessage("Please enter the Tax Payer.");
      setMessageType("error");
      return false;
    }

    if (!requestDate) {
      setMessage("Please select a Date.");
      setMessageType("error");
      return false;
    }
    if (total <= 0) {
      setMessage("Please enter at least one amount greater than zero.");
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
      const isRemit = fundType === "remittances";
      const payload = {
        slip_number: slipNumber,
        request_date: requestDate,
        fund_type: fundType, // "operating_expenses" | "remittances"
        // Single account → keep account_code for older screens; multiple → null
        account_code:
          isRemit && selectedAccountList.length === 1
            ? selectedAccountList[0].code
            : null,
        remittance_items: isRemit
          ? selectedAccountList.map((a) => ({
              account_code: a.code,
              agency: a.agency,
              label: a.label,
              amount: parseFloat(selectedAccounts[a.code]) || 0,
            }))
          : null,
        tax_payer: isRemit ? getClientPrimaryName(selectedClient) : taxPayer,
        client_id: isRemit ? selectedClient.client_id : null,
        particulars: particulars || null,
        due_date: dueDate || null,
        form_type: formType || null,
        amount_principal: isRemit ? total : parseFloat(principal) || 0,
        amount_surcharge: isRemit ? 0 : parseFloat(surcharge) || 0,
        amount_interest: isRemit ? 0 : parseFloat(interest) || 0,
        amount_compromise: isRemit ? 0 : parseFloat(compromise) || 0,
        amount_other: isRemit
          ? []
          : otherItems
              .filter((it) => it.label.trim() || parseFloat(it.amount) > 0)
              .map((it) => ({
                label: it.label,
                amount: parseFloat(it.amount) || 0,
              })),
        total_amount: total,
        note: note || null,
        status: "pending", // always starts pending — approval screen moves it forward
        care_of_bank_mode: careOfBankMode || null,
        fund_details: fundDetails || null,
        requestioner: requestioner || userFullName,
        authorized_by: authorizedBy || null,
        billing_verification_by: billingVerificationBy || null,
        receipt_acknowledgement_by: receiptAcknowledgementBy || null,
        recorded_by: userFullName,
      };

      const { data, error } = await supabase
        .from("fund_requests")
        .insert([payload])
        .select()
        .single();
      if (error) throw error;

      setMessage(`Fund Request ${slipNumber} recorded successfully.`);
      setMessageType("success");
      onSaved?.(data);

      resetForm();
      generateSlipNumber().then(setSlipNumber);
    } catch (err) {
      setMessage(`Error: ${err.message}`);
      setMessageType("error");
    }
    setSaving(false);
    setTimeout(() => setMessage(""), 4000);
  };

  const billedCodes = Object.keys(billedMap);
  const hasOutstanding = billedCodes.some(
    (c) => billedMap[c].outstanding > 0.005,
  );

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
            <FaMoneyCheckAlt size={14} style={{ color: GREEN }} />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-gray-800">
              Fund Request Slip
            </h1>
            <p className="font-mono text-xs text-gray-400">No. {slipNumber}</p>
          </div>
        </div>
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white transition rounded-md disabled:opacity-50"
          style={{ background: GREEN }}
        >
          <FaFileSignature size={12} />
          {saving ? "Saving..." : "Submit Request"}
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

      <div className="grid grid-cols-1 gap-5 p-6 lg:grid-cols-5">
        {/* LEFT — type + header info (2/5) */}
        <div className="space-y-5 lg:col-span-2">
          {/* Fund Request Type — required */}
          <div className="p-5 bg-white border border-gray-100 rounded-xl">
            <label className={labelCls}>
              Fund Request Type <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-6 mt-2">
              {FUND_TYPES.map((t) => (
                <label
                  key={t.value}
                  className="flex items-center gap-2 cursor-pointer select-none"
                >
                  <input
                    type="radio"
                    name="fundType"
                    value={t.value}
                    checked={fundType === t.value}
                    onChange={() => handleFundTypeChange(t.value)}
                    className="w-4 h-4 cursor-pointer accent-current"
                    style={{ color: GREEN }}
                  />
                  <span className="text-sm text-gray-700">{t.label}</span>
                </label>
              ))}
            </div>

            {/* Accounts — remittances only (multi-select) */}
            {fundType === "remittances" && (
              <div className="mt-4">
                <label className={labelCls}>
                  Accounts <span className="text-red-500">*</span>
                </label>

                {!selectedClient && (
                  <p className="px-3 py-2 mb-2 text-xs text-gray-400 border border-gray-200 border-dashed rounded-md">
                    Pumili muna ng Client para lumabas ang mga nabill na
                    remittance accounts.
                  </p>
                )}

                {selectedClient && billedLoading && (
                  <div className="flex items-center gap-2 px-3 py-2 mb-2 text-xs text-gray-500 border border-gray-200 rounded-md">
                    <div className="w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                    Loading billed remittances...
                  </div>
                )}

                {selectedClient && billedLoaded && !billedLoading && (
                  <div
                    className="px-3 py-2 mb-2 text-xs border rounded-md"
                    style={{
                      borderColor: hasOutstanding ? "#bfe3cb" : "#fde68a",
                      background: hasOutstanding ? "#e8f5ec" : "#fffbeb",
                      color: hasOutstanding ? GREEN : "#92400e",
                    }}
                  >
                    {billedCodes.length === 0
                      ? "Walang nabill na remittance sa client na ito."
                      : hasOutstanding
                        ? "Auto-filled from billed remittances. You are allowed to edit the amount or uncheck."
                        : "All billed remittances for this client have been requested."}
                  </div>
                )}

                {accounts.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-gray-400 border border-gray-200 border-dashed rounded-md">
                    No remittance accounts found.
                  </p>
                ) : (
                  <div className="mt-1 overflow-y-auto border border-gray-200 divide-y rounded-md max-h-56 divide-gray-50">
                    {sortedAccounts.map((a) => {
                      const b = billedMap[a.code];
                      return (
                        <label
                          key={a.code}
                          className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 cursor-pointer select-none hover:bg-gray-50"
                        >
                          <input
                            type="checkbox"
                            checked={a.code in selectedAccounts}
                            onChange={() => toggleAccount(a.code)}
                            className="w-4 h-4 cursor-pointer"
                            style={{ accentColor: GREEN }}
                          />
                          <span className="flex-1">
                            {a.label}
                            {b && (
                              <span
                                className="block text-[10px]"
                                style={{
                                  color:
                                    b.outstanding > 0.005 ? GREEN : "#9ca3af",
                                }}
                              >
                                Billed ₱{fmt(b.billed)}
                                {b.requested > 0 &&
                                  ` · Requested ₱${fmt(b.requested)}`}
                                {" · Left ₱"}
                                {fmt(Math.max(b.outstanding, 0))}
                              </span>
                            )}
                          </span>
                          <span className="font-mono text-xs text-gray-400">
                            {a.code}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Header info */}
          <div className="p-5 space-y-3 bg-white border border-gray-100 rounded-xl">
            <div>
              <label className={labelCls}>
                {fundType === "remittances" ? "Client" : "Tax Payer"}
              </label>

              {fundType === "remittances" ? (
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
                              type="button"
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
                        type="button"
                        onClick={clearClient}
                        className="text-gray-300 hover:text-gray-500"
                      >
                        <FaTimes size={12} />
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <input
                  type="text"
                  value={taxPayer}
                  onChange={(e) => setTaxPayer(e.target.value)}
                  placeholder="Name of tax payer / client"
                  className={inputCls}
                />
              )}
            </div>
            <div>
              <label className={labelCls}>Date</label>
              <input
                type="date"
                value={requestDate}
                onChange={(e) => setRequestDate(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Particulars</label>
              <textarea
                value={particulars}
                onChange={(e) => setParticulars(e.target.value)}
                rows={2}
                placeholder="What is this fund request for..."
                className={`${inputCls} resize-none`}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Due Date (if any)</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Form Type</label>
                <input
                  type="text"
                  value={formType}
                  onChange={(e) => setFormType(e.target.value)}
                  placeholder="e.g. BIR Form 0605"
                  className={inputCls}
                />
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT — amount, notes, signatories (3/5) */}
        <div className="space-y-5 lg:col-span-3">
          {fundType === "remittances" ? (
            /* ── Remittances: amount per selected account ── */
            <div className="p-5 bg-white border border-gray-100 rounded-xl">
              <label className={labelCls}>Amount per Account</label>

              {selectedAccountList.length === 0 ? (
                <p className="px-3 py-2 mt-2 text-xs text-gray-400 border border-gray-200 border-dashed rounded-md">
                  Select one or more accounts on the left to enter amounts.
                </p>
              ) : (
                <div className="mt-2 space-y-2">
                  {selectedAccountList.map((a) => {
                    const b = billedMap[a.code];
                    const amt = parseFloat(selectedAccounts[a.code]) || 0;
                    const over = b && amt > b.outstanding + 0.005;
                    return (
                      <div key={a.code}>
                        <div className="grid items-center grid-cols-3 gap-3">
                          <span className="text-sm text-gray-600">
                            {a.label}
                          </span>

                          <div className="flex items-center col-span-2 gap-3">
                            <div className="relative flex-1">
                              <span className="absolute text-sm text-gray-400 -translate-y-1/2 left-3 top-1/2">
                                ₱
                              </span>
                              <input
                                type="number"
                                value={selectedAccounts[a.code]}
                                onChange={(e) =>
                                  setAccountAmount(a.code, e.target.value)
                                }
                                min="0"
                                step="0.01"
                                placeholder="0.00"
                                className={`${inputCls} pl-7 font-mono`}
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => toggleAccount(a.code)}
                              className="p-1 text-gray-300 transition hover:text-red-500 shrink-0"
                              title="Remove account"
                            >
                              <FaTrash size={11} />
                            </button>
                          </div>
                        </div>
                        {over && (
                          <p className="mt-1 text-[11px] text-amber-600 text-right">
                            Lampas sa natitirang billed (₱
                            {fmt(Math.max(b.outstanding, 0))}).
                          </p>
                        )}
                        {!b && selectedClient && billedLoaded && (
                          <p className="mt-1 text-[11px] text-amber-600 text-right">
                            Hindi ito nabill sa client na ito.
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex items-center justify-between pt-3 mt-4 border-t border-gray-100">
                <span className="text-sm font-semibold text-gray-700">
                  Total
                </span>
                <span
                  className="font-mono text-lg font-bold"
                  style={{ color: GREEN }}
                >
                  ₱{fmt(total)}
                </span>
              </div>
            </div>
          ) : (
            /* ── Operating Expenses: amount breakdown ── */
            <div className="p-5 bg-white border border-gray-100 rounded-xl">
              <label className={labelCls}>Amount</label>
              <div className="mt-2 space-y-2">
                {[
                  ["Principal", principal, setPrincipal],
                  ["Surcharge", surcharge, setSurcharge],
                  ["Interest", interest, setInterest],
                  ["Compromise", compromise, setCompromise],
                ].map(([label, val, setter]) => (
                  <div
                    key={label}
                    className="grid items-center grid-cols-3 gap-3"
                  >
                    <span className="text-sm text-gray-600">{label}</span>
                    <div className="relative col-span-2">
                      <span className="absolute text-sm text-gray-400 -translate-y-1/2 left-3 top-1/2">
                        ₱
                      </span>
                      <input
                        type="number"
                        value={val}
                        onChange={(e) => setter(e.target.value)}
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        className={`${inputCls} pl-7 font-mono`}
                      />
                    </div>
                  </div>
                ))}

                {/* Other (specify) — dynamic rows */}
                <div className="grid grid-cols-3 gap-3">
                  <span className="pt-2 text-sm text-gray-600">
                    Other (specify)
                  </span>
                  <div className="col-span-2 space-y-2">
                    {otherItems.map((it) => (
                      <div key={it.id} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={it.label}
                          onChange={(e) =>
                            updateOtherItem(it.id, "label", e.target.value)
                          }
                          placeholder="Specify..."
                          className={`${inputCls} flex-1`}
                        />
                        <div className="relative w-32 shrink-0">
                          <span className="absolute text-sm text-gray-400 -translate-y-1/2 left-3 top-1/2">
                            ₱
                          </span>
                          <input
                            type="number"
                            value={it.amount}
                            onChange={(e) =>
                              updateOtherItem(it.id, "amount", e.target.value)
                            }
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            className={`${inputCls} pl-7 font-mono`}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeOtherItem(it.id)}
                          className="text-gray-300 hover:text-red-500 shrink-0"
                        >
                          <FaTrash size={11} />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={addOtherItem}
                      className="flex items-center gap-1.5 text-xs text-blue-500 hover:underline"
                    >
                      <FaPlus size={9} />
                      Add another
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 mt-4 border-t border-gray-100">
                <span className="text-sm font-semibold text-gray-700">
                  Total
                </span>
                <span
                  className="font-mono text-lg font-bold"
                  style={{ color: GREEN }}
                >
                  ₱{fmt(total)}
                </span>
              </div>
            </div>
          )}

          {/* Note / Care of / Fund details */}
          <div className="p-5 space-y-4 bg-white border border-gray-100 rounded-xl">
            <div>
              <label className={labelCls}>Note (if any)</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Optional notes..."
                className={`${inputCls} resize-none`}
              />
            </div>
            <div>
              <label className={labelCls}>Care of / Bank / Mode</label>
              <input
                type="text"
                value={careOfBankMode}
                onChange={(e) => setCareOfBankMode(e.target.value)}
                placeholder="e.g. BDO / Cash / Cheque"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Fund Details</label>
              <textarea
                value={fundDetails}
                onChange={(e) => setFundDetails(e.target.value)}
                rows={2}
                placeholder="Source of funds, disbursement details..."
                className={`${inputCls} resize-none`}
              />
            </div>
          </div>

          {/* Signatories */}
          <div className="grid grid-cols-1 gap-3 p-5 bg-white border border-gray-100 rounded-xl sm:grid-cols-2">
            <div>
              <label className={labelCls}>Requestioner</label>
              <input
                type="text"
                value={requestioner}
                onChange={(e) => setRequestioner(e.target.value)}
                placeholder={userFullName}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Authorized by</label>
              <input
                type="text"
                value={authorizedBy}
                onChange={(e) => setAuthorizedBy(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Billing Verification by</label>
              <input
                type="text"
                value={billingVerificationBy}
                onChange={(e) => setBillingVerificationBy(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Receipt Acknowledgement by</label>
              <input
                type="text"
                value={receiptAcknowledgementBy}
                onChange={(e) => setReceiptAcknowledgementBy(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}