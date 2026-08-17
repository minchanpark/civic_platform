"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AdminNumberForm } from "@/components/admin-access-forms";
import { AdminEmailOtpForm } from "@/components/email-otp-form";
import { IssueMap, type MapViewport } from "@/components/issue-map";
import { ProtectedPhoto } from "@/components/protected-photo";
import { useAuth } from "@/components/auth-provider";
import { useI18n } from "@/components/i18n-provider";
import {
  adminAiReasonLabel,
  adminAgeGroupLabel,
  adminCategoryLabel,
  adminDepartmentLabel,
  adminFieldLabel,
  adminGenderLabel,
  adminRiskLabel,
  adminStatusLabel,
  adminText,
  detectAdminLocale,
  type AdminLocale,
  type AdminText,
} from "@/lib/admin-i18n";
import { getSupabaseClient } from "@/lib/supabase/client";
import {
  DEPARTMENTS,
  DISTRICTS,
  ISSUE_CATEGORIES,
  ISSUE_STATUSES,
  district as findDistrict,
  issueCategory,
  type Department,
  type CitizenAgeGroup,
  type CitizenGender,
  type FieldStatus,
  type Issue,
  type IssueEvent,
  type IssueRow,
  type IssueStatus,
} from "@/lib/issues";

type AdminIssue = Omit<Issue, "reporterId" | "submissionKey" | "body">;
type AdminIssueRow = Omit<IssueRow, "reporter_id" | "submission_key" | "body">;
type AdminListIssueRow = AdminIssueRow & { effective_risk: number | null; field_status: FieldStatus; recurrence_count: number; urgent: boolean; problem_spot_id: string; issue_count: number; problem_spot: boolean };
type AdminListIssue = AdminIssue & { effectiveRisk: number | null; fieldStatus: FieldStatus; recurrenceCount: number; urgent: boolean; problemSpotId: string; issueCount: number; problemSpot: boolean };
type AdminDetailIssue = Omit<Issue, "reporterId" | "submissionKey"> & { metricValid: boolean; metricExclusionReason: string | null };
type AdminDetailIssueRow = Omit<IssueRow, "reporter_id" | "submission_key"> & { metric_valid: boolean; metric_exclusion_reason: string | null };
type AdminEvent = Omit<IssueEvent, "issueId">;
type AdminRisk = {
  assessmentStatus: "evaluated" | "evaluation_required";
  aiLevel: number | null;
  effectiveLevel: number | null;
  source: "ai" | "manager" | "evaluation_required";
  riskReasonCodes: string[];
  filterReasonCodes: string[];
  inputScope: string[];
  model: string | null;
  modelVersion: string | null;
  assessedAt: string;
  history: Array<{ id: string; fromLevel: number | null; toLevel: number; reason: string; createdAt: string }>;
};
type AdminDetailPayload = {
  issue: AdminDetailIssueRow;
  contact: {
    email: string;
    realName: string | null;
    gender: CitizenGender | null;
    ageGroup: CitizenAgeGroup | null;
    cellPhone: string | null;
    lineId: string | null;
    contactEmail: string | null;
  };
  field: { status: FieldStatus; recurrenceCount: number; urgent: boolean; issueCount: number; problemSpot: boolean };
  recurrenceCandidate: { status: "pending" | "approved" | "rejected"; reason: string; evidenceEligible: boolean } | null;
  resolutionEvidence: { inspectionNote: string; createdAt: string } | null;
  risk: AdminRisk;
  aiAssistance: {
    id: string; status: "pending" | "running" | "succeeded" | "failed"; attempts: number;
    summary: string | null; answerDraft: string | null; model: string | null;
    modelVersion: string | null; failureCode: string | null; createdAt: string; updatedAt: string;
  } | null;
  events: AdminEvent[];
};
type AdminDetail = Omit<AdminDetailPayload, "issue"> & { issue: AdminDetailIssue };
type StaffAccessState = { membershipActive: boolean; numberVerified: boolean; authorized: boolean };
type NotificationSummary = { pending: number; failed: number; sent: number; aiFailed: number; aiAssistFailed: number };
const isAdminListIssue = (issue: AdminIssue | AdminListIssue): issue is AdminListIssue => "effectiveRisk" in issue;

const formatTime = (value: string, locale: AdminLocale) => new Intl.DateTimeFormat(locale === "zh-TW" ? "zh-TW" : "en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Taipei",
}).format(new Date(value));

function AdminLanguageSwitcher({ locale, onChange }: { locale: AdminLocale; onChange: (locale: AdminLocale) => void }) {
  const label = adminText(locale, "Language");
  return (
    <div className="admin-language-switcher" role="group" aria-label={label}>
      <button type="button" aria-pressed={locale === "en"} onClick={() => onChange("en")}>English</button>
      <button type="button" aria-pressed={locale === "zh-TW"} onClick={() => onChange("zh-TW")}>繁體中文</button>
    </div>
  );
}

