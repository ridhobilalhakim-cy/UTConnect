import { createClient, type SupabaseClient, type User } from "npm:@supabase/supabase-js@2.118.0";

const PROGRAMS = [
  { key: "a", name: "Demo A — Sistem Informasi", faculty: "Fakultas Sains dan Teknologi (FST)", program: "Sistem Informasi", semester: 5, topics: ["analisis sistem", "basis data", "pemrograman"], interests: ["proyek aplikasi", "belajar kelompok"], times: ["Malam hari", "Akhir pekan"] },
  { key: "b", name: "Demo B — Manajemen", faculty: "Fakultas Ekonomi dan Bisnis (FEB)", program: "Manajemen", semester: 4, topics: ["manajemen operasi", "pemasaran", "strategi bisnis"], interests: ["diskusi kasus", "persiapan UAS"], times: ["Pagi hari", "Malam hari"] },
  { key: "c", name: "Demo C — Akuntansi", faculty: "Fakultas Ekonomi dan Bisnis (FEB)", program: "Akuntansi", semester: 6, topics: ["akuntansi biaya", "laporan keuangan", "audit"], interests: ["latihan soal", "ringkasan materi"], times: ["Siang hari", "Akhir pekan"] },
  { key: "d", name: "Demo D — Ilmu Komunikasi", faculty: "Fakultas Hukum, Ilmu Sosial, dan Ilmu Politik (FHISIP)", program: "Ilmu Komunikasi", semester: 3, topics: ["komunikasi organisasi", "media digital"], interests: ["presentasi", "diskusi"], times: ["Malam hari"] },
  { key: "e", name: "Demo E — Pendidikan Bahasa Inggris", faculty: "Fakultas Keguruan dan Ilmu Pendidikan (FKIP)", program: "Pendidikan Bahasa Inggris", semester: 5, topics: ["reading", "academic writing", "grammar"], interests: ["praktik bahasa", "peer review"], times: ["Pagi hari", "Akhir pekan"] },
  { key: "f", name: "Demo F — Sains Data", faculty: "Fakultas Sains dan Teknologi (FST)", program: "Sains Data", semester: 2, topics: ["statistika", "analisis data", "visualisasi"], interests: ["eksperimen data", "belajar mandiri"], times: ["Siang hari", "Malam hari"] },
] as const;

type DemoBot = { key: string; userId: string; name: string; program: string };
type DemoContext = { admin: SupabaseClient; actor: User; visitorId: string; sessionId: string; origin: string };

function cors(origin: string) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "600",
    "Vary": "Origin",
  };
}

function json(origin: string, value: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...cors(origin), "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function randomPassword() {
  const random = Array.from(crypto.getRandomValues(new Uint8Array(40)), b => b.toString(16).padStart(2, "0")).join("");
  // The prefix guarantees mixed case, digits, and symbols for stricter Auth password policies.
  return "UTc!9-" + random + "Z";
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
}

function campusPoint(index: number) {
  // Only synthetic points around the public UT Pondok Cabe campus area, never home locations.
  const center = { lat: -6.3429, lng: 106.7428 };
  const bearings = [15, 66, 124, 188, 241, 306, 350];
  const distances = [180, 320, 470, 610, 760, 890, 1040];
  const angle = bearings[index % bearings.length] * Math.PI / 180;
  const distance = distances[index % distances.length];
  return {
    lat: center.lat + distance * Math.cos(angle) / 111320,
    lng: center.lng + distance * Math.sin(angle) / (111320 * Math.cos(center.lat * Math.PI / 180)),
  };
}

function unwrap<T>(result: { data: T; error: { message: string } | null }, label: string): T {
  if (result.error) throw new Error(label + ": " + result.error.message);
  return result.data;
}

