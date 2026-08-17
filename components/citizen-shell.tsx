"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { useI18n } from "@/components/i18n-provider";
import { LOCALES, type Locale } from "@/lib/i18n";

const navigation = [
  { href: "/#category-title", path: "/report", key: "nav.report" },
  { href: "/tickets", path: "/tickets", key: "nav.tickets" },
  { href: "/player", path: "/player", key: "nav.player" },
] as const;

export function CitizenHeader() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const { locale, setLocale, t } = useI18n();

  const links = navigation.map((item) => (
    <Link
      key={item.href}
      href={item.href}
      aria-current={pathname === item.path || pathname.startsWith(`${item.path}/`) ? "page" : undefined}
    >
      {t(item.key)}
    </Link>
  ));

  return (
    <header className="site-header">
      <Link className="brand" href="/" aria-label="CivicPin">Civic<span>Pin</span></Link>
      <nav className="desktop-navigation" aria-label={t("nav.menu")}>
        {links}
      </nav>
      <div className="header-utility">
        {user && (
          <>
            <span className="account-email">{user.phone}</span>
            <button className="link-button" type="button" onClick={() => void signOut()}>{t("nav.logout")}</button>
          </>
        )}
        <label className="language-picker">
          <span>{t("language.label")}</span>
          <select value={locale} onChange={(event) => setLocale(event.target.value as Locale)}>
            {LOCALES.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <details className="mobile-menu">
          <summary aria-label={t("nav.menu")}>{t("nav.menu")}</summary>
          <nav aria-label={t("nav.menu")}>
            {links}
            {user && <button className="link-button" type="button" onClick={() => void signOut()}>{t("nav.logout")}</button>}
          </nav>
        </details>
      </div>
    </header>
  );
}

export function CitizenFooter() {
  const { t } = useI18n();
  return (
    <footer className="site-footer page-width">
      <section aria-labelledby="footer-service"><h2 id="footer-service">CivicPin</h2><p>{t("footer.service")}</p></section>
      <section aria-labelledby="footer-policy"><h2 id="footer-policy">Notice</h2><p>{t("footer.notice")}</p></section>
      <section aria-labelledby="footer-contact"><h2 id="footer-contact">Emergency</h2><p>{t("footer.emergency")}</p></section>
      <section aria-labelledby="footer-accessibility"><h2 id="footer-accessibility">Accessibility</h2><p>{t("footer.accessibility")}</p></section>
      <p className="copyright">© 2026 CivicPin</p>
    </footer>
  );
}
