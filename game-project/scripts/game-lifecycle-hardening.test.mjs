import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const engine = await readFile(new URL("../src/game/engine.ts", import.meta.url), "utf8");
const ui = await readFile(new URL("../src/components/dar-salam.tsx", import.meta.url), "utf8");

test("manual pause suspends continuous engine audio after saving the run", () => {
  assert.match(engine, /pause: () => {[\s\S]*?persist\(\);[\s\S]*?sfx\.suspend\(\);[\s\S]*?phase = "pause";/);
});

test("resume deliberately unlocks audio again after pause", () => {
  assert.match(engine, /resume: () => {[\s\S]*?phase = "play";[\s\S]*?sfx\.unlock\(\);/);
});

test("quit and manual finish stop the continuous engine sound", () => {
  assert.match(engine, /quit: () => {[\s\S]*?persist\(\);[\s\S]*?sfx\.suspend\(\);[\s\S]*?phase = "menu";/);
  assert.match(engine, /finish: () => {[\s\S]*?settle\(\);[\s\S]*?sfx\.suspend\(\);[\s\S]*?publish\(\);/);
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
