import React, { useState, useEffect } from "react";
import { Receipt } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import CustomerMaintenanceTable, {
  MaintenanceModal,
  DeleteModal,
  Toast,
} from "../Components/customer_maintenance";

// ─── Auto-generate next tt_code ──────────────────────────────────────
const generateNextCode = (existingList) => {
  const prefix = "TAX_";
  let maxNum = 0;
  existingList.forEach((t) => {
    if (t.tt_code?.startsWith(prefix)) {
      const num = parseInt(t.tt_code.replace(prefix, ""), 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }
  });
  return `${prefix}${String(maxNum + 1).padStart(3, "0")}`;
};

const TaxType = () => {
  const [taxTypes, setTaxTypes] = useState([]);
  const [search, setSearch] = useState("");
  const [fetching, setFetching] = useState(true);

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [ttCode, setTtCode] = useState("");
  const [taxTypeLabel, setTaxTypeLabel] = useState("");
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
  const fetchTaxTypes = async () => {
    setFetching(true);
    const { data, error } = await supabase
      .from("tax_type")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error) setTaxTypes(data || []);
    setFetching(false);
  };

  useEffect(() => { fetchTaxTypes(); }, []);

  // ── Open Add ──
  const openAdd = () => {
    setEditTarget(null);
    setTtCode(generateNextCode(taxTypes));
    setTaxTypeLabel("");
    setModalOpen(true);
  };

  // ── Open Edit ──
  const openEdit = (row) => {
    setEditTarget(row);
    setTtCode(row.tt_code || "");
    setTaxTypeLabel(row.tax_type || "");
    setModalOpen(true);
  };

  // ── Submit ──
  const handleSubmit = async () => {
    if (!taxTypeLabel.trim()) return showToast("Tax type label is required.", "error");
    setLoading(true);
    if (editTarget) {
      const { error } = await supabase
        .from("tax_type")
        .update({ tax_type: taxTypeLabel.trim() })
        .eq("id", editTarget.id);
      if (error) showToast("Update failed.", "error");
      else { showToast("Tax type updated!"); fetchTaxTypes(); }
    } else {
      const { error } = await supabase
        .from("tax_type")
        .insert({ tt_code: ttCode, tax_type: taxTypeLabel.trim() });
      if (error) showToast("Insert failed.", "error");
      else { showToast("Tax type added!"); fetchTaxTypes(); }
    }
    setLoading(false);
    setModalOpen(false);
  };

  // ── Delete ──
  const handleDelete = async () => {
    setDeleteLoading(true);
    const { error } = await supabase.from("tax_type").delete().eq("id", deleteTarget.id);
    if (error) showToast("Delete failed.", "error");
    else { showToast("Tax type deleted!"); fetchTaxTypes(); }
    setDeleteLoading(false);
    setDeleteTarget(null);
  };

  // ── Filter ──
  const filtered = taxTypes.filter(
    (t) =>
      (t.tt_code || "").toLowerCase().includes(search.toLowerCase()) ||
      (t.tax_type || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <CustomerMaintenanceTable
        title="Tax Type"
        icon={<Receipt size={22} className="text-green-600" />}
        totalCount={taxTypes.length}
        search={search}
        onSearchChange={setSearch}
        onAdd={openAdd}
        addLabel="Add Tax Type"
        columns={[
          { label: "Tax Code", key: "tt_code", badge: true },
          { label: "Tax Type", key: "tax_type" },
        ]}
        rows={filtered}
        onEdit={openEdit}
        onDelete={setDeleteTarget}
        fetching={fetching}
        emptyMessage="No tax types found."
      />

      <MaintenanceModal
        open={modalOpen}
        title={editTarget ? "Edit Tax Type" : "Add Tax Type"}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        loading={loading}
        fields={[
          { label: "Tax Code", value: ttCode, readOnly: true },
          { label: "Tax Type", value: taxTypeLabel, onChange: setTaxTypeLabel, placeholder: "e.g. VAT" },
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

export default TaxType;