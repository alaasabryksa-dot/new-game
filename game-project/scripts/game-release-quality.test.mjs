import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [engine, ui, routeSource, routeData, photoRefs, packageJson] = await Promise.all([
  read("../src/game/engine.ts"),
  read("../src/components/dar-salam.tsx"),
  read("../src/game/data/fayoum-route.ts"),
  read("../src/game/data/fayoum-route-candidate.json").then(JSON.parse),
  read("../src/game/data/fayoum-photo-references.json").then(JSON.parse),
  read("../package.json").then(JSON.parse),
]);

test("the game identifies the requested street without overstating map verification", () => {
  assert.match(ui, /توكتوك شارع الفيوم/);
  assert.match(routeSource, /still needs on-site validation/);
  assert.equal(routeData.validation.fieldVerified, false);
  assert.equal(routeData.validation.connected, true);
  assert.equal(routeData.validation.closed, true);
  assert.ok(routeData.coordinates.length >= 100);
  assert.ok(routeData.segments.some((segment) => segment[1] === "شارع الفيوم"));
});

test("photo references preserve rights and historical-source caveats", () => {
  assert.ok(photoRefs.references.length >= 2);
  assert.match(photoRefs.purpose, /do not bundle or redistribute/);
  assert.ok(photoRefs.caveats.some((line) => /historical/.test(line)));
});

test("storefront signs are generic categories, not claimed real shop names", () => {
  assert.match(engine, /Fictional category labels/);
  const match = engine.match(/const signLabels = \[([^\]]+)\]/);
  assert.ok(match);
  const labels = [...match[1].matchAll(/"([^"]+)"/g)].map((item) => item[1]);
  assert.ok(labels.length >= 8);
  assert.ok(!labels.some((label) => /شارع الفيوم|اسم محل|مؤسسة/.test(label)));
});

test("tuk-tuk model has canopy supports, side rails and paired mirrors", () => {
  assert.match(engine, /Open-sided canopy frame, side rails, mirrors/);
  assert.match(engine, /0\.78, 1\.42, -0\.58/);
  assert.match(engine, /-0\.78, 1\.42, -0\.58/);
});

test("the player can only drive a tuk-tuk; other vehicle types are traffic NPCs", () => {
  assert.match(engine, /let playerMesh = buildPlayer\("tuktuk"/);
  assert.match(engine, /cfg = \{ \.\.\.next, vehicle: "tuktuk" \}/);
  assert.match(engine, /swapPlayer\("tuktuk", cfg\.paint\)/);
  assert.match(ui, /vehicle: "tuktuk"/);
  assert.doesNotMatch(ui, /VEHICLES\.map|vehicleById\(/);
});

test("mobile performance budgets pedestrians and render pixel ratio", () => {
  assert.match(engine, /walkerBudget = constrainedDevice \? 18 : 32/);
  assert.match(engine, /pixelRatioCap = coarsePointer/);
  assert.match(engine, /constrainedDevice \? 1\.0 : 1\.2/);
});

test("steering inputs preserve player-visible left and right", () => {
  assert.match(engine, /down\("KeyA"\)[\s\S]{0,90}steer \+= 1/);
  assert.match(engine, /down\("KeyD"\)[\s\S]{0,90}steer -= 1/);
  assert.match(engine, /player\.yaw \+= steer \* spec\.turn/);
  assert.match(engine, /window\.__controlsTest =/);
  assert.match(engine, /setSteer: \(v: number\) =>/);
});

test("touch controls and game lifecycle retain focus-loss safeguards", () => {
  assert.match(ui, /const releaseInputs = \(\) =>/);
  assert.match(ui, /addEventListener\("visibilitychange"/);
  assert.match(engine, /const pauseForInterruption = \(\) =>/);
  assert.match(engine, /window\.addEventListener\("blur", onBlur\)/);
  assert.match(engine, /window\.addEventListener\("keydown", onDown\)/);
});

test("the project has reproducible typecheck, test and production build scripts", () => {
  assert.equal(typeof packageJson.scripts.typecheck, "string");
  assert.equal(typeof packageJson.scripts.test, "string");
  assert.equal(typeof packageJson.scripts.build, "string");
});
