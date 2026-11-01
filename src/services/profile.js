import { supabase } from "../lib/supabase.js";

const AVATAR_BUCKET = "profile-avatars";
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const PROFILE_AVATAR_PRESETS = new Set(["avatar-01", "avatar-02", "avatar-03", "avatar-04"]);
const AVATAR_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

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

export async function updateMyStudentProfile({
  fullName,
  faculty,
  program,
  semester,
  bio = "",
  acknowledgeVerificationReset = false,
}) {
  const { data, error } = await supabase.rpc("update_my_student_profile", {
    p_full_name: String(fullName || "").trim(),
    p_faculty: String(faculty || "").trim(),
    p_program: String(program || "").trim(),
    p_semester: Number(semester),
    p_bio: String(bio || "").trim() || null,
    p_acknowledge_verification_reset: Boolean(acknowledgeVerificationReset),
  });
  throwIfError(error);
  return data;
}

export async function uploadMyProfileAvatar(file) {
  const userId = await requireUserId();
  if (!(file instanceof File)) throw new Error("Pilih foto profil terlebih dahulu.");
  const extension = AVATAR_TYPES.get(file.type);
  if (!extension) throw new Error("Foto profil harus JPG, PNG, atau WebP.");
  if (file.size < 1 || file.size > MAX_AVATAR_BYTES) {
    throw new Error("Ukuran foto profil maksimal 5 MB.");
  }

  const previous = await getMyProfileAvatarPath();
  const storagePath = `${userId}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(storagePath, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });
  throwIfError(uploadError);

  const { data, error } = await supabase.rpc("update_my_profile_avatar", {
    p_avatar_path: storagePath,
  });
  if (error) {
    await supabase.storage.from(AVATAR_BUCKET).remove([storagePath]);
    throw error;
  }

  if (previous && previous !== storagePath && !previous.startsWith("preset:")) {
    const { error: cleanupError } = await supabase.storage.from(AVATAR_BUCKET).remove([previous]);
    if (cleanupError) console.warn("Previous profile avatar cleanup failed:", cleanupError);
  }
  return data;
}

export async function setMyProfileAvatarPreset(presetId) {
  const userId = await requireUserId();
  if (!PROFILE_AVATAR_PRESETS.has(presetId)) throw new Error("Pilihan avatar tidak tersedia.");
  const previous = await getMyProfileAvatarPath();
  const nextPath = `preset:${presetId}`;
  const { data, error } = await supabase.rpc("update_my_profile_avatar", {
    p_avatar_path: nextPath,
  });
  throwIfError(error);
  if (previous && !previous.startsWith("preset:")) {
    const { error: cleanupError } = await supabase.storage.from(AVATAR_BUCKET).remove([previous]);
    if (cleanupError) console.warn("Previous profile avatar cleanup failed:", cleanupError);
  }
  return data;
}

export async function getMyProfileAvatarPath() {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("profiles")
    .select("avatar_path")
    .eq("id", userId)
    .maybeSingle();
  throwIfError(error);
  return data?.avatar_path || null;
}

export function getProfileAvatarUrl(path) {
  if (!path) return null;
  if (path.startsWith("preset:")) {
    const presetId = path.slice("preset:".length);
    return PROFILE_AVATAR_PRESETS.has(presetId) ? `/avatars/${presetId}.svg` : null;
  }
  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  return data?.publicUrl || null;
}

export async function listMyChatRooms() {
  const { data, error } = await supabase.rpc("get_my_chat_rooms");
  throwIfError(error);
  return data || [];
}
