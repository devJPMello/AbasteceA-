import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { latestPerStationFuel, mapProduct, parseAnpCsv, parseDate, parsePrice } from './anp-csv';
import { decodeAnpFile } from './anp-import.service';

const sample = readFileSync(join(__dirname, '../../test/fixtures/anp-sample.csv'), 'utf8');
const palmas = { municipality: 'PALMAS', state: 'TO' };

describe('parseAnpCsv', () => {
  const result = parseAnpCsv(sample, palmas);

  it('keeps only Palmas-TO: not Palmas-PR, not other cities', () => {
    expect(result.totalRows).toBe(11);
    const cnpjs = new Set(result.rows.map((r) => r.cnpj));
    expect(cnpjs.has('55555555000155')).toBe(false); // Palmas, Paraná
    expect(cnpjs.has('66666666000166')).toBe(false); // Gurupi
    expect(cnpjs.has('11111111000111')).toBe(true);
  });

  it('maps only the fuels we track (ignores GNV and non-S10 diesel)', () => {
    const fuels = [...new Set(result.rows.map((r) => r.fuelType))].sort();
    expect(fuels).toEqual(['DIESEL_S10', 'ETHANOL', 'GASOLINE_COMMON', 'GASOLINE_PREMIUM']);
  });

  it('parses CNPJ digits, decimal-comma prices and dd/mm/yyyy dates', () => {
    const row = result.rows.find((r) => r.cnpj === '11111111000111' && r.fuelType === 'ETHANOL')!;
    expect(row.priceMilli).toBe(4590);
    expect(row.collectedAt.toISOString()).toBe('2025-11-17T12:00:00.000Z');
    expect(row.brand).toBe('IPIRANGA');
    expect(row.address).toBe('AVENIDA JK, 104, ARNO 11');
  });

  it('counts unusable rows instead of failing the whole import', () => {
    expect(result.invalidRows).toBe(1); // "preco-ruim"
  });

  it('keeps only the newest collection per station and fuel', () => {
    const latest = latestPerStationFuel(result.rows);
    const gasoline = latest.filter(
      (r) => r.cnpj === '11111111000111' && r.fuelType === 'GASOLINE_COMMON',
    );
    expect(gasoline).toHaveLength(1);
    expect(gasoline[0]!.priceMilli).toBe(6190);
  });

  it('survives header renames, accents, a BOM and comma delimiters', () => {
    const csv =
      '﻿Município,UF,CNPJ,Produto,Data,Preço de Venda\nPalmas,TO,11111111000111,Etanol,2025-11-17,"4,59"\n';
    const r = parseAnpCsv(csv, palmas);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toMatchObject({ fuelType: 'ETHANOL', priceMilli: 4590 });
  });

  it('fails loudly when essential columns are missing', () => {
    expect(() => parseAnpCsv('a;b\n1;2\n', palmas)).toThrow(/missing expected columns/);
  });
});

describe('helpers', () => {
  it('parsePrice handles comma and dot decimals; rejects nonsense and implausible values', () => {
    expect(parsePrice('5,89')).toBe(5890);
    expect(parsePrice('5.899')).toBe(5899);
    expect(parsePrice('1.234,56')).toBeNull(); // out of the plausible fuel range
    expect(parsePrice('abc')).toBeNull();
    expect(parsePrice('0,50')).toBeNull();
  });

  it('parseDate accepts both formats and rejects invalid days', () => {
    expect(parseDate('31/12/2025')?.toISOString()).toBe('2025-12-31T12:00:00.000Z');
    expect(parseDate('2025-01-05')?.toISOString()).toBe('2025-01-05T12:00:00.000Z');
    expect(parseDate('31/02/2025')).toBeNull();
    expect(parseDate('hoje')).toBeNull();
  });

  it('mapProduct', () => {
    expect(mapProduct('GASOLINA')).toBe('GASOLINE_COMMON');
    expect(mapProduct('Gasolina Aditivada')).toBe('GASOLINE_PREMIUM');
    expect(mapProduct('DIESEL S10')).toBe('DIESEL_S10');
    expect(mapProduct('OLEO DIESEL')).toBeNull();
    expect(mapProduct('GLP')).toBeNull();
  });

  it('decodeAnpFile falls back to Windows-1252 for Latin-1 files', () => {
    const latin1 = Uint8Array.from([0x50, 0x61, 0x6c, 0x6d, 0x61, 0x73, 0x20, 0xe7]); // "Palmas ç"
    expect(decodeAnpFile(latin1.buffer)).toBe('Palmas ç');
    expect(decodeAnpFile(new TextEncoder().encode('Palmas ç').buffer as ArrayBuffer)).toBe(
      'Palmas ç',
    );
  });
});
