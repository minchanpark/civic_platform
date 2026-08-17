"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useState } from "react";
import { CitizenFooter, CitizenHeader } from "@/components/citizen-shell";
import { useAuth } from "@/components/auth-provider";
import { getSupabaseClient } from "@/lib/supabase/client";
import { useI18n } from "@/components/i18n-provider";
import { REPORT_CATEGORIES, ISSUE_STATUSES, district as findDistrict, type IssueStatus, type ReportCategory } from "@/lib/issues";

const CATEGORY_ICONS: Record<ReportCategory, ReactNode> = {
  public_utility: <>
    <path d="M23 7C16 17 12 24 12 32a11 11 0 0 0 22 0c0-8-4-15-11-25Z" />
    <path d="m24 20-7 11h7l-3 11 11-15h-7l3-7" />
    <path d="M40 24v10a9 9 0 0 0 9 9h3" /><rect x="46" y="37" width="10" height="15" rx="3" /><path d="M49 37v-5m4 5v-5" />
  </>,
  road_obstruction: <>
    <path d="m32 8 14 42H18L32 8Z" /><path d="M25 27h14M22 37h20M14 50h36" />
  </>,
  streetlight_failure: <>
    <path d="M19 54V20a10 10 0 0 1 20 0v2" /><path d="M35 22h14l-2 8H37l-2-8Z" /><path d="M13 54h38M30 43h19M30 48h19M30 53h19" />
  </>,
  abandoned_vehicle: <>
    <path d="m14 39 5-13a6 6 0 0 1 6-4h14a6 6 0 0 1 6 4l5 13" /><path d="M12 39h40v10H12V39Z" /><path d="M18 49v5m28-5v5M18 42h5m18 0h5M27 27l5 5-4 4 7 3" />
  </>,
  road_sidewalk: <>
    <path d="M19 56 27 8m18 48L37 8M10 56h44" /><path d="m32 18-4 8 6 5-5 8 6 6-3 11" /><path d="M18 28h6m16 0h6" />
  </>,
  bus_issue: <>
    <rect x="15" y="8" width="34" height="44" rx="6" /><path d="M20 14h24v18H20V14ZM15 37h34M22 43h4m12 0h4M21 52v4m22-4v4" /><circle cx="24" cy="48" r="2" /><circle cx="40" cy="48" r="2" />
  </>,
  traffic_safety: <>
    <circle cx="26" cy="20" r="11" /><path d="M26 31v25M12 56h40M38 56l-5-18m17 18-5-18M39 44h5M41 50h5" />
  </>,
  other: <>
    <circle cx="17" cy="32" r="4" /><circle cx="32" cy="32" r="4" /><circle cx="47" cy="32" r="4" />
  </>,
};

const emptyCounts = (): Record<IssueStatus, number> => ({
  received: 0,
  viewed: 0,
  in_progress: 0,
  on_hold: 0,
  completed: 0,
});

export default function Home() {
  const { loading, user } = useAuth();
  const citizenUser = user?.phone && user.phone_confirmed_at ? user : null;
  const { t } = useI18n();
  const userId = citizenUser?.id;
  const [lockedDistrict, setLockedDistrict] = useState("");
  const [overview, setOverview] = useState<{ userId: string; counts: Record<IssueStatus, number>; message: string }>({
    userId: "",
    counts: emptyCounts(),
    message: "",
  });
  const counts = overview.userId === userId ? overview.counts : emptyCounts();
  const statusMessage = overview.userId === userId ? overview.message : "";

  useEffect(() => {
    const district = findDistrict(new URLSearchParams(window.location.search).get("district") ?? "");
    if (!district) return;
    const frame = window.requestAnimationFrame(() => setLockedDistrict(district.id));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!userId) return;
    const client = getSupabaseClient();
    if (!client) return;
    let active = true;
    let timer = 0;

    const refresh = async () => {
      const { data, error } = await client.from("issues").select("status");
      if (!active) return;
      if (error) {
        setOverview((current) => ({
          userId,
          counts: current.userId === userId ? current.counts : emptyCounts(),
          message: t("home.refreshError"),
        }));
      } else {
        const next = emptyCounts();
        data.forEach(({ status }) => {
          if (ISSUE_STATUSES.includes(status as IssueStatus)) next[status as IssueStatus] += 1;
        });
        setOverview({ userId, counts: next, message: "" });
      }
      timer = window.setTimeout(refresh, 3000);
    };

    void refresh();
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [t, userId]);

  return (
    <main className="citizen-page">
      <CitizenHeader />

      <section className="hero page-width">
        <p className="eyebrow">TAOYUAN CIVIC SERVICE</p>
        <h1>{t("home.heroTitle")}</h1>
        <p className="hero-copy">{t("home.heroCopy")}</p>
      </section>

      <section className="section page-width" aria-labelledby="category-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">REPORT BY CATEGORY</p>
            <h2 id="category-title">{t("home.categoryTitle")}</h2>
          </div>
          <p>{t("home.categoryHelp")}</p>
        </div>
        <div className="category-grid">
          {REPORT_CATEGORIES.map((category) => (
            <Link className={`category-card category-${category.tone}`} href={`/report?category=${category.id}${lockedDistrict ? `&district=${lockedDistrict}` : ""}`} key={category.id}>
              <span className="category-icon" aria-hidden="true">
                <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  {CATEGORY_ICONS[category.id]}
                </svg>
              </span>
              <strong>{t(`category.${category.id}`)}</strong>
            </Link>
          ))}
        </div>
      </section>

      <section className="section status-section" aria-labelledby="my-status-title">
        <div className="page-width">
          <div className="section-heading light">
            <div>
              <p className="eyebrow">MY REPORTS</p>
              <h2 id="my-status-title">{t("home.myStatus")}</h2>
            </div>
            {citizenUser && <p>{citizenUser.phone} · {t("home.refresh")}</p>}
          </div>

          {loading ? (
            <p className="empty-state" role="status">{t("home.loading")}</p>
          ) : citizenUser ? (
            <>
              <div className="status-grid">
                {ISSUE_STATUSES.map((status) => (
                  <div className={`status-card status-${status}`} key={status}>
                    <span>{t(`status.${status}`)}</span>
                    <strong>{counts[status]}</strong>
                    <small>{t("common.items")}</small>
                  </div>
                ))}
              </div>
              <p className="form-message" role="status" aria-live="polite">{statusMessage}</p>
              <Link className="button secondary" href="/tickets">{t("home.checkTickets")}</Link>
            </>
          ) : (
            <Link className="button secondary" href="/tickets">{t("home.checkTickets")}</Link>
          )}
        </div>
      </section>

      <CitizenFooter />
    </main>
  );
}