async function adminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  let secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEY");
  if (!secret) {
    try {
      const values = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
      secret = values.default || Object.values(values)[0] as string;
    } catch {
      secret = "";
    }
  }
  if (!url || !secret) throw new Error("Konfigurasi kunci server Demo Mode belum lengkap.");
  return createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function requestContext(req: Request, origin: string, action: string, scenario = "all"): Promise<DemoContext> {
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  if (!url || !anon) throw new Error("Konfigurasi Auth Demo Mode belum lengkap.");
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("Sesi login tidak ditemukan.");
  const admin = await adminClient();
  const userClient = createClient(url, anon, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: "Bearer " + token } },
  });
  const { data: authResult, error: authError } = await userClient.auth.getUser(token);
  if (authError || !authResult.user) throw new Error("Sesi Demo Mode tidak valid.");
  const visitorId = authResult.user.id;
  const { data: currentResult, error: currentError } = await admin.auth.admin.getUserById(visitorId);
  if (currentError || !currentResult.user) throw new Error("Identitas akun demo tidak dapat diperiksa.");
  const actor = currentResult.user;

  if (action === "bootstrap") {
    const isNewAnonymous = actor.is_anonymous === true;
    const isExistingVisitor = actor.app_metadata?.utconnect_demo_role === "visitor";
    if (!isNewAnonymous && !isExistingVisitor) throw new Error("Hanya sesi pengunjung demo yang dapat memulai simulasi.");
    const { data: sessionId, error: sessionError } = await admin.rpc("demo_create_session", { p_visitor_user_id: visitorId });
    if (sessionError || !sessionId) throw new Error("Sesi demo tidak dapat dibuat: " + (sessionError?.message || "respons kosong"));
    const { data: profile, error: profileError } = await admin.from("profiles")
      .select("id,is_demo,demo_session_id")
      .eq("id", visitorId).maybeSingle();
    if (profileError) throw new Error("Profil demo tidak dapat diperiksa: " + profileError.message);
    if (!profile) {
      const digest = await sha256("UTCONNECT-DEMO-VISITOR-NOT-A-REAL-NIM:" + sessionId);
      unwrap(await admin.from("profiles").insert({
        id: visitorId,
        full_name: "Demo Pengunjung",
        nim_digest: digest,
        faculty: "Fakultas Sains dan Teknologi (FST)",
        program: "Sistem Informasi",
        semester: 5,
        verification_status: "pending",
        bio: "Akun simulasi untuk mencoba fitur UTConnect. Bukan mahasiswa sungguhan.",
      }), "Profil pengunjung demo gagal dibuat");
    } else if (profile.is_demo !== true || profile.demo_session_id !== sessionId) {
      throw new Error("Profil yang terhubung ke sesi ini bukan profil DEMO.");
    }
    const { data: refreshedActor } = await admin.auth.admin.getUserById(visitorId);
    const metadata = refreshedActor?.user?.app_metadata || {};
    const { error: scenarioError } = await admin.auth.admin.updateUserById(visitorId, {
      app_metadata: { ...metadata, utconnect_demo_scenario: scenario },
    });
    if (scenarioError) throw new Error("Pilihan skenario demo belum berhasil disimpan.");
    return { admin, actor, visitorId, sessionId, origin };
  }

  const role = actor.app_metadata?.utconnect_demo_role;
  if (role !== "visitor") throw new Error("Aksi ini hanya tersedia bagi pengunjung demo.");
  const { data: profile, error: profileError } = await admin.from("profiles")
    .select("id,is_demo,demo_session_id").eq("id", visitorId).maybeSingle();
  if (profileError || profile?.is_demo !== true || !profile.demo_session_id) {
    throw new Error("Akun bukan bagian dari lingkungan demo.");
  }
  const { data: sessionId, error: sessionError } = await admin.rpc("demo_get_session", { p_visitor_user_id: visitorId });
  if (sessionError || !sessionId || sessionId !== profile.demo_session_id) {
    throw new Error("Sesi demo sudah berakhir. Silakan mulai ulang Demo Mode.");
  }
  return { admin, actor, visitorId, sessionId, origin };
}

async function createBot(admin: SupabaseClient, sessionId: string, spec: typeof PROGRAMS[number], index: number): Promise<DemoBot> {
  const { data: existing, error: existingError } = await admin.from("profiles")
    .select("id,full_name,program")
    .eq("is_demo", true)
    .eq("demo_session_id", sessionId)
    .eq("full_name", spec.name)
    .maybeSingle();
  if (existingError) throw new Error("Pemeriksaan bot demo gagal: " + existingError.message);

  let id: string;
  if (existing) {
    id = existing.id;
  } else {
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: "demo-" + sessionId + "-" + spec.key + "@utconnect.invalid",
      password: randomPassword(),
      email_confirm: true,
      app_metadata: {
        utconnect_demo_role: "bot",
        utconnect_demo_session: sessionId,
        utconnect_demo_bot_key: spec.key,
      },
      user_metadata: { full_name: spec.name },
    });
    if (createError || !created.user) {
      throw new Error("Akun bot " + spec.key.toUpperCase() + " gagal dibuat: " + (createError?.message || ""));
    }
    id = created.user.id;
    const digest = await sha256("UTCONNECT-DEMO-NOT-A-REAL-NIM:" + sessionId + ":" + spec.key + ":" + crypto.randomUUID());
    unwrap(await admin.from("profiles").insert({
      id,
      full_name: spec.name,
      nim_digest: digest,
      faculty: spec.faculty,
      program: spec.program,
      semester: spec.semester,
      verification_status: "pending",
      bio: "Akun simulasi UTConnect. " + spec.name + " bukan mahasiswa sungguhan.",
    }), "Profil bot gagal dibuat");
  }

  // Re-apply these idempotently so a retry can recover from an interrupted first seed.
  const point = campusPoint(index);
  unwrap(await admin.rpc("save_my_location", {
    p_user_id: id,
    p_lat: point.lat,
    p_lng: point.lng,
    p_consent: true,
    p_show_in_radar: true,
  }), "Lokasi sintetis bot gagal dibuat");
  unwrap(await admin.from("matching_preferences").upsert({
    user_id: id,
    topic_tags: [...spec.topics],
    interests: [...spec.interests],
    study_times: [...spec.times],
    preferred_programs: [spec.program],
  }, { onConflict: "user_id" }), "Preferensi bot gagal dibuat");

  return { key: spec.key, userId: id, name: spec.name, program: spec.program };
}
async function insertGroup(admin: SupabaseClient, sessionId: string, creator: string, name: string, program: string,
  description: string, capacity: number, access: "open" | "approval" | "private",
  members: Array<{ userId: string; role?: "admin" | "co_admin" | "member" }>) {
  const { data: existing, error: lookupError } = await admin.from("study_groups")
    .select("id,name")
    .eq("is_demo", true)
    .eq("demo_session_id", sessionId)
    .eq("name", name)
    .maybeSingle();
  if (lookupError) throw new Error("Pemeriksaan kelompok demo gagal: " + lookupError.message);

  let group = existing;
  if (!group) {
    const { data, error } = await admin.from("study_groups").insert({
      created_by: creator, name, program, description, mode: "online", capacity,
      access_type: access, schedule_text: "Skenario demo · jadwal dapat diubah",
      is_archived: false,
    }).select("id,name").single();
    if (error || !data) throw new Error("Kelompok demo gagal dibuat: " + (error?.message || "respons kosong"));
    group = data;
  }

  // The database trigger creates the creator as admin. Upsert only the other seed members.
  const additionalMembers = members.filter(item => item.userId !== creator);
  if (additionalMembers.length) {
    unwrap(await admin.from("group_members").upsert(additionalMembers.map(item => ({
      group_id: group.id, user_id: item.userId, role: item.role || "member",
      status: "active", joined_at: new Date().toISOString(),
    })), { onConflict: "group_id,user_id" }), "Anggota kelompok demo gagal dibuat");
  }
  return group;
}

