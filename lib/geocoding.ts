import { TAOYUAN_BOUNDS } from "./issues.ts";

const DEFAULT_ENDPOINT = "https://nominatim.openstreetmap.org/reverse";
const cache = new Map<string, Promise<string | null>>();
let requestQueue = Promise.resolve();
let lastRequestAt = 0;

const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function requestAddress(latitude: number, longitude: number) {
  const endpoint = process.env.NOMINATIM_URL || DEFAULT_ENDPOINT;
  const url = new URL(endpoint);
  const isHttp = url.protocol === "http:" || url.protocol === "https:";
  if (isHttp) {
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("lat", String(latitude));
    url.searchParams.set("lon", String(longitude));
    url.searchParams.set("zoom", "18");
    url.searchParams.set("addressdetails", "0");
    url.searchParams.set("accept-language", "zh-TW,zh,en");
  }

  const run = async () => {
    if (isHttp) {
      await sleep(Math.max(0, 1000 - (Date.now() - lastRequestAt)));
      lastRequestAt = Date.now();
    }
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": process.env.NOMINATIM_USER_AGENT
          || `CivicPin/0.1 (${process.env.NEXT_PUBLIC_APP_URL || "local civic reporting app"})`,
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    const result = await response.json() as { display_name?: unknown };
    if (typeof result.display_name !== "string" || !result.display_name.trim()) return null;
    return [...result.display_name.trim()].slice(0, 500).join("");
  };

  if (!isHttp) return run();
  const queued = requestQueue.then(run, run);
  requestQueue = queued.then(() => undefined, () => undefined);
  return queued;
}

export function reverseGeocode(latitude: number, longitude: number) {
  if (!Number.isFinite(latitude) || latitude < TAOYUAN_BOUNDS.south || latitude > TAOYUAN_BOUNDS.north
    || !Number.isFinite(longitude) || longitude < TAOYUAN_BOUNDS.west || longitude > TAOYUAN_BOUNDS.east) {
    return Promise.resolve(null);
  }
  const key = `${process.env.NOMINATIM_URL || DEFAULT_ENDPOINT}:${latitude.toFixed(6)},${longitude.toFixed(6)}`;
  const cached = cache.get(key);
  if (cached) return cached;
  // ponytail: one-process queue and bounded cache fit the local MVP; use a managed
  // geocoder before horizontally scaling beyond Nominatim's public-service policy.
  const lookup = requestAddress(latitude, longitude).catch(() => null);
  cache.set(key, lookup);
  void lookup.then((address) => { if (!address) cache.delete(key); });
  if (cache.size > 500) cache.delete(cache.keys().next().value!);
  return lookup;
}
