import { supabase } from "../lib/supabase.js";

async function invoke(name, body) {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    const serverMessage = data?.error;
    if (serverMessage) throw new Error(serverMessage);
    throw new Error(error.message || "Layanan lokasi belum dapat digunakan.");
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function getMyLocation() {
  const data = await invoke("manage-my-location", { action: "get" });
  return data.location || null;
}

export async function saveMyLocation({ lat, lng, consent = false, showInRadar = false }) {
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw new Error("Latitude lokasi tidak valid.");
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    throw new Error("Longitude lokasi tidak valid.");
  }
  if (consent !== true) {
    throw new Error("Persetujuan penggunaan lokasi diperlukan.");
  }
  if (typeof showInRadar !== "boolean") {
    throw new Error("Pengaturan visibilitas lokasi tidak valid.");
  }
  return invoke("manage-my-location", {
    action: "save",
    lat,
    lng,
    consent: true,
    show_in_radar: showInRadar,
  });
}

export async function setMyLocationVisibility(showInRadar, { consent = false } = {}) {
  if (typeof showInRadar !== "boolean") throw new Error("Pengaturan visibilitas tidak valid.");
  return invoke("manage-my-location", {
    action: "visibility",
    show_in_radar: showInRadar,
    consent: showInRadar ? consent === true : false,
  });
}

export async function findNearbyStudents(radius = 3000, nim = "") {
  if (![1000, 3000, 5000].includes(radius)) {
    throw new Error("Radius pencarian harus 1, 3, atau 5 km.");
  }
  const normalizedNim = String(nim || "").trim();
  if (normalizedNim && !/^\d{9}$/.test(normalizedNim)) {
    throw new Error("Masukkan NIM lengkap 9 digit.");
  }
  const data = await invoke("nearby-students", normalizedNim ? { nim: normalizedNim } : { radius });
  return Array.isArray(data.results) ? data.results : [];
}
