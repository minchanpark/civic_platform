"use client";

import { useState } from "react";
import { adminText, type AdminLocale } from "@/lib/admin-i18n";
import { getSupabaseClient } from "@/lib/supabase/client";

export function AdminEmailOtpForm({ adminLocale = "en" }: { adminLocale?: AdminLocale }) {
  const at = (key: Parameters<typeof adminText>[1]) => adminText(adminLocale, key);
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const sentMessage = at("Enter the 6-digit code sent by email.");
  const successMessage = at("Email verification completed.");
  const hasError = Boolean(message && message !== sentMessage && message !== successMessage);

  const send = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send", email: email.trim().toLowerCase() }),
      });
      if (!response.ok) return setMessage(at(response.status === 429
        ? "Please wait before requesting another code."
        : "Could not send the code."));
      setSent(true);
      setMessage(sentMessage);
    } catch {
      setMessage(at("Check your network connection and try again."));
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    const client = getSupabaseClient();
    if (!client) return setMessage(at("Supabase configuration is required."));
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", email: email.trim().toLowerCase(), token: token.trim() }),
      });
      const result = await response.json() as { session?: { access_token: string; refresh_token: string } };
      if (!response.ok || !result.session || (await client.auth.setSession(result.session)).error) {
        return setMessage(at("Could not verify the code."));
      }
      setMessage(successMessage);
    } catch {
      setMessage(at("Check your network connection and try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="auth-card" aria-labelledby="email-auth-title">
      <h2 id="email-auth-title">{at("Verifying email")}</h2>
      <p>{at("Start verification with the registered admin email and a one-time code.")}</p>
      <label htmlFor="otp-email">
        {at("Email")}
        <input id="otp-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} disabled={sent || busy} aria-invalid={hasError} aria-describedby={message ? "otp-message" : undefined} />
      </label>
      {!sent ? (
        <button type="button" className="button primary" onClick={() => void send()} disabled={busy || !email.trim()}>
          {busy ? "…" : at("Get code")}
        </button>
      ) : (
        <div className="otp-row">
          <label htmlFor="otp-token">
            {at("6-digit code")}
            <input id="otp-token" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={token} onChange={(event) => setToken(event.target.value.replace(/\D/g, ""))} aria-invalid={hasError} aria-describedby={message ? "otp-message" : undefined} />
          </label>
          <button type="button" className="button primary" onClick={() => void verify()} disabled={busy || token.length !== 6}>
            {busy ? "…" : at("Verify")}
          </button>
          <button type="button" className="link-button" disabled={busy} onClick={() => { setSent(false); setToken(""); setMessage(null); }}>
            {at("Change email")}
          </button>
        </div>
      )}
      {message && <p id="otp-message" className="form-message" role={hasError ? "alert" : "status"} aria-live="polite">{message}</p>}
    </section>
  );
}
