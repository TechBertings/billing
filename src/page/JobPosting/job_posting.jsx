import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  FaPlus,
  FaTimes,
  FaSearch,
  FaEdit,
  FaTrash,
  FaTasks,
  FaCheckCircle,
  FaClock,
  FaExclamationTriangle,
  FaExternalLinkAlt,
  FaUser,
  FaCheck,
  FaUndo,
  FaHourglassHalf,
  FaEye,
  FaChevronLeft,
  FaChevronRight,
} from "react-icons/fa";
import Swal from "sweetalert2";
import { supabase, userAPI, notificationAPI } from "../../lib/supabaseClient";
import { setActiveTask } from "../../lib/task_completion";
import { useApprovalPermission } from "../../hooks/approval_permission";

// ─── CONFIG ──────────────────────────────────────────────────────────────────
// Plain monochrome theme: black, white, and gray only
const ACCENT = "#111111";

const TASK_TYPES = [
  { value: "create_billing", label: "Create Billing", page: "CreateBilling" },
  { value: "record_payment", label: "Record Payment", page: "RecordPayment" },
  { value: "undeposited_funds", label: "Undeposited Funds", page: "UndepositedFunds" },
  { value: "other", label: "Other", page: null },
];

const PRIORITIES = [
  { value: "low", label: "Low", cls: "bg-gray-100 text-gray-500 border border-gray-200" },
  { value: "normal", label: "Normal", cls: "bg-white text-gray-700 border border-gray-300" },
  { value: "high", label: "High", cls: "bg-black text-white border border-black" },
];

const STATUSES = [
  { value: "pending", label: "Pending", cls: "bg-white text-gray-600 border border-gray-300" },
  { value: "in_progress", label: "In Progress", cls: "bg-gray-200 text-gray-800 border border-gray-200" },
  { value: "for_review", label: "For Review", cls: "bg-gray-700 text-white border border-gray-700" },
  { value: "done", label: "Done", cls: "bg-black text-white border border-black" },
];

const inputCls =
  "w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:border-black focus:ring-1 focus:ring-gray-300 bg-white transition";
const labelCls = "block text-xs font-medium text-gray-500 mb-1";

// Shared button styles so all buttons share the same height and look
const btnBase =
  "inline-flex items-center justify-center gap-1.5 h-8 px-3 text-[11px] font-semibold rounded-md whitespace-nowrap transition disabled:opacity-40";
const btnPrimary = `${btnBase} text-white bg-black hover:bg-gray-800`;
const btnOutline = `${btnBase} text-gray-800 bg-white border border-gray-300 hover:bg-gray-100`;
const iconBtn =
  "inline-flex items-center justify-center w-8 h-8 text-gray-400 rounded-md hover:text-black hover:bg-gray-100 transition";

const todayStr = () => new Date().toISOString().split("T")[0];

const fmtDate = (d) =>
  d
    ? new Date((d.length > 10 ? d.slice(0, 10) : d) + "T00:00:00").toLocaleDateString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "—";

const clientLabel = (c) =>
  c.business_name || [c.first_name, c.middle_name, c.last_name].filter(Boolean).join(" ") || c.client_id;

const NEEDS_CLIENT = ["create_billing", "record_payment"];
// Auto-completed via page event: manual Mark Done / status changes are not allowed
const AUTO_COMPLETE = ["create_billing", "record_payment"];

const daysLeft = (d) => {
  if (!d) return null;
  const due = new Date(d + "T00:00:00");
  const now = new Date(new Date().toDateString());
  return Math.round((due - now) / 86400000);
};

// completed_at (UTC ISO) → local YYYY-MM-DD, so the comparison with due_date is correct (PH time)
const localDate = (iso) => (iso ? new Date(iso).toLocaleDateString("en-CA") : null);

