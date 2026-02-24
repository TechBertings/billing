import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import CustomerMaintenanceTable, {
  MaintenanceModal,
  DeleteModal,
  Toast,
} from "../Components/customer_maintenance";

const generateNextCode = (existingList) => {
  const prefix = "TPC_";
  let maxNum = 0;
  existingList.forEach((s) => {
    if (s.tpc_code?.startsWith(prefix)) {
      const num = parseInt(s.tpc_code.replace(prefix, ""), 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }
  });
  return `${prefix}${String(maxNum + 1).padStart(3, "0")}`;
};

const TaxPayerClassification = () => {
  const [records, setRecords] = useState([]);
  const [search, setSearch] = useState("");
  const [fetching, setFetching] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [tpcCode, setTpcCode] = useState("");
  const [tpcLabel, setTpcLabel] = useState("");
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
      .from("tax_payer_classification")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error) setRecords(data || []);
    setFetching(false);
  };

  useEffect(() => { fetchRecords(); }, []);

  const openAdd = () => {
    setEditTarget(null);
    setTpcCode(generateNextCode(records));
    setTpcLabel("");
    setModalOpen(true);
  };

  const openEdit = (row) => {
    setEditTarget(row);
    setTpcCode(row.tpc_code || "");
    setTpcLabel(row.tax_payer_classification || "");
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!tpcLabel.trim()) return showToast("Tax payer classification is required.", "error");
    setLoading(true);
    if (editTarget) {
      const { error } = await supabase
        .from("tax_payer_classification")
        .update({ tax_payer_classification: tpcLabel.trim() })
        .eq("id", editTarget.id);
      if (error) showToast("Update failed.", "error");
      else { showToast("Record updated!"); fetchRecords(); }
    } else {
      const { error } = await supabase
        .from("tax_payer_classification")
        .insert({ tpc_code: tpcCode, tax_payer_classification: tpcLabel.trim() });
      if (error) showToast("Insert failed.", "error");
      else { showToast("Record added!"); fetchRecords(); }
    }
    setLoading(false);
    setModalOpen(false);
  };

  const handleDelete = async () => {
    setDeleteLoading(true);
    const { error } = await supabase.from("tax_payer_classification").delete().eq("id", deleteTarget.id);
    if (error) showToast("Delete failed.", "error");
    else { showToast("Record deleted!"); fetchRecords(); }
    setDeleteLoading(false);
    setDeleteTarget(null);
  };

  const filtered = records.filter(
    (r) =>
      (r.tpc_code || "").toLowerCase().includes(search.toLowerCase()) ||
      (r.tax_payer_classification || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <CustomerMaintenanceTable
        title="Tax Payer Classification"
        totalCount={records.length}
        search={search}
        onSearchChange={setSearch}
        onAdd={openAdd}
        addLabel="Add Classification"
        columns={[
          { label: "TPC Code", key: "tpc_code", badge: true },
          { label: "Tax Payer Classification", key: "tax_payer_classification" },
        ]}
        rows={filtered}
        onEdit={openEdit}
        onDelete={setDeleteTarget}
        fetching={fetching}
        emptyMessage="No tax payer classifications found."
      />

      <MaintenanceModal
        open={modalOpen}
        title={editTarget ? "Edit Tax Payer Classification" : "Add Tax Payer Classification"}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        loading={loading}
        fields={[
          { label: "TPC Code", value: tpcCode, readOnly: true },
          { label: "Tax Payer Classification", value: tpcLabel, onChange: setTpcLabel, placeholder: "e.g. Individual" },
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

export default TaxPayerClassification;