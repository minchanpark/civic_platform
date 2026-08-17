"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CitizenFooter, CitizenHeader } from "@/components/citizen-shell";
import { PhoneAccessForm } from "@/components/phone-access-form";
import { useAuth } from "@/components/auth-provider";
import { useI18n } from "@/components/i18n-provider";
import { getSupabaseClient } from "@/lib/supabase/client";
import { ISSUE_STATUSES, issueFromRow, type Issue, type IssueRow, type IssueStatus } from "@/lib/issues";

const formatTime = (value: string, locale: string) => new Intl.DateTimeFormat(locale === "zh-TW" ? "zh-TW" : locale === "vi" ? "vi-VN" : "en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Taipei",
}).format(new Date(value));

export default function TicketsPage() {
  const { loading: authLoading, user } = useAuth();
  const { locale, t } = useI18n();
  const citizenUser = user?.phone && user.phone_confirmed_at ? user : null;
  const userId = citizenUser?.id ?? "";
  const [result, setResult] = useState<{ userId: string; issues: Issue[]; message: string; loaded: boolean }>({
    userId: "",
    issues: [],
    message: "",
    loaded: false,
  });
  const [statusFilter, setStatusFilter] = useState<IssueStatus | "all">("all");
  const ready = result.userId === userId && result.loaded;
  const issues = ready ? result.issues : [];
  const visibleIssues = statusFilter === "all" ? issues : issues.filter((issue) => issue.status === statusFilter);
  const statusCount = (status: IssueStatus) => issues.filter((issue) => issue.status === status).length;

  useEffect(() => {
    if (!userId) return;
    const client = getSupabaseClient();
    if (!client) return;
    let active = true;
    let timer = 0;

    const refresh = async () => {
      const { data, error } = await client
        .from("issues")
        .select("id,ticket_number,reporter_id,submission_key,category,district_id,latitude,longitude,title,body,status,visibility,assigned_department,status_changed_at,created_at,updated_at")
        .order("created_at", { ascending: false });
      if (!active) return;
      setResult((current) => ({
        userId,
        issues: error ? (current.userId === userId ? current.issues : []) : (data as IssueRow[]).map(issueFromRow),
        message: error ? t("tickets.listError") : "",
        loaded: error ? current.userId === userId && current.loaded : true,
      }));
      timer = window.setTimeout(refresh, 3000);
    };

    void refresh();
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [t, userId]);

  if (authLoading) return <main className="centered-page"><p role="status">{t("common.authLoading")}</p></main>;

  if (!citizenUser) {
    return (
      <main className="narrow-page">
        <Link className="back-link" href="/">← {t("common.backHome")}</Link>
        <div className="page-intro">
          <p className="eyebrow">MY REPORTS</p>
          <h1>{t("tickets.title")}</h1>
          <p>{t("tickets.private")}</p>
        </div>
        <PhoneAccessForm />
      </main>
    );
  }

  return (
    <main className="citizen-page">
      <CitizenHeader />

      <div className="tickets-page page-width">
        <Link className="back-link" href="/">← {t("common.backHome")}</Link>
        <div className="section-heading">
          <div>
            <p className="eyebrow">MY REPORTS</p>
            <h1>{t("tickets.title")}</h1>
          </div>
          <Link className="button primary" href="/#category-title">{t("tickets.new")}</Link>
        </div>

        {!ready ? (
          <p className="empty-state" role="status">{t("tickets.loading")}</p>
        ) : issues.length ? (
          <>
            <div className="ticket-status-tabs" role="tablist" aria-label={t("tickets.filterLabel")}>
              <button type="button" role="tab" aria-selected={statusFilter === "all"} aria-controls="ticket-status-panel" onClick={() => setStatusFilter("all")}>
                {t("tickets.allStatuses")} <span>{issues.length}</span>
              </button>
              {ISSUE_STATUSES.map((status) => (
                <button key={status} type="button" role="tab" aria-selected={statusFilter === status} aria-controls="ticket-status-panel" onClick={() => setStatusFilter(status)}>
                  {t(`status.${status}`)} <span>{statusCount(status)}</span>
                </button>
              ))}
            </div>
            <div id="ticket-status-panel" role="tabpanel">
              {visibleIssues.length ? (
                <ul className="ticket-list">
                  {visibleIssues.map((issue) => (
                    <li key={issue.id}>
                      <Link href={`/tickets/${encodeURIComponent(issue.ticketNumber)}`}>
                        <span className={`status-pill status-${issue.status}`}>{t(`status.${issue.status}`)}</span>
                        <strong>{issue.title}</strong>
                        <span>{issue.ticketNumber} · {t(`category.${issue.category}`)}</span>
                        <time dateTime={issue.statusChangedAt}>{formatTime(issue.statusChangedAt, locale)}</time>
                        <span className="ticket-arrow" aria-hidden="true">→</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : <p className="empty-state">{t("tickets.noStatus")}</p>}
            </div>
          </>
        ) : (
          <section className="empty-state">
            <h2>{t("tickets.empty")}</h2>
            <Link className="button primary" href="/#category-title">{t("tickets.new")}</Link>
          </section>
        )}
        <p className="form-message" role="status" aria-live="polite">{result.userId === userId ? result.message : ""}</p>
      </div>
      <CitizenFooter />
    </main>
  );
}
