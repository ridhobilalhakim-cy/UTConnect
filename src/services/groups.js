import { supabase } from "../lib/supabase.js";

const GROUP_SELECT = "id,created_by,name,description,course_id,mode,capacity,access_type,schedule_text,online_url,offline_area_label,is_archived,created_at,updated_at,course:courses!study_groups_course_id_fkey(id,course_code,course_name)";
const MEMBERSHIP_SELECT = "group_id,user_id,role,status,created_at,joined_at";

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

export async function listActiveStudyCourses() {
  const { data, error } = await supabase
    .from("courses")
    .select("id,course_code,course_name")
    .eq("is_active", true)
    .order("course_name", { ascending: true });
  throwIfError(error);
  return data || [];
}

export async function listStudyGroups(limit = 100) {
  const { data, error } = await supabase
    .from("study_groups")
    .select(GROUP_SELECT)
    .eq("is_archived", false)
    .order("created_at", { ascending: false })
    .limit(limit);
  throwIfError(error);
  return data || [];
}

export async function listMyGroupMemberships(userId) {
  if (!userId) return [];
  const { data, error } = await supabase
    .from("group_members")
    .select(MEMBERSHIP_SELECT)
    .eq("user_id", userId);
  throwIfError(error);
  return data || [];
}

export async function listVisibleGroupMembers(groupIds) {
  if (!Array.isArray(groupIds) || groupIds.length === 0) return [];
  const { data, error } = await supabase
    .from("group_members")
    .select(MEMBERSHIP_SELECT)
    .in("group_id", groupIds)
    .order("created_at", { ascending: true });
  throwIfError(error);
  return data || [];
}

export async function createStudyGroup(input) {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("study_groups")
    .insert({ ...input, created_by: userId })
    .select(GROUP_SELECT)
    .single();
  throwIfError(error);
  return data;
}

export async function joinStudyGroup(groupId) {
  const userId = await requireUserId();
  const { data, error } = await supabase.rpc("join_study_group", {
    p_actor_id: userId,
    p_group_id: groupId,
  });
  throwIfError(error);
  return data;
}

export async function respondGroupJoinRequest(groupId, userId, accept) {
  const actorId = await requireUserId();
  const { data, error } = await supabase.rpc("respond_group_join_request", {
    p_actor_id: actorId,
    p_group_id: groupId,
    p_user_id: userId,
    p_accept: accept,
  });
  throwIfError(error);
  return data;
}
