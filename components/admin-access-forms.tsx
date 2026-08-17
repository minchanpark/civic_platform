"use client";

import { useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { adminText, type AdminLocale, type AdminText } from "@/lib/admin-i18n";

export function AdminNumberForm({ session, locale, onSuccess }: { session: Session; locale: AdminLocale; onSuccess: () => void }) {
  const t = (key: AdminText) => adminText(locale, key);
  const [staffNumber, setStaffNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<AdminText>("The personal admin number is used only to verify this session.");

  const verify = async () => {
    setBusy(true);
    setMessage("Checking the admin number…");
    try {
      const response = await fetch("/api/admin/access", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ staffNumber }),
      });
      await response.json() as { error?: string };
      if (!response.ok) return setMessage("Could not verify the admin number.");
      setStaffNumber("");
      onSuccess();
    } catch {
      setMessage("Check your network connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="auth-card admin-auth-step" aria-labelledby="staff-number-title" aria-busy={busy}>
      <p className="eyebrow">FINAL SECURITY STEP</p>
      <h1 id="staff-number-title">{t("Admin number verification")}</h1>
      <label htmlFor="staff-number">
        {t("Personal admin number")}
        <input id="staff-number" autoComplete="off" maxLength={24} value={staffNumber} onChange={(event) => setStaffNumber(event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""))} />
      </label>
      <button className="button primary" type="button" disabled={busy || staffNumber.length < 8} onClick={() => void verify()}>{busy ? t("Checking…") : t("Verify admin number")}</button>
      <p className="form-message" role="status" aria-live="polite">{t(message)}</p>
    </section>
  );
}