const issueFromAdminRow = (row: AdminIssueRow): AdminIssue => ({
  id: row.id,
  ticketNumber: row.ticket_number,
  category: row.category,
  districtId: row.district_id,
  latitude: row.latitude,
  longitude: row.longitude,
  address: row.address,
  title: row.title,
  status: row.status,
  visibility: row.visibility,
  assignedDepartment: row.assigned_department,
  statusChangedAt: row.status_changed_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export default function AdminPage() {
  const { loading: authLoading, session, user, signOut } = useAuth();
  const { locale: citizenLocale } = useI18n();
  const [adminLocale, setAdminLocale] = useState<AdminLocale>("en");
  const t = useCallback((key: AdminText) => adminText(adminLocale, key), [adminLocale]);
  const userId = user?.id ?? "";
  const accessToken = session?.access_token ?? "";
  const [accessCheck, setAccessCheck] = useState<{ userId: string; token: string; value: StaffAccessState | null; error: boolean }>({
    userId: "",
    token: "",
    value: null,
    error: false,
  });
  const access = accessCheck.userId === userId && accessCheck.token === accessToken ? accessCheck.value : null;
  const accessError = accessCheck.userId === userId && accessCheck.token === accessToken && accessCheck.error;
  const staff = access?.authorized ?? false;
  const [mapIssues, setMapIssues] = useState<AdminListIssue[]>([]);
  const [mapViewport, setMapViewport] = useState<MapViewport | null>(null);
  const [mapTotal, setMapTotal] = useState(0);
  const [mapTruncated, setMapTruncated] = useState(false);
  const [statusCounts, setStatusCounts] = useState<Record<IssueStatus, number>>({
    received: 0, viewed: 0, in_progress: 0, on_hold: 0, completed: 0,
  });
  const [statusFilter, setStatusFilter] = useState<IssueStatus | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [districtFilter, setDistrictFilter] = useState("all");
  const [adminView, setAdminView] = useState<"map" | "list">("map");
  const [listSort, setListSort] = useState<"latest" | "risk" | "recurrence">("latest");
  const [listPage, setListPage] = useState(1);
  const [riskFilter, setRiskFilter] = useState("all");
  const [recurrenceOnly, setRecurrenceOnly] = useState(false);
  const [problemSpotOnly, setProblemSpotOnly] = useState(false);
  const [listResult, setListResult] = useState<{ items: AdminListIssue[]; total: number }>({ items: [], total: 0 });
  const [notificationSummary, setNotificationSummary] = useState<NotificationSummary>({ pending: 0, failed: 0, sent: 0, aiFailed: 0, aiAssistFailed: 0 });
  const [selected, setSelected] = useState<AdminDetail | null>(null);
  const [department, setDepartment] = useState<Department>("environmental_services");
  const [finalAnswer, setFinalAnswer] = useState("");
  const [holdReason, setHoldReason] = useState("");
  const [nextCheckAt, setNextCheckAt] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [riskLevel, setRiskLevel] = useState("");
  const [riskReason, setRiskReason] = useState("");
  const [resolutionPhoto, setResolutionPhoto] = useState<File | null>(null);
  const [inspectionNote, setInspectionNote] = useState("");
  const [metricExclusionReason, setMetricExclusionReason] = useState("duplicate");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [textScale, setTextScale] = useState("100");
  const [highContrast, setHighContrast] = useState(false);
  const closeButton = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const riskChangeKey = useRef("");
  const selectedId = selected?.issue.id;

  useEffect(() => {
    const saved = window.localStorage.getItem("civicpin-admin-locale");
    const locale = saved === "en" || saved === "zh-TW" ? saved : detectAdminLocale(window.navigator.language);
    queueMicrotask(() => setAdminLocale(locale));
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { document.documentElement.lang = adminLocale; }, 0);
    return () => {
      window.clearTimeout(timer);
      document.documentElement.lang = citizenLocale;
    };
  }, [adminLocale, citizenLocale]);

  const changeAdminLocale = (locale: AdminLocale) => {
    window.localStorage.setItem("civicpin-admin-locale", locale);
    setAdminLocale(locale);
  };

  const loadAccess = useCallback(async () => {
    if (!userId || !accessToken) return;
    const client = getSupabaseClient();
    if (!client) {
      queueMicrotask(() => setAccessCheck({ userId, token: accessToken, value: null, error: true }));
      return;
    }
    const { data, error } = await client.rpc("staff_access_state");
    setAccessCheck({ userId, token: accessToken, value: error ? null : data as StaffAccessState, error: Boolean(error) });
    if (error) setMessage(t("Could not verify admin access."));
  }, [accessToken, t, userId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadAccess(), 0);
    return () => window.clearTimeout(timer);
  }, [loadAccess]);

  useEffect(() => {
    if (!staff) return;
    const client = getSupabaseClient();
    if (!client) return;
    let active = true;
    let timer = 0;

    const refresh = async () => {
      const [counts, summary] = await Promise.all([
        client.rpc("staff_issue_status_counts"),
        client.rpc("notification_outbox_summary"),
      ]);
      if (!active) return;
      if (counts.error) setMessage(t("Could not load complaint status. Retrying shortly."));
      else {
        setStatusCounts(counts.data as Record<IssueStatus, number>);
        if (summary.data) setNotificationSummary(summary.data as NotificationSummary);
        setMessage("");
      }
      timer = window.setTimeout(refresh, 3000);
    };

    void refresh();
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [staff, t, userId]);

  useEffect(() => {
    if (!staff || adminView !== "list") return;
    const client = getSupabaseClient();
    if (!client) return;
    let active = true;
    const load = async () => {
      const { data, error } = await client.rpc("list_staff_issues", {
        target_status: statusFilter === "all" ? null : statusFilter,
        target_category: categoryFilter === "all" ? null : categoryFilter,
        target_district: districtFilter === "all" ? null : districtFilter,
        target_risk_level: riskFilter === "all" ? null : Number(riskFilter),
        target_recurrence_only: recurrenceOnly,
        target_problem_spot_only: problemSpotOnly,
        target_sort: listSort,
        target_limit: 50,
        target_offset: (listPage - 1) * 50,
      });
      if (!active) return;
      if (error || !data) return setMessage(t("Could not load the full list."));
      const result = data as { items: AdminListIssueRow[]; total: number };
      setListResult({
        total: Number(result.total),
        items: result.items.map((row) => ({
          ...issueFromAdminRow(row), effectiveRisk: row.effective_risk,
          fieldStatus: row.field_status, recurrenceCount: row.recurrence_count, urgent: row.urgent,
          problemSpotId: row.problem_spot_id, issueCount: row.issue_count, problemSpot: row.problem_spot,
        })),
      });
      setMessage("");
    };
    void load();
    const timer = window.setInterval(() => void load(), 3000);
    return () => { active = false; window.clearInterval(timer); };
  }, [adminView, categoryFilter, districtFilter, listPage, listSort, problemSpotOnly, recurrenceOnly, riskFilter, staff, statusFilter, t]);

  useEffect(() => {
    if (!staff || adminView !== "map" || !mapViewport) return;
    const client = getSupabaseClient();
    if (!client) return;
    let active = true;
    const load = async () => {
      const { data, error } = await client.rpc("list_staff_issue_map", {
        target_south: mapViewport.south, target_west: mapViewport.west,
        target_north: mapViewport.north, target_east: mapViewport.east,
        target_status: statusFilter === "all" ? null : statusFilter,
        target_category: categoryFilter === "all" ? null : categoryFilter,
        target_district: districtFilter === "all" ? null : districtFilter,
        target_risk_level: riskFilter === "all" ? null : Number(riskFilter),
        target_recurrence_only: recurrenceOnly,
        target_problem_spot_only: problemSpotOnly,
      });
      if (!active) return;
      if (error || !data) return setMessage(t("Could not load map complaints."));
      const result = data as { items: AdminListIssueRow[]; total: number; truncated: boolean };
      setMapIssues(result.items.map((row) => ({
        ...issueFromAdminRow(row), effectiveRisk: row.effective_risk,
        fieldStatus: row.field_status, recurrenceCount: row.recurrence_count, urgent: row.urgent,
        problemSpotId: row.problem_spot_id, issueCount: row.issue_count, problemSpot: row.problem_spot,
      })));
      setMapTotal(Number(result.total));
      setMapTruncated(Boolean(result.truncated));
      setMessage("");
    };
    void load();
    const timer = window.setInterval(() => void load(), 3000);
    return () => { active = false; window.clearInterval(timer); };
  }, [adminView, categoryFilter, districtFilter, mapViewport, problemSpotOnly, recurrenceOnly, riskFilter, staff, statusFilter, t]);

  useEffect(() => {
    if (!selectedId) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    const handleDialogKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelected(null);
        return;
      }
      if (event.key !== "Tab" || !dialog.current) return;
      const focusable = [...dialog.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      )];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleDialogKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleDialogKey);
      returnFocus.current?.focus();
    };
  }, [selectedId]);

  const pageSize = 50;
  const pageCount = Math.max(1, Math.ceil(listResult.total / pageSize));
  const totalStatusCount = Object.values(statusCounts).reduce((total, count) => total + count, 0);
  const displayedIssues: Array<AdminIssue | AdminListIssue> = adminView === "list" ? listResult.items : mapIssues;
  const mapMarkerIssues = [...mapIssues.reduce((markers, issue) => {
    const key = issue.problemSpot ? issue.problemSpotId : issue.id;
    if (!markers.has(key) || issue.id === selectedId) markers.set(key, issue);
    return markers;
  }, new Map<string, AdminListIssue>()).values()];
  const selectedDistrict = districtFilter === "all" ? undefined : findDistrict(districtFilter);

  const applyDetail = (payload: AdminDetailPayload) => {
    const detail: AdminDetail = {
      ...payload,
      issue: {
        ...issueFromAdminRow(payload.issue), body: payload.issue.body,
        metricValid: payload.issue.metric_valid,
        metricExclusionReason: payload.issue.metric_exclusion_reason,
      },
    };
    setSelected(detail);
    setMapIssues((current) => current.map((issue) => issue.id === detail.issue.id ? { ...issue, ...detail.issue } : issue));
    setDepartment(detail.issue.assignedDepartment ?? issueCategory(detail.issue.category)?.department ?? "environmental_services");
    setRiskLevel(detail.risk.effectiveLevel?.toString() ?? "");
  };

  const openIssue = async (issueId: string) => {
    const client = getSupabaseClient();
    if (!client || busy) return;
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setBusy(true);
    setMessage(t("Loading complaint details…"));
    const { data, error } = await client.rpc("acknowledge_issue", { target_issue_id: issueId });
    setBusy(false);
    if (error || !data) {
      setMessage(t("Could not load complaint details."));
      return;
    }
    applyDetail(data as AdminDetailPayload);
    setFinalAnswer("");
    setHoldReason("");
    setNextCheckAt("");
    setConfirmed(false);
    setRiskReason("");
    setResolutionPhoto(null);
    setInspectionNote("");
    riskChangeKey.current = "";
    setMessage(t("Complaint opened."));
  };

  const startIssue = async () => {
    const client = getSupabaseClient();
    if (!client || !selected || busy) return;
    setBusy(true);
    setMessage(t("Saving processing start…"));
    const { data, error } = await client.rpc("start_issue", {
      target_issue_id: selected.issue.id,
      target_department: department,
    });
    setBusy(false);
    if (error || !data) {
      setMessage(t("Could not start processing."));
      return;
    }
    applyDetail(data as AdminDetailPayload);
    setMessage(t("Changed to in progress."));
  };

  const dispatchNotifications = async () => {
    if (!session) return false;
    try {
      const response = await fetch("/api/notifications/dispatch", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      return response.ok;
    } catch {
      return false;
    }
  };

  const completeIssue = async () => {
    const client = getSupabaseClient();
    if (!client || !session || !selected || busy || !confirmed) return;
    setBusy(true);
    if (resolutionPhoto) {
      setMessage(t("Saving post-treatment evidence…"));
      const form = new FormData();
      form.set("photo", resolutionPhoto);
      form.set("inspectionNote", inspectionNote);
      try {
        const evidenceResponse = await fetch(`/api/admin/issues/${selected.issue.id}/resolution-evidence`, {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: form,
        });
        const evidence = await evidenceResponse.json() as AdminDetailPayload & { error?: string };
        if (!evidenceResponse.ok || !evidence.issue) {
          setBusy(false);
          setMessage(t("Could not save post-treatment evidence."));
          return;
        }
        applyDetail(evidence);
      } catch {
        setBusy(false);
        setMessage(t("Could not upload post-treatment evidence. Try again."));
        return;
      }
    }
    setMessage(t("Saving completion and response…"));
    const { data, error } = await client.rpc("complete_issue", {
      target_issue_id: selected.issue.id,
      target_final_answer: finalAnswer,
    });
    if (error || !data) {
      setBusy(false);
      setMessage(t("Could not complete the complaint."));
      return;
    }
    applyDetail(data as AdminDetailPayload);
    setConfirmed(false);
    setResolutionPhoto(null);
    setInspectionNote("");
    const dispatched = await dispatchNotifications();
    setMessage(dispatched ? t("Complaint completed and notification requested.") : t("Complaint completed; email is waiting for retry."));
    setBusy(false);
  };

  const holdIssue = async () => {
    const client = getSupabaseClient();
    if (!client || !selected || busy || !nextCheckAt) return;
    setBusy(true);
    setMessage(t("Saving hold reason and next review…"));
    const { data, error } = await client.rpc("hold_issue", {
      target_issue_id: selected.issue.id,
      target_reason: holdReason,
      target_next_check_at: new Date(nextCheckAt).toISOString(),
    });
    setBusy(false);
    if (error || !data) {
      setMessage(t("Could not put the complaint on hold."));
      return;
    }
    applyDetail(data as AdminDetailPayload);
    setMessage(t("Complaint put on hold with the next review saved."));
  };

  const resumeIssue = async () => {
    const client = getSupabaseClient();
    if (!client || !selected || busy) return;
    setBusy(true);
    setMessage(t("Resuming processing…"));
    const { data, error } = await client.rpc("resume_issue", { target_issue_id: selected.issue.id });
    setBusy(false);
    if (error || !data) {
      setMessage(t("Could not resume processing."));
      return;
    }
    applyDetail(data as AdminDetailPayload);
    setMessage(t("Complaint processing resumed."));
  };

  const reviewRecurrence = async (approved: boolean) => {
    const client = getSupabaseClient();
    if (!client || !selected || busy) return;
    setBusy(true);
    setMessage(approved ? t("Confirming recurrence…") : t("Dismissing recurrence candidate…"));
    const { data, error } = await client.rpc("review_recurrence", {
      target_issue_id: selected.issue.id,
      target_approved: approved,
    });
    setBusy(false);
    if (error || !data) {
      setMessage(t("Could not save recurrence review."));
      return;
    }
    applyDetail(data as AdminDetailPayload);
    setMessage(approved ? t("Confirmed recurrence and linked it to the problem spot.") : t("Recurrence candidate dismissed."));
  };

  const updateRisk = async () => {
    const client = getSupabaseClient();
    const nextLevel = Number(riskLevel);
    if (!client || !selected || busy || !Number.isInteger(nextLevel) || riskReason.trim().length < 10) return;
    if (!riskChangeKey.current) riskChangeKey.current = crypto.randomUUID();
    setBusy(true);
    setMessage(t("Saving risk change…"));
    const { data, error } = await client.rpc("override_issue_risk", {
      target_issue_id: selected.issue.id,
      target_risk_level: nextLevel,
      target_reason: riskReason,
      target_change_key: riskChangeKey.current,
    });
    setBusy(false);
    if (error || !data) {
      setMessage(t("Could not save risk change."));
      return;
    }
    riskChangeKey.current = "";
    setRiskReason("");
    applyDetail(data as AdminDetailPayload);
    setMessage(t("Risk and change reason recorded."));
  };

  const updateMetricValidity = async (valid: boolean) => {
    const client = getSupabaseClient();
    if (!client || !selected || busy) return;
    setBusy(true);
    const { data, error } = await client.rpc("set_issue_metric_validity", {
      target_issue_id: selected.issue.id,
      target_valid: valid,
      target_reason: valid ? null : metricExclusionReason,
    });
    setBusy(false);
    if (error || !data) return setMessage(t("Could not change metric validity."));
    applyDetail(data as AdminDetailPayload);
    setMessage(valid ? t("Restored to public metrics.") : t("Excluded from public metrics with a reason."));
  };

  const requestAiAssistance = async () => {
    if (!session || !selected || busy) return;
    setBusy(true);
    setMessage(t("Saving AI summary and response draft job…"));
    try {
      const response = await fetch(`/api/admin/issues/${selected.issue.id}/ai-assistance`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ requestKey: crypto.randomUUID() }),
      });
      const payload = await response.json() as AdminDetailPayload & { error?: string };
      if (!response.ok || !payload.issue) setMessage(t("Could not save the AI job."));
      else {
        applyDetail(payload);
        setMessage(payload.aiAssistance?.status === "succeeded"
          ? t("AI summary and response draft generated. Manager review is required.")
          : t("AI job saved. Failed jobs retry automatically."));
      }
    } catch {
      setMessage(t("AI job request failed. Try again."));
    }
    setBusy(false);
  };

  const retryNotifications = async () => {
    if (busy) return;
    setBusy(true);
    setMessage(t("Checking queued email…"));
    const dispatched = await dispatchNotifications();
    setMessage(dispatched ? t("Available email processed.") : t("Could not start email delivery. Try again shortly."));
    setBusy(false);
  };

  if (authLoading) return <main className="centered-page admin-page" aria-busy="true"><AdminLanguageSwitcher locale={adminLocale} onChange={changeAdminLocale} /><p role="status">{t("Checking sign-in status…")}</p></main>;

  if (!user) {
    return (
      <main className="narrow-page admin-page">
        <AdminLanguageSwitcher locale={adminLocale} onChange={changeAdminLocale} />
        <div className="page-intro">
          <p className="eyebrow">STAFF ONLY</p>
          <h1>{t("Admin sign in")}</h1>
          <p>{t("Enter the code sent to your registered admin email.")}</p>
        </div>
        <AdminEmailOtpForm adminLocale={adminLocale} />
      </main>
    );
  }

  if (!session) return <main className="centered-page admin-page" aria-busy="true"><AdminLanguageSwitcher locale={adminLocale} onChange={changeAdminLocale} /><p role="status">{t("Checking admin access…")}</p></main>;

  if (accessError) {
    return (
      <main className="centered-page admin-page">
        <AdminLanguageSwitcher locale={adminLocale} onChange={changeAdminLocale} />
        <div className="empty-state">
          <p className="eyebrow">CONNECTION ERROR</p>
          <h1>{t("Could not verify admin access.")}</h1>
          <p>{t("Check your network connection and sign in again.")}</p>
          <button className="button primary" type="button" onClick={() => void signOut()}>{t("Sign in again")}</button>
        </div>
      </main>
    );
  }

  if (access === null) return <main className="centered-page admin-page" aria-busy="true"><AdminLanguageSwitcher locale={adminLocale} onChange={changeAdminLocale} /><p role="status">{t("Checking admin access…")}</p></main>;

  if (!access.membershipActive) {
    return (
      <main className="centered-page admin-page">
        <AdminLanguageSwitcher locale={adminLocale} onChange={changeAdminLocale} />
        <div className="empty-state">
          <p className="eyebrow">ACCESS DENIED</p>
          <h1>{t("Admin access is unavailable.")}</h1>
          <p>{t("This account does not have an active admin membership.")}</p>
          <button className="button primary" type="button" onClick={() => void signOut()}>{t("Use another account")}</button>
        </div>
      </main>
    );
  }

  if (!access.numberVerified) {
    return <main className="narrow-page admin-page"><AdminLanguageSwitcher locale={adminLocale} onChange={changeAdminLocale} /><AdminNumberForm session={session} locale={adminLocale} onSuccess={() => void loadAccess()} /></main>;
  }

  if (!access.authorized) {
    return <main className="centered-page admin-page"><AdminLanguageSwitcher locale={adminLocale} onChange={changeAdminLocale} /><div className="empty-state"><h1>{t("Could not verify the admin session.")}</h1><button className="button primary" type="button" onClick={() => void signOut()}>{t("Sign in again")}</button></div></main>;
  }

  const completedEvent = selected?.events.find((event) => event.toStatus === "completed");
  const heldEvent = selected?.events.findLast((event) => event.toStatus === "on_hold");

  return (
    <main className="admin-page" data-text-scale={textScale} data-high-contrast={highContrast || undefined} aria-busy={busy}>
      <header className="admin-header">
        <Link className="brand" href="/admin">Civic<span>Pin</span> <small>ADMIN</small></Link>
        <div className="account-actions">
          <AdminLanguageSwitcher locale={adminLocale} onChange={changeAdminLocale} />
          <span>{user.email}</span>
          <label className="display-scale">
            {t("Text size")}
            <select value={textScale} onChange={(event) => setTextScale(event.target.value)}>
              <option value="90">90%</option><option value="100">100%</option><option value="110">110%</option><option value="130">130%</option><option value="150">150%</option>
            </select>
          </label>
          <button className="button tertiary contrast-toggle" type="button" aria-pressed={highContrast} onClick={() => setHighContrast((value) => !value)}>{t("High contrast")}</button>
          <button className="link-button" type="button" onClick={() => void signOut()}>{t("Sign out")}</button>
        </div>
      </header>

      <section className="admin-toolbar" aria-labelledby="admin-title">
        <div>
          <p className="eyebrow">LIVE CIVIC MAP</p>
          <h1 id="admin-title">{t("Complaint management")}</h1>
        </div>
        <div className="filter-row">
          <label>
            {t("Status")}
            <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value as IssueStatus | "all"); setListPage(1); }}>
              <option value="all">{t("All statuses")}</option>
              {ISSUE_STATUSES.map((status) => <option key={status} value={status}>{adminStatusLabel(adminLocale, status)}</option>)}
            </select>
          </label>
          <label>
            {t("Category")}
            <select value={categoryFilter} onChange={(event) => { setCategoryFilter(event.target.value); setListPage(1); }}>
              <option value="all">{t("All categories")}</option>
              {ISSUE_CATEGORIES.map((category) => <option key={category.id} value={category.id}>{adminCategoryLabel(adminLocale, category.id)}</option>)}
            </select>
          </label>
          <label>
            {t("District")}
            <select value={districtFilter} onChange={(event) => { setDistrictFilter(event.target.value); setListPage(1); }}>
              <option value="all">{t("All districts")}</option>
              {DISTRICTS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
        </div>
      </section>

      <section className="admin-status-summary" aria-label={t("Complaints by administrative status")}>
        <button type="button" onClick={() => { setStatusFilter("all"); setListPage(1); }} aria-pressed={statusFilter === "all"}>
          <span>{t("All")}</span><strong>{totalStatusCount}</strong>
        </button>
        {ISSUE_STATUSES.map((status) => (
          <button type="button" key={status} onClick={() => { setStatusFilter(status); setListPage(1); }} aria-pressed={statusFilter === status}>
            <span>{adminStatusLabel(adminLocale, status)}</span><strong>{statusCounts[status]}</strong>
          </button>
        ))}
      </section>

      <div className="admin-view-controls" role="group" aria-label={t("Map view")}>
        <button type="button" className="button tertiary" aria-pressed={adminView === "map"} onClick={() => setAdminView("map")}>{t("Map view")}</button>
        <button type="button" className="button tertiary" aria-pressed={adminView === "list"} onClick={() => setAdminView("list")}>{t("Full list")}</button>
        <label>{t("Risk")}<select value={riskFilter} onChange={(event) => { setRiskFilter(event.target.value); setListPage(1); }}><option value="all">{t("All risks")}</option>{[5,4,3,2,1].map((level) => <option value={level} key={level}>{adminRiskLabel(adminLocale, level)}</option>)}</select></label>
        <label className="confirm-row"><input type="checkbox" checked={recurrenceOnly} onChange={(event) => { setRecurrenceOnly(event.target.checked); setListPage(1); }} />{t("Has recurrence")}</label>
        <label className="confirm-row"><input type="checkbox" checked={problemSpotOnly} onChange={(event) => { setProblemSpotOnly(event.target.checked); setListPage(1); }} />{t("Problem spots only")}</label>
        {adminView === "list" && <label>{t("Sort")}<select value={listSort} onChange={(event) => { setListSort(event.target.value as typeof listSort); setListPage(1); }}><option value="latest">{t("Newest first")}</option><option value="risk">{t("Highest risk first")}</option><option value="recurrence">{t("Most recurrences first")}</option></select></label>}
        <span className="notification-summary" aria-label={t("Automation status")}>{t("Email pending")} {notificationSummary.pending} · {t("failed")} {notificationSummary.failed} · {t("sent")} {notificationSummary.sent} · {t("risk retries exhausted")} {notificationSummary.aiFailed} · {t("AI assistance exhausted")} {notificationSummary.aiAssistFailed}</span>
        <button className="button tertiary" type="button" onClick={() => void retryNotifications()} disabled={busy || notificationSummary.pending + notificationSummary.failed === 0}>{t("Retry notifications")}</button>
      </div>

      <div className={`admin-workspace ${adminView === "list" ? "admin-workspace-list" : ""}`}>
        {adminView === "map" && <section className="admin-map" aria-label={t("Complaint map")}>
          <IssueMap
            pins={mapMarkerIssues.map((issue) => ({
              id: issue.id,
              latitude: issue.latitude,
              longitude: issue.longitude,
              status: issue.status,
              category: issue.category,
              urgent: issue.urgent,
              problemSpotCount: issue.problemSpot ? issue.issueCount : undefined,
              label: issue.problemSpot
                ? `${issue.urgent ? t("Urgent problem spot") : t("Problem spot")} · ${issue.issueCount} ${t("reports")} · ${adminCategoryLabel(adminLocale, issue.category)}`
                : `${issue.ticketNumber} ${issue.title}${issue.urgent ? ` · ${t("Urgent problem spot")}` : ""}`,
            }))}
            selectedId={selected?.issue.id}
            center={selectedDistrict}
            zoom={selectedDistrict ? 14 : 10}
            onPinSelect={(id) => void openIssue(id)}
            onViewportChange={setMapViewport}
            ariaLabel={t("All complaint PIN map")}
            palette="admin"
            currentLocation={{
              button: t("Go to current location"),
              locating: t("Finding current location…"),
              unavailable: t("Current location is unavailable. Check location permission."),
              outside: t("Current location is outside the Taoyuan service area."),
            }}
          />
        </section>}

        <aside className={`admin-list ${adminView === "list" ? "admin-list-full" : ""}`} aria-labelledby="issue-list-title">
          <div className="list-heading">
            <h2 id="issue-list-title">{t("Complaint list")}</h2>
            <span>{adminView === "list" ? listResult.total : mapTotal} {t("reports")}{mapTruncated && adminView === "map" ? ` · ${t("Zoom in to load more")}` : ""}</span>
          </div>
          {displayedIssues.length ? (
            <ul>
              {displayedIssues.map((issue) => (
                <li key={issue.id}>
                  <button type="button" onClick={() => void openIssue(issue.id)} disabled={busy}>
                    <span className={`status-dot status-${issue.status}`} aria-hidden="true" />
                    <span>
                      <strong>{issue.title}</strong>
                      <small>{issue.ticketNumber} · {adminCategoryLabel(adminLocale, issue.category)}</small>
                      {isAdminListIssue(issue) && <small>{t("Risk")} {issue.effectiveRisk ?? t("Evaluation required")} · {t("Recurrences")} {issue.recurrenceCount} {t("reports")}{issue.problemSpot ? ` · ${t("Problem spot")} ${issue.issueCount} ${t("reports")}` : ""}{issue.urgent ? ` · ${t("Urgent")}` : ""}</small>}
                    </span>
                    <time dateTime={issue.statusChangedAt}>{formatTime(issue.statusChangedAt, adminLocale)}</time>
                    <span className={`status-pill status-${issue.status}`}>{adminStatusLabel(adminLocale, issue.status)}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty-list">
              <p>{t("No complaints match these filters.")}</p>
              <button className="button tertiary" type="button" onClick={() => { setStatusFilter("all"); setCategoryFilter("all"); setDistrictFilter("all"); }}>{t("Reset filters")}</button>
            </div>
          )}
          {adminView === "list" && pageCount > 1 && <nav className="admin-pagination" aria-label={t("Complaint list pages")}><button type="button" className="button tertiary" disabled={listPage === 1} onClick={() => setListPage((page) => page - 1)}>{t("Previous")}</button><span aria-live="polite">{listPage} / {pageCount}</span><button type="button" className="button tertiary" disabled={listPage === pageCount} onClick={() => setListPage((page) => page + 1)}>{t("Next")}</button></nav>}
        </aside>
      </div>

      {selected && session && (
        <>
          <button className="sheet-backdrop" type="button" tabIndex={-1} onClick={() => setSelected(null)} aria-label={t("Close complaint details")} />
          <aside ref={dialog} className="admin-sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
            <div className="sheet-handle" aria-hidden="true" />
            <div className="sheet-header">
              <div>
                <span className={`status-pill status-${selected.issue.status}`}>{adminStatusLabel(adminLocale, selected.issue.status)}</span>
                <p>{selected.issue.ticketNumber} · {adminCategoryLabel(adminLocale, selected.issue.category)}</p>
                <h2 id="sheet-title">{selected.issue.title}</h2>
              </div>
              <button ref={closeButton} className="icon-button" type="button" onClick={() => setSelected(null)} aria-label={t("Close complaint details")}>×</button>
            </div>

            <div className="sheet-grid">
              <section>
                <h3>{t("Report details")}</h3>
                <p className="issue-body">{selected.issue.body}</p>
                <dl className="detail-list">
                  <div><dt>{t("Received at")}</dt><dd>{formatTime(selected.issue.createdAt, adminLocale)}</dd></div>
                  <div><dt>{t("Real name")}</dt><dd>{selected.contact.realName ?? t("Not provided")}</dd></div>
                  <div><dt>{t("Gender")}</dt><dd>{selected.contact.gender ? adminGenderLabel(adminLocale, selected.contact.gender) : t("Not provided")}</dd></div>
                  <div><dt>{t("Age group")}</dt><dd>{selected.contact.ageGroup ? adminAgeGroupLabel(adminLocale, selected.contact.ageGroup) : t("Not provided")}</dd></div>
                  <div><dt>{t("Cell phone")}</dt><dd>{selected.contact.cellPhone ?? t("Not provided")}</dd></div>
                  <div><dt>{t("LINE ID")}</dt><dd>{selected.contact.lineId ?? t("Not provided")}</dd></div>
                  <div><dt>{t("Contact email")}</dt><dd>{selected.contact.contactEmail ?? t("Not provided")}</dd></div>
                  <div><dt>{t("Verified account email")}</dt><dd>{selected.contact.email}</dd></div>
                  <div><dt>{t("Assigned department")}</dt><dd>{selected.issue.assignedDepartment ? adminDepartmentLabel(adminLocale, selected.issue.assignedDepartment) : t("Unassigned")}</dd></div>
                  <div><dt>{t("Public metrics")}</dt><dd>{selected.issue.metricValid ? t("Included") : `${t("Excluded")} · ${selected.issue.metricExclusionReason === "duplicate" ? t("Duplicate") : selected.issue.metricExclusionReason === "test" ? t("Test") : t("Cancelled")}`}</dd></div>
                  <div><dt>{t("Field status")}</dt><dd>{adminFieldLabel(adminLocale, selected.field.status)}</dd></div>
                  <div><dt>{t("Verified recurrences")}</dt><dd>{selected.field.recurrenceCount} {t("reports")}{selected.field.urgent ? ` · ${t("Urgent problem spot")}` : ""}</dd></div>
                  <div><dt>{t("Linked complaints")}</dt><dd>{selected.field.issueCount} {t("reports")}{selected.field.problemSpot ? ` · ${t("Problem spot")}` : ""}</dd></div>
                  <div><dt>{t("District")}</dt><dd>{findDistrict(selected.issue.districtId)?.label}</dd></div>
                  <div><dt>{t("Address")}</dt><dd>{selected.issue.address ?? t("Address unavailable")}</dd></div>
                  <div><dt>{t("Location")}</dt><dd>{selected.issue.latitude.toFixed(5)}, {selected.issue.longitude.toFixed(5)}</dd></div>
                </dl>
              </section>
              <section>
                <h3>{t("Site photo")}</h3>
                <ProtectedPhoto issueId={selected.issue.id} accessToken={session.access_token} alt={`${selected.issue.title} ${t("Site photo")}`} />
                {selected.resolutionEvidence && (
                  <div className="resolution-evidence-view">
                    <h4>{t("Post-treatment site photo")}</h4>
                    <ProtectedPhoto issueId={selected.issue.id} accessToken={session.access_token} kind="resolution" alt={`${selected.issue.title} ${t("Post-treatment site photo")}`} />
                    <p>{selected.resolutionEvidence.inspectionNote}</p>
                    <time dateTime={selected.resolutionEvidence.createdAt}>{formatTime(selected.resolutionEvidence.createdAt, adminLocale)}</time>
                  </div>
                )}
              </section>
              <section className="risk-panel">
                <h3>{t("AI risk")}</h3>
                <p className={`risk-summary risk-${selected.risk.effectiveLevel ?? "pending"}`}>
                  <strong>{selected.risk.effectiveLevel ? adminRiskLabel(adminLocale, selected.risk.effectiveLevel) : t("Evaluation required")}</strong>
                  <span>{selected.risk.source === "manager" ? t("Manager override") : selected.risk.source === "ai" ? t("AI suggestion") : t("No AI result")}</span>
                </p>
                {selected.risk.source === "evaluation_required" ? (
                  <p>{t("The AI provider is unavailable or evaluation failed. The ticket was received normally and requires a manager decision.")}</p>
                ) : (
                  <dl className="detail-list">
                    <div><dt>{t("Original AI result")}</dt><dd>{selected.risk.aiLevel ? adminRiskLabel(adminLocale, selected.risk.aiLevel) : t("Evaluation required")}</dd></div>
                    <div><dt>{t("Reasons")}</dt><dd>{selected.risk.riskReasonCodes.map((code) => adminAiReasonLabel(adminLocale, code)).join(", ")}</dd></div>
                    <div><dt>{t("Pre-screen")}</dt><dd>{selected.risk.filterReasonCodes.length ? selected.risk.filterReasonCodes.map((code) => adminAiReasonLabel(adminLocale, code)).join(", ") : t("No flags")}</dd></div>
                    <div><dt>{t("Input scope")}</dt><dd>{selected.risk.inputScope.join(", ")}</dd></div>
                    <div><dt>{t("Model")}</dt><dd>{selected.risk.model} · {selected.risk.modelVersion}</dd></div>
                  </dl>
                )}
                {selected.risk.effectiveLevel === 5 && <p className="urgent-note">{t("This may be an urgent risk. CivicPin does not replace emergency reporting channels.")}</p>}
                <label>
                  {t("Manager risk rating")}
                  <select value={riskLevel} onChange={(event) => { setRiskLevel(event.target.value); riskChangeKey.current = ""; }}>
                    <option value="">{t("Select a level")}</option>
                    {[1, 2, 3, 4, 5].map((level) => <option key={level} value={level}>{adminRiskLabel(adminLocale, level)}</option>)}
                  </select>
                </label>
                <label>
                  {t("Change reason")}
                  <textarea minLength={10} maxLength={1000} value={riskReason} onChange={(event) => { setRiskReason(event.target.value); riskChangeKey.current = ""; }} placeholder={t("Record at least 10 characters of supporting reasons.")} />
                </label>
                <button className="button tertiary" type="button" disabled={busy || !riskLevel || riskReason.trim().length < 10} onClick={() => void updateRisk()}>{t("Record risk change")}</button>
                {selected.risk.history.length > 0 && (
                  <details>
                    <summary>{t("Manager change history")} {selected.risk.history.length} {t("reports")}</summary>
                    <ol className="risk-history">
                      {selected.risk.history.map((entry) => <li key={entry.id}><strong>{entry.fromLevel ?? t("Evaluation required")} → {entry.toLevel}</strong><span>{entry.reason}</span><time dateTime={entry.createdAt}>{formatTime(entry.createdAt, adminLocale)}</time></li>)}
                    </ol>
                  </details>
                )}
              </section>
              <section className="admin-actions">
                <h3>{t("Actions")}</h3>
                {(selected.issue.status === "viewed" || selected.issue.status === "in_progress") && (
                  <div className="completion-answer">
                    <strong>{t("AI summary and response draft")}</strong>
                    {selected.aiAssistance?.status === "succeeded" ? (
                      <>
                        <p><strong>{t("Summary")}</strong><br />{selected.aiAssistance.summary}</p>
                        <p><strong>{t("Response draft")}</strong><br />{selected.aiAssistance.answerDraft}</p>
                        <p>{t("Model")} {selected.aiAssistance.model} · {selected.aiAssistance.modelVersion} — {t("The manager makes the final decision and sends the response.")}</p>
                        <button className="button tertiary" type="button" onClick={() => setFinalAnswer(selected.aiAssistance?.answerDraft ?? "")}>{t("Copy draft to final response")}</button>
                      </>
                    ) : selected.aiAssistance ? <p>{t("Status")} {selected.aiAssistance.status} · {t("Attempts")} {selected.aiAssistance.attempts}{selected.aiAssistance.failureCode ? ` · ${selected.aiAssistance.failureCode}` : ""}</p> : <p>{t("Generate a summary and response draft using only the complaint content. Results are never finalized automatically.")}</p>}
                    <button className="button tertiary" type="button" onClick={() => void requestAiAssistance()} disabled={busy}>{t("Request AI assistance")}</button>
                  </div>
                )}
                {selected.recurrenceCandidate?.status === "pending" && (
                  <div className="completion-answer">
                    <strong>{t("Recurrence candidate")}</strong>
                    <p>{t("A recently completed problem spot in the same category was found within 30 m.")} {selected.recurrenceCandidate.evidenceEligible ? t("Review the photo that passed the location, five-minute and camera checks.") : t("A standard photo cannot be used to confirm recurrence.")}</p>
                    <button className="button success" type="button" onClick={() => void reviewRecurrence(true)} disabled={busy || !selected.recurrenceCandidate.evidenceEligible}>{t("Confirm recurrence")}</button>
                    <button className="button secondary" type="button" onClick={() => void reviewRecurrence(false)} disabled={busy}>{t("Dismiss candidate")}</button>
                  </div>
                )}
                {selected.issue.status === "viewed" && (
                  <>
                    <label>
                      {t("Assigned department")}
                      <select value={department} onChange={(event) => setDepartment(event.target.value as Department)}>
                        {DEPARTMENTS.map((item) => <option key={item.id} value={item.id}>{adminDepartmentLabel(adminLocale, item.id)}</option>)}
                      </select>
                    </label>
                    <button className="button primary" type="button" onClick={() => void startIssue()} disabled={busy}>{t("Start processing")}</button>
                  </>
                )}
                {selected.issue.status === "in_progress" && (
                  <>
                    <div className="completion-answer">
                      <strong>{t("Post-treatment field evidence (optional)")}</strong>
                      <p>{t("Saving a photo with an inspection note confirms field resolution. Without both, the field remains pending verification after completion.")}</p>
                      <label>
                        {t("One post-treatment photo")}
                        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setResolutionPhoto(event.target.files?.[0] ?? null)} />
                      </label>
                      <label>
                        {t("Field inspection note")}
                        <textarea minLength={10} maxLength={1000} value={inspectionNote} onChange={(event) => setInspectionNote(event.target.value)} placeholder={t("Record the treatment result and verification method in at least 10 characters.")} />
                      </label>
                    </div>
                    <label>
                      {t("Final response to the resident")}
                      <textarea minLength={10} maxLength={2000} value={finalAnswer} onChange={(event) => setFinalAnswer(event.target.value)} placeholder={t("Enter at least 10 characters describing the action and result.")} />
                    </label>
                    <label className="confirm-row">
                      <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
                      {t("I reviewed the response and confirm completion of this complaint.")}
                    </label>
                    <button className="button success" type="button" onClick={() => void completeIssue()} disabled={busy || !confirmed || [...finalAnswer.trim()].length < 10 || Boolean(resolutionPhoto) !== Boolean(inspectionNote.trim()) || (resolutionPhoto !== null && inspectionNote.trim().length < 10)}>{t("Confirm completion and notify")}</button>
                  </>
                )}
                {(selected.issue.status === "viewed" || selected.issue.status === "in_progress") && (
                  <div className="completion-answer">
                    <strong>{t("Put on hold")}</strong>
                    <label>
                      {t("Hold reason")}
                      <textarea minLength={10} maxLength={1000} value={holdReason} onChange={(event) => setHoldReason(event.target.value)} />
                    </label>
                    <label>
                      {t("Next review")}
                      <input type="datetime-local" value={nextCheckAt} onChange={(event) => setNextCheckAt(event.target.value)} />
                    </label>
                    <button className="button secondary" type="button" onClick={() => void holdIssue()} disabled={busy || holdReason.trim().length < 10 || !nextCheckAt}>{t("Save hold")}</button>
                  </div>
                )}
                {selected.issue.status === "on_hold" && (
                  <div className="completion-answer">
                    <strong>{t("Hold information")}</strong>
                    <p>{heldEvent?.holdReason}</p>
                    {heldEvent?.nextCheckAt && <time dateTime={heldEvent.nextCheckAt}>{t("Next review:")} {formatTime(heldEvent.nextCheckAt, adminLocale)}</time>}
                    <button className="button primary" type="button" onClick={() => void resumeIssue()} disabled={busy}>{t("Resume processing")}</button>
                  </div>
                )}
                {selected.issue.status === "received" && <p>{t("The viewed status is being recorded. Open the complaint again.")}</p>}
                {selected.issue.status === "completed" && (
                  <div className="completion-answer">
                    <strong>{t("Completion response")}</strong>
                    <p>{completedEvent?.finalAnswer}</p>
                    <time dateTime={completedEvent?.createdAt}>{completedEvent ? formatTime(completedEvent.createdAt, adminLocale) : ""}</time>
                    <button className="button secondary" type="button" onClick={() => void retryNotifications()} disabled={busy}>
                      {t("Retry pending email")}
                    </button>
                  </div>
                )}
                <div className="completion-answer">
                  <strong>{t("Public metric validity")}</strong>
                  {selected.issue.metricValid ? (
                    <>
                      <label>{t("Exclusion reason")}<select value={metricExclusionReason} onChange={(event) => setMetricExclusionReason(event.target.value)}><option value="duplicate">{t("Duplicate")}</option><option value="test">{t("Test")}</option><option value="cancelled">{t("Cancelled")}</option></select></label>
                      <button className="button tertiary" type="button" disabled={busy} onClick={() => void updateMetricValidity(false)}>{t("Exclude from metrics")}</button>
                    </>
                  ) : <button className="button tertiary" type="button" disabled={busy} onClick={() => void updateMetricValidity(true)}>{t("Include in metrics")}</button>}
                </div>
              </section>
            </div>
          </aside>
        </>
      )}

      <p className="admin-message" role="status" aria-live="polite">{message}</p>
    </main>
  );
}