async function addGroupMessage(admin: SupabaseClient, groupId: string, senderId: string, body: string) {
  const { data: existing, error: lookupError } = await admin.from("group_messages")
    .select("id")
    .eq("group_id", groupId)
    .eq("sender_id", senderId)
    .eq("body", body)
    .limit(1)
    .maybeSingle();
  if (lookupError) throw new Error("Pemeriksaan pesan demo gagal: " + lookupError.message);
  if (existing) return existing.id;

  const { data, error } = await admin.from("group_messages").insert({
    group_id: groupId, sender_id: senderId, body, mentioned_user_ids: [],
  }).select("id").single();
  if (error || !data) throw new Error("Pesan awal grup demo gagal dibuat: " + (error?.message || ""));
  return data.id;
}

async function addDirectMessage(admin: SupabaseClient, connectionId: string, senderId: string, body: string) {
  const { data: existing, error: lookupError } = await admin.from("direct_messages")
    .select("id")
    .eq("connection_id", connectionId)
    .eq("sender_id", senderId)
    .eq("body", body)
    .limit(1)
    .maybeSingle();
  if (lookupError) throw new Error("Pemeriksaan pesan pribadi demo gagal: " + lookupError.message);
  if (existing) return existing.id;

  const { data, error } = await admin.from("direct_messages").insert({
    connection_id: connectionId, sender_id: senderId, body,
  }).select("id").single();
  if (error || !data) throw new Error("Pesan pribadi demo gagal dibuat: " + (error?.message || ""));
  return data.id;
}

async function ensureConnection(admin: SupabaseClient, initiatorId: string, recipientId: string, initialStatus: "pending" | "accepted") {
  const { data: existing, error: lookupError } = await admin.from("connections")
    .select("id,status")
    .eq("initiator_id", initiatorId)
    .eq("recipient_id", recipientId)
    .maybeSingle();
  if (lookupError) throw new Error("Pemeriksaan koneksi demo gagal: " + lookupError.message);
  if (existing) return existing;

  const { data, error } = await admin.from("connections").insert({
    initiator_id: initiatorId, recipient_id: recipientId, status: initialStatus,
  }).select("id,status").single();
  if (error || !data) throw new Error("Koneksi demo gagal dibuat: " + (error?.message || ""));
  return data;
}

async function addAgenda(admin: SupabaseClient, groupId: string, creatorId: string,
  type: string, title: string, details: string, options: string[] | null = null) {
  const { data: existing, error: lookupError } = await admin.from("group_agenda_items")
    .select("id")
    .eq("group_id", groupId)
    .eq("title", title)
    .maybeSingle();
  if (lookupError) throw new Error("Pemeriksaan agenda demo gagal: " + lookupError.message);
  if (existing) return existing.id as string;

  const { data, error } = await admin.from("group_agenda_items").insert({
    group_id: groupId, created_by: creatorId, item_type: type, title, details,
    due_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    poll_options: options,
  }).select("id").single();
  if (error || !data) throw new Error("Agenda demo gagal dibuat: " + (error?.message || "respons kosong"));
  return data.id as string;
}


function pdfBytes() {
  const pdf = "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 180]/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>endobj\n4 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n5 0 obj<</Length 76>>stream\nBT /F1 14 Tf 24 130 Td (UTConnect DEMO - Materi Simulasi) Tj 0 -24 Td (Data fiktif.) Tj ET\nendstream endobj\ntrailer<</Root 1 0 R>>\n%%EOF";
  return new TextEncoder().encode(pdf);
}

