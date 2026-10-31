import {
  listGroupMessages,
  sendGroupMessage,
  setGroupMessagePinned,
  subscribeToGroupMessages,
  unsubscribeFromGroupMessages,
  respondGroupJoinRequest,
  listGroupMaterials,
  uploadGroupMaterial,
  deleteGroupMaterial,
  listGroupAgendaItems,
  createGroupAgendaItem,
  updateGroupAgendaItem,
  deleteGroupAgendaItem,
  getGroupPollResults,
  castGroupPollVote,
  listGroupInvites,
  inviteGroupMemberByNim,
  cancelGroupInvite,
} from "../services/groups.js";

let activeGroup = null;
let activeMembership = null;
let currentUserId = null;
let activeTab = "chat";
let activeChannel = null;
let workspaceEpoch = 0;
let groupMessages = [];
let groupMaterials = [];
let groupAgenda = [];
let groupPollResults = {};
let groupInvites = [];
let groupMembers = [];
let toastHandler = () => {};
let refreshHandler = async () => {};
let openModalHandler = () => {};
let escapeHandler = value => String(value ?? "");

const root = () => document.querySelector("#modal-content");
const isManager = () => ["admin", "co_admin"].includes(activeMembership?.role);
const canInvite = () => isManager() && activeGroup?.access_type === "private";

function safe(value) {
  return escapeHandler(value);
}

function dateLabel(value) {
  if (!value) return "Tidak dijadwalkan";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Waktu tidak tersedia"
    : date.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

function bytesLabel(value) {
  const size = Number(value);
  if (!Number.isFinite(size) || size < 1) return "Ukuran tidak tersedia";
  return size < 1024 * 1024
    ? Math.ceil(size / 1024) + " KB"
    : (size / (1024 * 1024)).toFixed(1) + " MB";
}

function tabMarkup() {
  const tabs = [
    ["chat", "Chat grup", "messages-square"],
    ["materials", "Materi", "folder-open"],
    ["agenda", "Agenda", "calendar-check"],
  ];
  if (isManager()) tabs.push(["members", "Anggota", "users-round"]);
  if (activeGroup?.access_type === "private") tabs.push(["invites", "Undangan", "mail-plus"]);
  return '<nav class="group-workspace-tabs" aria-label="Fitur kelompok">' + tabs.map(item =>
    '<button type="button" class="group-workspace-tab ' + (activeTab === item[0] ? "active" : "") +
    '" data-group-tab="' + item[0] + '">' + item[1] + '</button>'
  ).join("") + '</nav>';
}

function workspaceShell() {
  return '<div class="group-workspace">' +
    '<div class="group-workspace-summary">' +
    '<div><strong>' + safe(activeGroup.name) + '</strong><p>' + safe(activeGroup.course?.course_name || "Kelompok umum") +
    ' · ' + safe(activeGroup.mode === "online" ? "Online" : "Offline") + '</p></div>' +
    '<span class="group-workspace-role">' + safe(isManager() ? "Admin grup" : "Anggota") + '</span>' +
    '</div>' + tabMarkup() +
    '<div id="group-workspace-content"><div class="verification-loading">Memuat ruang kelompok...</div></div>' +
    '</div>';
}

function render() {
  const container = root();
  if (!container) return;
  container.innerHTML = workspaceShell();
  container.querySelectorAll("[data-group-tab]").forEach(button => {
    button.addEventListener("click", () => {
      activeTab = button.dataset.groupTab;
      render();
    });
  });
  const content = container.querySelector("#group-workspace-content");
  if (!content) return;
  if (activeTab === "chat") renderChat(content);
  else if (activeTab === "materials") renderMaterials(content);
  else if (activeTab === "agenda") renderAgenda(content);
  else if (activeTab === "members") renderMembers(content);
  else if (activeTab === "invites") renderInvites(content);
}

function renderChat(container) {
  const messages = groupMessages;
  const messageList = messages.map(message => {
    const own = message.sender_id === currentUserId;
    const pinned = Boolean(message.pinned_at);
    const controls = isManager()
      ? '<button type="button" class="group-message-pin" data-group-message-pin="' + safe(message.id) +
        '" data-pin="' + (pinned ? "0" : "1") + '">' + (pinned ? "Lepas pin" : "Sematkan") + '</button>'
      : "";
    return '<article class="group-message ' + (own ? "own" : "") + (pinned ? " pinned" : "") + '">' +
      '<div class="group-message-meta"><strong>' + (own ? "Kamu" : "Anggota grup") + '</strong>' +
      '<time>' + safe(dateLabel(message.created_at)) + '</time>' + controls + '</div>' +
      (pinned ? '<span class="group-pinned-label">Pesan disematkan</span>' : "") +
      '<p>' + safe(message.body) + '</p></article>';
  }).join("");
  container.innerHTML = '<div class="group-chat-panel">' +
    '<div class="group-chat-note">Percakapan hanya dapat dibaca dan dikirim oleh anggota aktif kelompok ini.</div>' +
    '<div class="group-message-list" id="group-message-list">' +
    (messageList || '<div class="group-empty">Belum ada pesan. Mulai percakapan kelompok.</div>') +
    '</div>' +
    '<form id="group-message-form" class="group-message-form">' +
    '<textarea id="group-message-input" rows="2" maxlength="5000" placeholder="Tulis pesan untuk kelompok..." required></textarea>' +
    '<button class="btn btn-primary btn-sm" type="submit">Kirim</button></form></div>';

  container.querySelector("#group-message-form")?.addEventListener("submit", async event => {
    event.preventDefault();
    const input = container.querySelector("#group-message-input");
    const body = input?.value.trim() || "";
    if (!body) return;
    const button = event.submitter;
    if (button) button.disabled = true;
    try {
      await sendGroupMessage(activeGroup.id, body);
      input.value = "";
      await reloadMessages();
    } catch (error) {
      toastHandler(error?.message || "Pesan belum berhasil dikirim.");
    } finally {
      if (button) button.disabled = false;
    }
  });

  container.querySelectorAll("[data-group-message-pin]").forEach(button => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        await setGroupMessagePinned(button.dataset.groupMessagePin, button.dataset.pin === "1");
        await reloadMessages();
      } catch (error) {
        toastHandler(error?.message || "Status pin pesan belum dapat diubah.");
      } finally {
        button.disabled = false;
      }
    });
  });
}

