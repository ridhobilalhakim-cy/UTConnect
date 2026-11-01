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

export async function startDemoSession() {
  requireDemoBuild();
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  if (!data?.user) throw new Error("Sesi demo belum berhasil dibuat.");

  try {
    const result = await invokeDemo("bootstrap");
    const { error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) throw refreshError;
    return result;
  } catch (error) {
    await supabase.auth.signOut().catch(() => {});
    throw error;
  }
}

export async function resetDemoSession() {
  return invokeDemo("reset");
}

export async function runDemoAutomation(action, payload = {}) {
  if (!IS_DEMO_BUILD) return null;
  return invokeDemo(action, payload);
}
