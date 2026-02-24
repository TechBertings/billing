import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import CustomerMaintenanceTable, {
  MaintenanceModal,
  DeleteModal,
  Toast,
} from "../Components/customer_maintenance";

const generateNextCode = (existingList) => {
  const prefix = "LOB_";
  let maxNum = 0;
  existingList.forEach((s) => {
    if (s.lob_code?.startsWith(prefix)) {
      const num = parseInt(s.lob_code.replace(prefix, ""), 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }
  });
  return `${prefix}${String(maxNum + 1).padStart(3, "0")}`;
};

const LineOfBusiness = () => {
  const [records, setRecords] = useState([]);
  const [search, setSearch] = useState("");
  const [fetching, setFetching] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [lobCode, setLobCode] = useState("");
  const [lobLabel, setLobLabel] = useState("");
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
      .from("line_of_business")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error) setRecords(data || []);
    setFetching(false);
  };

  useEffect(() => { fetchRecords(); }, []);

  const openAdd = () => {
    setEditTarget(null);
    setLobCode(generateNextCode(records));
    setLobLabel("");
    setModalOpen(true);
  };

  const openEdit = (row) => {
    setEditTarget(row);
    setLobCode(row.lob_code || "");
    setLobLabel(row.line_of_business || "");
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!lobLabel.trim()) return showToast("Line of business is required.", "error");
    setLoading(true);
    if (editTarget) {
      const { error } = await supabase
        .from("line_of_business")
        .update({ line_of_business: lobLabel.trim() })
        .eq("id", editTarget.id);
      if (error) showToast("Update failed.", "error");
      else { showToast("Record updated!"); fetchRecords(); }
    } else {
      const { error } = await supabase
        .from("line_of_business")
        .insert({ lob_code: lobCode, line_of_business: lobLabel.trim() });
      if (error) showToast("Insert failed.", "error");
      else { showToast("Record added!"); fetchRecords(); }
    }
    setLoading(false);
    setModalOpen(false);
  };

  const handleDelete = async () => {
    setDeleteLoading(true);
    const { error } = await supabase.from("line_of_business").delete().eq("id", deleteTarget.id);
    if (error) showToast("Delete failed.", "error");
    else { showToast("Record deleted!"); fetchRecords(); }
    setDeleteLoading(false);
    setDeleteTarget(null);
  };

  const filtered = records.filter(
    (r) =>
      (r.lob_code || "").toLowerCase().includes(search.toLowerCase()) ||
      (r.line_of_business || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <CustomerMaintenanceTable
        title="Line of Business"
        totalCount={records.length}
        search={search}
        onSearchChange={setSearch}
        onAdd={openAdd}
        addLabel="Add Line of Business"
        columns={[
          { label: "LOB Code", key: "lob_code", badge: true },
          { label: "Line of Business", key: "line_of_business" },
        ]}
        rows={filtered}
        onEdit={openEdit}
        onDelete={setDeleteTarget}
        fetching={fetching}
        emptyMessage="No lines of business found."
      />

      <MaintenanceModal
        open={modalOpen}
        title={editTarget ? "Edit Line of Business" : "Add Line of Business"}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        loading={loading}
        fields={[
          { label: "LOB Code", value: lobCode, readOnly: true },
          { label: "Line of Business", value: lobLabel, onChange: setLobLabel, placeholder: "e.g. Retail" },
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

export default LineOfBusiness;