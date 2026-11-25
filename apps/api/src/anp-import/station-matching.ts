/**
 * Decides whether an ANP row refers to a station we already know (e.g. one imported from
 * OpenStreetMap, which has no CNPJ). Pure functions: the SQL only supplies the nearby candidates.
 *
 * Philosophy: a wrong merge puts one station's prices on another station, which is worse than a
 * duplicate pin. So we only merge when there is exactly one clear candidate, and we SKIP (and
 * report) ambiguous cases instead of guessing.
 */

const strip = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

/** Values that mean "we do not know the brand" (ANP's "BRANCA" = unbranded, our placeholder...). */
const UNKNOWN = new Set([
  '',
  'branca',
  'bandeirabranca',
  'naoinformada',
  'semidentificacao',
  'semcnpj',
]);

/**
 * Brand families: the same chain appears under different names in ANP files and on the map.
 * BR is Petrobras' retail brand; Raízen operates the Shell brand in Brazil.
 * Kept deliberately small: unknown brands fall back to their own normalised name.
 */
function family(key: string): string {
  if (key === 'br' || key.startsWith('petrobras') || key.startsWith('brdistribuidora'))
    return 'petrobras';
  if (key.startsWith('shell') || key.startsWith('raizen')) return 'shell';
  return key;
}

/** Canonical brand, or null when the brand is unknown (and therefore compatible with anything). */
export function canonicalBrand(raw: string | null | undefined): string | null {
  const key = strip(raw ?? '');
  return UNKNOWN.has(key) ? null : family(key);
}

/** Different known brands cannot be the same station; an unknown brand never rules anything out. */
export function brandsCompatible(a: string | null | undefined, b: string | null | undefined) {
  const ca = canonicalBrand(a);
  const cb = canonicalBrand(b);
  return ca === null || cb === null || ca === cb;
}

export interface Candidate {
  id: string;
  brand: string;
}

export type MatchResult =
  { kind: 'matched'; id: string } | { kind: 'ambiguous'; ids: string[] } | { kind: 'none' };

/**
 * `candidates` are the stations without CNPJ near the geocoded ANP address, closest first.
 *  - none compatible            -> 'none' (a different brand next door is a different station)
 *  - exactly one compatible     -> matched
 *  - several, one with the SAME known brand -> matched (a known brand beats unknown ones)
 *  - otherwise                  -> ambiguous
 */
export function resolveCandidates(candidates: Candidate[], anpBrand: string): MatchResult {
  const compatible = candidates.filter((c) => brandsCompatible(c.brand, anpBrand));
  if (compatible.length === 0) return { kind: 'none' };
  if (compatible.length === 1) return { kind: 'matched', id: compatible[0]!.id };

  const wanted = canonicalBrand(anpBrand);
  if (wanted !== null) {
    const sameBrand = compatible.filter((c) => canonicalBrand(c.brand) === wanted);
    if (sameBrand.length === 1) return { kind: 'matched', id: sameBrand[0]!.id };
  }
  return { kind: 'ambiguous', ids: compatible.map((c) => c.id) };
}
