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
  assert.match(engine, /const sideSeed = seed \+ \(side === 1 \? 7919 : 0\);/);
  assert.match(engine, /const sideVariation = \(sideSeed % 1000\) \/ 1000;/);
  assert.match(engine, /new THREE\.CylinderGeometry\(0\.52, 0\.56, 1\.12, 9\)/);
  assert.match(engine, /roofTank\.count = roofTankCount;/);
  assert.match(engine, /roofTankTop\.count = roofTankCount;/);
});
