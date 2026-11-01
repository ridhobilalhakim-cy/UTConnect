import { createClient } from "@supabase/supabase-js";

// Publishable key is designed for browser use. Never put a Supabase secret/service-role key here.
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://hqyusbyndtlfypdbmatw.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_H3jwtlyGfS8L7qK2BoZPTA_Zhn_UYDI";
export const SUPABASE_PROJECT_REF = new URL(SUPABASE_URL).hostname.split(".")[0];
export const IS_DEMO_BUILD = import.meta.env.VITE_UTCONNECT_DEMO_MODE === "true";
export const DEMO_PROJECT_REF = String(import.meta.env.VITE_UTCONNECT_DEMO_PROJECT_REF || "").trim();

// This is a deployment guard only. Authorization is enforced again by demo-only server functions and RLS.
if (IS_DEMO_BUILD) {
  if (!DEMO_PROJECT_REF || DEMO_PROJECT_REF !== SUPABASE_PROJECT_REF) {
    throw new Error("UTConnect Demo Mode requires a matching, dedicated Supabase demo project.");
  }
  if (["hqyusbyndtlfypdbmatw", "lguqtplssimkwwyzmwzz"].includes(SUPABASE_PROJECT_REF)) {
    throw new Error("Demo Mode is blocked from using an existing UTConnect database. Use a newly provisioned demo-only project.");
  }
}
export const AUTH_STORAGE_KEY = IS_DEMO_BUILD
  ? `utconnect-${SUPABASE_PROJECT_REF}-demo-auth`
  : "utconnect-hqyusbyndtlfypdbmatw-auth";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
    storageKey: AUTH_STORAGE_KEY,
    flowType: "pkce",
  },
});