async function reloadMessages() {
  if (!activeGroup) return;
  try {
    groupMessages = await listGroupMessages(activeGroup.id);
    if (activeTab === "chat") render();
  } catch (error) {
    toastHandler(error?.message || "Pesan kelompok belum dapat dimuat.");
  }
}

function renderMaterials(container) {
  const materials = groupMaterials;
  const rows = materials.map(item => {
    const canDelete = isManager() || item.uploaded_by === currentUserId;
    return '<article class="group-material-row"><div class="group-material-icon">PDF</div><div class="group-material-info"><strong>' +
      safe(item.title) + '</strong><span>' + safe(bytesLabel(item.file_size_bytes)) + ' · ' +
      safe(dateLabel(item.created_at)) + '</span></div>' +
      (item.download_url
        ? '<a class="btn btn-secondary btn-sm" href="' + safe(item.download_url) + '" target="_blank" rel="noopener noreferrer">Unduh</a>'
        : '<span class="group-file-unavailable">Tautan tidak tersedia</span>') +
      (canDelete ? '<button class="btn btn-quiet btn-sm" data-group-material-delete="' + safe(item.id) + '">Hapus</button>' : "") +
      '</article>';
  }).join("");

  container.innerHTML = '<div class="group-materials-panel">' +
    '<p class="group-chat-note">Materi tersimpan di bucket privat. Hanya anggota aktif yang dapat membuat tautan unduh sementara.</p>' +
    '<form id="group-material-form" class="group-material-form">' +
    '<div class="field"><label for="group-material-title">Judul materi (opsional)</label><input id="group-material-title" class="text-input" maxlength="140" placeholder="Contoh: Ringkasan pertemuan 1"></div>' +
    '<div class="field"><label for="group-material-file">Pilih berkas (maks. 50 MB)</label><input id="group-material-file" type="file" accept=".pdf,.doc,.docx,.pptx,.xlsx,.jpg,.jpeg,.png" required></div>' +
    '<button class="btn btn-primary btn-sm" type="submit">Unggah materi</button></form>' +
    '<div class="group-material-list">' + (rows || '<div class="group-empty">Belum ada materi yang dibagikan.</div>') + '</div></div>';

  container.querySelector("#group-material-form")?.addEventListener("submit", async event => {
    event.preventDefault();
    const file = container.querySelector("#group-material-file")?.files?.[0];
    const title = container.querySelector("#group-material-title")?.value || "";
    const button = event.submitter;
    if (button) button.disabled = true;
    try {
      await uploadGroupMaterial(activeGroup.id, file, title);
      groupMaterials = await listGroupMaterials(activeGroup.id);
      toastHandler("Materi berhasil diunggah.");
      render();
    } catch (error) {
      toastHandler(error?.message || "Materi belum berhasil diunggah.");
    } finally {
      if (button) button.disabled = false;
    }
  });

  container.querySelectorAll("[data-group-material-delete]").forEach(button => {
    button.addEventListener("click", async () => {
      if (!window.confirm("Hapus materi ini dari kelompok?")) return;
      button.disabled = true;
      try {
        await deleteGroupMaterial(button.dataset.groupMaterialDelete);
        groupMaterials = await listGroupMaterials(activeGroup.id);
        toastHandler("Materi berhasil dihapus.");
        render();
      } catch (error) {
        toastHandler(error?.message || "Materi belum berhasil dihapus.");
      } finally {
        button.disabled = false;
      }
    });
  });
}

