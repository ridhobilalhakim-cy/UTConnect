import { supabase, IS_DEMO_BUILD } from "../lib/supabase.js";

function requireDemoBuild() {
  if (!IS_DEMO_BUILD) throw new Error("Demo Mode hanya tersedia pada deployment demo khusus.");
}

async function invokeDemo(action, payload = {}) {
  requireDemoBuild();
  const { data, error } = await supabase.functions.invoke("demo-mode", {
    body: { action, ...payload },
  });
  if (error) {
    const serverMessage = data?.error;
    throw new Error(serverMessage || error.message || "Layanan Demo Mode belum dapat digunakan.");
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function startDemoSession(scenario = "all") {
  requireDemoBuild();
  const { data: currentData, error: currentError } = await supabase.auth.getUser();
  if (currentError) throw currentError;

  let user = currentData?.user || null;
  const reusableDemoUser = user?.is_anonymous === true
    || user?.app_metadata?.utconnect_demo_role === "visitor";

  if (user && !reusableDemoUser) {
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) throw signOutError;
    user = null;
  }

  if (!user) {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
    user = data?.user || null;
  }
  if (!user) throw new Error("Sesi demo belum berhasil dibuat.");

  // Keep the visitor session on bootstrap failure so the same session can retry idempotently.
  const result = await invokeDemo("bootstrap", { scenario });
  const { error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError) throw refreshError;
  return result;
}

export async function resetDemoSession() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (user?.app_metadata?.utconnect_demo_role !== "visitor") {
    throw new Error("Reset hanya tersedia untuk sesi pengunjung DEMO.");
  }
  return invokeDemo("reset");
}

export async function runDemoAutomation(action, payload = {}) {
  if (!IS_DEMO_BUILD) return null;
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (user?.app_metadata?.utconnect_demo_role !== "visitor") return null;
  return invokeDemo(action, payload);
}

export async function listDemoGroups(limit = 100) {
  const result = await invokeDemo("list_groups", { limit });
  return Array.isArray(result?.groups) ? result.groups : [];
}
