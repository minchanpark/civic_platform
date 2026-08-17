"use client";

import { FormEvent, useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import { normalizeCellPhone } from "@/lib/issues";
import { signInWithPhoneOnly } from "@/lib/supabase/client";

export function PhoneAccessForm() {
  const { t } = useI18n();
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = normalizeCellPhone(phone);
    if (!normalized) return setMessage(t("report.error.cellPhone"));
    setBusy(true);
    setMessage("");
    try {
      await signInWithPhoneOnly(normalized);
    } catch {
      setMessage(t("phoneAccess.error"));
      setBusy(false);
    }
  };

  return (
    <form className="auth-card" noValidate onSubmit={(event) => void submit(event)} aria-busy={busy}>
      <h2>{t("phoneAccess.title")}</h2>
      <p>{t("phoneAccess.description")}</p>
      <label htmlFor="phone-access-number">
        {t("report.cellPhone")}
        <input id="phone-access-number" type="tel" inputMode="tel" autoComplete="tel" required value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="0912-345-678" aria-invalid={Boolean(message)} aria-describedby={message ? "phone-access-message" : undefined} />
      </label>
      <button className="button primary" type="submit" disabled={busy || !phone.trim()}>
        {busy ? t("phoneAccess.working") : t("phoneAccess.button")}
      </button>
      {message && <p id="phone-access-message" className="form-message" role="alert">{message}</p>}
    </form>
  );
}
