import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const types = await readFile(new URL("../src/game/types.ts", import.meta.url), "utf8");
const track = await readFile(new URL("../src/game/track.ts", import.meta.url), "utf8");
const block = types.match(/export const STOP_NAMES = \[([\s\S]*?)\];/);

test("passenger pickup labels are explicitly generic, not invented real stops", () => {
  assert.ok(block, "STOP_NAMES must remain exported");
  const labels = [...block[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
  assert.equal(labels.length, 10, "the game should retain ten passenger pickup points");
  assert.deepEqual(labels, Array.from({ length: 10 }, (_, i) => `نقطة ركاب ${["١","٢","٣","٤","٥","٦","٧","٨","٩","١٠"][i]}`));
  assert.ok(labels.every((label) => !/موقف|محطة|شارع الفيوم/.test(label)), "generated labels must not imply verified real-world stop names");
});

test("track documents generated pickup points as gameplay-only", () => {
  assert.match(track, /gameplay pickup points, not surveyed or named street stops/);
});
