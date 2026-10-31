import { createClient } from "@supabase/supabase-js";

// Publishable key is designed for browser use. Never put a Supabase secret/service-role key here.
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://hqyusbyndtlfypdbmatw.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_H3jwtlyGfS8L7qK2BoZPTA_Zhn_UYDI";
export const AUTH_STORAGE_KEY = "utconnect-hqyusbyndtlfypdbmatw-auth";

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
