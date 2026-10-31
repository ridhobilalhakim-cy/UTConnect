import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function readNamedKey(envName: string, name = "default"): string | undefined {
  const raw = Deno.env.get(envName);
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed?.[name] === "string" ? parsed[name] : undefined;
  } catch {
    return undefined;
  }
}

function createAdminClient(url: string, serviceRoleKey?: string, secretKey?: string) {
  if (serviceRoleKey) {
    return createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  }
  if (!secretKey) return null;
  const keyOnlyFetch: typeof fetch = async (input, init = {}) => {
    const headers = new Headers(init.headers);
    headers.delete("Authorization");
    headers.set("apikey", secretKey);
    return fetch(input, { ...init, headers });
  };
  return createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: keyOnlyFetch },
  });
}

async function hmacNim(nim: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(nim));
  return Array.from(new Uint8Array(signature))
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return json({ error: "Silakan masuk terlebih dahulu." }, 401);

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")
    ?? readNamedKey("SUPABASE_PUBLISHABLE_KEYS")
    ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  if (!url || !anonKey) return json({ error: "Konfigurasi Auth server belum lengkap." }, 503);

  try {
    const userClient = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: authData, error: authError } = await userClient.auth.getUser(token);
    const user = authData?.user;
    if (authError || !user) return json({ error: "Sesi tidak valid. Silakan masuk kembali." }, 401);

    let payload: Record<string, unknown>;
    try {
      payload = await req.json();
    } catch {
      return json({ error: "Permintaan undangan tidak valid." }, 400);
    }

    if (payload.action === "cancel") {
      if (typeof payload.invite_id !== "string" || !UUID_PATTERN.test(payload.invite_id)) {
        return json({ error: "ID undangan tidak valid." }, 400);
      }
      const { error } = await userClient.rpc("cancel_group_invite", {
        p_actor_id: user.id,
        p_invite_id: payload.invite_id,
      });
      if (error) {
        console.error("Group invite cancellation failed:", error);
        return json({ error: "Undangan tidak dapat dibatalkan. Periksa akses dan status undangan." }, 403);
      }
      return json({ success: true });
    }

    if (payload.action !== "invite_by_nim") {
      return json({ error: "Aksi undangan tidak dikenali." }, 400);
    }

    if (typeof payload.group_id !== "string" || !UUID_PATTERN.test(payload.group_id)) {
      return json({ error: "Grup tujuan tidak valid." }, 400);
    }
    const nim = typeof payload.nim === "string" ? payload.nim.trim() : "";
    if (!/^\d{9}$/.test(nim)) return json({ error: "Masukkan NIM lengkap 9 digit." }, 400);

    const nimSecret = Deno.env.get("NIM_HMAC_SECRET");
    if (!nimSecret || nimSecret.length < 32) {
      return json({ error: "Pencarian undangan belum dikonfigurasi di server." }, 503);
    }
    const admin = createAdminClient(
      url,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
      readNamedKey("SUPABASE_SECRET_KEYS"),
    );
    if (!admin) return json({ error: "Kunci admin server belum tersedia." }, 503);

    const { error: rateError } = await userClient.rpc("consume_group_invite_search_limit", {
      p_actor_id: user.id,
    });
    if (rateError) {
      if (rateError.message?.includes("GROUP_INVITE_RATE_LIMIT")) {
        return json({ error: "Terlalu banyak pencarian undangan. Coba kembali sebentar lagi." }, 429);
      }
      if (rateError.code === "42501") return json({ error: "Hanya mahasiswa terverifikasi yang dapat mengundang anggota." }, 403);
      console.error("Group invite rate check failed:", rateError);
      return json({ error: "Layanan undangan belum dapat digunakan." }, 503);
    }

    const digest = await hmacNim(nim, nimSecret);
    const { data: invitee, error: lookupError } = await admin
      .from("profiles")
      .select("id")
      .eq("nim_digest", digest)
      .eq("verification_status", "verified")
      .maybeSingle();

    if (lookupError) {
      console.error("Group invite recipient lookup failed:", lookupError);
      return json({ error: "Mahasiswa tujuan belum dapat diperiksa." }, 503);
    }
    if (!invitee?.id) return json({ error: "NIM tidak ditemukan pada mahasiswa terverifikasi." }, 404);

    const { data: inviteId, error: inviteError } = await userClient.rpc("create_group_invite", {
      p_actor_id: user.id,
      p_group_id: payload.group_id,
      p_invited_user_id: invitee.id,
    });
    if (inviteError) {
      console.error("Group invite creation failed:", inviteError);
      const message = inviteError.message || "";
      if (message.includes("Authenticated actor mismatch") || inviteError.code === "42501") {
        return json({ error: "Hanya admin grup privat yang dapat mengundang anggota terverifikasi." }, 403);
      }
      if (message.includes("already a member") || message.includes("Private group")) {
        return json({ error: "Mahasiswa tersebut tidak dapat menerima undangan untuk grup ini." }, 409);
      }
      return json({ error: "Undangan belum berhasil dibuat. Periksa grup dan kapasitasnya." }, 400);
    }

    return json({ success: true, invite_id: inviteId, message: "Undangan grup berhasil dikirim." }, 201);
  } catch (error) {
    console.error("Group invitation request failed:", error);
    return json({ error: "Terjadi kendala saat memproses undangan." }, 500);
  }
});
