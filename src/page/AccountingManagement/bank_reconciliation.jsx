import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
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

function fmt(n) {
  return Number(n || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
function today() {
  return new Date().toISOString().split("T")[0];
}
// month/year are still derived from statement_date for reporting/filtering,
// but statement_date is now the primary key for a reconciliation record.
function monthYearFromDate(dateStr) {
  const d = dateStr ? new Date(dateStr) : new Date();
  return { month: d.getMonth() + 1, year: d.getFullYear() };
}

// ── Bank name → official_receipts.payment_method mapping ──
// Free-text bank name field, so we match loosely (case-insensitive, substring).
// Extend this if you add more payment methods in RecordPayment.jsx.
function mapBankToReceivingBankCode(bankName) {
  const b = (bankName || "").toLowerCase();
  if (b.includes("bdo") || b.includes("banco de oro")) return "bdo";
  if (b.includes("china")) return "chinabank";
  return null; // unrecognized bank name — no auto-sync, manual entry only
}

const TYPE_OPTIONS = ["Deposit", "Cheque", "Withdrawal", "Other"];

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
  const totalDeposit = rows
    .filter((r) => r.type === "Deposit")
    .reduce((s, r) => s + Number(r.amount || 0), 0);
  const totalOut = rows
    .filter((r) => r.type !== "Deposit")
    .reduce((s, r) => s + Number(r.amount || 0), 0);
  const syncedCount = rows.filter((r) => r._synced).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-4xl bg-white rounded-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div
              className="flex items-center justify-center w-8 h-8 rounded-full"
              style={{ background: "#e8f5ec" }}
            >
              <FaMoneyCheckAlt size={13} style={{ color: GREEN }} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-800">
                Reconciliation Transactions
              </h2>
              <p className="text-xs text-gray-400">
                Deposits, withdrawals &amp; cheques — tick "Outstanding" for
                items not yet cleared by the bank
              </p>
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
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 transition"
            >
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
                : "No matching payments found in Record Payment for this bank + day yet. New deposits recorded there will sync in automatically."}
            </p>
          ) : (
            <p className="text-xs text-blue-700">
              Auto-sync isn't available for this bank name yet — deposits won't
              be pulled automatically. Try naming the bank "BDO" or "China Bank"
              to enable syncing, or continue adding rows manually below.
            </p>
          )}
        </div>

        <div className="flex-1 p-5 overflow-y-auto">
          <div className="overflow-hidden border border-gray-200 rounded-lg">
            <table className="w-full text-xs">
              <thead className="text-gray-500 bg-gray-50">
                <tr>
                  <th className="w-32 px-3 py-2 font-medium text-left">Date</th>
                  <th className="px-3 py-2 font-medium text-left">
                    Description
                  </th>
                  <th className="px-3 py-2 font-medium text-left w-28">Type</th>
                  <th className="w-32 px-3 py-2 font-medium text-left">
                    Reference No.
                  </th>
                  <th className="w-32 px-3 py-2 font-medium text-right">
                    Amount
                  </th>
                  <th className="w-24 px-3 py-2 font-medium text-center">
                    Outstanding
                  </th>
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
                          <span className="block px-2 py-1 text-xs text-gray-600">
                            {row.date || ""}
                          </span>
                        ) : (
                          <input
                            type="date"
                            value={row.date || ""}
                            onChange={(e) =>
                              onChange(idx, "date", e.target.value)
                            }
                            className="w-full px-2 py-1 text-xs transition bg-transparent border border-transparent rounded focus:border-blue-300 focus:outline-none focus:bg-white"
                          />
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        {row._synced ? (
                          <div
                            className="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-600"
                            title="Synced from Record Payment"
                          >
                            <FaLink
                              size={9}
                              className="text-blue-400 shrink-0"
                            />
                            <span className="truncate">
                              {row.description || ""}
                            </span>
                          </div>
                        ) : (
                          <input
                            type="text"
                            value={row.description || ""}
                            onChange={(e) =>
                              onChange(idx, "description", e.target.value)
                            }
                            className="w-full px-2 py-1 text-xs transition bg-transparent border border-transparent rounded focus:border-blue-300 focus:outline-none focus:bg-white"
                          />
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        {row._synced ? (
                          <span
                            className={`inline-block px-2 py-0.5 text-[10px] font-semibold rounded ${
                              row.type === "Cheque"
                                ? "text-amber-700 bg-amber-100"
                                : "text-green-700 bg-green-100"
                            }`}
                          >
                            {row.type}
                          </span>
                        ) : (
                          <select
                            value={row.type || "Deposit"}
                            onChange={(e) =>
                              onChange(idx, "type", e.target.value)
                            }
                            className="w-full px-2 py-1 text-xs transition bg-transparent border border-transparent rounded focus:border-blue-300 focus:outline-none focus:bg-white"
                          >
                            {TYPE_OPTIONS.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        {row._synced ? (
                          <span className="block px-2 py-1 font-mono text-xs text-gray-600">
                            {row.reference_no || ""}
                          </span>
                        ) : (
                          <input
                            type="text"
                            value={row.reference_no || ""}
                            onChange={(e) =>
                              onChange(idx, "reference_no", e.target.value)
                            }
                            className="w-full px-2 py-1 text-xs transition bg-transparent border border-transparent rounded focus:border-blue-300 focus:outline-none focus:bg-white"
                          />
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        {row._synced ? (
                          <span className="block px-2 py-1 font-mono text-xs text-right text-gray-700">
                            {fmt(row.amount)}
                          </span>
                        ) : (
                          <input
                            type="number"
                            value={row.amount ?? ""}
                            onChange={(e) =>
                              onChange(idx, "amount", e.target.value)
                            }
                            className="w-full px-2 py-1 font-mono text-xs text-right transition bg-transparent border border-transparent rounded focus:border-blue-300 focus:outline-none focus:bg-white"
                          />
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <input
                          type="checkbox"
                          checked={!!row.is_outstanding}
                          onChange={(e) =>
                            onChange(idx, "is_outstanding", e.target.checked)
                          }
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
                          <button
                            onClick={() => onRemove(idx)}
                            className="p-1 text-gray-300 transition hover:text-red-400"
                          >
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
                    <td
                      colSpan={4}
                      className="px-3 py-2 font-medium text-right text-gray-600"
                    >
                      Deposits total · Withdrawals/Cheques total
                    </td>
                    <td
                      colSpan={3}
                      className="px-3 py-2 font-mono font-semibold text-right"
                      style={{ color: GREEN }}
                    >
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

// ── Adjustments modal — manages bank_reconciliation_adjustments rows ──
function AdjustmentsModal({
  rows,
  onAdd,
  onRemove,
  onChange,
  onClose,
  onSave,
  saving,
}) {
  const total = rows.reduce((s, r) => s + Number(r.amount || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-white rounded-xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">Adjustments</h2>
            <p className="text-xs text-gray-400">
              Bank fees, errors, or other reconciling items not covered by
              cheques or deposits
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 transition"
          >
            <FaTimes size={14} />
          </button>
        </div>

        <div className="flex-1 p-5 overflow-y-auto">
          <div className="overflow-hidden border border-gray-200 rounded-lg">
            <table className="w-full text-xs">
              <thead className="text-gray-500 bg-gray-50">
                <tr>
                  <th className="px-3 py-2 font-medium text-left">
                    Description
                  </th>
                  <th className="w-32 px-3 py-2 font-medium text-right">
                    Amount
                  </th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-6 text-center text-gray-400">
                      No adjustments yet.
                    </td>
                  </tr>
                ) : (
                  rows.map((row, idx) => (
                    <tr key={row._key} className="border-t border-gray-50">
                      <td className="px-2 py-1.5">
                        <input
                          type="text"
                          value={row.description || ""}
                          onChange={(e) =>
                            onChange(idx, "description", e.target.value)
                          }
                          placeholder="e.g. Bank service charge"
                          className="w-full px-2 py-1 text-xs transition bg-transparent border border-transparent rounded focus:border-blue-300 focus:outline-none focus:bg-white"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="number"
                          value={row.amount ?? ""}
                          onChange={(e) =>
                            onChange(idx, "amount", e.target.value)
                          }
                          className="w-full px-2 py-1 font-mono text-xs text-right transition bg-transparent border border-transparent rounded focus:border-blue-300 focus:outline-none focus:bg-white"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <button
                          onClick={() => onRemove(idx)}
                          className="p-1 text-gray-300 transition hover:text-red-400"
                        >
                          <FaTrash size={10} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {rows.length > 0 && (
                <tfoot>
                  <tr className="border-t border-gray-200 bg-gray-50">
                    <td className="px-3 py-2 font-medium text-right text-gray-600">
                      Total
                    </td>
                    <td
                      className="px-3 py-2 font-mono font-semibold text-right"
                      style={{ color: GREEN }}
                    >
                      ₱{fmt(total)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          <button
            onClick={onAdd}
            className="flex items-center gap-2 px-3 py-2 mt-3 text-xs font-medium text-gray-600 transition border border-gray-200 border-dashed rounded-md hover:bg-gray-50"
          >
            <FaPlus size={10} /> Add adjustment
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
// ── Formatted number input — shows thousand separators, stores raw number ──
function FormattedNumberInput({ value, onChange, onBlurCommit, disabled, className }) {
  const [displayValue, setDisplayValue] = useState("");
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) {
      setDisplayValue(
        value === "" || value === null || value === undefined
          ? ""
          : Number(value).toLocaleString("en-PH", {
              maximumFractionDigits: 2,
            }),
      );
    }
  }, [value, focused]);

  const handleChange = (e) => {
    const raw = e.target.value.replace(/,/g, "");
    if (raw === "" || /^-?\d*\.?\d*$/.test(raw)) {
      setDisplayValue(e.target.value);
      onChange(raw);
    }
  };

  const handleFocus = (e) => {
    setFocused(true);
    setDisplayValue(value === "" || value === null ? "" : String(value));
  };

  const handleBlur = (e) => {
    setFocused(false);
    if (e.target.value.replace(/,/g, "") === "" && onBlurCommit) {
      onBlurCommit();
    }
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      value={displayValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      disabled={disabled}
      className={className}
    />
  );
}

export default function BankReconciliation({ currentUser }) {
  // ── Header controls ──
  // statement_date is now the PRIMARY key for a reconciliation record (daily recon).
  // month/year are still derived + stored alongside it, purely for reporting/filtering.
  const [bankName, setBankName] = useState("BDO");
  const [accountNo, setAccountNo] = useState("");
  const [statementDate, setStatementDate] = useState(today());
  const [reconciliationId, setReconciliationId] = useState(null);

  // ── Direct fields from bank_reconciliations ──
  const [beginningBalance, setBeginningBalance] = useState(0);
  const [bankStatementBalance, setBankStatementBalance] = useState(0);
  const [totalPaymentsManual, setTotalPaymentsManual] = useState(0);
  const [totalDepositsNotPosted, setTotalDepositsNotPosted] = useState(0);
  const [totalUnpresentedCheques, setTotalUnpresentedCheques] = useState(0);
  const [totalOutstandingDeposits, setTotalOutstandingDeposits] = useState(0);
  const [adjustmentsManual, setAdjustmentsManual] = useState(0);
  const [notes, setNotes] = useState("");

  // ── Adjustments (F4) — line-item list, mirrors the Transactions pattern ──
  const [adjustmentsList, setAdjustmentsList] = useState([]);
  const [showAdjModal, setShowAdjModal] = useState(false);
  const [adjDraft, setAdjDraft] = useState([]);

  const [isReconciled, setIsReconciled] = useState(false);
  const [reconciledAt, setReconciledAt] = useState(null);
  const [reconciledBy, setReconciledBy] = useState(null);

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

  const userFullName =
    currentUser?.fullName || currentUser?.full_name || "Unknown";

  // ── Load a reconciliation for bank + statement_date (company-level, no client scoping) ──
  const loadReconciliation = useCallback(async () => {
    if (!statementDate) return;
    setLoading(true);
    try {
      let query = supabase
        .from("bank_reconciliations")
        .select("*")
        .eq("statement_date", statementDate);

      if (bankName) query = query.eq("bank_name", bankName);

      const { data: recon, error } = await query.maybeSingle();
      if (error) throw error;

      if (recon) {
        setReconciliationId(recon.id);
        setBankName(recon.bank_name || bankName);
        setAccountNo(recon.account_no || accountNo);
   setBeginningBalance(recon.beginning_balance || 0);
        setTotalPaymentsManual(recon.total_payments || 0);
        setBankStatementBalance(recon.bank_statement_balance || 0);
        setTotalDepositsNotPosted(recon.total_deposits_not_posted || 0);
  setTotalUnpresentedCheques(recon.total_unpresented_cheques || 0);
        setTotalOutstandingDeposits(recon.total_outstanding_deposits || 0);
        setAdjustmentsManual(recon.adjustments || 0);
        setNotes(recon.notes || "");
        setIsReconciled(!!recon.is_reconciled);
        setReconciledAt(recon.reconciled_at || null);
        setReconciledBy(recon.reconciled_by || null);

        const { data: txns, error: txErr } = await supabase
          .from("bank_reconciliation_transactions")
          .select("*")
          .eq("reconciliation_id", recon.id)
          .order("date", { ascending: true });
        if (txErr) throw txErr;
        setTransactions(txns || []);

        const { data: adjs, error: adjErr } = await supabase
          .from("bank_reconciliation_adjustments")
          .select("*")
          .eq("reconciliation_id", recon.id)
          .order("created_at", { ascending: true });
        if (adjErr) throw adjErr;
        setAdjustmentsList(adjs || []);
      } else {
      setReconciliationId(null);
        setBeginningBalance(0);
        setBankStatementBalance(0);
        setTotalPaymentsManual(0);
        setTotalDepositsNotPosted(0);
    setTotalUnpresentedCheques(0);
        setTotalOutstandingDeposits(0);
        setAdjustmentsManual(0);
        setNotes("");
        setAdjustmentsList([]);
        setIsReconciled(false);
        setReconciledAt(null);
        setReconciledBy(null);
        setTransactions([]);

        // ── Carry-forward: find the most recent PRIOR reconciliation for this bank,
        // regardless of exact date gap (handles weekends/holidays/skipped days). ──
        let prevQuery = supabase
          .from("bank_reconciliations")
          .select("id, beginning_balance, statement_date")
          .lt("statement_date", statementDate)
          .order("statement_date", { ascending: false })
          .limit(1);
        if (bankName) prevQuery = prevQuery.eq("bank_name", bankName);

        const { data: prevReconRows } = await prevQuery;
        const prevRecon = prevReconRows?.[0] || null;

        if (prevRecon) {
          const { data: prevOutstanding } = await supabase
            .from("bank_reconciliation_transactions")
            .select("*")
            .eq("reconciliation_id", prevRecon.id)
            .eq("is_outstanding", true);
          if (prevOutstanding?.length) {
            setTransactions(
              prevOutstanding.map((t) => ({
                ...t,
                id: null,
                _carried_forward: true,
              })),
            );
          }

           // ── Auto-carry-forward ng ending Cash Book Balance ──
          // NOTE: dapat tugma ang filter dito sa ginagamit ng fetchTotalReceipts()
          // (bank_transfer, cash, cheque lahat kasama), para hindi magkaiba ang
          // Beginning Balance na naka-carry-forward vs ang aktwal na na-record na
          // receipts noong nakaraang araw.
          const { data: prevAllTxns } = await supabase
            .from("bank_reconciliation_transactions")
            .select("type, amount")
            .eq("reconciliation_id", prevRecon.id);

          const prevReceipts = (prevAllTxns || [])
            .filter((t) => t.type === "Deposit" || t.type === "Cheque")
            .reduce((s, t) => s + Number(t.amount || 0), 0);

          const { data: prevReconFull } = await supabase
            .from("bank_reconciliations")
            .select("total_payments")
            .eq("id", prevRecon.id)
            .single();

          const prevPayments = Number(prevReconFull?.total_payments || 0);

          const prevEndingBalance =
            Number(prevRecon.beginning_balance || 0) +
            prevReceipts -
            prevPayments;

          setBeginningBalance(prevEndingBalance);
        }
      }
    } catch (err) {
      setMessage(`Error loading reconciliation: ${err.message}`);
      setMessageType("error");
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bankName, statementDate]);

  useEffect(() => {
    loadReconciliation();
  }, [loadReconciliation]);

  // ── Computed totals — see docblock above for the derivation rules ──
 // ── Total Receipts — auto, straight from official_receipts (Record Payment).
  // Any payment method (cash, cheque, bank_transfer) counts once it's been
  // physically deposited (deposit_status: "deposited") for this bank + day.
  const [totalReceipts, setTotalReceipts] = useState(0);
  const [receiptsLoading, setReceiptsLoading] = useState(false);

  const fetchTotalReceipts = useCallback(async () => {
    const code = mapBankToReceivingBankCode(bankName);
    if (!code || !statementDate) {
      setTotalReceipts(0);
      return;
    }
    setReceiptsLoading(true);
    try {
      const { data, error } = await supabase
        .from("official_receipts")
        .select("amount")
        .in("payment_method", ["bank_transfer", "cash", "cheque"])
        .eq("receiving_bank", code)
        .eq("deposited_date", statementDate)
        .eq("deposit_status", "deposited");
      if (error) throw error;
      const total = (data || []).reduce(
        (s, r) => s + Number(r.amount || 0),
        0,
      );
      setTotalReceipts(total);
    } catch (err) {
      console.error("fetchTotalReceipts error:", err);
      setTotalReceipts(0);
    } finally {
      setReceiptsLoading(false);
    }
  }, [bankName, statementDate]);

    useEffect(() => {
    fetchTotalReceipts();
  }, [fetchTotalReceipts]);
  

  const cashBookBalance = useMemo(
    () =>
      Number(beginningBalance) +
      totalReceipts -
      Number(totalPaymentsManual || 0),
    [beginningBalance, totalReceipts, totalPaymentsManual],
  );
const adjustedBankTotal = useMemo(
    () =>
      Number(bankStatementBalance) -
      Number(totalUnpresentedCheques || 0) +
      Number(totalOutstandingDeposits || 0) +
      Number(totalDepositsNotPosted) +
      Number(adjustmentsManual || 0),
    [
      bankStatementBalance,
      totalUnpresentedCheques,
      totalOutstandingDeposits,
      totalDepositsNotPosted,
      adjustmentsManual,
    ],
  );

  const reconciliationDiff = useMemo(
    () => adjustedBankTotal - cashBookBalance,
    [adjustedBankTotal, cashBookBalance],
  );
  const isBalanced = Math.abs(reconciliationDiff) < 0.005;

  // ── Sync helper: pull matching deposits from official_receipts (RecordPayment.jsx) ──
  // Daily granularity: sync window is the single statement_date, not the whole month.
  const syncAvailable = !!mapBankToReceivingBankCode(bankName);

  const fetchSyncedDeposits = useCallback(
    async (existingRefs) => {
      const code = mapBankToReceivingBankCode(bankName);
      if (!code || !statementDate) return [];

      const { data, error } = await supabase
        .from("official_receipts")
        .select(
          "invoice_number, payment_date, deposited_date, amount, notes, client_id, payment_method, receiving_bank",
        )
        .in("payment_method", ["bank_transfer", "cash", "cheque"])
        .eq("receiving_bank", code)
        .eq("deposited_date", statementDate)
        .eq("deposit_status", "deposited")
        .order("payment_date", { ascending: true });

      if (error || !data) return [];

      // Cheques still need to clear the bank once deposited, so they sync in as
      // type "Cheque" and default is_outstanding=true. Cash/bank transfer clear
      // fast, so they sync as "Deposit" with is_outstanding=false.
      return data
        .filter((r) => !existingRefs.has(r.invoice_number))
        .map((r) => ({
          _key: `inv-${r.invoice_number}`,
          date: r.deposited_date || r.payment_date,
          description:
            r.notes ||
            `Payment received (${r.payment_method.replace("_", " ")})`,
          type: r.payment_method === "cheque" ? "Cheque" : "Deposit",
          reference_no: r.invoice_number,
          amount: r.amount,
          is_outstanding: r.payment_method === "cheque",
          _synced: true,
        }));
    },
    [bankName, statementDate],
  );

  // Pulls new synced rows and merges them on top of whatever's currently in txnDraft.
  // so re-running this never creates duplicates.
  const refreshSyncedDeposits = useCallback(
    async (currentRows) => {
      setSyncingTxns(true);
      try {
        const existingRefs = new Set(
          (currentRows || []).map((r) => r.reference_no).filter(Boolean),
        );
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
  // client names) that back the synced Deposit rows for this bank + day. Company-wide,
  // all clients — no client filter here, this is just "who's inside that deposit total". ──
  const fetchClientPayments = useCallback(async () => {
    const code = mapBankToReceivingBankCode(bankName);
    if (!code || !statementDate) {
      setClientPayments([]);
      return;
    }
    setClientPaymentsLoading(true);
    try {
      const { data: receipts, error } = await supabase
        .from("official_receipts")
        .select(
          "invoice_number, payment_date, deposited_date, amount, client_id, payment_method, receiving_bank, notes",
        )
        .in("payment_method", ["bank_transfer", "cash", "cheque"])
        .eq("receiving_bank", code)
        .eq("deposited_date", statementDate)
        .eq("deposit_status", "deposited")
        .order("payment_date", { ascending: false });
      if (error || !receipts) {
        setClientPayments([]);
        return;
      }

      const clientIds = [
        ...new Set(receipts.map((r) => r.client_id).filter(Boolean)),
      ];
      let clientMap = {};
      if (clientIds.length > 0) {
        const { data: clients } = await supabase
          .from("client_profile")
          .select(
            "client_id, business_name, trade_name, first_name, middle_name, last_name",
          )
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
              [c.first_name, c.middle_name, c.last_name]
                .filter(Boolean)
                .join(" ") ||
              r.client_id
            : r.client_id || "Unknown client";
          return { ...r, clientName: name };
        }),
      );
    } finally {
      setClientPaymentsLoading(false);
    }
  }, [bankName, statementDate]);

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
      await fetchTotalReceipts();
      setMessage("Totals recalculated.");
      setMessageType("success");
    } catch (err) {
      setMessage(`Error: ${err.message}`);
      setMessageType("error");
    }
    setLoading(false);
    setTimeout(() => setMessage(""), 3000);
  }, [reconciliationId, fetchTotalReceipts]);

  // ── Save (and optionally print) — F3 ──
  const handleSave = async (thenPrint = false) => {
    setSaving(true);
    setMessage("");
    try {
      if (!bankName) {
        setMessage("Bank name is required.");
        setMessageType("error");
        setSaving(false);
        return;
      }
      if (!statementDate) {
        setMessage("Statement date is required.");
        setMessageType("error");
        setSaving(false);
        return;
      }

      const { month, year } = monthYearFromDate(statementDate);

    const payload = {
        bank_name: bankName,
        account_no: accountNo || null,
        month,
        year,
        statement_date: statementDate,
        beginning_balance: Number(beginningBalance) || 0,
        bank_statement_balance: Number(bankStatementBalance) || 0,
        total_payments: Number(totalPaymentsManual) || 0,
        total_deposits_not_posted: Number(totalDepositsNotPosted) || 0,
total_unpresented_cheques: Number(totalUnpresentedCheques) || 0,
        total_outstanding_deposits: Number(totalOutstandingDeposits) || 0,
        adjustments: Number(adjustmentsManual) || 0,
        notes: notes || null,
        created_by: userFullName,
      };

      let id = reconciliationId;
      if (id) {
        const { error } = await supabase
          .from("bank_reconciliations")
          .update(payload)
          .eq("id", id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("bank_reconciliations")
          .insert([payload])
          .select()
          .single();
        if (error) throw error;
        id = data.id;
        setReconciliationId(id);
      }

      setMessage(
        isBalanced
          ? "Reconciliation saved and balanced."
          : "Reconciliation saved (balance error remains).",
      );
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
      setMessage(
        `Cannot close — reconciliation balance error of \u20b1${fmt(Math.abs(reconciliationDiff))}.`,
      );
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
      .update({
        is_reconciled: false,
        reconciled_at: null,
        reconciled_by: null,
      })
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
      // Rows previously synced from official_receipts carry an "INV-" reference_no.
      // Flag them so they render locked, same as freshly-synced rows.
      _synced: !!(t.reference_no && t.reference_no.startsWith("INV-")),
    }));
    setTxnDraft(baseRows);
    setShowTxnModal(true);
    refreshSyncedDeposits(baseRows);
  };

  const saveTxnModal = async () => {
    if (!reconciliationId) {
      setMessage(
        "Save the reconciliation first (Save and Print) before adding transactions.",
      );
      setMessageType("error");
      setShowTxnModal(false);
      return;
    }
    setSaving(true);
    try {
      await supabase
        .from("bank_reconciliation_transactions")
        .delete()
        .eq("reconciliation_id", reconciliationId);
      const rows = txnDraft
        .filter((t) => t.description || t.amount)
        .map(({ _key, id, _synced, ...rest }) => ({
          ...rest,
          reconciliation_id: reconciliationId,
          amount: Number(rest.amount) || 0,
          is_outstanding: !!rest.is_outstanding,
        }));
      if (rows.length) {
        const { error } = await supabase
          .from("bank_reconciliation_transactions")
          .insert(rows);
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

  const updateTxnRow = (idx, key, val) =>
    setTxnDraft((rows) =>
      rows.map((r, i) => (i === idx ? { ...r, [key]: val } : r)),
    );
  const removeTxnRow = (idx) =>
    setTxnDraft((rows) => rows.filter((_, i) => i !== idx));

  // ── Adjustments modal handlers (F4) ──
  const openAdjModal = () => {
    setAdjDraft(
      adjustmentsList.map((a) => ({ ...a, _key: a.id || Math.random() })),
    );
    setShowAdjModal(true);
  };

  const saveAdjModal = async () => {
    if (!reconciliationId) {
      setMessage(
        "Save the reconciliation first (Save and Print) before adding adjustments.",
      );
      setMessageType("error");
      setShowAdjModal(false);
      return;
    }
    setSaving(true);
    try {
      await supabase
        .from("bank_reconciliation_adjustments")
        .delete()
        .eq("reconciliation_id", reconciliationId);
      const rows = adjDraft
        .filter((a) => a.description || a.amount)
        .map(({ _key, id, ...rest }) => ({
          ...rest,
          reconciliation_id: reconciliationId,
          amount: Number(rest.amount) || 0,
        }));
      if (rows.length) {
        const { error } = await supabase
          .from("bank_reconciliation_adjustments")
          .insert(rows);
        if (error) throw error;
      }
      setAdjustmentsList(rows);
      setShowAdjModal(false);
    } catch (err) {
      setMessage(`Error: ${err.message}`);
      setMessageType("error");
    }
    setSaving(false);
  };

  const updateAdjRow = (idx, key, val) =>
    setAdjDraft((rows) =>
      rows.map((r, i) => (i === idx ? { ...r, [key]: val } : r)),
    );
  const removeAdjRow = (idx) =>
    setAdjDraft((rows) => rows.filter((_, i) => i !== idx));

  return (
    <div className="min-h-screen bg-gray-50">
      {/* TOP BAR */}
      <div className="sticky top-0 z-10 px-6 py-4 bg-white border-b border-gray-200 print:hidden">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center rounded-full w-9 h-9"
              style={{ background: "#e8f5ec" }}
            >
              <FaMoneyCheckAlt size={14} style={{ color: GREEN }} />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-gray-800">
                Bank Reconciliation
              </h1>
              <p className="text-xs text-gray-400">
                Daily reconciliation — one record per bank, per day
              </p>
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
            <select
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              disabled={isReconciled}
              className={`${inputCls} disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <option value="BDO">BDO</option>
              <option value="China Bank">China Bank</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Account No.</label>
            <input
              type="text"
              value={accountNo}
              onChange={(e) => setAccountNo(e.target.value)}
              disabled={isReconciled}
              className={`${inputCls} disabled:opacity-50 disabled:cursor-not-allowed`}
            />
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
        <div
          className="flex items-center justify-between px-5 py-3 mx-6 mt-5 mb-5 border rounded-lg"
          style={{ borderColor: "#bfe3cb", background: "#e8f5ec" }}
        >
          <div className="flex items-center gap-2">
            <FaCheckCircle size={13} style={{ color: GREEN }} />
            <span className="text-sm font-medium" style={{ color: GREEN }}>
              Reconciled by {reconciledBy} on{" "}
              {new Date(reconciledAt).toLocaleDateString("en-PH")} — locked
            </span>
          </div>
          <button
            onClick={handleUnreconcile}
            className="text-xs font-medium text-blue-500 hover:underline"
          >
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
                <div
                  className="flex items-center justify-center w-8 h-8 rounded-full shrink-0"
                  style={{ background: "#e8f5ec" }}
                >
                  <FaLink size={11} style={{ color: GREEN }} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    {clientPaymentsLoading
                      ? "Checking Record Payment..."
                      : !syncAvailable
                        ? "Client payment sync unavailable"
                        : clientPayments.length === 0
                          ? "No client payments for this day yet"
                          : `${clientPayments.length} client payment${clientPayments.length > 1 ? "s" : ""} synced from Record Payment`}
                  </p>
                  {!clientPaymentsLoading &&
                    syncAvailable &&
                    clientPayments.length > 0 && (
                      <p className="text-xs text-gray-400">
                        ₱
                        {fmt(
                          clientPayments.reduce(
                            (s, p) => s + Number(p.amount || 0),
                            0,
                          ),
                        )}{" "}
                        total · counted as Deposits below
                      </p>
                    )}
                  {!clientPaymentsLoading && !syncAvailable && (
                    <p className="text-xs text-gray-400">
                      Try "BDO" or "China Bank" as the bank name to enable
                      syncing
                    </p>
                  )}
                </div>
              </div>
              {clientPaymentsLoading ? (
                <div className="w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin shrink-0" />
              ) : (
                clientPayments.length > 0 && (
                  <span className="text-gray-300 shrink-0">
                    {paymentsExpanded ? (
                      <FaChevronUp size={11} />
                    ) : (
                      <FaChevronDown size={11} />
                    )}
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
                        <th className="px-3 py-2 font-medium text-left">
                          Date
                        </th>
                        <th className="px-3 py-2 font-medium text-left">
                          Client
                        </th>
                        <th className="px-3 py-2 font-medium text-left">
                          Method
                        </th>
                        <th className="px-3 py-2 font-medium text-left">
                          OR #
                        </th>
                        <th className="px-3 py-2 font-medium text-right">
                          Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientPayments.map((p) => (
                        <tr
                          key={p.invoice_number}
                          className="border-t border-gray-50"
                        >
                          <td className="px-3 py-2 text-gray-600">
                            {p.payment_date}
                          </td>
                          <td className="px-3 py-2 text-gray-800">
                            {p.clientName}
                          </td>
                          <td className="px-3 py-2 text-gray-500 capitalize">
                            {p.payment_method?.replace("_", " ")}
                          </td>
                          <td className="px-3 py-2 font-mono text-gray-500">
                            {p.invoice_number}
                          </td>
                          <td className="px-3 py-2 font-mono text-right text-gray-700">
                            ₱{fmt(p.amount)}
                          </td>
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

          {/* Unified Reconciliation Panel — Cash Book + Bank Statement + Balance,
              single bordered box matching the classic accounting-software layout. */}
          <div className="overflow-hidden bg-white border border-gray-200 rounded-lg">
            {/* Cash Book section */}
            <div className="px-5 py-4">
              <p className="mb-3 text-xs font-semibold tracking-wider text-gray-400 uppercase">
                Cash Book
              </p>
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-4">
                  <span className={labelCls}>
                    Cash book balance brought forward
                  </span>
          <FormattedNumberInput
                    value={beginningBalance}
                    onChange={setBeginningBalance}
                    onBlurCommit={() => setBeginningBalance(0)}
                    className="w-40 px-3 py-2 font-mono text-sm text-right border border-gray-200 rounded-md focus:outline-none focus:border-blue-400"
                  />
                </div>

                <div className="flex items-center justify-between gap-4">
                  <span className={labelCls}>Total receipts</span>
                  <div className={`w-40 ${readOnlyCls}`}>
                    {receiptsLoading ? "..." : fmt(totalReceipts)}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className={labelCls}>Total Payments</span>
          <FormattedNumberInput
                    value={totalPaymentsManual}
                    onChange={setTotalPaymentsManual}
                    onBlurCommit={() => setTotalPaymentsManual(0)}
                    disabled={isReconciled}
                    className="w-40 px-3 py-2 font-mono text-sm text-right border border-gray-200 rounded-md focus:outline-none focus:border-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
                <div className="flex items-center justify-between gap-4 pt-2.5 border-t border-gray-100">
                  <span className="text-sm font-semibold text-gray-800">
                    Cash Book Balance
                  </span>
                  <div
                    className="w-40 px-3 py-2 font-mono text-sm font-bold text-right border rounded-md"
                    style={{
                      borderColor: GREEN,
                      color: GREEN,
                      background: "#e8f5ec",
                    }}
                  >
                    {fmt(cashBookBalance)}
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-100" />

            {/* Bank Statement section */}
            <div className="px-5 py-4">
              <p className="mb-3 text-xs font-semibold tracking-wider text-gray-400 uppercase">
                Bank Statement
              </p>
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-4">
                  <span className={labelCls}>Balance from bank statement</span>
           <FormattedNumberInput
                    value={bankStatementBalance}
                    onChange={setBankStatementBalance}
                    onBlurCommit={() => setBankStatementBalance(0)}
                    className="w-40 px-3 py-2 font-mono text-sm text-right border border-gray-200 rounded-md focus:outline-none focus:border-blue-400"
                  />
                </div>

      <div className="flex items-center justify-between gap-4">
                  <span className={labelCls}>Total unpresented cheques</span>
                  <FormattedNumberInput
                    value={totalUnpresentedCheques}
                    onChange={setTotalUnpresentedCheques}
                    onBlurCommit={() => setTotalUnpresentedCheques(0)}
                    disabled={isReconciled}
                    className="w-40 px-3 py-2 font-mono text-sm text-right border border-gray-200 rounded-md focus:outline-none focus:border-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className={labelCls}>Total outstanding deposits</span>
               <FormattedNumberInput
                    value={totalOutstandingDeposits}
                    onChange={setTotalOutstandingDeposits}
                    onBlurCommit={() => setTotalOutstandingDeposits(0)}
                    disabled={isReconciled}
                    className="w-40 px-3 py-2 font-mono text-sm text-right border border-gray-200 rounded-md focus:outline-none focus:border-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className={labelCls}>
                    Total deposits banked not posted
                  </span>
             <FormattedNumberInput
                    value={totalDepositsNotPosted}
                    onChange={setTotalDepositsNotPosted}
                    onBlurCommit={() => setTotalDepositsNotPosted(0)}
                    className="w-40 px-3 py-2 font-mono text-sm text-right border border-gray-200 rounded-md focus:outline-none focus:border-blue-400"
                  />
                </div>
            <div className="flex items-center justify-between gap-4">
                  <span className={labelCls}>Adjustments</span>
                  <FormattedNumberInput
                    value={adjustmentsManual}
                    onChange={setAdjustmentsManual}
                    onBlurCommit={() => setAdjustmentsManual(0)}
                    disabled={isReconciled}
                    className="w-40 px-3 py-2 font-mono text-sm text-right border border-gray-200 rounded-md focus:outline-none focus:border-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
                <div className="flex items-center justify-between gap-4 pt-2.5 border-t border-gray-100">
                  <span className="text-sm font-semibold text-gray-800">
                    Total
                  </span>
                  <div
                    className="w-40 px-3 py-2 font-mono text-sm font-bold text-right border rounded-md"
                    style={{
                      borderColor: GREEN,
                      color: GREEN,
                      background: "#e8f5ec",
                    }}
                  >
                    {fmt(adjustedBankTotal)}
                  </div>
                </div>
              </div>
            </div>

            {/* Reconciliation Balance / Error — bottom of the same panel */}
            <div
              className="flex items-center justify-between px-5 py-4 border-t-2"
              style={{
                borderColor: isBalanced ? GREEN : RED,
                background: isBalanced ? "#e8f5ec" : "#fdecea",
              }}
            >
              <div className="flex items-center gap-2">
                {isBalanced ? (
                  <FaCheckCircle size={16} style={{ color: GREEN }} />
                ) : (
                  <FaExclamationTriangle size={16} style={{ color: RED }} />
                )}
                <span
                  className="text-sm font-bold tracking-wide uppercase"
                  style={{ color: isBalanced ? GREEN : RED }}
                >
                  {isBalanced
                    ? "Reconciliation Balanced"
                    : "Reconciliation Balance Error"}
                </span>
              </div>
              <span
                className="font-mono text-lg font-bold"
                style={{ color: isBalanced ? GREEN : RED }}
              >
                {isBalanced ? "₱0.00" : `₱${fmt(Math.abs(reconciliationDiff))}`}
              </span>
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
        </div>

          {/* RIGHT — action rail */}
        <div className="space-y-2.5 lg:col-span-1">
          <RailButton
            icon={<FaTimes size={13} />}
            label="Cancel"
            hint="Esc"
            onClick={() => window.history.back()}
          />
          <RailButton
            icon={<FaSync size={13} />}
            label="Recalculate Totals"
            hint="F2"
            onClick={handleRecalculate}
            disabled={loading}
          />
          <RailButton
            icon={<FaSave size={13} />}
            label="Save and Print"
            hint="F3"
            onClick={() => handleSave(true)}
            disabled={saving}
            primary
          />
          <RailButton
            icon={<FaSlidersH size={13} />}
            label="Transactions"
            hint="F4"
            onClick={openTxnModal}
            disabled={isReconciled}
          />
          <RailButton
            icon={<FaMoneyCheckAlt size={13} />}
            label="Adjustments"
            hint="F5"
            onClick={openAdjModal}
            disabled={isReconciled}
          />
          <RailButton
            icon={<FaCheckCircle size={13} />}
            label="OK"
            hint="F12"
            onClick={handleOk}
            disabled={saving || isReconciled}
            primary
          />
        </div>
      </div>

      {showTxnModal && (
        <TransactionsModal
          rows={txnDraft}
          onAdd={() =>
            setTxnDraft((r) => [
              ...r,
              {
                _key: Math.random(),
                date: statementDate || today(),
                description: "",
                type: "Deposit",
                reference_no: "",
                amount: "",
                is_outstanding: false,
              },
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

      {showAdjModal && (
        <AdjustmentsModal
          rows={adjDraft}
          onAdd={() =>
            setAdjDraft((r) => [
              ...r,
              { _key: Math.random(), description: "", amount: "" },
            ])
          }
          onRemove={removeAdjRow}
          onChange={updateAdjRow}
          onClose={() => setShowAdjModal(false)}
          onSave={saveAdjModal}
          saving={saving}
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
      style={
        primary
          ? { background: GREEN, borderColor: GREEN }
          : { borderColor: "#e5e7eb" }
      }
    >
      <span className={primary ? "text-white" : "text-gray-400"}>{icon}</span>
      <span className="flex-1 text-sm font-medium">{label}</span>
      <span
        className={`text-[10px] font-mono ${primary ? "text-white/70" : "text-gray-300"}`}
      >
        {hint}
      </span>
    </button>
  );
}
