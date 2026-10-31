import { supabase } from "../lib/supabase.js";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

window.L = L;

(() => {
  const $ = (id) => document.getElementById(id);
  const supabaseClient = supabase;
  const L = window.L;
  let map = null, marker = null, chosenLocation = null, mapReady = false, activeUser = null;
  let handlingSession = false;
  const initialParams = new URLSearchParams(window.location.search);
  let recoveryMode = initialParams.get("mode") === "recovery";

  function alertBox(message, type="info") {
    const el = $("alertBox");
    el.textContent = message;
    el.className = `alert show ${type}`;
    el.scrollIntoView({behavior:"smooth",block:"nearest"});
  }
  function clearAlert(){ $("alertBox").className="alert"; $("alertBox").textContent=""; }
  function busy(id, state, label){
    const b=$(id); if(!b) return;
    if(!b.dataset.label)b.dataset.label=b.textContent;
    b.disabled=state; b.textContent=state?label:b.dataset.label;
  }
  function showView(name){
    ["loginView","registerView","resetPasswordView","accountView"].forEach(id=>{const view=$(id);if(view)view.classList.toggle("hidden",id!==name);});
    clearAlert();
    if(name==="registerView") setTimeout(initMap,180);
    window.scrollTo({top:0,behavior:"smooth"});
  }
  async function ensureSupabase(){ return supabaseClient; }
  async function ensureLeaflet(){ return !!window.L; }
  async function initMap(){
    if(mapReady) { setTimeout(()=>map.invalidateSize(),120); return; }
    if(!await ensureLeaflet()) return;
    const el=$("registrationMap"); if(!el || !el.offsetWidth) return;
    map=L.map(el,{scrollWheelZoom:false}).setView([-2.5,118],4);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"&copy; OpenStreetMap"}).addTo(map);
    map.on("click",e=>setLocation(e.latlng.lat,e.latlng.lng,true));
    mapReady=true; setTimeout(()=>map.invalidateSize(),180);
  }
  function setLocation(lat,lng,pan){
    chosenLocation={lat:Number(lat),lng:Number(lng)};
    if(!mapReady){initMap().then(()=>setLocation(lat,lng,pan));return;}
    if(marker)map.removeLayer(marker);
    marker=L.marker([chosenLocation.lat,chosenLocation.lng],{draggable:true}).addTo(map);
    marker.on("dragend",()=>{const p=marker.getLatLng();chosenLocation={lat:p.lat,lng:p.lng};updateLocationLabel();});
    if(pan)map.setView([chosenLocation.lat,chosenLocation.lng],15);
    updateLocationLabel();
  }
  function updateLocationLabel(){
    $("locationState").innerHTML='<span class="map-selected">✓ Titik lokasi berhasil dipilih</span><br>Alamat dan koordinat presisi tidak ditampilkan kepada mahasiswa lain.';
  }
  function clearLocation(){
    chosenLocation=null;
    if(marker&&map){map.removeLayer(marker);marker=null;}
    $("locationState").textContent="Belum ada titik lokasi. Klik pada peta untuk memilih.";
  }
  function useMyLocation(){
    if(!navigator.geolocation){alertBox("Browser tidak mendukung lokasi. Klik titik secara manual pada peta.","error");return;}
    busy("useMyLocation",true,"Mengambil lokasi...");
    navigator.geolocation.getCurrentPosition(pos=>{
      setLocation(pos.coords.latitude,pos.coords.longitude,true);
      busy("useMyLocation",false);
      alertBox("Lokasi berhasil ditandai. Periksa posisi pin sebelum menyimpan.","success");
    },err=>{
      busy("useMyLocation",false);
      const msg=err.code===1?"Izin lokasi ditolak. Pilih titik secara manual pada peta.":"Lokasi tidak tersedia. Coba lagi atau pilih titik secara manual.";
      alertBox(msg,"error");
    },{enableHighAccuracy:true,timeout:12000,maximumAge:60000});
  }
  async function fetchProfile(user){
    const client=await ensureSupabase();
    const {data,error}=await client.from("profiles").select("id,full_name,faculty,program,semester,verification_status").eq("id",user.id).maybeSingle();
    if(error) throw error;
    return data;
  }
  function prefillFromUser(user){
    const meta=user?.user_metadata||{};
    if(!$('fullName').value) $('fullName').value=meta.full_name||meta.name||meta.display_name||"";
    if(user?.email){$('regEmail').value=user.email;$('regEmail').readOnly=true;}
  }
  function enterRecoveryView(){
    recoveryMode=true;
    showView("resetPasswordView");
    alertBox("Tautan pemulihan akun dikenali. Silakan buat password baru.","success");
  }
  async function handleSession(session){
    if(recoveryMode){if(session?.user)activeUser=session.user;enterRecoveryView();return;}
    if(handlingSession) return;
    handlingSession=true;
    try{
      if(!session?.user) return;
      activeUser=session.user;
      const profile=await fetchProfile(session.user);
      if(profile){
        window.location.replace("/app.html");
        return;
      }
      prefillFromUser(session.user);
      $("oauthAccountBox").textContent=`Akun aktif: ${session.user.email||"akun Google"}. Lengkapi data akademik dan lokasi untuk masuk ke UT Connect.`;
      $("oauthAccountBox").classList.remove("hidden");
      $("credentialsBlock").classList.add("hidden");
      $("registerGoogleNote").classList.add("hidden");
      $("regEmail").required=false; $("regPassword").required=false;
      showView("registerView");
      alertBox("Akun berhasil masuk. Lengkapi profil akademik dan titik lokasi untuk membuka dashboard.","success");
    }catch(error){
      alertBox(error.message||"Sesi terbaca, tetapi profil belum dapat diperiksa.","error");
    }finally{handlingSession=false;}
  }
  async function startGoogle(){
    clearAlert();
    try{
      const client=await ensureSupabase();
      const redirectTo=`${window.location.origin}/`;
      const {error}=await client.auth.signInWithOAuth({provider:"google",options:{redirectTo,queryParams:{prompt:"select_account"}}});
      if(error) throw error;
    }catch(error){alertBox(error.message||"Login Google belum dapat dimulai. Pastikan Google Provider aktif di project Supabase.","error");}
  }
  // Keep OAuth callbacks, refreshed sessions, and sign-out events in sync with the login view.
  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY" || (recoveryMode && session?.user && ["SIGNED_IN", "INITIAL_SESSION", "USER_UPDATED"].includes(event))) {
      setTimeout(() => { activeUser = session?.user || activeUser; enterRecoveryView(); }, 0);
      return;
    }
    if (["SIGNED_IN", "TOKEN_REFRESHED", "INITIAL_SESSION", "USER_UPDATED"].includes(event)) {
      setTimeout(() => handleSession(session), 0);
    }
    if (event === "SIGNED_OUT") {
      setTimeout(() => {
        activeUser = null;
        showView("loginView");
      }, 0);
    }
  });

  async function createStudentProfile(user,formValues){
    const client=await ensureSupabase();
    const payload={...formValues,location_consent:true,lat:chosenLocation?.lat,lng:chosenLocation?.lng};
    const {data,error}=await client.functions.invoke("complete-student-registration",{body:payload});
    if(error){
      let message=error.message||"Profil belum berhasil disimpan.";
      try{const detail=await error.context.json();if(detail?.error)message=detail.error;}catch{}
      throw new Error(message);
    }
    if(!data?.success) throw new Error(data?.error||"Respons server tidak valid.");
    return data;
  }

  // Basic navigation is wired before the network libraries load, so the UI never appears inert.
  $("goRegister").addEventListener("click",()=>{
    showView("registerView");
    $("oauthAccountBox").classList.add("hidden");
    $("credentialsBlock").classList.remove("hidden");
    $("registerGoogleNote").classList.remove("hidden");
    $("regEmail").required=true;$("regEmail").readOnly=false;$("regPassword").required=true;
  });
  $("backToLogin").addEventListener("click",()=>showView("loginView"));
  $("googleLoginBtn").addEventListener("click",startGoogle);
  $("googleRegisterBtn").addEventListener("click",startGoogle);
  $("useMyLocation").addEventListener("click",useMyLocation);
  $("clearLocation").addEventListener("click",clearLocation);
  $("completeProfileBtn").addEventListener("click",()=>{
    if(activeUser){prefillFromUser(activeUser);showView("registerView");$("credentialsBlock").classList.add("hidden");$("registerGoogleNote").classList.add("hidden");$("regEmail").required=false;$("regPassword").required=false;}
  });

  $("loginForm").addEventListener("submit",async e=>{
    e.preventDefault();clearAlert();busy("loginBtn",true,"Memeriksa akun...");
    try{
      const client=await ensureSupabase();
      const {data,error}=await client.auth.signInWithPassword({email:$("loginEmail").value.trim(),password:$("loginPassword").value});
      if(error) throw error;
      await handleSession({user:data.user});
    }catch(error){alertBox(error.message||"Email atau password tidak cocok.","error");}
    finally{busy("loginBtn",false);}
  });
  $("registerForm").addEventListener("submit",async e=>{
    e.preventDefault();clearAlert();
    if(!chosenLocation){alertBox("Tandai titik lokasi belajar pada peta terlebih dahulu.","error");return;}
    if(!$("locationConsent").checked){alertBox("Centang persetujuan penggunaan lokasi terlebih dahulu.","error");return;}
    busy("registerBtn",true,"Membuat akun dan profil...");
    try{
      const client=await ensureSupabase();
      let user=activeUser;
      if(!user){
        const email=$("regEmail").value.trim();
        const password=$("regPassword").value;
        if(password.length<8) throw new Error("Password minimal 8 karakter.");
        const {data,error}=await client.auth.signUp({email,password,options:{data:{full_name:$("fullName").value.trim()}}});
        if(error) throw error;
        if(!data.session||!data.user){
          throw new Error("Akun belum langsung mendapatkan sesi. Untuk alur staging tanpa email konfirmasi, pastikan Confirm Email = OFF pada Supabase Auth > Providers > Email. Jika akun sudah terbentuk, coba login dan jangan mengulang pendaftaran berkali-kali.");
        }
        user=data.user;activeUser=user;
      }
      const values={full_name:$("fullName").value.trim(),nim:$("nim").value.trim(),faculty:$("faculty").value.trim(),program:$("program").value.trim(),semester:Number($("semester").value)};
      const result=await createStudentProfile(user,values);
      alertBox(result.message||"Profil berhasil dibuat.","success");
      window.location.replace("/app.html");
    }catch(error){alertBox(error.message||"Pendaftaran belum berhasil. Periksa data dan coba lagi.","error");}
    finally{busy("registerBtn",false);}
  });
  $("forgotBtn").addEventListener("click",async()=>{
    const email=$("loginEmail").value.trim();
    if(!email){alertBox("Masukkan email terlebih dahulu, lalu klik Lupa password.","info");return;}
    try{
      const client=await ensureSupabase();
      const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:`${window.location.origin}/?mode=recovery`});
      if(error) throw error;
      alertBox("Jika akun ditemukan, instruksi reset password akan dikirim ke email.","success");
    }catch(error){alertBox(error.message||"Permintaan reset password gagal.","error");}
  });

  $("resetPasswordForm").addEventListener("submit",async e=>{
    e.preventDefault();clearAlert();
    const password=$("newPassword").value;
    const confirmation=$("confirmNewPassword").value;
    if(password.length<8){alertBox("Password minimal 8 karakter.","error");return;}
    if(password!==confirmation){alertBox("Konfirmasi password belum sama.","error");return;}
    busy("resetPasswordBtn",true,"Memperbarui password...");
    try{
      const client=await ensureSupabase();
      const {error}=await client.auth.updateUser({password});
      if(error) throw error;
      const {error:signOutError}=await client.auth.signOut();
      if(signOutError){
        alertBox("Password berhasil diperbarui. Sesi belum dapat ditutup otomatis; silakan keluar sebelum menggunakan akun kembali.","success");
        return;
      }
      window.location.replace("/?passwordUpdated=1");
    }catch(error){alertBox(error.message||"Password belum berhasil diperbarui. Minta tautan pemulihan baru jika tautan telah kedaluwarsa.","error");}
    finally{busy("resetPasswordBtn",false);}
  });

  // Restore a previous session without asking for credentials again.
  (async()=>{
    try{
      const client=await ensureSupabase();
      const params=new URLSearchParams(location.search);
      const {data,error}=await client.auth.getSession();
      if(error) throw error;
      if(recoveryMode){
        if(data?.session?.user){activeUser=data.session.user;enterRecoveryView();}
        else {showView("loginView");alertBox("Tautan pemulihan tidak valid atau sudah kedaluwarsa. Minta tautan baru.","error");}
        return;
      }
      if(params.get("completeProfile")==="1") showView("registerView");
      if(data?.session) await handleSession(data.session);
      else if(params.get("completeProfile")==="1") {showView("registerView");$("credentialsBlock").classList.remove("hidden");}
      else showView("loginView");
      if(params.get("passwordUpdated")==="1") alertBox("Password berhasil diperbarui. Silakan masuk dengan password baru.","success");
      if(params.get("error_description")) alertBox(params.get("error_description"),"error");
    }catch(error){
      showView("loginView");
      alertBox(error.message||"UT Connect tidak dapat terhubung ke layanan autentikasi. Periksa internet lalu muat ulang.","error");
    }
  })();
})();
