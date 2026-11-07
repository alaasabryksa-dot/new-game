#!/usr/bin/env node
/**
 * Fetch the mapped Fayoum Street segment and roads attached to its endpoints.
 * Source: OpenStreetMap contributors (ODbL). This records raw geometry for review;
 * it deliberately does not guess how separate street segments should be joined.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const WAY_ID = Number(process.argv[2] || 37195082);
if (!Number.isSafeInteger(WAY_ID) || WAY_ID <= 0) {
  throw new Error(`Invalid OSM way ID: ${process.argv[2]}`);
}
const OUTPUT = resolve(
  process.argv[3] ?? "src/game/data/fayoum-street-osm.json",
);
const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

async function overpass(query) {
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    for (const endpoint of ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
          "user-agent": "NewGame-FayoumStreetResearch/1.0 (OSM data attribution included)",
        },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(20000),
      });
      if (!response.ok) throw new Error(`Overpass HTTP ${response.status}`);
      const data = await response.json();
      if (data.remark) throw new Error(data.remark);
      return data;
    } catch (error) {
      lastError = error;
    }
    }
  }
  throw lastError ?? new Error("All Overpass endpoints failed");
}

const warnings = [];
const apiResponse = await fetch(
  `https://api.openstreetmap.org/api/0.6/way/${WAY_ID}/full.json`,
  {
    headers: {
      "user-agent": "NewGame-FayoumStreetResearch/1.0 (OSM data attribution included)",
      accept: "application/json",
    },
    signal: AbortSignal.timeout(20000),
  },
);
if (!apiResponse.ok) {
  throw new Error(`OpenStreetMap API HTTP ${apiResponse.status}`);
}
const apiData = await apiResponse.json();
const seed = apiData.elements?.find(
  (element) => element.type === "way" && element.id === WAY_ID,
);
const nodeById = new Map(
  (apiData.elements ?? [])
    .filter((element) => element.type === "node")
    .map((node) => [node.id, node]),
);
if (!seed || !Array.isArray(seed.nodes) || seed.nodes.length < 2) {
  throw new Error(`OSM way ${WAY_ID} was not returned with its node references`);
}
const seedGeometry = seed.nodes.map((nodeId) => {
  const node = nodeById.get(nodeId);
  if (!node || !Number.isFinite(node.lat) || !Number.isFinite(node.lon)) {
    throw new Error(`Missing coordinates for OSM node ${nodeId}`);
  }
  return { lat: node.lat, lon: node.lon };
});
const seedWithGeometry = { ...seed, geometry: seedGeometry };
const endpointIds = [seed.nodes[0], seed.nodes[seed.nodes.length - 1]];
const ways = new Map([[WAY_ID, seedWithGeometry]]);
try {
  const connectedQuery =
    `[out:json][timeout:25];node(id:${endpointIds.join(",")});` +
    `way(bn)[highway];out geom;`;
  const connectedData = await overpass(connectedQuery);
  for (const element of connectedData.elements ?? []) {
    if (element.type === "way" && Array.isArray(element.geometry)) {
      ways.set(element.id, element);
    }
  }
} catch (error) {
  warnings.push(
    `Endpoint-connected roads were not fetched: ${error instanceof Error ? error.message : String(error)}`,
  );
}

const output = {
  source: "OpenStreetMap contributors",
  licence: "Open Database License (ODbL) 1.0",
  attribution: "© OpenStreetMap contributors",
  fetchedAt: new Date().toISOString(),
  seedWayId: WAY_ID,
  seedNodeIds: seed.nodes,
  endpointNodeIds: endpointIds,
  warnings,
  note:
    "Raw mapped ways only. Review names, direction, continuity and coverage before using as the playable route.",
  ways: [...ways.values()].map((way) => ({
    id: way.id,
    tags: way.tags ?? {},
    nodeIds: way.nodes ?? [],
    coordinates: (way.geometry ?? []).map(({ lat, lon }) => [lon, lat]),
  })),
};

await mkdir(dirname(OUTPUT), { recursive: true });
await writeFile(OUTPUT, `${JSON.stringify(output, null, 2)}\n`);
console.log(
  `Saved ${output.ways.length} mapped ways (${[...ways.keys()].join(", ")}) to ${OUTPUT}`,
);
console.log("Review the connected ways before joining them into the game track.");
