import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "../../lib/supabaseClient";
import {
  FaTimes,
  FaSync,
  FaSave,
  FaSlidersH,
  FaMoneyCheckAlt,
  FaCheckCircle,
  FaExclamationTriangle,
  FaPlus,
  FaTrash,
  FaLink,
  FaInfoCircle,
  FaChevronDown,
  FaChevronUp,
} from "react-icons/fa";

const GREEN = "#1a5c2e";
const RED = "#c0392b";

const inputCls =
  "w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 bg-white transition";
const labelCls = "block text-xs font-medium text-gray-500 mb-1";
const readOnlyCls =
  "px-3 py-2 text-sm text-right font-mono border border-gray-200 rounded-md bg-gray-50 text-gray-700";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];


function fmt(n) {
  return Number(n || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
function today() {
  return new Date().toISOString().split("T")[0];
}
function lastDayOfMonth(year, month) {
  // month is 1-12
  return new Date(year, month, 0).toISOString().split("T")[0];
}

// ── Bank name → official_receipts.payment_method mapping ──
// Free-text bank name field, so we match loosely (case-insensitive, substring).
// Extend this if you add more payment methods in RecordPayment.jsx.
function mapBankToPaymentMethod(bankName) {
  const b = (bankName || "").toLowerCase();
  if (b.includes("bdo") || b.includes("banco de oro")) return "bank_transfer_bdo";
  if (b.includes("china")) return "bank_transfer_chinabank";
  return null; // unrecognized bank name — no auto-sync, manual entry only
}

// ── Transactions modal — manages bank_reconciliation_transactions rows ─────
function TransactionsModal({
  rows,
  onAdd,
  onRemove,
  onChange,
  onClose,
  onSave,
  saving,
  syncing,
  onRefreshSync,
  syncAvailable,
}) {
  const totalDeposit = rows.filter((r) => r.type === "Deposit").reduce((s, r) => s + Number(r.amount || 0), 0);
  const totalOut = rows
    .filter((r) => r.type !== "Deposit")
    .reduce((s, r) => s + Number(r.amount || 0), 0);
  const syncedCount = rows.filter((r) => r._synced).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-4xl bg-white rounded-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-full" style={{ background: "#e8f5ec" }}>
              <FaMoneyCheckAlt size={13} style={{ color: GREEN }} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-800">Reconciliation Transactions</h2>
              <p className="text-xs text-gray-400">Deposits, withdrawals &amp; cheques — tick "Outstanding" for items not yet cleared by the bank</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onRefreshSync}
              disabled={syncing}
              title="Re-pull deposits from Record Payment"
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-blue-600 transition border border-blue-100 rounded-md hover:bg-blue-50 disabled:opacity-50"
            >
              <FaSync size={10} className={syncing ? "animate-spin" : ""} />
              {syncing ? "Syncing..." : "Refresh synced deposits"}
            </button>
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 transition">
              <FaTimes size={14} />
            </button>
          </div>
        </div>

        {/* Sync status banner */}
        <div className="flex items-start gap-2 px-5 py-2.5 border-b border-gray-100 shrink-0 bg-blue-50/60">
          <FaInfoCircle size={12} className="text-blue-400 mt-0.5 shrink-0" />
          {syncAvailable ? (
            <p className="text-xs text-blue-700">
              {syncedCount > 0
                ? `${syncedCount} deposit${syncedCount > 1 ? "s" : ""} synced automatically from Record Payment (locked — edit the "Outstanding" box only). Add rows below for withdrawals, cheques, and other items.`
                : "No matching payments found in Record Payment for this bank + period yet. New deposits recorded there will sync in automatically."}
            </p>
          ) : (
            <p className="text-xs text-blue-700">
              Auto-sync isn't available for this bank name yet — deposits won't be pulled automatically. Try naming the bank "BDO" or "China Bank" to enable syncing, or continue adding rows manually below.
            </p>
          )}
        </div>

        <div className="flex-1 p-5 overflow-y-auto">
          <div className="overflow-hidden border border-gray-200 rounded-lg">
            <table className="w-full text-xs">
              <thead className="text-gray-500 bg-gray-50">
                <tr>
                  <th className="w-32 px-3 py-2 font-medium text-left">Date</th>
                  <th className="px-3 py-2 font-medium text-left">Description</th>
                  <th className="px-3 py-2 font-medium text-left w-28">Type</th>
                  <th className="w-32 px-3 py-2 font-medium text-left">Reference No.</th>
                  <th className="w-32 px-3 py-2 font-medium text-right">Amount</th>
                  <th className="w-24 px-3 py-2 font-medium text-center">Outstanding</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-gray-400">
                      No transactions yet.
                    </td>
                  </tr>
                ) : (
                  rows.map((row, idx) => (
                    <tr
                      key={row._key}
                      className={`border-t border-gray-50 ${row._synced ? "bg-blue-50/50" : ""}`}
                    >
                      <td className="px-2 py-1.5">
                        {row._synced ? (
                          <span className="block px-2 py-1 text-xs text-gray-600">{row.date || ""}</span>
                        ) : (
                          <input
                            type="date"
                            value={row.date || ""}
                            onChange={(e) => onChange(idx, "date", e.target.value)}
                            className="w-full px-2 py-1 text-xs transition bg-transparent border border-transparent rounded focus:border-blue-300 focus:outline-none focus:bg-white"
                          />
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        {row._synced ? (
                          <div className="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-600" title="Synced from Record Payment">
                            <FaLink size={9} className="text-blue-400 shrink-0" />
                            <span className="truncate">{row.description || ""}</span>
                          </div>
                        ) : (
                          <input
                            type="text"
                            value={row.description || ""}
                            onChange={(e) => onChange(idx, "description", e.target.value)}
                            className="w-full px-2 py-1 text-xs transition bg-transparent border border-transparent rounded focus:border-blue-300 focus:outline-none focus:bg-white"
                          />
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        {row._synced ? (
                          <span className="inline-block px-2 py-0.5 text-[10px] font-semibold text-green-700 bg-green-100 rounded">
                            Deposit
                          </span>
                        ) : (
                          <select
                            value={row.type || "Deposit"}
                            onChange={(e) => onChange(idx, "type", e.target.value)}
                            className="w-full px-2 py-1 text-xs transition bg-transparent border border-transparent rounded focus:border-blue-300 focus:outline-none focus:bg-white"
                          >
                            {TYPE_OPTIONS.map((t) => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        {row._synced ? (
                          <span className="block px-2 py-1 font-mono text-xs text-gray-600">{row.reference_no || ""}</span>
                        ) : (
                          <input
                            type="text"
                            value={row.reference_no || ""}
                            onChange={(e) => onChange(idx, "reference_no", e.target.value)}
                            className="w-full px-2 py-1 text-xs transition bg-transparent border border-transparent rounded focus:border-blue-300 focus:outline-none focus:bg-white"
                          />
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        {row._synced ? (
                          <span className="block px-2 py-1 font-mono text-xs text-right text-gray-700">{fmt(row.amount)}</span>
                        ) : (
                          <input
                            type="number"
                            value={row.amount ?? ""}
                            onChange={(e) => onChange(idx, "amount", e.target.value)}
                            className="w-full px-2 py-1 font-mono text-xs text-right transition bg-transparent border border-transparent rounded focus:border-blue-300 focus:outline-none focus:bg-white"
                          />
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <input
                          type="checkbox"
                          checked={!!row.is_outstanding}
                          onChange={(e) => onChange(idx, "is_outstanding", e.target.checked)}
                          className="w-3.5 h-3.5 accent-green-700"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        {row._synced ? (
                          <span
                            className="block p-1 text-gray-200 cursor-not-allowed"
                            title="Synced from Record Payment — remove/edit the source payment instead"
                          >
                            <FaTrash size={10} />
                          </span>
                        ) : (
                          <button onClick={() => onRemove(idx)} className="p-1 text-gray-300 transition hover:text-red-400">
                            <FaTrash size={10} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {rows.length > 0 && (
                <tfoot>
                  <tr className="border-t border-gray-200 bg-gray-50">
                    <td colSpan={4} className="px-3 py-2 font-medium text-right text-gray-600">
                      Deposits total · Withdrawals/Cheques total
                    </td>
                    <td colSpan={3} className="px-3 py-2 font-mono font-semibold text-right" style={{ color: GREEN }}>
                      ₱{fmt(totalDeposit)} &nbsp;/&nbsp; ₱{fmt(totalOut)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          <button
            onClick={onAdd}
            className="flex items-center gap-2 px-3 py-2 mt-3 text-xs font-medium text-gray-600 transition border border-gray-200 border-dashed rounded-md hover:bg-gray-50"
          >
            <FaPlus size={10} /> Add row
          </button>
        </div>

        <div className="flex justify-end gap-2 px-5 py-3.5 border-t border-gray-100 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 transition border border-gray-200 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white transition rounded-md disabled:opacity-50"
            style={{ background: GREEN }}
          >
            <FaSave size={11} /> {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BankReconciliation({ currentUser }) {
  // ── Header controls ──
  const [bankName, setBankName] = useState("");
  const [accountNo, setAccountNo] = useState("");
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [reconciliationId, setReconciliationId] = useState(null);

  // ── Direct fields from bank_reconciliations ──
  const [beginningBalance, setBeginningBalance] = useState(0);
  const [bankStatementBalance, setBankStatementBalance] = useState(0);
  const [totalDepositsNotPosted, setTotalDepositsNotPosted] = useState(0);
  const [adjustments, setAdjustments] = useState(0);
  const [notes, setNotes] = useState("");

  const [isReconciled, setIsReconciled] = useState(false);
  const [reconciledAt, setReconciledAt] = useState(null);
  const [reconciledBy, setReconciledBy] = useState(null);
  const [statementDate, setStatementDate] = useState("");

  // ── Transactions ──
  const [transactions, setTransactions] = useState([]);
  const [showTxnModal, setShowTxnModal] = useState(false);
  const [txnDraft, setTxnDraft] = useState([]);
  const [syncingTxns, setSyncingTxns] = useState(false);

  // ── Client Payments preview (read-only trace-back list, straight from official_receipts —
  // shows which client/OR# backs each synced Deposit row. NOT a scoping filter: bank
  // reconciliation is company/bank-account level, so this panel is informational only. ──
  const [clientPayments, setClientPayments] = useState([]);
  const [clientPaymentsLoading, setClientPaymentsLoading] = useState(false);
  const [paymentsExpanded, setPaymentsExpanded] = useState(false);

  // ── UI ──
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  const userFullName = currentUser?.fullName || currentUser?.full_name || "Unknown";

  // ── Load a reconciliation for bank + month/year (company-level, no client scoping) ──
  const loadReconciliation = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("bank_reconciliations")
        .select("*")
        .eq("month", month)
        .eq("year", year);

      if (bankName) query = query.eq("bank_name", bankName);

      const { data: recon, error } = await query.maybeSingle();
      if (error) throw error;

      if (recon) {
        setReconciliationId(recon.id);
        setAccountNo(recon.account_no || accountNo);
        setBeginningBalance(recon.beginning_balance || 0);
        setBankStatementBalance(recon.bank_statement_balance || 0);
        setTotalDepositsNotPosted(recon.total_deposits_not_posted || 0);
        setAdjustments(recon.adjustments || 0);
        setNotes(recon.notes || "");
        setIsReconciled(!!recon.is_reconciled);
        setReconciledAt(recon.reconciled_at || null);
        setReconciledBy(recon.reconciled_by || null);
        setStatementDate(recon.statement_date || "");
        const { data: txns, error: txErr } = await supabase
          .from("bank_reconciliation_transactions")
          .select("*")
          .eq("reconciliation_id", recon.id)
          .order("date", { ascending: true });
        if (txErr) throw txErr;
        setTransactions(txns || []);
      } else {
        setReconciliationId(null);
        setBeginningBalance(0);
        setBankStatementBalance(0);
        setTotalDepositsNotPosted(0);
        setAdjustments(0);
        setNotes("");
        setIsReconciled(false);
        setReconciledAt(null);
        setReconciledBy(null);
        setStatementDate("");
        setTransactions([]);
        const prevMonth = month === 1 ? 12 : month - 1;
        const prevYear = month === 1 ? year - 1 : year;
        let prevQuery = supabase
          .from("bank_reconciliations")
          .select("id")
          .eq("month", prevMonth)
          .eq("year", prevYear);
        if (bankName) prevQuery = prevQuery.eq("bank_name", bankName);

        const { data: prevRecon } = await prevQuery.maybeSingle();
        if (prevRecon) {
          const { data: prevOutstanding } = await supabase
            .from("bank_reconciliation_transactions")
            .select("*")
            .eq("reconciliation_id", prevRecon.id)
            .eq("is_outstanding", true);
          if (prevOutstanding?.length) {
            setTransactions(
              prevOutstanding.map((t) => ({ ...t, id: null, _carried_forward: true })),
            );
          }
        }
      }
    } catch (err) {
      setMessage(`Error loading reconciliation: ${err.message}`);
      setMessageType("error");
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bankName, month, year]);

  useEffect(() => {
    loadReconciliation();
  }, [loadReconciliation]);

  // ── Computed totals — see docblock above for the derivation rules ──
  const totalReceipts = useMemo(
    () => transactions.filter((t) => t.type === "Deposit").reduce((s, t) => s + Number(t.amount || 0), 0),
    [transactions],
  );
  const totalPayments = useMemo(
    () => transactions.filter((t) => t.type !== "Deposit").reduce((s, t) => s + Number(t.amount || 0), 0),
    [transactions],
  );
  const totalUnpresentedCheques = useMemo(
    () => transactions.filter((t) => t.type === "Cheque" && t.is_outstanding).reduce((s, t) => s + Number(t.amount || 0), 0),
    [transactions],
  );
  const totalOutstandingDeposits = useMemo(
    () => transactions.filter((t) => t.type === "Deposit" && t.is_outstanding).reduce((s, t) => s + Number(t.amount || 0), 0),
    [transactions],
  );

  const cashBookBalance = useMemo(
    () => Number(beginningBalance) + totalReceipts - totalPayments,
    [beginningBalance, totalReceipts, totalPayments],
  );

  const adjustedBankTotal = useMemo(
    () =>
      Number(bankStatementBalance) -
      totalUnpresentedCheques +
      totalOutstandingDeposits +
      Number(totalDepositsNotPosted) +
      Number(adjustments),
    [bankStatementBalance, totalUnpresentedCheques, totalOutstandingDeposits, totalDepositsNotPosted, adjustments],
  );

  const reconciliationDiff = useMemo(() => adjustedBankTotal - cashBookBalance, [adjustedBankTotal, cashBookBalance]);
  const isBalanced = Math.abs(reconciliationDiff) < 0.005;

  // ── Sync helper: pull matching deposits from official_receipts (RecordPayment.jsx) ──
  const syncAvailable = !!mapBankToPaymentMethod(bankName);

  const fetchSyncedDeposits = useCallback(
    async (existingRefs) => {
      const method = mapBankToPaymentMethod(bankName);
      if (!method) return [];

      const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
      const endDate = lastDayOfMonth(year, month);

      const { data, error } = await supabase
        .from("official_receipts")
        .select("or_number, payment_date, amount, notes, client_id, payment_method")
        .eq("payment_method", method)
        .gte("payment_date", startDate)
        .lte("payment_date", endDate)
        .order("payment_date", { ascending: true });

      if (error || !data) return [];

      return data
        .filter((r) => !existingRefs.has(r.or_number))
        .map((r) => ({
          _key: `or-${r.or_number}`,
          date: r.payment_date,
          description: r.notes || "Payment received (Record Payment)",
          type: "Deposit",
          reference_no: r.or_number,
          amount: r.amount,
          is_outstanding: false,
          _synced: true,
        }));
    },
    [bankName, month, year],
  );

  // Pulls new synced rows and merges them on top of whatever's currently in txnDraft.
  // "OR-" prefixed reference_no is our signal that a row already came from official_receipts,
  // so re-running this never creates duplicates.
  const refreshSyncedDeposits = useCallback(
    async (currentRows) => {
      setSyncingTxns(true);
      try {
        const existingRefs = new Set((currentRows || []).map((r) => r.reference_no).filter(Boolean));
        const synced = await fetchSyncedDeposits(existingRefs);
        if (synced.length > 0) {
          setTxnDraft((prev) => [...synced, ...prev]);
        }
      } finally {
        setSyncingTxns(false);
      }
    },
    [fetchSyncedDeposits],
  );

  // ── Client Payments preview — read-only trace-back list of the actual payments (with
  // client names) that back the synced Deposit rows for this bank + period. Company-wide,
  // all clients — no client filter here, this is just "who's inside that deposit total". ──
  const fetchClientPayments = useCallback(async () => {
    const method = mapBankToPaymentMethod(bankName);
    if (!method) {
      setClientPayments([]);
      return;
    }
    setClientPaymentsLoading(true);
    try {
      const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
      const endDate = lastDayOfMonth(year, month);

      const { data: receipts, error } = await supabase
        .from("official_receipts")
        .select("or_number, payment_date, amount, client_id, payment_method, notes")
        .eq("payment_method", method)
        .gte("payment_date", startDate)
        .lte("payment_date", endDate)
        .order("payment_date", { ascending: false });

      if (error || !receipts) {
        setClientPayments([]);
        return;
      }

      const clientIds = [...new Set(receipts.map((r) => r.client_id).filter(Boolean))];
      let clientMap = {};
      if (clientIds.length > 0) {
        const { data: clients } = await supabase
          .from("client_profile")
          .select("client_id, business_name, trade_name, first_name, middle_name, last_name")
          .in("client_id", clientIds);
        (clients || []).forEach((c) => {
          clientMap[c.client_id] = c;
        });
      }

      setClientPayments(
        receipts.map((r) => {
          const c = clientMap[r.client_id];
          const name = c
            ? c.business_name ||
              [c.first_name, c.middle_name, c.last_name].filter(Boolean).join(" ") ||
              r.client_id
            : r.client_id || "Unknown client";
          return { ...r, clientName: name };
        }),
      );
    } finally {
      setClientPaymentsLoading(false);
    }
  }, [bankName, month, year]);

  useEffect(() => {
    fetchClientPayments();
  }, [fetchClientPayments]);

  // ── Recalculate Totals — F2 (re-pull transactions, recompute) ──
  const handleRecalculate = useCallback(async () => {
    if (!reconciliationId) {
      setMessage("Save this reconciliation first, then recalculate.");
      setMessageType("error");
      return;
    }
    setLoading(true);
    try {
      const { data: txns, error } = await supabase
        .from("bank_reconciliation_transactions")
        .select("*")
        .eq("reconciliation_id", reconciliationId)
        .order("date", { ascending: true });
      if (error) throw error;
      setTransactions(txns || []);
      setMessage("Totals recalculated.");
      setMessageType("success");
    } catch (err) {
      setMessage(`Error: ${err.message}`);
      setMessageType("error");
    }
    setLoading(false);
    setTimeout(() => setMessage(""), 3000);
  }, [reconciliationId]);

  // ── Save (and optionally print) — F3 ──
  const handleSave = async (thenPrint = false) => {
    setSaving(true);
    setMessage("");
    try {
      const payload = {
        bank_name: bankName,
        account_no: accountNo || null,
        month,
        year,
        statement_date: statementDate || null,
        beginning_balance: Number(beginningBalance) || 0,
        bank_statement_balance: Number(bankStatementBalance) || 0,
        total_deposits_not_posted: Number(totalDepositsNotPosted) || 0,
        adjustments: Number(adjustments) || 0,
        notes: notes || null,
        created_by: userFullName,
      };

      if (!payload.bank_name) {
        setMessage("Bank name is required.");
        setMessageType("error");
        setSaving(false);
        return;
      }

      let id = reconciliationId;
      if (id) {
        const { error } = await supabase.from("bank_reconciliations").update(payload).eq("id", id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("bank_reconciliations").insert([payload]).select().single();
        if (error) throw error;
        id = data.id;
        setReconciliationId(id);
      }

      setMessage(isBalanced ? "Reconciliation saved and balanced." : "Reconciliation saved (balance error remains).");
      setMessageType(isBalanced ? "success" : "error");

      if (thenPrint) window.print();
    } catch (err) {
      setMessage(`Error: ${err.message}`);
      setMessageType("error");
    }
    setSaving(false);
    setTimeout(() => setMessage(""), 4000);
  };

  // ── OK — F12: validate + save ──
  const handleOk = async () => {
    if (!isBalanced) {
      setMessage(`Cannot close — reconciliation balance error of \u20b1${fmt(Math.abs(reconciliationDiff))}.`);
      setMessageType("error");
      setTimeout(() => setMessage(""), 4000);
      return;
    }
    await handleSave(false);
    if (reconciliationId) {
      const { error } = await supabase
        .from("bank_reconciliations")
        .update({
          is_reconciled: true,
          reconciled_at: new Date().toISOString(),
          reconciled_by: userFullName,
        })
        .eq("id", reconciliationId);
      if (!error) {
        setIsReconciled(true);
        setReconciledAt(new Date().toISOString());
        setReconciledBy(userFullName);
      }
    }
  };

  const handleUnreconcile = async () => {
    if (!reconciliationId) return;
    const { error } = await supabase
      .from("bank_reconciliations")
      .update({ is_reconciled: false, reconciled_at: null, reconciled_by: null })
      .eq("id", reconciliationId);
    if (!error) {
      setIsReconciled(false);
      setReconciledAt(null);
      setReconciledBy(null);
    }
  };

  // ── Transactions modal handlers ──
  const openTxnModal = () => {
    const baseRows = transactions.map((t) => ({
      ...t,
      _key: t.id || Math.random(),
      // Rows previously synced from official_receipts carry an "OR-" reference_no.
      // Flag them so they render locked, same as freshly-synced rows.
      _synced: !!(t.reference_no && t.reference_no.startsWith("OR-")),
    }));
    setTxnDraft(baseRows);
    setShowTxnModal(true);
    refreshSyncedDeposits(baseRows);
  };

  const saveTxnModal = async () => {
    if (!reconciliationId) {
      setMessage("Save the reconciliation first (Save and Print) before adding transactions.");
      setMessageType("error");
      setShowTxnModal(false);
      return;
    }
    setSaving(true);
    try {
      await supabase.from("bank_reconciliation_transactions").delete().eq("reconciliation_id", reconciliationId);
      const rows = txnDraft
        .filter((t) => t.description || t.amount)
        .map(({ _key, id, _synced, ...rest }) => ({
          ...rest,
          reconciliation_id: reconciliationId,
          amount: Number(rest.amount) || 0,
          is_outstanding: !!rest.is_outstanding,
        }));
      if (rows.length) {
        const { error } = await supabase.from("bank_reconciliation_transactions").insert(rows);
        if (error) throw error;
      }
      setTransactions(rows);
      setShowTxnModal(false);
    } catch (err) {
      setMessage(`Error: ${err.message}`);
      setMessageType("error");
    }
    setSaving(false);
  };

  const updateTxnRow = (idx, key, val) => setTxnDraft((rows) => rows.map((r, i) => (i === idx ? { ...r, [key]: val } : r)));
  const removeTxnRow = (idx) => setTxnDraft((rows) => rows.filter((_, i) => i !== idx));

  return (
    <div className="min-h-screen bg-gray-50">
      {/* TOP BAR */}
      <div className="sticky top-0 z-10 px-6 py-4 bg-white border-b border-gray-200 print:hidden">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center rounded-full w-9 h-9" style={{ background: "#e8f5ec" }}>
              <FaMoneyCheckAlt size={14} style={{ color: GREEN }} />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-gray-800">Bank Reconciliation</h1>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className={labelCls}>Statement Date</label>
            <input
              type="date"
              value={statementDate}
              onChange={(e) => setStatementDate(e.target.value)}
              disabled={isReconciled}
              className={`${inputCls} w-40 disabled:opacity-50 disabled:cursor-not-allowed`}
            />
          </div>
          <div>
            <label className={labelCls}>Bank Name</label>
            <input type="text" value={bankName} onChange={(e) => setBankName(e.target.value)} disabled={isReconciled} placeholder="e.g. BDO" className={`${inputCls} disabled:opacity-50 disabled:cursor-not-allowed`} />
            {bankName && (
              <p className={`mt-1 text-[10px] ${syncAvailable ? "text-blue-500" : "text-gray-400"}`}>
                {syncAvailable ? "✓ Deposits will auto-sync from Record Payment" : "Auto-sync unavailable for this bank name"}
              </p>
            )}
          </div>
          <div>
            <label className={labelCls}>Account No.</label>
            <input type="text" value={accountNo} onChange={(e) => setAccountNo(e.target.value)} disabled={isReconciled} className={`${inputCls} disabled:opacity-50 disabled:cursor-not-allowed`} />
          </div>
          <div>
            <label className={labelCls}>Month</label>
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))} disabled={isReconciled} className={`${inputCls} disabled:opacity-50 disabled:cursor-not-allowed`}>
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Year</label>
            <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} disabled={isReconciled} className={`${inputCls} w-24 disabled:opacity-50 disabled:cursor-not-allowed`} />
          </div>
        </div>
      </div>

      {message && (
        <div
          className={`mx-6 mt-4 px-4 py-2.5 rounded-md text-sm flex items-center justify-between border-l-4 print:hidden
          ${messageType === "success" ? "bg-green-50 border-green-500 text-green-700" : "bg-red-50 border-red-500 text-red-700"}`}
        >
          {message}
          <button onClick={() => setMessage("")}>
            <FaTimes size={11} />
          </button>
        </div>
      )}
      {isReconciled && (
        <div className="flex items-center justify-between px-5 py-3 mb-5 border rounded-lg" style={{ borderColor: "#bfe3cb", background: "#e8f5ec" }}>
          <div className="flex items-center gap-2">
            <FaCheckCircle size={13} style={{ color: GREEN }} />
            <span className="text-sm font-medium" style={{ color: GREEN }}>
              Reconciled by {reconciledBy} on {new Date(reconciledAt).toLocaleDateString("en-PH")} — locked
            </span>
          </div>
          <button onClick={handleUnreconcile} className="text-xs font-medium text-blue-500 hover:underline">
            Unreconcile
          </button>
        </div>
      )}
      {/* BODY */}
      <div className="grid grid-cols-1 gap-5 p-6 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {/* Client Payments — read-only trace-back, not a duplicate of the Transactions
              modal table. Purpose: quick sanity-check of what's about to be counted
              as Deposits, and a trace-back to which client/OR# each one came from,
              WITHOUT re-showing the full editable table (that stays in the modal). */}
          <div className="overflow-hidden bg-white border border-gray-200 rounded-lg">
            <button
              onClick={() => setPaymentsExpanded((v) => !v)}
              disabled={clientPayments.length === 0}
              className="flex items-center justify-between w-full px-5 py-3.5 text-left transition hover:bg-gray-50 disabled:cursor-default disabled:hover:bg-white"
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-full shrink-0" style={{ background: "#e8f5ec" }}>
                  <FaLink size={11} style={{ color: GREEN }} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    {clientPaymentsLoading
                      ? "Checking Record Payment..."
                      : !syncAvailable
                        ? "Client payment sync unavailable"
                        : clientPayments.length === 0
                          ? "No client payments for this period yet"
                          : `${clientPayments.length} client payment${clientPayments.length > 1 ? "s" : ""} synced from Record Payment`}
                  </p>
                  {!clientPaymentsLoading && syncAvailable && clientPayments.length > 0 && (
                    <p className="text-xs text-gray-400">
                      ₱{fmt(clientPayments.reduce((s, p) => s + Number(p.amount || 0), 0))} total · counted as Deposits below
                    </p>
                  )}
                  {!clientPaymentsLoading && !syncAvailable && (
                    <p className="text-xs text-gray-400">Try "BDO" or "China Bank" as the bank name to enable syncing</p>
                  )}
                </div>
              </div>
              {clientPaymentsLoading ? (
                <div className="w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin shrink-0" />
              ) : (
                clientPayments.length > 0 && (
                  <span className="text-gray-300 shrink-0">
                    {paymentsExpanded ? <FaChevronUp size={11} /> : <FaChevronDown size={11} />}
                  </span>
                )
              )}
            </button>

            {paymentsExpanded && clientPayments.length > 0 && (
              <div className="px-5 pb-4 -mt-1 border-t border-gray-100">
                <div className="mt-3 overflow-hidden border border-gray-100 rounded-lg">
                  <table className="w-full text-xs">
                    <thead className="text-gray-500 bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 font-medium text-left">Date</th>
                        <th className="px-3 py-2 font-medium text-left">Client</th>
                        <th className="px-3 py-2 font-medium text-left">OR #</th>
                        <th className="px-3 py-2 font-medium text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientPayments.map((p) => (
                        <tr key={p.or_number} className="border-t border-gray-50">
                          <td className="px-3 py-2 text-gray-600">{p.payment_date}</td>
                          <td className="px-3 py-2 text-gray-800">{p.clientName}</td>
                          <td className="px-3 py-2 font-mono text-gray-500">{p.or_number}</td>
                          <td className="px-3 py-2 font-mono text-right text-gray-700">₱{fmt(p.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button
                  onClick={openTxnModal}
                  className="mt-3 text-xs font-medium text-blue-500 hover:underline"
                >
                  Open in Transactions to tag outstanding items →
                </button>
              </div>
            )}
          </div>

          {/* Cash Book side */}
          <div className="p-5 bg-white border border-gray-200 rounded-lg">
            <p className="mb-4 text-xs font-semibold tracking-wider text-gray-400 uppercase">Cash Book</p>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <span className={labelCls}>Beginning Balance</span>
                <input
                  type="number"
                  value={beginningBalance}
                  onChange={(e) => setBeginningBalance(e.target.value)}
                  className="w-40 px-3 py-2 font-mono text-sm text-right border border-gray-200 rounded-md focus:outline-none focus:border-blue-400"
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className={labelCls}>Total receipts</span>
                <div className={`w-40 ${readOnlyCls}`}>{fmt(totalReceipts)}</div>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className={labelCls}>Total payments</span>
                <div className={`w-40 ${readOnlyCls}`}>{fmt(totalPayments)}</div>
              </div>
              <div className="flex items-center justify-between gap-4 pt-3 border-t border-gray-100">
                <span className="text-sm font-semibold text-gray-800">Cash Book Balance</span>
                <div
                  className="w-40 px-3 py-2 font-mono text-sm font-bold text-right border rounded-md"
                  style={{ borderColor: GREEN, color: GREEN, background: "#e8f5ec" }}
                >
                  {fmt(cashBookBalance)}
                </div>
              </div>
            </div>
          </div>

          {/* Bank Statement side */}
          <div className="p-5 bg-white border border-gray-200 rounded-lg">
            <p className="mb-4 text-xs font-semibold tracking-wider text-gray-400 uppercase">Bank Statement</p>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <span className={labelCls}>Balance from bank statement</span>
                <input
                  type="number"
                  value={bankStatementBalance}
                  onChange={(e) => setBankStatementBalance(e.target.value)}
                  className="w-40 px-3 py-2 font-mono text-sm text-right border border-gray-200 rounded-md focus:outline-none focus:border-blue-400"
                />
              </div>
              <button onClick={openTxnModal} className="flex items-center justify-between w-full gap-4 text-left">
                <span className={`${labelCls} hover:text-blue-500`}>Total unpresented cheques</span>
                <div className={`w-40 ${readOnlyCls} hover:border-blue-300`}>{fmt(totalUnpresentedCheques)}</div>
              </button>
              <button onClick={openTxnModal} className="flex items-center justify-between w-full gap-4 text-left">
                <span className={`${labelCls} hover:text-blue-500`}>Total outstanding deposits</span>
                <div className={`w-40 ${readOnlyCls} hover:border-blue-300`}>{fmt(totalOutstandingDeposits)}</div>
              </button>
              <div className="flex items-center justify-between gap-4">
                <span className={labelCls}>Total deposits banked not posted</span>
                <input
                  type="number"
                  value={totalDepositsNotPosted}
                  onChange={(e) => setTotalDepositsNotPosted(e.target.value)}
                  className="w-40 px-3 py-2 font-mono text-sm text-right border border-gray-200 rounded-md focus:outline-none focus:border-blue-400"
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className={labelCls}>Adjustments</span>
                <input
                  type="number"
                  value={adjustments}
                  onChange={(e) => setAdjustments(e.target.value)}
                  className="w-40 px-3 py-2 font-mono text-sm text-right border border-gray-200 rounded-md focus:outline-none focus:border-blue-400"
                />
              </div>
              <div className="flex items-center justify-between gap-4 pt-3 border-t border-gray-100">
                <span className="text-sm font-semibold text-gray-800">Total</span>
                <div
                  className="w-40 px-3 py-2 font-mono text-sm font-bold text-right border rounded-md"
                  style={{ borderColor: GREEN, color: GREEN, background: "#e8f5ec" }}
                >
                  {fmt(adjustedBankTotal)}
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className={labelCls}>Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className={`${inputCls} resize-none`}
              placeholder="Optional notes for this reconciliation..."
            />
          </div>

          {/* Reconciliation Balance / Error */}
          <div
            className="flex items-center justify-between px-5 py-4 border-2 rounded-lg"
            style={{ borderColor: isBalanced ? GREEN : RED, background: isBalanced ? "#e8f5ec" : "#fdecea" }}
          >
            <div className="flex items-center gap-2">
              {isBalanced ? (
                <FaCheckCircle size={16} style={{ color: GREEN }} />
              ) : (
                <FaExclamationTriangle size={16} style={{ color: RED }} />
              )}
              <span className="text-sm font-bold tracking-wide uppercase" style={{ color: isBalanced ? GREEN : RED }}>
                {isBalanced ? "Reconciliation Balanced" : "Reconciliation Balance Error"}
              </span>
            </div>
            <span className="font-mono text-lg font-bold" style={{ color: isBalanced ? GREEN : RED }}>
              {isBalanced ? "₱0.00" : `₱${fmt(Math.abs(reconciliationDiff))}`}
            </span>
          </div>
        </div>

        {/* RIGHT — action rail */}
        <div className="space-y-2.5 lg:col-span-1">
          <RailButton icon={<FaTimes size={13} />} label="Cancel" hint="Esc" onClick={() => window.history.back()} />
          <RailButton icon={<FaSync size={13} />} label="Recalculate Totals" hint="F2" onClick={handleRecalculate} disabled={loading} />
          <RailButton icon={<FaSave size={13} />} label="Save and Print" hint="F3" onClick={() => handleSave(true)} disabled={saving} primary />
          <RailButton icon={<FaSlidersH size={13} />} label="Transactions" hint="F4" onClick={openTxnModal} disabled={isReconciled} />
          <RailButton icon={<FaCheckCircle size={13} />} label="OK" hint="F12" onClick={handleOk} disabled={saving || isReconciled} primary />
        </div>
      </div>

      {showTxnModal && (
        <TransactionsModal
          rows={txnDraft}
          onAdd={() =>
            setTxnDraft((r) => [
              ...r,
              { _key: Math.random(), date: today(), description: "", type: "Deposit", reference_no: "", amount: "", is_outstanding: false },
            ])
          }
          onRemove={removeTxnRow}
          onChange={updateTxnRow}
          onClose={() => setShowTxnModal(false)}
          onSave={saveTxnModal}
          saving={saving}
          syncing={syncingTxns}
          onRefreshSync={() => refreshSyncedDeposits(txnDraft)}
          syncAvailable={syncAvailable}
        />
      )}
    </div>
  );
}

// ── Right-rail button ──
function RailButton({ icon, label, hint, onClick, disabled, primary }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition disabled:opacity-50 ${
        primary ? "text-white" : "text-gray-700 bg-white hover:bg-gray-50"
      }`}
      style={primary ? { background: GREEN, borderColor: GREEN } : { borderColor: "#e5e7eb" }}
    >
      <span className={primary ? "text-white" : "text-gray-400"}>{icon}</span>
      <span className="flex-1 text-sm font-medium">{label}</span>
      <span className={`text-[10px] font-mono ${primary ? "text-white/70" : "text-gray-300"}`}>{hint}</span>
    </button>
  );
}