async function seedSession(ctx: DemoContext, scenario: string) {
  const { admin, visitorId, sessionId } = ctx;
  const bots: DemoBot[] = [];
  for (let i = 0; i < PROGRAMS.length; i += 1) bots.push(await createBot(admin, sessionId, PROGRAMS[i], i));
  const bot = Object.fromEntries(bots.map(item => [item.key, item])) as Record<string, DemoBot>;

  unwrap(await admin.rpc("save_my_location", {
    p_user_id: visitorId,
    p_lat: -6.3429,
    p_lng: 106.7428,
    p_consent: true,
    p_show_in_radar: true,
  }), "Lokasi sintetis pengunjung demo gagal disimpan");
  unwrap(await admin.from("matching_preferences").upsert({
    user_id: visitorId,
    topic_tags: ["basis data", "analisis sistem", "persiapan UAS"],
    interests: ["belajar kelompok", "diskusi materi"],
    study_times: ["Malam hari", "Akhir pekan"],
    preferred_programs: [],
  }, { onConflict: "user_id" }), "Preferensi pengunjung demo gagal disimpan");

  const accepted = await ensureConnection(admin, visitorId, bot.b.userId, "accepted");
  await addDirectMessage(admin, accepted.id, bot.b.userId, "[SIMULASI DEMO] Halo! Aku Demo B dari Manajemen. Kita bisa diskusi materi bersama.");
  await addDirectMessage(admin, accepted.id, visitorId, "[SIMULASI DEMO] Siap, kita bahas materi bareng.");
  await ensureConnection(admin, bot.c.userId, visitorId, "pending");

  const open = await insertGroup(admin, sessionId, bot.a.userId, "Kelompok Sistem Informasi — Terbuka", "Sistem Informasi",
    "Ruang belajar simulasi dengan beberapa tempat tersedia.", 8, "open",
    [{ userId: bot.a.userId, role: "admin" }, { userId: bot.b.userId }, { userId: bot.f.userId }]);
  const nearlyFull = await insertGroup(admin, bot.b.userId, "Kelompok Manajemen — Hampir Penuh", "Manajemen",
    "Skenario kapasitas 3 dari 4 anggota aktif.", 4, "open",
    [{ userId: bot.b.userId, role: "admin" }, { userId: bot.c.userId }, { userId: bot.d.userId }]);
  const full = await insertGroup(admin, bot.c.userId, "Kelompok Akuntansi — Penuh", "Akuntansi",
    "Skenario kapasitas maksimum; backend harus menolak anggota baru.", 3, "open",
    [{ userId: bot.c.userId, role: "admin" }, { userId: bot.d.userId }, { userId: bot.e.userId }]);
  const approval = await insertGroup(admin, bot.e.userId, "Kelompok Bahasa Inggris — Persetujuan", "Pendidikan Bahasa Inggris",
    "Permintaan anggota diproses oleh admin bot simulasi.", 5, "approval",
    [{ userId: bot.e.userId, role: "admin" }, { userId: bot.f.userId }]);
  const privateGroup = await insertGroup(admin, bot.f.userId, "Kelompok Diskusi Privat — Undangan", "Sains Data",
    "Grup privat yang hanya dapat dimasuki melalui undangan.", 5, "private",
    [{ userId: bot.f.userId, role: "admin" }, { userId: bot.a.userId }]);
  unwrap(await admin.from("group_invites").upsert({
    group_id: privateGroup.id, invited_user_id: visitorId, invited_by: bot.f.userId, accepted_at: null,
  }, { onConflict: "group_id,invited_user_id" }), "Undangan grup privat demo gagal dibuat");

  await addGroupMessage(admin, open.id, bot.a.userId, "[SIMULASI DEMO] Kita mulai diskusi analisis kebutuhan sistem.");
  await addGroupMessage(admin, nearlyFull.id, bot.b.userId, "[SIMULASI DEMO] Sisa satu tempat di kelompok ini.");
  await addGroupMessage(admin, full.id, bot.c.userId, "[SIMULASI DEMO] Kelompok sudah penuh.");
  await addGroupMessage(admin, approval.id, bot.e.userId, "[SIMULASI DEMO] Permintaan anggota akan diperiksa admin.");
  await addGroupMessage(admin, privateGroup.id, bot.f.userId, "[SIMULASI DEMO] Undangan privat sudah tersedia.");

  const pollId = await addAgenda(admin, open.id, bot.a.userId, "poll", "Waktu diskusi berikutnya", "Pilih waktu belajar bersama.", ["Sabtu pagi", "Sabtu malam", "Minggu pagi"]);
  await addAgenda(admin, open.id, bot.b.userId, "schedule", "Diskusi Basis Data", "Membahas konsep relasi dan normalisasi.");
  await addAgenda(admin, open.id, bot.f.userId, "task", "Rangkuman materi", "Setiap anggota membuat rangkuman singkat.");
  unwrap(await admin.from("group_agenda_votes").upsert([
    { agenda_item_id: pollId, user_id: bot.a.userId, selected_option: "Sabtu pagi" },
    { agenda_item_id: pollId, user_id: bot.b.userId, selected_option: "Sabtu malam" },
    { agenda_item_id: pollId, user_id: bot.f.userId, selected_option: "Sabtu pagi" },
  ], { onConflict: "agenda_item_id,user_id" }), "Suara polling demo gagal dibuat");

  const filePath = open.id + "/" + bot.a.userId + "/seed-demo-material.pdf";
  const { error: uploadError } = await admin.storage.from("group-materials").upload(filePath, pdfBytes(), {
    contentType: "application/pdf", cacheControl: "600", upsert: true,
  });
  if (uploadError) throw new Error("Materi contoh demo gagal diunggah: " + uploadError.message);
  unwrap(await admin.from("group_materials").upsert({
    group_id: open.id, uploaded_by: bot.a.userId, title: "Materi Simulasi UTConnect",
    storage_path: filePath, content_type: "application/pdf", file_size_bytes: pdfBytes().length,
  }, { onConflict: "group_id,storage_path" }), "Metadata materi contoh demo gagal dibuat");

  return { seeded: true, bot_count: bots.length, groups: 5, scenario };
}

async function claimEvent(admin: SupabaseClient, sessionId: string, eventKey: string) {
  const { data, error } = await admin.rpc("demo_claim_bot_event", { p_session_id: sessionId, p_event_key: eventKey });
  if (error) throw new Error("Aktivitas demo gagal dikunci: " + error.message);
  return data === true;
}

async function eventConnection(ctx: DemoContext, id: string) {
  const a = ctx.admin;
  const { data: row } = await a.from("connections").select("id,initiator_id,recipient_id,status")
    .eq("id", id).eq("is_demo", true).eq("demo_session_id", ctx.sessionId).maybeSingle();
  if (!row || row.initiator_id !== ctx.visitorId || row.status !== "pending") return;
  const { data: target } = await a.from("profiles").select("id,is_demo,demo_session_id").eq("id", row.recipient_id).maybeSingle();
  if (!target?.is_demo || target.demo_session_id !== ctx.sessionId) return;
  if (!await claimEvent(a, ctx.sessionId, "connection:" + id)) return;
  unwrap(await a.from("connections").update({ status: "accepted", updated_at: new Date().toISOString() }).eq("id", id).eq("status", "pending"), "Bot tidak dapat menerima koneksi");
  unwrap(await a.from("direct_messages").insert({
    connection_id: id, sender_id: row.recipient_id,
    body: "[SIMULASI DEMO] Permintaan koneksimu diterima. Mari berdiskusi dan belajar bersama.",
  }), "Balasan koneksi demo gagal dikirim");
}

