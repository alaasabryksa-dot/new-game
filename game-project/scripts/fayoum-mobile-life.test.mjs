import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const engine = await readFile(new URL("../src/game/engine.ts", import.meta.url), "utf8");

test("Android gets compact instanced street-life props", () => {
  assert.match(engine, /function buildStreetFurnitureMobile\(/);
  assert.match(engine, /buildStreetFurnitureMobile\(scene, track\)/);
  assert.match(engine, /new THREE\.InstancedMesh/);
  assert.match(engine, /cartCanopies/);
  assert.match(engine, /treeCrowns/);
});

test("Android gets a reduced animated pedestrian crowd instead of no pedestrians", () => {
  assert.match(engine, /buildPedestrians\(scene, track, androidDevice\)/);
  assert.ok(engine.includes("PEDESTRIAN_TUNING.mobileWalkerBudget") && engine.includes("PEDESTRIAN_TUNING.constrainedWalkerBudget") && engine.includes("PEDESTRIAN_TUNING.desktopWalkerBudget"));
  assert.doesNotMatch(engine, /androidDevice \? \(\(\) => undefined\)/);
});


test("mobile audio suspends on interruptions and fully releases WebAudio resources", () => {
  assert.match(engine, /suspend\(\)\s*\{/);
  assert.match(engine, /void ctx\.suspend\(\)\.catch/);
  assert.match(engine, /sfx\.suspend\(\);/);
  assert.match(engine, /resume: \(\) =>[\s\S]*?sfx\.unlock\(\);/);
  assert.match(engine, /this\.osc\?\.disconnect\(\);[\s\S]*?this\.filter\?\.disconnect\(\);[\s\S]*?this\.gain\?\.disconnect\(\);/);
  assert.match(engine, /this\.osc = null;[\s\S]*?this\.filter = null;/);
  assert.match(engine, /if \(ctx && ctx\.state !== "closed"\) void ctx\.close\(\)\.catch/);
});
