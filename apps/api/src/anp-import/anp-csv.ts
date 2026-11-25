import { parse } from 'csv-parse/sync';
import type { FuelType } from '@bomba-certa/shared';

export interface AnpRow {
  cnpj: string;
  stationName: string;
  brand: string;
  address: string;
  /** Free-form pieces used for geocoding. */
  street: string;
  number: string;
  district: string;
  fuelType: FuelType;
  priceMilli: number;
  collectedAt: Date;
}

export interface ParseResult {
  rows: AnpRow[];
  /** Data rows in the file (before any filter). */
  totalRows: number;
  /** Rows of the target municipality that could not be used (bad price/date/CNPJ/product). */
  invalidRows: number;
}

/** "Estado - Sigla" -> "estadosigla": lets us survive header renames, accents and spacing. */
const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const ALIASES = {
  municipality: ['municipio', 'cidade'],
  state: ['estadosigla', 'estado', 'uf'],
  cnpj: ['cnpjdarevenda', 'cnpj'],
  name: ['revenda', 'razaosocial', 'nomedarevenda'],
  street: ['nomedarua', 'rua', 'logradouro', 'endereco'],
  number: ['numerorua', 'numero'],
  district: ['bairro'],
  product: ['produto'],
  date: ['datadacoleta', 'data'],
  price: ['valordevenda', 'precodevenda', 'preco'],
  brand: ['bandeira'],
} satisfies Record<string, string[]>;

/** Maps ANP product names to our fuel types; anything else (GNV, GLP, diesel S500...) is ignored. */
export function mapProduct(product: string): FuelType | null {
  const p = norm(product);
  if (p === 'gasolina' || p === 'gasolinacomum') return 'GASOLINE_COMMON';
  if (p.includes('gasolina') && p.includes('aditivada')) return 'GASOLINE_PREMIUM';
  if (p === 'etanol' || p === 'etanolhidratado') return 'ETHANOL';
  if (p.includes('diesel') && p.includes('s10')) return 'DIESEL_S10';
  return null;
}

/** "5,89" or "5.899" -> 5890 / 5899 thousandths of BRL. Null for anything implausible. */
export function parsePrice(raw: string): number | null {
  const s = raw.trim();
  // With a comma, it is the decimal separator and dots are thousands ("1.234,56").
  // Without one, a dot is the decimal point ("5.899").
  const value = Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s);
  if (!Number.isFinite(value)) return null;
  const milli = Math.round(value * 1000);
  return milli >= 1000 && milli <= 20000 ? milli : null;
}

/** Accepts dd/mm/yyyy and yyyy-mm-dd. Stored at noon UTC so no timezone flips the day. */
export function parseDate(raw: string): Date | null {
  const s = raw.trim();
  let y: number, m: number, d: number;
  let match = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(s);
  if (match) [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
  else if ((match = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)))
    [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  else return null;
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  return date.getUTCMonth() === m - 1 ? date : null;
}

/** Excel exports often start with a byte-order mark (U+FEFF). */
const stripBom = (s: string) => (s.charCodeAt(0) === 0xfeff ? s.slice(1) : s);

const onlyDigits = (s: string) => s.replace(/\D/g, '');

/**
 * Parses an ANP stations CSV (semicolon or comma separated) and keeps only the target
 * municipality. Pure function: no IO, so it is trivial to test and to re-run.
 */
export function parseAnpCsv(
  text: string,
  filter: { municipality: string; state: string },
): ParseResult {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const delimiter = firstLine.split(';').length >= firstLine.split(',').length ? ';' : ',';
  const records: string[][] = parse(stripBom(text), {
    delimiter,
    relax_column_count: true,
    skip_empty_lines: true,
  });
  const [header, ...data] = records;
  if (!header) return { rows: [], totalRows: 0, invalidRows: 0 };

  const normalized = header.map(norm);
  const col = (key: keyof typeof ALIASES) =>
    ALIASES[key].map((a) => normalized.indexOf(a)).find((i) => i >= 0) ?? -1;
  const idx = Object.fromEntries(
    (Object.keys(ALIASES) as (keyof typeof ALIASES)[]).map((k) => [k, col(k)]),
  ) as Record<keyof typeof ALIASES, number>;

  const required = ['municipality', 'cnpj', 'product', 'date', 'price'] as const;
  const missing = required.filter((k) => idx[k] < 0);
  if (missing.length > 0) {
    throw new Error(`ANP file is missing expected columns: ${missing.join(', ')}`);
  }

  const get = (row: string[], key: keyof typeof ALIASES) =>
    idx[key] >= 0 ? (row[idx[key]] ?? '').trim() : '';

  const targetCity = norm(filter.municipality);
  const targetState = filter.state.toLowerCase();
  const rows: AnpRow[] = [];
  let invalidRows = 0;

  for (const r of data) {
    if (norm(get(r, 'municipality')) !== targetCity) continue;
    // "Palmas" also exists in Paraná: when the file has a state column, require it to match.
    const state = norm(get(r, 'state'));
    if (idx.state >= 0 && state !== targetState) continue;

    const fuelType = mapProduct(get(r, 'product'));
    if (!fuelType) continue; // not a fuel we track: not an error

    const cnpj = onlyDigits(get(r, 'cnpj'));
    const priceMilli = parsePrice(get(r, 'price'));
    const collectedAt = parseDate(get(r, 'date'));
    if (cnpj.length !== 14 || priceMilli === null || collectedAt === null) {
      invalidRows++;
      continue;
    }

    const street = get(r, 'street');
    const number = get(r, 'number');
    const district = get(r, 'district');
    rows.push({
      cnpj,
      stationName: get(r, 'name') || `Posto ${cnpj}`,
      brand: get(r, 'brand') || 'Bandeira Branca',
      address: [street, number, district].filter(Boolean).join(', ') || 'Endereço não informado',
      street,
      number,
      district,
      fuelType,
      priceMilli,
      collectedAt,
    });
  }
  return { rows, totalRows: data.length, invalidRows };
}

/** The file may hold several weeks: keep only the newest row per station + fuel. */
export function latestPerStationFuel(rows: AnpRow[]): AnpRow[] {
  const best = new Map<string, AnpRow>();
  for (const row of rows) {
    const key = `${row.cnpj}:${row.fuelType}`;
    const current = best.get(key);
    if (!current || row.collectedAt > current.collectedAt) best.set(key, row);
  }
  return [...best.values()];
}
