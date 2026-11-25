import { describe, expect, it } from 'vitest';
import { STATION_API_PATTERN, TILE_PATTERN } from './cache-rules';

const ID = '43da401c-a526-4fb0-b3fc-602308dfbdb9';

describe('STATION_API_PATTERN (what may be cached from the API)', () => {
  it.each([
    `http://localhost:5173/api/stations/nearby?lat=-10.18&lng=-48.33&fuelType=ETHANOL&radiusMeters=5000`,
    `http://localhost:5173/api/stations/${ID}`,
    `http://localhost:5173/api/stations/${ID}/price-history?fuelType=ETHANOL&days=30`,
    `https://bomba-certa-api.onrender.com/stations/nearby?lat=1&lng=2`,
    `https://bomba-certa-api.onrender.com/stations/${ID}`,
  ])('caches public read %s', (url) => {
    expect(STATION_API_PATTERN.test(url)).toBe(true);
  });

  it.each([
    // personalised: depends on the logged-in user
    `http://localhost:5173/api/stations/${ID}/pending-reports`,
    `https://api.example.com/stations/${ID}/pending-reports`,
    // private or state-changing areas
    `http://localhost:5173/api/alerts`,
    `http://localhost:5173/api/notifications?page=1&pageSize=20`,
    `http://localhost:5173/api/auth/refresh`,
    `http://localhost:5173/api/users/me`,
    `http://localhost:5173/api/prices/reports`,
    `http://localhost:5173/api/devices`,
    // the collection itself (POST creates stations) and look-alikes
    `http://localhost:5173/api/stations`,
    `http://localhost:5173/api/stations/not-a-uuid`,
    `http://localhost:5173/api/stations/${ID}/other`,
    `http://localhost:5173/health/ready`,
  ])('never caches %s', (url) => {
    expect(STATION_API_PATTERN.test(url)).toBe(false);
  });
});

describe('TILE_PATTERN', () => {
  it('matches OSM tiles on every subdomain', () => {
    for (const s of ['a', 'b', 'c']) {
      expect(TILE_PATTERN.test(`https://${s}.tile.openstreetmap.org/13/3000/4000.png`)).toBe(true);
    }
  });

  it('ignores other hosts and the OSM website', () => {
    expect(TILE_PATTERN.test('https://tile.example.com/13/1/2.png')).toBe(false);
    expect(TILE_PATTERN.test('https://www.openstreetmap.org/copyright')).toBe(false);
    expect(TILE_PATTERN.test('http://a.tile.openstreetmap.org/1/2/3.png')).toBe(false);
  });
});
