import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const types = await readFile(new URL("../src/game/types.ts", import.meta.url), "utf8");
const track = await readFile(new URL("../src/game/track.ts", import.meta.url), "utf8");
const engine = await readFile(new URL("../src/game/engine.ts", import.meta.url), "utf8");

const entranceBlock = types.match(/export const STREET_ENTRANCES(?:\s*:\s*[^=]+)?\s*=\s*\[([\s\S]*?)\];/);

test("all 24 player-confirmed side-street names are retained in their side-local order", () => {
  assert.ok(entranceBlock, "STREET_ENTRANCES must remain exported");
  const names = [...entranceBlock[1].matchAll(/"(شارع [^"]+|كشري الدكتور)"/g)].map((match) => match[1]);
  assert.equal(names.length, 24);
  assert.deepEqual(names.slice(0, 12), [
    "شارع حسن مطر", "شارع محمد رزق", "كشري الدكتور", "شارع قدري الصياد",
    "شارع كمال عبد الحميد", "شارع فهيم عبد الخالق", "شارع تاج الدين عمرو",
    "شارع أبو أشرف", "شارع عزت مطر", "شارع عبد القادر",
    "شارع أحمد متولي", "شارع إسماعيل الليثي",
  ]);
  assert.deepEqual(names.slice(12), [
    "شارع أحمد عسلاقي", "شارع محمد حسين مطر", "شارع أحمد محمود", "شارع أحمد المصري",
    "شارع السيد أبو كريشة", "شارع أبو طالب", "شارع علي زينهم", "شارع عبد الغفار عزيز",
    "شارع أحمد زكي", "شارع صالح عبدين", "شارع المشير", "شارع الحرية",
  ]);
});

test("passenger stops are named and preserve the side for curb-side servicing", () => {
  assert.match(track, /const stops = entrances/);
  assert.match(track, /side: "left" \| "right"/);
  assert.match(engine, /proj\.lat \* sideSign > PASSENGER_SYSTEM_TUNING\.curbLaneMinimum/);
  assert.match(engine, /sideWord/);
});

test("opposite-side names are paired only as provisional visual cross-sections", () => {
  assert.match(track, /share a provisional cross-section/);
  assert.match(track, /without claiming surveyed cross-side alignment/);
});
