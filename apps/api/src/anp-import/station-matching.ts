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
  // Vibra Energia is the former BR Distribuidora: ANP files now list it as VIBRA.
  if (
    key === 'br' ||
    key.startsWith('petrobras') ||
    key.startsWith('brdistribuidora') ||
    key.startsWith('vibra')
  )
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

/** Words that say nothing about WHICH station it is (legal forms, generic business words). */
const NAME_STOPWORDS = new Set([
  'posto',
  'postos',
  'auto',
  'combustivel',
  'combustiveis',
  'comercio',
  'comercial',
  'com',
  'de',
  'do',
  'da',
  'dos',
  'das',
  'e',
  'derivados',
  'petroleo',
  'lubrificantes',
  'lubrificante',
  'ltda',
  'eireli',
  'me',
  'epp',
  'sa',
  's',
  'a',
  'cia',
  'distribuidora',
  'rede',
  'servicos',
  'servico',
  'center',
  'centro',
]);

/** Brand words are removed too: the brand is compared separately and is not part of the identity. */
const BRAND_WORDS = new Set([
  'br',
  'petrobras',
  'vibra',
  'shell',
  'raizen',
  'ipiranga',
  'ale',
  'branca',
  'bandeira',
]);

/** The words of a name that identify the station: "AUTO POSTO DLS COMBUSTIVEIS LTDA" -> {dls}. */
export function distinctiveTokens(name: string): Set<string> {
  const words = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  return new Set(words.filter((w) => !NAME_STOPWORDS.has(w) && !BRAND_WORDS.has(w)));
}

export interface NamedCandidate extends Candidate {
  name: string;
}

/**
 * Fallback for ANP rows whose address cannot be geocoded (Palmas' "QUADRA 406 NORTE AV NS 6"
 * is not understood by Nominatim). A station matches when ALL of its distinctive name words
 * appear in the ANP business name and the brands are compatible. Still conservative: nothing
 * distinctive in the name -> no match; several matches -> ambiguous.
 * The ANP name is a legal name ("razão social"), so many real stations will simply not match.
 */
export function resolveByName(
  candidates: NamedCandidate[],
  anpName: string,
  anpBrand: string,
): MatchResult {
  const anpTokens = distinctiveTokens(anpName);
  const matching = candidates.filter((c) => {
    if (!brandsCompatible(c.brand, anpBrand)) return false;
    const tokens = distinctiveTokens(c.name);
    return tokens.size > 0 && [...tokens].every((t) => anpTokens.has(t));
  });
  if (matching.length === 0) return { kind: 'none' };
  if (matching.length === 1) return { kind: 'matched', id: matching[0]!.id };
  return { kind: 'ambiguous', ids: matching.map((c) => c.id) };
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
