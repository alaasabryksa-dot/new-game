import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const engine = readFileSync(new URL("../src/game/engine.ts", import.meta.url), "utf8");

test("Android and desktop scenes expose the expanded fictional Egyptian storefront set", () => {
  const matches = [...engine.matchAll(/const signLabels = \[([^\]]+)\];/g)];
  assert.equal(matches.length, 2, "both mobile and desktop scene paths must define storefront categories");
  for (const match of matches) {
    const labels = [...match[1].matchAll(/"([^"]+)"/g)].map((entry) => entry[1]);
    assert.equal(labels.length, 32, "each renderer must expose 32 category labels");
    assert.ok(labels.includes("جزارة"));
    assert.ok(labels.includes("مكتبة"));
    assert.ok(labels.includes("قطع غيار"));
    assert.ok(labels.includes("ملابس"));
  }
});

test("storefront category palettes and adaptive Arabic sign typography are kept in sync", () => {
  const palettes = [...engine.matchAll(/const signColors = \[([^\]]+)\];/g)];
  assert.equal(palettes.length, 2);
  for (const match of palettes) {
    assert.equal([...match[1].matchAll(/"#[0-9a-fA-F]{6}"/g)].length, 32);
  }
  assert.match(engine, /label\.length > 10 \? 43/);
  assert.match(engine, /label\.length > 7 \? 52/);
  assert.match(engine, /label\.length > 7 \? 54/);
});

test("Android procedural frontage uses the denser commercial mix without claiming real shop identities", () => {
  assert.match(engine, /const isShop = sideVariation > 0\.24;/);
  assert.match(engine, /Alternate fictional commercial and residential ground floors/);
  assert.match(engine, /const sideSeed = seed \+ \(side === 1 \? 7919 : 0\);/);
});

test("Android street facades vary independently by side and include lightweight rooftop water tanks", () => {
  assert.match(engine, /Small split A\/C units, drain pipes and satellite dishes/);
  assert.match(engine, /g\.ellipse\(dishX \+ 2, dishY - 6/);
  assert.match(engine, /g\.fillRect\(unitX, unitY, 26, 15\)/);
  assert.match(engine, /exterior drain pipes and utility meter boxes/);
  assert.match(engine, /closed shutters and balcony laundry/);
  assert.match(engine, /for \(let slat = 0; slat < 9; slat\+\+\)/);
  assert.match(engine, /clothX \+ 19, clothY \+ 3, 12, 11/);
  assert.match(engine, /g\.fillRect\(px, 0, 3, 512\)/);
  assert.match(engine, /g\.arc\(321, 466, 5/);
  assert.match(engine, /const sideSeed = seed \+ \(side === 1 \? 7919 : 0\);/);
  assert.match(engine, /const sideVariation = \(sideSeed % 1000\) \/ 1000;/);
  assert.match(engine, /new THREE\.CylinderGeometry\(0\.52, 0\.56, 1\.12, 9\)/);
  assert.match(engine, /roofTank\.count = roofTankCount;/);
  assert.match(engine, /roofTankTop\.count = roofTankCount;/);
});

test("apartment frontage texture includes all twenty deterministic low-cost detail variants", () => {
  assert.match(engine, /Twenty deterministic frontage accents/);
  assert.match(engine, /const frontageDetail = \(floor \* 17 \+ col \* 11 \+ variant \* 7 \+ base\.length\) % 20;/);
  const detailCases = [...engine.matchAll(/case \d+: \/\//g)];
  assert.equal(detailCases.length, 20, "all twenty facade accents must have an implementation");
  assert.match(engine, /painted once into the shared texture, not scene meshes/);
});

test("NPC traffic has twenty active driving-tuning controls for curves, spacing, and varied pace", () => {
  const tuning = engine.match(/const NPC_DRIVING_TUNING = \{([\s\S]*?)\} as const;/);
  assert.ok(tuning, "NPC driving tuning must remain explicit");
  const keys = [...tuning[1].matchAll(/([A-Za-z][A-Za-z0-9]*):/g)].map((entry) => entry[1]);
  assert.equal(keys.length, 20, "traffic tuning must expose twenty independent controls");
  assert.match(engine, /const speedVariation = 1/);
  assert.match(engine, /const curveFactor = Math\.max\(NPC_DRIVING_TUNING\.curveSpeedFloor/);
  assert.match(engine, /NPC_DRIVING_TUNING\.signalLaneLock/);
  assert.match(engine, /NPC_DRIVING_TUNING\.playerHornReactionRange/);
});

test("passenger system exposes and uses twenty independent gameplay tuning controls", () => {
  const tuning = engine.match(/const PASSENGER_SYSTEM_TUNING = \{([\s\S]*?)\} as const;/);
  assert.ok(tuning, "passenger tuning must remain explicit");
  const keys = [...tuning[1].matchAll(/([A-Za-z][A-Za-z0-9]*):/g)].map((entry) => entry[1]);
  assert.equal(keys.length, 20);
  for (const key of keys) {
    assert.ok(engine.includes(`PASSENGER_SYSTEM_TUNING.${key}`), `unused passenger tuning: ${key}`);
  }
  assert.match(engine, /const hubChance = PASSENGER_SYSTEM_TUNING\.baseSpawnChance/);
  assert.match(engine, /const stopChance = i % 5 === 4/);
  assert.match(engine, /const fare = Math\.max\(1, Math\.round\(\(PASSENGER_SYSTEM_TUNING\.baseFare/);
});

test("driving feedback exposes and uses thirty explicit fuel, collision, radar, toll and bump controls", () => {
  const tuning = engine.match(/const DRIVING_FEEDBACK_TUNING = \{([\s\S]*?)\} as const;/);
  assert.ok(tuning, "driving feedback tuning must remain explicit");
  const keys = [...tuning[1].matchAll(/([A-Za-z][A-Za-z0-9]*):/g)].map((entry) => entry[1]);
  assert.equal(keys.length, 30);
  for (const key of keys) {
    assert.ok(engine.includes(`DRIVING_FEEDBACK_TUNING.${key}`), `unused driving feedback tuning: ${key}`);
  }
  assert.match(engine, /DRIVING_FEEDBACK_TUNING\.collisionFineThreshold/);
  assert.match(engine, /DRIVING_FEEDBACK_TUNING\.fuelThrottleRate/);
  assert.match(engine, /DRIVING_FEEDBACK_TUNING\.radarRushTimePenalty/);
  assert.match(engine, /DRIVING_FEEDBACK_TUNING\.gasStationStopSpeed/);
});
