import { supabase } from "../lib/supabase.js";

const INFO_SELECT = [
  "id",
  "author_id",
  "category",
  "audience",
  "title",
  "body",
  "source_url",
  "is_published",
  "published_at",
  "created_at",
  "updated_at",
].join(",");

function throwIfError(error) {
  if (error) throw error;
}

export async function listInformationPosts() {
  const { data, error } = await supabase
    .from("information_posts")
    .select(INFO_SELECT)
    .order("created_at", { ascending: false });

  throwIfError(error);
  return data ?? [];
}

export async function createInformationPost(payload) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  throwIfError(userError);
  if (!userData?.user?.id) {
    throw new Error("Sesi login tidak ditemukan. Silakan masuk kembali.");
  }

  const { data, error } = await supabase
    .from("information_posts")
    .insert({ ...payload, author_id: userData.user.id })
    .select(INFO_SELECT)
    .single();

  throwIfError(error);
  return data;
}

export async function updateInformationPost(id, payload) {
  if (!id) throw new Error("ID informasi tidak valid.");

  const { data, error } = await supabase
    .from("information_posts")
    .update(payload)
    .eq("id", id)
    .select(INFO_SELECT)
    .single();

  throwIfError(error);
  return data;
}

export async function deleteInformationPost(id) {
  if (!id) throw new Error("ID informasi tidak valid.");

  const { data, error } = await supabase
    .from("information_posts")
    .delete()
    .eq("id", id)
    .select("id")
    .single();

  throwIfError(error);
  return data;
}
