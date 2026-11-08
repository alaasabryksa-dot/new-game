import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const business = JSON.parse(await readFile(new URL("../src/game/data/fayoum-business-candidates.json", import.meta.url), "utf8"));
const landmarks = JSON.parse(await readFile(new URL("../src/game/data/fayoum-landmark-candidates.json", import.meta.url), "utf8"));

test("Fayoum business research records have unique IDs and traceable evidence", () => {
  assert.ok(business.candidates.length >= 20);
  const ids = business.candidates.map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length, "business candidate IDs must be unique");
  for (const item of business.candidates) {
    assert.ok(item.name && item.address && item.source && item.evidence, `incomplete business evidence: ${item.id}`);
    assert.ok(item.status, `missing verification status: ${item.id}`);
    assert.notEqual(item.status, "field_verified", "directory records must not be promoted to field-verified");
  }
});

test("newly researched storefronts remain unverified until current facade review", () => {
  for (const id of ["paris-clothes-92", "orange-express-matar"]) {
    const item = business.candidates.find((candidate) => candidate.id === id);
    assert.ok(item, `missing new business lead: ${id}`);
    assert.equal(item.status, "needs_current_visual_and_position_verification");
    assert.ok(item.sourceId, "map listing reference ID must be retained");
  }
});

test("landmark candidates retain uncertainty and unique source identities", () => {
  assert.equal(landmarks.landmarks.length, 4);
  const ids = landmarks.landmarks.map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const item of landmarks.landmarks) {
    assert.ok(item.name && item.address && item.sourceId && item.evidence);
    assert.match(item.status, /needs_/);
  }
});

test("documentation does not claim the 200-facade target is complete", async () => {
  const accuracy = await readFile(new URL("../FAYOUM-STREET-ACCURACY.md", import.meta.url), "utf8");
  assert.match(accuracy, /The 200-facade target remains open/);
  assert.match(accuracy, /not verified current tenants/);
});
