import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [engine, ui, routeSource, routeData, photoRefs, packageJson, rootRoute, trackSource] = await Promise.all([
  read("../src/game/engine.ts"),
  read("../src/components/dar-salam.tsx"),
  read("../src/game/data/fayoum-route.ts"),
  read("../src/game/data/fayoum-route-candidate.json").then(JSON.parse),
  read("../src/game/data/fayoum-photo-references.json").then(JSON.parse),
  read("../package.json").then(JSON.parse),
  read("../src/routes/__root.tsx"),
  read("../src/game/track.ts"),
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
  assert.ok(engine.includes("PEDESTRIAN_TUNING.mobileWalkerBudget") && engine.includes("PEDESTRIAN_TUNING.constrainedWalkerBudget") && engine.includes("PEDESTRIAN_TUNING.desktopWalkerBudget"));
  assert.match(engine, /const androidDevice = \/Android\/i\.test\(navigator\.userAgent\)/);
  assert.match(engine, /pixelRatioCap = androidDevice/);
  assert.match(engine, /const POOL = androidDevice \? 12 : 64/);
  assert.match(engine, /function buildCityMobile\(/);
  assert.match(engine, /buildCity\(scene, track, androidDevice\)/);
  assert.match(engine, /if \(androidDevice\) buildStreetFurnitureMobile\(scene, track\)/);
  assert.match(engine, /else buildStreetFurniture\(scene, track\)/);
  assert.match(engine, /const animatePedestrians = buildPedestrians\(scene, track, androidDevice\)/);
});

test("traffic lane changes increase front and rear clearance for closing speed", () => {
  assert.match(engine, /playerAheadBuffer = 12 \+ spec\.length \* 0\.4[\s\S]*?Math\.max\(0, n\.speed - player\.speed\) \* 1\.1/);
  assert.match(engine, /playerBehindBuffer = 10 \+ Math\.max\(0, player\.speed - n\.speed\)/);
  assert.match(engine, /frontBuffer = 11 \+ spec\.length \* 0\.4[\s\S]*?Math\.max\(0, n\.speed - o\.speed\) \* 1\.2/);
  assert.match(engine, /rearBuffer = 9 \+ otherSpec\.length \* 0\.3[\s\S]*?Math\.max\(0, o\.speed - n\.speed\) \* 1\.1/);
});

test("traffic respawn excludes the player lane only when actually nearby", () => {
  assert.match(engine, /Math\.abs\(lane - playerLane\) < 0\.72 && Math\.abs\(wrapDelta\(proj\.s, n\.s, track\.total\)\) < 45/);
  assert.doesNotMatch(engine, /Math\.abs\(lane - playerLane\) < 0\.72 && wrapDelta\(proj\.s, n\.s, track\.total\) < 45/);
});

test("traffic respawn uses maximum-clearance lane when no lane is fully free", () => {
  assert.match(engine, /const fallbackLane = \[0, 1, 2, 3\]\.map\(\(lane\) =>/);
  assert.match(engine, /clearance = Math\.min\(clearance, Math\.abs\(wrapDelta\(other\.s, n\.s, track\.total\)\)\)/);
  assert.match(engine, /safeLanes\.length \? safeLanes\[Math\.floor\(Math\.random\(\) \* safeLanes\.length\)\] : fallbackLane/);
  assert.doesNotMatch(engine, /safeLanes\.length \? safeLanes\[Math\.floor\(Math\.random\(\) \* safeLanes\.length\)\] : Math\.floor\(Math\.random\(\) \* 4\)/);
});

test("road-edge handling applies progressive shoulder drag before clamping", () => {
  assert.match(engine, /const shoulderStart = Math\.max\(0, limit - 1\.35\)/);
  assert.match(engine, /const shoulderDepth = Math\.max\(0, Math\.abs\(proj\.lat\) - shoulderStart\)/);
  assert.match(engine, /player\.speed \*= Math\.exp\(-dt \* shoulderDrag \* 1\.35\)/);
  assert.ok(engine.indexOf("shoulderDrag") < engine.indexOf("if (Math.abs(proj.lat) > limit)"));
});

test("rush delivery routes avoid repeating a destination within the same run", () => {
  assert.match(engine, /function rollJobs\\(fromStop: number\\)/);
  assert.match(engine, /const available = Array\\.from\\(/);
  assert.match(engine, /\\.filter\\(\\(candidate\\) => !jobs\\.includes\\(candidate\\.dest\\)\\)/);
  assert.match(engine, /const preferred = available\\.filter\\(\\(candidate\\) =>[\\s\\S]*?JOB_ROUTE_TUNING\\.minHop[\\s\\S]*?JOB_ROUTE_TUNING\\.maxHop/);
  assert.match(engine, /const routeCandidates = preferred\\.length \\? preferred : available/);
  assert.match(engine, /const totalWeight = weighted\\.reduce/);
});

test("passenger boarding spreads drop-off destinations when alternatives are available", () => {
  assert.match(engine, /const assignedDestinations = new Set\(pax\.map\(\(person\) => person\.dest\)\)/);
  assert.match(engine, /\.filter\(\(candidate\) => !assignedDestinations\.has\(candidate\.dest\)\)/);
  assert.match(engine, /assignedDestinations\.add\(dest\)/);
  assert.match(engine, /const choices = candidates\.length[\s\S]*?choices\[Math\.floor\(Math\.random\(\) \* choices\.length\)\]/);
});


test("passenger boarding widens destination choices before reusing a drop-off", () => {
  assert.match(engine, /const extendedCandidates = \[PASSENGER_SYSTEM_TUNING\.destinationHopMin, 3, 4, 5, PASSENGER_SYSTEM_TUNING\.destinationHopMax\]/);
  assert.ok(engine.includes(": extendedCandidates.length"));
  assert.ok(engine.includes("? extendedCandidates"));
  assert.match(engine, /: \[PASSENGER_SYSTEM_TUNING\.destinationHopMin, 3, 4, 5, PASSENGER_SYSTEM_TUNING\.destinationHopMax\]\.map/);
});

test("fuel consumption accounts for speed as well as passenger load", () => {
  assert.match(engine, /const speedFactor = 1 \+ Math\.min\(DRIVING_FEEDBACK_TUNING\.speedFuelLoadCap, Math\.abs\(player\.speed\) \/ Math\.max\(1, spec\.max\) \* DRIVING_FEEDBACK_TUNING\.speedFuelLoadCap\)/);
  assert.match(engine, /loadFactor \* speedFactor \* dt/);
});

test("opposing traffic collision checks road-aligned length and lane width", () => {
  assert.match(engine, /wrongLongitudinalGap = Math\.abs\(wrapDelta\(w\.s, proj\.s, track\.total\)\)/);
  assert.match(engine, /wrongLateralGap = Math\.abs\(w\.lat - proj\.lat\)/);
  assert.match(engine, /wrongLongitudinalGap >= \(specNow\(\)\.length \+ wrongLength\) \* 0\.5/);
  assert.match(engine, /wrongLateralGap >= \(specNow\(\)\.width \+ wrongWidth\) \* 0\.5 \+ 0\.18/);
});

test("steering input eases smoothly with a frame-rate-independent response", () => {
  assert.match(engine, /let steeringInput = 0/);
  assert.match(engine, /const steeringResponse = 1 - Math\.exp\(-dt \* 9\)/);
  assert.match(engine, /steeringInput \+= \(steer - steeringInput\) \* steeringResponse/);
  assert.match(engine, /player\.yaw \+= steeringInput \* spec\.turn/);
});

test("steering inputs preserve player-visible left and right", () => {
  assert.match(engine, /down\("KeyA"\)[\s\S]{0,90}steer \+= 1/);
  assert.match(engine, /down\("KeyD"\)[\s\S]{0,90}steer -= 1/);
  assert.match(engine, /player\.yaw \+= steeringInput \* spec\.turn/);
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

test("the minimap redraw is throttled independently from the 3D frame rate", () => {
  assert.ok(engine.includes("let mapDrawClock = 0.1"));
  assert.ok(engine.includes("mapDrawClock += dt"));
  assert.ok(engine.includes("if (mapDrawClock >= 0.1)"));
  assert.ok(engine.includes("mapDrawClock %= 0.1"));
  assert.ok(engine.includes("drawMap();"));
});

test("traffic collision checks longitudinal and lateral vehicle overlap separately", () => {
  assert.ok(engine.includes("const longitudinalGap = Math.abs(wrapDelta(n.s, proj.s, track.total))"));
  assert.ok(engine.includes("const lateralGap = Math.abs(laneLat(n.lane) - proj.lat)"));
  assert.ok(engine.includes("const longitudinalReach = (spec.length + other.length) * 0.5"));
  assert.ok(engine.includes("const lateralReach = (spec.width + other.width) * 0.5 + 0.18"));
  assert.ok(engine.includes("if (longitudinalGap >= longitudinalReach || lateralGap >= lateralReach) continue"));
});

test("collision fine message matches the amount deducted", () => {
  assert.ok(engine.includes("money = Math.max(0, money - DRIVING_FEEDBACK_TUNING.collisionFineAmount)"));
  assert.ok(engine.includes("say(`خبطة! غرامة ${DRIVING_FEEDBACK_TUNING.collisionFineAmount} ج`)"));
  assert.ok(!engine.includes('say("خبطة! غرامة ٤٠ ج")'));
});

test("visible traffic lights and NPC stopping share staggered per-stop signal phases", () => {
  assert.ok(engine.includes("const TRAFFIC_SIGNAL_CYCLE = 15"));
  assert.ok(engine.includes("const TRAFFIC_RED_SECONDS = 7.5"));
  assert.ok(engine.includes("const TRAFFIC_AMBER_SECONDS = 1.3"));
  assert.match(engine, /const signalIndex = Math\.floor\(headIndex \/ 2\)/);
  assert.match(engine, /time \+ signalIndex \* 2\.4/);
  assert.match(engine, /const stopCycle = \(trafficClock \+ stopIndex \* 2\.4\) % TRAFFIC_SIGNAL_CYCLE/);
  assert.match(engine, /nearestSignalCycle = stopCycle/);
  assert.match(engine, /redStopDistance = Math\.min\(redStopDistance, distanceToLine\)/);
  assert.match(engine, /nearestSignalCycle >= TRAFFIC_RED_SECONDS \+ TRAFFIC_AMBER_SECONDS/);
  assert.match(engine, /greenElapsed = Math\.max\(0, nearestSignalCycle - releaseAt\)/);
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
  assert.ok(ui.includes('role="progressbar"'));
  assert.ok(ui.includes('aria-label="مستوى البنزين"'));
  assert.ok(ui.includes("aria-valuemin={0}"));
  assert.ok(ui.includes("aria-valuemax={100}"));
  assert.ok(ui.includes("aria-valuenow={Math.max(0, Math.min(100, snap.fuel))}"));
  assert.ok(ui.includes('aria-label="تقدم سداد الإيجار"'));
  assert.ok(ui.includes("aria-valuemax={snap.rent}"));
  assert.ok(ui.includes("aria-valuenow={Math.max(0, Math.min(snap.rent, snap.money))}"));
});


test("mobile driving HUD exposes ten clear assistive and feedback cues", () => {
  assert.ok(ui.includes('aria-label={`السرعة ${snap.speed} كيلومتر في الساعة`}'));
  assert.ok(ui.includes('aria-label="الركاب المنتظرون في المحطة"'));
  assert.ok(ui.includes("aria-valuemax={8}"));
  assert.ok(ui.includes('aria-label="الركاب الموجودون في التوكتوك"'));
  assert.ok(ui.includes('aria-label="عدادات القيادة"'));
  assert.ok(ui.includes('role="status" aria-live="polite" aria-atomic="true"'));
  assert.ok(ui.includes("aria-pressed={!snap.sound}"));
  assert.ok(ui.includes('aria-label="تغيير زاوية الكاميرا"'));
  assert.ok(ui.includes('role="dialog" aria-modal="true"'));
  assert.ok(ui.includes('aria-label={`المسافة إلى المحطة ${snap.stopDist} متر`}'));
  assert.ok(ui.includes('aria-label="معلومات المحطة والوجهة"'));
});


test("mobile menus and driving controls expose selected states and clear labels", () => {
  assert.ok(ui.includes("aria-pressed={cfg.mode === m.id}"));
  assert.ok(ui.includes("aria-pressed={cfg.paint === p.hex}"));
  assert.ok(ui.includes("aria-pressed={cfg.density === d.id}"));
  assert.ok(ui.includes("aria-pressed={cfg.night}"));
  assert.ok(ui.includes("aria-pressed={!cfg.sound}"));
  assert.ok(ui.includes('aria-label={snap.phase === "pause" ? "استئناف القيادة" : "إيقاف مؤقت"}'));
  assert.ok(ui.includes('aria-label="إطلاق الكلاكس"'));
  assert.ok(ui.includes('title="تغيير زاوية الكاميرا"'));
  assert.ok(ui.includes('aria-label="أزرار التحكم الإضافية"'));
  assert.ok(ui.includes('aria-label="أزرار قيادة التوكتوك"'));
});


test("traffic signals are staggered per stop and NPCs obey each visible phase", () => {
  assert.match(engine, /const signalIndex = Math\.floor\(headIndex \/ 2\)/);
  assert.match(engine, /time \+ signalIndex \* 2\.4/);
  assert.match(engine, /const stopCycle = \(trafficClock \+ stopIndex \* 2\.4\) % TRAFFIC_SIGNAL_CYCLE/);
  assert.match(engine, /nearestSignalCycle = stopCycle/);
  assert.match(engine, /redStopDistance = Math\.min\(redStopDistance, distanceToLine\)/);
  assert.match(engine, /if \(redStopDistance < Infinity\)/);
  assert.match(engine, /nearestSignalCycle >= TRAFFIC_RED_SECONDS \+ TRAFFIC_AMBER_SECONDS/);
  assert.match(engine, /greenElapsed = Math\.max\(0, nearestSignalCycle - releaseAt\)/);
});

test("new-run starting stop selection respects the closed route wrap", () => {
  assert.match(engine, /const here = track\.stops\.reduce\(\(best, stop, i\) => \{/);
  assert.match(engine, /Math\.abs\(wrapDelta\(stop\.s, startS, track\.total\)\)/);
  assert.doesNotMatch(engine, /const d = Math\.abs\(stop\.s - startS\)/);
});

test("route distance helper measures correctly across the closed-loop seam", () => {
  const match = trackSource.match(/export function wrapDelta\(a: number, b: number, total: number\) \{([\s\S]*?)\n\}/);
  assert.ok(match, "wrapDelta implementation must remain available");
  const wrapDelta = new Function("a", "b", "total", match[1]);
  assert.equal(wrapDelta(2, 98, 100), 4);
  assert.equal(wrapDelta(98, 2, 100), -4);
  assert.equal(wrapDelta(25, 10, 100), 15);
  assert.equal(wrapDelta(10, 25, 100), -15);
});


test("Android backgrounding stops the render loop and safely restarts it on return", () => {
  assert.match(engine, /if \(document\.visibilityState === "hidden"\) \{\s*raf = 0;\s*return;/);
  assert.match(engine, /if \(raf\) cancelAnimationFrame\(raf\);\s*raf = 0;/);
  assert.match(engine, /last = performance\.now\(\);\s*acc = 0;\s*if \(running && raf === 0\) raf = requestAnimationFrame\(frame\);/);
  assert.match(engine, /Android WebViews may suspend animation frames while backgrounded/);
});


test("Android touch input remains active when pointer capture is unavailable", () => {
  assert.match(ui, /holds\.current\[key\] = true;\s*syncTouch\(\);\s*try \{[\s\S]*?setPointerCapture\(e\.pointerId\)/);
  assert.match(ui, /Pointer capture is an enhancement; the touch control must still work/);
});
