import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AnpImportService } from '../src/anp-import/anp-import.service';
import { GEOCODER, type Geocoder } from '../src/anp-import/geocoder';
import { PrismaService } from '../src/prisma/prisma.service';
import { setupApp } from '../src/setup-app';

const CENTER = { lat: -10.1844, lng: -48.3336 };
const at = (northMeters: number) => ({ lat: CENTER.lat + northMeters / 111_195, lng: CENTER.lng });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Polls until `fn` returns a truthy value: the workers run asynchronously. */
async function waitFor<T>(fn: () => Promise<T | false | null | undefined>, timeoutMs = 10_000) {
  const start = Date.now();
  for (;;) {
    const value = await fn();
    if (value) return value;
    if (Date.now() - start > timeoutMs) throw new Error('waitFor timed out');
    await sleep(150);
  }
}

// Fake geocoder: no network in tests, and one address that cannot be located.
const fakeGeocoder: Geocoder = {
  geocode: async (query) => {
    if (query.includes('AVENIDA JK')) return at(300);
    if (query.includes('AVENIDA NS 01')) return at(900);
    return null;
  },
};

describe('Background jobs (e2e, real Postgres + Redis)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<typeof request>;
  let seq = 0;

  const register = async () => {
    const res = await http
      .post('/auth/register')
      .send({ name: 'Tester', email: `job${++seq}@example.com`, password: 'password123' })
      .expect(201);
    return res.body as { accessToken: string };
  };
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const notifications = async (token: string) =>
    (await http.get('/notifications').set(auth(token)).expect(200)).body as {
      meta: { total: number };
      items: { title: string; body: string }[];
    };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(GEOCODER)
      .useValue(fakeGeocoder)
      .compile();
    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    http = request(app.getHttpServer());
    await prisma.$executeRawUnsafe(
      'TRUNCATE users, stations, price_reports, station_current_prices, price_alerts, notifications, anp_import_runs CASCADE',
    );
  });

  afterAll(async () => {
    await app.close();
  });

  describe('price alerts (BullMQ worker)', () => {
    let owner: { accessToken: string };
    let stationId: string;
    let alertId: string;

    const reportAs = async (priceMilli: number) => {
      const u = await register();
      await http
        .post('/prices/reports')
        .set(auth(u.accessToken))
        .send({ stationId, fuelType: 'GASOLINE_COMMON', priceMilli })
        .expect(201);
    };

    beforeAll(async () => {
      owner = await register();
      const res = await http
        .post('/stations')
        .set(auth(owner.accessToken))
        .send({ name: 'Posto do Alerta', brand: 'Ipiranga', address: 'Quadra 104 Sul', ...at(500) })
        .expect(201);
      stationId = res.body.id;
    });

    it('creates an alert and does nothing while no price qualifies', async () => {
      const res = await http
        .post('/alerts')
        .set(auth(owner.accessToken))
        .send({
          fuelType: 'GASOLINE_COMMON',
          targetPriceMilli: 6000,
          radiusMeters: 2000,
          ...CENTER,
        })
        .expect(201);
      alertId = res.body.id;
      expect(res.body).toMatchObject({
        targetPriceMilli: 6000,
        radiusMeters: 2000,
        lastNotifiedAt: null,
      });
      await sleep(500);
      expect((await notifications(owner.accessToken)).meta.total).toBe(0);
    });

    it('fires when a station inside the radius reaches the target', async () => {
      await reportAs(5900);
      await waitFor(async () => (await notifications(owner.accessToken)).meta.total === 1);
      const { items } = await notifications(owner.accessToken);
      expect(items[0]!.body).toContain('Posto do Alerta');
      expect(items[0]!.body).toContain('R$ 5,900');
    });

    it('does not notify again while the price stays below the target (dedupe)', async () => {
      await reportAs(5800);
      await sleep(1500); // give the worker time to (not) act
      expect((await notifications(owner.accessToken)).meta.total).toBe(1);
    });

    it('re-arms when the price rises, then fires again on the next drop', async () => {
      await reportAs(6200);
      await waitFor(async () => {
        const list = (await http.get('/alerts').set(auth(owner.accessToken))).body as {
          id: string;
          lastNotifiedAt: string | null;
        }[];
        return list.find((a) => a.id === alertId)?.lastNotifiedAt === null;
      });
      await reportAs(5900);
      await waitFor(async () => (await notifications(owner.accessToken)).meta.total === 2);
    });

    it('checks a new alert against current prices right away', async () => {
      const late = await register();
      await http
        .post('/alerts')
        .set(auth(late.accessToken))
        .send({
          fuelType: 'GASOLINE_COMMON',
          targetPriceMilli: 6500,
          radiusMeters: 2000,
          ...CENTER,
        })
        .expect(201);
      await waitFor(async () => (await notifications(late.accessToken)).meta.total === 1);
    });

    it('ignores alerts whose radius does not reach the station', async () => {
      const far = await register();
      await http
        .post('/alerts')
        .set(auth(far.accessToken))
        .send({
          fuelType: 'GASOLINE_COMMON',
          targetPriceMilli: 9000,
          radiusMeters: 1000,
          ...at(20_000),
        })
        .expect(201);
      await sleep(1000);
      expect((await notifications(far.accessToken)).meta.total).toBe(0);
    });

    it('lets users delete only their own alerts and mark notifications as read', async () => {
      const other = await register();
      await http.delete(`/alerts/${alertId}`).set(auth(other.accessToken)).expect(404);
      await http.delete(`/alerts/${alertId}`).set(auth(owner.accessToken)).expect(204);

      const before = (await http.get('/notifications').set(auth(owner.accessToken))).body;
      expect(before.unread).toBe(2);
      const id = before.items[0].id;
      await http.post(`/notifications/${id}/read`).set(auth(owner.accessToken)).expect(204);
      expect((await http.get('/notifications').set(auth(owner.accessToken))).body.unread).toBe(1);
    });

    it('limits the number of alerts per user', async () => {
      const u = await register();
      const body = { fuelType: 'ETHANOL', targetPriceMilli: 4000, radiusMeters: 1000, ...CENTER };
      for (let i = 0; i < 10; i++)
        await http.post('/alerts').set(auth(u.accessToken)).send(body).expect(201);
      await http.post('/alerts').set(auth(u.accessToken)).send(body).expect(400);
    });
  });

  describe('push notifications (Expo)', () => {
    it('registers a device, pushes when an alert fires and unregisters', async () => {
      const user = await register();
      const token = 'ExponentPushToken[e2e-device]';

      await http
        .post('/devices')
        .set(auth(user.accessToken))
        .send({ token, platform: 'android' })
        .expect(204);
      // Idempotent: registering the same token again is fine.
      await http
        .post('/devices')
        .set(auth(user.accessToken))
        .send({ token, platform: 'android' })
        .expect(204);
      await http
        .post('/devices')
        .set(auth(user.accessToken))
        .send({ token: 'bad', platform: 'android' })
        .expect(400);
      await http.post('/devices').send({ token, platform: 'android' }).expect(401);
      expect(await prisma.deviceToken.count({ where: { token } })).toBe(1);

      const station = await http
        .post('/stations')
        .set(auth(user.accessToken))
        .send({ name: 'Posto Push', brand: 'Shell', address: 'Quadra 906 Sul', ...at(700) })
        .expect(201);
      await http
        .post('/alerts')
        .set(auth(user.accessToken))
        .send({ fuelType: 'DIESEL_S10', targetPriceMilli: 6000, radiusMeters: 2000, ...CENTER })
        .expect(201);

      // Intercept only the call to Expo: no real network in tests.
      const fetchSpy = jest
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(
          new Response(JSON.stringify({ data: [{ status: 'ok' }] }), { status: 200 }),
        );
      try {
        const reporter = await register();
        await http
          .post('/prices/reports')
          .set(auth(reporter.accessToken))
          .send({ stationId: station.body.id, fuelType: 'DIESEL_S10', priceMilli: 5900 })
          .expect(201);

        await waitFor(async () => fetchSpy.mock.calls.length > 0);
        const [, init] = fetchSpy.mock.calls[0]!;
        const sent = JSON.parse((init as RequestInit).body as string);
        expect(sent).toHaveLength(1);
        expect(sent[0]).toMatchObject({ to: token, title: expect.stringContaining('Diesel S10') });
        // The in-app record is created too: push is an extra channel, not a replacement.
        expect((await notifications(user.accessToken)).meta.total).toBe(1);
      } finally {
        fetchSpy.mockRestore();
      }

      await http
        .delete(`/devices/${encodeURIComponent(token)}`)
        .set(auth(user.accessToken))
        .expect(204);
      expect(await prisma.deviceToken.count({ where: { token } })).toBe(0);
    });

    it("does not let one user unregister another user's device", async () => {
      const owner = await register();
      const intruder = await register();
      const token = 'ExponentPushToken[owner-device]';
      await http
        .post('/devices')
        .set(auth(owner.accessToken))
        .send({ token, platform: 'ios' })
        .expect(204);
      await http
        .delete(`/devices/${encodeURIComponent(token)}`)
        .set(auth(intruder.accessToken))
        .expect(204);
      expect(await prisma.deviceToken.count({ where: { token } })).toBe(1);
    });
  });

  describe('ANP import', () => {
    const csv = readFileSync(join(__dirname, 'fixtures/anp-sample.csv'), 'utf8');
    let importer: AnpImportService;

    beforeAll(async () => {
      importer = app.get(AnpImportService);
      // The alert tests above left CNPJ-less stations ~200 m from the fake geocoded points, which
      // the importer would (correctly) match. Start from a clean slate.
      await prisma.$executeRawUnsafe(
        'TRUNCATE stations, price_reports, station_current_prices, price_alerts, notifications CASCADE',
      );
    });

    it('imports Palmas stations, geocodes new ones and tags the source as ANP', async () => {
      const summary = await importer.importFromText(csv);
      expect(summary).toEqual({
        rowsRead: 11,
        rowsImported: 4, // station 1: gasoline + ethanol; station 2: premium + diesel S10
        rowsSkipped: 2, // 1 invalid price + 1 station that could not be geocoded
        stationsCreated: 2,
        stationsMatched: 0,
        stationsAmbiguous: 0,
      });

      const stations = await prisma.station.findMany({ where: { source: 'ANP' } });
      expect(stations.map((s) => s.cnpj).sort()).toEqual(['11111111000111', '22222222000122']);

      const res = await http
        .get('/stations/nearby')
        .query({ ...CENTER, fuelType: 'GASOLINE_COMMON', radiusMeters: 3000 })
        .expect(200);
      const first = res.body.items.find(
        (s: { name: string }) => s.name === 'POSTO FICTICIO UM LTDA',
      );
      // The newest of the two weeks in the file wins: 6,19, and it is flagged ANP.
      expect(first.price).toMatchObject({ priceMilli: 6190, source: 'ANP' });
    });

    it('is idempotent: importing the same file again adds nothing', async () => {
      const summary = await importer.importFromText(csv);
      expect(summary.rowsImported).toBe(0);
      expect(summary.stationsCreated).toBe(0);
      expect(await prisma.priceReport.count({ where: { source: 'ANP' } })).toBe(4);
    });

    it('records every run, including failures', async () => {
      await expect(importer.importFromText('a;b\n1;2\n')).rejects.toThrow(
        /missing expected columns/,
      );
      const runs = await prisma.anpImportRun.findMany({ orderBy: { startedAt: 'asc' } });
      expect(runs.map((r) => r.status)).toEqual(['SUCCEEDED', 'SUCCEEDED', 'FAILED']);
      expect(runs[2]!.error).toContain('missing expected columns');
    });
  });

  describe('ANP import matching existing (OpenStreetMap) stations', () => {
    const csv = readFileSync(join(__dirname, 'fixtures/anp-sample.csv'), 'utf8');
    let importer: AnpImportService;

    /** Inserts a station like the OSM seed does: no CNPJ, source OSM. */
    const insertOsmStation = async (
      name: string,
      brand: string,
      point: { lat: number; lng: number },
    ) => {
      const rows = await prisma.$queryRaw<{ id: string }[]>`
        INSERT INTO stations (id, name, brand, address, source, location)
        VALUES (gen_random_uuid(), ${name}, ${brand}, 'Endereço não informado', 'OSM'::station_source,
                ST_SetSRID(ST_MakePoint(${point.lng}, ${point.lat}), 4326)::geography)
        RETURNING id`;
      return rows[0]!.id;
    };

    beforeAll(async () => {
      importer = app.get(AnpImportService);
    });

    beforeEach(async () => {
      await prisma.$executeRawUnsafe(
        'TRUNCATE stations, price_reports, station_current_prices, price_alerts, notifications, anp_import_runs CASCADE',
      );
    });

    it('gives the CNPJ and prices to the nearby same-brand station instead of duplicating it', async () => {
      // ~20 m from where the fake geocoder places "AVENIDA JK" (at(300)).
      const osmId = await insertOsmStation('Posto JK', 'Ipiranga', at(320));

      const summary = await importer.importFromText(csv);
      expect(summary).toMatchObject({
        stationsMatched: 1,
        stationsCreated: 1,
        stationsAmbiguous: 0,
      });

      const station = await prisma.station.findUniqueOrThrow({ where: { id: osmId } });
      expect(station.cnpj).toBe('11111111000111');
      expect(station.source).toBe('OSM'); // origin kept; only the CNPJ was learned
      expect(station.name).toBe('Posto JK'); // good data is never overwritten
      expect(station.address).not.toBe('Endereço não informado'); // placeholder filled from ANP
      expect(await prisma.station.count({ where: { cnpj: '11111111000111' } })).toBe(1);
      expect(await prisma.priceReport.count({ where: { stationId: osmId, source: 'ANP' } })).toBe(
        2,
      );
    });

    it('fills an unknown brand from ANP', async () => {
      const osmId = await insertOsmStation('Posto sem bandeira', 'Não informada', at(310));
      await importer.importFromText(csv);
      const station = await prisma.station.findUniqueOrThrow({ where: { id: osmId } });
      expect(station.cnpj).toBe('11111111000111');
      expect(station.brand).toBe('IPIRANGA');
    });

    it('skips and reports an ambiguous match instead of guessing', async () => {
      // Two Shell stations around the "AVENIDA NS 01" point (at(900)): which one is it?
      await insertOsmStation('Shell A', 'Shell', at(880));
      await insertOsmStation('Shell B', 'Shell', at(920));

      const summary = await importer.importFromText(csv);
      expect(summary.stationsAmbiguous).toBe(1);
      expect(await prisma.station.count({ where: { cnpj: '22222222000122' } })).toBe(0);
      expect(await prisma.station.count({ where: { source: 'OSM', cnpj: { not: null } } })).toBe(0);
    });

    it('creates a new station when the neighbour has a different brand', async () => {
      await insertOsmStation('Posto Shell vizinho', 'Shell', at(310)); // ANP says IPIRANGA
      const summary = await importer.importFromText(csv);
      expect(summary.stationsMatched).toBe(0);
      expect(await prisma.station.count({ where: { cnpj: '11111111000111' } })).toBe(1);
      expect(await prisma.station.count()).toBe(3); // neighbour + 2 created from ANP
    });

    it('falls back to the station name when the address cannot be geocoded', async () => {
      // "RUA SEM GEOCODIFICACAO" is not located by the fake geocoder; its name is.
      const osmId = await insertOsmStation('Posto Ficticio Tres', 'Não informada', at(2000));
      const summary = await importer.importFromText(csv);
      expect(summary.stationsMatched).toBe(1);
      const station = await prisma.station.findUniqueOrThrow({ where: { id: osmId } });
      expect(station.cnpj).toBe('33333333000133');
      expect(await prisma.priceReport.count({ where: { stationId: osmId, source: 'ANP' } })).toBe(
        1,
      );
    });

    it('is idempotent once matched', async () => {
      await insertOsmStation('Posto JK', 'Ipiranga', at(320));
      await importer.importFromText(csv);
      const again = await importer.importFromText(csv);
      expect(again).toMatchObject({ rowsImported: 0, stationsMatched: 0, stationsCreated: 0 });
      expect(await prisma.station.count({ where: { cnpj: '11111111000111' } })).toBe(1);
    });
  });
});
