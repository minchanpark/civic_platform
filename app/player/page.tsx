"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CitizenFooter, CitizenHeader } from "@/components/citizen-shell";
import { DistrictQr } from "@/components/district-qr";
import { useI18n } from "@/components/i18n-provider";
import { IssueMap, type MapPin } from "@/components/issue-map";
import { DISTRICTS, ISSUE_CATEGORIES, type IssueCategory, type IssueStatus } from "@/lib/issues";
import { summarizeSnapshots, type PublicSnapshot } from "@/lib/player";

function dominantCategory(snapshot: PublicSnapshot): IssueCategory {
  let best: IssueCategory = ISSUE_CATEGORIES[0].id;
  for (const category of ISSUE_CATEGORIES) {
    if ((snapshot.categoryCounts[category.id] ?? 0) > (snapshot.categoryCounts[best] ?? 0)) best = category.id;
  }
  return best;
}

const fieldStatusAsIssueStatus = (status: PublicSnapshot["hotspots"][number]["fieldStatus"]): IssueStatus => {
  if (status === "resolved_confirmed") return "completed";
  if (status === "recurrence_confirmed") return "on_hold";
  return "in_progress";
};

export default function PlayerPage() {
  const { locale, t } = useI18n();
  const [snapshots, setSnapshots] = useState<PublicSnapshot[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [paused, setPaused] = useState(() => typeof window !== "undefined"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [overview, setOverview] = useState(true);
  const [message, setMessage] = useState("");
  const rate = (value: number | null) => value === null ? t("common.dataInsufficient") : `${value.toFixed(1)}%`;

  useEffect(() => {
    let active = true;
    const load = () => void fetch("/api/player")
      .then(async (response) => {
        const result = await response.json() as { snapshots?: PublicSnapshot[]; error?: string };
        if (!response.ok || !result.snapshots) throw new Error(result.error ?? t("player.loadError"));
        if (!active) return;
        setSnapshots(result.snapshots.sort((a, b) => (
          DISTRICTS.findIndex((district) => district.id === a.districtId)
          - DISTRICTS.findIndex((district) => district.id === b.districtId)
        )));
        setMessage("");
      })
      .catch(() => { if (active) setMessage(t("player.loadError")); });
    load();
    const timer = window.setInterval(load, 300_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [t]);

  useEffect(() => {
    if (paused || snapshots.length < 2) return;
    const timer = window.setInterval(() => {
      setOverview(false);
      setSelectedIndex((current) => (current + 1) % snapshots.length);
    }, 8000);
    return () => window.clearInterval(timer);
  }, [paused, snapshots.length]);

  const selected = snapshots[selectedIndex];
  const summary = useMemo(() => summarizeSnapshots(snapshots), [snapshots]);
  const displayed = overview ? summary : selected;
  const district = selected && DISTRICTS.find((item) => item.id === selected.districtId);
  const pins = useMemo<MapPin[]>(() => {
    if (overview) return snapshots.flatMap((snapshot) => {
      const item = DISTRICTS.find((candidate) => candidate.id === snapshot.districtId);
      return item ? [{
        id: `district-${snapshot.districtId}`,
        latitude: item.latitude,
        longitude: item.longitude,
        status: "viewed" as const,
        category: dominantCategory(snapshot),
        label: `${item.label} · ${snapshot.ticketCount} ${t("common.items")}`,
      }] : [];
    });
    if (!selected || !district) return [];
    if (!selected.hotspots.length) return [{
      id: `district-${selected.districtId}`,
      latitude: district.latitude,
      longitude: district.longitude,
      status: "viewed" as const,
      category: dominantCategory(selected),
      label: `${district.label} · ${selected.ticketCount} ${t("common.items")}`,
    }];
    return selected.hotspots.map((hotspot, index) => ({
      id: `hotspot-${selected.districtId}-${index}`,
      latitude: hotspot.latitude,
      longitude: hotspot.longitude,
      status: fieldStatusAsIssueStatus(hotspot.fieldStatus),
      category: hotspot.category,
      label: `${hotspot.reportCount} ${t("common.items")} · ${hotspot.recurrenceCount} ${t("player.recurrences")}`,
    }));
  }, [district, overview, selected, snapshots, t]);

  const move = (direction: number) => {
    if (!snapshots.length) return;
    setOverview(false);
    setSelectedIndex((selectedIndex + direction + snapshots.length) % snapshots.length);
  };

  return (
    <main className="player-page citizen-page">
      <CitizenHeader />
      <section className="player-header" aria-label={t("player.title")}>
        <strong>{t("player.title")}</strong>
        <div className="player-controls" aria-label={t("player.title")}>
          <button type="button" onClick={() => move(-1)} aria-label={t("player.previous")}>←</button>
          <button type="button" onClick={() => setPaused((value) => !value)} aria-pressed={paused}>{paused ? t("player.resume") : t("player.pause")}</button>
          <button type="button" onClick={() => move(1)} aria-label={t("player.next")}>→</button>
          <button type="button" onClick={() => setOverview((value) => !value)} aria-pressed={overview}>{overview ? t("player.zoomIn") : t("player.zoomOut")}</button>
        </div>
      </section>

      <section className="player-stage" aria-labelledby="player-title">
        <div className="player-map">
          <IssueMap
            pins={pins}
            center={!overview && district ? { latitude: district.latitude, longitude: district.longitude } : { latitude: 24.94, longitude: 121.23 }}
            zoom={overview ? 10 : 12}
            ariaLabel={overview ? t("player.mapOverview") : `${district?.label ?? ""} ${t("player.mapDistrict")}`}
          />
        </div>

        <aside className="player-panel">
          <p className="eyebrow">90-DAY PUBLIC SNAPSHOT</p>
          <h1 id="player-title">{overview ? t("player.allDistricts") : district?.label ?? t("player.title")}</h1>
          {displayed ? (
            <>
              <p>{displayed.periodStart} ~ {displayed.periodEnd} · {new Date(displayed.generatedAt).toLocaleString(locale, { timeZone: "Asia/Taipei" })} {t("player.updated")}</p>
              <dl className="player-metrics">
                <div><dt>{t("player.complaints")}</dt><dd>{displayed.ticketCount}</dd></div>
                <div><dt>{t("player.adminRate")}</dt><dd>{rate(displayed.administrativeCompletionRate)}</dd><small>{displayed.completedCount}/{displayed.ticketCount}</small></div>
                <div><dt>{t("player.fieldRate")}</dt><dd>{rate(displayed.fieldResolutionRate)}</dd><small>{displayed.resolvedSpotCount}/{displayed.fieldSpotCount}</small></div>
              </dl>
              <div className="player-categories">
                {ISSUE_CATEGORIES.map((category) => <span key={category.id}>{category.icon} {t(`category.${category.id}`)} {displayed.categoryCounts[category.id] ?? 0}</span>)}
              </div>
              {!overview && district && <div className="player-qr"><strong>{t("player.qrTitle")}</strong><DistrictQr path={`/?district=${district.id}&lang=${locale}#category-title`} alt={`${district.label} ${t("player.qrAlt")}`} /><Link className="button primary" href={`/?district=${district.id}&lang=${locale}#category-title`}>{t("report.submit")}</Link></div>}
            </>
          ) : <p role="status">{message}</p>}
        </aside>
      </section>

      <section className="player-table-wrap" aria-labelledby="district-table-title">
        <h2 id="district-table-title">{t("player.tableTitle")}</h2>
        <table>
          <thead><tr><th>{t("player.district")}</th><th>{t("player.complaints")}</th><th>{t("player.adminRate")}</th><th>{t("player.fieldRate")}</th></tr></thead>
          <tbody>
            {snapshots.map((snapshot, index) => (
              <tr key={snapshot.districtId}>
                <th><button type="button" onClick={() => { setOverview(false); setSelectedIndex(index); }}>{DISTRICTS.find((item) => item.id === snapshot.districtId)?.label}</button></th>
                <td>{snapshot.ticketCount}</td>
                <td>{rate(snapshot.administrativeCompletionRate)}</td>
                <td>{rate(snapshot.fieldResolutionRate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p role="status" aria-live="polite">{message}</p>
      </section>
      <CitizenFooter />
    </main>
  );
}
