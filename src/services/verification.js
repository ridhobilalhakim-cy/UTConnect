import { supabase } from "../lib/supabase.js";

const BUCKET = "student-verification-evidence";
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Map([
  ["application/pdf", "pdf"],
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
]);

function throwIfError(error) {
  if (error) throw error;
}

export async function getMyStudentVerificationStatus() {
  const { data, error } = await supabase.rpc("get_my_student_verification_status");
  throwIfError(error);
  return data;
}

export async function submitStudentVerificationEvidence(file) {
  if (!(file instanceof File)) throw new Error("Pilih dokumen bukti terlebih dahulu.");
  if (!ALLOWED_TYPES.has(file.type)) throw new Error("Format dokumen harus PDF, JPG, atau PNG.");
  if (file.size <= 0 || file.size > MAX_FILE_SIZE) throw new Error("Ukuran dokumen maksimal 5 MB.");

  const extension = ALLOWED_TYPES.get(file.type);
  const storagePath = `${(await supabase.auth.getUser()).data.user?.id}/${crypto.randomUUID()}.${extension}`;
  const originalFilename = file.name
    .replace(/[\\/\\r\\n]/g, "_")
    .trim()
    .slice(0, 255);

  if (!storagePath.startsWith("undefined/") && !/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(pdf|jpg|png)$/i.test(storagePath)) {
    throw new Error("Sesi akun tidak valid. Silakan masuk kembali.");
  }
  if (!originalFilename) throw new Error("Nama file tidak valid.");

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, {
      cacheControl: "0",
      contentType: file.type,
      upsert: false,
    });
  throwIfError(uploadError);

  const { data, error } = await supabase.rpc("submit_student_verification", {
    p_storage_path: storagePath,
    p_original_filename: originalFilename,
  });

  if (error) {
    const { error: cleanupError } = await supabase.storage.from(BUCKET).remove([storagePath]);
    if (cleanupError) console.error("Unable to clean up unsubmitted verification evidence:", cleanupError);
    throw error;
  }

  return data;
}

export async function listStudentVerificationQueue() {
  const { data, error } = await supabase.rpc("admin_list_student_verification_queue");
  throwIfError(error);
  return Array.isArray(data) ? data : [];
}

export async function downloadStudentVerificationEvidence(storagePath) {
  if (typeof storagePath !== "string" || !/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(pdf|jpg|jpeg|png)$/i.test(storagePath)) {
    throw new Error("Lokasi bukti tidak valid.");
  }
  const { data, error } = await supabase.storage.from(BUCKET).download(storagePath);
  throwIfError(error);
  return data;
}

export async function reviewStudentVerificationRequest(requestId, decision, reviewNote = null) {
  if (!["approved", "rejected"].includes(decision)) throw new Error("Keputusan verifikasi tidak valid.");
  const { data, error } = await supabase.rpc("admin_review_student_verification", {
    p_request_id: requestId,
    p_decision: decision,
    p_review_note: reviewNote,
  });
  throwIfError(error);
  return data;
}
