import {
  brandsCompatible,
  canonicalBrand,
  resolveCandidates,
  type Candidate,
} from './station-matching';

describe('canonicalBrand', () => {
  it('ignores case, accents and punctuation', () => {
    expect(canonicalBrand('Ipiranga')).toBe('ipiranga');
    expect(canonicalBrand('IPIRANGA ')).toBe('ipiranga');
  });

  it('groups names of the same chain: BR / Petrobras and Raízen / Shell', () => {
    expect(canonicalBrand('BR')).toBe('petrobras');
    expect(canonicalBrand('PETROBRAS DISTRIBUIDORA S.A.')).toBe('petrobras');
    expect(canonicalBrand('VIBRA')).toBe('petrobras'); // ex-BR Distribuidora, as in 2026 ANP files
    expect(canonicalBrand('RAIZEN')).toBe('shell');
    expect(canonicalBrand('Shell')).toBe('shell');
  });

  it('treats white-flag and missing brands as unknown (null)', () => {
    for (const unknown of ['BRANCA', 'Bandeira Branca', 'Não informada', '', null, undefined]) {
      expect(canonicalBrand(unknown)).toBeNull();
    }
  });
});

describe('brandsCompatible', () => {
  it('matches the same chain and rejects different known chains', () => {
    expect(brandsCompatible('Petrobras', 'BR')).toBe(true);
    expect(brandsCompatible('Shell', 'IPIRANGA')).toBe(false);
  });

  it('never rules a station out when one side is unknown', () => {
    expect(brandsCompatible('Não informada', 'IPIRANGA')).toBe(true);
    expect(brandsCompatible('Shell', 'BRANCA')).toBe(true);
  });
});

describe('resolveCandidates', () => {
  const c = (id: string, brand: string): Candidate => ({ id, brand });

  it('returns none with no candidates, or when every neighbour is a different brand', () => {
    expect(resolveCandidates([], 'IPIRANGA')).toEqual({ kind: 'none' });
    expect(resolveCandidates([c('a', 'Shell')], 'IPIRANGA')).toEqual({ kind: 'none' });
  });

  it('matches a single compatible candidate, even with an unknown brand', () => {
    expect(resolveCandidates([c('a', 'Ipiranga')], 'IPIRANGA')).toEqual({
      kind: 'matched',
      id: 'a',
    });
    expect(resolveCandidates([c('a', 'Não informada')], 'IPIRANGA')).toEqual({
      kind: 'matched',
      id: 'a',
    });
  });

  it('ignores incompatible neighbours when picking', () => {
    expect(resolveCandidates([c('shell', 'Shell'), c('ipi', 'Ipiranga')], 'IPIRANGA')).toEqual({
      kind: 'matched',
      id: 'ipi',
    });
  });

  it('prefers the one with the same KNOWN brand over unknown-brand neighbours', () => {
    expect(
      resolveCandidates([c('unknown', 'Não informada'), c('ipi', 'Ipiranga')], 'IPIRANGA'),
    ).toEqual({
      kind: 'matched',
      id: 'ipi',
    });
  });

  it('is ambiguous (never guesses) with several equally plausible candidates', () => {
    expect(resolveCandidates([c('a', 'Shell'), c('b', 'Shell')], 'RAIZEN')).toEqual({
      kind: 'ambiguous',
      ids: ['a', 'b'],
    });
    expect(resolveCandidates([c('a', 'Não informada'), c('b', 'Não informada')], 'BRANCA')).toEqual(
      {
        kind: 'ambiguous',
        ids: ['a', 'b'],
      },
    );
  });
});