function renderAgenda(container) {
  const items = groupAgenda;
  const results = groupPollResults;
  const cards = items.map(item => {
    const result = results[item.id] || { options: [], total_votes: 0 };
    const poll = item.item_type === "poll";
    const canDelete = isManager() || item.created_by === currentUserId;
    const pollHtml = poll
      ? '<div class="group-poll-options">' + result.options.map(option =>
          '<div class="group-poll-option"><div><span>' + safe(option.option) + '</span><strong>' +
          safe(String(option.votes)) + '</strong></div><div class="group-poll-track"><span style="width:' +
          (result.total_votes ? Math.min(100, option.votes * 100 / result.total_votes) : 0) + '%"></span></div>' +
          '<button class="btn btn-secondary btn-sm" data-group-poll-vote="' + safe(item.id) +
          '" data-poll-option="' + safe(option.option) + '">Pilih</button></div>'
        ).join("") + '<p class="group-poll-total">' + safe(String(result.total_votes)) + ' suara</p></div>'
      : "";
    return '<article class="group-agenda-card"><div class="group-agenda-head"><span class="group-agenda-type">' +
      safe(item.item_type) + '</span><time>' + safe(dateLabel(item.due_at || item.created_at)) + '</time></div>' +
      '<h4>' + safe(item.title) + '</h4>' +
      (item.details ? '<p>' + safe(item.details) + '</p>' : "") + pollHtml +
      (canDelete ? '<div class="group-agenda-actions"><button class="btn btn-secondary btn-sm" data-group-agenda-edit="' +
        safe(item.id) + '">Edit</button><button class="btn btn-quiet btn-sm" data-group-agenda-delete="' +
        safe(item.id) + '">Hapus</button></div>' : "") + '</article>';
  }).join("");

  container.innerHTML = '<div class="group-agenda-panel">' +
    '<form id="group-agenda-form" class="group-agenda-form">' +
    '<h4 id="group-agenda-form-title">Tambah agenda kelompok</h4>' +
    '<div class="field"><label for="group-agenda-type">Jenis</label><select id="group-agenda-type" class="select">' +
    '<option value="schedule">Jadwal</option><option value="target">Target belajar</option><option value="task">Tugas kelompok</option><option value="poll">Jajak pendapat</option><option value="note">Catatan</option></select></div>' +
    '<div class="field"><label for="group-agenda-title">Judul</label><input id="group-agenda-title" class="text-input" maxlength="120" required></div>' +
    '<div class="field"><label for="group-agenda-details">Keterangan</label><textarea id="group-agenda-details" class="text-input" rows="2" maxlength="3000"></textarea></div>' +
    '<div class="field"><label for="group-agenda-due">Waktu (opsional)</label><input id="group-agenda-due" class="text-input" type="datetime-local"></div>' +
    '<div class="field" id="group-poll-options-field" hidden><label for="group-poll-options-input">Pilihan jajak pendapat (satu per baris)</label><textarea id="group-poll-options-input" class="text-input" rows="3" maxlength="600" placeholder="Sabtu malam&#10;Minggu pagi"></textarea></div>' +
    '<div class="group-agenda-form-actions"><button class="btn btn-primary btn-sm" type="submit" id="group-agenda-save">Simpan agenda</button><button class="btn btn-secondary btn-sm" type="button" id="group-agenda-cancel" hidden>Batal edit</button></div></form>' +
    '<div class="group-agenda-list">' + (cards || '<div class="group-empty">Belum ada agenda. Tambahkan jadwal, target, tugas, atau jajak pendapat.</div>') + '</div></div>';

  let editingId = null;
  const typeInput = container.querySelector("#group-agenda-type");
  const pollField = container.querySelector("#group-poll-options-field");
  typeInput?.addEventListener("change", () => { pollField.hidden = typeInput.value !== "poll"; });
  container.querySelector("#group-agenda-form")?.addEventListener("submit", async event => {
    event.preventDefault();
    const type = typeInput.value;
    const dueValue = container.querySelector("#group-agenda-due").value;
    const payload = {
      item_type: type,
      title: container.querySelector("#group-agenda-title").value,
      details: container.querySelector("#group-agenda-details").value,
      due_at: dueValue ? new Date(dueValue).toISOString() : null,
      poll_options: type === "poll"
        ? container.querySelector("#group-poll-options-input").value.split(/\r?\n/).map(value => value.trim()).filter(Boolean)
        : null,
    };
    const button = container.querySelector("#group-agenda-save");
    button.disabled = true;
    try {
      if (editingId) await updateGroupAgendaItem(editingId, payload);
      else await createGroupAgendaItem(activeGroup.id, payload);
      await reloadAgenda();
      toastHandler(editingId ? "Agenda berhasil diperbarui." : "Agenda berhasil ditambahkan.");
      render();
    } catch (error) {
      toastHandler(error?.message || "Agenda belum berhasil disimpan.");
    } finally {
      button.disabled = false;
    }
  });

  container.querySelector("#group-agenda-cancel")?.addEventListener("click", () => render());
  container.querySelectorAll("[data-group-agenda-edit]").forEach(button => button.addEventListener("click", () => {
    const item = items.find(row => row.id === button.dataset.groupAgendaEdit);
    if (!item) return;
    editingId = item.id;
    container.querySelector("#group-agenda-form-title").textContent = "Edit agenda kelompok";
    typeInput.value = item.item_type;
    container.querySelector("#group-agenda-title").value = item.title;
    container.querySelector("#group-agenda-details").value = item.details || "";
    container.querySelector("#group-agenda-due").value = item.due_at ? new Date(item.due_at).toISOString().slice(0, 16) : "";
    container.querySelector("#group-poll-options-input").value = (item.poll_options || []).join("\n");
    pollField.hidden = item.item_type !== "poll";
    container.querySelector("#group-agenda-save").textContent = "Simpan perubahan";
    container.querySelector("#group-agenda-cancel").hidden = false;
    container.querySelector("#group-agenda-form-title").scrollIntoView({ block: "nearest" });
  }));

  container.querySelectorAll("[data-group-agenda-delete]").forEach(button => button.addEventListener("click", async () => {
    if (!window.confirm("Hapus agenda ini?")) return;
    button.disabled = true;
    try {
      await deleteGroupAgendaItem(button.dataset.groupAgendaDelete);
      await reloadAgenda();
      toastHandler("Agenda berhasil dihapus.");
      render();
    } catch (error) {
      toastHandler(error?.message || "Agenda belum berhasil dihapus.");
    } finally {
      button.disabled = false;
    }
  }));

  container.querySelectorAll("[data-group-poll-vote]").forEach(button => button.addEventListener("click", async () => {
    button.disabled = true;
    try {
      groupPollResults[button.dataset.groupPollVote] =
        await castGroupPollVote(button.dataset.groupPollVote, button.dataset.pollOption);
      toastHandler("Suara kamu berhasil disimpan.");
      render();
    } catch (error) {
      toastHandler(error?.message || "Suara belum berhasil disimpan.");
    } finally {
      button.disabled = false;
    }
  }));
}