async function eventMessage(ctx: DemoContext, messageId: string) {
  const a = ctx.admin;
  const { data: message } = await a.from("direct_messages").select("id,connection_id,sender_id,body")
    .eq("id", messageId).eq("is_demo", true).eq("demo_session_id", ctx.sessionId).maybeSingle();
  if (!message || message.sender_id !== ctx.visitorId) return;
  const { data: connection } = await a.from("connections").select("id,initiator_id,recipient_id,status")
    .eq("id", message.connection_id).eq("is_demo", true).eq("demo_session_id", ctx.sessionId).maybeSingle();
  if (!connection || connection.status !== "accepted") return;
  const other = connection.initiator_id === ctx.visitorId ? connection.recipient_id : connection.initiator_id;
  const { data: bot } = await a.from("profiles").select("id,is_demo,demo_session_id").eq("id", other).maybeSingle();
  if (!bot?.is_demo || bot.demo_session_id !== ctx.sessionId) return;
  if (!await claimEvent(a, ctx.sessionId, "dm:" + messageId)) return;
  const replies = [
    "[SIMULASI DEMO] Menarik! Kita bahas konsepnya satu per satu agar mudah dipahami.",
    "[SIMULASI DEMO] Setuju. Aku bisa bantu menyiapkan rangkuman dan latihan soal.",
    "[SIMULASI DEMO] Siap, kita susun jadwal belajar bersama.",
  ];
  const reply = replies[(message.body.length + messageId.charCodeAt(0)) % replies.length];
  unwrap(await a.from("direct_messages").insert({ connection_id: connection.id, sender_id: other, body: reply }), "Balasan bot chat gagal dikirim");
}

async function eventGroupCreated(ctx: DemoContext, groupId: string) {
  const a = ctx.admin;
  const { data: group } = await a.from("study_groups").select("id,created_by").eq("id", groupId)
    .eq("is_demo", true).eq("demo_session_id", ctx.sessionId).maybeSingle();
  if (!group || group.created_by !== ctx.visitorId) return;
  if (!await claimEvent(a, ctx.sessionId, "group-created:" + groupId)) return;
  const { data: bot } = await a.from("profiles").select("id").eq("is_demo", true).eq("demo_session_id", ctx.sessionId).neq("id", ctx.visitorId).limit(1).maybeSingle();
  if (!bot) return;
  const { error } = await a.rpc("demo_add_bot_member", { p_session_id: ctx.sessionId, p_group_id: groupId, p_bot_user_id: bot.id });
  if (error && !error.message.includes("Group is full")) throw new Error("Bot belum dapat bergabung ke grup: " + error.message);
  unwrap(await a.from("group_messages").insert({
    group_id: groupId, sender_id: bot.id,
    body: "[SIMULASI DEMO] Halo! Aku ikut bergabung sebagai akun simulasi. Kita bisa mulai menyusun agenda.",
    mentioned_user_ids: [],
  }), "Bot grup baru gagal mengirim pesan");
}

async function eventGroupJoin(ctx: DemoContext, groupId: string, status: string) {
  const a = ctx.admin;
  const { data: group } = await a.from("study_groups").select("id,access_type").eq("id", groupId)
    .eq("is_demo", true).eq("demo_session_id", ctx.sessionId).maybeSingle();
  if (!group) return;
  const { data: member } = await a.from("group_members").select("status").eq("group_id", groupId).eq("user_id", ctx.visitorId).maybeSingle();
  if (group.access_type === "approval" && status === "pending" && member?.status === "pending") {
    if (!await claimEvent(a, ctx.sessionId, "approval:" + groupId)) return;
    const { data: adminMember } = await a.from("group_members").select("user_id").eq("group_id", groupId)
      .eq("status", "active").in("role", ["admin", "co_admin"]).limit(1).maybeSingle();
    if (adminMember?.user_id) {
      const { error } = await a.rpc("demo_approve_join_request", {
        p_session_id: ctx.sessionId, p_group_id: groupId, p_bot_admin_id: adminMember.user_id, p_user_id: ctx.visitorId,
      });
      if (error && !error.message.includes("Group is full")) throw new Error("Persetujuan bot gagal diproses: " + error.message);
    }
  }
  const { data: currentMembership } = await a.from("group_members").select("status").eq("group_id", groupId).eq("user_id", ctx.visitorId).maybeSingle();
  if (currentMembership?.status === "active" && await claimEvent(a, ctx.sessionId, "welcome:" + groupId)) {
    const { data: bot } = await a.from("group_members").select("user_id").eq("group_id", groupId).eq("status", "active").neq("user_id", ctx.visitorId).limit(1).maybeSingle();
    if (bot?.user_id) {
      unwrap(await a.from("group_messages").insert({
        group_id: groupId, sender_id: bot.user_id,
        body: "[SIMULASI DEMO] Selamat bergabung! Kita mulai dengan perkenalan dan target belajar.",
        mentioned_user_ids: [],
      }), "Pesan sambutan bot gagal dikirim");
    }
  }
}

async function eventGroupMessage(ctx: DemoContext, groupId: string, messageId: string) {
  const a = ctx.admin;
  const { data: group } = await a.from("study_groups").select("id").eq("id", groupId)
    .eq("is_demo", true).eq("demo_session_id", ctx.sessionId).maybeSingle();
  const { data: message } = await a.from("group_messages").select("id,sender_id")
    .eq("id", messageId).eq("is_demo", true).eq("demo_session_id", ctx.sessionId).maybeSingle();
  if (!group || !message || message.sender_id !== ctx.visitorId) return;
  if (!await claimEvent(a, ctx.sessionId, "group-message:" + messageId)) return;
  const { data: bot } = await a.from("group_members").select("user_id").eq("group_id", groupId)
    .eq("status", "active").neq("user_id", ctx.visitorId).limit(1).maybeSingle();
  if (!bot?.user_id) return;
  unwrap(await a.from("group_messages").insert({
    group_id: groupId, sender_id: bot.user_id,
    body: "[SIMULASI DEMO] Catatan bagus! Kita tambahkan itu ke rangkuman kelompok.",
    mentioned_user_ids: [],
  }), "Balasan bot grup gagal dikirim");
}

