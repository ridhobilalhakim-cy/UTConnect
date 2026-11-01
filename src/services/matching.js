import { supabase } from "../lib/supabase.js";

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

export async function getMyMatchingPreferences(userId) {
  if (!userId) return null;
  const { data, error } = await supabase
    .from("matching_preferences")
    .select("user_id,topic_tags,interests,study_times,preferred_programs,updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  throwIfError(error);
  return data;
}

export async function saveMyMatchingPreferences({ topicTags = [], interests = [], studyTimes = [], preferredPrograms = [] }) {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("matching_preferences")
    .upsert({
      user_id: userId,
      topic_tags: topicTags,
      interests,
      study_times: studyTimes,
      preferred_programs: preferredPrograms,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" })
    .select("user_id,topic_tags,interests,study_times,preferred_programs,updated_at")
    .single();
  throwIfError(error);
  return data;
}

export async function findMatchingStudents(radiusMeters = 3000) {
  const { data, error } = await supabase.rpc("find_matching_students", {
    p_radius_m: radiusMeters,
  });
  throwIfError(error);
  return data || [];
}

export async function listMyConnectionSummaries() {
  const { data, error } = await supabase.rpc("get_my_connection_summaries");
  throwIfError(error);
  return data || [];
}

export async function sendConnectionRequest(recipientId) {
  const userId = await requireUserId();
  if (!recipientId || recipientId === userId) throw new Error("Tujuan koneksi tidak valid.");
  const { data, error } = await supabase
    .from("connections")
    .insert({ initiator_id: userId, recipient_id: recipientId, status: "pending" })
    .select("id,initiator_id,recipient_id,status,created_at")
    .single();
  throwIfError(error);
  return data;
}

export async function respondConnectionRequest(connectionId, accept) {
  const { data, error } = await supabase.rpc("respond_connection_request", {
    p_connection_id: connectionId,
    p_accept: Boolean(accept),
  });
  throwIfError(error);
  return data;
}


export function subscribeToMyConnections(userId, onChange, onStatus) {
  if (!userId || typeof onChange !== "function") return null;
  if (typeof window !== "undefined" && window.__UTCONNECT_DISABLE_REALTIME__) return null;
  const channel = supabase.channel(`connections-${userId}-${crypto.randomUUID()}`);
  for (const column of ["initiator_id", "recipient_id"]) {
    channel.on("postgres_changes", {
      event: "*", schema: "public", table: "connections",
      filter: `${column}=eq.${userId}`,
    }, payload => onChange(payload));
  }
  return channel.subscribe((status, error) => onStatus?.(status, error));
}
