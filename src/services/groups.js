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

const GROUP_MESSAGE_SELECT = "id,group_id,sender_id,reply_to_id,body,mentioned_user_ids,pinned_at,pinned_by,created_at";
const GROUP_AGENDA_SELECT = "id,group_id,created_by,item_type,title,details,due_at,poll_options,created_at,updated_at";
const GROUP_MATERIAL_BUCKET = "group-materials";
const MAX_GROUP_MATERIAL_BYTES = 50 * 1024 * 1024;
const GROUP_MATERIAL_TYPES = new Map([
  ["application/pdf", "pdf"],
  ["application/msword", "doc"],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx"],
  ["application/vnd.openxmlformats-officedocument.presentationml.presentation", "pptx"],
  ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx"],
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
]);

export async function listGroupMessages(groupId, limit = 100) {
  if (!groupId) return [];
  const { data, error } = await supabase
    .from("group_messages")
    .select(GROUP_MESSAGE_SELECT)
    .eq("group_id", groupId)
    .order("created_at", { ascending: true })
    .limit(Math.min(Math.max(Number(limit) || 100, 1), 200));
  throwIfError(error);
  return data || [];
}

export async function sendGroupMessage(groupId, body, replyToId = null) {
  const userId = await requireUserId();
  const message = String(body || "").trim();
  if (!groupId || message.length < 1 || message.length > 5000) {
    throw new Error("Pesan harus berisi 1–5.000 karakter.");
  }
  const { data, error } = await supabase
    .from("group_messages")
    .insert({
      group_id: groupId,
      sender_id: userId,
      reply_to_id: replyToId || null,
      body: message,
      mentioned_user_ids: [],
    })
    .select(GROUP_MESSAGE_SELECT)
    .single();
  throwIfError(error);
  return data;
}

export async function setGroupMessagePinned(messageId, pinned) {
  const actorId = await requireUserId();
  if (!messageId || typeof pinned !== "boolean") throw new Error("Status pin pesan tidak valid.");
  const { error } = await supabase.rpc("set_group_message_pin", {
    p_actor_id: actorId,
    p_message_id: messageId,
    p_pin: pinned,
  });
  throwIfError(error);
}

export function subscribeToGroupMessages(groupId, onChange) {
  if (!groupId || typeof onChange !== "function") return null;
  const channel = supabase
    .channel(`group-messages-${groupId}-${crypto.randomUUID()}`)
    .on("postgres_changes", {
      event: "*",
      schema: "public",
      table: "group_messages",
      filter: `group_id=eq.${groupId}`,
    }, onChange)
    .subscribe();
  return channel;
}

export async function listGroupMaterials(groupId) {
  if (!groupId) return [];
  const { data, error } = await supabase
    .from("group_materials")
    .select("id,group_id,uploaded_by,title,storage_path,content_type,file_size_bytes,created_at")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false });
  throwIfError(error);
  const rows = data || [];
  return Promise.all(rows.map(async material => {
    const { data: signed, error: signedError } = await supabase
      .storage.from(GROUP_MATERIAL_BUCKET)
      .createSignedUrl(material.storage_path, 90);
    return {
      ...material,
      download_url: signedError ? null : signed?.signedUrl || null,
    };
  }));
}

