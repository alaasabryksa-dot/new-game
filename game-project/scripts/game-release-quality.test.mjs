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
  assert.match(engine, /const POOL = androidDevice \? 20 : 64/);
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
  assert.ok(engine.includes("function rollJobs(fromStop: number)"));
  assert.ok(engine.includes("const available = Array.from("));
  assert.ok(engine.includes(".filter((candidate) => !jobs.includes(candidate.dest))"));
  assert.ok(engine.includes("JOB_ROUTE_TUNING.minHop"));
  assert.ok(engine.includes("JOB_ROUTE_TUNING.maxHop"));
  assert.ok(engine.includes("const routeCandidates = preferred.length ? preferred : available"));
  assert.ok(engine.includes("const totalWeight = weighted.reduce"));
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

test("live fuel use and range estimate share a balanced, independently tested model", () => {
  const match = engine.match(/function calculateFuelBurnRate\(([\s\S]*?)\) \{([\s\S]*?)\n\}/);
  assert.ok(match, "fuel burn helper must be independently testable");
  const calculate = new Function("finiteNonNegative", "clampLvl", "DRIVING_FEEDBACK_TUNING", "throttle", "moving", "speedRatio", "passengerCount", "fuelUpgrade", match[2] + "\nreturn calculateFuelBurnRate(throttle, moving, speedRatio, passengerCount, fuelUpgrade);");
  const finite = (value, max = 1_000_000_000) => Number.isFinite(value) ? Math.min(max, Math.max(0, value)) : 0;
  const clamp = (value) => Math.floor(Math.min(3, finite(value, 3)));
  const tuning = { fuelIdleRate: 0.16, fuelThrottleRate: 0.3, passengerFuelLoadCap: 0.24, passengerFuelLoadStep: 0.045, speedFuelLoadCap: 0.35 };
  const burn = (throttle, moving, speed, passengers, upgrade) => calculate(finite, clamp, tuning, throttle, moving, speed, passengers, upgrade);
  const base = burn(0.65, true, 0.5, 2, 0);
  const upgraded = burn(0.65, true, 0.5, 2, 3);
  assert.ok(base > 0.45 && base < 0.47, "base setup should last through a standard three-minute shift under the reference load");
  assert.ok(upgraded < base * 0.44, "maximum fuel upgrade must materially extend range");
  assert.ok(burn(0, false, 0, 0, 0) < base * 0.1, "idling must consume less fuel than driving");
  assert.ok(burn(0.65, true, 0.5, 3, 0) > base, "passenger load must increase consumption");
  assert.ok(burn(0.65, true, 1, 2, 0) > base, "higher speed must increase consumption");
  assert.match(engine, /const fuelBurnRate = calculateFuelBurnRate([\s\S]*?fuel -= fuelBurnRate \* dt/);
  assert.match(engine, /const estimateFuelRate = calculateFuelBurnRate\(/);
});

test("driving fines are proportionate to typical passenger fares", () => {
  const tuning = engine.match(/const DRIVING_FEEDBACK_TUNING = \{([\s\S]*?)\} as const;/);
  assert.ok(tuning);
  assert.match(tuning[1], /collisionFineAmount: 25/);
  assert.match(tuning[1], /radarFineAmount: 45/);
  assert.match(tuning[1], /tollFineAmount: 10/);
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


test("fuel range estimate uses the live fuel-efficiency and passenger-load model", () => {
  assert.match(engine, /const estimateSpeed = Math\.min\(8, Math\.max\(4, spec\.max \* 0\.5\)\)/);
  assert.match(engine, /const estimateLoad = pax\.length > 0[\s\S]*?passengerFuelLoadCap[\s\S]*?passengerFuelLoadStep/);
  assert.match(engine, /Math\.max\(0\.42, 1 - save\.upgrades\.fuel \* 0\.19\)/);
  assert.match(engine, /const fuelRange = Math\.max\(0, Math\.round\(/);
  assert.match(engine, /fuelRange,/);
  assert.match(ui, /مدى تقريبي: \{snap\.fuelRange\.toFixed\(1\)\} كم/);
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
  assert.match(ui, /const releaseInputs = \(\) => \{[\s\S]*?holds\.current\.l\.clear\(\)[\s\S]*?holds\.current\.r\.clear\(\)[\s\S]*?holds\.current\.g\.clear\(\)[\s\S]*?holds\.current\.b\.clear\(\)/);
  assert.match(ui, /window\.addEventListener\("pointerup", onGlobalPointerUp\)/);
  assert.match(ui, /window\.removeEventListener\("pointerup", onGlobalPointerUp\)/);
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


test("constrained devices adapt render resolution only after sustained slow frames", () => {
  assert.match(engine, /let adaptivePixelScale = 1;[\s\S]*?let slowFrameSeconds = 0;[\s\S]*?let smoothFrameSeconds = 0;/);
  assert.match(engine, /rawFrameSeconds > 0\.034[\s\S]*?slowFrameSeconds \+= Math\.min\(rawFrameSeconds, 0\.1\)/);
  assert.match(engine, /slowFrameSeconds >= 2[\s\S]*?adaptivePixelScale - 0\.08[\s\S]*?resize\(\)/);
  assert.match(engine, /smoothFrameSeconds >= 14[\s\S]*?adaptivePixelScale \+ 0\.04[\s\S]*?resize\(\)/);
  assert.match(engine, /const dprFloor = androidDevice \? 0\.5 : 0\.65;[\s\S]*?baseDpr \* adaptivePixelScale/);
  assert.match(engine, /simulation and physics remain fixed at 60 Hz/);
});

test("Android instanced vehicle pools can render the maximum weighted traffic population", () => {
  assert.match(engine, /const POOL = androidDevice \? 20 : 64/);
  const weights = ["tuktuk", "tuktuk", "tuktuk", "micro", "micro", "taxi", "malaky", "tuktuk", "truck"];
  const counts = new Map();
  for (let i = 0; i < 44; i++) counts.set(weights[i % weights.length], (counts.get(weights[i % weights.length]) ?? 0) + 1);
  assert.equal(counts.get("tuktuk"), 20);
  assert.ok([...counts.values()].every((count) => count <= 20));
  assert.match(engine, /if \(i >= POOL\) return/);
});

test("Android backgrounding stops the render loop and safely restarts it on return", () => {
  assert.match(engine, /if \(document\.visibilityState === "hidden"\) \{\s*raf = 0;\s*return;/);
  assert.match(engine, /if \(raf\) cancelAnimationFrame\(raf\);\s*raf = 0;/);
  assert.match(engine, /last = performance\.now\(\);\s*acc = 0;\s*if \(running && raf === 0\) raf = requestAnimationFrame\(frame\);/);
  assert.match(engine, /Android WebViews may suspend animation frames while backgrounded/);
});


test("Android touch input remains active when pointer capture is unavailable", () => {
  assert.match(ui, /holds\.current\[key\]\.add\(e\.pointerId\);\s*syncTouch\(\);\s*try \{[\s\S]*?setPointerCapture\(e\.pointerId\)/);
  assert.match(ui, /onPointerUp: \(e: ReactPointer<HTMLButtonElement>\) => \{[\s\S]*?delete\(e\.pointerId\)/);
  assert.match(ui, /Pointer capture is an enhancement; the touch control must still work/);
});


test("shift settlement preserves earnings when rent cannot yet be fully paid", () => {
  assert.match(engine, /const settlement = calculateShiftSettlement\(money, save\.wallet, RENT\)/);
  assert.match(engine, /settlement\.rentRemaining > 0|settlement\.rentRemaining === 0/);
  assert.match(engine, /save\.wallet = settlement\.walletAfter/);
  assert.match(engine, /جمعت.*settlement\.rentRemaining.*على الإيجار/);
});

test("passenger fares scale predictably with trip distance and seat upgrades", () => {
  const match = engine.match(/function calculatePassengerFare\(hopCount: number, fareMultiplier: number\) \{([\s\S]*?)\n\}/);
  assert.ok(match, "passenger fare calculation must remain independently testable");
  const calculate = new Function("finiteNonNegative", "PASSENGER_SYSTEM_TUNING", "hopCount", "fareMultiplier", match[1]);
  const finite = (value, max = 1_000_000_000) => {
    const parsed = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(parsed)) return 0;
    return Math.min(max, Math.max(0, parsed));
  };
  const tuning = { baseFare: 24, farePerStop: 12 };
  const fare = (hops, multiplier) => calculate(finite, tuning, hops, multiplier);
  assert.equal(fare(2, 1), 48);
  assert.equal(fare(4, 1), 72);
  assert.equal(fare(6, 1), 96);
  assert.equal(fare(4, 1.22), 88);
  assert.equal(fare(4, 1.66), 120);
  assert.equal(fare(-4, 1), 24);
  assert.equal(fare(Number.NaN, 1), 24);
  assert.equal(fare(4, Number.NaN), 72);
  assert.match(engine, /const fare = calculatePassengerFare\(hop, spec\.fare\)/);
});

test("shift settlement math preserves money across paid, partial and overpaid rent cases", () => {
  const match = engine.match(/function calculateShiftSettlement\(earnings: number, wallet: number, rent: number\): ShiftSettlement \{([\s\S]*?)\n\}/);
  assert.ok(match, "pure settlement calculation must remain independently testable");
  const calculate = new Function("finiteNonNegative", "earnings", "wallet", "rent", match[1] + "\nreturn { rentPaid, rentRemaining, walletAfter };");
  const finite = (value, max = 1_000_000_000) => {
    const parsed = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(parsed)) return 0;
    return Math.min(max, Math.max(0, parsed));
  };
  const settle = (earnings, wallet, rent) => calculate(finite, earnings, wallet, rent);
  assert.deepEqual(settle(200, 30, 160), { rentPaid: 160, rentRemaining: 0, walletAfter: 70 });
  assert.deepEqual(settle(100, 100, 160), { rentPaid: 160, rentRemaining: 0, walletAfter: 40 });
  assert.deepEqual(settle(70, 20, 160), { rentPaid: 90, rentRemaining: 70, walletAfter: 90 });
  assert.deepEqual(settle(0, 0, 160), { rentPaid: 0, rentRemaining: 160, walletAfter: 0 });
  assert.deepEqual(settle(-50, 100, 160), { rentPaid: 100, rentRemaining: 60, walletAfter: 100 });
  assert.deepEqual(settle(Number.NaN, 100, 160), { rentPaid: 100, rentRemaining: 60, walletAfter: 100 });
});

test("shift summary reports exact rent paid, remaining balance and wallet delta", () => {
  assert.match(engine, /let walletAtRunStart = save\.wallet/);
  assert.match(engine, /const settlement = calculateShiftSettlement\(money, save\.wallet, RENT\)/);
  assert.match(engine, /settlementRentPaid = settlement\.rentPaid/);
  assert.match(engine, /settlementRentRemaining = settlement\.rentRemaining/);
  assert.match(engine, /save\.wallet = settlement\.walletAfter/);
  assert.match(engine, /settlementWalletChange = save\.wallet - walletAtRunStart/);
  assert.match(engine, /rentPaid: settlementRentPaid,[\s\S]*?rentRemaining: settlementRentRemaining,[\s\S]*?walletChange: settlementWalletChange/);
  assert.match(ui, /الإيجار المسدد/);
  assert.match(ui, /المتبقي من الإيجار/);
  assert.match(ui, /صافي تغير المحفظة/);
});

test("fuel station charges proportionally to the amount of fuel added", () => {
  assert.match(engine, /const refuelCost = Math\.max\(1, Math\.ceil\(\(\(100 - fuel\) \/ 100\) \* GAS_COST\)\)/);
  assert.match(engine, /if \(pay\(refuelCost\)\)[\s\S]*?fuel = 100[\s\S]*?تملى التانك — \$\{refuelCost\} ج/);
});

test("rush delivery payouts scale with the route hop count and are announced", () => {
  assert.match(engine, /const JOB_REWARD_TUNING = \{[\s\S]*?base: 35,[\s\S]*?perStop: 4/);
  assert.match(engine, /const hopCount = \(jobs\[jobIndex\] - fromStop \+ track\.stops\.length\) % track\.stops\.length/);
  assert.match(engine, /const reward = JOB_REWARD_TUNING\.base \+ hopCount \* JOB_REWARD_TUNING\.perStop/);
  assert.match(engine, /money \+= reward/);
  assert.match(engine, /وصلت \+\$\{reward\} ج/);
});
