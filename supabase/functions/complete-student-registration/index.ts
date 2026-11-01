// This source mirrors the deployed complete-student-registration Edge Function v4.
// The Supabase Dashboard remains the source of truth until this function is deployed from this repository.
import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const UT_FACULTY_PROGRAMS: Record<string, string[]> = {
  "Fakultas Ekonomi dan Bisnis (FEB)": ["Manajemen", "Ekonomi Pembangunan", "Ekonomi Syariah", "Akuntansi", "Akuntansi Keuangan Publik", "Pariwisata", "Kewirausahaan"],
  "Fakultas Hukum, Ilmu Sosial, dan Ilmu Politik (FHISIP)": ["Ilmu Administrasi Publik", "Administrasi Bisnis", "Hukum", "Ilmu Pemerintahan", "Ilmu Komunikasi", "Perpustakaan dan Sains Informasi", "Sosiologi", "Sastra Inggris", "Perpajakan"],
  "Fakultas Keguruan dan Ilmu Pendidikan (FKIP)": ["Pendidikan Bahasa dan Sastra Indonesia", "Pendidikan Bahasa Inggris", "Pendidikan Biologi", "Pendidikan Fisika", "Pendidikan Kimia", "Pendidikan Matematika", "Pendidikan Ekonomi", "Pendidikan Pancasila dan Kewarganegaraan", "Teknologi Pendidikan", "Pendidikan Guru Sekolah Dasar (PGSD)", "Pendidikan Guru Pendidikan Anak Usia Dini (PGPAUD)", "Pendidikan Agama Islam (PAI)"],
  "Fakultas Sains dan Teknologi (FST)": ["Statistika", "Matematika", "Biologi", "Teknologi Pangan", "Agribisnis", "Perencanaan Wilayah dan Kota", "Sistem Informasi", "Sains Data"],
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};
function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function readNamedKey(envName: string, name = "default"): string | undefined {
  const raw = Deno.env.get(envName);
  if (!raw) return undefined;
  try { const parsed = JSON.parse(raw); return typeof parsed?.[name] === "string" ? parsed[name] : undefined; } catch { return undefined; }
}
function validText(value: unknown, min: number, max: number): value is string { return typeof value === "string" && value.trim().length >= min && value.trim().length <= max; }
async function hmacNim(nim: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(nim));
  return Array.from(new Uint8Array(signature)).map(byte => byte.toString(16).padStart(2, "0")).join("");
}
function createAdminClient(url: string, serviceRoleKey?: string, secretKey?: string) {
  if (serviceRoleKey) return createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  if (!secretKey) return null;
  const keyOnlyFetch: typeof fetch = async (input, init = {}) => { const headers = new Headers(init.headers); headers.delete("Authorization"); headers.set("apikey", secretKey); return fetch(input, { ...init, headers }); };
  return createClient(url, secretKey, { auth: { autoRefreshToken: false, persistSession: false }, global: { fetch: keyOnlyFetch } });
}
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return jsonResponse({ error: "Silakan masuk terlebih dahulu." }, 401);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? readNamedKey("SUPABASE_PUBLISHABLE_KEYS") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const admin = supabaseUrl ? createAdminClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), readNamedKey("SUPABASE_SECRET_KEYS")) : null;
  const nimHmacSecret = Deno.env.get("NIM_HMAC_SECRET");
  if (!supabaseUrl || !anonKey) return jsonResponse({ error: "Konfigurasi Auth server belum lengkap." }, 503);
  if (!admin) return jsonResponse({ error: "Kunci admin server belum tersedia." }, 503);
  if (!nimHmacSecret || nimHmacSecret.length < 32) return jsonResponse({ error: "NIM HMAC secret belum dikonfigurasi di server." }, 503);
  try {
    const userClient = createClient(supabaseUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: userResult, error: userError } = await userClient.auth.getUser(token);
    const user = userResult?.user;
    if (userError || !user) return jsonResponse({ error: "Sesi tidak valid. Silakan masuk kembali." }, 401);
    if (!user.email_confirmed_at) return jsonResponse({ error: "Email belum dikonfirmasi oleh penyedia akun. Coba masuk kembali." }, 403);
    let payload: Record<string, unknown>;
    try { payload = await req.json(); } catch { return jsonResponse({ error: "Data formulir tidak valid." }, 400); }
    const fullName = typeof payload.full_name === "string" ? payload.full_name.trim() : "";
    const nim = typeof payload.nim === "string" ? payload.nim.trim() : "";
    const faculty = typeof payload.faculty === "string" ? payload.faculty.trim() : "";
    const program = typeof payload.program === "string" ? payload.program.trim() : "";
    const semester = Number(payload.semester); const lat = Number(payload.lat); const lng = Number(payload.lng);
    const locationConsent = payload.location_consent === true;
    if (!validText(fullName, 2, 100)) return jsonResponse({ error: "Nama lengkap harus 2–100 karakter." }, 400);
    if (!/^\d{9}$/.test(nim)) return jsonResponse({ error: "Format NIM saat ini harus 9 digit. Format resmi UT masih perlu dikonfirmasi." }, 400);
    if (!UT_FACULTY_PROGRAMS[faculty]) return jsonResponse({ error: "Pilih fakultas yang tercantum pada daftar resmi UT." }, 400);
    if (!UT_FACULTY_PROGRAMS[faculty].includes(program)) return jsonResponse({ error: "Program studi tidak sesuai dengan fakultas yang dipilih." }, 400);
    if (!Number.isInteger(semester) || semester < 1 || semester > 16) return jsonResponse({ error: "Semester harus dipilih antara 1 dan 16." }, 400);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) return jsonResponse({ error: "Tandai lokasi belajar pada peta terlebih dahulu." }, 400);
    if (!locationConsent) return jsonResponse({ error: "Persetujuan penggunaan lokasi diperlukan untuk fitur peta sekitar." }, 400);
    const nimDigest = await hmacNim(nim, nimHmacSecret);
    const { error: registerError } = await admin.rpc("create_student_profile_with_location", { p_user_id: user.id, p_full_name: fullName, p_nim_digest: nimDigest, p_faculty: faculty, p_program: program, p_semester: semester, p_lat: lat, p_lng: lng });
    if (registerError) {
      if (registerError.code === "23505") { if (registerError.message?.includes("nim_digest")) return jsonResponse({ error: "NIM ini sudah terdaftar pada akun lain." }, 409); return jsonResponse({ error: "Profil untuk akun ini sudah dibuat. Silakan masuk." }, 409); }
      if (registerError.code === "22023") return jsonResponse({ error: registerError.message }, 400);
      return jsonResponse({ error: "Profil belum dapat disimpan. Silakan coba kembali." }, 500);
    }
    return jsonResponse({ success: true, profile: { id: user.id, full_name: fullName, faculty, program, semester, verification_status: "pending" }, message: "Profil tersimpan. Verifikasi status mahasiswa masih menunggu pemeriksaan." }, 201);
  } catch { return jsonResponse({ error: "Terjadi kendala saat membuat profil. Silakan coba kembali." }, 500); }
});
