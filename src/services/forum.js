import { supabase } from "../lib/supabase.js";

const POST_SELECT = "id,author_id,course_id,program,post_type,title,body,created_at,updated_at,course:courses!forum_posts_course_id_fkey(id,course_code,course_name)";
const COMMENT_SELECT = "id,post_id,author_id,body,created_at";

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

export async function listForumPosts(limit = 50) {
  const { data, error } = await supabase
    .from("forum_posts")
    .select(POST_SELECT)
    .order("created_at", { ascending: false })
    .limit(limit);
  throwIfError(error);
  return data || [];
}

export async function createForumPost({ title, body, postType, program = null }) {
  const authorId = await requireUserId();
  const { data, error } = await supabase
    .from("forum_posts")
    .insert({
      author_id: authorId,
      course_id: null,
      program: program || null,
      post_type: postType,
      title,
      body,
    })
    .select(POST_SELECT)
    .single();
  throwIfError(error);
  return data;
}

export async function deleteForumPost(postId) {
  const { error } = await supabase.from("forum_posts").delete().eq("id", postId);
  throwIfError(error);
}

export async function listForumComments(postId) {
  const { data, error } = await supabase
    .from("forum_comments")
    .select(COMMENT_SELECT)
    .eq("post_id", postId)
    .order("created_at", { ascending: true });
  throwIfError(error);
  return data || [];
}

export async function createForumComment(postId, body) {
  const authorId = await requireUserId();
  const { data, error } = await supabase
    .from("forum_comments")
    .insert({ post_id: postId, author_id: authorId, body })
    .select(COMMENT_SELECT)
    .single();
  throwIfError(error);
  return data;
}

export async function deleteForumComment(commentId) {
  const { error } = await supabase.from("forum_comments").delete().eq("id", commentId);
  throwIfError(error);
}

export async function listForumAuthorProfiles(userIds = []) {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  if (!uniqueIds.length) return [];
  if (uniqueIds.length > 100) throw new Error("Daftar penulis terlalu besar.");
  const { data, error } = await supabase.rpc("get_forum_author_profiles", {
    p_user_ids: uniqueIds,
  });
  throwIfError(error);
  return data || [];
}