async function eventPollVote(ctx: DemoContext, itemId: string, option: string) {
  const a = ctx.admin;
  const { data: item } = await a.from("group_agenda_items").select("id,group_id,item_type,poll_options")
    .eq("id", itemId).eq("is_demo", true).eq("demo_session_id", ctx.sessionId).maybeSingle();
  if (!item || item.item_type !== "poll" || !Array.isArray(item.poll_options) || !item.poll_options.includes(option)) return;
  if (!await claimEvent(a, ctx.sessionId, "poll:" + itemId + ":" + ctx.visitorId)) return;
  const { data: bot } = await a.from("group_members").select("user_id").eq("group_id", item.group_id)
    .eq("status", "active").neq("user_id", ctx.visitorId).limit(1).maybeSingle();
  if (!bot?.user_id) return;
  unwrap(await a.from("group_agenda_votes").upsert({
    agenda_item_id: itemId, user_id: bot.user_id, selected_option: option,
  }, { onConflict: "agenda_item_id,user_id" }), "Suara bot pada polling gagal disimpan");
}

async function cleanupSession(ctx: DemoContext) {
  const a = ctx.admin;
  const { data: materials, error } = await a.from("group_materials").select("storage_path")
    .eq("is_demo", true).eq("demo_session_id", ctx.sessionId);
  if (error) throw new Error("Daftar materi demo gagal dimuat: " + error.message);
  const paths = (materials || []).map(item => item.storage_path).filter(Boolean);
  if (paths.length) {
    const { error: storageError } = await a.storage.from("group-materials").remove(paths);
    if (storageError) throw new Error("Pembersihan file demo gagal: " + storageError.message);
  }
  const tables = [
    "group_agenda_votes", "group_messages", "group_materials", "group_agenda_items",
    "group_invites", "group_members", "direct_messages", "connections",
    "notifications", "matching_preferences", "user_locations", "study_groups",
  ];
  for (const table of tables) {
    const { error: deleteError } = await a.from(table).delete().eq("is_demo", true).eq("demo_session_id", ctx.sessionId);
    if (deleteError) throw new Error("Reset data demo pada " + table + " gagal: " + deleteError.message);
  }
  const { data: botProfiles, error: botError } = await a.from("profiles").select("id")
    .eq("is_demo", true).eq("demo_session_id", ctx.sessionId).neq("id", ctx.visitorId);
  if (botError) throw new Error("Daftar bot demo gagal diperiksa: " + botError.message);
  for (const bot of botProfiles || []) {
    const { error: removeError } = await a.auth.admin.deleteUser(bot.id);
    if (removeError) throw new Error("Akun bot gagal dihapus saat reset: " + removeError.message);
  }
  const { error: locationError } = await a.from("user_locations").delete().eq("user_id", ctx.visitorId);
  if (locationError) throw new Error("Lokasi demo pengunjung gagal direset: " + locationError.message);
  const { error: preferenceError } = await a.from("matching_preferences").delete().eq("user_id", ctx.visitorId);
  if (preferenceError) throw new Error("Preferensi demo pengunjung gagal direset: " + preferenceError.message);
}


