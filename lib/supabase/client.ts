import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const supabaseConfigured = Boolean(url && publishableKey);

let browserClient: SupabaseClient | null = null;

export function getSupabaseClient() {
  if (!supabaseConfigured) return null;
  if (!browserClient) {
    browserClient = createClient(url!, publishableKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce",
      },
    });
  }
  return browserClient;
}

export async function signInWithPhoneOnly(phone: string) {
  const client = getSupabaseClient();
  if (!client) throw new Error("Supabase is not configured");
  const response = await fetch("/api/citizen-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone }),
  });
  const result = await response.json() as {
    session?: { access_token: string; refresh_token: string };
    error?: string;
  };
  if (!response.ok || !result.session) throw new Error(result.error ?? "Phone access failed");
  const { data, error } = await client.auth.setSession(result.session);
  if (error) throw error;
  return data.session;
}
