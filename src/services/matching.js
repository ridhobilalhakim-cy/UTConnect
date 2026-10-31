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

export async function listActiveMatchingCourses() {
  const { data, error } = await supabase
    .from("courses")
    .select("id,course_code,course_name")
    .eq("is_active", true)
    .order("course_name", { ascending: true });
  throwIfError(error);
  return data || [];
}

export async function getMyMatchingPreferences(userId) {
  if (!userId) return null;
  const { data, error } = await supabase
    .from("matching_preferences")
    .select("user_id,topic_tags,interests,study_times,updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  throwIfError(error);
  return data;
}

export async function getMyMatchingCourseIds(userId) {
  if (!userId) return [];
  const { data, error } = await supabase
    .from("profile_courses")
    .select("course_id")
    .eq("user_id", userId);
  throwIfError(error);
  return (data || []).map(row => row.course_id);
}

export async function saveMyMatchingPreferences({ topicTags = [], interests = [], studyTimes = [] }) {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("matching_preferences")
    .upsert({
      user_id: userId,
      topic_tags: topicTags,
      interests,
      study_times: studyTimes,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" })
    .select("user_id,topic_tags,interests,study_times,updated_at")
    .single();
  throwIfError(error);
  return data;
}

export async function replaceMyMatchingCourseIds(courseIds = []) {
  const userId = await requireUserId();
  const uniqueIds = [...new Set(courseIds.filter(Boolean))];
  const currentIds = await getMyMatchingCourseIds(userId);
  const removeIds = currentIds.filter(id => !uniqueIds.includes(id));
  const addIds = uniqueIds.filter(id => !currentIds.includes(id));

  if (removeIds.length) {
    const { error } = await supabase
      .from("profile_courses")
      .delete()
      .eq("user_id", userId)
      .in("course_id", removeIds);
    throwIfError(error);
  }
  if (addIds.length) {
    const { error } = await supabase
      .from("profile_courses")
      .insert(addIds.map(courseId => ({ user_id: userId, course_id: courseId })));
    throwIfError(error);
  }
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
    .insert({
      initiator_id: userId,
      recipient_id: recipientId,
      status: "pending",
    })
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
