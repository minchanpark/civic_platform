"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CitizenFooter, CitizenHeader } from "@/components/citizen-shell";
import { IssueMap } from "@/components/issue-map";
import { PhoneAccessForm } from "@/components/phone-access-form";
import { ProtectedPhoto } from "@/components/protected-photo";
import { useAuth } from "@/components/auth-provider";
import { useI18n } from "@/components/i18n-provider";
import { getSupabaseClient } from "@/lib/supabase/client";
import {
  ISSUE_STATUSES,
  eventFromRow,
  issueFromRow,
  type Issue,
  type IssueEvent,
  type IssueEventRow,
  type IssueRow,
  type FieldStatus,
} from "@/lib/issues";

const formatTime = (value: string, locale: string) => new Intl.DateTimeFormat(locale === "zh-TW" ? "zh-TW" : locale === "vi" ? "vi-VN" : "en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Taipei",
}).format(new Date(value));

export default function TicketPage() {
  const { ticket: routeTicket } = useParams<{ ticket: string }>();
  const ticket = routeTicket.toUpperCase();
  const { loading: authLoading, session, user } = useAuth();
  const { locale, t } = useI18n();
  const citizenUser = user?.phone && user.phone_confirmed_at ? user : null;
  const userId = citizenUser?.id ?? "";
  const requestKey = `${userId}:${ticket}`;
  const [loadedFor, setLoadedFor] = useState("");
  const [loadedIssue, setLoadedIssue] = useState<Issue | null>(null);
  const [loadedEvents, setLoadedEvents] = useState<IssueEvent[]>([]);
  const [loadedFieldStatus, setLoadedFieldStatus] = useState<FieldStatus | null>(null);
  const [notice, setNotice] = useState({ key: "", message: "" });
  const ready = loadedFor === requestKey;
  const issue = ready ? loadedIssue : null;
  const message = notice.key === requestKey ? notice.message : "";
  const eventByStatus = new Map((ready ? loadedEvents : []).map((event) => [event.toStatus, event]));

  useEffect(() => {
    if (!userId) return;
    const client = getSupabaseClient();
    if (!client) return;
    let active = true;
    let timer = 0;

    const refresh = async () => {
      const { data: issueRow, error: issueError } = await client
        .from("issues")
        .select("id,ticket_number,reporter_id,submission_key,category,district_id,latitude,longitude,address,title,body,status,visibility,assigned_department,status_changed_at,created_at,updated_at")
        .eq("ticket_number", ticket)
        .maybeSingle();
      if (!active) return;
      if (issueError) {
        setNotice({ key: requestKey, message: t("tickets.detailError") });
        timer = window.setTimeout(refresh, 3000);
        return;
      }
      if (!issueRow) {
        setLoadedIssue(null);
        setLoadedEvents([]);
        setLoadedFor(requestKey);
        setNotice({ key: requestKey, message: t("tickets.unavailable") });
        return;
      }

      const nextIssue = issueFromRow(issueRow as IssueRow);
      setLoadedIssue(nextIssue);
      setLoadedFor(requestKey);
      const [{ data: eventRows, error: eventError }, { data: fieldStatus, error: fieldError }] = await Promise.all([
        client
          .from("issue_status_events")
          .select("id,issue_id,from_status,to_status,reason,hold_reason,next_check_at,final_answer,created_at")
          .eq("issue_id", nextIssue.id)
          .order("created_at"),
        client.rpc("issue_field_status", { target_issue_id: nextIssue.id }),
      ]);
      if (!active) return;
      if (eventError || fieldError) {
        setNotice({ key: requestKey, message: t("tickets.historyError") });
      } else {
        setLoadedEvents((eventRows as IssueEventRow[]).map(eventFromRow));
        setLoadedFieldStatus(fieldStatus as FieldStatus);
        setNotice({ key: requestKey, message: "" });
      }
      timer = window.setTimeout(refresh, 3000);
    };

    void refresh();
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [requestKey, t, ticket, userId]);

  if (authLoading) return <main className="centered-page"><p role="status">{t("common.authLoading")}</p></main>;

  if (!citizenUser) {
    return (
      <main className="narrow-page">
        <Link className="back-link" href="/">← {t("common.backHome")}</Link>
        <div className="page-intro">
          <p className="eyebrow">PRIVATE TICKET</p>
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

      <div className="ticket-page page-width">
        <Link className="back-link" href="/tickets">← {t("tickets.back")}</Link>
        <p className="eyebrow">TICKET {ticket}</p>
        {!ready ? (
          <p className="empty-state" role="status">{t("tickets.loading")}</p>
        ) : issue ? (
          <>
            <section className="ticket-hero" aria-labelledby="ticket-title">
              <div>
                <span className={`status-pill status-${issue.status}`}>{t(`status.${issue.status}`)}</span>
                <h1 id="ticket-title">{issue.title}</h1>
                <p>{issue.ticketNumber} · {t(`category.${issue.category}`)}</p>
              </div>
              <div className="live-indicator"><span aria-hidden="true" />{t("tickets.autoRefresh")}</div>
            </section>

            {loadedFieldStatus && (
              <p className="selection-note" role="status">
                {t("tickets.adminStatus")}: {t(`status.${issue.status}`)} · {t("tickets.fieldStatus")}: {t(`field.${loadedFieldStatus}`)}
              </p>
            )}

            {issue.status === "completed" && loadedFieldStatus !== "resolved_confirmed" && (
              <section className="recurrence-cta" aria-labelledby="recurrence-title">
                <div>
                  <h2 id="recurrence-title">{t("tickets.recurrenceTitle")}</h2>
                  <p>{t("tickets.recurrenceHelp")}</p>
                </div>
                <Link className="button primary" href={`/report?mode=recurrence&source=${encodeURIComponent(issue.id)}&category=${issue.category}&district=${issue.districtId}`}>{t("tickets.recurrenceAction")}</Link>
              </section>
            )}

            <div className="ticket-grid">
              <section className="panel" aria-labelledby="progress-title">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">PROGRESS</p>
                    <h2 id="progress-title">{t("tickets.progress")}</h2>
                  </div>
                  <span>{t("tickets.current")} {t(`status.${issue.status}`)}</span>
                </div>
                <ol className="timeline">
                  {ISSUE_STATUSES.map((status) => {
                    const event = eventByStatus.get(status);
                    return (
                      <li className={event ? "done" : ""} key={status}>
                        <span className="timeline-dot" aria-hidden="true" />
                        <div>
                          <strong>{t(`status.${status}`)}</strong>
                          <p>{event ? formatTime(event.createdAt, locale) : t("tickets.notYet")}</p>
                          {event?.holdReason && <p>{t("tickets.holdReason")}: {event.holdReason}</p>}
                          {event?.nextCheckAt && <p>{t("tickets.nextCheck")}: {formatTime(event.nextCheckAt, locale)}</p>}
                          {event?.finalAnswer && <blockquote>{event.finalAnswer}</blockquote>}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </section>

              <section className="panel issue-summary" aria-labelledby="content-title">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">REPORT</p>
                    <h2 id="content-title">{t("tickets.reportContent")}</h2>
                  </div>
                  <span>{formatTime(issue.createdAt, locale)}</span>
                </div>
                <p className="issue-body">{issue.body}</p>
                {session && <ProtectedPhoto issueId={issue.id} accessToken={session.access_token} alt={`${issue.title} ${t("tickets.photoAlt")}`} loadingText={t("tickets.photoLoading")} errorText={t("tickets.photoError")} />}
                <IssueMap
                  pins={[{ id: issue.id, latitude: issue.latitude, longitude: issue.longitude, status: issue.status, category: issue.category, label: issue.title }]}
                  ariaLabel={t("tickets.mapAria")}
                />
                <p className="coordinate-note location-summary">
                  <span>{t("tickets.address")}: {issue.address ?? t("tickets.addressUnavailable")}</span>
                  <span>{t("tickets.location")}: {issue.latitude.toFixed(5)}, {issue.longitude.toFixed(5)}</span>
                </p>
              </section>
            </div>
            {loadedFieldStatus === "resolved_confirmed" && session && (
              <section className="panel resolution-result" aria-labelledby="resolution-result-title">
                <h2 id="resolution-result-title">{t("tickets.resolutionTitle")}</h2>
                <p>{t("tickets.resolutionHelp")}</p>
                <ProtectedPhoto issueId={issue.id} accessToken={session.access_token} kind="resolution" alt={`${issue.title} ${t("tickets.resolutionTitle")}`} loadingText={t("tickets.photoLoading")} errorText={t("tickets.photoError")} />
              </section>
            )}
          </>
        ) : (
          <section className="empty-state">
            <h1>{t("tickets.unavailable")}</h1>
            <p>{t("tickets.unavailableHelp")}</p>
            <Link className="button primary" href="/#category-title">{t("tickets.new")}</Link>
          </section>
        )}
        <p className="form-message" role="status" aria-live="polite">{message}</p>
      </div>
      <CitizenFooter />
    </main>
  );
}
