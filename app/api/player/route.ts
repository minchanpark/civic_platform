import { snapshotFromRow, type PublicSnapshotRow } from "@/lib/player";
import { getSupabaseSecretClient } from "@/lib/supabase/server";

const NO_DETAIL_FIELDS = "district_id,period_start,period_end,ticket_count,completed_count,administrative_completion_rate,field_spot_count,resolved_spot_count,field_resolution_rate,category_counts,hotspots,generated_at";

export async function GET() {
  const client = getSupabaseSecretClient();
  if (!client) return Response.json({ error: "공개 현황 설정을 확인해 주세요." }, { status: 503 });
  const { data: refresh, error: refreshError } = await client.rpc("refresh_public_snapshots_if_due");
  const refreshFailed = Boolean(refreshError || !refresh || refresh.success !== true);
  if (refreshFailed) console.error("Public snapshot refresh failed", refreshError ?? refresh);
  const { data, error } = await client
    .from("district_public_snapshots")
    .select(NO_DETAIL_FIELDS)
    .order("district_id");
  if (error || (refreshFailed && !data?.length)) {
    console.error("Public snapshot query failed", error);
    return Response.json({ error: "공개 현황을 불러오지 못했습니다." }, { status: 502 });
  }
  return Response.json({ snapshots: (data as PublicSnapshotRow[]).map(snapshotFromRow) }, {
    headers: { "Cache-Control": "public, max-age=300" },
  });
}
