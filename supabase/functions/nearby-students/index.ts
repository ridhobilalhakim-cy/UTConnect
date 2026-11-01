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
  return Array.from(new Uint8Array(signature)).map(byte => byte.toString(16).padStart(2, "0")).join("");
}

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
  const admin = url
    ? createAdminClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), readNamedKey("SUPABASE_SECRET_KEYS"))
    : null;
  if (!url || !anonKey) return json({ error: "Konfigurasi Auth server belum lengkap." }, 503);
  if (!admin) return json({ error: "Kunci admin server belum tersedia." }, 503);

  try {
    const userClient = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: authData, error: authError } = await userClient.auth.getUser(token);
    const user = authData?.user;
    if (authError || !user) return json({ error: "Sesi tidak valid. Silakan masuk kembali." }, 401);

    const demoModeEnabled = Deno.env.get("UTCONNECT_DEMO_MODE") === "true";
    let profile: { verification_status?: string; is_demo?: boolean } | null = null;
    let profileError: { message: string } | null = null;
    if (demoModeEnabled) {
      // The normal project's generated DB types intentionally do not include demo-only columns.
      // Keep the demo-only select inside an explicit, server-configured branch.
      const demoProfiles = admin.from("profiles") as any;
      const result = await demoProfiles
        .select("verification_status,is_demo")
        .eq("id", user.id)
        .maybeSingle();
      profile = result.data as { verification_status?: string; is_demo?: boolean } | null;
      profileError = result.error;
    } else {
      const result = await admin
        .from("profiles")
        .select("verification_status")
        .eq("id", user.id)
        .maybeSingle();
      profile = result.data as { verification_status?: string; is_demo?: boolean } | null;
      profileError = result.error;
    }
    if (profileError) return json({ error: "Status verifikasi belum dapat diperiksa." }, 500);
    if (profile?.verification_status !== "verified" && !(demoModeEnabled && profile?.is_demo === true)) {
      return json({ error: "Peta mahasiswa sekitar hanya tersedia untuk mahasiswa terverifikasi." }, 403);
    }

    let payload: Record<string, unknown>;
    try {
      payload = await req.json();
    } catch {
      return json({ error: "Permintaan pencarian tidak valid." }, 400);
    }

    const radius = payload.radius;
    if (![1000, 3000, 5000].includes(radius as number)) {
      return json({ error: "Radius pencarian harus 1, 3, atau 5 km." }, 400);
    }
    const nim = payload.nim === undefined || payload.nim === null ? "" : String(payload.nim).trim();
    if (nim && !/^\d{9}$/.test(nim)) {
      return json({ error: "Masukkan NIM lengkap 9 digit." }, 400);
    }

    const { error: limitError } = await admin.rpc("consume_nearby_search_limit", { p_viewer_id: user.id });
    if (limitError) {
      if (limitError.message?.includes("NEARBY_RATE_LIMIT")) {
        return json({ error: "Terlalu banyak pencarian. Coba kembali sebentar lagi." }, 429);
      }
      console.error("Nearby rate-limit check failed:", limitError);
      return json({ error: "Layanan pencarian belum dapat digunakan." }, 503);
    }

    let nimDigest: string | null = null;
    if (nim) {
      const nimSecret = Deno.env.get("NIM_HMAC_SECRET");
      if (!nimSecret || nimSecret.length < 32) {
        return json({ error: "Pencarian NIM belum dikonfigurasi di server." }, 503);
      }
      nimDigest = await hmacNim(nim, nimSecret);
    }

    const { data, error } = await admin.rpc("find_nearby_students", {
      p_viewer_id: user.id,
      p_radius_m: radius,
      p_nim_digest: nimDigest,
    });
    if (error) {
      if (error.message?.includes("rate limit")) {
        return json({ error: "Terlalu banyak pencarian NIM. Coba kembali sebentar lagi." }, 429);
      }
      console.error("Nearby students query failed:", error);
      return json({ error: "Mahasiswa sekitar belum dapat dimuat." }, 500);
    }

    const results = (Array.isArray(data) ? data : []).map((row: Record<string, unknown>) => ({
      initials: row.initials,
      program: row.program,
      approx_distance_m: row.approx_distance_m,
      marker_lat: row.marker_lat,
      marker_lng: row.marker_lng,
      is_demo: demoModeEnabled && row.is_demo === true,
    }));
    return json({
      radius,
      results,
      privacy: "Koordinat asli dan NIM lengkap tidak dikirim ke browser.",
      message: results.length ? null : "Tidak ditemukan mahasiswa terverifikasi yang tampil di radar pada radius ini.",
    });
  } catch (error) {
    console.error("Nearby students request failed:", error);
    return json({ error: "Terjadi kendala saat mencari mahasiswa sekitar." }, 500);
  }
});
