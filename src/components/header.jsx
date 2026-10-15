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
} from "react-icons/fa";
import { supabase, notificationAPI } from "../lib/supabaseClient";

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

const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-PH", {
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

// Icon + kulay per type ng notification
const typeMeta = {
  billing_pending_approval: { icon: FaFileInvoiceDollar, cls: "bg-amber-100 text-amber-600" },
  billing_submitted: { icon: FaPaperPlane, cls: "bg-blue-100 text-blue-600" },
  billing_approved: { icon: FaCheckCircle, cls: "bg-emerald-100 text-emerald-600" },
  billing_draft: { icon: FaRegFileAlt, cls: "bg-slate-100 text-slate-500" },
};
const getMeta = (type) =>
  typeMeta[type] || { icon: FaBell, cls: "bg-slate-100 text-slate-500" };

const statusMeta = {
  draft: { label: "Draft", cls: "bg-slate-100 text-slate-600" },
  pending_approval: { label: "Pending Approval", cls: "bg-amber-100 text-amber-700" },
  approved: { label: "Approved", cls: "bg-emerald-100 text-emerald-700" },
  unpaid: { label: "Unpaid", cls: "bg-red-100 text-red-600" },
};

const Avatar = ({ user, size = "w-8 h-8", text = "text-xs" }) => {
  const name = user?.full_name || user?.fullName || "U";
  return user?.image_url ? (
    <img src={user.image_url} alt={name} className={`object-cover rounded-full ${size}`} />
  ) : (
    <div className={`flex items-center justify-center font-semibold text-white rounded-full bg-emerald-600 ${size} ${text}`}>
      {name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
    </div>
  );
};

const Header = ({ toggleSidebar, user, onLogout, onNotificationClick }) => {
  const [showNotif, setShowNotif] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [ringing, setRinging] = useState(false);
  const [toast, setToast] = useState(null);

  // Detail modal
  const [detailNotif, setDetailNotif] = useState(null);
  const [detail, setDetail] = useState(null); // { bill, items, creator }
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

  // Escape para isara ang modal
  useEffect(() => {
    if (!detailNotif) return;
    const onKey = (e) => e.key === "Escape" && closeDetail();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [detailNotif]);

  const loadDetail = async (n) => {
    setDetail(null);
    setDetailError("");
    if (!n.reference_id || !String(n.type || "").startsWith("billing")) return;

    setDetailLoading(true);
    try {
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

      setDetail({ bill, items: items || [], creator });
    } catch (err) {
      setDetailError("Hindi ma-load ang details. Baka na-delete na ang billing.");
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

  // Totals sa modal
  const subtotal = detail ? detail.items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0) : 0;
  const dp = detail ? parseFloat(detail.bill.down_payment) || 0 : 0;
  const wht = detail ? parseFloat(detail.bill.withholding_tax) || 0 : 0;
  const totalDue = subtotal - dp - wht;

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

      <header className="fixed top-0 left-0 right-0 z-30 flex items-center h-16 px-6 bg-white border-b text-slate-700 border-slate-100">
        <button
          onClick={toggleSidebar}
          className="p-2 mr-6 text-lg transition-colors duration-150 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-600"
        >
          <FaBars />
        </button>

        <div className="flex items-center gap-2.5">
          <img src="/DATS_LOGO.png" alt="DATS" className="object-contain w-8 h-8" />
          <h1 className="text-base font-semibold text-slate-800">DATS</h1>
        </div>

        <div className="items-center flex-1 hidden max-w-md ml-8 md:flex">
          <div className="relative w-full">
            <FaSearch className="absolute text-xs -translate-y-1/2 text-slate-400 left-3 top-1/2" />
            <input
              type="text"
              placeholder="Search invoices, customers..."
              className="w-full py-2 pr-4 text-sm transition-colors border rounded-lg pl-9 text-slate-700 placeholder-slate-400 border-slate-100 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white"
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
              className="relative p-2.5 hover:bg-slate-50 rounded-lg transition-colors duration-150"
            >
              <FaBell
                className={`text-base transition-colors ${
                  unreadCount > 0 ? "text-emerald-600" : "text-slate-400"
                } ${ringing ? "anim-bell" : ""}`}
              />
              {unreadCount > 0 && (
                <>
                  <span className="absolute top-1 right-1 min-w-[16px] h-4 rounded-full bg-emerald-500 anim-ping" />
                  <span
                    key={unreadCount}
                    className="absolute top-1 right-1 flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] font-semibold text-white rounded-full bg-emerald-500 anim-badge"
                  >
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                </>
              )}
            </button>

            {showNotif && (
              <div className="absolute right-0 mt-2 overflow-hidden bg-white border shadow-xl w-96 rounded-xl border-slate-100 anim-drop">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                  <h3 className="text-sm font-semibold text-slate-800">Notifications</h3>
                  {unreadCount > 0 && (
                    <button onClick={markAllAsRead} className="text-xs font-medium text-emerald-600 hover:text-emerald-700">
                      Mark all as read
                    </button>
                  )}
                </div>

                <div className="overflow-y-auto max-h-96">
                  {notifications.length === 0 ? (
                    <div className="px-4 py-10 text-center">
                      <FaBell className="mx-auto mb-2 text-2xl text-slate-200" />
                      <p className="text-sm text-slate-400">No notifications</p>
                    </div>
                  ) : (
                    notifications.map((n, i) => {
                      const meta = getMeta(n.type);
                      const Icon = meta.icon;
                      return (
                        <button
                          key={n.id}
                          onClick={() => openDetail(n)}
                          style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}
                          className={`anim-item flex items-start w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 ${
                            n.read ? "" : "bg-emerald-50/50"
                          }`}
                        >
                          <span className={`flex items-center justify-center w-9 h-9 rounded-full shrink-0 ${meta.cls}`}>
                            <Icon size={14} />
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm text-slate-700 ${n.read ? "font-normal" : "font-semibold"}`}>
                              {n.title}
                            </p>
                            {n.message && <p className="text-xs text-slate-500 line-clamp-2">{n.message}</p>}
                            <p className={`mt-0.5 text-[11px] ${n.read ? "text-slate-400" : "text-emerald-600 font-medium"}`}>
                              {timeAgo(n.created_at)}
                            </p>
                          </div>
                          {!n.read ? (
                            <span className="w-2.5 h-2.5 mt-2 rounded-full bg-emerald-500 shrink-0" />
                          ) : (
                            <FaCheck className="mt-2 text-xs text-slate-300 shrink-0" />
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="w-px h-6 mx-2 bg-slate-100" />

          {/* Profile */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => {
                setShowProfile((v) => !v);
                setShowNotif(false);
              }}
              className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-50 transition-colors duration-150"
            >
              <Avatar user={user} />
              <div className="hidden text-left md:block">
                <p className="text-sm font-medium leading-tight text-slate-700">{displayName}</p>
                <p className="text-[11px] leading-tight text-slate-400">{user?.role}</p>
              </div>
            </button>

            {showProfile && (
              <div className="absolute right-0 w-56 mt-2 bg-white border shadow-lg rounded-xl border-slate-100 anim-drop">
                <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
                  <Avatar user={user} size="w-10 h-10" text="text-sm" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate text-slate-800">{displayName}</p>
                    <p className="text-xs truncate text-slate-400">{user?.email}</p>
                    <p className="text-[11px] font-medium text-emerald-600">{user?.role}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowProfile(false);
                    onLogout?.();
                  }}
                  className="w-full px-4 py-2.5 text-sm text-left text-slate-600 hover:bg-slate-50 rounded-b-xl"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ───────── Toast popup (bagong notification) ───────── */}
      {toast && (
        <div className="fixed z-50 top-20 right-6 anim-toast">
          <button
            onClick={() => openDetail(toast)}
            className="relative block overflow-hidden text-left bg-white border shadow-2xl w-80 rounded-xl border-slate-100"
          >
            <div className="flex items-start gap-3 p-3.5">
              {(() => {
                const meta = getMeta(toast.type);
                const Icon = meta.icon;
                return (
                  <span className={`flex items-center justify-center w-9 h-9 rounded-full shrink-0 ${meta.cls}`}>
                    <Icon size={14} />
                  </span>
                );
              })()}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800">{toast.title}</p>
                {toast.message && <p className="text-xs text-slate-500 line-clamp-2">{toast.message}</p>}
                <p className="mt-1 text-[11px] font-medium text-emerald-600">Click to view details</p>
              </div>
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  setToast(null);
                }}
                className="p-1 text-slate-300 hover:text-slate-500"
              >
                <FaTimes size={11} />
              </span>
            </div>
            <div className="h-0.5 bg-emerald-500 anim-bar" key={toast.id} />
          </button>
        </div>
      )}

      {/* ───────── Detail modal (parang Facebook) ───────── */}
      {detailNotif && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm anim-fade"
          onClick={(e) => e.target === e.currentTarget && closeDetail()}
        >
          <div className="w-full max-w-2xl bg-white shadow-2xl rounded-2xl max-h-[90vh] flex flex-col overflow-hidden anim-modal">
            {/* Top */}
            <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-slate-100">
              <div className="flex items-start gap-3">
                {(() => {
                  const meta = getMeta(detailNotif.type);
                  const Icon = meta.icon;
                  return (
                    <span className={`flex items-center justify-center w-10 h-10 rounded-full shrink-0 ${meta.cls}`}>
                      <Icon size={15} />
                    </span>
                  );
                })()}
                <div>
                  <h2 className="text-base font-semibold text-slate-800">{detailNotif.title}</h2>
                  <p className="text-xs text-slate-500">{detailNotif.message}</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">{timeAgo(detailNotif.created_at)}</p>
                </div>
              </div>
              <button onClick={closeDetail} className="p-1.5 text-slate-400 rounded-lg hover:bg-slate-100 hover:text-slate-600">
                <FaTimes size={14} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 px-6 py-5 overflow-y-auto">
              {detailLoading && (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-2 rounded-full border-emerald-500 border-t-transparent animate-spin" />
                </div>
              )}

              {!detailLoading && detailError && (
                <p className="py-10 text-sm text-center text-slate-400">{detailError}</p>
              )}

              {!detailLoading && !detailError && !detail && (
                <p className="py-10 text-sm text-center text-slate-400">
                  Walang karagdagang details para sa notification na ito.
                </p>
              )}

              {!detailLoading && detail && (
                <div className="space-y-5">
                  {/* Summary */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="p-3 rounded-lg bg-slate-50">
                      <p className="text-[11px] text-slate-400">SOA Number</p>
                      <p className="font-mono font-semibold text-slate-800">{detail.bill.soa_number}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50">
                      <p className="text-[11px] text-slate-400">Status</p>
                      <span
                        className={`inline-block mt-0.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                          (statusMeta[detail.bill.status] || statusMeta.draft).cls
                        }`}
                      >
                        {(statusMeta[detail.bill.status] || statusMeta.draft).label}
                      </span>
                    </div>
                    <div className="col-span-2 p-3 rounded-lg bg-slate-50">
                      <p className="text-[11px] text-slate-400">Bill To</p>
                      <p className="font-medium text-slate-800">{detail.bill.bill_to}</p>
                      {detail.bill.address && <p className="text-xs text-slate-500">{detail.bill.address}</p>}
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50">
                      <p className="text-[11px] text-slate-400">SOA Date</p>
                      <p className="text-slate-800">{fmtDate(detail.bill.soa_date)}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50">
                      <p className="text-[11px] text-slate-400">Due Date</p>
                      <p className="text-slate-800">{fmtDate(detail.bill.due_date)}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50">
                      <p className="text-[11px] text-slate-400">Created by</p>
                      <p className="text-slate-800">{detail.creator?.full_name || "—"}</p>
                      {detail.creator?.role && <p className="text-[11px] text-slate-400">{detail.creator.role}</p>}
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50">
                      <p className="text-[11px] text-slate-400">Approved by</p>
                      <p className="text-slate-800">{detail.bill.approved_by || "—"}</p>
                      {detail.bill.approved_at && (
                        <p className="text-[11px] text-slate-400">{fmtDate(detail.bill.approved_at)}</p>
                      )}
                    </div>
                  </div>

                  {/* Items */}
                  <div>
                    <p className="mb-2 text-xs font-semibold tracking-wider uppercase text-slate-400">
                      Billing Items ({detail.items.length})
                    </p>
                    <div className="overflow-hidden border rounded-lg border-slate-100">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50 text-slate-400">
                          <tr>
                            <th className="px-3 py-2 font-semibold text-left">Code</th>
                            <th className="px-3 py-2 font-semibold text-left">Description</th>
                            <th className="px-3 py-2 font-semibold text-left">Period</th>
                            <th className="px-3 py-2 font-semibold text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detail.items.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="px-3 py-6 text-center text-slate-400">
                                No items
                              </td>
                            </tr>
                          ) : (
                            detail.items.map((it, i) => (
                              <tr key={it.id || i} className="border-t border-slate-100">
                                <td className="px-3 py-2 font-mono text-slate-500">{it.account_code || "—"}</td>
                                <td className="px-3 py-2 text-slate-700">
                                  {it.description}
                                  {it.agency && <span className="block text-[10px] text-slate-400">{it.agency}</span>}
                                </td>
                                <td className="px-3 py-2 text-slate-500">{fmtPeriod(it.period_covered)}</td>
                                <td className="px-3 py-2 font-mono text-right text-slate-700">{peso(it.amount)}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Totals */}
                  <div className="ml-auto space-y-1.5 text-sm w-full max-w-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Subtotal</span>
                      <span className="font-mono text-slate-800">{peso(subtotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Less: Down Payment</span>
                      <span className="font-mono text-slate-800">{peso(dp)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Less: Withholding Tax</span>
                      <span className="font-mono text-slate-800">{peso(wht)}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-slate-200">
                      <span className="font-semibold text-slate-800">Total Amount Due</span>
                      <span className="font-mono text-base font-bold text-emerald-700">{peso(totalDue)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 px-6 py-3.5 border-t border-slate-100 bg-slate-50/60">
              <button
                onClick={closeDetail}
                className="px-4 py-2 text-sm font-medium bg-white border rounded-lg text-slate-600 border-slate-200 hover:bg-slate-50"
              >
                Close
              </button>
              <button
                onClick={goToPage}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg bg-emerald-600 hover:bg-emerald-700"
              >
                <FaExternalLinkAlt size={11} /> Open page
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Header;