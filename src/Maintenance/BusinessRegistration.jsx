import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import CustomerMaintenanceTable, {
  MaintenanceModal,
  DeleteModal,
  Toast,
} from "../Components/customer_maintenance";

const generateNextCode = (existingList) => {
  const prefix = "BR_";
  let maxNum = 0;
  existingList.forEach((s) => {
    if (s.br_code?.startsWith(prefix)) {
      const num = parseInt(s.br_code.replace(prefix, ""), 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }
  });
  return `${prefix}${String(maxNum + 1).padStart(3, "0")}`;
};

const BusinessRegistration = () => {
  const [records, setRecords] = useState([]);
  const [search, setSearch] = useState("");
  const [fetching, setFetching] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [brCode, setBrCode] = useState("");
  const [brLabel, setBrLabel] = useState("");
  const [loading, setLoading] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [toast, setToast] = useState({ msg: "", type: "success" });
  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: "", type: "success" }), 3000);
  };

  const fetchRecords = async () => {
    setFetching(true);
    const { data, error } = await supabase
      .from("business_registration")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error) setRecords(data || []);
    setFetching(false);
  };

  useEffect(() => { fetchRecords(); }, []);

  const openAdd = () => {
    setEditTarget(null);
    setBrCode(generateNextCode(records));
    setBrLabel("");
    setModalOpen(true);
  };

  const openEdit = (row) => {
    setEditTarget(row);
    setBrCode(row.br_code || "");
    setBrLabel(row.business_registration || "");
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!brLabel.trim()) return showToast("Business registration is required.", "error");
    setLoading(true);
    if (editTarget) {
      const { error } = await supabase
        .from("business_registration")
        .update({ business_registration: brLabel.trim() })
        .eq("id", editTarget.id);
      if (error) showToast("Update failed.", "error");
      else { showToast("Record updated!"); fetchRecords(); }
    } else {
      const { error } = await supabase
        .from("business_registration")
        .insert({ br_code: brCode, business_registration: brLabel.trim() });
      if (error) showToast("Insert failed.", "error");
      else { showToast("Record added!"); fetchRecords(); }
    }
    setLoading(false);
    setModalOpen(false);
  };

  const handleDelete = async () => {
    setDeleteLoading(true);
    const { error } = await supabase.from("business_registration").delete().eq("id", deleteTarget.id);
    if (error) showToast("Delete failed.", "error");
    else { showToast("Record deleted!"); fetchRecords(); }
    setDeleteLoading(false);
    setDeleteTarget(null);
  };

  const filtered = records.filter(
    (r) =>
      (r.br_code || "").toLowerCase().includes(search.toLowerCase()) ||
      (r.business_registration || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <CustomerMaintenanceTable
        title="Business Registration"
        totalCount={records.length}
        search={search}
        onSearchChange={setSearch}
        onAdd={openAdd}
        addLabel="Add Registration"
        columns={[
          { label: "BR Code", key: "br_code", badge: true },
          { label: "Business Registration", key: "business_registration" },
        ]}
        rows={filtered}
        onEdit={openEdit}
        onDelete={setDeleteTarget}
        fetching={fetching}
        emptyMessage="No business registrations found."
      />

      <MaintenanceModal
        open={modalOpen}
        title={editTarget ? "Edit Business Registration" : "Add Business Registration"}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        loading={loading}
        fields={[
          { label: "BR Code", value: brCode, readOnly: true },
          { label: "Business Registration", value: brLabel, onChange: setBrLabel, placeholder: "e.g. SEC" },
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

export default BusinessRegistration;