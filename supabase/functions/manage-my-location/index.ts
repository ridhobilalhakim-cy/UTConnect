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

    let payload: Record<string, unknown>;
    try {
      payload = await req.json();
    } catch {
      return json({ error: "Permintaan lokasi tidak valid." }, 400);
    }

    const action = payload.action;
    if (action === "get") {
      const { data, error } = await admin.rpc("get_my_location", { p_user_id: user.id });
      if (error) return json({ error: "Lokasi akun belum dapat dimuat." }, 500);
      const location = Array.isArray(data) ? data[0] ?? null : data ?? null;
      return json({ location });
    }

    if (action === "save") {
      const lat = payload.lat;
      const lng = payload.lng;
      const showInRadar = payload.show_in_radar;
      if (typeof lat !== "number" || !Number.isFinite(lat) || lat < -90 || lat > 90
        || typeof lng !== "number" || !Number.isFinite(lng) || lng < -180 || lng > 180) {
        return json({ error: "Koordinat lokasi tidak valid." }, 400);
      }
      if (payload.consent !== true || typeof showInRadar !== "boolean") {
        return json({ error: "Persetujuan lokasi dan pengaturan visibilitas harus dipilih." }, 400);
      }
      const { error } = await admin.rpc("save_my_location", {
        p_user_id: user.id,
        p_lat: lat,
        p_lng: lng,
        p_consent: true,
        p_show_in_radar: showInRadar,
      });
      if (error) {
        console.error("Location save failed:", error);
        return json({ error: "Lokasi belum berhasil disimpan. Silakan coba kembali." }, 500);
      }
      return json({ success: true, message: "Lokasi akun berhasil diperbarui." });
    }

    if (action === "visibility") {
      if (typeof payload.show_in_radar !== "boolean") {
        return json({ error: "Pengaturan visibilitas tidak valid." }, 400);
      }
      if (payload.show_in_radar && payload.consent !== true) {
        return json({ error: "Persetujuan tampil di radar diperlukan." }, 400);
      }
      const { data, error } = await admin.rpc("set_my_location_visibility", {
        p_user_id: user.id,
        p_show_in_radar: payload.show_in_radar,
        p_consent: payload.consent === true,
      });
      if (error) {
        console.error("Location visibility update failed:", error);
        return json({ error: "Pengaturan privasi lokasi belum berhasil disimpan." }, 500);
      }
      return json({ success: true, show_in_radar: data === true });
    }

    return json({ error: "Aksi lokasi tidak dikenali." }, 400);
  } catch (error) {
    console.error("Manage location request failed:", error);
    return json({ error: "Terjadi kendala saat memproses lokasi." }, 500);
  }
});
