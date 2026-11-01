import { supabase } from "../lib/supabase.js";

const DEFAULT_LIMIT = 40;

function throwIfError(error) {
  if (error) throw error;
}

async function requireUserId() {
  const { data, error } = await supabase.auth.getUser();
  throwIfError(error);
  const userId = data?.user?.id;
  if (!userId) throw new Error("Sesi login tidak ditemukan. Silakan masuk kembali.");
  return userId;
}

export async function listMyNotifications({ limit = DEFAULT_LIMIT } = {}) {
  const userId = await requireUserId();
  const safeLimit = Math.max(1, Math.min(Number(limit) || DEFAULT_LIMIT, 100));
  const { data, error } = await supabase
    .from("notifications")
    .select("id,user_id,notification_type,title,body,reference_id,read_at,created_at,is_demo")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(safeLimit);
  throwIfError(error);
  return data || [];
}

export async function markMyNotificationRead(notificationId) {
  const userId = await requireUserId();
  if (!notificationId) throw new Error("Notifikasi tidak valid.");
  const { data, error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("user_id", userId)
    .is("read_at", null)
    .select("id,read_at")
    .maybeSingle();
  throwIfError(error);
  return data;
}

export async function markAllMyNotificationsRead() {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("read_at", null)
    .select("id");
  throwIfError(error);
  return data || [];
}

export function subscribeToMyNotifications(userId, onChange, onStatus) {
  if (!userId) throw new Error("ID akun tidak tersedia untuk notifikasi.");
  if (typeof window !== "undefined" && window.__UTCONNECT_DISABLE_REALTIME__) return null;

  return supabase
    .channel(`notifications-${userId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${userId}`,
      },
      payload => onChange?.(payload)
    )
    .subscribe((status, error) => onStatus?.(status, error));
}

export async function unsubscribeFromMyNotifications(channel) {
  if (!channel) return;
  return supabase.removeChannel(channel);
}
