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
  listForumPosts,
  createForumPost,
  deleteForumPost,
  listForumComments,
  createForumComment,
  deleteForumComment,
  listForumAuthorProfiles,
} from "../services/forum.js";
import {
  getMyMatchingPreferences,
  saveMyMatchingPreferences,
  findMatchingStudents,
  listMyConnectionSummaries,
  sendConnectionRequest,
  respondConnectionRequest,
} from "../services/matching.js";
import {
  listDirectMessages,
  sendDirectMessage,
  markDirectMessagesRead,
  subscribeToDirectMessages,
  unsubscribeFromDirectMessages,
} from "../services/chat.js";
import {
  listStudyGroups,
  listMyGroupMemberships,
  listVisibleGroupMembers,
  createStudyGroup,
  joinStudyGroup,
  respondGroupJoinRequest,
  listGroupMessages,
  sendGroupMessage,
  setGroupMessagePinned,
  subscribeToGroupMessages,
  unsubscribeFromGroupMessages,
  listGroupMaterials,
  uploadGroupMaterial,
  deleteGroupMaterial,
  listGroupAgendaItems,
  createGroupAgendaItem,
  updateGroupAgendaItem,
  deleteGroupAgendaItem,
  getGroupPollResults,
  castGroupPollVote,
  listMyGroupInvitations,
  listGroupInvites,
  inviteGroupMemberByNim,
  cancelGroupInvite,
} from "../services/groups.js";
import {
  listMyNotifications,
  markMyNotificationRead,
  markAllMyNotificationsRead,
  subscribeToMyNotifications,
} from "../services/notifications.js";
import {
  openGroupWorkspace,
  closeGroupWorkspace,
} from "./group-workspace.js";
import {
  getMyLocation,
  saveMyLocation,
  setMyLocationVisibility,
  findNearbyStudents,
} from "../services/home-map.js";
import { listMyChatRooms, updateMyStudentProfile, uploadMyProfileAvatar, setMyProfileAvatarPreset, getProfileAvatarUrl } from "../services/profile.js";
import { UT_PROGRAMS, populateUTFacultyProgramSelects, resolveUTFaculty, resolveUTProgram } from "../data/ut-programs.js";

