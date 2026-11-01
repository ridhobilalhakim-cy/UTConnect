import { supabase, IS_DEMO_BUILD } from "../lib/supabase.js";
import { runDemoAutomation } from "./demo.js";

const MESSAGE_LIMIT = 60;
const MESSAGE_SELECT = IS_DEMO_BUILD
  ? "id,connection_id,sender_id,body,created_at,read_at,is_demo"
  : "id,connection_id,sender_id,body,created_at,read_at";
const MAX_MESSAGE_LENGTH = 5000;
const DIRECT_MESSAGE_SELECT = IS_DEMO_BUILD
  ? "id,connection_id,sender_id,body,created_at,read_at,is_demo"
  : "id,connection_id,sender_id,body,created_at,read_at";

function throwIfError(error) {
  if (error) throw error;
}

function assertConnectionId(connectionId) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(connectionId || ""))) {
    throw new Error("ID koneksi tidak valid.");
  }
}

async function requireUserId() {
  const { data, error } = await supabase.auth.getUser();
  throwIfError(error);
  const userId = data?.user?.id;
  if (!userId) throw new Error("Sesi login tidak ditemukan. Silakan masuk kembali.");
  return userId;
}

export async function listDirectMessages(connectionId, { limit = MESSAGE_LIMIT, before = null } = {}) {
  assertConnectionId(connectionId);
  const safeLimit = Math.max(1, Math.min(Number(limit) || MESSAGE_LIMIT, 100));
  let query = supabase
    .from("direct_messages")
    .select(MESSAGE_SELECT)
    .eq("connection_id", connectionId)
    .order("created_at", { ascending: false })
    .limit(safeLimit);

  if (before) query = query.lt("created_at", before);

  const { data, error } = await query;
  throwIfError(error);
  return (data || []).reverse();
}

export async function sendDirectMessage(connectionId, body) {
  assertConnectionId(connectionId);
  const userId = await requireUserId();
  const message = String(body ?? "").trim();
  const length = Array.from(message).length;

  if (!message) throw new Error("Pesan tidak boleh kosong.");
  if (length > MAX_MESSAGE_LENGTH) throw new Error("Pesan maksimal 5.000 karakter.");

  const { data, error } = await supabase
    .from("direct_messages")
    .insert({
      connection_id: connectionId,
      sender_id: userId,
      body: message,
    })
    .select(MESSAGE_SELECT)
    .single();

  throwIfError(error);
  await runDemoAutomation("direct_message", { message_id: data.id });
  return data;
}

export async function markDirectMessagesRead(connectionId) {
  assertConnectionId(connectionId);
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("direct_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("connection_id", connectionId)
    .neq("sender_id", userId)
    .is("read_at", null)
    .select("id");

  throwIfError(error);
  return data || [];
}

export function subscribeToDirectMessages(connectionId, onChange, onStatus) {
  assertConnectionId(connectionId);
  if (typeof window !== "undefined" && window.__UTCONNECT_DISABLE_REALTIME__) return null;

  return supabase
    .channel(`direct-messages-${connectionId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "direct_messages",
        filter: `connection_id=eq.${connectionId}`,
      },
      payload => onChange?.(payload)
    )
    .subscribe((status, error) => onStatus?.(status, error));
}

export async function unsubscribeFromDirectMessages(channel) {
  if (!channel) return;
  return supabase.removeChannel(channel);
}
