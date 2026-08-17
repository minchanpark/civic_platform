import boundaries from "../data/taoyuan-districts.json" with { type: "json" };
import { DISTRICTS, type DistrictId } from "./issues.ts";

type Position = [number, number];
type Geometry =
  | { type: "Polygon"; coordinates: Position[][] }
  | { type: "MultiPolygon"; coordinates: Position[][][] };
type Feature = { properties: { TOWNNAME: string }; geometry: Geometry };

const features = boundaries.features as unknown as Feature[];

function inRing([longitude, latitude]: Position, ring: Position[]) {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const [x1, y1] = ring[previous];
    const [x2, y2] = ring[index];
    const cross = (longitude - x1) * (y2 - y1) - (latitude - y1) * (x2 - x1);
    if (Math.abs(cross) < 1e-10
      && longitude >= Math.min(x1, x2) && longitude <= Math.max(x1, x2)
      && latitude >= Math.min(y1, y2) && latitude <= Math.max(y1, y2)) return true;
    if ((y1 > latitude) !== (y2 > latitude)
      && longitude < ((x2 - x1) * (latitude - y1)) / (y2 - y1) + x1) inside = !inside;
  }
  return inside;
}

function inPolygon(position: Position, polygon: Position[][]) {
  return inRing(position, polygon[0]) && !polygon.slice(1).some((hole) => inRing(position, hole));
}

export function isInsideDistrict(districtId: DistrictId, latitude: number, longitude: number) {
  const label = DISTRICTS.find((district) => district.id === districtId)?.label;
  const geometry = features.find((feature) => feature.properties.TOWNNAME === label)?.geometry;
  if (!geometry) return false;
  const position: Position = [longitude, latitude];
  return geometry.type === "Polygon"
    ? inPolygon(position, geometry.coordinates)
    : geometry.coordinates.some((polygon) => inPolygon(position, polygon));
}
