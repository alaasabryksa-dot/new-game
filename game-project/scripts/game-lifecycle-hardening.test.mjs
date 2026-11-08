import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const engine = await readFile(new URL("../src/game/engine.ts", import.meta.url), "utf8");
const ui = await readFile(new URL("../src/components/dar-salam.tsx", import.meta.url), "utf8");
const types = await readFile(new URL("../src/game/types.ts", import.meta.url), "utf8");

test("mobile controls release individual pointers even when pointer capture is unavailable", () => {
  assert.match(ui, /holds = useRef\(\{ l: new Set<number>\(\), r: new Set<number>\(\), g: new Set<number>\(\), b: new Set<number>\(\) \}\)/);
  assert.match(ui, /const onGlobalPointerUp = \(event: PointerEvent\) => \{[\s\S]*?delete\(event\.pointerId\)[\s\S]*?gameRef\.current\?\.setTouch/);
  assert.match(ui, /window\.addEventListener\("pointerup", onGlobalPointerUp\)/);
  assert.match(ui, /window\.removeEventListener\("pointerup", onGlobalPointerUp\)/);
  assert.match(ui, /onPointerUp: \(e: ReactPointer<HTMLButtonElement>\) => \{[\s\S]*?delete\(e\.pointerId\)/);
  assert.match(ui, /onPointerCancel: \(e: ReactPointer<HTMLButtonElement>\) => \{[\s\S]*?delete\(e\.pointerId\)/);
});

test("scene teardown persists progress before stopping the game loop", () => {
  const dispose = engine.slice(engine.lastIndexOf("    dispose: () => {"));
  assert.ok(dispose.indexOf("persist();") >= 0);
  assert.ok(dispose.indexOf("persist();") < dispose.indexOf("running = false;"));
  assert.ok(dispose.indexOf("running = false;") < dispose.indexOf("sfx.stop();"));
});

test("Escape-key resume resets the frame clock and unlocks audio", () => {
  const escapeResume = engine.slice(engine.indexOf("  const onDown = (e: KeyboardEvent) => {"), engine.indexOf("  const onUp ="));
  assert.match(escapeResume, /const isEscape = e\.code === "Escape"/);
  assert.match(escapeResume, /!isEscape[\s\S]*?target\.closest\("input, textarea, select, button/);
  assert.match(escapeResume, /phase === "pause"[\s\S]*?last = performance\.now\(\);[\s\S]*?acc = 0;[\s\S]*?phase = "play";[\s\S]*?sfx\.unlock\(\);[\s\S]*?publish\(\)/);
});

test("manual pause suspends continuous engine audio after saving the run", () => {
  const section = engine.slice(engine.lastIndexOf("    pause: () => {"), engine.lastIndexOf("    resume: () => {"));
  assert.ok(section.indexOf("persist();") >= 0);
  assert.ok(section.indexOf("sfx.suspend();") > section.indexOf("persist();"));
  assert.ok(section.indexOf('phase = "pause";') > section.indexOf("sfx.suspend();"));
});

test("resume deliberately unlocks audio again after pause", () => {
  const section = engine.slice(engine.lastIndexOf("    resume: () => {"), engine.lastIndexOf("    quit: () => {"));
  assert.ok(section.indexOf('phase = "play";') >= 0);
  assert.ok(section.indexOf("sfx.unlock();") > section.indexOf('phase = "play";'));
});

test("quit and manual finish stop the continuous engine sound", () => {
  const quit = engine.slice(engine.lastIndexOf("    quit: () => {"), engine.lastIndexOf("    finish: () => {"));
  const finish = engine.slice(engine.lastIndexOf("    finish: () => {"), engine.lastIndexOf("    buy: (id: UpgradeId) => {"));
  assert.ok(quit.indexOf("persist();") >= 0);
  assert.ok(quit.indexOf("sfx.suspend();") > quit.indexOf("persist();"));
  assert.ok(finish.indexOf("settle();") >= 0);
  assert.ok(finish.indexOf("sfx.suspend();") > finish.indexOf("settle();"));
});

test("automatic shift and rush completion suspend audio on the summary screen", () => {
  assert.match(engine, /if \(jobIndex >= JOBS_NEED\) \{[\s\S]*?phase = "summary";[\s\S]*?settle\(\);[\s\S]*?sfx\.suspend\(\);/);
  assert.match(engine, /if \(phase === "play" && cfg\.mode === "shift" && time >= SHIFT_SECONDS\) \{[\s\S]*?settle\(\);[\s\S]*?sfx\.suspend\(\);/);
});

test("WebGL context loss is recoverable and the restoration listener is cleaned up", () => {
  assert.match(ui, /const reportContextLoss = \(event: Event\) => \{[\s\S]*?event\.preventDefault\(\);/);
  assert.match(ui, /const reportContextRestored = \(\) => \{[\s\S]*?canvas\.getContext\("webgl2"\)[\s\S]*?gl\.isContextLost\(\)[\s\S]*?setStartupError\(null\)[\s\S]*?setReady\(true\)/);
  assert.match(ui, /addEventListener\("webglcontextrestored", reportContextRestored\)/);
  assert.match(ui, /removeEventListener\("webglcontextrestored", reportContextRestored\)/);
});

test("stop crowds respect the total InstancedMesh capacity on Android", () => {
  assert.match(engine, /for \(let sIdx = 0; sIdx < track\.stops\.length && i < PEOPLE; sIdx\+\+\)/);
  assert.match(engine, /Math\.min\(8, waiting\[sIdx\] \?\? 0, PEOPLE - i\)/);
  assert.match(engine, /for \(let k = 0; k < n && i < PEOPLE; k\+\+\)/);
});

test("NPC rendering reuses frame scratch state and keeps painter outside render", () => {
  const renderStart = engine.indexOf("  function render(dt: number) {");
  const renderEnd = engine.indexOf("\n  const mapPts", renderStart);
  const render = engine.slice(renderStart, renderEnd);
  assert.match(engine, /const hiddenNpcMatrix = new THREE\.Matrix4\(\)\.makeScale\(0, 0, 0\)/);
  assert.match(engine, /const cursors: Record<VehicleId, number> = \{/);
  assert.match(engine, /const paintNpc = \(kind: VehicleId,[\s\S]*?pool\.body\.setMatrixAt\(i, dummy\.matrix\)/);
  assert.match(engine, /pool\.brakes\.setMatrixAt\(i, braking \? dummy\.matrix : hiddenNpcMatrix\)/);
  assert.match(engine, /pool\.signalsLeft\.setMatrixAt\(i, turnDirection < 0 && blinkOn \? dummy\.matrix : hiddenNpcMatrix\)/);
  assert.match(engine, /pool\.signalsRight\.setMatrixAt\(i, turnDirection > 0 && blinkOn \? dummy\.matrix : hiddenNpcMatrix\)/);
  assert.match(render, /for \(const kind of KINDS\) cursors\[kind\] = 0/);
  assert.doesNotMatch(render, /new THREE\.Matrix4|dummy\.matrix\.clone\(\)|const paintNpc =/);
});

test("HUD selects the nearest upcoming passenger drop-off and publishes its distance", () => {
  assert.match(engine, /for \(const person of pax\) \{[\s\S]*?forwardDist\(track\.stops\[person\.dest\]\.s, proj\.s\)/);
  assert.match(engine, /nextDropoffName,\s*nextDropoffDist: Number\.isFinite\(nextDropoffDist\)/);
  assert.match(ui, /أقرب نزلة: \{snap\.nextDropoffName\} · \{snap\.nextDropoffDist\} م/);
});

test("low-fuel HUD reports forward route distance to the next gas station", () => {
  assert.match(engine, /const gasStationDist = Math\.round\(forwardDist\(track\.gasS, proj\.s\)\)/);
  assert.doesNotMatch(engine, /const gasStationDist = Math\.round\(Math\.abs\(wrapDelta\(track\.gasS, proj\.s, track\.total\)\)\)/);
  assert.match(engine, /fuel: Math\.max\(0, Math\.min\(100, fuel\)\),\s*fuelRange,\s*gasStationDist,/);
  assert.match(ui, /snap\.fuel <= 35[\s\S]*?البنزينة: \{snap\.gasStationDist\} م/);
});

test("stop guidance distinguishes passenger drop-offs from pickups", () => {
  assert.match(engine, /const droppingHere = pax\.some\(\(person\) => person\.dest === targetI\)/);
  assert.match(engine, /const waitingHere = waiting\[targetI\] > 0/);
  assert.ok(engine.includes("قف يمينًا لتنزيل الركاب"));
  assert.ok(engine.includes("قف عند المحطة لاستلام الركاب"));
  assert.ok(engine.includes("تنزيل الركاب واستلام المنتظرين"));
});

test("minimap distinguishes passenger drop-off destinations from pickup points", () => {
  const mapStart = engine.indexOf("  function drawMap() {");
  const mapEnd = engine.indexOf("\n  function frame(", mapStart);
  const map = engine.slice(mapStart, mapEnd);
  assert.ok(map.includes("const passengerDestination = pax.some((person) => person.dest === i);"));
  assert.ok(map.includes('passengerDestination ? "#d6a7ff" : "#1aa6a6"'));
  assert.ok(map.includes("if (passengerDestination && !hot)"));
  assert.ok(map.includes("ctx.arc(x, y, 4.2, 0, Math.PI * 2)"));
});

test("pedestrian player-avoidance smoothing is frame-rate independent and delta-clamped", () => {
  assert.match(engine, /let previousUpdateTime: number \| null = null/);
  assert.match(engine, /THREE\.MathUtils\.clamp\(time - previousUpdateTime, 0, 0\.1\)/);
  assert.match(engine, /1 - Math\.exp\(-PEDESTRIAN_TUNING\.avoidanceResponse \* 60 \* elapsed\)/);
  assert.match(engine, /walker\.avoidanceOffset \+= \(targetAvoidance - walker\.avoidanceOffset\) \* avoidanceBlend/);
});


test("confirmed street directory preserves twelve ordered entrances on each side", () => {
  const block = types.match(/export const STREET_ENTRANCES: readonly StreetEntrance\[\] = \[([\s\S]*?)\n\];/);
  assert.ok(block, "player-confirmed street entrance data must remain explicit");
  const left = [...block[1].matchAll(/side: "left" as const, sideOrder: index \+ 1/g)];
  const right = [...block[1].matchAll(/side: "right" as const, sideOrder: index \+ 1/g)];
  assert.equal(left.length, 1, "left-side list should be mapped into ordered entries once");
  assert.equal(right.length, 1, "right-side list should be mapped into ordered entries once");
  assert.match(block[1], /"شارع حسن مطر"[\s\S]*?"شارع إسماعيل الليثي"/);
  assert.match(block[1], /"شارع أحمد عسلاقي"[\s\S]*?"شارع الحرية"/);
});

test("menu exposes the confirmed street directory without pretending it is mapped", () => {
  assert.match(ui, /دليل الشوارع المثبتة \(\{STREET_ENTRANCES\.length\}\)/);
  assert.match(ui, /STREET_ENTRANCES\.filter\(\(entry\) => entry\.side === side\)/);
  assert.match(ui, /\.sort\(\(a, b\) => a\.sideOrder - b\.sideOrder\)/);
  assert.match(ui, /لم نحدد بعد ترتيب المرور بين الجانبين أو موقع النزول الدقيق على الخريطة/);
});

test("mobile driving inputs are released when the page is being hidden", () => {
  assert.match(ui, /window\.addEventListener\("pagehide", releaseInputs\)/);
  assert.match(ui, /window\.removeEventListener\("pagehide", releaseInputs\)/);
});

test("global pointer release clears every matching control set before syncing touch state", () => {
  const start = ui.indexOf("const onGlobalPointerUp = (event: PointerEvent) => {");
  const end = ui.indexOf("\n    };", start);
  const handler = ui.slice(start, end);
  assert.match(handler, /releasedLeft = h\.l\.delete\(event\.pointerId\)/);
  assert.match(handler, /releasedRight = h\.r\.delete\(event\.pointerId\)/);
  assert.match(handler, /releasedThrottle = h\.g\.delete\(event\.pointerId\)/);
  assert.match(handler, /releasedBrake = h\.b\.delete\(event\.pointerId\)/);
  assert.match(handler, /gameRef\.current\?\.setTouch/);
});
