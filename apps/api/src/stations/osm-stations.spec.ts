import { cleanOsmStations, haversineMeters, type OsmElement } from './osm-stations';

const node = (
  id: number,
  lat: number,
  lon: number,
  tags: Record<string, string> = {},
): OsmElement => ({
  type: 'node',
  id,
  lat,
  lon,
  tags,
});

describe('haversineMeters', () => {
  it('is ~111 km per degree of latitude and 0 for the same point', () => {
    expect(haversineMeters({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(111_195, -2);
    expect(haversineMeters({ lat: -10.18, lng: -48.33 }, { lat: -10.18, lng: -48.33 })).toBe(0);
  });
});

describe('cleanOsmStations', () => {
  it('keeps named or branded stations and takes brand only from tags', () => {
    const { stations } = cleanOsmStations([
      node(1, -10.2, -48.33, {
        name: 'Posto Verão',
        brand: 'Petrobras',
        'addr:street': 'Avenida LO-09',
        'addr:housenumber': '19',
      }),
      node(2, -10.21, -48.34, { name: 'Posto BR' }), // "BR" in the name is NOT turned into a brand
    ]);
    expect(stations).toEqual([
      {
        osmId: 'node/1',
        name: 'Posto Verão',
        brand: 'Petrobras',
        address: 'Avenida LO-09, 19',
        lat: -10.2,
        lng: -48.33,
      },
      { osmId: 'node/2', name: 'Posto BR', brand: null, address: null, lat: -10.21, lng: -48.34 },
    ]);
  });

  it('uses the brand as the name when only the brand is mapped', () => {
    const { stations } = cleanOsmStations([node(1, -10.2, -48.3, { brand: 'Ipiranga' })]);
    expect(stations[0]).toMatchObject({ name: 'Ipiranga', brand: 'Ipiranga' });
  });

  it('drops aviation fuel, which is not a road station', () => {
    const { stations, dropped } = cleanOsmStations([
      node(1, -10.29, -48.36, { name: 'BR Aviation', brand: 'BR' }),
      node(2, -10.29, -48.361, { name: 'Shell Aviação', brand: 'Shell' }),
      node(3, -10.3, -48.3, { name: 'Posto Central' }),
    ]);
    expect(stations.map((s) => s.name)).toEqual(['Posto Central']);
    expect(dropped.aviation).toBe(2);
  });

  it('drops pins with neither a name nor a brand, and elements without coordinates', () => {
    const { stations, dropped } = cleanOsmStations([
      node(1, -10.2, -48.3, {}),
      { type: 'way', id: 2, tags: { name: 'Sem centro' } },
      node(3, -10.25, -48.3, { name: 'Ok' }),
    ]);
    expect(stations).toHaveLength(1);
    expect(dropped).toMatchObject({ noNameOrBrand: 1, noCoordinates: 1 });
  });

  it('merges a node and its building outline, keeping the most informative one', () => {
    const { stations, dropped } = cleanOsmStations([
      node(1, -10.2, -48.3, { name: 'Posto Primavera' }),
      {
        type: 'way',
        id: 9,
        center: { lat: -10.20002, lon: -48.30002 },
        tags: { name: 'Posto Primavera', brand: 'Petrobras', 'addr:street': 'Avenida NS-2' },
      },
    ]);
    expect(stations).toHaveLength(1);
    expect(stations[0]).toMatchObject({
      osmId: 'way/9',
      brand: 'Petrobras',
      address: 'Avenida NS-2',
    });
    expect(dropped.duplicates).toBe(1);
  });

  it('does not merge different stations a few blocks apart', () => {
    const { stations } = cleanOsmStations([
      node(1, -10.2, -48.3, { name: 'A' }),
      node(2, -10.2, -48.2985, { name: 'B' }), // ~165 m east
    ]);
    expect(stations).toHaveLength(2);
  });

  it('is deterministic regardless of input order', () => {
    const input = [
      node(5, -10.2, -48.3, { name: 'E' }),
      node(2, -10.3, -48.3, { name: 'B' }),
      node(10, -10.4, -48.3, { name: 'J' }),
    ];
    expect(cleanOsmStations(input).stations).toEqual(
      cleanOsmStations([...input].reverse()).stations,
    );
  });
});
