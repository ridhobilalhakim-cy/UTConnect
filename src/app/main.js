import { supabase } from "../lib/supabase.js";
import { initDashboard } from "./dashboard.js";
import { resolveUTFaculty, resolveUTProgram } from "../data/ut-programs.js";
function guardError(message) {
  const spinner = document.getElementById("authGuardSpinner");
  const title = document.getElementById("authGuardTitle");
  const text = document.getElementById("authGuardText");
  if (spinner) spinner.style.display = "none";
  if (title) title.textContent = "UT Connect belum dapat dibuka";
  if (text) text.textContent = message;
}

function initials(name) {
  return String(name || "UT").trim().split(/\s+/).slice(0, 2).map(x => x[0] || "").join("").toUpperCase() || "UT";
}

async function bootAuthenticatedApp() {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (!session?.user) { window.location.replace("/"); return; }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id,full_name,faculty,program,semester,verification_status,bio,avatar_path")
      .eq("id", session.user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile) { window.location.replace("/?completeProfile=1"); return; }

    const { data: adminRoleData, error: adminRoleError } = await supabase.rpc("is_current_user_admin");
    if (adminRoleError) console.error("UT Connect admin role lookup failed:", adminRoleError);
    const isAdmin = adminRoleData === true;

    const fullName = profile.full_name || session.user.user_metadata?.full_name || session.user.email || "Mahasiswa UT";
    const initialsText = initials(fullName);
    const programMeta = `${profile.program || "Mahasiswa UT"} · Semester ${profile.semester || "-"}`;
    ["topUserName", "sideUserName"].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = fullName; });
    ["topAvatar", "sideAvatar", "profileInitials"].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = initialsText;
      if (profile.avatar_path) {
        const { data } = supabase.storage.from("profile-avatars").getPublicUrl(profile.avatar_path);
        if (data?.publicUrl) {
          const image = document.createElement("img");
          image.src = data.publicUrl;
          image.alt = "";
          image.loading = "lazy";
          el.replaceChildren(image);
        }
      }
    });
    const topMeta = document.getElementById("topUserMeta");
    if (topMeta) topMeta.textContent = isAdmin ? "Administrator UT Connect" : (profile.verification_status === "verified" ? "Mahasiswa terverifikasi" : "Status menunggu verifikasi");
    const sideMeta = document.getElementById("sideUserMeta"); if (sideMeta) sideMeta.textContent = isAdmin ? "Administrator UT Connect" : programMeta;
    const profileName = document.getElementById("profileFullName"); if (profileName) profileName.textContent = fullName;
    const profileStatus = document.getElementById("profileStatusTag"); if (profileStatus) profileStatus.textContent = isAdmin ? "Role: ADMINISTRATOR" : `Status: ${(profile.verification_status || "pending").toUpperCase()}`;
    const profileBio = document.getElementById("profileBio"); if (profileBio) profileBio.textContent = profile.bio || (isAdmin ? "Administrator UT Connect" : "Mahasiswa Universitas Terbuka");
    const profileFaculty = document.getElementById("profileFaculty"); if (profileFaculty) profileFaculty.textContent = resolveUTFaculty(profile.faculty) || profile.faculty || "-";
    const profileProgram = document.getElementById("profileProgram"); if (profileProgram) profileProgram.textContent = resolveUTProgram(profile.faculty, profile.program) || profile.program || "-";
    const profileSemester = document.getElementById("profileSemester"); if (profileSemester) profileSemester.textContent = profile.semester || "-";
    const profileNim = document.getElementById("profileNimLabel"); if (profileNim) profileNim.textContent = "Dilindungi (digest)";
    const welcome = document.querySelector("#page-home .page-title"); if (welcome) welcome.textContent = `Selamat datang, ${fullName} 👋`;
    const greeting = document.querySelector(".welcome-copy .hello"); if (greeting) greeting.textContent = `Halo, ${fullName.split(/\s+/)[0]}! Siap belajar hari ini?`;
    const notice = document.getElementById("sessionNotice");
    if (notice) {
      notice.hidden = isAdmin || profile.verification_status === "verified";
      notice.textContent = "Akun berhasil masuk. Status mahasiswa masih menunggu verifikasi. Selesaikan pemeriksaan pada menu Verifikasi Mahasiswa.";
    }

    const signout = document.getElementById("authSignout");
    if (signout) signout.addEventListener("click", async () => {
      signout.disabled = true;
      const { error: signoutError } = await supabase.auth.signOut();
      if (signoutError) { signout.disabled = false; window.alert(signoutError.message); }
      else window.location.replace("/");
    });
    supabase.auth.onAuthStateChange(event => { if (event === "SIGNED_OUT") window.location.replace("/"); });

    const guard = document.getElementById("authGuard"); if (guard) guard.remove();
    initDashboard({ isAdmin, isVerified: profile.verification_status === "verified", verificationStatus: profile.verification_status || "pending", currentUserId: session.user.id, currentUserName: fullName, currentProfile: profile });
  } catch (error) {
    guardError(error?.message || "Terjadi kendala saat memulihkan akun.");
  }
}

bootAuthenticatedApp();
