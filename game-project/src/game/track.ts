import { STREET_ENTRANCES } from "./types";
import { FAYOUM_ROUTE_COORDINATES } from "./data/fayoum-route";

export const LANE_W = 3.45;
export const ROAD_HALF = 8.15;

export type Sample = { x: number; z: number; s: number; yaw: number; len: number };

export type Proj = {
  i: number;
  s: number;
  x: number;
  z: number;
  yaw: number;
  lat: number;
  dist: number;
};

export type Track = {
  pts: Sample[];
  total: number;
  stops: { name: string; side: "left" | "right"; s: number }[];
  entrances: { name: string; side: "left" | "right"; sideOrder: number; s: number }[];
  tollS: number;
  radarS: number[];
  gasS: number;
  bumps: number[];
  sample: (s: number) => { x: number; z: number; yaw: number; s: number };
  project: (x: number, z: number, hint: number) => Proj;
};

export function laneLat(lane: number) {
  return (lane - 1.5) * LANE_W;
}

export function wrapDelta(a: number, b: number, total: number) {
  let d = a - b;
  const h = total * 0.5;
  while (d > h) d -= total;
  while (d < -h) d += total;
  return d;
}

export function wrapAngle(d: number) {
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function buildTrack(): Track {
  // Convert the mapped lon/lat route into a local metric game coordinate system.
  // The candidate is a closed, direction-aware loop; keep its mapped order.
  const origin = FAYOUM_ROUTE_COORDINATES[0];
  const lat0 = (origin[1] * Math.PI) / 180;
  const metersPerLon = 111320 * Math.cos(lat0);
  const metersPerLat = 110540;
  const mapped = FAYOUM_ROUTE_COORDINATES.map(([lon, lat]) => ({
    x: (lon - origin[0]) * metersPerLon,
    z: -(lat - origin[1]) * metersPerLat,
  }));
  if (mapped.length > 2) {
    const first = mapped[0];
    const last = mapped[mapped.length - 1];
    if (Math.hypot(first.x - last.x, first.z - last.z) < 0.5) mapped.pop();
  }

  // Resample long OSM edges to keep road meshes, collision and projection smooth.
  const raw: { x: number; z: number }[] = [];
  const spacing = 4.5;
  for (let i = 0; i < mapped.length; i++) {
    const a = mapped[i];
    const b = mapped[(i + 1) % mapped.length];
    const length = Math.hypot(b.x - a.x, b.z - a.z);
    const steps = Math.max(1, Math.ceil(length / spacing));
    for (let step = 0; step < steps; step++) {
      const t = step / steps;
      raw.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
    }
  }
  const N = raw.length;
  const pts: Sample[] = [];
  let s = 0;
  for (let i = 0; i < N; i++) {
    const a = raw[i];
    const b = raw[(i + 1) % N];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz) || 0.001;
    const yaw = Math.atan2(-dx / len, -dz / len);
    pts.push({ x: a.x, z: a.z, s, yaw, len });
    s += len;
  }
  const total = s;

  // Passenger stops now use the player's 24 confirmed street names.
  // Interleave the two independently confirmed side lists to avoid stacking
  // opposite-side junctions at the exact same gameplay coordinate. This is a
  // presentation-only sequence; the real cross-side order still needs field mapping.
  const entrances = STREET_ENTRANCES.map((entry) => ({
    ...entry,
    s: ((entry.sideOrder - 1) * 2 + (entry.side === "right" ? 1 : 0) + 1) / 25 * total,
  }));
  const stops = entrances
    .map(({ name, side, s: stopS }) => ({ name, side, s: stopS }))
    .sort((a, b) => a.s - b.s || (a.side === "left" ? -1 : 1));

  const tollS = total * 0.42;
  const radarS = [0.18, 0.57, 0.79].map((t) => t * total);
  const gasS = total * 0.67;
  const bumps = [0.12, 0.34, 0.51, 0.88].map((t) => t * total);

  function sample(dist: number) {
    let sDist = dist % total;
    if (sDist < 0) sDist += total;
    let lo = 0;
    let hi = pts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (pts[mid].s <= sDist) lo = mid;
      else hi = mid - 1;
    }
    const p = pts[lo];
    const n = pts[(lo + 1) % pts.length];
    const u = Math.min(1, Math.max(0, (sDist - p.s) / p.len));
    return {
      x: p.x + (n.x - p.x) * u,
      z: p.z + (n.z - p.z) * u,
      yaw: p.yaw,
      s: sDist,
    };
  }

  function project(x: number, z: number, hint: number): Proj {
    const scan = (from: number, count: number) => {
      let best: Proj | null = null;
      for (let k = 0; k < count; k++) {
        const i = (from + k + pts.length * 8) % pts.length;
        const p = pts[i];
        const n = pts[(i + 1) % pts.length];
        const dx = n.x - p.x;
        const dz = n.z - p.z;
        const l2 = dx * dx + dz * dz || 1;
        let t = ((x - p.x) * dx + (z - p.z) * dz) / l2;
        if (t < 0) t = 0;
        else if (t > 1) t = 1;
        const px = p.x + dx * t;
        const pz = p.z + dz * t;
        const dist = Math.hypot(x - px, z - pz);
        if (!best || dist < best.dist) {
          const rx = Math.cos(p.yaw);
          const rz = -Math.sin(p.yaw);
          best = {
            i,
            s: p.s + p.len * t,
            x: px,
            z: pz,
            yaw: p.yaw,
            lat: (x - px) * rx + (z - pz) * rz,
            dist,
          };
        }
      }
      return best!;
    };

    if (hint < 0) return scan(0, pts.length);
    const near = scan(hint - 30, 70);
    if (near.dist > 24) return scan(0, pts.length);
    return near;
  }

  return { pts, total, stops, entrances, tollS, radarS, gasS, bumps, sample, project };
}
