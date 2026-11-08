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
  assert.match(engine, /const walkerBudget = mobile \? 10 : constrainedDevice \? 18 : 32/);
  assert.doesNotMatch(engine, /androidDevice \? \(\(\) => undefined\)/);
});