export function initDashboard({ isAdmin = false, isDemo = false, isVerified = false, verificationStatus = "pending", currentUserId = null, currentUserName = "Mahasiswa UT", currentProfile = {} } = {}) {
  window.L = L;
  const lucide = window.lucide;
const $=(s,root=document)=>root.querySelector(s), $$=(s,root=document)=>[...root.querySelectorAll(s)];
  const state={isDemo,page:'home',radius:3000,groupFilter:'Semua',infoFilter:'all',search:'',map:null,markers:[],circle:null,myMarker:null,center:null,myLocation:null,nearbyStudents:[],homeMapRequestId:0,connected:new Set(),messages:{},chatMessages:[],activeChatConnectionId:null,activeChatChannel:null,notifications:[],notificationChannel:null,infoItems:[],forumPosts:[],forumAuthors:new Map(),profile:{...currentProfile},chatRooms:[],activeChatRoom:null,groups:[],groupMemberships:new Map(),groupMembers:[],groupInvitations:[],activeGroupChannel:null,activeGroupId:null,groupWorkspace:{messages:[],materials:[],agenda:[],invites:[],pollResults:{}},matchCandidates:[],connectionSummaries:[],matchingPreferences:null,preferredPrograms:[],matchRadius:3000};
  const NOTIFICATION_META = {
    connection_request: { icon: "user-plus", page: "matching" },
    connection_accepted: { icon: "user-check", page: "matching" },
    connection_rejected: { icon: "user-x", page: "matching" },
    direct_message: { icon: "message-circle", page: "messages" },
    group_message: { icon: "messages-square", page: "groups" },
    group_material: { icon: "folder-open", page: "groups" },
    group_agenda: { icon: "calendar-check", page: "groups" },
    forum_comment: { icon: "messages-square", page: "forum" },
    group_join_request: { icon: "users-round", page: "groups" },
    group_join_approved: { icon: "check-circle-2", page: "groups" },
    group_join_rejected: { icon: "users-round", page: "groups" },
    group_invite: { icon: "mail-plus", page: "groups" },
    student_verification: { icon: "shield-check", page: "verification" },
    information_post: { icon: "megaphone", page: "info" },
  };

  function notificationDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Waktu tidak tersedia" : date.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
  }

  function renderNotifications() {
    const panel = $("#notification-panel");
    const list = $("#notification-list");
    const badge = $("#notif-count");
    const button = $("#notif-btn");
    const unread = state.notifications.filter(item => !item.read_at).length;
    if (badge) {
      badge.hidden = unread === 0;
      badge.textContent = unread > 99 ? "99+" : String(unread);
    }
    if (button) {
      button.setAttribute("aria-label", unread ? `Notifikasi, ${unread} belum dibaca` : "Notifikasi");
    }
    const summary = $("#notification-summary");
    if (summary) summary.textContent = unread ? `${unread} belum dibaca` : "Semua notifikasi sudah dibaca";
    const markAll = $("#notif-mark-all");
    if (markAll) markAll.disabled = unread === 0;
    if (!panel || !list) return;
    list.innerHTML = state.notifications.length ? state.notifications.map(item => {
      const meta = NOTIFICATION_META[item.notification_type] || { icon: "bell", page: "home" };
      return `
        <button type="button" class="notification-item ${item.read_at ? "" : "unread"}" data-notification-id="${escapeText(item.id)}">
          <span class="notification-icon"><i data-lucide="${escapeText(meta.icon)}"></i></span>
          <span class="notification-content">
            <strong>${escapeText(item.title)}</strong>
            <span>${escapeText(item.body)}</span>
            <small>${escapeText(notificationDate(item.created_at))}</small>
          </span>
          ${item.read_at ? "" : '<span class="notification-unread-dot" aria-label="Belum dibaca"></span>'}
        </button>`;
    }).join("") : '<div class="notification-empty">Belum ada notifikasi. Aktivitas koneksi, pesan, forum, dan grup akan muncul di sini.</div>';
    $$("[data-notification-id]").forEach(itemButton => {
      itemButton.addEventListener("click", () => openNotification(itemButton.dataset.notificationId));
    });
    icons();
  }

  async function loadNotifications() {
    const list = $("#notification-list");
    if (list && state.notifications.length === 0) list.innerHTML = '<div class="notification-empty">Memuat notifikasi...</div>';
    try {
      state.notifications = await listMyNotifications({ limit: 40 });
      renderNotifications();
      return state.notifications;
    } catch (error) {
      console.error("Notification load failed:", error);
      if (list) list.innerHTML = '<div class="notification-empty">Notifikasi belum dapat dimuat. Periksa koneksi lalu coba lagi.</div>';
      throw error;
    }
  }

  async function openNotification(notificationId) {
    const notification = state.notifications.find(item => item.id === notificationId);
    if (!notification) return;
    if (!notification.read_at) {
      try {
        const result = await markMyNotificationRead(notification.id);
        notification.read_at = result?.read_at || new Date().toISOString();
      } catch (error) {
        console.error("Notification read receipt failed:", error);
        toast(error?.message || "Status notifikasi belum dapat diperbarui.");
      }
    }
    const panel = $("#notification-panel");
    panel.hidden = true;
    $("#notif-btn").setAttribute("aria-expanded", "false");
    renderNotifications();

    const route = NOTIFICATION_META[notification.notification_type]?.page || "home";
    try {
      if (route === "matching") {
        await navigate("matching");
      } else if (route === "messages") {
        await navigate("messages");
        if (notification.reference_id) await openDirectChat(notification.reference_id);
      } else if (route === "forum") {
        await navigate("forum");
        if (notification.reference_id) await openForumThread(notification.reference_id);
      } else if (route === "groups") {
        await navigate("groups");
        if (notification.reference_id && notification.notification_type === "group_join_request") {
          await openGroupDetails(notification.reference_id);
        } else if (notification.reference_id && ["group_message", "group_material", "group_agenda"].includes(notification.notification_type)) {
          await openGroupDetails(notification.reference_id);
        }
      } else if (route === "info") {
        await navigate("info");
      } else if (route === "verification") {
        await navigate("verification");
      } else {
        await navigate("home");
      }
    } catch (error) {
      console.error("Notification navigation failed:", error);
      toast(error?.message || "Tujuan notifikasi belum dapat dibuka.");
    }
  }

  async function markAllNotificationsRead() {
    const button = $("#notif-mark-all");
    button.disabled = true;
    try {
      await markAllMyNotificationsRead();
      state.notifications = state.notifications.map(item => ({
        ...item,
        read_at: item.read_at || new Date().toISOString(),
      }));
      renderNotifications();
      toast("Semua notifikasi ditandai sudah dibaca.");
    } catch (error) {
      console.error("Mark all notifications read failed:", error);
      toast(error?.message || "Notifikasi belum dapat diperbarui.");
      button.disabled = false;
    }
  }

  function initNotificationRealtime() {
    if (!currentUserId) return;
    try {
      state.notificationChannel = subscribeToMyNotifications(
        currentUserId,
        () => loadNotifications().catch(() => {}),
        (status, error) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            console.warn("Notification realtime status:", status, error);
          }
        }
      );
    } catch (error) {
      console.warn("Notification realtime is unavailable:", error);
    }
  }

  async function toggleNotificationPanel() {
    const panel = $("#notification-panel");
    const button = $("#notif-btn");
    const opening = panel.hidden;
    panel.hidden = !opening;
    button.setAttribute("aria-expanded", String(opening));
    if (opening) await loadNotifications().catch(() => {});
  }

  $("#notif-btn").addEventListener("click", toggleNotificationPanel);
  $("#notif-mark-all").addEventListener("click", markAllNotificationsRead);
  document.addEventListener("click", event => {
    if (!event.target.closest(".top-actions")) {
      $("#notification-panel").hidden = true;
      $("#notif-btn").setAttribute("aria-expanded", "false");
    }
  });

  function toast(message){const el=$('#toast');el.textContent=message;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),2500)}
  function icons(){if(window.lucide)lucide.createIcons()}
  function navigate(page){
    if(page!=="messages" && state.activeChatChannel){
      const channel=state.activeChatChannel;state.activeChatChannel=null;
      unsubscribeFromDirectMessages(channel).catch(error=>console.warn("Chat channel cleanup failed:",error));
      state.activeChatConnectionId=null;state.activeChatRoom=null;state.chatMessages=[];
    }
    state.page=page;
    $$('.page-section').forEach(s=>s.classList.toggle('active',s.id==='page-'+page));
    $$('[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
    const labels={home:'Beranda',matching:'Matching',messages:'Pesan',forum:'Forum',groups:'Grup Belajar',info:'Informasi UT',profile:'Profil Saya',verification:'Verifikasi Mahasiswa'};
    $('#crumb-current').textContent=labels[page]||'Beranda';
    window.scrollTo({top:0,behavior:'smooth'});
    if(page==='home'&&state.map)setTimeout(()=>state.map.invalidateSize(),80);
    let pageLoad=null;
    if(page==='verification')pageLoad=loadVerification();
    if(page==='forum')pageLoad=loadForum();
    if(page==='groups')pageLoad=loadGroups();
    if(page==='matching')pageLoad=loadMatching();
    if(page==='messages')pageLoad=loadMessages();
    icons();return pageLoad;
  }
  $$('[data-page]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.page)));$$('[data-go]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.go)));
  function setMapStatus(message, status = "idle") {
    const statusText = $("#map-location-status");
    const statusPill = $("#map-status-pill");
    if (statusText) {
      statusText.textContent = message;
      statusText.dataset.state = status;
    }
    if (statusPill) {
      statusPill.textContent = status === "success" ? "Lokasi tersambung" : status === "error" ? "Perlu perhatian" : status === "loading" ? "Memuat lokasi" : "Peta sekitar";
    }
  }

  function mapCoordinates(location) {
    const lat = Number(location?.latitude);
    const lng = Number(location?.longitude);
    return Number.isFinite(lat) && lat >= -90 && lat <= 90
      && Number.isFinite(lng) && lng >= -180 && lng <= 180
      ? [lat, lng]
      : null;
  }

  function renderNearby() {
    const list = $("#nearby-list");
    const count = $("#nearby-list-count");
    if (!list) return;
    const items = state.nearbyStudents || [];
    if (count) count.textContent = items.length ? `${items.length} mahasiswa ditemukan` : "Hasil pencarian area";
    if (!state.myLocation) {
      list.innerHTML = '<div class="map-nearby-empty">Tentukan lokasi belajar untuk mulai mencari mahasiswa terdekat.</div>';
      return;
    }
    if (!isVerified) {
      list.innerHTML = '<div class="map-nearby-empty">Peta sekitar tersedia setelah status mahasiswa kamu terverifikasi.</div>';
      return;
    }
    if (!items.length) {
      const message = state.search.length === 9
        ? "NIM tidak ditemukan dalam radius aktif."
        : "Belum ada mahasiswa terverifikasi yang memilih tampil di radar pada radius ini.";
      list.innerHTML = `<div class="map-nearby-empty">${escapeText(message)}</div>`;
      return;
    }
    list.innerHTML = items.slice(0, 5).map(student => {
      const distance = Number(student.approx_distance_m);
      const distanceLabel = Number.isFinite(distance) ? `~${(distance / 1000).toFixed(1)} km` : "Jarak perkiraan";
      return `
        <div class="map-nearby-row">
          <div class="person-avatar">${escapeText(student.initials || "UT")}</div>
          <div class="person-meta"><strong>${student.is_demo ? "Akun simulasi" : "Mahasiswa"} ${escapeText(student.initials || "UT")} ${student.is_demo ? '<span class="demo-user-tag">DEMO</span>' : ""}</strong><span>${escapeText(student.program || "Program studi tidak tersedia")}</span></div>
          <span class="distance">${distanceLabel}</span>
        </div>`;
    }).join("");
  }

  function initMap() {
    if (!window.L || state.map) return;
    const fallbackCenter = [-2.5, 118];
    const map = L.map("map", { zoomControl: true, scrollWheelZoom: false }).setView(fallbackCenter, 4);
    state.map = map;
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);
    map.on("click", event => {
      const consent = $("#map-location-consent");
      if (!state.myLocation?.consented_at && !consent?.checked) {
        toast("Setujui penggunaan lokasi sebelum memilih titik pada peta.");
        return;
      }
      openModal(
        "Simpan titik lokasi belajar?",
        "<p class='section-note'>Titik yang dipilih akan disimpan sebagai lokasi presisi milik akunmu. Mahasiswa lain hanya dapat melihat pin perkiraan jika kamu mengaktifkan radar.</p>",
        "Simpan titik",
        async () => saveSelectedMapPoint(event.latlng.lat, event.latlng.lng),
        "Titik lokasi berhasil disimpan.",
      );
    });
  }

  function renderMapMarkers() {
    if (!state.map) return;
    state.markers.forEach(marker => state.map.removeLayer(marker));
    state.markers = [];
    if (state.myMarker) {
      state.map.removeLayer(state.myMarker);
      state.myMarker = null;
    }
    if (state.circle) {
      state.map.removeLayer(state.circle);
      state.circle = null;
    }

    const ownCoordinates = mapCoordinates(state.myLocation);
    if (ownCoordinates) {
      state.center = ownCoordinates;
      state.circle = L.circle(ownCoordinates, {
        radius: state.radius,
        color: "#0a4a86",
        weight: 1.5,
        fillColor: "#8cb7de",
        fillOpacity: 0.08,
        dashArray: "5 6",
      }).addTo(state.map);
      state.myMarker = L.marker(ownCoordinates, {
        icon: L.divIcon({
          className: "",
          html: '<div class="map-marker me">Saya</div>',
          iconSize: [38, 38],
          iconAnchor: [19, 19],
        }),
      }).addTo(state.map).bindPopup("<b>Lokasi belajarmu</b><br><small>Pin ini hanya terlihat oleh akunmu.</small>");
    }

    (state.nearbyStudents || []).forEach(student => {
      const lat = Number(student.marker_lat);
      const lng = Number(student.marker_lng);
      if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) return;
      const initialsLabel = escapeText(student.initials || "UT");
      const programLabel = escapeText(student.program || "Program studi tidak tersedia");
      const distance = Number(student.approx_distance_m);
      const distanceLabel = Number.isFinite(distance) ? `sekitar ${(distance / 1000).toFixed(1)} km` : "jarak perkiraan";
      const marker = L.marker([lat, lng], {
        icon: L.divIcon({
          className: "",
          html: `<div class="map-marker ${student.is_demo ? "demo" : ""}">${student.is_demo ? "D·" : ""}${initialsLabel}</div>`,
          iconSize: [31, 31],
          iconAnchor: [15, 15],
        }),
      }).addTo(state.map).bindPopup(`<b>${student.is_demo ? "Akun simulasi DEMO" : `Mahasiswa ${initialsLabel}`}</b><br><small>${programLabel} · ${distanceLabel}</small>`);
      state.markers.push(marker);
    });

    if (state.circle) state.circle.setRadius(state.radius);
    const result = $("#map-result");
    if (result) {
      if (!ownCoordinates) {
        result.textContent = "Pilih atau perbarui lokasi belajar untuk memulai pencarian.";
      } else if (!isVerified) {
        result.textContent = "Pencarian mahasiswa sekitar akan tersedia setelah verifikasi mahasiswa.";
      } else {
        result.textContent = `${state.nearbyStudents.length} mahasiswa terverifikasi dalam radius ${state.radius / 1000} km · pin perkiraan.`;
      }
    }
    renderNearby();
  }

  async function refreshNearbyStudents() {
    if (!state.myLocation || !mapCoordinates(state.myLocation) || !isVerified) {
      state.nearbyStudents = [];
      renderMapMarkers();
      return;
    }
    const requestId = ++state.homeMapRequestId;
    const result = $("#map-result");
    if (result) result.textContent = state.search.length === 9 ? "Mencari NIM dalam radius aktif..." : "Memuat mahasiswa terdekat...";
    try {
      const students = await findNearbyStudents(state.radius, state.search);
      if (requestId !== state.homeMapRequestId) return;
      state.nearbyStudents = students;
      renderMapMarkers();
      if (state.search.length === 9 && !students.length) {
        if (result) result.textContent = "NIM tidak ditemukan dalam radius aktif.";
      }
    } catch (error) {
      if (requestId !== state.homeMapRequestId) return;
      state.nearbyStudents = [];
      renderMapMarkers();
      console.error("Nearby students load failed:", error);
      if (result) result.textContent = error?.message || "Mahasiswa sekitar belum dapat dimuat.";
      setMapStatus(error?.message || "Pencarian mahasiswa belum tersedia.", "error");
    }
  }

  async function loadHomeMap() {
    setMapStatus("Memeriksa lokasi akun...", "loading");
    try {
      state.myLocation = await getMyLocation();
      const ownCoordinates = mapCoordinates(state.myLocation);
      const consent = $("#map-location-consent");
      const radarToggle = $("#map-radar-toggle");
      if (consent) {
        const hasSavedConsent = Boolean(state.myLocation?.consented_at);
        consent.checked = hasSavedConsent;
        consent.disabled = hasSavedConsent;
        consent.closest("label")?.toggleAttribute("hidden", hasSavedConsent);
      }
      if (radarToggle) {
        radarToggle.checked = state.myLocation?.show_in_radar === true;
        radarToggle.disabled = !ownCoordinates;
      }
      if (ownCoordinates) {
        state.center = ownCoordinates;
        state.map?.setView(ownCoordinates, 14);
        setMapStatus(
          state.myLocation.show_in_radar
            ? "Lokasi tersimpan. Pin perkiraanmu sedang ditampilkan kepada mahasiswa terverifikasi."
            : "Lokasi tersimpan dan disembunyikan dari radar. Kamu tetap dapat mencari mahasiswa sekitar.",
          "success",
        );
      } else {
        state.center = null;
        setMapStatus("Belum ada titik lokasi. Gunakan GPS atau klik peta setelah memberi persetujuan.", "idle");
        state.map?.setView([-2.5, 118], 4);
      }
      renderMapMarkers();
      await refreshNearbyStudents();
    } catch (error) {
      state.myLocation = null;
      console.error("Home Map location load failed:", error);
      setMapStatus(error?.message || "Lokasi akun belum dapat dimuat.", "error");
      renderMapMarkers();
    }
  }

  async function saveSelectedMapPoint(lat, lng) {
    const existingConsent = Boolean(state.myLocation?.consented_at);
    const consent = $("#map-location-consent");
    if (!existingConsent && !consent?.checked) {
      toast("Centang persetujuan penggunaan lokasi sebelum menyimpan titik.");
      return;
    }
    try {
      const showInRadar = state.myLocation?.show_in_radar === true;
      await saveMyLocation({ lat, lng, consent: true, showInRadar });
      state.myLocation = await getMyLocation();
      if (consent) {
        consent.checked = true;
        consent.disabled = true;
        consent.closest("label")?.toggleAttribute("hidden", true);
      }
      const radarToggle = $("#map-radar-toggle");
      if (radarToggle) {
        radarToggle.checked = state.myLocation?.show_in_radar === true;
        radarToggle.disabled = false;
      }
      state.center = [lat, lng];
      state.map?.setView(state.center, 14);
      setMapStatus("Titik lokasi berhasil disimpan. Kamu dapat mengatur visibilitas radar.", "success");
      await refreshNearbyStudents();
    } catch (error) {
      console.error("Home Map point save failed:", error);
      setMapStatus(error?.message || "Titik lokasi belum berhasil disimpan.", "error");
      throw error;
    }
  }

  async function locateHomeMap() {
    if (!navigator.geolocation) {
      toast("Browser ini tidak mendukung akses lokasi. Klik peta untuk menentukan titik secara manual.");
      return;
    }
    if (!state.myLocation?.consented_at && !$("#map-location-consent")?.checked) {
      toast("Beri persetujuan penggunaan lokasi sebelum mengambil titik GPS.");
      return;
    }
    const button = $("#locate-btn");
    if (button) {
      button.disabled = true;
      button.textContent = "Mengambil lokasi...";
    }
    setMapStatus("Meminta lokasi perangkat...", "loading");
    navigator.geolocation.getCurrentPosition(async position => {
      try {
        const showInRadar = state.myLocation?.show_in_radar === true;
        await saveMyLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          consent: true,
          showInRadar,
        });
        state.myLocation = await getMyLocation();
        const consent = $("#map-location-consent");
        if (consent) {
          consent.checked = true;
          consent.disabled = true;
          consent.closest("label")?.toggleAttribute("hidden", true);
        }
        const radarToggle = $("#map-radar-toggle");
        if (radarToggle) {
          radarToggle.checked = state.myLocation?.show_in_radar === true;
          radarToggle.disabled = false;
        }
        const coordinates = mapCoordinates(state.myLocation);
        if (coordinates) {
          state.center = coordinates;
          state.map?.setView(coordinates, 14);
        }
        setMapStatus("Lokasi perangkat berhasil diperbarui dan disimpan.", "success");
        await refreshNearbyStudents();
      } catch (error) {
        console.error("Home Map GPS save failed:", error);
        setMapStatus(error?.message || "Lokasi GPS belum berhasil disimpan.", "error");
        toast(error?.message || "Lokasi GPS belum berhasil disimpan.");
      } finally {
        if (button) {
          button.disabled = false;
          button.innerHTML = '<i data-lucide="locate-fixed"></i>Perbarui lokasi';
          icons();
        }
      }
    }, error => {
      const messages = {
        1: "Izin lokasi ditolak. Kamu dapat memilih titik secara manual pada peta.",
        2: "Lokasi perangkat belum tersedia. Coba lagi atau pilih titik pada peta.",
        3: "Permintaan lokasi terlalu lama. Coba kembali.",
      };
      const message = messages[error.code] || "Lokasi perangkat belum dapat diakses.";
      setMapStatus(message, "error");
      toast(message);
      if (button) {
        button.disabled = false;
        button.innerHTML = '<i data-lucide="locate-fixed"></i>Perbarui lokasi';
        icons();
      }
    }, { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 });
  }

  async function updateHomeMapVisibility() {
    const toggle = $("#map-radar-toggle");
    if (!toggle || !state.myLocation) return;
    const showInRadar = toggle.checked;
    toggle.disabled = true;
    try {
      await setMyLocationVisibility(showInRadar, { consent: showInRadar });
      state.myLocation.show_in_radar = showInRadar;
      setMapStatus(
        showInRadar
          ? "Pin perkiraanmu aktif untuk mahasiswa terverifikasi."
          : "Pin kamu disembunyikan dari radar. Kamu tetap dapat mencari mahasiswa sekitar.",
        "success",
      );
    } catch (error) {
      toggle.checked = !showInRadar;
      setMapStatus(error?.message || "Pengaturan visibilitas belum berhasil disimpan.", "error");
      toast(error?.message || "Pengaturan visibilitas belum berhasil disimpan.");
    } finally {
      toggle.disabled = false;
    }
  }

  function bindHomeMapControls() {
    $$("[data-radius]").forEach(button => button.addEventListener("click", async () => {
      state.radius = Number(button.dataset.radius);
      $$("[data-radius]").forEach(item => item.classList.toggle("active", item === button));
      if (state.circle) state.circle.setRadius(state.radius);
      await refreshNearbyStudents();
    }));

    $("#nim-search").addEventListener("input", event => {
      state.search = event.target.value.replace(/\D/g, "").slice(0, 9);
      $("#clear-search").style.display = state.search ? "inline-flex" : "none";
      if (!state.search || state.search.length === 9) refreshNearbyStudents();
      else {
        state.nearbyStudents = [];
        renderMapMarkers();
        const result = $("#map-result");
        if (result) result.textContent = "Masukkan 9 digit NIM untuk melakukan pencarian.";
      }
    });

    $("#clear-search").addEventListener("click", () => {
      $("#nim-search").value = "";
      state.search = "";
      $("#clear-search").style.display = "none";
      refreshNearbyStudents();
    });
    $("#locate-btn").addEventListener("click", locateHomeMap);
    $("#map-radar-toggle").addEventListener("change", updateHomeMapVisibility);
  }

  bindHomeMapControls();
    function renderMatchingAccess() {
    const notice = $("#match-access-notice");
    const layout = $("#match-layout");
    if (!notice || !layout) return;
    if (!isVerified) {
      notice.hidden = false;
      notice.innerHTML = `
        <div class="group-access-content">
          <div class="group-access-icon"><i data-lucide="shield-check"></i></div>
          <div><strong>Verifikasi mahasiswa diperlukan</strong><p>Matching dan permintaan koneksi hanya tersedia untuk akun mahasiswa UT yang sudah terverifikasi.</p><button type="button" class="link-btn" id="matching-verification-link">Buka halaman verifikasi</button></div>
        </div>`;
      layout.hidden = true;
      $("#matching-verification-link")?.addEventListener("click", () => navigate("verification"));
    } else {
      notice.hidden = true;
      notice.innerHTML = "";
      layout.hidden = false;
    }
    icons();
  }

  function populateMatchingPrograms() {
    const programFilter = $("#filter-program");
    const preferredPrograms = $("#preferred-programs");
    const filterValue = programFilter?.value || "";
    const options = UT_PROGRAMS.map(program =>
      `<option value="${escapeText(program)}">${escapeText(program)}</option>`
    ).join("");
    if (programFilter) {
      programFilter.innerHTML = '<option value="">Semua program studi</option>' + options;
      programFilter.value = filterValue;
    }
    if (preferredPrograms) {
      preferredPrograms.innerHTML = options;
      [...preferredPrograms.options].forEach(option => {
        option.selected = state.preferredPrograms.includes(option.value);
      });
    }
  }

  function splitPreferenceTags(value, label) {
    const items = [...new Set(String(value || "").split(",").map(item => item.trim()).filter(Boolean))];
    if (items.length > 12) throw new Error(`${label} maksimal 12 item.`);
    if (items.some(item => item.length > 60)) throw new Error(`Setiap ${label.toLowerCase()} maksimal 60 karakter.`);
    return items;
  }

  function renderMatchingPreferences() {
    const preferences = state.matchingPreferences || {};
    $("#preference-topics").value = (preferences.topic_tags || []).join(", ");
    $("#preference-interests").value = (preferences.interests || []).join(", ");
    const preferredTimes = new Set(preferences.study_times || []);
    [...$("#preference-study-times").options].forEach(option => {
      option.selected = preferredTimes.has(option.value);
    });
    [...$("#preferred-programs").options].forEach(option => {
      option.selected = state.preferredPrograms.includes(option.value);
    });
  }

  function matchingDistance(meters) {
    const distance = Number(meters);
    if (!Number.isFinite(distance)) return "Jarak perkiraan";
    if (distance < 1000) return `sekitar ${Math.max(100, Math.round(distance / 100) * 100)} m`;
    const km = Math.round(distance / 500) / 2;
    return `sekitar ${km.toLocaleString("id-ID", { maximumFractionDigits: 1 })} km`;
  }

  function getConnectionFor(studentId) {
    return state.connectionSummaries.find(item => item.other_student_id === studentId) || null;
  }

  function renderConnectionPanel() {
    const panel = $("#connection-panel");
    const list = $("#connection-list");
    if (!panel || !list) return;
    const rows = state.connectionSummaries;
    panel.hidden = rows.length === 0;
    $("#connection-count").textContent = String(rows.length);
    if (!rows.length) {
      list.innerHTML = "";
      return;
    }
    list.innerHTML = rows.map(connection => {
      const identity = connection.is_demo ? `Akun simulasi · ${escapeText(connection.initials || "DEMO")}` : `Mahasiswa UT · ${escapeText(connection.initials || "UT")}`;
      const incoming = connection.is_incoming && connection.status === "pending";
      const labels = {
        pending: connection.is_incoming ? "Permintaan masuk" : "Menunggu jawaban",
        accepted: "Terhubung",
        rejected: "Permintaan ditolak",
        blocked: "Tidak tersedia",
      };
      const actions = incoming
        ? `<div class="connection-actions"><button type="button" class="btn btn-primary btn-sm" data-connection-accept="${escapeText(connection.connection_id)}">Terima</button><button type="button" class="btn btn-secondary btn-sm" data-connection-reject="${escapeText(connection.connection_id)}">Tolak</button></div>`
        : connection.status === "accepted"
          ? `<div class="connection-actions"><button type="button" class="btn btn-primary btn-sm" data-chat-open="${escapeText(connection.connection_id)}"><i data-lucide="message-circle"></i>Chat</button></div>`
          : `<span class="connection-state">${escapeText(labels[connection.status] || "Status koneksi")}</span>`;
      return `
        <article class="connection-row">
          <div class="person-avatar">${escapeText(connection.initials || "UT")}</div>
          <div class="connection-person"><strong>${identity}${connection.is_demo ? '<span class="demo-user-tag">DEMO</span>' : ""}</strong><span>${escapeText(connection.program || "Program studi tidak tersedia")}</span><small>${escapeText(forumDate(connection.created_at))}</small></div>
          ${actions}
        </article>`;
    }).join("");
    $$("[data-connection-accept]").forEach(button => button.addEventListener("click", () => confirmConnectionResponse(button.dataset.connectionAccept, true)));
    $$("[data-connection-reject]").forEach(button => button.addEventListener("click", () => confirmConnectionResponse(button.dataset.connectionReject, false)));
    $$("[data-chat-open]").forEach(button => button.addEventListener("click", () => openDirectChat(button.dataset.chatOpen)));
  }

  function renderMatches() {
    const preferredPrograms = state.preferredPrograms || [];
    const selectedProgram = $("#filter-program").value;
    const topic = $("#filter-topic").value.trim().toLowerCase();
    const time = $("#filter-time").value;
    const filtered = state.matchCandidates.filter(student => {
      const program = student.program || "";
      const topics = student.topic_tags || [];
      const interests = student.interests || [];
      const times = student.study_times || [];
      const searchable = [program, ...topics, ...interests].join(" ").toLowerCase();
      return (!preferredPrograms.length || preferredPrograms.includes(program))
        && (!selectedProgram || program === selectedProgram)
        && (!topic || searchable.includes(topic))
        && (!time || times.includes(time));
    });

    $("#match-count").textContent = `${filtered.length} mahasiswa dalam radius ${Number(state.matchRadius) / 1000} km · data Supabase`;
    $("#match-results").innerHTML = filtered.length ? filtered.map(student => {
      const connection = getConnectionFor(student.student_id);
      const tags = [student.program, ...(student.topic_tags || []), ...(student.interests || [])].filter(Boolean);
      let action = `<button type="button" class="btn btn-primary btn-sm" data-connect="${escapeText(student.student_id)}">Connect</button>`;
      let label = "Belum terhubung";
      if (connection?.status === "accepted") {
        action = `<button type="button" class="btn btn-secondary btn-sm" data-chat-open="${escapeText(connection.connection_id)}"><i data-lucide="message-circle"></i>Chat</button>`;
        label = "Koneksi aktif";
      } else if (connection?.status === "pending") {
        action = '<span class="connection-state">Menunggu jawaban</span>';
        label = connection.is_incoming ? "Permintaan masuk" : "Permintaan terkirim";
      } else if (connection?.status === "rejected") {
        action = '<span class="connection-state">Permintaan ditolak</span>';
        label = "Permintaan sebelumnya ditolak";
      }
      return `
        <article class="surface match-card">
          <div class="match-top">
            <div class="person-avatar">${escapeText(student.initials || "UT")}</div>
            <div class="person-meta"><strong>${student.is_demo ? "Akun simulasi · " : "Mahasiswa UT · "}${escapeText(student.initials || "UT")} ${student.is_demo ? '<span class="demo-user-tag">DEMO</span>' : ""}</strong><span>${escapeText(student.program || "Program studi tidak tersedia")} · ${escapeText(matchingDistance(student.approx_distance_m))}</span></div>
            <span class="match-score">${student.is_demo ? "DEMO" : "Relevan"}</span>
          </div>
          <div class="match-tags">${tags.length ? tags.map(tag => `<span class="tag">${escapeText(tag)}</span>`).join("") : '<span class="tiny muted">Belum mengisi program studi atau topik.</span>'}</div>
          <div class="match-card-foot"><span class="tiny muted">${escapeText((student.study_times || []).join(", ") || label)}</span>${action}</div>
        </article>`;
    }).join("") : '<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon"><i data-lucide="users"></i></div><h3>Belum ada rekomendasi yang sesuai</h3><p>Belum ada mahasiswa terverifikasi yang memenuhi radius, persetujuan radar, dan filter yang dipilih. Coba ubah radius atau preferensi.</p></div>';

    $$("#match-results [data-connect]").forEach(button => button.addEventListener("click", () => createConnection(button.dataset.connect, button)));
    icons();
  }

  async function loadConnectionSummaries() {
    try {
      state.connectionSummaries = await listMyConnectionSummaries();
      renderConnectionPanel();
      renderMatches();
    } catch (error) {
      console.error("Connection summary load failed:", error);
      $("#connection-panel").hidden = true;
    }
  }

  async function searchMatchingStudents({ showLoading = true } = {}) {
    if (!isVerified) return;
    state.matchRadius = Number($("#match-radius").value || 3000);
    if (showLoading) $("#match-results").innerHTML = '<div class="verification-loading">Mencari mahasiswa terverifikasi di area sekitar...</div>';
    try {
      state.matchCandidates = await findMatchingStudents(state.matchRadius);
      renderMatches();
    } catch (error) {
      console.error("Matching search failed:", error);
      $("#match-results").innerHTML = `<div class="empty-state"><div class="empty-icon"><i data-lucide="alert-circle"></i></div><h3>Matching belum dapat dimuat</h3><p>${escapeText(error?.message || "Periksa koneksi lalu coba kembali.")}</p><button type="button" class="btn btn-secondary btn-sm" id="matching-retry">Coba lagi</button></div>`;
      $("#matching-retry")?.addEventListener("click", () => searchMatchingStudents());
      icons();
    }
  }

  async function loadMatching({ showLoading = true } = {}) {
    renderMatchingAccess();
    if (!isVerified) {
      state.matchCandidates = [];
      state.connectionSummaries = [];
      $("#match-results").innerHTML = "";
      $("#connection-panel").hidden = true;
      return;
    }
    if (showLoading) $("#match-results").innerHTML = '<div class="verification-loading">Memuat preferensi dan koneksi...</div>';
    try {
      const [preferences, connections] = await Promise.all([
        getMyMatchingPreferences(currentUserId),
        listMyConnectionSummaries(),
      ]);
      state.matchingPreferences = preferences || {};
      state.preferredPrograms = Array.isArray(preferences?.preferred_programs) ? preferences.preferred_programs : [];
      state.connectionSummaries = connections;
      populateMatchingPrograms();
      renderMatchingPreferences();
      renderConnectionPanel();
      await searchMatchingStudents({ showLoading: false });
    } catch (error) {
      console.error("Matching load failed:", error);
      $("#match-results").innerHTML = `<div class="empty-state"><div class="empty-icon"><i data-lucide="alert-circle"></i></div><h3>Matching belum dapat dimuat</h3><p>${escapeText(error?.message || "Periksa koneksi lalu coba kembali.")}</p><button type="button" class="btn btn-secondary btn-sm" id="matching-load-retry">Coba lagi</button></div>`;
      $("#matching-load-retry")?.addEventListener("click", () => loadMatching());
      icons();
    }
  }

  async function saveMatchingPreferences() {
    if (!isVerified) { toast("Verifikasi mahasiswa diperlukan untuk menyimpan preferensi."); return; }
    const button = $("#save-matching-preferences");
    button.disabled = true;
    button.textContent = "Menyimpan...";
    try {
      const topicTags = splitPreferenceTags($("#preference-topics").value, "Topik");
      const interests = splitPreferenceTags($("#preference-interests").value, "Minat");
      const studyTimes = [...$("#preference-study-times").selectedOptions].map(option => option.value);
      const preferredPrograms = [...$("#preferred-programs").selectedOptions].map(option => option.value);
      await saveMyMatchingPreferences({ topicTags, interests, studyTimes, preferredPrograms });
      state.matchingPreferences = { topic_tags: topicTags, interests, study_times: studyTimes, preferred_programs: preferredPrograms };
      state.preferredPrograms = preferredPrograms;
      renderMatchingPreferences();
      toast("Preferensi belajar berhasil disimpan.");
      await searchMatchingStudents({ showLoading: false });
    } catch (error) {
      console.error("Matching preference save failed:", error);
      toast(error?.message || "Preferensi belum berhasil disimpan.");
    } finally {
      button.disabled = false;
      button.innerHTML = '<i data-lucide="save"></i>Simpan preferensi';
      icons();
    }
  }

  async function createConnection(studentId, button) {
    if (!isVerified) { toast("Verifikasi mahasiswa diperlukan untuk mengirim koneksi."); return; }
    if (button) { button.disabled = true; button.textContent = "Mengirim..."; }
    try {
      await sendConnectionRequest(studentId);
      await loadConnectionSummaries();
      toast("Permintaan koneksi berhasil dikirim.");
    } catch (error) {
      console.error("Connection request failed:", error);
      toast(error?.message || "Permintaan koneksi gagal. Periksa apakah pengguna masih tersedia.");
      if (button) { button.disabled = false; button.textContent = "Coba lagi"; }
    }
  }

  function confirmConnectionResponse(connectionId, accept) {
    const label = accept ? "Terima" : "Tolak";
    openModal(
      `${label} permintaan koneksi?`,
      `<p class="section-note">${accept ? "Mahasiswa tersebut akan masuk ke daftar koneksi kamu." : "Permintaan koneksi ini akan ditolak."} Keputusan hanya dapat dilakukan oleh penerima permintaan.</p>`,
      label,
      async () => {
        await respondConnectionRequest(connectionId, accept);
        await loadConnectionSummaries();
        return true;
      },
      accept ? "Permintaan koneksi diterima." : "Permintaan koneksi ditolak."
    );
  }

  $("#save-matching-preferences").addEventListener("click", saveMatchingPreferences);
  $("#apply-match").addEventListener("click", () => searchMatchingStudents());
  $("#match-radius").addEventListener("change", () => searchMatchingStudents());
  $("#refresh-matches").addEventListener("click", () => loadMatching({ showLoading: false }));
  $("#filter-topic").addEventListener("input", renderMatches);
  $("#filter-program").addEventListener("change", renderMatches);
  $("#filter-time").addEventListener("change", renderMatches);
  $("#reset-match").addEventListener("click", () => {
    $("#filter-program").value = "";
    $("#filter-topic").value = "";
    $("#filter-time").value = "";
    renderMatches();
  });

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
  function populateForumPrograms() {
    const select = $("#post-program");
    if (!select) return;
    select.innerHTML = '<option value="">Diskusi umum</option>' + UT_PROGRAMS.map(program =>
      `<option value="${escapeText(program)}">${escapeText(program)}</option>`
    ).join("");
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
      const author = ownPost ? currentUserName : (state.forumAuthors.get(post.author_id)?.full_name || "Mahasiswa UT");
      const typeLabel = FORUM_POST_TYPES[post.post_type] || "Diskusi";
      const courseLabel = post.program || post.course?.course_name || "Diskusi umum";
      const deleteButton = ownPost
        ? `<button type="button" class="btn btn-quiet btn-sm forum-delete" data-forum-delete="${escapeText(post.id)}"><i data-lucide="trash-2"></i>Hapus</button>`
        : "";
      return `
        <article class="surface post-card forum-post-card">
          <div class="forum-post-meta"><span class="tag">${escapeText(typeLabel)}</span><span class="tag">${escapeText(courseLabel)}</span></div>
          <div class="post-author"><div class="person-avatar">${escapeText(ownPost ? currentUserName.split(/\s+/).slice(0,2).map(x=>x[0]||"").join("").toUpperCase() : "UT")}</div><div class="person-meta"><strong>${escapeText(author)}</strong><span>${escapeText(forumDate(post.created_at))}</span></div></div>
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
      const posts = await listForumPosts();
      state.forumPosts = posts;
      const authorProfiles = await listForumAuthorProfiles(posts.map(post => post.author_id));
      state.forumAuthors = new Map(authorProfiles.map(profile => [profile.user_id, profile]));
      populateForumPrograms();
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
    const program = $("#post-program").value || null;
    if (title.length < 3 || title.length > 140) { toast("Judul diskusi harus 3–140 karakter."); return; }
    if (!body || body.length > 5000) { toast("Isi diskusi wajib diisi dan maksimal 5.000 karakter."); return; }
    if (!Object.hasOwn(FORUM_POST_TYPES, postType)) { toast("Jenis diskusi tidak valid."); return; }
    const button = $("#publish-post");
    button.disabled = true;
    button.textContent = "Mempublikasikan...";
    try {
      await createForumPost({ title, body, postType, program });
      $("#post-title").value = "";
      $("#post-content").value = "";
      $("#post-type").value = "need_help";
      $("#post-program").value = "";
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
      const commentProfiles = await listForumAuthorProfiles([post.author_id, ...comments.map(comment => comment.author_id)]);
      commentProfiles.forEach(profile => state.forumAuthors.set(profile.user_id, profile));
      const commentsHtml = comments.length ? comments.map(comment => {
        const ownComment = comment.author_id === currentUserId;
        const author = ownComment ? currentUserName : (state.forumAuthors.get(comment.author_id)?.full_name || "Mahasiswa UT");
        const remove = ownComment
          ? `<button type="button" class="link-btn forum-comment-delete" data-forum-comment-delete="${escapeText(comment.id)}">Hapus</button>`
          : "";
        return `<div class="forum-comment"><div class="forum-comment-head"><strong>${escapeText(author)}</strong><span>${escapeText(forumDate(comment.created_at))}</span></div><p>${escapeText(comment.body)}</p>${remove}</div>`;
      }).join("") : '<div class="forum-thread-empty">Belum ada tanggapan. Mulai percakapan dengan komentar yang relevan dan santun.</div>';
      openModal("Diskusi dan tanggapan", `
        <div class="forum-thread">
          <span class="tag">${escapeText(FORUM_POST_TYPES[post.post_type] || "Diskusi")}</span>
          <h3>${escapeText(post.title)}</h3>
          <p class="tiny muted">Oleh ${escapeText(post.author_id === currentUserId ? currentUserName : (state.forumAuthors.get(post.author_id)?.full_name || "Mahasiswa UT"))}</p>
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
  function renderGroupAccess() {
    const notice = $("#group-access-notice");
    const toolbar = $("#group-toolbar");
    const list = $("#group-list");
    const createButton = $("#create-group");
    if (!notice || !toolbar || !list || !createButton) return;

    if (!isVerified) {
      notice.hidden = false;
      notice.innerHTML = `
        <div class="group-access-content">
          <div class="group-access-icon"><i data-lucide="shield-check"></i></div>
          <div><strong>Verifikasi mahasiswa diperlukan</strong><p>Daftar dan aktivitas grup belajar hanya tersedia untuk akun mahasiswa UT yang sudah terverifikasi.</p><button type="button" class="link-btn" id="group-verification-link">Buka halaman verifikasi</button></div>
        </div>`;
      toolbar.hidden = true;
      list.hidden = true;
      createButton.hidden = true;
      $("#group-verification-link")?.addEventListener("click", () => navigate("verification"));
      icons();
      return;
    }

    notice.hidden = true;
    notice.innerHTML = "";
    toolbar.hidden = false;
    list.hidden = false;
    createButton.hidden = false;
  }

  function renderGroups() {
    const search = $("#group-search")?.value.trim().toLowerCase() || "";
    const filtered = state.groups.filter(group => {
      const courseName = group.program || group.course?.course_name || "Kelompok umum";
      const matchesMode = state.groupFilter === "Semua" || group.mode === state.groupFilter.toLowerCase();
      const matchesSearch = !search || `${group.name} ${courseName}`.toLowerCase().includes(search);
      return matchesMode && matchesSearch;
    });

    const invitationHtml = state.groupInvitations.map(invite =>
      '<article class="surface group-invitation-row"><div><strong>' + escapeText(invite.group_name) + '</strong><p>' + escapeText(invite.group_description || "Undangan kelompok belajar privat.") + '</p><small>Dikirim ' + escapeText(groupDate(invite.invited_at)) + '</small></div>' +
      '<div class="group-request-actions"><button class="btn btn-primary btn-sm" data-group-invite-accept="' + escapeText(invite.group_id) + '">Terima</button><button class="btn btn-secondary btn-sm" data-group-invite-decline="' + escapeText(invite.invite_id) + '">Tolak</button></div></article>'
    ).join("");
    $("#group-list").innerHTML = invitationHtml + (filtered.map(group => {
      const courseName = group.program || group.course?.course_name || "Kelompok umum";
      const demoBadge = group.is_demo ? '<span class="demo-user-tag">DEMO · SIMULASI</span>' : "";
      const membership = state.groupMemberships.get(group.id);
      const isActiveMember = membership?.status === "active";
      const isPending = membership?.status === "pending";
      const isManager = isActiveMember && ["admin", "co_admin"].includes(membership.role);
      const activeCount = isActiveMember
        ? state.groupMembers.filter(member => member.group_id === group.id && member.status === "active").length
        : null;
      const pendingCount = isManager
        ? state.groupMembers.filter(member => member.group_id === group.id && member.status === "pending").length
        : 0;
      const accessLabels = { open: "Terbuka", approval: "Perlu persetujuan", private: "Undangan pribadi" };
      const accessLabel = accessLabels[group.access_type] || "Akses terbatas";
      const capacityText = activeCount === null
        ? `Maksimal ${group.capacity} anggota`
        : `${activeCount} anggota aktif dari ${group.capacity}`;
      const progress = activeCount === null ? "" : `<div class="capacity"><span style="width:${Math.min(100, activeCount / group.capacity * 100)}%"></span></div>`;
      const schedule = group.schedule_text ? escapeText(group.schedule_text) : "Jadwal belum ditentukan";
      const place = group.mode === "online"
        ? (group.online_url ? `<a href="${escapeText(group.online_url)}" target="_blank" rel="noopener noreferrer">Buka tautan pertemuan</a>` : "Pertemuan online")
        : (group.offline_area_label ? escapeText(group.offline_area_label) : "Lokasi belum ditentukan");
      const status = isActiveMember
        ? (isManager ? "Admin grup" : "Anggota")
        : isPending
          ? "Menunggu persetujuan"
          : group.access_type === "approval"
            ? "Gabung setelah disetujui admin"
            : group.access_type === "private"
              ? "Undangan diperlukan"
              : "Pendaftaran terbuka";
      const action = isActiveMember
        ? `<button type="button" class="btn btn-secondary btn-sm" data-group-open="${escapeText(group.id)}">${isManager ? "Kelola grup" : "Buka grup"}</button>`
        : isPending
          ? '<button type="button" class="btn btn-secondary btn-sm" disabled>Menunggu persetujuan</button>'
          : `<button type="button" class="btn btn-primary btn-sm" data-group-join="${escapeText(group.id)}">${group.access_type === "approval" ? "Minta bergabung" : group.access_type === "private" ? "Terima undangan" : "Gabung grup"}</button>`;
      return `
        <article class="surface group-card">
          <div class="group-head"><div><h3>${escapeText(group.name)}</h3><div class="group-sub">${escapeText(courseName)}</div>${demoBadge}</div><span class="mode ${escapeText(group.mode)}">${group.mode === "online" ? "Online" : "Offline"}</span></div>
          <p class="group-card-description">${escapeText(group.description || "Belum ada deskripsi kelompok.")}</p>
          <div class="group-sub group-detail-line"><i data-lucide="calendar-days"></i>${schedule}</div>
          <div class="group-sub group-detail-line"><i data-lucide="${group.mode === "online" ? "video" : "map-pin"}"></i>${place}</div>
          <div class="group-status-row"><span class="group-access-label">${escapeText(accessLabel)}</span><span class="group-member-status">${escapeText(status)}</span></div>
          ${progress}
          <div class="group-sub">${capacityText}</div>
          <div class="group-foot"><span class="tiny group-pending-count">${pendingCount ? `${pendingCount} permohonan masuk` : ""}</span>${action}</div>
        </article>`;
    }).join("") || '<div class="empty-state" style="grid-column:1/-1"><h3>Belum ada kelompok belajar</h3><p>Buat kelompok baru atau coba kata kunci dan filter lain.</p></div>');

    $$("[data-group-invite-accept]").forEach(button => button.addEventListener("click", () => acceptGroupInvitation(button.dataset.groupInviteAccept)));
    $$("[data-group-invite-decline]").forEach(button => button.addEventListener("click", () => declineGroupInvitation(button.dataset.groupInviteDecline)));
    $$("[data-group-join]").forEach(button => button.addEventListener("click", () => requestGroupJoin(button.dataset.groupJoin, button)));
    $$("[data-group-open]").forEach(button => button.addEventListener("click", () => openGroupDetails(button.dataset.groupOpen)));
    icons();
  }

  async function loadGroups({ showLoading = true } = {}) {
    renderGroupAccess();
    if (!isVerified) {
      state.groups = [];
      state.groupMemberships = new Map();
      state.groupMembers = [];
      state.groupInvitations = [];
      $("#group-list").innerHTML = "";
      return;
    }

    if (showLoading) $("#group-list").innerHTML = '<div class="verification-loading">Memuat grup belajar...</div>';
    try {
      const [groups, memberships, invitations] = await Promise.all([
        listStudyGroups(),
        listMyGroupMemberships(currentUserId),
        listMyGroupInvitations(),
      ]);
      state.groups = groups;
      state.groupMemberships = new Map(memberships.map(item => [item.group_id, item]));
      state.groupMembers = await listVisibleGroupMembers(groups.map(group => group.id));
      state.groupInvitations = invitations;
      renderGroups();
      return state.groupMembers;
    } catch (error) {
      console.error("Study group load failed:", error);
      $("#group-list").innerHTML = `<div class="empty-state"><div class="empty-icon"><i data-lucide="alert-circle"></i></div><h3>Grup belajar belum dapat dimuat</h3><p>${escapeText(error?.message || "Periksa koneksi lalu coba kembali.")}</p><button class="btn btn-secondary btn-sm" id="group-retry">Coba lagi</button></div>`;
      $("#group-retry")?.addEventListener("click", () => loadGroups());
      icons();
    }
  }

  async function requestGroupJoin(groupId, button) {
    if (!isVerified) { toast("Verifikasi mahasiswa diperlukan untuk bergabung."); return; }
    if (button) { button.disabled = true; button.textContent = "Memproses..."; }
    try {
      const status = await joinStudyGroup(groupId);
      await loadGroups({ showLoading: false });
      toast(status === "pending" ? "Permintaan bergabung dikirim. Tunggu persetujuan admin." : "Kamu berhasil bergabung ke kelompok.");
      if (status === "active") openGroupDetails(groupId);
    } catch (error) {
      console.error("Study group join failed:", error);
      toast(error?.message || "Permintaan bergabung gagal. Periksa status verifikasi atau kapasitas grup.");
      if (button) { button.disabled = false; button.textContent = "Coba lagi"; }
    }
  }

  async function acceptGroupInvitation(groupId) {
    if (!isVerified) { toast("Verifikasi mahasiswa diperlukan untuk menerima undangan."); return; }
    try {
      const status = await joinStudyGroup(groupId);
      if (status !== "active") throw new Error("Undangan belum dapat diterima. Periksa kembali status grup.");
      await loadGroups({ showLoading: false });
      toast("Undangan diterima. Kamu sekarang menjadi anggota kelompok.");
      openGroupDetails(groupId);
    } catch (error) {
      toast(error?.message || "Undangan belum berhasil diterima.");
    }
  }

  async function declineGroupInvitation(inviteId) {
    try {
      await cancelGroupInvite(inviteId);
      await loadGroups({ showLoading: false });
      toast("Undangan kelompok ditolak.");
    } catch (error) {
      toast(error?.message || "Undangan belum berhasil ditolak.");
    }
  }

  function groupDate(value) {
    if (!value) return "-";
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? "-"
      : date.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
  }

  function openGroupDetails(groupId) {
    const group = state.groups.find(item => item.id === groupId);
    if (!group) return;
    const membership = state.groupMemberships.get(group.id);
    if (membership?.status !== "active") return;
    openGroupWorkspace({
      group,
      membership,
      members: state.groupMembers.filter(member => member.group_id === group.id),
      currentUserId,
      toast,
      escape: escapeText,
      openModal,
      refresh: () => loadGroups({ showLoading: false }),
    }).catch(error => {
      console.error("Group workspace failed to open:", error);
      toast(error?.message || "Ruang kelompok belum dapat dibuka.");
    });
  }

  function confirmGroupJoinReview(groupId, userId, accept) {
    const decision = accept ? "Setujui" : "Tolak";
    openModal(
      `${decision} permohonan anggota?`,
      `<p class="section-note">${decision} permohonan masuk #${escapeText(userId.slice(0, 8))}? Status keanggotaan akan diperbarui.</p>`,
      decision,
      async () => {
        await respondGroupJoinRequest(groupId, userId, accept);
        await loadGroups({ showLoading: false });
        return true;
      },
      accept ? "Mahasiswa berhasil ditambahkan ke kelompok." : "Permohonan bergabung ditolak."
    );
  }

  function openCreateGroupForm() {
    if (!isVerified) { toast("Verifikasi mahasiswa diperlukan untuk membuat kelompok."); return; }
    const programOptions = UT_PROGRAMS.map(program =>
      `<option value="${escapeText(program)}">${escapeText(program)}</option>`
    ).join("");
    const content = `
      <p class="section-note">Kelompok akan tersimpan di UT Connect. Pembuat otomatis menjadi admin pertama.</p>
      <div class="field"><label for="new-group-name">Nama kelompok</label><input id="new-group-name" class="text-input" minlength="3" maxlength="100" placeholder="Contoh: Belajar Sistem Informasi Bersama"></div>
      <div class="field"><label for="new-group-description">Deskripsi (opsional)</label><textarea id="new-group-description" class="text-input" rows="3" maxlength="1500" placeholder="Tujuan dan fokus belajar kelompok"></textarea></div>
      <div class="field"><label for="new-group-program">Program studi (opsional)</label><select id="new-group-program" class="select"><option value="">Kelompok umum</option>${programOptions}</select></div>
      <div class="field"><label for="new-group-mode">Mode pertemuan</label><select id="new-group-mode" class="select"><option value="online">Online</option><option value="offline">Offline</option></select></div>
      <div class="field"><label for="new-group-access">Akses kelompok</label><select id="new-group-access" class="select"><option value="open">Terbuka · langsung bergabung</option><option value="approval">Persetujuan admin · perlu ditinjau</option></select></div>
      <div class="field"><label for="new-group-capacity">Kapasitas (2–100 anggota)</label><input id="new-group-capacity" class="text-input" type="number" min="2" max="100" value="10"></div>
      <div class="field"><label for="new-group-schedule">Jadwal (opsional)</label><input id="new-group-schedule" class="text-input" maxlength="300" placeholder="Contoh: Sabtu, 19.00 WIB"></div>
      <div class="field"><label for="new-group-online-url">Tautan pertemuan online (opsional)</label><input id="new-group-online-url" class="text-input" type="url" maxlength="500" placeholder="https://meet.google.com/..."></div>
      <div class="field"><label for="new-group-offline-area">Area pertemuan offline (opsional)</label><input id="new-group-offline-area" class="text-input" maxlength="160" placeholder="Contoh: Area layanan belajar UPBJJ"></div>`;
    openModal("Buat kelompok belajar", content, "Buat kelompok", async () => {
      const name = $("#new-group-name").value.trim();
      const description = $("#new-group-description").value.trim();
      const program = $("#new-group-program").value || null;
      const mode = $("#new-group-mode").value;
      const accessType = $("#new-group-access").value;
      const capacity = Number($("#new-group-capacity").value);
      const schedule = $("#new-group-schedule").value.trim();
      const onlineUrl = $("#new-group-online-url").value.trim();
      const offlineArea = $("#new-group-offline-area").value.trim();
      if (name.length < 3 || name.length > 100) { toast("Nama kelompok harus 3–100 karakter."); return false; }
      if (description.length > 1500) { toast("Deskripsi maksimal 1.500 karakter."); return false; }
      if (!Number.isInteger(capacity) || capacity < 2 || capacity > 100) { toast("Kapasitas harus antara 2 dan 100 anggota."); return false; }
      if (mode === "online" && onlineUrl) {
        try {
          const parsed = new URL(onlineUrl);
          if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("protocol");
        } catch {
          toast("Masukkan tautan meeting yang valid dan diawali https:// atau http://.");
          return false;
        }
      }
      try {
        await createStudyGroup({
          name,
          description: description || null,
          course_id: null,
          program,
          mode,
          capacity,
          access_type: accessType,
          schedule_text: schedule || null,
          online_url: mode === "online" ? onlineUrl : null,
          offline_area_label: mode === "offline" ? offlineArea : null,
        });
        await loadGroups({ showLoading: false });
        return true;
      } catch (error) {
        console.error("Study group creation failed:", error);
        toast(error?.message || "Kelompok belum berhasil dibuat. Periksa data dan status verifikasi.");
        return false;
      }
    }, "Kelompok belajar berhasil dibuat.");
  }

  $("#group-search").addEventListener("input", renderGroups);
  $$("[data-group-filter]").forEach(button => button.addEventListener("click", () => {
    state.groupFilter = button.dataset.groupFilter;
    $$("[data-group-filter]").forEach(item => item.classList.toggle("active", item === button));
    renderGroups();
  }));
  $("#create-group").addEventListener("click", openCreateGroupForm);

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
    const submitPanel = $("#verification-submit-panel");
    const queuePanel = $("#verification-admin-panel");
    const queue = $("#verification-queue");

    // Administrators manage student reviews; their own student verification state is not applicable.
    if (isAdmin) {
      if (statusPanel) statusPanel.hidden = true;
      if (submitPanel) submitPanel.hidden = true;
      if (!queuePanel) return;

      queuePanel.hidden = false;
      if (queue) queue.innerHTML = '<div class="verification-loading">Memuat antrean...</div>';
      try {
        const items = await listStudentVerificationQueue();
        renderVerificationQueue(items);
        const count = $("#verification-queue-count");
        if (count) count.textContent = String(items.length);
      } catch (error) {
        console.error("Administrator verification queue load failed:", error);
        if (queue) queue.innerHTML = '<p class="section-note">Antrean belum dapat dimuat. Coba muat ulang.</p>';
      }
      return;
    }

    if (!statusPanel || !submitPanel) return;
    statusPanel.hidden = false;
    submitPanel.hidden = false;
    if (queuePanel) queuePanel.hidden = true;

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
    } catch (error) {
      console.error("Student verification load failed:", error);
      statusPanel.innerHTML = `<div class="verification-result rejected"><span class="verification-symbol">!</span><div><strong>Status belum dapat dimuat</strong><p>${escapeText(error?.message || "Periksa koneksi lalu coba lagi.")}</p><button class="btn btn-secondary btn-sm" id="verification-retry">Coba lagi</button></div></div>`;
      $("#verification-retry")?.addEventListener("click", loadVerification);
    }
  }
  $("#verification-refresh")?.addEventListener("click", loadVerification);

  function chatTimestamp(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Waktu tidak tersedia" : date.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
  }

  function upsertDirectChatMessage(message) {
    if (!message?.id) return;
    const index = state.chatMessages.findIndex(item => item.id === message.id);
    if (index >= 0) state.chatMessages[index] = { ...state.chatMessages[index], ...message };
    else state.chatMessages.push(message);
    state.chatMessages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    renderDirectChatMessages();
  }

  function renderDirectChatMessages() {
    const container = $("#message-room-messages") || $("#direct-chat-messages");
    if (!container) return;
    const messages = state.chatMessages || [];
    container.innerHTML = messages.length ? messages.map(message => {
      const own = message.sender_id === currentUserId;
      const receipt = own ? (message.read_at ? "Dibaca" : "Terkirim") : "";
      return `
        <article class="direct-chat-message ${own ? "own" : "other"}">
          <div class="direct-chat-bubble">${escapeText(message.body)}</div>
          <div class="direct-chat-meta">${escapeText(chatTimestamp(message.created_at))}${receipt ? ` · ${receipt}` : ""}</div>
        </article>`;
    }).join("") : '<div class="direct-chat-empty">Belum ada pesan. Mulai percakapan belajar dengan menyapa koneksimu.</div>';
    container.scrollTop = container.scrollHeight;
  }

  async function refreshDirectChat({ markRead = true } = {}) {
    const connectionId = state.activeChatConnectionId;
    if (!connectionId) return;
    const messages = await listDirectMessages(connectionId, { limit: 60 });
    if (state.activeChatConnectionId !== connectionId) return;
    state.chatMessages = messages;
    renderDirectChatMessages();
    if (markRead) {
      await markDirectMessagesRead(connectionId);
      const activeRoom = state.chatRooms.find(room => room.connection_id === connectionId);
      if (activeRoom) activeRoom.unread_count = 0;
      renderMessageRooms();
    }
  }

  async function submitDirectChatMessage() {
    const connectionId = state.activeChatConnectionId;
    const input = $("#message-room-input") || $("#direct-chat-input");
    const button = $("#message-room-send") || $("#direct-chat-send");
    if (!connectionId || !input || !button) return;
    const body = input.value.trim();
    if (!body) return;
    button.disabled = true;
    try {
      const message = await sendDirectMessage(connectionId, body);
      upsertDirectChatMessage(message);
      input.value = "";
      input.focus();
      await refreshMessageRooms().catch(error => console.warn("Chat room refresh failed:", error));
    } catch (error) {
      console.error("Direct message send failed:", error);
      toast(error?.message || "Pesan belum berhasil dikirim.");
    } finally {
      button.disabled = false;
    }
  }

  function initialsForName(value) {
    return String(value || "UT").trim().split(/\s+/).slice(0, 2).map(part => part[0] || "").join("").toUpperCase() || "UT";
  }

  function renderMessageRooms() {
    const list = $("#message-room-list");
    if (!list) return;
    if (!state.chatRooms.length) {
      list.innerHTML = '<div class="message-room-empty">Belum ada chat pribadi. Hubungkan diri dengan mahasiswa melalui menu Matching, lalu mulai percakapan setelah permintaan diterima.</div>';
      return;
    }
    list.innerHTML = state.chatRooms.map(room => {
      const active = room.connection_id === state.activeChatConnectionId;
      const name = room.other_full_name || "Mahasiswa UT";
      const avatar = getProfileAvatarUrl(room.avatar_path);
      const avatarHtml = avatar
        ? '<span class="message-room-avatar"><img src="' + escapeText(avatar) + '" alt=""></span>'
        : '<span class="message-room-avatar">' + escapeText(initialsForName(name)) + '</span>';
      const preview = room.last_message || "Belum ada pesan";
      const unread = Number(room.unread_count || 0);
      return '<button type="button" class="message-room-item ' + (active ? "active" : "") + '" data-message-room="' + escapeText(room.connection_id) + '">' +
        avatarHtml + '<span class="message-room-copy"><strong>' + escapeText(name) + '</strong><small>' + escapeText(preview) + '</small></span>' +
        '<span class="message-room-meta">' + (unread ? '<b>' + escapeText(String(unread > 99 ? "99+" : unread)) + '</b>' : '') +
        '<time>' + escapeText(room.last_message_at ? new Date(room.last_message_at).toLocaleDateString("id-ID", {day:"2-digit",month:"short"}) : "") + '</time></span></button>';
    }).join("");
    $$("[data-message-room]").forEach(button => button.addEventListener("click", () => openDirectChat(button.dataset.messageRoom)));
  }

  async function refreshMessageRooms() {
    state.chatRooms = await listMyChatRooms();
    if (state.activeChatRoom) {
      state.activeChatRoom = state.chatRooms.find(room => room.connection_id === state.activeChatConnectionId) || state.activeChatRoom;
    }
    renderMessageRooms();
    return state.chatRooms;
  }

  async function loadMessages({ showLoading = true } = {}) {
    const notice = $("#messages-access-notice");
    const inbox = $("#message-inbox");
    if (!isVerified) {
      if (notice) {
        notice.hidden = false;
        notice.innerHTML = '<div class="group-access-content"><div class="group-access-icon"><i data-lucide="shield-check"></i></div><div><strong>Verifikasi mahasiswa diperlukan</strong><p>Chat pribadi hanya tersedia untuk mahasiswa UT terverifikasi yang telah saling menerima koneksi.</p><button type="button" class="link-btn" id="messages-verification-link">Buka halaman verifikasi</button></div></div>';
        $("#messages-verification-link")?.addEventListener("click", () => navigate("verification"));
      }
      if (inbox) inbox.hidden = true;
      state.chatRooms = [];
      renderMessageRooms();
      icons();
      return [];
    }
    if (notice) notice.hidden = true;
    if (inbox) inbox.hidden = false;
    if (showLoading) $("#message-room-list").innerHTML = '<div class="verification-loading">Memuat daftar percakapan...</div>';
    try {
      await refreshMessageRooms();
      return state.chatRooms;
    } catch (error) {
      console.error("Chat inbox load failed:", error);
      $("#message-room-list").innerHTML = '<div class="message-room-empty">Daftar chat belum dapat dimuat. ' + escapeText(error?.message || "Periksa koneksi.") + '</div><button class="btn btn-secondary btn-sm" id="message-rooms-retry">Coba lagi</button>';
      $("#message-rooms-retry")?.addEventListener("click", () => loadMessages());
      return [];
    }
  }

  async function openDirectChat(connectionId) {
    if (!isVerified) {
      toast("Verifikasi mahasiswa diperlukan untuk menggunakan chat.");
      return;
    }
    if (state.page !== "messages") await navigate("messages");
    else if (!state.chatRooms.length) await refreshMessageRooms();
    const room = state.chatRooms.find(item => item.connection_id === connectionId);
    if (!room) {
      toast("Ruang chat tidak ditemukan. Pastikan koneksi sudah diterima oleh kedua pihak.");
      return;
    }

    if (state.activeChatChannel) {
      const previousChannel = state.activeChatChannel;
      state.activeChatChannel = null;
      await unsubscribeFromDirectMessages(previousChannel).catch(error => console.warn("Chat channel cleanup failed:", error));
    }
    state.activeChatConnectionId = connectionId;
    state.activeChatRoom = room;
    state.chatMessages = [];

    const name = room.other_full_name || "Mahasiswa UT";
    const avatar = getProfileAvatarUrl(room.avatar_path);
    const avatarElement = $("#message-room-avatar");
    if (avatarElement) {
      if (avatar) {
        const image = document.createElement("img");
        image.src = avatar;
        image.alt = "";
        avatarElement.replaceChildren(image);
      } else avatarElement.textContent = initialsForName(name);
    }
    $("#message-room-name").textContent = name;
    $("#message-room-program").textContent = room.program || "Mahasiswa UT";
    $("#message-room-placeholder").hidden = true;
    $("#message-room-view").hidden = false;
    renderMessageRooms();

    $("#message-room-refresh").onclick = async () => {
      $("#message-room-status").textContent = "Memuat ulang...";
      try {
        await refreshDirectChat();
        await refreshMessageRooms();
        $("#message-room-status").textContent = "Percakapan diperbarui.";
      } catch (error) {
        $("#message-room-status").textContent = "Belum dapat memuat percakapan.";
        toast(error?.message || "Gagal memuat pesan.");
      }
    };

    $("#message-room-status").textContent = "Memuat percakapan...";
    try {
      await refreshDirectChat();
      if (state.activeChatConnectionId !== connectionId) return;
      state.activeChatChannel = subscribeToDirectMessages(
        connectionId,
        payload => {
          if (state.activeChatConnectionId !== connectionId) return;
          const message = payload?.new;
          if (!message?.id) return;
          upsertDirectChatMessage(message);
          if (payload.eventType === "INSERT" && message.sender_id !== currentUserId) {
            markDirectMessagesRead(connectionId).catch(error => console.warn("Read receipt update failed:", error));
          }
          refreshMessageRooms().catch(error => console.warn("Chat room preview refresh failed:", error));
        },
        (status, error) => {
          const statusLabel = $("#message-room-status");
          if (!statusLabel || state.activeChatConnectionId !== connectionId) return;
          if (status === "SUBSCRIBED") {
            statusLabel.textContent = "Terhubung · pesan diperbarui langsung";
            refreshDirectChat().catch(loadError => console.warn("Realtime chat refresh failed:", loadError));
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            statusLabel.textContent = "Pembaruan langsung terputus. Gunakan Muat ulang.";
            if (error) console.warn("Realtime chat status:", status, error);
          }
        }
      );
      if (!state.activeChatChannel) $("#message-room-status").textContent = "Pembaruan langsung tidak aktif. Gunakan Muat ulang.";
    } catch (error) {
      console.error("Direct chat load failed:", error);
      $("#message-room-status").textContent = "Percakapan belum dapat dimuat.";
      toast(error?.message || "Gagal membuka percakapan.");
    }
    icons();
  }

  $("#messages-refresh")?.addEventListener("click", () => loadMessages({ showLoading: false }));
  $("#message-room-form")?.addEventListener("submit", event => {
    event.preventDefault();
    submitDirectChatMessage();
  });

  // Profile editor uses the authenticated update RPC; avatar uploads are owner-write and publicly served profile images.
  function renderProfileSummary() {
    const profile = state.profile || {};
    const name = profile.full_name || currentUserName || "Mahasiswa UT";
    currentUserName = name;
    ["topUserName", "sideUserName"].forEach(id => { const element = $("#" + id); if (element) element.textContent = name; });
    const status = $("#profileStatusTag");
    if (status) status.textContent = isAdmin ? "Role: ADMINISTRATOR" : "Status: " + String(profile.verification_status || "pending").toUpperCase();
    const faculty = $("#profileFaculty"); if (faculty) faculty.textContent = resolveUTFaculty(profile.faculty) || profile.faculty || "-";
    const program = $("#profileProgram"); if (program) program.textContent = resolveUTProgram(profile.faculty, profile.program) || profile.program || "-";
    const semester = $("#profileSemester"); if (semester) semester.textContent = profile.semester || "-";
    const bio = $("#profileBio"); if (bio) bio.textContent = profile.bio || (isAdmin ? "Administrator UT Connect" : "Mahasiswa Universitas Terbuka");
    $("#profileFullName").textContent = name;
    const avatarUrl = getProfileAvatarUrl(profile.avatar_path);
    ["topAvatar", "sideAvatar", "profileInitials"].forEach(id => {
      const element = $("#" + id);
      if (!element) return;
      if (avatarUrl) {
        const image = document.createElement("img");
        image.src = avatarUrl;
        image.alt = "";
        image.loading = "lazy";
        element.replaceChildren(image);
      } else {
        element.textContent = initialsForName(name);
      }
    });
  }

  function openProfileEditor() {
    const profile = state.profile || {};
    const currentFaculty = resolveUTFaculty(profile.faculty) || profile.faculty || "";
    const currentProgram = resolveUTProgram(currentFaculty, profile.program) || profile.program || "";
    const faculty = escapeText(currentFaculty);
    const program = escapeText(currentProgram);
    const verifiedIdentityMayReset = isVerified;
    let selectedAvatarPreset = profile.avatar_path?.startsWith("preset:") ? profile.avatar_path.slice("preset:".length) : null;
    const content = `
      <form id="profile-edit-form" class="profile-edit-form">
        <div class="profile-edit-avatar"><div class="profile-edit-avatar-preview" id="profile-edit-avatar-preview">${profile.avatar_path ? '<img src="' + escapeText(getProfileAvatarUrl(profile.avatar_path) || "") + '" alt="Foto profil saat ini">' : escapeText(initialsForName(profile.full_name || currentUserName))}</div>
          <div><strong>Foto profil</strong><small>Pilih avatar bawaan atau unggah JPG, PNG, WebP (maks. 5 MB).</small><label class="btn btn-secondary btn-sm" for="profile-avatar-file">Unggah foto sendiri</label><input id="profile-avatar-file" type="file" accept="image/jpeg,image/png,image/webp" hidden></div>
        </div>
        <div class="profile-avatar-preset-grid" role="group" aria-label="Pilih avatar bawaan">
          ${["avatar-01","avatar-02","avatar-03","avatar-04"].map((id,index) => '<button type="button" class="profile-avatar-preset ' + (profile.avatar_path === 'preset:' + id ? 'selected' : '') + '" data-profile-avatar-preset="' + id + '" aria-label="Pilih avatar ' + (index+1) + '"><img src="/avatars/' + id + '.svg" alt=""><span>Avatar ' + (index+1) + '</span></button>').join("")}
        </div>
        <div class="field"><label for="profile-edit-name">Nama lengkap</label><input id="profile-edit-name" class="text-input" maxlength="100" minlength="2" required value="${escapeText(profile.full_name || currentUserName)}"></div>
        <div class="field"><label for="profile-edit-faculty">Fakultas</label><select id="profile-edit-faculty" class="select" required></select></div>
        <div class="field"><label for="profile-edit-program">Program studi</label><select id="profile-edit-program" class="select" required></select></div>
        <div class="field"><label for="profile-edit-semester">Semester</label><select id="profile-edit-semester" class="select" required>${Array.from({length:16},(_,i)=>'<option value="' + (i+1) + '"' + (Number(profile.semester)===(i+1) ? ' selected' : '') + '>Semester ' + (i+1) + '</option>').join("")}</select></div>
        <div class="field"><label for="profile-edit-bio">Bio singkat (opsional)</label><textarea id="profile-edit-bio" class="textarea" rows="3" maxlength="280" placeholder="Ceritakan minat belajar atau bidang yang kamu sukai.">${escapeText(profile.bio || "")}</textarea></div>
        ${verifiedIdentityMayReset ? '<label class="profile-reset-confirm"><input id="profile-reset-verification" type="checkbox"><span>Saya memahami bahwa mengubah nama/fakultas/program studi/semester akan mengembalikan status verifikasi mahasiswa menjadi Pending dan perlu diverifikasi ulang.</span></label>' : ''}
      </form>`;
    openModal("Edit profil", content, "Simpan perubahan", async () => {
      const name = $("#profile-edit-name").value.trim();
      const faculty = $("#profile-edit-faculty").value;
      const program = $("#profile-edit-program").value;
      const semester = Number($("#profile-edit-semester").value);
      const bio = $("#profile-edit-bio").value.trim();
      const file = $("#profile-avatar-file").files?.[0] || null;
      const identityChanged = name !== profile.full_name || faculty !== currentFaculty || program !== currentProgram || semester !== Number(profile.semester);
      const acknowledge = Boolean($("#profile-reset-verification")?.checked);
      if (identityChanged && verifiedIdentityMayReset && !acknowledge) {
        toast("Centang konfirmasi perubahan identitas terlebih dahulu.");
        return false;
      }
      try {
        const updated = await updateMyStudentProfile({
          fullName: name, faculty, program, semester, bio,
          acknowledgeVerificationReset: acknowledge,
        });
        if (file) updated.avatar_path = await uploadMyProfileAvatar(file);
        else if (selectedAvatarPreset) updated.avatar_path = await setMyProfileAvatarPreset(selectedAvatarPreset);
        state.profile = { ...state.profile, ...updated };
        isVerified = state.profile.verification_status === "verified";
        verificationStatus = state.profile.verification_status || "pending";
        renderProfileSummary();
        await Promise.all([loadForum(), loadMatching(), loadGroups(), loadVerification()]);
        toast("Profil berhasil diperbarui.");
        return true;
      } catch (error) {
        console.error("Profile update failed:", error);
        toast(error?.message || "Profil belum berhasil disimpan.");
        return false;
      }
    }, "Profil berhasil diperbarui.");
    populateUTFacultyProgramSelects($("#profile-edit-faculty"), $("#profile-edit-program"), {
      faculty: profile.faculty || "", program: profile.program || "",
    });
    $("#profile-avatar-file").addEventListener("change", event => {
      const file = event.target.files?.[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) { toast("Ukuran foto profil maksimal 5 MB."); event.target.value = ""; return; }
      selectedAvatarPreset = null;
      $$("[data-profile-avatar-preset]").forEach(button => button.classList.remove("selected"));
      const preview = $("#profile-edit-avatar-preview");
      const url = URL.createObjectURL(file);
      preview.innerHTML = '<img src="' + url + '" alt="Pratinjau foto profil">';
    });
    $$("[data-profile-avatar-preset]").forEach(button => button.addEventListener("click", () => {
      selectedAvatarPreset = button.dataset.profileAvatarPreset;
      $("#profile-avatar-file").value = "";
      $$("[data-profile-avatar-preset]").forEach(item => item.classList.toggle("selected", item === button));
      $("#profile-edit-avatar-preview").innerHTML = '<img src="/avatars/' + escapeText(selectedAvatarPreset) + '.svg" alt="Avatar pilihan">';
    }));
  }
    function escapeText(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  let modalAction=null,modalSuccessMessage='Perubahan berhasil diterapkan.';function openModal(title,content,confirm='Mengerti',action=null,successMessage='Perubahan berhasil diterapkan.'){ modalAction=action;modalSuccessMessage=successMessage;$('#modal-title').textContent=title;$('#modal-content').innerHTML=content;$('#modal-confirm').textContent=confirm;$('#modal-confirm').style.display='';$('#modal-confirm').disabled=false;$('#modal-cancel').textContent='Tutup';$('#modal-backdrop').classList.add('open'); }
  function closeModal(){
    closeGroupWorkspace().catch(error => console.warn("Group workspace cleanup failed:", error));
    if(state.activeChatChannel){
      const channel=state.activeChatChannel;
      state.activeChatChannel=null;
      unsubscribeFromDirectMessages(channel).catch(error=>console.warn("Chat channel cleanup failed:",error));
    }
    state.activeChatConnectionId=null;
    state.chatMessages=[];
    $('#modal-backdrop').classList.remove('open');
    if(activeVerificationPreviewUrl){URL.revokeObjectURL(activeVerificationPreviewUrl);activeVerificationPreviewUrl=null}
  }
  const guide=`<div style="display:grid;gap:14px"><div><b style="font-size:11px">01 · Lengkapi profil</b><p class="section-note">Daftar dengan data akademik yang diperlukan. Verifikasi identitas harus dilakukan melalui layanan yang sah pada versi produksi.</p></div><div><b style="font-size:11px">02 · Atur lokasi secara sadar</b><p class="section-note">Pilih lokasi perkiraan dan tentukan apakah ingin tampil di radar. Jangan tampilkan alamat rumah atau koordinat presisi kepada pengguna lain.</p></div><div><b style="font-size:11px">03 · Temukan teman belajar</b><p class="section-note">Gunakan radius dan preferensi mata kuliah untuk melihat rekomendasi yang relevan.</p></div><div><b style="font-size:11px">04 · Bangun koneksi</b><p class="section-note">Kirim permintaan connect. Chat hanya tersedia setelah kedua pihak menyetujui koneksi.</p></div><div><b style="font-size:11px">05 · Belajar bersama</b><p class="section-note">Gunakan forum untuk peer help atau bergabung dan membuat kelompok belajar.</p></div><p class="tiny muted" style="padding:10px;background:#f7f9fc;border-radius:9px">Catatan: Peta sekitar, matching, koneksi, dan chat personal memakai layanan Supabase dan hanya tersedia sesuai status verifikasi. Pin lokasi mahasiswa lain adalah perkiraan dan hanya tampil jika pemilik mengaktifkan radar.</p></div>`;
  $$('[data-open-guide]').forEach(b=>b.addEventListener('click',()=>openModal('Panduan UT Connect',guide)));$('#modal-close').addEventListener('click',closeModal);$('#modal-cancel').addEventListener('click',closeModal);$('#modal-confirm').addEventListener('click',async()=>{if(modalAction){const confirmButton=$('#modal-confirm');confirmButton.disabled=true;try{const result=await modalAction();if(result===false)return;modalAction=null;closeModal();toast(modalSuccessMessage)}catch(error){console.error('Modal action failed:',error);toast(error.message||'Tindakan gagal. Silakan coba lagi.')}finally{confirmButton.disabled=false}return}closeModal();toast('Panduan ditutup.')});$('#modal-backdrop').addEventListener('click',e=>{if(e.target.id==='modal-backdrop')closeModal()});document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeModal();$('#notification-panel').hidden=true;$('#notif-btn').setAttribute('aria-expanded','false')}});$('#edit-profile').addEventListener('click',openProfileEditor);
  renderProfileSummary();
  $("#message-room-placeholder").hidden = false;
  $("#message-room-view").hidden = true;
  initMap();loadHomeMap();loadForum();loadGroups();loadInformation();loadVerification();loadNotifications().catch(()=>{});initNotificationRealtime();icons();
}
