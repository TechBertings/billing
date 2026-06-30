import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import CustomerMaintenanceTable, {
  MaintenanceModal,
  DeleteModal,
  Toast,
} from "../components/customer_maintenance";

const generateNextCode = (existingList) => {
  const prefix = "PER_";
  let maxNum = 0;
  existingList.forEach((s) => {
    if (s.period_code?.startsWith(prefix)) {
      const num = parseInt(s.period_code.replace(prefix, ""), 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }
  });
  return `${prefix}${String(maxNum + 1).padStart(3, "0")}`;
};

const Period = () => {
  const [records, setRecords] = useState([]);
  const [search, setSearch] = useState("");
  const [fetching, setFetching] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [periodCode, setPeriodCode] = useState("");
  const [periodLabel, setPeriodLabel] = useState("");
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
      .from("period")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error) setRecords(data || []);
    setFetching(false);
  };

  useEffect(() => { fetchRecords(); }, []);

  const openAdd = () => {
    setEditTarget(null);
    setPeriodCode(generateNextCode(records));
    setPeriodLabel("");
    setModalOpen(true);
  };

  const openEdit = (row) => {
    setEditTarget(row);
    setPeriodCode(row.period_code || "");
    setPeriodLabel(row.period || "");
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!periodLabel.trim()) return showToast("Period is required.", "error");
    setLoading(true);
    if (editTarget) {
      const { error } = await supabase
        .from("period")
        .update({ period: periodLabel.trim() })
        .eq("id", editTarget.id);
      if (error) showToast("Update failed.", "error");
      else { showToast("Record updated!"); fetchRecords(); }
    } else {
      const { error } = await supabase
        .from("period")
        .insert({ period_code: periodCode, period: periodLabel.trim() });
      if (error) showToast("Insert failed.", "error");
      else { showToast("Record added!"); fetchRecords(); }
    }
    setLoading(false);
    setModalOpen(false);
  };

  const handleDelete = async () => {
    setDeleteLoading(true);
    const { error } = await supabase.from("period").delete().eq("id", deleteTarget.id);
    if (error) showToast("Delete failed.", "error");
    else { showToast("Record deleted!"); fetchRecords(); }
    setDeleteLoading(false);
    setDeleteTarget(null);
  };

  const filtered = records.filter(
    (r) =>
      (r.period_code || "").toLowerCase().includes(search.toLowerCase()) ||
      (r.period || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <CustomerMaintenanceTable
        title="Period"
        totalCount={records.length}
        search={search}
        onSearchChange={setSearch}
        onAdd={openAdd}
        addLabel="Add Period"
        columns={[
          { label: "Period Code", key: "period_code", badge: true },
          { label: "Period", key: "period" },
        ]}
        rows={filtered}
        onEdit={openEdit}
        onDelete={setDeleteTarget}
        fetching={fetching}
        emptyMessage="No periods found."
      />

      <MaintenanceModal
        open={modalOpen}
        title={editTarget ? "Edit Period" : "Add Period"}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        loading={loading}
        fields={[
          { label: "Period Code", value: periodCode, readOnly: true },
          { label: "Period", value: periodLabel, onChange: setPeriodLabel, placeholder: "e.g. Monthly, Quarterly, Annual" },
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

export default Period;