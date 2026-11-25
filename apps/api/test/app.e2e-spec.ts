import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { setupApp } from '../src/setup-app';

// Palmas city centre and points at known distances (1° of latitude ≈ 111.2 km).
const CENTER = { lat: -10.1844, lng: -48.3336 };
const at = (northMeters: number) => ({ lat: CENTER.lat + northMeters / 111_195, lng: CENTER.lng });

describe('Bomba Certa API (e2e, real PostGIS)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<typeof request>;
  let seq = 0;

  const register = async () => {
    const res = await http
      .post('/auth/register')
      .send({ name: 'Tester', email: `user${++seq}@example.com`, password: 'password123' })
      .expect(201);
    return res.body as { accessToken: string; refreshToken: string; user: { id: string } };
  };
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  const createStation = async (
    token: string,
    name: string,
    point: { lat: number; lng: number },
  ) => {
    const res = await http
      .post('/stations')
      .set(auth(token))
      .send({ name, brand: 'Ipiranga', address: 'Quadra 104 Sul, Palmas', ...point })
      .expect(201);
    return res.body.id as string;
  };

  const report = (
    token: string,
    stationId: string,
    priceMilli: number,
    fuelType = 'GASOLINE_COMMON',
  ) => http.post('/prices/reports').set(auth(token)).send({ stationId, fuelType, priceMilli });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    http = request(app.getHttpServer());
    await prisma.$executeRawUnsafe(
      'TRUNCATE users, stations, price_reports, report_confirmations, station_current_prices, refresh_tokens CASCADE',
    );
  });

  afterAll(async () => {
    await app.close();
  });

  describe('auth', () => {
    it('registers, rejects duplicates and bad credentials, and returns the profile', async () => {
      const email = 'auth@example.com';
      const body = { name: 'Auth User', email, password: 'password123' };
      const created = await http.post('/auth/register').send(body).expect(201);
      expect(created.body.accessToken).toBeDefined();
      expect(created.body.user.email).toBe(email);
      await http.post('/auth/register').send(body).expect(409);
      await http.post('/auth/login').send({ email, password: 'wrong-password' }).expect(401);

      const login = await http
        .post('/auth/login')
        .send({ email, password: 'password123' })
        .expect(200);
      const me = await http.get('/users/me').set(auth(login.body.accessToken)).expect(200);
      expect(me.body.email).toBe(email);
      await http.get('/users/me').expect(401);
    });

    it('returns 400 with details for invalid payloads', async () => {
      const res = await http.post('/auth/register').send({ email: 'nope' }).expect(400);
      expect(res.body.message).toBe('Validation failed');
      expect(res.body.details.length).toBeGreaterThan(0);
    });

    it('rotates refresh tokens and revokes the family on reuse', async () => {
      const { refreshToken } = await register();
      const rotated = await http.post('/auth/refresh').send({ refreshToken }).expect(200);
      expect(rotated.body.refreshToken).not.toBe(refreshToken);

      // Replaying the old token is treated as theft: the whole session dies.
      await http.post('/auth/refresh').send({ refreshToken }).expect(401);
      await http
        .post('/auth/refresh')
        .send({ refreshToken: rotated.body.refreshToken })
        .expect(401);
    });
  });

  describe('stations and PostGIS search', () => {
    it('filters by radius and orders by distance or price', async () => {
      const { accessToken } = await register();
      const near = await createStation(accessToken, 'Near', at(500));
      const mid = await createStation(accessToken, 'Mid', at(2000));
      const far = await createStation(accessToken, 'Far', at(8000));

      const u1 = await register();
      const u2 = await register();
      await report(u1.accessToken, near, 6290).expect(201);
      await report(u2.accessToken, mid, 5990).expect(201);
      await report(u1.accessToken, far, 5890).expect(201);

      const query = { ...CENTER, fuelType: 'GASOLINE_COMMON', radiusMeters: 3000 };

      const byDistance = await http
        .get('/stations/nearby')
        .query({ ...query, sortBy: 'distance' })
        .expect(200);
      const names = byDistance.body.items.map((s: { name: string }) => s.name);
      expect(names).toEqual(expect.arrayContaining(['Near', 'Mid']));
      expect(names).not.toContain('Far'); // 8 km away, outside the 3 km radius
      expect(names.indexOf('Near')).toBeLessThan(names.indexOf('Mid'));

      const byPrice = await http
        .get('/stations/nearby')
        .query({ ...query, sortBy: 'price' })
        .expect(200);
      const priced = byPrice.body.items.map((s: { name: string }) => s.name);
      expect(priced.indexOf('Mid')).toBeLessThan(priced.indexOf('Near')); // 5.990 < 6.290
      expect(byPrice.body.meta.total).toBe(2);

      const detail = await http.get(`/stations/${near}`).expect(200);
      expect(detail.body.prices[0]).toMatchObject({
        fuelType: 'GASOLINE_COMMON',
        priceMilli: 6290,
        stale: false,
      });
    });

    it('paginates and validates query params', async () => {
      const page = await http
        .get('/stations/nearby')
        .query({
          ...CENTER,
          fuelType: 'GASOLINE_COMMON',
          radiusMeters: 50000,
          pageSize: 1,
          page: 2,
        })
        .expect(200);
      expect(page.body.items).toHaveLength(1);
      expect(page.body.meta.page).toBe(2);
      await http
        .get('/stations/nearby')
        .query({ lat: 999, lng: 0, fuelType: 'ETHANOL' })
        .expect(400);
      await http.get('/stations/not-a-uuid').expect(400);
    });
  });

  describe('price reports', () => {
    it('enforces the 6h cooldown per user, station and fuel', async () => {
      const u = await register();
      const station = await createStation(u.accessToken, 'Cooldown', at(100));
      await report(u.accessToken, station, 6000).expect(201);
      await report(u.accessToken, station, 6010).expect(429);
      await report(u.accessToken, station, 4500, 'ETHANOL').expect(201); // different fuel is fine
    });

    it('holds implausible reports as PENDING until confirmed by two other users', async () => {
      const author = await register();
      const station = await createStation(author.accessToken, 'Outlier', at(300));
      const before = (await http.get(`/stations/${station}`)).body.prices;
      expect(before).toHaveLength(0);

      // The city median for GASOLINE_COMMON is ~6.0 from the earlier tests; 9.5 is far above +15%.
      const created = await report(author.accessToken, station, 9500).expect(201);
      expect(created.body.status).toBe('PENDING');
      expect((await http.get(`/stations/${station}`)).body.prices).toHaveLength(0);

      const reportId = created.body.id as string;
      await http
        .post(`/prices/reports/${reportId}/confirm`)
        .set(auth(author.accessToken))
        .expect(403);

      const c1 = await register();
      const c2 = await register();

      // The pending list tells each caller whether the Confirm button makes sense for them.
      const pendingFor = async (token?: string) => {
        const req = http.get(`/stations/${station}/pending-reports`);
        const res = await (token ? req.set(auth(token)) : req).expect(200);
        return res.body[0] as { id: string; isMine: boolean; confirmedByMe: boolean };
      };
      expect(await pendingFor(author.accessToken)).toMatchObject({
        id: reportId,
        isMine: true,
        confirmedByMe: false,
      });
      expect(await pendingFor(c1.accessToken)).toMatchObject({
        isMine: false,
        confirmedByMe: false,
      });
      expect(await pendingFor()).toMatchObject({ isMine: false, confirmedByMe: false }); // anonymous
      // An invalid token is treated as anonymous, not rejected (the endpoint is public).
      const bad = await http
        .get(`/stations/${station}/pending-reports`)
        .set(auth('not-a-token'))
        .expect(200);
      expect(bad.body[0]).toMatchObject({ isMine: false });
      expect(bad.body[0]).not.toHaveProperty('userId'); // the author id is never exposed

      const first = await http
        .post(`/prices/reports/${reportId}/confirm`)
        .set(auth(c1.accessToken))
        .expect(200);
      expect(first.body.status).toBe('PENDING');
      expect(await pendingFor(c1.accessToken)).toMatchObject({
        isMine: false,
        confirmedByMe: true,
      });
      expect(await pendingFor(c2.accessToken)).toMatchObject({ confirmedByMe: false });
      await http.post(`/prices/reports/${reportId}/confirm`).set(auth(c1.accessToken)).expect(409);

      const second = await http
        .post(`/prices/reports/${reportId}/confirm`)
        .set(auth(c2.accessToken))
        .expect(200);
      expect(second.body.status).toBe('ACTIVE');
      const after = (await http.get(`/stations/${station}`)).body.prices;
      expect(after[0]).toMatchObject({ priceMilli: 9500, source: 'USER' });
    });

    it('serves price history for charts', async () => {
      const u = await register();
      const station = await createStation(u.accessToken, 'History', at(200));
      await report(u.accessToken, station, 6100).expect(201);
      const res = await http
        .get(`/stations/${station}/price-history`)
        .query({ fuelType: 'GASOLINE_COMMON', days: 30 })
        .expect(200);
      expect(res.body.points).toHaveLength(1);
      expect(res.body.points[0].priceMilli).toBe(6100);
    });
  });

  it('serves liveness and readiness probes', async () => {
    const live = await http.get('/health').expect(200);
    expect(live.body).toEqual({ status: 'ok' });
    const ready = await http.get('/health/ready').expect(200);
    expect(ready.body).toEqual({ status: 'ok', checks: { database: 'up', redis: 'up' } });
  });

  it('exposes the OpenAPI document', async () => {
    const res = await http.get('/docs-json').expect(200);
    expect(Object.keys(res.body.paths)).toEqual(
      expect.arrayContaining(['/auth/login', '/stations/nearby', '/prices/reports']),
    );
  });
});