Deno.serve(async (req: Request) => {
  const allowedOrigin = Deno.env.get("DEMO_ALLOWED_ORIGIN") || "";
  const origin = req.headers.get("Origin") || "";
  if (!allowedOrigin || origin !== allowedOrigin) return new Response("Origin not allowed", { status: 403 });
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(allowedOrigin) });
  if (req.method !== "POST") return json(allowedOrigin, { error: "Method not allowed" }, 405);

  let payload: Record<string, unknown>;
  try { payload = await req.json(); }
  catch { return json(allowedOrigin, { error: "Payload demo tidak valid." }, 400); }
  const action = String(payload.action || "");
  try {
    const ctx = await requestContext(req, allowedOrigin, action, String(payload.scenario || "all"));
    if (action === "bootstrap") {
      const scenario = String(payload.scenario || "all");
      const result = await seedSession(ctx, scenario);
      return json(allowedOrigin, { success: true, ...result });
    }
    if (action === "reset") {
      const { data: materials, error } = await ctx.admin.from("group_materials").select("storage_path")
        .eq("is_demo", true).eq("demo_session_id", ctx.sessionId);
      if (error) throw new Error("Materi demo gagal diperiksa: " + error.message);
      const paths = (materials || []).map(item => item.storage_path).filter(Boolean);
      if (paths.length) {
        const { error: storageError } = await ctx.admin.storage.from("group-materials").remove(paths);
        if (storageError) throw new Error("File demo gagal dibersihkan: " + storageError.message);
      }
      const tables = ["group_agenda_votes","group_messages","group_materials","group_agenda_items","group_invites","group_members","direct_messages","connections","notifications","matching_preferences","user_locations","study_groups"];
      for (const table of tables) {
        const { error: deleteError } = await ctx.admin.from(table).delete().eq("is_demo", true).eq("demo_session_id", ctx.sessionId);
        if (deleteError) throw new Error("Reset tabel " + table + " gagal: " + deleteError.message);
      }
      const { data: bots, error: botError } = await ctx.admin.from("profiles").select("id")
        .eq("is_demo", true).eq("demo_session_id", ctx.sessionId).neq("id", ctx.visitorId);
      if (botError) throw new Error("Akun bot gagal diperiksa: " + botError.message);
      for (const bot of bots || []) {
        const { error: removeError } = await ctx.admin.auth.admin.deleteUser(bot.id);
        if (removeError) throw new Error("Akun bot gagal dihapus: " + removeError.message);
      }
      const { error: eventResetError } = await ctx.admin.rpc("demo_reset_bot_events", { p_session_id: ctx.sessionId });
      if (eventResetError) throw new Error("Riwayat respons bot demo gagal direset: " + eventResetError.message);
      const result = await seedSession(ctx, "all");
      return json(allowedOrigin, { success: true, reset: true, ...result });
    }
    if (action === "list_groups") {
      const limit = Math.max(1, Math.min(Number(payload.limit) || 100, 100));
      const { data: groups, error } = await ctx.admin.from("study_groups")
        .select("id,created_by,name,description,course_id,program,mode,capacity,access_type,schedule_text,online_url,offline_area_label,is_archived,created_at,updated_at,is_demo,course:courses!study_groups_course_id_fkey(id,course_code,course_name)")
        .eq("is_demo", true)
        .eq("demo_session_id", ctx.sessionId)
        .eq("is_archived", false)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw new Error("Kelompok demo belum dapat dimuat: " + error.message);
      const result = [];
      for (const group of groups || []) {
        const { count, error: countError } = await ctx.admin.from("group_members")
          .select("user_id", { count: "exact", head: true })
          .eq("group_id", group.id)
          .eq("status", "active")
          .eq("is_demo", true)
          .eq("demo_session_id", ctx.sessionId);
        if (countError) throw new Error("Kapasitas kelompok demo belum dapat dihitung: " + countError.message);
        result.push({ ...group, active_member_count: count || 0 });
      }
      return json(allowedOrigin, { success: true, groups: result });
    }
    if (action === "connection_request") {
      const id = String(payload.connection_id || "");
      const { data: connection } = await ctx.admin.from("connections").select("id,initiator_id,recipient_id,status")
        .eq("id", id).eq("is_demo", true).eq("demo_session_id", ctx.sessionId).maybeSingle();
      if (connection?.initiator_id === ctx.visitorId && connection.status === "pending") {
        const { data: target } = await ctx.admin.from("profiles").select("is_demo,demo_session_id").eq("id", connection.recipient_id).maybeSingle();
        if (target?.is_demo && target.demo_session_id === ctx.sessionId && await claimEvent(ctx.admin, ctx.sessionId, "conn:" + id)) {
          unwrap(await ctx.admin.from("connections").update({ status: "accepted", updated_at: new Date().toISOString() }).eq("id", id).eq("status", "pending"), "Koneksi demo gagal diterima");
          unwrap(await ctx.admin.from("direct_messages").insert({ connection_id: id, sender_id: connection.recipient_id, body: "[SIMULASI DEMO] Halo! Permintaan koneksi diterima. Mari belajar bersama." }), "Pesan balasan bot gagal dikirim");
        }
      }
      return json(allowedOrigin, { success: true });
    }
    if (action === "connection_response") {
      const id = String(payload.connection_id || "");
      const accepted = payload.accepted === true;
      const { data: connection } = await ctx.admin.from("connections")
        .select("id,initiator_id,recipient_id,status")
        .eq("id", id)
        .eq("is_demo", true)
        .eq("demo_session_id", ctx.sessionId)
        .maybeSingle();
      if (accepted && connection?.recipient_id === ctx.visitorId && connection.status === "accepted") {
        const { data: bot } = await ctx.admin.from("profiles")
          .select("id,is_demo,demo_session_id")
          .eq("id", connection.initiator_id)
          .maybeSingle();
        if (bot?.is_demo === true && bot.demo_session_id === ctx.sessionId
          && await claimEvent(ctx.admin, ctx.sessionId, "connection-response:" + id)) {
          unwrap(await ctx.admin.from("direct_messages").insert({
            connection_id: id,
            sender_id: connection.initiator_id,
            body: "[SIMULASI DEMO] Terima kasih sudah menerima koneksiku. Mari kita mulai belajar bersama!",
          }), "Balasan koneksi demo gagal dikirim");
        }
      }
      return json(allowedOrigin, { success: true });
    }
    if (action === "direct_message") {
      const id = String(payload.message_id || "");
      const { data: message } = await ctx.admin.from("direct_messages").select("id,connection_id,sender_id,body")
        .eq("id", id).eq("is_demo", true).eq("demo_session_id", ctx.sessionId).maybeSingle();
      if (message?.sender_id === ctx.visitorId && await claimEvent(ctx.admin, ctx.sessionId, "dm:" + id)) {
        const { data: connection } = await ctx.admin.from("connections").select("id,initiator_id,recipient_id,status")
          .eq("id", message.connection_id).eq("demo_session_id", ctx.sessionId).maybeSingle();
        if (connection?.status === "accepted") {
          const other = connection.initiator_id === ctx.visitorId ? connection.recipient_id : connection.initiator_id;
          const { data: bot } = await ctx.admin.from("profiles").select("is_demo,demo_session_id").eq("id", other).maybeSingle();
          if (bot?.is_demo && bot.demo_session_id === ctx.sessionId) {
            unwrap(await ctx.admin.from("direct_messages").insert({ connection_id: connection.id, sender_id: other, body: "[SIMULASI DEMO] Terima kasih sudah mengirim pesan. Kita bahas materi sedikit demi sedikit." }), "Balasan bot gagal dikirim");
          }
        }
      }
      return json(allowedOrigin, { success: true });
    }
    if (action === "group_created" || action === "group_join" || action === "group_message" || action === "poll_vote") {
      const groupId = String(payload.group_id || "");
      if (action === "group_created") {
        const { data: group } = await ctx.admin.from("study_groups").select("id,created_by").eq("id", groupId)
          .eq("is_demo", true).eq("demo_session_id", ctx.sessionId).maybeSingle();
        if (group?.created_by === ctx.visitorId && await claimEvent(ctx.admin, ctx.sessionId, "group-created:" + groupId)) {
          const { data: bot } = await ctx.admin.from("profiles").select("id").eq("is_demo", true)
            .eq("demo_session_id", ctx.sessionId).neq("id", ctx.visitorId).limit(1).maybeSingle();
          if (bot) {
            const { error } = await ctx.admin.rpc("demo_add_bot_member", { p_session_id: ctx.sessionId, p_group_id: groupId, p_bot_user_id: bot.id });
            if (error && !error.message.includes("Group is full")) throw new Error(error.message);
            unwrap(await ctx.admin.from("group_messages").insert({
              group_id: groupId, sender_id: bot.id,
              body: "[SIMULASI DEMO] Halo! Aku bergabung sebagai anggota simulasi. Kita bisa mulai belajar.",
              mentioned_user_ids: [],
            }), "Bot gagal menyapa grup baru");
          }
        }
      } else if (action === "group_join") {
        const { data: group } = await ctx.admin.from("study_groups").select("id,access_type")
          .eq("id", groupId).eq("is_demo", true).eq("demo_session_id", ctx.sessionId).maybeSingle();
        const { data: membership } = await ctx.admin.from("group_members").select("status")
          .eq("group_id", groupId).eq("user_id", ctx.visitorId).maybeSingle();
        if (group?.access_type === "approval" && membership?.status === "pending" && await claimEvent(ctx.admin, ctx.sessionId, "approve:" + groupId)) {
          const { data: botAdmin } = await ctx.admin.from("group_members").select("user_id").eq("group_id", groupId)
            .eq("status", "active").in("role", ["admin", "co_admin"]).limit(1).maybeSingle();
          if (botAdmin) {
            const { error } = await ctx.admin.rpc("demo_approve_join_request", {
              p_session_id: ctx.sessionId, p_group_id: groupId, p_bot_admin_id: botAdmin.user_id, p_user_id: ctx.visitorId,
            });
            if (error && !error.message.includes("Group is full")) throw new Error(error.message);
          }
        }
        const { data: activeMember } = await ctx.admin.from("group_members").select("status")
          .eq("group_id", groupId).eq("user_id", ctx.visitorId).maybeSingle();
        if (activeMember?.status === "active" && await claimEvent(ctx.admin, ctx.sessionId, "welcome:" + groupId)) {
          const { data: botMember } = await ctx.admin.from("group_members").select("user_id")
            .eq("group_id", groupId).eq("status", "active").neq("user_id", ctx.visitorId).limit(1).maybeSingle();
          if (botMember) {
            unwrap(await ctx.admin.from("group_messages").insert({
              group_id: groupId, sender_id: botMember.user_id,
              body: "[SIMULASI DEMO] Selamat bergabung! Kita bisa mulai dengan perkenalan dan target belajar.",
              mentioned_user_ids: [],
            }), "Pesan sambutan bot gagal dikirim");
          }
        }
      } else if (action === "group_message") {
        const messageId = String(payload.message_id || "");
        const { data: message } = await ctx.admin.from("group_messages").select("id,sender_id")
          .eq("id", messageId).eq("is_demo", true).eq("demo_session_id", ctx.sessionId).maybeSingle();
        if (message?.sender_id === ctx.visitorId && await claimEvent(ctx.admin, ctx.sessionId, "group-message:" + messageId)) {
          const { data: bot } = await ctx.admin.from("group_members").select("user_id").eq("group_id", groupId)
            .eq("status", "active").neq("user_id", ctx.visitorId).limit(1).maybeSingle();
          if (bot) unwrap(await ctx.admin.from("group_messages").insert({
            group_id: groupId, sender_id: bot.user_id,
            body: "[SIMULASI DEMO] Catatan bagus! Kita masukkan ke rangkuman kelompok.",
            mentioned_user_ids: [],
          }), "Balasan bot grup gagal dikirim");
        }
      } else if (action === "poll_vote") {
        const itemId = String(payload.item_id || "");
        const option = String(payload.selected_option || "");
        const { data: item } = await ctx.admin.from("group_agenda_items").select("group_id,item_type,poll_options")
          .eq("id", itemId).eq("is_demo", true).eq("demo_session_id", ctx.sessionId).maybeSingle();
        if (item?.item_type === "poll" && Array.isArray(item.poll_options) && item.poll_options.includes(option)
          && await claimEvent(ctx.admin, ctx.sessionId, "poll:" + itemId)) {
          const { data: bot } = await ctx.admin.from("group_members").select("user_id").eq("group_id", item.group_id)
            .eq("status", "active").neq("user_id", ctx.visitorId).limit(1).maybeSingle();
          if (bot) unwrap(await ctx.admin.from("group_agenda_votes").upsert({
            agenda_item_id: itemId, user_id: bot.user_id, selected_option: option,
          }, { onConflict: "agenda_item_id,user_id" }), "Suara bot pada polling gagal disimpan");
        }
      }
      return json(allowedOrigin, { success: true });
    }
    return json(allowedOrigin, { error: "Aksi demo tidak dikenali." }, 400);
  } catch (error) {
    console.error("Demo Mode error:", error);
    return json(allowedOrigin, { error: error instanceof Error ? error.message : "Demo Mode belum dapat diproses." }, 400);
  }
});
