import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  listInformationPosts,
  createInformationPost,
  updateInformationPost,
  deleteInformationPost,
} from "../services/information.js";
import {
  getMyStudentVerificationStatus,
  submitStudentVerificationEvidence,
  listStudentVerificationQueue,
  downloadStudentVerificationEvidence,
  reviewStudentVerificationRequest,
} from "../services/verification.js";
import {
  listActiveForumCourses,
  listForumPosts,
  createForumPost,
  deleteForumPost,
  listForumComments,
  createForumComment,
  deleteForumComment,
} from "../services/forum.js";

export function initDashboard({ isAdmin = false, isVerified = false, verificationStatus = "pending", currentUserId = null, currentUserName = "Mahasiswa UT" } = {}) {
  window.L = L;
  const lucide = window.lucide;
const $=(s,root=document)=>root.querySelector(s), $$=(s,root=document)=>[...root.querySelectorAll(s)];
  const state={page:'home',radius:3,groupFilter:'Semua',infoFilter:'all',search:'',map:null,markers:[],circle:null,center:[-6.9175,107.6191],connected:new Set(),pending:new Set(),joined:new Set(),messages:{},infoItems:[],forumPosts:[],forumCourses:[]};
  const students=[
    {id:1,nim:'049100101',initial:'RA',name:'Rina Amelia',prodi:'Manajemen',distance:.55,courses:['Pengantar Manajemen','Statistika'],topics:['Manajemen waktu'],times:['Malam hari'],mode:'Online'},
    {id:2,nim:'049100102',initial:'DP',name:'Dimas Prakoso',prodi:'Sistem Informasi',distance:1.2,courses:['Algoritma & Pemrograman','Sistem Operasi'],topics:['Struktur data','Perulangan'],times:['Akhir pekan','Malam hari'],mode:'Online'},
    {id:3,nim:'049100103',initial:'SN',name:'Siti Nurhaliza',prodi:'PGSD',distance:1.65,courses:['Psikologi Pendidikan'],topics:['Manajemen waktu'],times:['Akhir pekan'],mode:'Offline'},
    {id:4,nim:'049100104',initial:'AW',name:'Agus Wirawan',prodi:'Ilmu Administrasi Publik',distance:2.1,courses:['Pengantar Ilmu Administrasi'],topics:['Analisis data'],times:['Pagi hari'],mode:'Offline'},
    {id:5,nim:'049100105',initial:'PM',name:'Putri Maharani',prodi:'Akuntansi',distance:2.45,courses:['Pengantar Manajemen','Statistika'],topics:['Analisis data'],times:['Malam hari'],mode:'Online'},
    {id:6,nim:'049100106',initial:'FN',name:'Fajar Nugraha',prodi:'Statistika',distance:2.4,courses:['Statistika','Algoritma & Pemrograman'],topics:['Analisis data'],times:['Akhir pekan'],mode:'Online'},
    {id:7,nim:'049100107',initial:'LD',name:'Lestari Dewi',prodi:'Ilmu Komunikasi',distance:2.6,courses:['Bahasa Inggris'],topics:['Manajemen waktu'],times:['Malam hari'],mode:'Offline'},
    {id:8,nim:'049100108',initial:'BS',name:'Budi Santoso',prodi:'Pendidikan Bahasa Inggris',distance:2.9,courses:['Bahasa Inggris'],topics:['Struktur data'],times:['Pagi hari'],mode:'Online'},
    {id:9,nim:'049100109',initial:'AR',name:'Anisa Rahma',prodi:'Manajemen',distance:2.8,courses:['Pengantar Manajemen'],topics:['Manajemen waktu'],times:['Akhir pekan'],mode:'Online'},
    {id:10,nim:'049100110',initial:'RP',name:'Reza Pratama',prodi:'Agribisnis',distance:1.9,courses:['Statistika'],topics:['Analisis data'],times:['Malam hari'],mode:'Offline'}
  ];
  const groups=[
    {id:1,name:'Ruang Belajar Algoritma',course:'Algoritma & Pemrograman',mode:'Online',when:'Kamis, 19.30 WIB',place:'Google Meet',members:14,capacity:20,open:true},
    {id:2,name:'Teman Diskusi Statistika',course:'Statistika',mode:'Offline',when:'Sabtu, 10.00 WIB',place:'Bandung',members:8,capacity:10,open:true},
    {id:3,name:'Sistem Operasi — Study Circle',course:'Sistem Operasi',mode:'Online',when:'Rabu, 20.00 WIB',place:'Zoom',members:20,capacity:20,open:false},
    {id:4,name:'English Practice Corner',course:'Bahasa Inggris',mode:'Online',when:'Minggu, 09.00 WIB',place:'Google Meet',members:9,capacity:15,open:true}
  ];

  function toast(message){const el=$('#toast');el.textContent=message;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),2500)}
  function icons(){if(window.lucide)lucide.createIcons()}
  function navigate(page){state.page=page;$$('.page-section').forEach(s=>s.classList.toggle('active',s.id==='page-'+page));$$('[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===page));const labels={home:'Beranda',matching:'Matching',forum:'Forum',groups:'Grup Belajar',info:'Informasi UT',profile:'Profil Saya',verification:'Verifikasi Mahasiswa'};$('#crumb-current').textContent=labels[page]||'Beranda';window.scrollTo({top:0,behavior:'smooth'});if(page==='home'&&state.map)setTimeout(()=>state.map.invalidateSize(),80);if(page==='verification')loadVerification();if(page==='forum')loadForum();icons()}
  $$('[data-page]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.page)));$$('[data-go]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.go)));
  function visibleStudents(){return students.filter(s=>s.distance<=state.radius&&(!state.search||s.nim.includes(state.search)))}
  function renderNearby(){const list=$('#nearby-list');const items=visibleStudents().slice(0,5);list.innerHTML=items.length?items.map(s=>`<div class="person-row"><div class="person-avatar">${s.initial}</div><div class="person-meta"><strong>${state.connected.has(s.id)?escapeText(s.name):`Mahasiswa ${s.initial}`}</strong><span>${s.prodi}</span></div><span class="distance">~${Math.round(s.distance*10)/10} km</span></div>`).join(''):`<div class="empty-state"><div class="empty-icon"><i data-lucide="user-search"></i></div><h3>Belum ada hasil</h3><p>Tidak ditemukan mahasiswa dalam radius atau pencarian yang dipilih.</p></div>`;icons()}
  function initMap(){if(!window.L)return;const map=L.map('map',{zoomControl:true,scrollWheelZoom:false}).setView(state.center,14);state.map=map;L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);state.circle=L.circle(state.center,{radius:state.radius*1000,color:'#0a4a86',weight:1.5,fillColor:'#8cb7de',fillOpacity:.10,dashArray:'5 6'}).addTo(map);L.marker(state.center,{icon:L.divIcon({className:'',html:'<div class="map-marker me">AB</div>',iconSize:[36,36],iconAnchor:[18,18]})}).addTo(map).bindPopup('<b>Lokasi kamu</b><br><small>Pin demonstrasi, bukan alamat rumah.</small>');renderMapMarkers()}
  function renderMapMarkers(){if(!state.map)return;state.markers.forEach(m=>state.map.removeLayer(m));state.markers=[];visibleStudents().forEach((s,i)=>{const bearing=(s.id*137.5)*Math.PI/180;const latOffset=(Math.cos(bearing)*s.distance)/111.32;const lngOffset=(Math.sin(bearing)*s.distance)/(111.32*Math.cos(state.center[0]*Math.PI/180));const marker=L.marker([state.center[0]+latOffset,state.center[1]+lngOffset],{icon:L.divIcon({className:'',html:`<div class="map-marker"><span>${s.initial}</span></div>`,iconSize:[31,31],iconAnchor:[15,15]})}).addTo(state.map).bindPopup(`<b>${s.initial}</b><br><small>${s.prodi} · sekitar ${s.distance.toFixed(1)} km</small>`);state.markers.push(marker)});if(state.circle)state.circle.setRadius(state.radius*1000);$('#map-result').textContent=`Menampilkan ${visibleStudents().length} mahasiswa dalam radius ${state.radius} km · data simulasi.`;renderNearby()}
  $$('[data-radius]').forEach(b=>b.addEventListener('click',()=>{state.radius=Number(b.dataset.radius);$$('[data-radius]').forEach(x=>x.classList.toggle('active',x===b));renderMapMarkers()}));
  $('#nim-search').addEventListener('input',e=>{state.search=e.target.value.replace(/\D/g,'').slice(0,9);$('#clear-search').style.display=state.search?'inline-flex':'none';renderMapMarkers();if(state.search.length===9){const found=visibleStudents().find(s=>s.nim===state.search);if(found){toast(`Mahasiswa ditemukan: ${found.initial}`);if(state.map){const bearing=(found.id*137.5)*Math.PI/180;const latOffset=(Math.cos(bearing)*found.distance)/111.32;const lngOffset=(Math.sin(bearing)*found.distance)/(111.32*Math.cos(state.center[0]*Math.PI/180));state.map.setView([state.center[0]+latOffset,state.center[1]+lngOffset],16);if(state.markers[0])state.markers[0].openPopup()}}else toast(`NIM tidak ditemukan dalam radius ${state.radius} km`)} });$('#clear-search').addEventListener('click',()=>{$('#nim-search').value='';state.search='';$('#clear-search').style.display='none';renderMapMarkers()});$('#locate-btn').addEventListener('click',()=>toast('Lokasi demo digunakan. GPS belum diaktifkan pada prototype ini.'));
  function renderMatches(){const course=$('#filter-course').value,topic=$('#filter-topic').value,time=$('#filter-time').value,mode=$('#filter-mode').value;const filtered=students.filter(s=>(!course||s.courses.includes(course))&&(!topic||s.topics.includes(topic))&&(!time||s.times.includes(time))&&(!mode||s.mode===mode));$('#match-count').textContent=`${filtered.length} rekomendasi berdasarkan preferensi · data simulasi`;$('#match-results').innerHTML=filtered.length?filtered.map(s=>`<article class="surface match-card"><div class="match-top"><div class="person-avatar">${s.initial}</div><div class="person-meta"><strong>${state.connected.has(s.id)?escapeText(s.name):`Mahasiswa ${s.initial}`}</strong><span>${s.prodi} · sekitar ${s.distance.toFixed(1)} km</span></div><span class="match-score">${s.courses.includes(course)&&course?'Cocok':'Relevan'}</span></div><div class="match-tags">${s.courses.map(c=>`<span class="tag">${c}</span>`).join('')}${s.topics.map(t=>`<span class="tag">${t}</span>`).join('')}</div><div class="match-card-foot"><span class="tiny muted">${s.mode} · ${s.times.join(', ')}</span>${state.connected.has(s.id)?`<button class="btn btn-primary btn-sm" data-chat="${s.id}"><i data-lucide="message-circle"></i>Chat</button>`:state.pending?.has(s.id)?`<div style="display:flex;align-items:center;gap:6px"><span class="tiny muted">Menunggu</span><button class="btn btn-secondary btn-sm" data-accept="${s.id}">Simulasikan diterima</button></div>`:`<button class="btn btn-primary btn-sm" data-connect="${s.id}">Connect</button>`}</div></article>`).join(''):`<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon"><i data-lucide="users"></i></div><h3>Belum ada rekomendasi yang sesuai</h3><p>Coba ubah preferensi mata kuliah, topik, atau waktu belajar.</p></div>`;$$('[data-connect]').forEach(b=>b.addEventListener('click',()=>{const id=Number(b.dataset.connect);state.pending.add(id);renderMatches();toast('Permintaan connect dicatat di sesi demo.')}));$$('[data-accept]').forEach(b=>b.addEventListener('click',()=>{const id=Number(b.dataset.accept);state.pending.delete(id);state.connected.add(id);renderMatches();toast('Koneksi demo disetujui. Tombol chat sekarang aktif.')}));$$('[data-chat]').forEach(b=>b.addEventListener('click',()=>openChat(Number(b.dataset.chat))));icons()}
  $('#apply-match').addEventListener('click',renderMatches);$('#reset-match').addEventListener('click',()=>{$$('#page-matching select').forEach(s=>s.value='');renderMatches()});

  const FORUM_POST_TYPES = { need_help: "Butuh bantuan", can_help: "Bisa membantu", discussion: "Diskusi umum" };
  function forumDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Tanggal tidak tersedia" : date.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
  }
  function renderForumAccess() {
    const composer = $("#forum-compose");
    const notice = $("#forum-access-notice");
    const newPostButton = $("#new-post");
    if (composer) composer.hidden = !isVerified;
    if (newPostButton) newPostButton.hidden = !isVerified;
    if (notice) {
      notice.hidden = isVerified;
      const reason = verificationStatus === "rejected"
        ? "Bukti verifikasi kamu perlu diperbaiki terlebih dahulu."
        : "Akses forum dibuka setelah status mahasiswa kamu terverifikasi.";
      notice.innerHTML = `<div class="empty-icon"><i data-lucide="shield-check"></i></div><h3>Forum khusus mahasiswa terverifikasi</h3><p>${reason} Silakan selesaikan proses verifikasi mahasiswa terlebih dahulu.</p><button type="button" class="btn btn-primary btn-sm" id="forum-go-verification">Buka verifikasi</button>`;
      $("#forum-go-verification")?.addEventListener("click", () => navigate("verification"));
    }
    icons();
  }
  function populateForumCourses(courses) {
    const select = $("#post-course");
    const notice = $("#forum-course-notice");
    if (!select) return;
    select.innerHTML = '<option value="">Diskusi umum</option>' + courses.map(course =>
      `<option value="${escapeText(course.id)}">${escapeText(course.course_name)}${course.course_code ? ` · ${escapeText(course.course_code)}` : ""}</option>`
    ).join("");
    if (notice) notice.hidden = courses.length > 0;
  }
  function renderForum() {
    const list = $("#post-list");
    if (!list) return;
    if (!state.forumPosts.length) {
      list.innerHTML = '<div class="empty-state"><div class="empty-icon"><i data-lucide="messages-square"></i></div><h3>Belum ada diskusi</h3><p>Jadilah yang pertama mengajukan pertanyaan atau berbagi pemahaman dengan mahasiswa lain.</p></div>';
      icons();
      return;
    }
    list.innerHTML = state.forumPosts.map(post => {
      const ownPost = post.author_id === currentUserId;
      const author = ownPost ? currentUserName : "Mahasiswa UT";
      const typeLabel = FORUM_POST_TYPES[post.post_type] || "Diskusi";
      const courseLabel = post.course?.course_name || "Diskusi umum";
      const deleteButton = ownPost
        ? `<button type="button" class="btn btn-quiet btn-sm forum-delete" data-forum-delete="${escapeText(post.id)}"><i data-lucide="trash-2"></i>Hapus</button>`
        : "";
      return `
        <article class="surface post-card forum-post-card">
          <div class="forum-post-meta"><span class="tag">${escapeText(typeLabel)}</span><span class="tag">${escapeText(courseLabel)}</span></div>
          <div class="post-author"><div class="person-avatar">${escapeText(ownPost ? currentUserName.split(/\\s+/).slice(0,2).map(x=>x[0]||"").join("").toUpperCase() : "UT")}</div><div class="person-meta"><strong>${escapeText(author)}</strong><span>${escapeText(forumDate(post.created_at))}</span></div></div>
          <h3 class="forum-post-title">${escapeText(post.title)}</h3>
          <p class="forum-post-body">${escapeText(post.body)}</p>
          <div class="post-actions forum-post-actions"><button type="button" data-forum-thread="${escapeText(post.id)}"><i data-lucide="message-circle"></i>Buka diskusi</button>${deleteButton}</div>
        </article>`;
    }).join("");
    $$("[data-forum-thread]").forEach(button => button.addEventListener("click", () => openForumThread(button.dataset.forumThread)));
    $$("[data-forum-delete]").forEach(button => button.addEventListener("click", () => confirmDeleteForumPost(button.dataset.forumDelete)));
    icons();
  }
  async function loadForum({ showLoading = true } = {}) {
    if (!isVerified) {
      renderForumAccess();
      $("#post-list").innerHTML = "";
      return;
    }
    renderForumAccess();
    if (showLoading) $("#post-list").innerHTML = '<div class="verification-loading">Memuat diskusi mahasiswa...</div>';
    try {
      const [courses, posts] = await Promise.all([listActiveForumCourses(), listForumPosts()]);
      state.forumCourses = courses;
      state.forumPosts = posts;
      populateForumCourses(courses);
      renderForum();
    } catch (error) {
      console.error("Forum load failed:", error);
      $("#post-list").innerHTML = `<div class="empty-state"><div class="empty-icon"><i data-lucide="alert-circle"></i></div><h3>Forum belum dapat dimuat</h3><p>${escapeText(error?.message || "Periksa koneksi lalu coba kembali.")}</p><button class="btn btn-secondary btn-sm" id="forum-retry">Coba lagi</button></div>`;
      $("#forum-retry")?.addEventListener("click", () => loadForum());
      icons();
    }
  }
  $("#publish-post").addEventListener("click", async () => {
    if (!isVerified) { toast("Verifikasi mahasiswa diperlukan untuk membuat diskusi."); return; }
    const title = $("#post-title").value.trim();
    const body = $("#post-content").value.trim();
    const postType = $("#post-type").value;
    const courseId = $("#post-course").value || null;
    if (title.length < 3 || title.length > 140) { toast("Judul diskusi harus 3–140 karakter."); return; }
    if (!body || body.length > 5000) { toast("Isi diskusi wajib diisi dan maksimal 5.000 karakter."); return; }
    if (!Object.hasOwn(FORUM_POST_TYPES, postType)) { toast("Jenis diskusi tidak valid."); return; }
    const button = $("#publish-post");
    button.disabled = true;
    button.textContent = "Mempublikasikan...";
    try {
      await createForumPost({ title, body, postType, courseId });
      $("#post-title").value = "";
      $("#post-content").value = "";
      $("#post-type").value = "need_help";
      $("#post-course").value = "";
      await loadForum({ showLoading: false });
      toast("Diskusi berhasil dipublikasikan.");
    } catch (error) {
      console.error("Forum post creation failed:", error);
      toast(`Diskusi gagal dipublikasikan: ${error?.message || "periksa status verifikasi dan koneksi."}`);
    } finally {
      button.disabled = false;
      button.innerHTML = '<i data-lucide="send"></i>Publikasikan';
      icons();
    }
  });
  $("#new-post").addEventListener("click", () => $("#post-title")?.focus());
  async function openForumThread(postId) {
    const post = state.forumPosts.find(item => item.id === postId);
    if (!post) return;
    try {
      const comments = await listForumComments(postId);
      const commentsHtml = comments.length ? comments.map(comment => {
        const ownComment = comment.author_id === currentUserId;
        const author = ownComment ? currentUserName : "Mahasiswa UT";
        const remove = ownComment
          ? `<button type="button" class="link-btn forum-comment-delete" data-forum-comment-delete="${escapeText(comment.id)}">Hapus</button>`
          : "";
        return `<div class="forum-comment"><div class="forum-comment-head"><strong>${escapeText(author)}</strong><span>${escapeText(forumDate(comment.created_at))}</span></div><p>${escapeText(comment.body)}</p>${remove}</div>`;
      }).join("") : '<div class="forum-thread-empty">Belum ada tanggapan. Mulai percakapan dengan komentar yang relevan dan santun.</div>';
      openModal("Diskusi dan tanggapan", `
        <div class="forum-thread">
          <span class="tag">${escapeText(FORUM_POST_TYPES[post.post_type] || "Diskusi")}</span>
          <h3>${escapeText(post.title)}</h3>
          <p class="forum-thread-body">${escapeText(post.body)}</p>
          <div class="forum-thread-comments"><strong>Tanggapan (${comments.length})</strong>${commentsHtml}</div>
          <div class="field"><label for="forum-comment-input">Tulis tanggapan</label><textarea id="forum-comment-input" class="textarea" rows="3" maxlength="3000" placeholder="Berikan penjelasan atau pertanyaan lanjutan..."></textarea></div>
          <button type="button" class="btn btn-primary btn-sm" id="forum-comment-send"><i data-lucide="send"></i>Kirim tanggapan</button>
        </div>`, "Tutup");
      $("#modal-confirm").style.display = "none";
      $("#modal-cancel").textContent = "Tutup";
      $("#forum-comment-send").addEventListener("click", async () => {
        const input = $("#forum-comment-input");
        const body = input.value.trim();
        if (!body || body.length > 3000) { toast("Tanggapan wajib diisi dan maksimal 3.000 karakter."); return; }
        const button = $("#forum-comment-send");
        button.disabled = true;
        button.textContent = "Mengirim...";
        try {
          await createForumComment(postId, body);
          toast("Tanggapan berhasil dikirim.");
          await openForumThread(postId);
        } catch (error) {
          console.error("Forum comment creation failed:", error);
          toast(`Tanggapan gagal dikirim: ${error?.message || "periksa status verifikasi dan koneksi."}`);
          button.disabled = false;
          button.innerHTML = '<i data-lucide="send"></i>Kirim tanggapan';
          icons();
        }
      });
      $$("[data-forum-comment-delete]").forEach(button => button.addEventListener("click", async () => {
        try {
          await deleteForumComment(button.dataset.forumCommentDelete);
          toast("Tanggapan dihapus.");
          await openForumThread(postId);
        } catch (error) {
          toast(error?.message || "Tanggapan tidak dapat dihapus.");
        }
      }));
      icons();
    } catch (error) {
      console.error("Forum thread load failed:", error);
      toast(error?.message || "Tanggapan tidak dapat dimuat.");
    }
  }
  function confirmDeleteForumPost(postId) {
    const post = state.forumPosts.find(item => item.id === postId);
    if (!post || post.author_id !== currentUserId) return;
    openModal("Hapus diskusi?", `<p class="section-note">Diskusi <strong>${escapeText(post.title)}</strong> dan seluruh tanggapannya akan dihapus. Tindakan ini tidak dapat dibatalkan.</p>`, "Hapus diskusi", async () => {
      try {
        await deleteForumPost(postId);
        await loadForum({ showLoading: false });
        return true;
      } catch (error) {
        toast(error?.message || "Diskusi tidak dapat dihapus.");
        return false;
      }
    }, "Diskusi berhasil dihapus.");
  }
  function renderGroups(){const q=$('#group-search').value.toLowerCase();const filtered=groups.filter(g=>(state.groupFilter==='Semua'||g.mode===state.groupFilter)&&(`${g.name} ${g.course}`.toLowerCase().includes(q)));$('#group-list').innerHTML=filtered.map(g=>`<article class="surface group-card"><div class="group-head"><div><h3>${escapeText(g.name)}</h3><div class="group-sub">${escapeText(g.course)}</div></div><span class="mode ${g.mode.toLowerCase()}">${g.mode}</span></div><div class="group-sub" style="margin-top:11px"><i data-lucide="calendar-days" style="width:12px;height:12px;vertical-align:middle"></i> ${escapeText(g.when)} · ${escapeText(g.place)}</div><div class="capacity"><span style="width:${g.members/g.capacity*100}%"></span></div><div class="group-sub">${g.members} dari ${g.capacity} anggota</div><div class="group-foot"><span class="tiny" style="color:${g.open?'#287b59':'#b7791f'}">${g.open?'Pendaftaran dibuka':'Kapasitas penuh'}</span><button class="btn ${state.joined.has(g.id)?'btn-secondary':'btn-primary'} btn-sm" data-join="${g.id}" ${!g.open&&!state.joined.has(g.id)?'disabled':''}>${state.joined.has(g.id)?'Tergabung':g.open?'Lihat grup':'Penuh'}</button></div></article>`).join('')||'<div class="empty-state" style="grid-column:1/-1"><h3>Kelompok tidak ditemukan</h3><p>Coba kata kunci atau filter lain.</p></div>';$$('[data-join]').forEach(b=>b.addEventListener('click',()=>{const id=Number(b.dataset.join);state.joined.add(id);renderGroups();toast('Status bergabung demo diperbarui.')}));icons()}
  $('#group-search').addEventListener('input',renderGroups);$$('[data-group-filter]').forEach(b=>b.addEventListener('click',()=>{state.groupFilter=b.dataset.groupFilter;$$('[data-group-filter]').forEach(x=>x.classList.toggle('active',x===b));renderGroups()}));$('#create-group').addEventListener('click',()=>openModal('Buat kelompok belajar',`<p class="section-note">Kelompok baru akan ditambahkan ke sesi preview ini. Penyimpanan bersama memerlukan backend.</p><div class="field"><label for="new-group-name">Nama kelompok</label><input id="new-group-name" class="text-input" placeholder="Contoh: Belajar Algoritma Bersama" maxlength="70"></div><div class="field"><label for="new-group-course">Mata kuliah</label><select id="new-group-course" class="select"><option>Algoritma & Pemrograman</option><option>Statistika</option><option>Sistem Operasi</option><option>Pengantar Manajemen</option><option>Bahasa Inggris</option></select></div><div class="field"><label for="new-group-mode">Mode pertemuan</label><select id="new-group-mode" class="select"><option>Online</option><option>Offline</option></select></div><div class="field"><label for="new-group-cap">Kapasitas (2–100)</label><input id="new-group-cap" class="text-input" type="number" min="2" max="100" value="10"></div><div class="field"><label for="new-group-when">Jadwal</label><input id="new-group-when" class="text-input" placeholder="Contoh: Sabtu, 19.00 WIB"></div>`,`Buat kelompok (demo)`,()=>{const name=$('#new-group-name').value.trim(),capacity=Number($('#new-group-cap').value),when=$('#new-group-when').value.trim();if(!name||!when||!Number.isInteger(capacity)||capacity<2||capacity>100){toast('Lengkapi nama, jadwal, dan kapasitas 2–100.');return false}groups.unshift({id:Date.now(),name,course:$('#new-group-course').value,mode:$('#new-group-mode').value,when,place:$('#new-group-mode').value==='Online'?'Platform online':'Lokasi menyusul',members:1,capacity,open:true});renderGroups();return true}));
  const INFO_CATEGORY_LABELS={competition:'Lomba',job:'Loker',seminar:'Seminar',tips:'Tips Belajar',ukm:'UKM',hima:'HIMA',academic:'Akademik'};
  const INFO_CATEGORY_OPTIONS=Object.entries(INFO_CATEGORY_LABELS);
  function infoDate(value){
    if(!value)return 'Belum dipublikasikan';
    const date=new Date(value);
    return Number.isNaN(date.getTime())?'Tanggal tidak tersedia':date.toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'});
  }
  function safeInfoUrl(value){
    if(!value)return '';
    try{const parsed=new URL(value);return ['http:','https:'].includes(parsed.protocol)?parsed.href:''}catch{return ''}
  }
  function renderInfo(){
    const grid=$('#info-grid');
    const visible=state.infoItems.filter(item=>state.infoFilter==='all'||item.category===state.infoFilter);
    if(!visible.length){
      grid.innerHTML=`<div class="empty-state info-empty"><div class="empty-icon"><i data-lucide="megaphone"></i></div><h3>Belum ada informasi</h3><p>${isAdmin?'Tambahkan informasi pertama untuk mulai mengisi kanal Informasi UT.':'Belum ada informasi yang dapat ditampilkan pada kategori ini.'}</p>${isAdmin?'<button class="btn btn-primary btn-sm" id="info-empty-create"><i data-lucide="plus"></i>Tambah informasi</button>':''}</div>`;
      const create=$('#info-empty-create');if(create)create.addEventListener('click',()=>openInfoEditor());
      icons();
      return;
    }
    grid.innerHTML=visible.map(post=>{
      const category=INFO_CATEGORY_LABELS[post.category]||'Informasi';
      const audience=post.audience==='public'?'Semua pengunjung':'Mahasiswa terverifikasi';
      const sourceUrl=safeInfoUrl(post.source_url);
      const status=post.is_published?'Dipublikasikan':'Draft';
      const actions=isAdmin?`<div class="info-admin-actions">
        <button class="btn btn-secondary btn-sm" data-info-edit="${escapeText(post.id)}"><i data-lucide="pencil"></i>Edit</button>
        <button class="btn btn-secondary btn-sm" data-info-publish="${escapeText(post.id)}">${post.is_published?'<i data-lucide="eye-off"></i>Tarik':'<i data-lucide="send"></i>Publikasikan'}</button>
        <button class="btn btn-quiet btn-sm info-delete" data-info-delete="${escapeText(post.id)}"><i data-lucide="trash-2"></i>Hapus</button>
      </div>`:'';
      return `<article class="surface info-card ${post.is_published?'':'is-draft'}">
        <div class="info-card-top"><span class="info-type">${escapeText(category)}</span>${isAdmin?`<span class="info-status ${post.is_published?'published':'draft'}">${status}</span>`:''}</div>
        <h3>${escapeText(post.title)}</h3>
        <p class="info-body">${escapeText(post.body)}</p>
        ${sourceUrl?`<a class="info-source" href="${escapeText(sourceUrl)}" target="_blank" rel="noopener noreferrer">Lihat sumber <i data-lucide="external-link"></i></a>`:''}
        <div class="info-by">${post.is_published?'Dipublikasikan':'Dibuat'} · ${infoDate(post.published_at||post.created_at)} ${isAdmin?'· '+escapeText(audience):''}</div>
        ${actions}
      </article>`;
    }).join('');
    if(isAdmin){
      $$('[data-info-edit]').forEach(button=>button.addEventListener('click',()=>openInfoEditor(state.infoItems.find(item=>item.id===button.dataset.infoEdit))));
      $$('[data-info-publish]').forEach(button=>button.addEventListener('click',()=>toggleInfoPublication(button.dataset.infoPublish)));
      $$('[data-info-delete]').forEach(button=>button.addEventListener('click',()=>confirmDeleteInfo(button.dataset.infoDelete)));
    }
    icons();
  }
  async function loadInformation({showLoading=true}={}){
    const grid=$('#info-grid');
    if(showLoading)grid.innerHTML='<div class="empty-state info-empty"><div class="auth-guard-spinner" style="margin:0 auto 12px"></div><h3>Memuat informasi</h3><p>Mengambil informasi terbaru dari UT Connect.</p></div>';
    try{
      state.infoItems=await listInformationPosts();
      renderInfo();
    }catch(error){
      console.error('Failed to load Information UT:',error);
      grid.innerHTML='<div class="empty-state info-empty"><div class="empty-icon"><i data-lucide="alert-circle"></i></div><h3>Informasi belum dapat dimuat</h3><p>Periksa koneksi lalu coba kembali. Jika masalah berlanjut, hubungi administrator.</p><button class="btn btn-secondary btn-sm" id="info-retry">Coba lagi</button></div>';
      $('#info-retry')?.addEventListener('click',()=>loadInformation());
      icons();
    }
  }
  function openInfoEditor(post=null){
    if(!isAdmin){toast('Hanya administrator yang dapat mengelola informasi.');return}
    const current=post||{};
    const categoryOptions=INFO_CATEGORY_OPTIONS.map(([value,label])=>`<option value="${value}" ${current.category===value?'selected':''}>${label}</option>`).join('');
    const audienceOptions=[['public','Semua pengunjung'],['verified_students','Mahasiswa terverifikasi']].map(([value,label])=>`<option value="${value}" ${(current.audience||'public')===value?'selected':''}>${label}</option>`).join('');
    const content=`<div class="info-editor">
      <div class="field"><label for="info-title-input">Judul informasi</label><input id="info-title-input" class="text-input" maxlength="160" required value="${escapeText(current.title||'')}" placeholder="Contoh: Pendaftaran kegiatan mahasiswa"></div>
      <div class="field"><label for="info-category-input">Kategori</label><select id="info-category-input" class="select">${categoryOptions}</select></div>
      <div class="field"><label for="info-body-input">Isi informasi</label><textarea id="info-body-input" class="textarea" rows="6" maxlength="8000" required placeholder="Jelaskan informasi secara jelas, termasuk ketentuan dan jadwal penting.">${escapeText(current.body||'')}</textarea><small class="field-hint">Maksimal 8.000 karakter.</small></div>
      <div class="field"><label for="info-source-input">Tautan sumber (opsional)</label><input id="info-source-input" class="text-input" type="url" maxlength="2048" value="${escapeText(current.source_url||'')}" placeholder="https://..."></div>
      <div class="field"><label for="info-audience-input">Siapa yang dapat melihat?</label><select id="info-audience-input" class="select">${audienceOptions}</select></div>
      <label class="info-publish-check"><input id="info-publish-input" type="checkbox" ${(current.is_published??true)?'checked':''}> <span><strong>Publikasikan sekarang</strong><small>Jika tidak dicentang, informasi disimpan sebagai draft dan hanya terlihat oleh administrator.</small></span></label>
    </div>`;
    openModal(post?'Edit informasi':'Tambah informasi',content,'Simpan informasi',async()=>{
      const title=$('#info-title-input').value.trim();
      const body=$('#info-body-input').value.trim();
      const sourceRaw=$('#info-source-input').value.trim();
      const category=$('#info-category-input').value;
      const audience=$('#info-audience-input').value;
      const publish=$('#info-publish-input').checked;
      if(title.length<3||title.length>160||!body||body.length>8000){toast('Judul minimal 3 karakter dan isi wajib diisi (maksimal 8.000 karakter).');return false}
      let source_url=null;
      if(sourceRaw){
        source_url=safeInfoUrl(sourceRaw);
        if(!source_url){toast('Tautan sumber harus menggunakan alamat HTTP atau HTTPS yang valid.');return false}
      }
      const publishedAt=publish?(post?.is_published&&post.published_at?post.published_at:new Date().toISOString()):null;
      const payload={title,body,category,audience,source_url,is_published:publish,published_at:publishedAt};
      try{
        if(post)await updateInformationPost(post.id,payload);
        else await createInformationPost(payload);
        await loadInformation({showLoading:false});
        return true;
      }catch(error){
        console.error('Failed to save Information UT post:',error);
        toast(`Gagal menyimpan informasi: ${error.message||'periksa koneksi dan hak akses.'}`);
        return false;
      }
    },'Informasi berhasil disimpan.');
    icons();
  }
  async function toggleInfoPublication(id){
    const post=state.infoItems.find(item=>item.id===id);
    if(!post||!isAdmin)return;
    const publish=!post.is_published;
    try{
      await updateInformationPost(id,{is_published:publish,published_at:publish?new Date().toISOString():null});
      await loadInformation({showLoading:false});
      toast(publish?'Informasi berhasil dipublikasikan.':'Informasi ditarik dan disimpan sebagai draft.');
    }catch(error){
      console.error('Failed to change Information UT publication:',error);
      toast(`Gagal memperbarui status: ${error.message||'periksa hak akses.'}`);
    }
  }
  function confirmDeleteInfo(id){
    if(!isAdmin)return;
    const post=state.infoItems.find(item=>item.id===id);
    if(!post)return;
    openModal('Hapus informasi?',`<p class="section-note">Informasi <strong>${escapeText(post.title)}</strong> akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.</p>`,'Hapus permanen',async()=>{
      try{
        await deleteInformationPost(id);
        await loadInformation({showLoading:false});
        return true;
      }catch(error){
        console.error('Failed to delete Information UT post:',error);
        toast(`Gagal menghapus informasi: ${error.message||'periksa hak akses.'}`);
        return false;
      }
    },'Informasi berhasil dihapus.');
  }
  $$('[data-info-filter]').forEach(button=>button.addEventListener('click',()=>{
    state.infoFilter=button.dataset.infoFilter;
    $$('[data-info-filter]').forEach(item=>item.classList.toggle('active',item===button));
    renderInfo();
  }));
  const shareInfoButton=$('#share-info');
  if(shareInfoButton){
    shareInfoButton.hidden=!isAdmin;shareInfoButton.style.display=isAdmin?'':'none';
    if(isAdmin){
      shareInfoButton.innerHTML='<i data-lucide="plus"></i>Tambah informasi';
      shareInfoButton.addEventListener('click',()=>openInfoEditor());
    }
  }

  // Student verification: evidence is stored in a private bucket and decisions are enforced by Supabase RPCs.
  let activeVerificationPreviewUrl = null;
  function verificationDate(value) {
    if (!value) return "-";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
  }
  function renderVerificationSubmission(status) {
    const panel = $("#verification-submit-panel");
    const latest = status?.latest_request;
    if (status?.profile_status === "verified") {
      panel.innerHTML = '<div class="verification-result success"><span class="verification-symbol">✓</span><div><strong>Verifikasi disetujui</strong><p>Status mahasiswa akun ini telah diverifikasi oleh administrator.</p></div></div>';
      return;
    }
    if (latest?.status === "submitted") {
      panel.innerHTML = `<div class="verification-result pending"><span class="verification-symbol">…</span><div><strong>Bukti sedang diperiksa</strong><p>Dokumen ${escapeText(latest.original_filename || "yang diunggah")} diterima pada ${escapeText(verificationDate(latest.submitted_at))}. Tunggu hasil pemeriksaan administrator.</p></div></div>`;
      return;
    }
    const rejection = status?.profile_status === "rejected"
      ? `<div class="verification-result rejected"><span class="verification-symbol">!</span><div><strong>Verifikasi belum disetujui</strong><p>${escapeText(latest?.review_note || "Silakan periksa kembali dokumen dan kirim bukti yang sesuai.")}</p></div></div>`
      : "";
    panel.innerHTML = `
      ${rejection}
      <div class="verification-panel-head"><div><h2>Unggah bukti status mahasiswa</h2><p>Gunakan dokumen yang menunjukkan status mahasiswa UT aktif, misalnya bukti registrasi atau KRS semester berjalan. KTM dapat menjadi dokumen pendukung.</p></div></div>
      <form id="verification-form" class="verification-form">
        <label class="verification-upload" for="verification-file"><span class="upload-symbol">↑</span><strong>Pilih dokumen bukti</strong><small>PDF, JPG, atau PNG · Maksimal 5 MB</small><input id="verification-file" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" required></label>
        <label class="verification-consent"><input id="verification-consent" type="checkbox" required><span>Saya memastikan dokumen yang dikirim benar dan mengizinkan UT Connect menggunakannya hanya untuk pemeriksaan status mahasiswa.</span></label>
        <button class="btn btn-primary" id="verification-submit" type="submit">Kirim untuk diverifikasi</button>
      </form>
      <p class="verification-privacy">Berkas disimpan pada penyimpanan privat. Hanya administrator yang berwenang dapat mengaksesnya untuk pemeriksaan. Jangan unggah KTP atau dokumen yang memuat data pribadi yang tidak diperlukan.</p>
    `;
    $("#verification-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const file = $("#verification-file").files?.[0];
      const consent = $("#verification-consent").checked;
      if (!file || !consent) { toast("Pilih dokumen dan setujui pernyataan terlebih dahulu."); return; }
      const button = $("#verification-submit");
      button.disabled = true;
      button.textContent = "Mengunggah bukti...";
      try {
        await submitStudentVerificationEvidence(file);
        toast("Bukti berhasil dikirim. Status menunggu pemeriksaan.");
        await loadVerification();
      } catch (error) {
        console.error("Student verification submission failed:", error);
        toast(error?.message || "Bukti belum berhasil dikirim.");
        button.disabled = false;
        button.textContent = "Kirim untuk diverifikasi";
      }
    });
  }
  function renderVerificationQueue(items) {
    const container = $("#verification-queue");
    if (!items.length) {
      container.innerHTML = '<div class="empty-state verification-empty"><div class="empty-icon"><i data-lucide="inbox"></i></div><h3>Belum ada permohonan masuk</h3><p>Permohonan verifikasi baru akan muncul di sini setelah mahasiswa mengunggah bukti.</p></div>';
      icons();
      return;
    }
    container.innerHTML = items.map(item => `
      <article class="verification-queue-card">
        <div class="verification-queue-head"><div><strong>${escapeText(item.full_name)}</strong><span>${escapeText(item.program)} · ${escapeText(item.faculty)}</span></div><span class="verification-status-pill">Menunggu</span></div>
        <div class="verification-meta"><span>Semester ${escapeText(item.semester)}</span><span>Dikirim ${escapeText(verificationDate(item.submitted_at))}</span></div>
        <div class="verification-file-row"><span class="verification-file-name">▣ ${escapeText(item.original_filename)}</span><button class="btn btn-secondary btn-sm" type="button" data-verification-preview="${escapeText(item.storage_path)}" data-verification-filename="${escapeText(item.original_filename)}">Lihat bukti</button></div>
        <div class="verification-review-actions"><button class="btn btn-primary btn-sm" type="button" data-verification-approve="${escapeText(item.request_id)}">Setujui</button><button class="btn btn-secondary btn-sm verification-reject-button" type="button" data-verification-reject="${escapeText(item.request_id)}">Tolak dengan alasan</button></div>
      </article>
    `).join("");
    container.querySelectorAll("[data-verification-preview]").forEach(button => button.addEventListener("click", () => previewVerificationEvidence(button.dataset.verificationPreview, button.dataset.verificationFilename)));
    container.querySelectorAll("[data-verification-approve]").forEach(button => button.addEventListener("click", () => confirmVerificationReview(button.dataset.verificationApprove, "approved")));
    container.querySelectorAll("[data-verification-reject]").forEach(button => button.addEventListener("click", () => confirmVerificationReview(button.dataset.verificationReject, "rejected")));
    icons();
  }
  async function previewVerificationEvidence(storagePath, filename) {
    try {
      const blob = await downloadStudentVerificationEvidence(storagePath);
      if (activeVerificationPreviewUrl) URL.revokeObjectURL(activeVerificationPreviewUrl);
      activeVerificationPreviewUrl = URL.createObjectURL(blob);
      const safeFilename = escapeText(filename || "Bukti verifikasi");
      const content = blob.type.startsWith("image/")
        ? `<div class="verification-preview"><img src="${activeVerificationPreviewUrl}" alt="${safeFilename}"><p>${safeFilename}</p></div>`
        : `<div class="verification-preview"><div class="empty-icon"><i data-lucide="file-pdf"></i></div><strong>${safeFilename}</strong><p>Dokumen PDF berhasil diambil dari penyimpanan privat.</p><a class="btn btn-primary" href="${activeVerificationPreviewUrl}" target="_blank" rel="noopener noreferrer" download="${safeFilename}">Buka / unduh PDF</a></div>`;
      openModal("Bukti verifikasi mahasiswa", content, "Selesai");
      icons();
    } catch (error) {
      console.error("Unable to load verification evidence:", error);
      toast(error?.message || "Bukti tidak dapat dibuka.");
    }
  }
  function confirmVerificationReview(requestId, decision) {
    const approving = decision === "approved";
    const content = approving
      ? '<p class="section-note">Pastikan dokumen menunjukkan status mahasiswa UT aktif dan data akademik sesuai dengan profil yang diajukan.</p>'
      : '<p class="section-note">Tuliskan alasan singkat agar mahasiswa mengetahui hal yang perlu diperbaiki sebelum mengirim ulang.</p><label class="field"><span>Alasan penolakan</span><textarea id="verification-reject-note" class="text-input" rows="4" maxlength="500" placeholder="Contoh: Bukti registrasi semester berjalan belum terlihat."></textarea></label>';
    openModal(
      approving ? "Setujui verifikasi mahasiswa?" : "Tolak permohonan verifikasi?",
      content,
      approving ? "Setujui bukti" : "Kirim penolakan",
      async () => {
        const note = approving ? null : $("#verification-reject-note")?.value.trim();
        if (!approving && (!note || note.length < 5)) {
          toast("Alasan penolakan minimal 5 karakter.");
          return false;
        }
        await reviewStudentVerificationRequest(requestId, decision, note);
        await loadVerification();
        return true;
      },
      approving ? "Status mahasiswa berhasil diverifikasi." : "Permohonan ditolak. Mahasiswa dapat mengirim bukti ulang."
    );
  }
  async function loadVerification() {
    const statusPanel = $("#verification-status-panel");
    const queuePanel = $("#verification-admin-panel");
    if (!statusPanel) return;
    statusPanel.innerHTML = '<div class="verification-loading">Memuat status verifikasi...</div>';
    try {
      const status = await getMyStudentVerificationStatus();
      const profileStatus = status?.profile_status || "pending";
      const labels = { pending: "Belum terverifikasi", verified: "Terverifikasi", rejected: "Perlu perbaikan" };
      const styles = { pending: "pending", verified: "success", rejected: "rejected" };
      statusPanel.innerHTML = `
        <div class="verification-status-head"><div><div class="eyebrow">Status akun mahasiswa</div><h2>${labels[profileStatus] || "Belum terverifikasi"}</h2><p>Login Google atau email tidak otomatis membuktikan status mahasiswa UT.</p></div><span class="verification-status-pill ${styles[profileStatus] || "pending"}">${escapeText(profileStatus.toUpperCase())}</span></div>
        <div class="verification-steps"><span class="verification-step done">1. Lengkapi profil</span><span class="verification-step ${status?.latest_request ? "done" : ""}">2. Kirim bukti</span><span class="verification-step ${profileStatus === "verified" ? "done" : ""}">3. Pemeriksaan admin</span></div>
      `;
      renderVerificationSubmission(status);
      if (isAdmin && queuePanel) {
        queuePanel.hidden = false;
        $("#verification-queue").innerHTML = '<div class="verification-loading">Memuat antrean...</div>';
        const items = await listStudentVerificationQueue();
        renderVerificationQueue(items);
        $("#verification-queue-count").textContent = String(items.length);
      } else if (queuePanel) {
        queuePanel.hidden = true;
      }
    } catch (error) {
      console.error("Student verification load failed:", error);
      statusPanel.innerHTML = `<div class="verification-result rejected"><span class="verification-symbol">!</span><div><strong>Status belum dapat dimuat</strong><p>${escapeText(error?.message || "Periksa koneksi lalu coba lagi.")}</p><button class="btn btn-secondary btn-sm" id="verification-retry">Coba lagi</button></div></div>`;
      $("#verification-retry")?.addEventListener("click", loadVerification);
      if (isAdmin && queuePanel) {
        queuePanel.hidden = false;
        $("#verification-queue").innerHTML = '<p class="section-note">Antrean belum dapat dimuat.</p>';
      }
    }
  }
  $("#verification-refresh")?.addEventListener("click", loadVerification);

  function openChat(id){const s=students.find(x=>x.id===id);if(!s)return;const msgs=state.messages[id]||[];openModal(`Chat dengan ${s.name}`,`<div class="tiny muted" style="margin-bottom:10px">Percakapan pribadi · mode demo, belum real-time</div><div id="chat-history" style="min-height:150px;max-height:280px;overflow:auto;background:#f7f9fc;border:1px solid var(--line);border-radius:12px;padding:12px;display:grid;align-content:start;gap:8px">${msgs.length?msgs.map(m=>`<div style="justify-self:end;max-width:85%;background:#eaf1fa;color:#23415f;padding:9px 11px;border-radius:12px 12px 3px 12px;font-size:11px;line-height:1.6">${escapeText(m)}</div>`).join(''):'<div class="empty-state" style="border:0;background:transparent;padding:28px 8px"><h3>Mulai percakapan</h3><p>Belum ada pesan. Kirim pesan pertama untuk memulai diskusi belajar.</p></div>'}</div><div style="display:flex;gap:7px;margin-top:10px"><input id="chat-input" class="text-input" placeholder="Tulis pesan..." style="flex:1"><button id="chat-send" class="btn btn-primary"><i data-lucide="send"></i>Kirim</button></div><p class="tiny muted" style="margin:9px 0 0">Pesan hanya tersimpan sementara di sesi browser ini. Tidak dikirim ke mahasiswa lain.</p>`);$('#modal-confirm').style.display='none';$('#modal-cancel').textContent='Tutup';const send=()=>{const input=$('#chat-input');const value=input.value.trim();if(!value)return;(state.messages[id]??=[]).push(value);const history=$('#chat-history');history.innerHTML=state.messages[id].map(m=>`<div style="justify-self:end;max-width:85%;background:#eaf1fa;color:#23415f;padding:9px 11px;border-radius:12px 12px 3px 12px;font-size:11px;line-height:1.6">${escapeText(m)}</div>`).join('');input.value='';history.scrollTop=history.scrollHeight};$('#chat-send').addEventListener('click',send);$('#chat-input').addEventListener('keydown',e=>{if(e.key==='Enter')send()});icons()}
  function escapeText(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  let modalAction=null,modalSuccessMessage='Perubahan diterapkan pada sesi demo.';function openModal(title,content,confirm='Mengerti',action=null,successMessage='Perubahan diterapkan pada sesi demo.'){ modalAction=action;modalSuccessMessage=successMessage;$('#modal-title').textContent=title;$('#modal-content').innerHTML=content;$('#modal-confirm').textContent=confirm;$('#modal-confirm').style.display='';$('#modal-confirm').disabled=false;$('#modal-cancel').textContent='Tutup';$('#modal-backdrop').classList.add('open'); }
  function closeModal(){$('#modal-backdrop').classList.remove('open');if(activeVerificationPreviewUrl){URL.revokeObjectURL(activeVerificationPreviewUrl);activeVerificationPreviewUrl=null}}
  const guide=`<div style="display:grid;gap:14px"><div><b style="font-size:11px">01 · Lengkapi profil</b><p class="section-note">Daftar dengan data akademik yang diperlukan. Verifikasi identitas harus dilakukan melalui layanan yang sah pada versi produksi.</p></div><div><b style="font-size:11px">02 · Atur lokasi secara sadar</b><p class="section-note">Pilih lokasi perkiraan dan tentukan apakah ingin tampil di radar. Jangan tampilkan alamat rumah atau koordinat presisi kepada pengguna lain.</p></div><div><b style="font-size:11px">03 · Temukan teman belajar</b><p class="section-note">Gunakan radius dan preferensi mata kuliah untuk melihat rekomendasi yang relevan.</p></div><div><b style="font-size:11px">04 · Bangun koneksi</b><p class="section-note">Kirim permintaan connect. Chat hanya tersedia setelah kedua pihak menyetujui koneksi.</p></div><div><b style="font-size:11px">05 · Belajar bersama</b><p class="section-note">Gunakan forum untuk peer help atau bergabung dan membuat kelompok belajar.</p></div><p class="tiny muted" style="padding:10px;background:#f7f9fc;border-radius:9px">Catatan: halaman ini adalah prototype UI/UX dengan data simulasi. Integrasi akun, lokasi aman, koneksi, dan chat multi-user belum tersedia.</p></div>`;
  $$('[data-open-guide]').forEach(b=>b.addEventListener('click',()=>openModal('Panduan UT Connect',guide)));$('#modal-close').addEventListener('click',closeModal);$('#modal-cancel').addEventListener('click',closeModal);$('#modal-confirm').addEventListener('click',async()=>{if(modalAction){const confirmButton=$('#modal-confirm');confirmButton.disabled=true;try{const result=await modalAction();if(result===false)return;modalAction=null;closeModal();toast(modalSuccessMessage)}catch(error){console.error('Modal action failed:',error);toast(error.message||'Tindakan gagal. Silakan coba lagi.')}finally{confirmButton.disabled=false}return}closeModal();toast('Panduan ditutup.')});$('#modal-backdrop').addEventListener('click',e=>{if(e.target.id==='modal-backdrop')closeModal()});document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});$('#notif-btn').addEventListener('click',()=>toast('Belum ada notifikasi baru.'));$('#edit-profile').addEventListener('click',()=>openModal('Edit profil',`<p class="section-note">Form edit profil ditampilkan sebagai rancangan UI. Penyimpanan dan verifikasi perubahan belum terhubung ke backend.</p><div class="field"><label>Nama tampilan</label><input class="text-input" value="Andi Bintang"></div><div class="field"><label>Program studi</label><input class="text-input" value="Sistem Informasi" disabled></div><div class="field"><label>Preferensi belajar</label><select class="select"><option>Online · Malam hari</option><option>Online · Akhir pekan</option><option>Offline</option></select></div>`,`Tutup`));
  renderNearby();renderMatches();loadForum();renderGroups();loadInformation();loadVerification();initMap();icons();
}
