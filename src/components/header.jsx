import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  FaBars,
  FaBell,
  FaSearch,
  FaCheck,
  FaTimes,
  FaFileInvoiceDollar,
  FaCheckCircle,
  FaPaperPlane,
  FaRegFileAlt,
  FaExternalLinkAlt,
  FaTasks,
  FaHourglassHalf,
  FaUndo,
} from "react-icons/fa";
import { supabase, notificationAPI } from "../lib/supabaseClient";

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const timeAgo = (date) => {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return "Just now";
  if (s < 3600) return `${Math.floor(s / 60)} mins ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} hr ago`;
  return `${Math.floor(s / 86400)} day(s) ago`;
};

const peso = (n) =>
  "₱" +
  Number(n || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// Handles both date-only (YYYY-MM-DD) and full ISO timestamps
const fmtDate = (d) =>
  d
    ? new Date(d.length === 10 ? d + "T00:00:00" : d).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "—";

const fmtPeriod = (p) => {
  if (!p) return "—";
  const m = /^(\d{4})-(\d{2})$/.exec(p);
  if (!m) return p;
  return new Date(Number(m[1]), Number(m[2]) - 1, 1).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
  });
};

const daysLeft = (d) => {
  if (!d) return null;
  const due = new Date(d.slice(0, 10) + "T00:00:00");
  const now = new Date(new Date().toDateString());
  return Math.round((due - now) / 86400000);
};

// Plain monochrome: icon per notification type only
const typeIcons = {
  billing_pending_approval: FaFileInvoiceDollar,
  billing_submitted: FaPaperPlane,
  billing_approved: FaCheckCircle,
  billing_draft: FaRegFileAlt,
  task_assigned: FaTasks,
  task_for_review: FaHourglassHalf,
  task_approved: FaCheckCircle,
  task_returned: FaUndo,
};
const getIcon = (type) => typeIcons[type] || FaBell;

const pill = {
  light: "bg-white text-gray-600 border border-gray-300",
  mid: "bg-gray-200 text-gray-800 border border-gray-200",
  dark: "bg-gray-700 text-white border border-gray-700",
  black: "bg-black text-white border border-black",
};

const billingStatus = {
  draft: { label: "Draft", cls: pill.light },
  pending_approval: { label: "Pending Approval", cls: pill.mid },
  approved: { label: "Approved", cls: pill.black },
  unpaid: { label: "Unpaid", cls: pill.dark },
};

const taskStatus = {
  pending: { label: "Pending", cls: pill.light },
  in_progress: { label: "In Progress", cls: pill.mid },
  for_review: { label: "For Review", cls: pill.dark },
  done: { label: "Done", cls: pill.black },
};

const taskPriority = {
  low: { label: "Low", cls: "bg-gray-100 text-gray-500 border border-gray-200" },
  normal: { label: "Normal", cls: pill.light },
  high: { label: "High", cls: pill.black },
};

const taskTypeLabels = {
  create_billing: "Create Billing",
  record_payment: "Record Payment",
  undeposited_funds: "Undeposited Funds",
  other: "Other",
};

const isTaskNotif = (n) => String(n?.type || "").startsWith("task");
const isBillingNotif = (n) => String(n?.type || "").startsWith("billing");

