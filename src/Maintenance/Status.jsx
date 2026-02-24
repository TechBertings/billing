import React, { useState, useEffect } from "react";
import { CheckCircle } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import CustomerMaintenanceTable, {
  MaintenanceModal,
  DeleteModal,
  Toast,
} from "../Components/customer_maintenance";

// ─── Auto-generate next stat_code ────────────────────────────────────
const generateNextCode = (existingList) => {
  const prefix = "STS_";
  let maxNum = 0;
  existingList.forEach((s) => {
    if (s.stat_code?.startsWith(prefix)) {
      const num = parseInt(s.stat_code.replace(prefix, ""), 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }
  });
  return `${prefix}${String(maxNum + 1).padStart(3, "0")}`;
};

const Status = () => {
  const [statuses, setStatuses] = useState([]);
  const [search, setSearch] = useState("");
  const [fetching, setFetching] = useState(true);

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [statCode, setStatCode] = useState("");
  const [statusLabel, setStatusLabel] = useState("");
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
  const fetchStatuses = async () => {
    setFetching(true);
    const { data, error } = await supabase
      .from("status")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error) setStatuses(data || []);
    setFetching(false);
  };

  useEffect(() => { fetchStatuses(); }, []);

  // ── Open Add ──
  const openAdd = () => {
    setEditTarget(null);
    setStatCode(generateNextCode(statuses));
    setStatusLabel("");
    setModalOpen(true);
  };

  // ── Open Edit ──
  const openEdit = (row) => {
    setEditTarget(row);
    setStatCode(row.stat_code || "");
    setStatusLabel(row.status || "");
    setModalOpen(true);
  };

  // ── Submit ──
  const handleSubmit = async () => {
    if (!statusLabel.trim()) return showToast("Status label is required.", "error");
    setLoading(true);
    if (editTarget) {
      const { error } = await supabase
        .from("status")
        .update({ status: statusLabel.trim() })
        .eq("id", editTarget.id);
      if (error) showToast("Update failed.", "error");
      else { showToast("Status updated!"); fetchStatuses(); }
    } else {
      const { error } = await supabase
        .from("status")
        .insert({ stat_code: statCode, status: statusLabel.trim() });
      if (error) showToast("Insert failed.", "error");
      else { showToast("Status added!"); fetchStatuses(); }
    }
    setLoading(false);
    setModalOpen(false);
  };

  // ── Delete ──
  const handleDelete = async () => {
    setDeleteLoading(true);
    const { error } = await supabase.from("status").delete().eq("id", deleteTarget.id);
    if (error) showToast("Delete failed.", "error");
    else { showToast("Status deleted!"); fetchStatuses(); }
    setDeleteLoading(false);
    setDeleteTarget(null);
  };

  // ── Filter ──
  const filtered = statuses.filter(
    (s) =>
      (s.stat_code || "").toLowerCase().includes(search.toLowerCase()) ||
      (s.status || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <CustomerMaintenanceTable
        title="Status"
        icon={<CheckCircle size={22} className="text-green-600" />}
        totalCount={statuses.length}
        search={search}
        onSearchChange={setSearch}
        onAdd={openAdd}
        addLabel="Add Status"
        columns={[
          { label: "Status Code", key: "stat_code", badge: true },
          { label: "Status Label", key: "status" },
        ]}
        rows={filtered}
        onEdit={openEdit}
        onDelete={setDeleteTarget}
        fetching={fetching}
        emptyMessage="No statuses found."
      />

      <MaintenanceModal
        open={modalOpen}
        title={editTarget ? "Edit Status" : "Add Status"}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        loading={loading}
        fields={[
          { label: "Status Code", value: statCode, readOnly: true },
          { label: "Status Label", value: statusLabel, onChange: setStatusLabel, placeholder: "e.g. Active" },
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

export default Status;