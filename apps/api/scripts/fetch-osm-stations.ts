/**
 * Refreshes apps/api/prisma/data/palmas-osm-stations.json from OpenStreetMap (Overpass API).
 *   pnpm --filter @bomba-certa/api osm:fetch
 *
 * The seed reads the committed snapshot, so seeding never needs the network and always produces
 * the same stations. Run this only when you want newer OSM data, then review and commit the diff.
 * Data © OpenStreetMap contributors, ODbL: https://www.openstreetmap.org/copyright
 */
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { cleanOsmStations, type OsmElement } from '../src/stations/osm-stations';

// Palmas-TO (south, west, north, east). The state/municipality boundary is not used on purpose:
// "Palmas" is also a municipality in Paraná, and a bounding box avoids that ambiguity.
const BBOX = [-10.4, -48.45, -10.05, -48.2] as const;
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const OUTPUT = resolve(__dirname, '../prisma/data/palmas-osm-stations.json');

async function main() {
  const bbox = BBOX.join(',');
  const query = `[out:json][timeout:60];(node["amenity"="fuel"](${bbox});way["amenity"="fuel"](${bbox}););out center tags;`;

  // The public Overpass server sheds load with 429/502/503/504: wait and try again (politely).
  let res: Response | undefined;
  for (let attempt = 1; attempt <= 4; attempt++) {
    res = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'bomba-certa-seed-fetch/0.1',
      },
      body: new URLSearchParams({ data: query }),
      signal: AbortSignal.timeout(90_000),
    });
    if (res.ok || ![429, 502, 503, 504].includes(res.status)) break;
    const waitSeconds = attempt * 10;
    console.warn(`Overpass busy (HTTP ${res.status}); retrying in ${waitSeconds}s...`);
    await new Promise((r) => setTimeout(r, waitSeconds * 1000));
  }
  if (!res?.ok) throw new Error(`Overpass responded HTTP ${res?.status}`);
  const json = (await res.json()) as {
    osm3s: { timestamp_osm_base: string };
    elements: OsmElement[];
  };

  const { stations, dropped } = cleanOsmStations(json.elements);
  const snapshot = {
    source: 'OpenStreetMap contributors',
    license: 'ODbL 1.0 (https://www.openstreetmap.org/copyright)',
    osmDataTimestamp: json.osm3s.timestamp_osm_base,
    bbox: { south: BBOX[0], west: BBOX[1], north: BBOX[2], east: BBOX[3] },
    rawElements: json.elements.length,
    dropped,
    stations,
  };
  await writeFile(OUTPUT, JSON.stringify(snapshot, null, 2) + '\n', 'utf8');
  console.log(
    `OSM data from ${snapshot.osmDataTimestamp}: ${json.elements.length} elements -> ${stations.length} stations`,
    dropped,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