// Bypass Supabase's 1000-row default limit: fetches in chunks using .range()
// Make sure the query has a deterministic .order() (including a unique column).
const fetchAll = async (buildQuery, pageSize = 1000) => {
  let all = [];
  let from = 0;
  while (true) {
    const { data, error } = await buildQuery().range(from, from + pageSize - 1);
    if (error) return { data: null, error };
    all = all.concat(data || []);
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return { data: all, error: null };
};

const emptyForm = {
  id: null,
  title: "",
  task_type: "create_billing",
  description: "",
  assigned_to: "",
  start_date: todayStr(),
  due_date: "",
  priority: "normal",
  target_client_name: "",
};

const STORAGE_KEYS = ["currentUser", "user", "loggedInUser", "authUser", "dats_user", "session", "auth"];

const readStoredUser = () => {
  if (typeof window === "undefined") return null;
  for (const store of [window.localStorage, window.sessionStorage]) {
    for (const key of STORAGE_KEYS) {
      try {
        const raw = store.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        const u = parsed?.user || parsed;
        if (u && (u.id || u.username || u.full_name || u.fullName)) return u;
      } catch {
        /* ignore bad JSON */
      }
    }
  }
  return null;
};

// ─── SMALL COMPONENTS ────────────────────────────────────────────────────────
const Pill = ({ list, value }) => {
  const m = list.find((x) => x.value === value) || list[0];
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 text-[11px] font-semibold rounded-full whitespace-nowrap ${m.cls}`}
    >
      {m.label}
    </span>
  );
};

const TypeBadge = ({ label }) => (
  <span className="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 border border-gray-200">
    {label}
  </span>
);

const StatBox = ({ icon: Icon, label, value }) => (
  <div className="p-4 bg-white border border-gray-200 rounded-xl">
    <div className="flex items-center gap-2 mb-1">
      <Icon size={12} className="text-gray-500" />
      <span className="text-xs font-medium text-gray-500">{label}</span>
    </div>
    <p className="text-2xl font-bold text-black">{value}</p>
  </div>
);

const DetailRow = ({ label, children }) => (
  <div>
    <p className="mb-1 text-[11px] font-medium text-gray-400">{label}</p>
    <div className="text-sm text-gray-800">{children}</div>
  </div>
);

// ─── MAIN ────────────────────────────────────────────────────────────────────
export default function JobPostingTasks({ currentUser, user, loggedInUser, onNavigate }) {
  const [tab, setTab] = useState("mine");
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [clients, setClients] = useState([]);
  const [showClientDrop, setShowClientDrop] = useState(false);

  // view modal + pagination
  const [viewId, setViewId] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    fetchAll(() =>
      supabase
        .from("client_profile")
        .select("client_id, business_name, first_name, middle_name, last_name")
        .eq("approval_status", "approved")
        .order("business_name")
        .order("client_id")
    ).then(({ data, error }) => {
      if (error) console.error("load clients:", error);
      setClients(data || []);
    });
  }, []);

  const sessionUser = useMemo(
    () => currentUser || user || loggedInUser || readStoredUser(),
    [currentUser, user, loggedInUser]
  );
  const sessionId = sessionUser?.id != null ? String(sessionUser.id) : "";
  const sessionUsername = sessionUser?.username || "";
  const matched = useMemo(
    () =>
      users.find(
        (u) =>
          (sessionId && String(u.id) === sessionId) ||
          (sessionUsername && u.username === sessionUsername)
      ),
    [users, sessionId, sessionUsername]
  );

  const myRole = sessionUser?.role || matched?.role;
  const { canApprove: canAssign } = useApprovalPermission({ role: myRole }, "JobPosting");

  const myId = sessionId || (matched?.id != null ? String(matched.id) : "");
  const me =
    sessionUser?.fullName || sessionUser?.full_name || sessionUser?.name || matched?.full_name || "";

  const isAssignedToMe = useCallback(
    (t) => (t.assigned_to_id ? String(t.assigned_to_id) === myId : t.assigned_to === me),
    [myId, me]
  );
  const isAssignedByMe = useCallback(
    (t) => (t.assigned_by_id ? String(t.assigned_by_id) === myId : t.assigned_by === me),
    [myId, me]
  );

  // ── Load ──────────────────────────────────────────────────────────────────
  const loadTasks = useCallback(async () => {
    if (!me && !myId) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const conds = [];
    if (myId) conds.push(`assigned_to_id.eq."${myId}"`, `assigned_by_id.eq."${myId}"`);
    if (me) conds.push(`assigned_to.eq."${me}"`, `assigned_by.eq."${me}"`);

    const { data, error } = await fetchAll(() =>
      supabase
        .from("tasks")
        .select("*")
        .or(conds.join(","))
        .order("due_date", { ascending: true })
        .order("id", { ascending: true })
    );

    if (!error) setTasks(data || []);
    else console.error("loadTasks:", error);
    setLoading(false);
  }, [me, myId]);

  const loadUsers = useCallback(async () => {
    try {
      const res = await userAPI.getAllUsers();
      setUsers((res.data || []).filter((u) => u.status === "Active"));
    } catch (e) {
      console.error("loadUsers:", e);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const myTasks = useMemo(() => tasks.filter(isAssignedToMe), [tasks, isAssignedToMe]);
  const postedTasks = useMemo(() => tasks.filter(isAssignedByMe), [tasks, isAssignedByMe]);
  const source = tab === "mine" ? myTasks : postedTasks;

  // number of for_review tasks I need to check (for the badge)
  const toReviewCount = useMemo(
    () => postedTasks.filter((t) => t.status === "for_review").length,
    [postedTasks]
  );

  // Per-user tracking (based on tasks I assigned)
  const userStats = useMemo(() => {
    const map = {};
    postedTasks.forEach((t) => {
      const key = t.assigned_to_id || t.assigned_to;
      const s = (map[key] ||= {
        name: t.assigned_to,
        total: 0,
        pending: 0,
        in_progress: 0,
        for_review: 0,
        done: 0,
        overdue: 0,
        onTime: 0,
        submitted: 0,
        turnaroundDays: [],
      });
      s.total++;
      s[t.status] = (s[t.status] || 0) + 1;

      // overdue = not yet submitted and past the due date
      if ((t.status === "pending" || t.status === "in_progress") && daysLeft(t.due_date) < 0) s.overdue++;

      // already submitted (for_review / done)
      if ((t.status === "for_review" || t.status === "done") && t.completed_at) {
        s.submitted++;
        if (localDate(t.completed_at) <= t.due_date) s.onTime++;
        if (t.created_at)
          s.turnaroundDays.push((new Date(t.completed_at) - new Date(t.created_at)) / 86400000);
      }
    });

    return Object.values(map)
      .map((s) => ({
        ...s,
        completionRate: s.total ? Math.round((s.done / s.total) * 100) : 0,
        onTimeRate: s.submitted ? Math.round((s.onTime / s.submitted) * 100) : null,
        avgDays: s.turnaroundDays.length
          ? (s.turnaroundDays.reduce((a, b) => a + b, 0) / s.turnaroundDays.length).toFixed(1)
          : null,
      }))
      .sort((a, b) => b.overdue - a.overdue || a.completionRate - b.completionRate);
  }, [postedTasks]);

  const visible = source.filter((t) => {
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = `${t.title} ${t.description || ""} ${t.assigned_to} ${t.assigned_by}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  // Pagination
  const totalPages = Math.max(1, Math.ceil(visible.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginated = visible.slice((safePage - 1) * pageSize, safePage * pageSize);
  const rangeStart = visible.length ? (safePage - 1) * pageSize + 1 : 0;
  const rangeEnd = Math.min(safePage * pageSize, visible.length);

  useEffect(() => {
    setPage(1);
  }, [tab, search, statusFilter, priorityFilter, pageSize]);

  const viewing = viewId ? tasks.find((t) => t.id === viewId) : null;

  const stats = {
    pending: source.filter((t) => t.status === "pending").length,
    inProgress: source.filter((t) => t.status === "in_progress").length,
    review: source.filter((t) => t.status === "for_review").length,
    done: source.filter((t) => t.status === "done").length,
    overdue: source.filter((t) => t.status !== "done" && daysLeft(t.due_date) < 0).length,
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const notify = async (userId, payload) => {
    try {
      if (!userId) return;
      await notificationAPI.notifyUser(userId, { link: "/dashboard", reference_id: null, ...payload });
    } catch (e) {
      console.error("Notification failed:", e);
    }
  };

  const patchTask = async (task, patch) => {
    const { error: err } = await supabase.from("tasks").update(patch).eq("id", task.id);
    if (err) {
      Swal.fire("Error", err.message, "error");
      return false;
    }
    setTasks((p) => p.map((t) => (t.id === task.id ? { ...t, ...patch } : t)));
    return true;
  };

  // ── Form handlers ─────────────────────────────────────────────────────────
  const openNew = () => {
    setForm({ ...emptyForm, start_date: todayStr() });
    setError("");
    setShowModal(true);
  };

  const openEdit = (t) => {
    setForm({
      id: t.id,
      title: t.title,
      task_type: t.task_type || "other",
      description: t.description || "",
      assigned_to: t.assigned_to,
      start_date: t.start_date || "",
      due_date: t.due_date,
      priority: t.priority || "normal",
      target_client_name: t.target_client_name || "",
      assigned_by: t.assigned_by,
    });
    setError("");
    setShowModal(true);
  };

  const onTypeChange = (value) => {
    const type = TASK_TYPES.find((t) => t.value === value);
    setForm((f) => ({
      ...f,
      task_type: value,
      title:
        !f.title || TASK_TYPES.some((t) => t.label === f.title)
          ? value === "other"
            ? ""
            : type.label
          : f.title,
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError("");
    if (!canAssign) return setError("You don't have permission to assign tasks.");
    if (!form.id && !me) return setError("Cannot identify the logged-in user. Please re-login.");
    if (!form.title.trim()) return setError("Title is required.");
    if (!form.assigned_to) return setError("Please choose who to assign this to.");
    if (!form.due_date) return setError("Due date is required.");

    const needsClient = NEEDS_CLIENT.includes(form.task_type);
    const targetClient = needsClient
      ? clients.find((c) => clientLabel(c) === form.target_client_name)
      : null;
    if (needsClient && !targetClient) return setError("Please select a client from the list.");
    if (form.start_date && form.start_date > form.due_date)
      return setError("Start date cannot be later than the due date.");

    setSaving(true);
    try {
      const target = users.find((u) => u.full_name === form.assigned_to);

      const payload = {
        title: form.title.trim(),
        task_type: form.task_type,
        description: form.description.trim() || null,
        assigned_to: form.assigned_to,
        assigned_to_id: target?.id != null ? String(target.id) : null,
        start_date: form.start_date || null,
        due_date: form.due_date,
        priority: form.priority,
        target_client_id: targetClient?.client_id ?? null,
        target_client_name: targetClient ? clientLabel(targetClient) : null,
      };

      if (form.id) {
        const { error: err } = await supabase.from("tasks").update(payload).eq("id", form.id);
        if (err) throw err;
      } else {
        const { data: created, error: err } = await supabase
          .from("tasks")
          .insert([{ ...payload, assigned_by: me, assigned_by_id: myId || null, status: "pending" }])
          .select("id")
          .single();
        if (err) throw err;

        await notify(target?.id, {
          type: "task_assigned",
          reference_id: created?.id ?? null,
          title: "New task assigned",
          message: `${me} assigned you: ${payload.title} (due ${fmtDate(payload.due_date)})`,
        });
      }

      setShowModal(false);
      await loadTasks();
      Swal.fire({
        icon: "success",
        title: form.id ? "Task updated" : "Task assigned",
        timer: 1600,
        showConfirmButton: false,
      });
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  // ── Workflow actions ──────────────────────────────────────────────────────
  // Assignee: set the status (pending / in_progress only; Done = via review)
  const updateStatus = (task, status) => patchTask(task, { status });

  // Assignee: Open → In Progress + remember the active task for auto-complete
  // (now only used inside the View modal)
  const openTaskPage = async (task) => {
    const type = TASK_TYPES.find((t) => t.value === task.task_type);
    if (!type?.page) return;

    // fetch the full client row so it's ready when the page opens
    let client = null;
    if (task.target_client_id) {
      const { data } = await supabase
        .from("client_profile")
        .select(
          "id, client_id, business_name, trade_name, first_name, middle_name, last_name, registered_business_address, approval_status, email_address"
        )
        .eq("client_id", task.target_client_id)
        .maybeSingle();
      client = data;
    }

    setActiveTask({ ...task, target_client: client });
    if (task.status === "pending") await patchTask(task, { status: "in_progress" });
    onNavigate?.(type.page);
  };

  // Assignee: Mark as done manually (mainly for "Other") → For Review
  const markDone = async (task) => {
    const r = await Swal.fire({
      title: "Submit proof of work",
      html: `
        <p style="font-size:13px;color:#666;margin-bottom:8px">
          Explain what you did or attach a picture/file as proof that the task is done.
        </p>
        <textarea id="proof-text" class="swal2-textarea" placeholder="Explain what you did..."></textarea>
        <input id="proof-file" type="file" class="swal2-file"
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv" />
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonColor: ACCENT,
      confirmButtonText: "Submit for review",
      preConfirm: () => {
        const text = document.getElementById("proof-text").value.trim();
        const file = document.getElementById("proof-file").files[0] || null;
        if (!text && !file) {
          Swal.showValidationMessage("Please explain or attach a picture/file.");
          return false;
        }
        if (file && file.size > 10 * 1024 * 1024) {
          Swal.showValidationMessage("File must be 10MB or smaller.");
          return false;
        }
        return { text, file };
      },
    });
    if (!r.isConfirmed) return;

    const { text, file } = r.value;
    let attachmentUrl = null;
    let attachmentName = null;

    if (file) {
      const path = `${task.id}/${Date.now()}_${file.name.replace(/[^\w.\-]/g, "_")}`;
      const { error: upErr } = await supabase.storage.from("task-attachments").upload(path, file);
      if (upErr) return Swal.fire("Upload failed", upErr.message, "error");
      attachmentUrl = supabase.storage.from("task-attachments").getPublicUrl(path).data.publicUrl;
      attachmentName = file.name;
    }

    const ok = await patchTask(task, {
      status: "for_review",
      completed_at: new Date().toISOString(),
      completed_remarks: text || null,
      completed_attachment_url: attachmentUrl,
      completed_attachment_name: attachmentName,
    });
    if (ok) {
      await notify(task.assigned_by_id, {
        type: "task_for_review",
        reference_id: task.id,
        title: "Task ready for review",
        message: `${me} finished "${task.title}" and is waiting for your review.`,
      });
    }
  };

  // Assigner: Approve → Done
  const approveTask = async (task) => {
    const ok = await patchTask(task, {
      status: "done",
      reviewed_at: new Date().toISOString(),
      review_note: null,
    });
    if (ok) {
      await notify(task.assigned_to_id, {
        type: "task_approved",
        reference_id: task.id,
        title: "Task approved",
        message: `${me} approved your task: ${task.title}`,
      });
      Swal.fire({ icon: "success", title: "Task approved", timer: 1400, showConfirmButton: false });
    }
  };

  // Assigner: Return → In Progress (with a reason)
  const returnTask = async (task) => {
    const r = await Swal.fire({
      title: "Return task?",
      text: "This will be sent back to the assignee. What needs to be fixed?",
      input: "textarea",
      inputPlaceholder: "Reason / what to fix",
      inputValidator: (v) => (!v?.trim() ? "Reason is required" : undefined),
      showCancelButton: true,
      confirmButtonColor: ACCENT,
      confirmButtonText: "Return task",
    });
    if (!r.isConfirmed) return;

    const ok = await patchTask(task, {
      status: "in_progress",
      review_note: r.value.trim(),
      completed_at: null,
      completed_remarks: null,
      completed_attachment_url: null,
      completed_attachment_name: null,
    });
    if (ok) {
      await notify(task.assigned_to_id, {
        type: "task_returned",
        reference_id: task.id,
        title: "Task returned",
        message: `${me} returned "${task.title}": ${r.value.trim()}`,
      });
    }
  };

  const handleDelete = async (task) => {
    const r = await Swal.fire({
      title: "Delete task?",
      text: `"${task.title}" will be permanently removed.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: ACCENT,
      confirmButtonText: "Yes, delete",
    });
    if (!r.isConfirmed) return;
    const { error: err } = await supabase.from("tasks").delete().eq("id", task.id);
    if (err) return Swal.fire("Error", err.message, "error");
    setTasks((p) => p.filter((t) => t.id !== task.id));
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center bg-gray-100 rounded-full w-9 h-9">
            <FaTasks size={14} className="text-black" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-black">Job Posting / Task Assignment</h1>
            <p className="text-xs text-gray-400">Assign work to users — it will appear on their dashboard</p>
          </div>
        </div>
        {canAssign && (
          <button onClick={openNew} className={`${btnPrimary} h-10 px-4 text-sm`}>
            <FaPlus size={11} /> Assign Task
          </button>
        )}
      </div>

      <div className="p-6 space-y-5">
        {/* Tabs */}
        <div className="inline-flex p-1 bg-gray-200 rounded-lg">
          {[
            { k: "mine", label: `My Tasks (${myTasks.length})` },
            { k: "posted", label: `Posted by Me (${postedTasks.length})`, badge: toReviewCount },
            { k: "tracking", label: "Tracking" },
          ].map((t) => (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-md transition ${
                tab === t.k ? "bg-white text-black shadow-sm" : "text-gray-500 hover:text-black"
              }`}
            >
              {t.label}
              {t.badge > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] font-bold text-white bg-black rounded-full">
                  {t.badge} to review
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <StatBox icon={FaClock} label="Pending" value={stats.pending} />
          <StatBox icon={FaTasks} label="In Progress" value={stats.inProgress} />
          <StatBox icon={FaHourglassHalf} label="For Review" value={stats.review} />
          <StatBox icon={FaCheckCircle} label="Done" value={stats.done} />
          <StatBox icon={FaExclamationTriangle} label="Overdue" value={stats.overdue} />
        </div>

        {/* Tracking */}
        {tab === "tracking" && (
          <div className="overflow-x-auto bg-white border border-gray-200 rounded-xl">
            <table className="w-full text-xs">
              <thead className="text-gray-500 bg-gray-50">
                <tr>
                  <th className="px-4 py-3 font-medium text-left">User</th>
                  <th className="px-4 py-3 font-medium text-center">Total</th>
                  <th className="px-4 py-3 font-medium text-center">Pending</th>
                  <th className="px-4 py-3 font-medium text-center">In Progress</th>
                  <th className="px-4 py-3 font-medium text-center">For Review</th>
                  <th className="px-4 py-3 font-medium text-center">Done</th>
                  <th className="px-4 py-3 font-medium text-center">Overdue</th>
                  <th className="px-4 py-3 font-medium text-center">On-time</th>
                  <th className="px-4 py-3 font-medium text-center">Avg days</th>
                  <th className="px-4 py-3 font-medium text-left">Completion</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {userStats.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-10 text-center text-gray-400">
                      No data yet.
                    </td>
                  </tr>
                ) : (
                  userStats.map((s) => (
                    <tr key={s.name} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 font-semibold text-black">{s.name}</td>
                      <td className="px-4 py-3 text-center text-gray-700">{s.total}</td>
                      <td className="px-4 py-3 text-center text-gray-700">{s.pending}</td>
                      <td className="px-4 py-3 text-center text-gray-700">{s.in_progress}</td>
                      <td className="px-4 py-3 text-center text-gray-700">{s.for_review}</td>
                      <td className="px-4 py-3 text-center text-gray-700">{s.done}</td>
                      <td
                        className={`px-4 py-3 text-center ${
                          s.overdue ? "text-black font-bold" : "text-gray-400"
                        }`}
                      >
                        {s.overdue}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-700">
                        {s.onTimeRate === null ? "—" : `${s.onTimeRate}%`}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-700">{s.avgDays ?? "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-1.5 bg-gray-200 rounded-full">
                            <div
                              className="h-1.5 rounded-full"
                              style={{ width: `${s.completionRate}%`, background: ACCENT }}
                            />
                          </div>
                          <span className="text-gray-600">{s.completionRate}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => {
                            setSearch(s.name);
                            setStatusFilter("all");
                            setTab("posted");
                          }}
                          className="text-[11px] font-semibold text-black hover:underline whitespace-nowrap"
                        >
                          View tasks
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {tab !== "tracking" && (
          <>
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3 p-4 bg-white border border-gray-200 rounded-xl">
              <div className="relative flex-1 min-w-[200px]">
                <FaSearch className="absolute text-gray-400 -translate-y-1/2 left-3 top-1/2" size={12} />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search tasks..."
                  className="w-full h-10 pr-3 text-sm border border-gray-300 rounded-md pl-9 focus:outline-none focus:border-black"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-10 px-3 text-sm bg-white border border-gray-300 rounded-md focus:outline-none focus:border-black"
              >
                <option value="all">All Status</option>
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="h-10 px-3 text-sm bg-white border border-gray-300 rounded-md focus:outline-none focus:border-black"
              >
                <option value="all">All Priority</option>
                {PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Task list */}
            <div className="overflow-x-auto bg-white border border-gray-200 rounded-xl">
              <table className="w-full text-xs">
                <thead className="text-gray-500 bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 font-medium text-left">Task</th>
                    <th className="px-4 py-3 font-medium text-left whitespace-nowrap">
                      {tab === "mine" ? "Assigned by" : "Assigned to"}
                    </th>
                    <th className="px-4 py-3 font-medium text-left">Start</th>
                    <th className="px-4 py-3 font-medium text-left">Due</th>
                    <th className="px-4 py-3 font-medium text-left">Priority</th>
                    <th className="px-4 py-3 font-medium text-left">Status</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-gray-400">
                        Loading...
                      </td>
                    </tr>
                  ) : visible.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-gray-400">
                        No tasks found.
                      </td>
                    </tr>
                  ) : (
                    paginated.map((t) => {
                      const d = daysLeft(t.due_date);
                      const overdue = t.status !== "done" && d < 0;
                      const type = TASK_TYPES.find((x) => x.value === t.task_type);
                      const byMe = isAssignedByMe(t);
                      const mine = isAssignedToMe(t);
                      const canWork = mine && (t.status === "pending" || t.status === "in_progress");
                      const isAuto = AUTO_COMPLETE.includes(t.task_type);
                      const canReview = byMe && t.status === "for_review";
                      const canManage = byMe && canAssign;
                      return (
                        <tr
                          key={t.id}
                          onClick={() => setViewId(t.id)}
                          className="align-top border-t border-gray-100 cursor-pointer hover:bg-gray-50"
                        >
                          <td className="px-4 py-3">
                            <p className="text-sm font-semibold text-black">{t.title}</p>
                            {type && t.task_type !== "other" && (
                              <div className="mt-1">
                                <TypeBadge label={type.label} />
                              </div>
                            )}
                            {t.target_client_name && (
                              <p className="mt-1 text-[11px] text-gray-500">Client: {t.target_client_name}</p>
                            )}
                            {t.description && (
                              <p className="max-w-xs mt-1 text-gray-400 line-clamp-2">{t.description}</p>
                            )}
                            {/* Returned note (for the assignee) */}
                            {t.review_note && t.status === "in_progress" && (
                              <p className="max-w-xs mt-1 text-[11px] font-medium text-black">
                                Returned: {t.review_note}
                              </p>
                            )}
                            {/* Completion info (for review / done) */}
                            {(t.status === "for_review" || t.status === "done") && t.completed_at && (
                              <p className="max-w-xs mt-1 text-[11px] text-gray-500">
                                Completed {fmtDate(t.completed_at)}
                                {t.completed_ref_id ? ` · Ref #${t.completed_ref_id}` : ""}
                                {t.completed_remarks ? ` · "${t.completed_remarks}"` : ""}
                              </p>
                            )}
                            {t.completed_attachment_url &&
                              (t.status === "for_review" || t.status === "done") && (
                                <a
                                  href={t.completed_attachment_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-block mt-1 text-[11px] font-semibold text-black hover:underline"
                                >
                                  📎 {t.completed_attachment_name || "View attachment"}
                                </a>
                              )}
                          </td>
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                            <span className="flex items-center gap-1.5">
                              <FaUser size={9} className="text-gray-400" />
                              {tab === "mine" ? t.assigned_by || "—" : t.assigned_to || "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmtDate(t.start_date)}</td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={overdue ? "text-black font-bold" : "text-gray-600"}>
                              {fmtDate(t.due_date)}
                            </span>
                            {t.status !== "done" && d !== null && (
                              <p className={`text-[10px] ${overdue ? "text-black font-semibold" : "text-gray-400"}`}>
                                {d < 0 ? `${Math.abs(d)}d overdue` : d === 0 ? "Due today" : `${d}d left`}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <Pill list={PRIORITIES} value={t.priority} />
                          </td>
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            {canWork && !isAuto ? (
                              <select
                                value={t.status}
                                onChange={(e) => updateStatus(t, e.target.value)}
                                className="h-7 px-2 text-[11px] font-semibold bg-white border border-gray-300 rounded-md focus:outline-none focus:border-black"
                              >
                                <option value="pending">Pending</option>
                                <option value="in_progress">In Progress</option>
                              </select>
                            ) : (
                              <Pill list={STATUSES} value={t.status} />
                            )}
                          </td>
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              {canWork && !isAuto && (
                                <button onClick={() => markDone(t)} className={btnPrimary} title="Submit for review">
                                  <FaCheck size={9} /> Mark as Done
                                </button>
                              )}
                              {canReview && (
                                <>
                                  <button onClick={() => returnTask(t)} className={btnOutline}>
                                    <FaUndo size={9} /> Return
                                  </button>
                                  <button onClick={() => approveTask(t)} className={btnPrimary}>
                                    <FaCheck size={9} /> Approve
                                  </button>
                                </>
                              )}
                              <button onClick={() => setViewId(t.id)} className={iconBtn} title="View details">
                                <FaEye size={13} />
                              </button>
                              {canManage && (
                                <>
                                  <button onClick={() => openEdit(t)} className={iconBtn} title="Edit">
                                    <FaEdit size={12} />
                                  </button>
                                  <button onClick={() => handleDelete(t)} className={iconBtn} title="Delete">
                                    <FaTrash size={11} />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-gray-500">
              <div className="flex items-center gap-2">
                <span>Rows per page</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="h-8 px-2 bg-white border border-gray-300 rounded-md focus:outline-none focus:border-black"
                >
                  {[10, 25, 50, 100].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                <span>
                  {rangeStart}–{rangeEnd} of {visible.length}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button disabled={safePage <= 1} onClick={() => setPage(safePage - 1)} className={btnOutline}>
                  <FaChevronLeft size={9} /> Prev
                </button>
                <span className="px-2 font-medium text-gray-700">
                  Page {safePage} / {totalPages}
                </span>
                <button
                  disabled={safePage >= totalPages}
                  onClick={() => setPage(safePage + 1)}
                  className={btnOutline}
                >
                  Next <FaChevronRight size={9} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* View details modal */}
      {viewing &&
        (() => {
          const t = viewing;
          const type = TASK_TYPES.find((x) => x.value === t.task_type);
          const d = daysLeft(t.due_date);
          const overdue = t.status !== "done" && d < 0;
          const canWork = isAssignedToMe(t) && (t.status === "pending" || t.status === "in_progress");
          const isAuto = AUTO_COMPLETE.includes(t.task_type);
          const isImg = /\.(png|jpe?g|gif|webp)$/i.test(
            t.completed_attachment_name || t.completed_attachment_url || ""
          );

          return (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
              onClick={() => setViewId(null)}
            >
              <div
                className="flex flex-col w-full max-w-2xl max-h-[92vh] bg-white shadow-2xl rounded-xl"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-gray-200">
                  <div>
                    <h2 className="text-base font-semibold text-black">{t.title}</h2>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      {type && t.task_type !== "other" && <TypeBadge label={type.label} />}
                      <Pill list={STATUSES} value={t.status} />
                      <Pill list={PRIORITIES} value={t.priority} />
                    </div>
                  </div>
                  <button onClick={() => setViewId(null)} className="p-1 text-gray-400 hover:text-black">
                    <FaTimes size={14} />
                  </button>
                </div>

                {/* Body (scrollable) */}
                <div className="p-6 space-y-5 overflow-y-auto">
                  {/* Returned note */}
                  {t.review_note && t.status === "in_progress" && (
                    <div className="px-3 py-2 text-sm text-gray-800 bg-gray-50 border-l-4 border-black rounded-md">
                      <p className="text-[11px] font-semibold uppercase text-black">
                        Returned — needs fixes
                      </p>
                      {t.review_note}
                    </div>
                  )}

                  {/* What to do */}
                  <DetailRow label="Instructions / Description">
                    {t.description ? (
                      <p className="whitespace-pre-wrap">{t.description}</p>
                    ) : (
                      <span className="text-gray-400">No description.</span>
                    )}
                  </DetailRow>

                  {t.target_client_name && (
                    <DetailRow label="Client">
                      {t.target_client_name}
                      {t.target_client_id && (
                        <span className="ml-2 font-mono text-[11px] text-gray-400">
                          {t.target_client_id}
                        </span>
                      )}
                    </DetailRow>
                  )}

                  <div className="grid grid-cols-2 gap-5">
                    <DetailRow label="Assigned by">{t.assigned_by || "—"}</DetailRow>
                    <DetailRow label="Assigned to">{t.assigned_to || "—"}</DetailRow>
                    <DetailRow label="Start date">{fmtDate(t.start_date)}</DetailRow>
                    <DetailRow label="Due date">
                      <span className={overdue ? "font-bold text-black" : ""}>{fmtDate(t.due_date)}</span>
                      {t.status !== "done" && d !== null && (
                        <span className={`ml-2 text-[11px] ${overdue ? "text-black font-semibold" : "text-gray-400"}`}>
                          {d < 0 ? `${Math.abs(d)}d overdue` : d === 0 ? "Due today" : `${d}d left`}
                        </span>
                      )}
                    </DetailRow>
                    <DetailRow label="Created">{fmtDate(t.created_at)}</DetailRow>
                    {t.reviewed_at && <DetailRow label="Reviewed">{fmtDate(t.reviewed_at)}</DetailRow>}
                  </div>

                  {/* Completion / proof of work */}
                  {(t.status === "for_review" || t.status === "done") && t.completed_at && (
                    <div className="p-4 space-y-3 border border-gray-200 rounded-lg bg-gray-50">
                      <p className="text-xs font-semibold text-black">Proof of work</p>
                      <DetailRow label="Completed on">
                        {fmtDate(t.completed_at)}
                        {t.completed_ref_id && (
                          <span className="ml-2 font-mono text-[11px] text-gray-500">
                            Ref #{t.completed_ref_id}
                          </span>
                        )}
                      </DetailRow>
                      {t.completed_remarks && (
                        <DetailRow label="Remarks">
                          <p className="whitespace-pre-wrap">{t.completed_remarks}</p>
                        </DetailRow>
                      )}
                      {t.completed_attachment_url && (
                        <DetailRow label="Attachment">
                          {isImg && (
                            <a href={t.completed_attachment_url} target="_blank" rel="noreferrer">
                              <img
                                src={t.completed_attachment_url}
                                alt={t.completed_attachment_name || "attachment"}
                                className="object-contain mb-2 border border-gray-200 rounded-md max-h-64"
                              />
                            </a>
                          )}
                          <a
                            href={t.completed_attachment_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-semibold text-black hover:underline"
                          >
                            📎 {t.completed_attachment_name || "View attachment"}
                          </a>
                        </DetailRow>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer actions */}
                <div className="flex items-center justify-between gap-2 px-6 py-3 border-t border-gray-200">
                  <button onClick={() => setViewId(null)} className={`${btnOutline} h-9 px-4 text-xs`}>
                    Close
                  </button>
                  <div className="flex items-center gap-2">
                    {canWork && TASK_TYPES.find((x) => x.value === t.task_type)?.page && (
                      <button
                        onClick={() => {
                          setViewId(null);
                          openTaskPage(t);
                        }}
                        className={`${btnPrimary} h-9 px-4 text-xs`}
                      >
                        Open {type?.label} <FaExternalLinkAlt size={9} />
                      </button>
                    )}
                    {canWork && !isAuto && (
                      <button
                        onClick={() => {
                          setViewId(null);
                          markDone(t);
                        }}
                        className={`${btnPrimary} h-9 px-4 text-xs`}
                      >
                        <FaCheck size={10} /> Mark as Done
                      </button>
                    )}
                    {isAssignedByMe(t) && t.status === "for_review" && (
                      <>
                        <button
                          onClick={() => {
                            setViewId(null);
                            returnTask(t);
                          }}
                          className={`${btnOutline} h-9 px-4 text-xs`}
                        >
                          <FaUndo size={10} /> Return
                        </button>
                        <button
                          onClick={() => {
                            setViewId(null);
                            approveTask(t);
                          }}
                          className={`${btnPrimary} h-9 px-4 text-xs`}
                        >
                          <FaCheck size={10} /> Approve
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

      {/* Assign / Edit modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <form
            onSubmit={handleSave}
            className="w-full max-w-lg max-h-[92vh] overflow-y-auto bg-white shadow-2xl rounded-xl"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 bg-white border-b border-gray-200">
              <h2 className="text-sm font-semibold text-black">
                {form.id ? "Edit Task" : "Assign New Task"}
              </h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1 text-gray-400 hover:text-black"
              >
                <FaTimes size={14} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {error && (
                <div className="px-3 py-2 text-sm text-gray-800 border-l-4 border-black rounded-md bg-gray-100">
                  {error}
                </div>
              )}

              <div>
                <label className={labelCls}>Assigned by</label>
                <div className="relative">
                  <FaUser className="absolute text-gray-400 -translate-y-1/2 left-3 top-1/2" size={11} />
                  <input
                    type="text"
                    value={form.id ? form.assigned_by || me : me}
                    readOnly
                    placeholder="Loading user..."
                    className={`${inputCls} pl-9 bg-gray-50 text-gray-600 cursor-not-allowed`}
                  />
                </div>
              </div>

              <div>
                <label className={labelCls}>Job Type</label>
                <select
                  value={form.task_type}
                  onChange={(e) => onTypeChange(e.target.value)}
                  className={inputCls}
                >
                  {TASK_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelCls}>
                  {form.task_type === "other" ? "Other (please specify) *" : "Title *"}
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder={
                    form.task_type === "other"
                      ? "Please specify the task..."
                      : "e.g. Create SOA for ABC Corp — October"
                  }
                  className={inputCls}
                />
              </div>

              {NEEDS_CLIENT.includes(form.task_type) && (
                <div className="relative">
                  <label className={labelCls}>Client *</label>
                  <input
                    value={form.target_client_name}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, target_client_name: e.target.value }));
                      setShowClientDrop(true);
                    }}
                    onFocus={() => setShowClientDrop(true)}
                    onBlur={() => setTimeout(() => setShowClientDrop(false), 150)}
                    placeholder="Search client..."
                    className={inputCls}
                    autoComplete="off"
                  />
                  {showClientDrop && (
                    <div className="absolute left-0 right-0 z-50 mt-1 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg max-h-56">
                      {clients
                        .filter((c) =>
                          clientLabel(c)
                            .toLowerCase()
                            .includes((form.target_client_name || "").toLowerCase())
                        )
                        .slice(0, 20)
                        .map((c) => (
                          <button
                            type="button"
                            key={c.client_id}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setForm((f) => ({ ...f, target_client_name: clientLabel(c) }));
                              setShowClientDrop(false);
                            }}
                            className="w-full px-3 py-2 text-left border-b border-gray-100 hover:bg-gray-100 last:border-0"
                          >
                            <p className="text-sm text-gray-800">{clientLabel(c)}</p>
                            <p className="font-mono text-[10px] text-gray-400">{c.client_id}</p>
                          </button>
                        ))}
                      {clients.length === 0 && (
                        <p className="px-3 py-3 text-sm text-gray-400">No approved clients found</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className={labelCls}>Description</label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Details / instructions..."
                  className={`${inputCls} resize-none`}
                />
              </div>

              <div>
                <label className={labelCls}>Assign to *</label>
                <select
                  value={form.assigned_to}
                  onChange={(e) => setForm((f) => ({ ...f, assigned_to: e.target.value }))}
                  className={inputCls}
                >
                  <option value="">Select user...</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.full_name}>
                      {u.full_name} — {u.role}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Start Date</label>
                  <input
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Due Date *</label>
                  <input
                    type="date"
                    value={form.due_date}
                    min={form.start_date || undefined}
                    onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label className={labelCls}>Priority</label>
                <div className="flex gap-2">
                  {PRIORITIES.map((p) => (
                    <button
                      type="button"
                      key={p.value}
                      onClick={() => setForm((f) => ({ ...f, priority: p.value }))}
                      className={`flex-1 py-2 text-xs font-semibold rounded-md border transition ${
                        form.priority === p.value
                          ? "border-black bg-black text-white"
                          : "border-gray-300 text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-3 border-t border-gray-200">
                <button type="button" onClick={() => setShowModal(false)} className={`${btnOutline} flex-1 h-10 text-sm`}>
                  Cancel
                </button>
                <button type="submit" disabled={saving} className={`${btnPrimary} flex-1 h-10 text-sm`}>
                  {saving ? "Saving..." : form.id ? "Update Task" : "Assign Task"}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}