async function reloadAgenda() {
  if (!activeGroup) return;
  groupAgenda = await listGroupAgendaItems(activeGroup.id);
  const polls = groupAgenda.filter(item => item.item_type === "poll");
  const entries = await Promise.all(polls.map(async item => [
    item.id,
    await getGroupPollResults(item.id),
  ]));
  groupPollResults = Object.fromEntries(entries);
}

function renderMembers(container) {
  if (!isManager()) {
    container.innerHTML = '<div class="group-empty">Daftar permohonan hanya tersedia untuk admin grup.</div>';
    return;
  }
  const pending = groupMembers.filter(member => member.status === "pending");
  const rows = pending.map((member, index) =>
    '<article class="group-invite-row"><div><strong>Permohonan masuk #' + (index + 1) +
    '</strong><small>Menunggu keputusan admin</small></div><div class="group-request-actions">' +
    '<button class="btn btn-primary btn-sm" data-group-member-decision="approve" data-group-member-id="' + safe(member.user_id) + '">Setujui</button>' +
    '<button class="btn btn-secondary btn-sm" data-group-member-decision="reject" data-group-member-id="' + safe(member.user_id) + '">Tolak</button>' +
    '</div></article>'
  ).join("");
  const activeCount = groupMembers.filter(member => member.status === "active").length;
  container.innerHTML = '<div class="group-members-panel">' +
    '<p class="group-chat-note">' + activeCount + ' anggota aktif. Identitas anggota tidak ditampilkan di daftar pengelolaan ini.</p>' +
    (rows || '<div class="group-empty">Tidak ada permohonan anggota yang menunggu persetujuan.</div>') +
    '</div>';

  container.querySelectorAll("[data-group-member-decision]").forEach(button => button.addEventListener("click", async () => {
    button.disabled = true;
    try {
      await respondGroupJoinRequest(activeGroup.id, button.dataset.groupMemberId, button.dataset.groupMemberDecision === "approve");
      const refreshed = await refreshHandler();
      if (Array.isArray(refreshed)) groupMembers = refreshed.filter(member => member.group_id === activeGroup.id);
      toastHandler(button.dataset.groupMemberDecision === "approve" ? "Permohonan anggota disetujui." : "Permohonan anggota ditolak.");
      render();
    } catch (error) {
      toastHandler(error?.message || "Keputusan anggota belum berhasil disimpan.");
    } finally {
      button.disabled = false;
    }
  }));
}

