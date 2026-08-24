import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabaseClient";
import { FaMoneyBillWave, FaCheckCircle } from "react-icons/fa";

const RECEIVING_BANKS = [
  { value: "bdo", label: "BDO" },
  { value: "chinabank", label: "Chinabank" },
];

function fmt(n) {
  return Number(n || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function UndepositedFunds({ currentUser }) {
  const [receipts, setReceipts] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [depositDate, setDepositDate] = useState(new Date().toISOString().split("T")[0]);
  const [bankCode, setBankCode] = useState("bdo");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchUndeposited = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("official_receipts")
      .select("id, invoice_number, client_id, amount, payment_date, payment_method, cheque_number, cheque_bank")
      .eq("deposit_status", "undeposited")
      .order("payment_date", { ascending: true });
    if (!error) setReceipts(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchUndeposited(); }, [fetchUndeposited]);

  const toggle = (id) =>
    setSelected((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const total = receipts
    .filter((r) => selected.has(r.id))
    .reduce((s, r) => s + Number(r.amount || 0), 0);

  const markAsDeposited = async () => {
    if (selected.size === 0) return;
    setSaving(true);
    try {
      const batchId = crypto.randomUUID();
      const { error } = await supabase
        .from("official_receipts")
        .update({
          deposit_status: "deposited",
          deposited_date: depositDate,
          receiving_bank: bankCode,
          deposit_batch_id: batchId,
        })
        .in("id", Array.from(selected));
      if (error) throw error;
      setSelected(new Set());
      await fetchUndeposited();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
    setSaving(false);
  };

  return (
    <div className="min-h-screen p-6 bg-gray-50">
      <div className="flex items-center gap-3 mb-4">
        <FaMoneyBillWave style={{ color: "#1a5c2e" }} />
        <h1 className="text-sm font-semibold text-gray-800">Undeposited Funds</h1>
        <span className="text-xs text-gray-400">— cash & cheques not yet reflected in bank</span>
      </div>

      <div className="flex items-end gap-3 mb-4">
        <div>
          <label className="block mb-1 text-xs text-gray-500">Deposit Date</label>
          <input type="date" value={depositDate} onChange={(e) => setDepositDate(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-md" />
        </div>
        <div>
          <label className="block mb-1 text-xs text-gray-500">Deposit to Bank</label>
          <select value={bankCode} onChange={(e) => setBankCode(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-md">
            {RECEIVING_BANKS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
          </select>
        </div>
        <button
          onClick={markAsDeposited}
          disabled={saving || selected.size === 0}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-md disabled:opacity-50"
          style={{ background: "#1a5c2e" }}
        >
          <FaCheckCircle size={12} /> {saving ? "Saving..." : `Mark ${selected.size} as Deposited`}
        </button>
        {selected.size > 0 && <span className="font-mono text-sm text-gray-600">₱{fmt(total)}</span>}
      </div>

      <div className="overflow-hidden bg-white border border-gray-200 rounded-lg">
        <table className="w-full text-xs">
          <thead className="text-gray-500 bg-gray-50">
            <tr>
              <th className="w-8 px-3 py-2"></th>
              <th className="px-3 py-2 font-medium text-left">Date Collected</th>
              <th className="px-3 py-2 font-medium text-left">Invoice</th>
              <th className="px-3 py-2 font-medium text-left">Method</th>
              <th className="px-3 py-2 font-medium text-left">Cheque No./Bank</th>
              <th className="px-3 py-2 font-medium text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="py-6 text-center text-gray-400">Loading...</td></tr>
            ) : receipts.length === 0 ? (
              <tr><td colSpan={6} className="py-6 text-center text-gray-400">No undeposited items.</td></tr>
            ) : (
              receipts.map((r) => (
                <tr key={r.id} className="border-t border-gray-50">
                  <td className="px-3 py-2">
                    <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} className="w-3.5 h-3.5 accent-green-700" />
                  </td>
                  <td className="px-3 py-2">{r.payment_date}</td>
                  <td className="px-3 py-2 font-mono">{r.invoice_number}</td>
                  <td className="px-3 py-2 capitalize">{r.payment_method}</td>
                  <td className="px-3 py-2">{r.cheque_number ? `${r.cheque_number} / ${r.cheque_bank || "—"}` : "—"}</td>
                  <td className="px-3 py-2 font-mono text-right">₱{fmt(r.amount)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}