// Older task notifications were saved without a reference_id.
// Recover the task title from the message text so we can still look it up.
const titleFromMessage = (n) => {
  const m = String(n?.message || "");
  const patterns = [
    /assigned you: (.+) \(due /,
    /approved your task: (.+)$/,
    /finished "(.+)" and is waiting/,
    /returned "(.+)": /,
  ];
  for (const re of patterns) {
    const hit = re.exec(m);
    if (hit) return hit[1];
  }
  return null;
};

const Pill = ({ meta }) => (
  <span className={`inline-flex items-center px-2.5 py-0.5 text-[11px] font-semibold rounded-full whitespace-nowrap ${meta.cls}`}>
    {meta.label}
  </span>
);

// Simple label / value row used in both modals
const Row = ({ label, children }) => (
  <div className="grid grid-cols-3 gap-4 py-2.5 border-b border-gray-100 last:border-0">
    <dt className="text-xs text-gray-400">{label}</dt>
    <dd className="col-span-2 text-sm text-gray-800">{children}</dd>
  </div>
);

const Avatar = ({ user, size = "w-8 h-8", text = "text-xs" }) => {
  const name = user?.full_name || user?.fullName || "U";
  return user?.image_url ? (
    <img src={user.image_url} alt={name} className={`object-cover rounded-full ${size}`} />
  ) : (
    <div className={`flex items-center justify-center font-semibold text-white bg-black rounded-full ${size} ${text}`}>
      {name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
    </div>
  );
};

// ─── COMPONENT ───────────────────────────────────────────────────────────────
const Header = ({ toggleSidebar, user, onLogout, onNotificationClick }) => {
  const [showNotif, setShowNotif] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [ringing, setRinging] = useState(false);
  const [toast, setToast] = useState(null);

  // Detail modal
  const [detailNotif, setDetailNotif] = useState(null);
  // { kind: "billing", bill, items, creator } | { kind: "task", task }
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  const notifRef = useRef(null);
  const profileRef = useRef(null);
  const toastTimer = useRef(null);
  const ringTimer = useRef(null);

  const displayName = user?.full_name || user?.fullName || "User";
  const unreadCount = notifications.filter((n) => !n.read).length;

  const loadNotifications = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await notificationAPI.getByUser(user.id);
    if (data) setNotifications(data);
  }, [user?.id]);

  // Initial load + realtime
  useEffect(() => {
    if (!user?.id) return;
    loadNotifications();

    const channel = supabase
      .channel(`notif-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const n = payload.new;
          setNotifications((prev) => [n, ...prev]);

          // Bell ring
          setRinging(true);
          clearTimeout(ringTimer.current);
          ringTimer.current = setTimeout(() => setRinging(false), 1500);

          // Toast popup
          setToast(n);
          clearTimeout(toastTimer.current);
          toastTimer.current = setTimeout(() => setToast(null), 5000);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      clearTimeout(toastTimer.current);
      clearTimeout(ringTimer.current);
    };
  }, [user?.id, loadNotifications]);

  // Click outside
  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotif(false);
      if (profileRef.current && !profileRef.current.contains(e.target)) setShowProfile(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Escape closes the modal
  useEffect(() => {
    if (!detailNotif) return;
    const onKey = (e) => e.key === "Escape" && closeDetail();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [detailNotif]);

  const loadTaskDetail = async (n) => {
    let task = null;

    if (n.reference_id) {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("id", n.reference_id)
        .maybeSingle();
      if (error) throw error;
      task = data;
    } else {
      // Fallback for old notifications: match by title among my tasks
      const title = titleFromMessage(n);
      if (title && user?.id) {
        const { data, error } = await supabase
          .from("tasks")
          .select("*")
          .eq("title", title)
          .or(`assigned_to_id.eq."${user.id}",assigned_by_id.eq."${user.id}"`)
          .order("created_at", { ascending: false })
          .limit(1);
        if (error) throw error;
        task = data?.[0] || null;
      }
    }

    if (!task) throw new Error("not found");
    setDetail({ kind: "task", task });
  };

  const loadBillingDetail = async (n) => {
    const { data: bill, error } = await supabase
      .from("billing_statements")
      .select("*")
      .eq("id", n.reference_id)
      .single();
    if (error) throw error;

    const { data: items } = await supabase
      .from("billing_items")
      .select("*")
      .eq("billing_id", bill.id);

    let creator = null;
    if (bill.created_by) {
      const { data: u } = await supabase
        .from("users")
        .select("full_name, role")
        .eq("id", bill.created_by)
        .single();
      creator = u || null;
    }

    setDetail({ kind: "billing", bill, items: items || [], creator });
  };

  const loadDetail = async (n) => {
    setDetail(null);
    setDetailError("");

    const task = isTaskNotif(n);
    const billing = isBillingNotif(n) && n.reference_id;
    if (!task && !billing) return;

    setDetailLoading(true);
    try {
      if (task) await loadTaskDetail(n);
      else await loadBillingDetail(n);
    } catch (err) {
      setDetailError(
        task
          ? "Unable to load the task details. It may have been deleted."
          : "Unable to load the details. The billing may have been deleted."
      );
    } finally {
      setDetailLoading(false);
    }
  };

  const openDetail = async (n) => {
    if (!n.read) {
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      notificationAPI.markAsRead(n.id);
    }
    setShowNotif(false);
    setToast(null);
    setDetailNotif(n);
    loadDetail(n);
  };

  const closeDetail = () => {
    setDetailNotif(null);
    setDetail(null);
    setDetailError("");
  };

  const goToPage = () => {
    const n = detailNotif;
    closeDetail();
    onNotificationClick?.(n);
  };

  const markAllAsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await notificationAPI.markAllAsRead(user.id);
  };

  // Billing totals
  const isBilling = detail?.kind === "billing";
  const subtotal = isBilling ? detail.items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0) : 0;
  const dp = isBilling ? parseFloat(detail.bill.down_payment) || 0 : 0;
  const wht = isBilling ? parseFloat(detail.bill.withholding_tax) || 0 : 0;
  const totalDue = subtotal - dp - wht;

  // ── Task detail body ──
  const renderTask = (t) => {
    const d = daysLeft(t.due_date);
    const overdue = t.status !== "done" && d !== null && d < 0;
    const showProof = (t.status === "for_review" || t.status === "done") && t.completed_at;
    const isImg = /\.(png|jpe?g|gif|webp)$/i.test(t.completed_attachment_name || t.completed_attachment_url || "");
    const typeLabel = t.task_type && t.task_type !== "other" ? taskTypeLabels[t.task_type] : null;

    return (
      <div className="space-y-5">
        <div>
          <h3 className="text-lg font-semibold text-black">{t.title}</h3>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <Pill meta={taskStatus[t.status] || taskStatus.pending} />
            <Pill meta={taskPriority[t.priority] || taskPriority.normal} />
            {typeLabel && (
              <span className="px-2 py-0.5 text-[11px] font-semibold text-gray-700 bg-gray-100 border border-gray-200 rounded">
                {typeLabel}
              </span>
            )}
          </div>
        </div>

        {t.review_note && t.status === "in_progress" && (
          <div className="px-3 py-2 text-sm text-gray-800 border-l-4 border-black rounded-md bg-gray-50">
            <p className="text-[11px] font-semibold text-black uppercase">Returned — needs fixes</p>
            {t.review_note}
          </div>
        )}

        <div>
          <p className="mb-1 text-xs text-gray-400">Description</p>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">
            {t.description || <span className="text-gray-400">No description.</span>}
          </p>
        </div>

        <dl>
          {t.target_client_name && <Row label="Client">{t.target_client_name}</Row>}
          <Row label="Assigned by">{t.assigned_by || "—"}</Row>
          <Row label="Assigned to">{t.assigned_to || "—"}</Row>
          <Row label="Start date">{fmtDate(t.start_date)}</Row>
          <Row label="Due date">
            <span className={overdue ? "font-bold text-black" : ""}>{fmtDate(t.due_date)}</span>
            {t.status !== "done" && d !== null && (
              <span className={`ml-2 text-[11px] ${overdue ? "font-semibold text-black" : "text-gray-400"}`}>
                {d < 0 ? `${Math.abs(d)}d overdue` : d === 0 ? "Due today" : `${d}d left`}
              </span>
            )}
          </Row>
        </dl>

        {showProof && (
          <div className="p-4 border border-gray-200 rounded-lg">
            <p className="mb-1 text-xs font-semibold text-black">Proof of work</p>
            <dl>
              <Row label="Completed">
                {fmtDate(t.completed_at)}
                {t.completed_ref_id && (
                  <span className="ml-2 font-mono text-[11px] text-gray-500">Ref #{t.completed_ref_id}</span>
                )}
              </Row>
              {t.completed_remarks && (
                <Row label="Remarks">
                  <p className="whitespace-pre-wrap">{t.completed_remarks}</p>
                </Row>
              )}
              {t.completed_attachment_url && (
                <Row label="Attachment">
                  {isImg && (
                    <a href={t.completed_attachment_url} target="_blank" rel="noreferrer">
                      <img
                        src={t.completed_attachment_url}
                        alt={t.completed_attachment_name || "attachment"}
                        className="object-contain mb-2 border border-gray-200 rounded-md max-h-56"
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
                </Row>
              )}
            </dl>
          </div>
        )}
      </div>
    );
  };

  // ── Billing detail body ──
  const renderBilling = ({ bill, items, creator }) => (
    <div className="space-y-5">
      <dl>
        <Row label="SOA Number">
          <span className="font-mono font-semibold">{bill.soa_number}</span>
        </Row>
        <Row label="Status">
          <Pill meta={billingStatus[bill.status] || billingStatus.draft} />
        </Row>
        <Row label="Bill To">
          <p className="font-medium">{bill.bill_to}</p>
          {bill.address && <p className="text-xs text-gray-500">{bill.address}</p>}
        </Row>
        <Row label="SOA Date">{fmtDate(bill.soa_date)}</Row>
        <Row label="Due Date">{fmtDate(bill.due_date)}</Row>
        <Row label="Created by">
          {creator?.full_name || "—"}
          {creator?.role && <span className="ml-2 text-[11px] text-gray-400">{creator.role}</span>}
        </Row>
        <Row label="Approved by">
          {bill.approved_by || "—"}
          {bill.approved_at && (
            <span className="ml-2 text-[11px] text-gray-400">{fmtDate(bill.approved_at)}</span>
          )}
        </Row>
      </dl>

      <div>
        <p className="mb-2 text-xs font-semibold text-gray-500">Billing Items ({items.length})</p>
        <div className="overflow-hidden border border-gray-200 rounded-lg">
          <table className="w-full text-xs">
            <thead className="text-gray-500 bg-gray-50">
              <tr>
                <th className="px-3 py-2 font-medium text-left">Code</th>
                <th className="px-3 py-2 font-medium text-left">Description</th>
                <th className="px-3 py-2 font-medium text-left">Period</th>
                <th className="px-3 py-2 font-medium text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-gray-400">
                    No items
                  </td>
                </tr>
              ) : (
                items.map((it, i) => (
                  <tr key={it.id || i} className="border-t border-gray-100">
                    <td className="px-3 py-2 font-mono text-gray-500">{it.account_code || "—"}</td>
                    <td className="px-3 py-2 text-gray-700">
                      {it.description}
                      {it.agency && <span className="block text-[10px] text-gray-400">{it.agency}</span>}
                    </td>
                    <td className="px-3 py-2 text-gray-500">{fmtPeriod(it.period_covered)}</td>
                    <td className="px-3 py-2 font-mono text-right text-gray-700">{peso(it.amount)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="ml-auto space-y-1.5 text-sm w-full max-w-xs">
        <div className="flex justify-between">
          <span className="text-gray-500">Subtotal</span>
          <span className="font-mono text-gray-800">{peso(subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Less: Down Payment</span>
          <span className="font-mono text-gray-800">{peso(dp)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Less: Withholding Tax</span>
          <span className="font-mono text-gray-800">{peso(wht)}</span>
        </div>
        <div className="flex justify-between pt-2 border-t border-gray-200">
          <span className="font-semibold text-black">Total Amount Due</span>
          <span className="font-mono text-base font-bold text-black">{peso(totalDue)}</span>
        </div>
      </div>
    </div>
  );

  const DetailIcon = detailNotif ? getIcon(detailNotif.type) : FaBell;

  return (
    <>
      <style>{`
        @keyframes bellRing {
          0%, 100% { transform: rotate(0); }
          15% { transform: rotate(18deg); }
          30% { transform: rotate(-16deg); }
          45% { transform: rotate(12deg); }
          60% { transform: rotate(-8deg); }
          75% { transform: rotate(4deg); }
        }
        @keyframes badgePop {
          0% { transform: scale(0); }
          60% { transform: scale(1.35); }
          100% { transform: scale(1); }
        }
        @keyframes pingDot {
          0% { transform: scale(1); opacity: .7; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        @keyframes dropIn {
          from { opacity: 0; transform: translateY(-8px) scale(.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes toastIn {
          from { opacity: 0; transform: translateX(40px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes modalIn {
          from { opacity: 0; transform: translateY(16px) scale(.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes itemIn {
          from { opacity: 0; transform: translateX(-8px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes shrinkBar { from { width: 100%; } to { width: 0%; } }
        .anim-bell { animation: bellRing 1.2s ease-in-out; transform-origin: top center; }
        .anim-badge { animation: badgePop .35s ease-out; }
        .anim-ping { animation: pingDot 1.4s ease-out infinite; }
        .anim-drop { animation: dropIn .18s ease-out; transform-origin: top right; }
        .anim-toast { animation: toastIn .3s ease-out; }
        .anim-fade { animation: fadeIn .2s ease-out; }
        .anim-modal { animation: modalIn .25s ease-out; }
        .anim-item { animation: itemIn .25s ease-out both; }
        .anim-bar { animation: shrinkBar 5s linear forwards; }
      `}</style>

      <header className="fixed top-0 left-0 right-0 z-30 flex items-center h-16 px-6 text-gray-700 bg-white border-b border-gray-200">
        <button
          onClick={toggleSidebar}
          className="p-2 mr-6 text-lg text-gray-400 transition-colors duration-150 rounded-lg hover:bg-gray-100 hover:text-black"
        >
          <FaBars />
        </button>

        <div className="flex items-center gap-2.5">
          <img src="/DATS_LOGO.png" alt="DATS" className="object-contain w-8 h-8" />
          <h1 className="text-base font-semibold text-black">DATS</h1>
        </div>

        <div className="items-center flex-1 hidden max-w-md ml-8 md:flex">
          <div className="relative w-full">
            <FaSearch className="absolute text-xs text-gray-400 -translate-y-1/2 left-3 top-1/2" />
            <input
              type="text"
              placeholder="Search invoices, customers..."
              className="w-full py-2 pr-4 text-sm text-gray-700 placeholder-gray-400 transition-colors border border-gray-200 rounded-lg pl-9 bg-gray-50 focus:outline-none focus:border-black focus:bg-white"
            />
          </div>
        </div>

        <div className="flex items-center gap-1 ml-auto">
          {/* Notifications */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => {
                setShowNotif((v) => !v);
                setShowProfile(false);
              }}
              className="relative p-2.5 hover:bg-gray-100 rounded-lg transition-colors duration-150"
            >
              <FaBell
                className={`text-base transition-colors ${
                  unreadCount > 0 ? "text-black" : "text-gray-400"
                } ${ringing ? "anim-bell" : ""}`}
              />
              {unreadCount > 0 && (
                <>
                  <span className="absolute top-1 right-1 min-w-[16px] h-4 rounded-full bg-black anim-ping" />
                  <span
                    key={unreadCount}
                    className="absolute top-1 right-1 flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] font-semibold text-white rounded-full bg-black anim-badge"
                  >
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                </>
              )}
            </button>

            {showNotif && (
              <div className="absolute right-0 mt-2 overflow-hidden bg-white border border-gray-200 shadow-xl w-96 rounded-xl anim-drop">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                  <h3 className="text-sm font-semibold text-black">Notifications</h3>
                  {unreadCount > 0 && (
                    <button onClick={markAllAsRead} className="text-xs font-medium text-gray-600 hover:text-black hover:underline">
                      Mark all as read
                    </button>
                  )}
                </div>

                <div className="overflow-y-auto max-h-96">
                  {notifications.length === 0 ? (
                    <div className="px-4 py-10 text-center">
                      <FaBell className="mx-auto mb-2 text-2xl text-gray-200" />
                      <p className="text-sm text-gray-400">No notifications</p>
                    </div>
                  ) : (
                    notifications.map((n, i) => {
                      const Icon = getIcon(n.type);
                      return (
                        <button
                          key={n.id}
                          onClick={() => openDetail(n)}
                          style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}
                          className={`anim-item flex items-start w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 border-b border-gray-100 last:border-0 ${
                            n.read ? "" : "bg-gray-50"
                          }`}
                        >
                          <span className="flex items-center justify-center text-gray-700 bg-gray-100 rounded-full w-9 h-9 shrink-0">
                            <Icon size={14} />
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm text-black ${n.read ? "font-normal" : "font-semibold"}`}>
                              {n.title}
                            </p>
                            {n.message && <p className="text-xs text-gray-500 line-clamp-2">{n.message}</p>}
                            <p className={`mt-0.5 text-[11px] ${n.read ? "text-gray-400" : "text-gray-700 font-medium"}`}>
                              {timeAgo(n.created_at)}
                            </p>
                          </div>
                          {!n.read ? (
                            <span className="w-2.5 h-2.5 mt-2 bg-black rounded-full shrink-0" />
                          ) : (
                            <FaCheck className="mt-2 text-xs text-gray-300 shrink-0" />
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="w-px h-6 mx-2 bg-gray-200" />

          {/* Profile */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => {
                setShowProfile((v) => !v);
                setShowNotif(false);
              }}
              className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-100 transition-colors duration-150"
            >
              <Avatar user={user} />
              <div className="hidden text-left md:block">
                <p className="text-sm font-medium leading-tight text-black">{displayName}</p>
                <p className="text-[11px] leading-tight text-gray-400">{user?.role}</p>
              </div>
            </button>

            {showProfile && (
              <div className="absolute right-0 w-56 mt-2 bg-white border border-gray-200 shadow-lg rounded-xl anim-drop">
                <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200">
                  <Avatar user={user} size="w-10 h-10" text="text-sm" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-black truncate">{displayName}</p>
                    <p className="text-xs text-gray-400 truncate">{user?.email}</p>
                    <p className="text-[11px] font-medium text-gray-600">{user?.role}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowProfile(false);
                    onLogout?.();
                  }}
                  className="w-full px-4 py-2.5 text-sm text-left text-gray-600 hover:bg-gray-100 rounded-b-xl"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ───────── Toast popup (new notification) ───────── */}
      {toast && (
        <div className="fixed z-50 top-20 right-6 anim-toast">
          <button
            onClick={() => openDetail(toast)}
            className="relative block overflow-hidden text-left bg-white border border-gray-200 shadow-2xl w-80 rounded-xl"
          >
            <div className="flex items-start gap-3 p-3.5">
              {(() => {
                const Icon = getIcon(toast.type);
                return (
                  <span className="flex items-center justify-center text-gray-700 bg-gray-100 rounded-full w-9 h-9 shrink-0">
                    <Icon size={14} />
                  </span>
                );
              })()}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-black">{toast.title}</p>
                {toast.message && <p className="text-xs text-gray-500 line-clamp-2">{toast.message}</p>}
                <p className="mt-1 text-[11px] font-medium text-gray-700">Click to view details</p>
              </div>
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  setToast(null);
                }}
                className="p-1 text-gray-300 hover:text-black"
              >
                <FaTimes size={11} />
              </span>
            </div>
            <div className="h-0.5 bg-black anim-bar" key={toast.id} />
          </button>
        </div>
      )}

      {/* ───────── Detail modal (billing + task) ───────── */}
      {detailNotif && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 anim-fade"
          onClick={(e) => e.target === e.currentTarget && closeDetail()}
        >
          <div className="w-full max-w-xl bg-white shadow-2xl rounded-xl max-h-[90vh] flex flex-col overflow-hidden anim-modal">
            {/* Top */}
            <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-gray-200">
              <div className="flex items-start gap-3">
                <span className="flex items-center justify-center text-gray-700 bg-gray-100 rounded-full w-9 h-9 shrink-0">
                  <DetailIcon size={14} />
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-black">{detailNotif.title}</h2>
                  <p className="text-xs text-gray-500">{detailNotif.message}</p>
                  <p className="mt-0.5 text-[11px] text-gray-400">{timeAgo(detailNotif.created_at)}</p>
                </div>
              </div>
              <button onClick={closeDetail} className="p-1.5 text-gray-400 rounded-lg hover:bg-gray-100 hover:text-black">
                <FaTimes size={14} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 px-6 py-5 overflow-y-auto">
              {detailLoading && (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-2 border-black rounded-full border-t-transparent animate-spin" />
                </div>
              )}

              {!detailLoading && detailError && (
                <p className="py-10 text-sm text-center text-gray-400">{detailError}</p>
              )}

              {!detailLoading && !detailError && !detail && (
                <p className="py-10 text-sm text-center text-gray-400">
                  No additional details for this notification.
                </p>
              )}

              {!detailLoading && detail?.kind === "task" && renderTask(detail.task)}
              {!detailLoading && detail?.kind === "billing" && renderBilling(detail)}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-2 px-6 py-3 border-t border-gray-200">
              <button
                onClick={closeDetail}
                className="h-9 px-4 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-100"
              >
                Close
              </button>
              <button
                onClick={goToPage}
                className="inline-flex items-center gap-2 h-9 px-4 text-sm font-medium text-white bg-black rounded-md hover:bg-gray-800"
              >
                <FaExternalLinkAlt size={11} /> {isTaskNotif(detailNotif) ? "Open task page" : "Open page"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Header;