async function renderInvites(container) {
  if (!canInvite()) {
    container.innerHTML = '<div class="group-empty">Undangan hanya dapat dikelola admin kelompok privat.</div>';
    return;
  }
  const invites = groupInvites;
  const rows = invites.map(invite =>
    '<article class="group-invite-row"><div><strong>Undangan menunggu jawaban</strong><small>Dikirim ' +
    safe(dateLabel(invite.created_at)) + '</small></div><button class="btn btn-secondary btn-sm" data-group-invite-cancel="' +
    safe(invite.id) + '">Batalkan</button></article>'
  ).join("");

  container.innerHTML = '<div class="group-invites-panel">' +
    '<p class="group-chat-note">Masukkan NIM 9 digit mahasiswa UT yang sudah terverifikasi. NIM diproses di server dan tidak ditampilkan kepada anggota kelompok.</p>' +
    '<form id="group-invite-form" class="group-invite-form"><div class="field"><label for="group-invite-nim">NIM mahasiswa</label><input id="group-invite-nim" class="text-input" inputmode="numeric" maxlength="9" pattern="[0-9]{9}" required></div><button class="btn btn-primary btn-sm" type="submit">Kirim undangan</button></form>' +
    '<h4>Undangan yang belum dijawab</h4>' +
    (rows || '<div class="group-empty">Belum ada undangan aktif.</div>') + '</div>';

  container.querySelector("#group-invite-form")?.addEventListener("submit", async event => {
    event.preventDefault();
    const input = container.querySelector("#group-invite-nim");
    const button = event.submitter;
    button.disabled = true;
    try {
      await inviteGroupMemberByNim(activeGroup.id, input.value.trim());
      input.value = "";
      groupInvites = await listGroupInvites(activeGroup.id);
      toastHandler("Undangan berhasil dikirim.");
      render();
    } catch (error) {
      toastHandler(error?.message || "Undangan belum berhasil dikirim.");
    } finally {
      button.disabled = false;
    }
  });
  container.querySelectorAll("[data-group-invite-cancel]").forEach(button => button.addEventListener("click", async () => {
    button.disabled = true;
    try {
      await cancelGroupInvite(button.dataset.groupInviteCancel);
      groupInvites = await listGroupInvites(activeGroup.id);
      toastHandler("Undangan dibatalkan.");
      render();
    } catch (error) {
      toastHandler(error?.message || "Undangan belum dapat dibatalkan.");
    } finally {
      button.disabled = false;
    }
  }));
}

