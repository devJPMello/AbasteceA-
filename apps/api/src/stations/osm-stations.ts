/**
 * Turns raw OpenStreetMap `amenity=fuel` elements (Overpass `out center tags`) into a clean list
 * of road fuel stations. Pure functions: no IO, so the rules are testable and the output is
 * reproducible. Data © OpenStreetMap contributors, ODbL (https://www.openstreetmap.org/copyright).
 */

export interface OsmElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export interface OsmStation {
  /** e.g. "node/123": lets anyone look the station up on openstreetmap.org. */
  osmId: string;
  name: string;
  /** From the `brand`/`operator` tag only. Never guessed from the name. */
  brand: string | null;
  address: string | null;
  lat: number;
  lng: number;
}

export interface CleanResult {
  stations: OsmStation[];
  dropped: { aviation: number; duplicates: number; noNameOrBrand: number; noCoordinates: number };
}

/** Two OSM objects for the same station (a node and its building outline) are this close. */
export const DUPLICATE_RADIUS_METERS = 60;

const AVIATION = /avia[cç][aã]o|aviation|\bavgas\b|jet\s?a-?1/i;

const EARTH_RADIUS_M = 6_371_000;

export function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

function addressOf(tags: Record<string, string>): string | null {
  const street = tags['addr:street'];
  const parts = [
    street && tags['addr:housenumber'] ? `${street}, ${tags['addr:housenumber']}` : street,
    tags['addr:suburb'],
  ].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

/** How informative an element is; used to keep the best one among duplicates. */
const richness = (s: { brand: string | null; address: string | null; named: boolean }) =>
  (s.named ? 4 : 0) + (s.brand ? 2 : 0) + (s.address ? 1 : 0);

export function cleanOsmStations(elements: OsmElement[]): CleanResult {
  const dropped = { aviation: 0, duplicates: 0, noNameOrBrand: 0, noCoordinates: 0 };
  const candidates: (OsmStation & { named: boolean })[] = [];

  for (const e of elements) {
    const tags = e.tags ?? {};
    const lat = e.lat ?? e.center?.lat;
    const lng = e.lon ?? e.center?.lon;
    if (lat === undefined || lng === undefined) {
      dropped.noCoordinates++;
      continue;
    }
    const brand = tags.brand?.trim() || tags.operator?.trim() || null;
    const rawName = tags.name?.trim() || null;
    if (AVIATION.test(`${rawName ?? ''} ${brand ?? ''}`)) {
      dropped.aviation++;
      continue;
    }
    // A pin that says nothing about what it is would only clutter the map.
    if (!rawName && !brand) {
      dropped.noNameOrBrand++;
      continue;
    }
    candidates.push({
      osmId: `${e.type}/${e.id}`,
      name: rawName ?? brand!,
      brand,
      address: addressOf(tags),
      lat,
      lng,
      named: rawName !== null,
    });
  }

  // Deduplicate: richest first, so the element that survives is the most informative one.
  candidates.sort((a, b) => richness(b) - richness(a) || a.osmId.localeCompare(b.osmId));
  const kept: (OsmStation & { named: boolean })[] = [];
  for (const c of candidates) {
    if (kept.some((k) => haversineMeters(k, c) <= DUPLICATE_RADIUS_METERS)) dropped.duplicates++;
    else kept.push(c);
  }

  const stations = kept
    .map(({ named: _named, ...s }) => s)
    .sort((a, b) => a.osmId.localeCompare(b.osmId, undefined, { numeric: true }));
  return { stations, dropped };
}
