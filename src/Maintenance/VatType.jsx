import React, { useState, useEffect } from "react";
import { Percent } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import CustomerMaintenanceTable, {
  MaintenanceModal,
  DeleteModal,
  Toast,
} from "../Components/customer_maintenance";

// ─── Auto-generate next vt_code ──────────────────────────────────────
const generateNextCode = (existingList) => {
  const prefix = "VAT_";
  let maxNum = 0;
  existingList.forEach((v) => {
    if (v.vt_code?.startsWith(prefix)) {
      const num = parseInt(v.vt_code.replace(prefix, ""), 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }
  });
  return `${prefix}${String(maxNum + 1).padStart(3, "0")}`;
};

const VatType = () => {
  const [vatTypes, setVatTypes] = useState([]);
  const [search, setSearch] = useState("");
  const [fetching, setFetching] = useState(true);

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [vtCode, setVtCode] = useState("");
  const [vatTypeLabel, setVatTypeLabel] = useState("");
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
  const fetchVatTypes = async () => {
    setFetching(true);
    const { data, error } = await supabase
      .from("vat_type")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error) setVatTypes(data || []);
    setFetching(false);
  };

  useEffect(() => { fetchVatTypes(); }, []);

  // ── Open Add ──
  const openAdd = () => {
    setEditTarget(null);
    setVtCode(generateNextCode(vatTypes));
    setVatTypeLabel("");
    setModalOpen(true);
  };

  // ── Open Edit ──
  const openEdit = (row) => {
    setEditTarget(row);
    setVtCode(row.vt_code || "");
    setVatTypeLabel(row.vat_type || "");
    setModalOpen(true);
  };

  // ── Submit ──
  const handleSubmit = async () => {
    if (!vatTypeLabel.trim()) return showToast("VAT type label is required.", "error");
    setLoading(true);
    if (editTarget) {
      const { error } = await supabase
        .from("vat_type")
        .update({ vat_type: vatTypeLabel.trim() })
        .eq("id", editTarget.id);
      if (error) showToast("Update failed.", "error");
      else { showToast("VAT type updated!"); fetchVatTypes(); }
    } else {
      const { error } = await supabase
        .from("vat_type")
        .insert({ vt_code: vtCode, vat_type: vatTypeLabel.trim() });
      if (error) showToast("Insert failed.", "error");
      else { showToast("VAT type added!"); fetchVatTypes(); }
    }
    setLoading(false);
    setModalOpen(false);
  };

  // ── Delete ──
  const handleDelete = async () => {
    setDeleteLoading(true);
    const { error } = await supabase.from("vat_type").delete().eq("id", deleteTarget.id);
    if (error) showToast("Delete failed.", "error");
    else { showToast("VAT type deleted!"); fetchVatTypes(); }
    setDeleteLoading(false);
    setDeleteTarget(null);
  };

  // ── Filter ──
  const filtered = vatTypes.filter(
    (v) =>
      (v.vt_code || "").toLowerCase().includes(search.toLowerCase()) ||
      (v.vat_type || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <CustomerMaintenanceTable
        title="VAT Type"
        icon={<Percent size={22} className="text-blue-600" />}
        totalCount={vatTypes.length}
        search={search}
        onSearchChange={setSearch}
        onAdd={openAdd}
        addLabel="Add VAT Type"
        columns={[
          { label: "VAT Code", key: "vt_code", badge: true },
          { label: "VAT Type", key: "vat_type" },
        ]}
        rows={filtered}
        onEdit={openEdit}
        onDelete={setDeleteTarget}
        fetching={fetching}
        emptyMessage="No VAT types found."
      />

      <MaintenanceModal
        open={modalOpen}
        title={editTarget ? "Edit VAT Type" : "Add VAT Type"}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        loading={loading}
        fields={[
          { label: "VAT Code", value: vtCode, readOnly: true },
          { label: "VAT Type", value: vatTypeLabel, onChange: setVatTypeLabel, placeholder: "e.g. Net of VAT" },
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

export default VatType;