async function loadWorkspaceData() {
  const results = await Promise.allSettled([
    listGroupMessages(activeGroup.id),
    listGroupMaterials(activeGroup.id),
    listGroupAgendaItems(activeGroup.id),
    canInvite() ? listGroupInvites(activeGroup.id) : Promise.resolve([]),
  ]);
  groupMessages = results[0].status === "fulfilled" ? results[0].value : [];
  groupMaterials = results[1].status === "fulfilled" ? results[1].value : [];
  groupAgenda = results[2].status === "fulfilled" ? results[2].value : [];
  groupInvites = results[3].status === "fulfilled" ? results[3].value : [];
  const polls = groupAgenda.filter(item => item.item_type === "poll");
  const pollResults = await Promise.allSettled(polls.map(item => getGroupPollResults(item.id)));
  groupPollResults = Object.fromEntries(polls.map((item, index) => [
    item.id,
    pollResults[index].status === "fulfilled" ? pollResults[index].value : { options: [], total_votes: 0 },
  ]));
  const errors = results.filter(result => result.status === "rejected");
  if (errors.length) toastHandler("Sebagian isi ruang grup belum dapat dimuat. Coba buka kembali tab terkait.");
}

export async function openGroupWorkspace(options) {
  activeGroup = options.group;
  activeMembership = options.membership;
  currentUserId = options.currentUserId;
  groupMembers = Array.isArray(options.members) ? options.members : [];
  toastHandler = options.toast || (() => {});
  refreshHandler = options.refresh || (async () => {});
  openModalHandler = options.openModal;
  activeTab = "chat";
  if (activeChannel) {
    await unsubscribeFromGroupMessages(activeChannel).catch(() => {});
    activeChannel = null;
  }
  openModalHandler("Ruang kelompok belajar", workspaceShell(), "Tutup");
  await loadWorkspaceData();
  render();
  activeChannel = subscribeToGroupMessages(activeGroup.id, () => {
    if (activeTab === "chat") reloadMessages().catch(error => toastHandler(error.message));
  });
}

export async function closeGroupWorkspace() {
  if (activeChannel) {
    const channel = activeChannel;
    activeChannel = null;
    await unsubscribeFromGroupMessages(channel).catch(error => console.warn("Group channel cleanup failed:", error));
  }
  activeGroup = null;
  activeMembership = null;
  currentUserId = null;
  groupMessages = [];
  groupMaterials = [];
  groupAgenda = [];
  groupPollResults = {};
  groupInvites = [];
  groupMembers = [];
  activeTab = "chat";
}
