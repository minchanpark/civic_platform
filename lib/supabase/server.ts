import "server-only";
import { createHmac } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;

export function bearerToken(request: Request) {
  const value = request.headers.get("authorization");
  return value?.startsWith("Bearer ") ? value.slice(7) : null;
}

export function getSupabaseClientForToken(accessToken: string): SupabaseClient | null {
  if (!url || !publishableKey) return null;
  return createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

export function getSupabasePublicClient(): SupabaseClient | null {
  if (!url || !publishableKey) return null;
  return createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function getSupabaseSecretClient(): SupabaseClient | null {
  if (!url || !secretKey) return null;
  return createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function serverDigest(value: string) {
  return secretKey ? createHmac("sha256", secretKey).update(value).digest("hex") : null;
}

export function requestAddress(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")?.trim()
    || "local";
}
