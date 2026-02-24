import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import CustomerMaintenanceTable, {
  MaintenanceModal,
  DeleteModal,
  Toast,
} from "../Components/customer_maintenance";

const generateNextCode = (existingList) => {
  const prefix = "SOI_";
  let maxNum = 0;
  existingList.forEach((s) => {
    if (s.soi_code?.startsWith(prefix)) {
      const num = parseInt(s.soi_code.replace(prefix, ""), 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }
  });
  return `${prefix}${String(maxNum + 1).padStart(3, "0")}`;
};

const SourceOfIncome = () => {
  const [records, setRecords] = useState([]);
  const [search, setSearch] = useState("");
  const [fetching, setFetching] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [soiCode, setSoiCode] = useState("");
  const [soiLabel, setSoiLabel] = useState("");
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
      .from("source_of_income")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error) setRecords(data || []);
    setFetching(false);
  };

  useEffect(() => { fetchRecords(); }, []);

  const openAdd = () => {
    setEditTarget(null);
    setSoiCode(generateNextCode(records));
    setSoiLabel("");
    setModalOpen(true);
  };

  const openEdit = (row) => {
    setEditTarget(row);
    setSoiCode(row.soi_code || "");
    setSoiLabel(row.source_of_income || "");
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!soiLabel.trim()) return showToast("Source of income is required.", "error");
    setLoading(true);
    if (editTarget) {
      const { error } = await supabase
        .from("source_of_income")
        .update({ source_of_income: soiLabel.trim() })
        .eq("id", editTarget.id);
      if (error) showToast("Update failed.", "error");
      else { showToast("Record updated!"); fetchRecords(); }
    } else {
      const { error } = await supabase
        .from("source_of_income")
        .insert({ soi_code: soiCode, source_of_income: soiLabel.trim() });
      if (error) showToast("Insert failed.", "error");
      else { showToast("Record added!"); fetchRecords(); }
    }
    setLoading(false);
    setModalOpen(false);
  };

  const handleDelete = async () => {
    setDeleteLoading(true);
    const { error } = await supabase.from("source_of_income").delete().eq("id", deleteTarget.id);
    if (error) showToast("Delete failed.", "error");
    else { showToast("Record deleted!"); fetchRecords(); }
    setDeleteLoading(false);
    setDeleteTarget(null);
  };

  const filtered = records.filter(
    (r) =>
      (r.soi_code || "").toLowerCase().includes(search.toLowerCase()) ||
      (r.source_of_income || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <CustomerMaintenanceTable
        title="Source of Income"
        totalCount={records.length}
        search={search}
        onSearchChange={setSearch}
        onAdd={openAdd}
        addLabel="Add Source"
        columns={[
          { label: "SOI Code", key: "soi_code", badge: true },
          { label: "Source of Income", key: "source_of_income" },
        ]}
        rows={filtered}
        onEdit={openEdit}
        onDelete={setDeleteTarget}
        fetching={fetching}
        emptyMessage="No sources of income found."
      />

      <MaintenanceModal
        open={modalOpen}
        title={editTarget ? "Edit Source of Income" : "Add Source of Income"}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        loading={loading}
        fields={[
          { label: "SOI Code", value: soiCode, readOnly: true },
          { label: "Source of Income", value: soiLabel, onChange: setSoiLabel, placeholder: "e.g. Employment" },
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

export default SourceOfIncome;