import type { DistrictId, FieldStatus, IssueCategory } from "./issues.ts";

export type PublicHotspot = {
  category: IssueCategory;
  reportCount: number;
  recurrenceCount: number;
  fieldStatus: FieldStatus;
  latitude: number;
  longitude: number;
};

export type PublicSnapshot = {
  districtId: DistrictId;
  periodStart: string;
  periodEnd: string;
  ticketCount: number;
  completedCount: number;
  administrativeCompletionRate: number | null;
  fieldSpotCount: number;
  resolvedSpotCount: number;
  fieldResolutionRate: number | null;
  categoryCounts: Partial<Record<IssueCategory, number>>;
  hotspots: PublicHotspot[];
  generatedAt: string;
};

export type PublicSnapshotSummary = Omit<PublicSnapshot, "districtId" | "hotspots">;

export type PublicSnapshotRow = {
  district_id: DistrictId;
  period_start: string;
  period_end: string;
  ticket_count: number;
  completed_count: number;
  administrative_completion_rate: number | null;
  field_spot_count: number;
  resolved_spot_count: number;
  field_resolution_rate: number | null;
  category_counts: Partial<Record<IssueCategory, number>>;
  hotspots: PublicHotspot[];
  generated_at: string;
};

export const snapshotFromRow = (row: PublicSnapshotRow): PublicSnapshot => ({
  districtId: row.district_id,
  periodStart: row.period_start,
  periodEnd: row.period_end,
  ticketCount: row.ticket_count,
  completedCount: row.completed_count,
  administrativeCompletionRate: row.administrative_completion_rate,
  fieldSpotCount: row.field_spot_count,
  resolvedSpotCount: row.resolved_spot_count,
  fieldResolutionRate: row.field_resolution_rate,
  categoryCounts: row.category_counts,
  hotspots: row.hotspots,
  generatedAt: row.generated_at,
});

export function summarizeSnapshots(snapshots: PublicSnapshot[]): PublicSnapshotSummary | null {
  if (!snapshots.length) return null;
  const totals = snapshots.reduce((result, snapshot) => {
    result.ticketCount += snapshot.ticketCount;
    result.completedCount += snapshot.completedCount;
    result.fieldSpotCount += snapshot.fieldSpotCount;
    result.resolvedSpotCount += snapshot.resolvedSpotCount;
    for (const [category, count] of Object.entries(snapshot.categoryCounts)) {
      result.categoryCounts[category as IssueCategory] = (result.categoryCounts[category as IssueCategory] ?? 0) + (count ?? 0);
    }
    return result;
  }, { ticketCount: 0, completedCount: 0, fieldSpotCount: 0, resolvedSpotCount: 0, categoryCounts: {} as Partial<Record<IssueCategory, number>> });
  const rate = (part: number, whole: number) => whole >= 10 ? Math.round(part * 1000 / whole) / 10 : null;
  return {
    ...totals,
    administrativeCompletionRate: rate(totals.completedCount, totals.ticketCount),
    fieldResolutionRate: rate(totals.resolvedSpotCount, totals.fieldSpotCount),
    periodStart: snapshots.reduce((date, snapshot) => snapshot.periodStart < date ? snapshot.periodStart : date, snapshots[0].periodStart),
    periodEnd: snapshots.reduce((date, snapshot) => snapshot.periodEnd > date ? snapshot.periodEnd : date, snapshots[0].periodEnd),
    generatedAt: snapshots.reduce((date, snapshot) => snapshot.generatedAt > date ? snapshot.generatedAt : date, snapshots[0].generatedAt),
  };
}
