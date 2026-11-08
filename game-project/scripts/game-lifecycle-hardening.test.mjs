import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const engine = await readFile(new URL("../src/game/engine.ts", import.meta.url), "utf8");
const ui = await readFile(new URL("../src/components/dar-salam.tsx", import.meta.url), "utf8");

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

test("minimap distinguishes passenger drop-off destinations from pickup points", () => {
  const mapStart = engine.indexOf("  function drawMap() {");
  const mapEnd = engine.indexOf("\\n  function frame(", mapStart);
  const map = engine.slice(mapStart, mapEnd);
  assert.match(map, /const passengerDestination = pax\\.some\\(\\(person\\) => person\\.dest === i\\)/);
  assert.match(map, /passengerDestination \\? "#d6a7ff" : "#1aa6a6"/);
  assert.match(map, /if \\(passengerDestination && !hot\\)/);
  assert.match(map, /ctx\\.arc\\(x, y, 4\\.2, 0, Math\\.PI \\* 2\\)/);
});
