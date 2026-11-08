import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [engine, ui, routeSource, routeData, photoRefs, packageJson, rootRoute] = await Promise.all([
  read("../src/game/engine.ts"),
  read("../src/components/dar-salam.tsx"),
  read("../src/game/data/fayoum-route.ts"),
  read("../src/game/data/fayoum-route-candidate.json").then(JSON.parse),
  read("../src/game/data/fayoum-photo-references.json").then(JSON.parse),
  read("../package.json").then(JSON.parse),
  read("../src/routes/__root.tsx"),
]);

test("the game identifies the requested street without overstating map verification", () => {
  assert.match(rootRoute, /const APP_NAME = "توكتوك دار السلام"/);
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
  assert.match(engine, /const androidDevice = \/Android\/i\.test\(navigator\.userAgent\)/);
  assert.match(engine, /pixelRatioCap = androidDevice/);
  assert.match(engine, /const POOL = androidDevice \? 12 : 64/);
  assert.match(engine, /function buildCityMobile\(/);
  assert.match(engine, /buildCity\(scene, track, androidDevice\)/);
  assert.match(engine, /if \(!androidDevice\) buildStreetFurniture/);
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


test("save data rejects non-finite values and clamps persisted wallet and upgrades", () => {
  assert.match(engine, /function finiteNonNegative\(value: unknown/);
  assert.match(engine, /Number\.isFinite\(parsed\)/);
  assert.match(engine, /finiteNonNegative\(p\.wallet, 10_000_000\)/);
  assert.match(engine, /finiteNonNegative\(p\.bestKm, 1_000_000\)/);
  assert.match(engine, /Math\.floor\(Math\.min\(3, finiteNonNegative\(n, 3\)\)\)/);
});

test("optional audio failures cannot block game startup", () => {
  assert.match(engine, /const AudioContextCtor = window\.AudioContext/);
  assert.match(engine, /if \(!AudioContextCtor\) return/);
  assert.match(engine, /Audio is optional: unsupported or blocked audio must never stop gameplay/);
  assert.match(engine, /this\.stop\(\);/);
});


test("gameplay interruption and manual pause persist the current run immediately", () => {
  assert.match(engine, /const pauseForInterruption = \(\) => \{[\s\S]*?persist\(\);[\s\S]*?phase = "pause";/);
  assert.match(engine, /pause: \(\) => \{[\s\S]*?persist\(\);[\s\S]*?phase = "pause";/);
  assert.match(engine, /window\.addEventListener\("pagehide", onPageHide\)/);
  assert.match(engine, /window\.removeEventListener\("pagehide", onPageHide\)/);
  assert.match(engine, /const onPageHide = \(\) => pauseForInterruption\(\)/);
});


test("fuel guidance distinguishes station approach, lane entry and stopping", () => {
  assert.match(engine, /fuel < 98 && gasD < 28/);
  assert.match(engine, /proj\.lat <= 2\.5\) hint = "ادخل يمين البنزينة"/);
  assert.match(engine, /Math\.abs\(player\.speed\) >= 2\.8\) hint = "هدّي عند البنزينة للتفويل"/);
  assert.match(engine, /hint = "اثبت عند البنزينة للتفويل"/);
  assert.match(engine, /fuel < 22 && gasD < 90/);
});

test("mobile HUD exposes an in-game sound toggle", () => {
  assert.match(ui, /aria-label=\{snap\.sound \? "كتم الصوت" : "تشغيل الصوت"\}/);
  assert.match(ui, /onClick=\{\(\) => game\.current\?\.toggleSound\(\)\}/);
  assert.match(ui, /snap\.sound \? <Volume2/);
  assert.match(ui, /: <VolumeX/);
});

test("cancelled touch gestures release every driving input", () => {
  assert.match(ui, /window\.addEventListener\("pointercancel", releaseInputs\)/);
  assert.match(ui, /window\.removeEventListener\("pointercancel", releaseInputs\)/);
  assert.match(ui, /const releaseInputs = \(\) => \{[\s\S]*?holds\.current = \{ l: false, r: false, g: false, b: false \}/);
});


test("driving HUD fuel and rent meters expose accessible progress values", () => {
  assert.match(ui, /role="progressbar"[\\s\\S]*?aria-label="مستوى البنزين"/);
  assert.match(ui, /aria-valuemin=\\{0\\}[\\s\\S]*?aria-valuemax=\\{100\\}/);
  assert.match(ui, /aria-valuenow=\\{Math\\.max\\(0, Math\\.min\\(100, snap\\.fuel\\)\\)\\}/);
  assert.match(ui, /role="progressbar"[\\s\\S]*?aria-label="تقدم سداد الإيجار"/);
  assert.match(ui, /aria-valuemax=\\{snap\\.rent\\}/);
  assert.match(ui, /aria-valuenow=\\{Math\\.max\\(0, Math\\.min\\(snap\\.rent, snap\\.money\\)\\)\\}/);
});
