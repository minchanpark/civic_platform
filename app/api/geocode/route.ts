import { jsonError, rateLimitResponse } from "../_shared";
import { reverseGeocode } from "@/lib/geocoding";
import { TAOYUAN_BOUNDS } from "@/lib/issues";
import { requestAddress } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const limited = rateLimitResponse(`geocode:${requestAddress(request)}`, 30, 60_000);
  if (limited) return limited;
  const url = new URL(request.url);
  const latitude = Number(url.searchParams.get("latitude"));
  const longitude = Number(url.searchParams.get("longitude"));
  if (!Number.isFinite(latitude) || latitude < TAOYUAN_BOUNDS.south || latitude > TAOYUAN_BOUNDS.north
    || !Number.isFinite(longitude) || longitude < TAOYUAN_BOUNDS.west || longitude > TAOYUAN_BOUNDS.east) {
    return jsonError("타오위안시 범위 안의 좌표가 필요합니다.", 400);
  }
  const address = await reverseGeocode(latitude, longitude);
  if (!address) return jsonError("선택한 위치의 주소를 확인할 수 없습니다.", 502);
  return Response.json({ address }, { headers: { "Cache-Control": "private, max-age=86400" } });
}
