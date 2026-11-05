import Swal from "sweetalert2";
import { supabase, notificationAPI } from "./supabaseClient";

const KEY = "activeTask";

export const setActiveTask = (task) => {
  try {
    sessionStorage.setItem(
      KEY,
      JSON.stringify({
        id: task.id,
        task_type: task.task_type,
        title: task.title,
        assigned_by: task.assigned_by,
        assigned_by_id: task.assigned_by_id,
        target_client_id: task.target_client_id,
        target_client_name: task.target_client_name,
        target_client: task.target_client || null, // buong client row
      })
    );
  } catch {
    /* ignore */
  }
};

export const getActiveTask = () => {
  try {
    const raw = sessionStorage.getItem(KEY); // KEY na, hindi hardcoded "activeTask"
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const clearActiveTask = () => {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
};

/**
 * Tawagin pagkatapos ma-save ang billing / payment / etc.
 * taskType: "create_billing" | "record_payment" | "undeposited_funds"
 * refId: id ng record na ginawa (optional pero recommended)
 * Returns true kung may task na na-mark as "for_review".
 */
export async function completeActiveTask(taskType, refId = null, clientId = null) {
  const active = getActiveTask();
  if (!active || active.task_type !== taskType) return false;

  // Hindi ito ang client na naka-assign sa task → huwag i-complete
  if (
    active.target_client_id &&
    clientId &&
    String(active.target_client_id) !== String(clientId)
  ) {
    Swal.fire({
      icon: "warning",
      title: "Hindi ito ang naka-assign na client",
      text: `Ang task na "${active.title}" ay para kay ${active.target_client_name}. Hindi ito mabibilang bilang tapos.`,
    });
    return false;
  }

  const { error } = await supabase
    .from("tasks")
    .update({
      status: "for_review",
      completed_at: new Date().toISOString(),
      completed_ref_id: refId != null ? String(refId) : null,
    })
    .eq("id", active.id)
    .neq("status", "done");

  if (error) {
    console.error("completeActiveTask:", error);
    return false;
  }

  try {
    if (active.assigned_by_id) {
      await notificationAPI.notifyUser(active.assigned_by_id, {
        type: "task_for_review",
        title: "Task ready for review",
        message: `"${active.title}" was completed and is waiting for your review.`,
        link: "/dashboard",
        reference_id: null,
      });
    }
  } catch (e) {
    console.error("Notification failed:", e);
  }

  clearActiveTask();
  return true;
}