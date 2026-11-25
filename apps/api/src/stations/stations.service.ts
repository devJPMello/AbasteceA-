import { Injectable, NotFoundException } from '@nestjs/common';
import {
  PRICE_FRESHNESS_DAYS,
  type CreateStationInput,
  type NearbyQuery,
  type PriceHistoryQuery,
} from '@bomba-certa/shared';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { paginate } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';

interface NearbyRow {
  id: string;
  name: string;
  brand: string;
  address: string;
  lat: number;
  lng: number;
  distance_m: number;
  price_milli: number | null;
  price_source: 'USER' | 'ANP' | null;
  reported_at: Date | null;
}

const isStale = (reportedAt: Date | null) =>
  reportedAt !== null && Date.now() - reportedAt.getTime() > PRICE_FRESHNESS_DAYS * 86_400_000;

@Injectable()
export class StationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateStationInput) {
    const id = randomUUID();
    // ST_MakePoint takes (x = longitude, y = latitude) — the reverse of how people say "lat, lng".
    // ::geography stores it as a point on the WGS84 spheroid so distances come out in metres.
    await this.prisma.$executeRaw`
      INSERT INTO stations (id, name, brand, cnpj, address, location)
      VALUES (${id}::uuid, ${input.name}, ${input.brand}, ${input.cnpj ?? null}, ${input.address},
              ST_SetSRID(ST_MakePoint(${input.lng}, ${input.lat}), 4326)::geography)`;
    return this.findOne(id);
  }

  /**
   * Stations within `radiusMeters` of the user, with the current price for one fuel.
   *
   * - ST_DWithin(geography, geography, metres) is index-assisted: it first uses the GIST
   *   index on `location` (bounding-box prefilter), then checks the exact spheroid distance.
   *   Using ST_Distance(...) < r in WHERE would NOT use the index.
   * - LEFT JOIN keeps stations that have no price yet (they sort last when ordering by price).
   * - Prices come from the denormalized station_current_prices table instead of a
   *   DISTINCT ON over the whole report history.
   */
  async findNearby(q: NearbyQuery) {
    const point = Prisma.sql`ST_SetSRID(ST_MakePoint(${q.lng}, ${q.lat}), 4326)::geography`;
    const orderBy =
      q.sortBy === 'price'
        ? Prisma.sql`cp.price_milli ASC NULLS LAST, distance_m ASC`
        : Prisma.sql`distance_m ASC`;
    const offset = (q.page - 1) * q.pageSize;

    const [rows, [count]] = await Promise.all([
      this.prisma.$queryRaw<NearbyRow[]>`
        SELECT s.id, s.name, s.brand, s.address,
               ST_Y(s.location::geometry) AS lat,
               ST_X(s.location::geometry) AS lng,
               ST_Distance(s.location, ${point}) AS distance_m,
               cp.price_milli, cp.source AS price_source, cp.reported_at
        FROM stations s
        LEFT JOIN station_current_prices cp
               ON cp.station_id = s.id AND cp.fuel_type = ${q.fuelType}::fuel_type
        WHERE ST_DWithin(s.location, ${point}, ${q.radiusMeters})
        ORDER BY ${orderBy}
        LIMIT ${q.pageSize} OFFSET ${offset}`,
      this.prisma.$queryRaw<{ total: bigint }[]>`
        SELECT count(*) AS total FROM stations s
        WHERE ST_DWithin(s.location, ${point}, ${q.radiusMeters})`,
    ]);

    const items = rows.map((r) => ({
      id: r.id,
      name: r.name,
      brand: r.brand,
      address: r.address,
      lat: r.lat,
      lng: r.lng,
      distanceMeters: Math.round(r.distance_m),
      price: r.price_milli
        ? {
            priceMilli: r.price_milli,
            source: r.price_source,
            reportedAt: r.reported_at,
            stale: isStale(r.reported_at),
          }
        : null,
    }));
    return paginate(items, Number(count?.total ?? 0), q.page, q.pageSize);
  }

  async findOne(id: string) {
    const [station] = await this.prisma.$queryRaw<
      {
        id: string;
        name: string;
        brand: string;
        cnpj: string | null;
        address: string;
        city: string;
        lat: number;
        lng: number;
      }[]
    >`
      SELECT id, name, brand, cnpj, address, city,
             ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng
      FROM stations WHERE id = ${id}::uuid`;
    if (!station) throw new NotFoundException('Station not found');

    const prices = await this.prisma.stationCurrentPrice.findMany({
      where: { stationId: id },
      orderBy: { fuelType: 'asc' },
    });
    return {
      ...station,
      prices: prices.map((p) => ({
        fuelType: p.fuelType,
        priceMilli: p.priceMilli,
        source: p.source,
        reportedAt: p.reportedAt,
        stale: isStale(p.reportedAt),
      })),
    };
  }

  async history(id: string, q: PriceHistoryQuery) {
    const exists = await this.prisma.station.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException('Station not found');
    const since = new Date(Date.now() - q.days * 86_400_000);
    const points = await this.prisma.priceReport.findMany({
      where: { stationId: id, fuelType: q.fuelType, status: 'ACTIVE', reportedAt: { gte: since } },
      orderBy: { reportedAt: 'asc' },
      select: { priceMilli: true, source: true, reportedAt: true, confirmationsCount: true },
    });
    return { fuelType: q.fuelType, days: q.days, points };
  }

  /**
   * Reports waiting for confirmation, so other users can vote on them.
   * For a logged-in caller each report carries `isMine` / `confirmedByMe`; the author id itself is
   * never exposed.
   */
  async pendingReports(id: string, userId?: string) {
    const reports = await this.prisma.priceReport.findMany({
      where: { stationId: id, status: 'PENDING' },
      orderBy: { reportedAt: 'desc' },
      take: 20,
      select: {
        id: true,
        userId: true,
        fuelType: true,
        priceMilli: true,
        confirmationsCount: true,
        reportedAt: true,
        // Only this caller's own vote (at most one row, by the composite primary key).
        confirmations: userId ? { where: { userId }, select: { userId: true } } : false,
      },
    });
    return reports.map(({ userId: author, confirmations, ...report }) => ({
      ...report,
      isMine: userId !== undefined && author === userId,
      confirmedByMe: Array.isArray(confirmations) && confirmations.length > 0,
    }));
  }
}
