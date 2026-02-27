import React, { useState, useEffect } from "react";
import { Banknote } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import CustomerMaintenanceTable, {
  MaintenanceModal,
  DeleteModal,
  Toast,
} from "../Components/customer_maintenance";

// ─── Auto-generate next sb_code ──────────────────────────────────────
const generateNextCode = (existingList) => {
  const prefix = "SB_";
  let maxNum = 0;
  existingList.forEach((s) => {
    if (s.sb_code?.startsWith(prefix)) {
      const num = parseInt(s.sb_code.replace(prefix, ""), 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }
  });
  return `${prefix}${String(maxNum + 1).padStart(3, "0")}`;
};

// ─── Format amount with peso sign & commas ───────────────────────────
const formatAmount = (val) => {
  if (!val && val !== 0) return "";
  return Number(val).toLocaleString("en-PH");
};

const SalaryBracket = () => {
  const [brackets, setBrackets] = useState([]);
  const [search, setSearch] = useState("");
  const [fetching, setFetching] = useState(true);

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [sbCode, setSbCode] = useState("");
  const [sbAmount, setSbAmount] = useState("");
  const [loading, setLoading] = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Toast
  const [toast, setToast] = useState({ msg: "", type: "success" });
  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: "", type: "success" }), 3000);
  };

  // ── Fetch ──
  const fetchBrackets = async () => {
    setFetching(true);
    const { data, error } = await supabase
      .from("salary_bracket")
      .select("*")
      .order("salary_bracket_amount", { ascending: true });
    if (!error) setBrackets(data || []);
    setFetching(false);
  };

  useEffect(() => { fetchBrackets(); }, []);

  // ── Open Add ──
  const openAdd = () => {
    setEditTarget(null);
    setSbCode(generateNextCode(brackets));
    setSbAmount("");
    setModalOpen(true);
  };

  // ── Open Edit ──
  const openEdit = (row) => {
    setEditTarget(row);
    setSbCode(row.sb_code || "");
    setSbAmount(row.salary_bracket_amount?.toString() || "");
    setModalOpen(true);
  };

  // ── Submit ──
  const handleSubmit = async () => {
    if (!sbAmount.toString().trim()) return showToast("Salary bracket amount is required.", "error");
    const amount = parseInt(sbAmount.toString().replace(/[^0-9]/g, ""), 10);
    if (isNaN(amount)) return showToast("Please enter a valid amount.", "error");

    setLoading(true);
    if (editTarget) {
      const { error } = await supabase
        .from("salary_bracket")
        .update({ salary_bracket_amount: amount })
        .eq("id", editTarget.id);
      if (error) showToast("Update failed.", "error");
      else { showToast("Salary bracket updated!"); fetchBrackets(); }
    } else {
      const { error } = await supabase
        .from("salary_bracket")
        .insert({ sb_code: sbCode, salary_bracket_amount: amount });
      if (error) showToast("Insert failed.", "error");
      else { showToast("Salary bracket added!"); fetchBrackets(); }
    }
    setLoading(false);
    setModalOpen(false);
  };

  // ── Delete ──
  const handleDelete = async () => {
    setDeleteLoading(true);
    const { error } = await supabase.from("salary_bracket").delete().eq("id", deleteTarget.id);
    if (error) showToast("Delete failed.", "error");
    else { showToast("Salary bracket deleted!"); fetchBrackets(); }
    setDeleteLoading(false);
    setDeleteTarget(null);
  };

  // ── Filter ──
  const filtered = brackets.filter(
    (b) =>
      (b.sb_code || "").toLowerCase().includes(search.toLowerCase()) ||
      (b.salary_bracket_amount?.toString() || "").includes(search)
  );

  // ── Format rows for display ──
  const displayRows = filtered.map((b) => ({
    ...b,
    salary_bracket_amount_display: `₱${formatAmount(b.salary_bracket_amount)}`,
  }));

  return (
    <>
      <CustomerMaintenanceTable
        title="Salary Bracket"
        icon={<Banknote size={22} className="text-green-600" />}
        totalCount={brackets.length}
        search={search}
        onSearchChange={setSearch}
        onAdd={openAdd}
        addLabel="Add Salary Bracket"
        columns={[
          { label: "Code", key: "sb_code", badge: true },
          { label: "Salary Bracket Amount", key: "salary_bracket_amount_display" },
        ]}
        rows={displayRows}
        onEdit={(row) => openEdit(brackets.find(b => b.id === row.id))}
        onDelete={(row) => setDeleteTarget(brackets.find(b => b.id === row.id))}
        fetching={fetching}
        emptyMessage="No salary brackets found."
      />

      <MaintenanceModal
        open={modalOpen}
        title={editTarget ? "Edit Salary Bracket" : "Add Salary Bracket"}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        loading={loading}
        fields={[
          { label: "Bracket Code", value: sbCode, readOnly: true },
          {
            label: "Salary Bracket Amount (₱)",
            value: sbAmount,
            onChange: (val) => setSbAmount(val.replace(/[^0-9]/g, "")),
            placeholder: "e.g. 15000",
            type: "number",
          },
        ]}
      />

      <DeleteModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleteLoading}
      />

      <Toast msg={toast.msg} type={toast.type} />
    </>
  );
};

export default SalaryBracket;