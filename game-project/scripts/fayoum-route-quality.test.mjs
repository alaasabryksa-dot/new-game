import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../src/game/data/fayoum-route.ts", import.meta.url), "utf8");
const match = source.match(/FAYOUM_ROUTE_COORDINATES[^=]*=\s*(\[\[.*?\]\]);/s);
assert.ok(match, "route coordinate export must remain parseable");
const coordinates = JSON.parse(match[1]);
assert.ok(coordinates.length >= 100, "mapped route should retain detailed geometry");

const origin = coordinates[0];
const lat0 = origin[1] * Math.PI / 180;
const mx = 111320 * Math.cos(lat0);
const my = 110540;
const points = coordinates.map(([lon, lat]) => ({
  x: (lon - origin[0]) * mx,
  z: -(lat - origin[1]) * my,
}));
if (Math.hypot(points[0].x - points.at(-1).x, points[0].z - points.at(-1).z) < 0.5) {
  points.pop();
}
const lengths = points.map((p, i) => {
  const n = points[(i + 1) % points.length];
  return Math.hypot(n.x - p.x, n.z - p.z);
});
const total = lengths.reduce((sum, length) => sum + length, 0);
assert.ok(total > 1000 && total < 10000, "candidate loop length must stay within a plausible local range");
const cumulative = [];
let running = 0;
for (const length of lengths) {
  cumulative.push(running);
  running += length;
}
function sample(distance) {
  const d = ((distance % total) + total) % total;
  let i = cumulative.findIndex((start, index) => d <= start + lengths[index]);
  if (i < 0) i = points.length - 1;
  const a = points[i];
  const b = points[(i + 1) % points.length];
  const u = lengths[i] > 0 ? (d - cumulative[i]) / lengths[i] : 0;
  return { x: a.x + (b.x - a.x) * u, z: a.z + (b.z - a.z) * u };
}
function nearestDistance(point) {
  let best = Infinity;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const l2 = dx * dx + dz * dz || 1;
    const u = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.z - a.z) * dz) / l2));
    best = Math.min(best, Math.hypot(point.x - (a.x + dx * u), point.z - (a.z + dz * u)));
  }
  return best;
}

for (let i = 0; i < 100; i++) {
  test("mapped route sample " + String(i + 1).padStart(3, "0") + " remains on source geometry", () => {
    const point = sample(total * (i + 0.37) / 100);
    assert.ok(Number.isFinite(point.x) && Number.isFinite(point.z), "sample coordinates must be finite");
    assert.ok(nearestDistance(point) < 0.01, "sample must project back onto mapped road geometry");
  });
}