export async function uploadGroupMaterial(groupId, file, title = "") {
  const userId = await requireUserId();
  if (!groupId || !file) throw new Error("Pilih berkas materi terlebih dahulu.");
  const extension = GROUP_MATERIAL_TYPES.get(file.type);
  if (!extension) throw new Error("Jenis berkas tidak didukung. Gunakan PDF, DOC/DOCX, PPTX, XLSX, JPG, atau PNG.");
  if (!Number.isFinite(file.size) || file.size < 1 || file.size > MAX_GROUP_MATERIAL_BYTES) {
    throw new Error("Ukuran materi harus maksimal 50 MB.");
  }
  const label = String(title || file.name || "Materi").trim().replace(/\.[^.]+$/, "").slice(0, 140);
  if (label.length < 2) throw new Error("Judul materi minimal 2 karakter.");
  const storagePath = `${groupId}/${userId}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from(GROUP_MATERIAL_BUCKET)
    .upload(storagePath, file, { contentType: file.type, upsert: false });
  throwIfError(uploadError);

  const { data, error } = await supabase
    .from("group_materials")
    .insert({
      group_id: groupId,
      uploaded_by: userId,
      title: label,
      storage_path: storagePath,
      content_type: file.type,
      file_size_bytes: file.size,
    })
    .select("id,group_id,uploaded_by,title,storage_path,content_type,file_size_bytes,created_at")
    .single();

  if (error) {
    await supabase.storage.from(GROUP_MATERIAL_BUCKET).remove([storagePath]);
    throw error;
  }
  const { data: signed } = await supabase.storage
    .from(GROUP_MATERIAL_BUCKET)
    .createSignedUrl(storagePath, 90);
  return { ...data, download_url: signed?.signedUrl || null };
}

export async function deleteGroupMaterial(materialId) {
  if (!materialId) throw new Error("Materi tidak valid.");
  const { data, error } = await supabase
    .from("group_materials")
    .delete()
    .eq("id", materialId)
    .select("storage_path")
    .single();
  throwIfError(error);
  const { error: storageError } = await supabase.storage
    .from(GROUP_MATERIAL_BUCKET)
    .remove([data.storage_path]);
  if (storageError) {
    throw new Error("Data materi sudah dihapus, tetapi berkas penyimpanan belum berhasil dibersihkan.");
  }
}

export async function listGroupAgendaItems(groupId) {
  if (!groupId) return [];
  const { data, error } = await supabase
    .from("group_agenda_items")
    .select(GROUP_AGENDA_SELECT)
    .eq("group_id", groupId)
    .order("due_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  throwIfError(error);
  return data || [];
}

function validateAgendaInput(input) {
  const type = String(input?.item_type || "");
  const title = String(input?.title || "").trim();
  const details = String(input?.details || "").trim();
  const allowed = ["schedule", "target", "task", "poll", "note"];
  if (!allowed.includes(type)) throw new Error("Jenis agenda tidak dikenal.");
  if (title.length < 2 || title.length > 120) throw new Error("Judul agenda harus 2–120 karakter.");
  if (details.length > 3000) throw new Error("Detail agenda maksimal 3.000 karakter.");
  let pollOptions = null;
  if (type === "poll") {
    pollOptions = Array.isArray(input.poll_options)
      ? input.poll_options.map(option => String(option).trim()).filter(Boolean)
      : [];
    if (pollOptions.length < 2 || pollOptions.length > 6
      || pollOptions.some(option => option.length > 100)
      || new Set(pollOptions).size !== pollOptions.length) {
      throw new Error("Jajak pendapat harus memiliki 2–6 pilihan unik, masing-masing maksimal 100 karakter.");
    }
  }
  return {
    item_type: type,
    title,
    details: details || null,
    due_at: input.due_at || null,
    poll_options: pollOptions,
  };
}

export async function createGroupAgendaItem(groupId, input) {
  const userId = await requireUserId();
  const payload = validateAgendaInput(input);
  const { data, error } = await supabase
    .from("group_agenda_items")
    .insert({ ...payload, group_id: groupId, created_by: userId })
    .select(GROUP_AGENDA_SELECT)
    .single();
  throwIfError(error);
  return data;
}

export async function updateGroupAgendaItem(itemId, input) {
  const payload = validateAgendaInput(input);
  const { data, error } = await supabase
    .from("group_agenda_items")
    .update(payload)
    .eq("id", itemId)
    .select(GROUP_AGENDA_SELECT)
    .single();
  throwIfError(error);
  return data;
}

export async function deleteGroupAgendaItem(itemId) {
  const { error } = await supabase.from("group_agenda_items").delete().eq("id", itemId);
  throwIfError(error);
}

export async function getGroupPollResults(itemId) {
  const actorId = await requireUserId();
  const { data, error } = await supabase.rpc("get_group_agenda_poll_results", {
    p_actor_id: actorId,
    p_item_id: itemId,
  });
  throwIfError(error);
  return data || { options: [], total_votes: 0 };
}

export async function castGroupPollVote(itemId, option) {
  const actorId = await requireUserId();
  const { data, error } = await supabase.rpc("cast_group_agenda_vote", {
    p_actor_id: actorId,
    p_item_id: itemId,
    p_option: option,
  });
  throwIfError(error);
  return data || { options: [], total_votes: 0 };
}

export async function listMyGroupInvitations() {
  const actorId = await requireUserId();
  const { data, error } = await supabase.rpc("list_my_group_invites", {
    p_actor_id: actorId,
  });
  throwIfError(error);
  return data || [];
}

export async function listGroupInvites(groupId) {
  if (!groupId) return [];
  const { data, error } = await supabase
    .from("group_invites")
    .select("id,group_id,invited_by,created_at,accepted_at")
    .eq("group_id", groupId)
    .is("accepted_at", null)
    .order("created_at", { ascending: false });
  throwIfError(error);
  return data || [];
}

export async function inviteGroupMemberByNim(groupId, nim) {
  if (!groupId || !/^\d{9}$/.test(String(nim || "").trim())) {
    throw new Error("Masukkan NIM lengkap 9 digit.");
  }
  const { data, error } = await supabase.functions.invoke("manage-group-invites", {
    body: { action: "invite_by_nim", group_id: groupId, nim: String(nim).trim() },
  });
  if (error) throw new Error(data?.error || error.message || "Undangan belum berhasil dikirim.");
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function cancelGroupInvite(inviteId) {
  const { data, error } = await supabase.functions.invoke("manage-group-invites", {
    body: { action: "cancel", invite_id: inviteId },
  });
  if (error) throw new Error(data?.error || error.message || "Undangan belum berhasil dibatalkan.");
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function unsubscribeFromGroupMessages(channel) {
  if (!channel) return;
  await supabase.removeChannel(channel);
}

export function subscribeToGroupWorkspace(groupId, handlers = {}) {
  if (!groupId) return null;
  const channel = supabase.channel(`group-workspace-${groupId}-${crypto.randomUUID()}`);
  const tables = [
    ["group_messages", handlers.onMessages],
    ["group_materials", handlers.onMaterials],
    ["group_agenda_items", handlers.onAgenda],
    ["group_invites", handlers.onInvites],
    ["group_members", handlers.onMembers],
  ];
  for (const [table, callback] of tables) {
    if (typeof callback !== "function") continue;
    channel.on("postgres_changes", {
      event: "*",
      schema: "public",
      table,
      filter: `group_id=eq.${groupId}`,
    }, callback);
  }
  return channel.subscribe();
}
