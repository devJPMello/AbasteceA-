/**
 * Development seed.
 *
 * STATIONS are REAL: a committed snapshot of OpenStreetMap data for Palmas-TO
 * (prisma/data/palmas-osm-stations.json, © OpenStreetMap contributors, ODbL). It covers only what
 * volunteers mapped, so it is incomplete, and names/brands may be out of date.
 *
 * PRICES are FICTITIOUS demo data (a formula around typical values, attributed to a "Seed Bot"
 * user). Real prices come from users and from the ANP import.
 *
 * Safe to re-run: it resets stations, reports and current prices.
 * Refresh the station snapshot with `pnpm --filter @bomba-certa/api osm:fetch`.
 */
import { PrismaClient, type FuelType } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { UNKNOWN_ADDRESS, UNKNOWN_BRAND } from '../src/stations/station-defaults';
import type { OsmStation } from '../src/stations/osm-stations';

const prisma = new PrismaClient();

const snapshot = JSON.parse(
  readFileSync(resolve(__dirname, 'data/palmas-osm-stations.json'), 'utf8'),
) as { osmDataTimestamp: string; stations: OsmStation[] };
const STATIONS = snapshot.stations;

// Rough Palmas averages (ANP, week of 15-21/11/2026: gasoline R$ 7,02, ethanol R$ 5,04, diesel S10 R$ 7,46).
// Still fictitious per station: only the order of magnitude is real.
const BASE: Record<FuelType, number> = {
  GASOLINE_COMMON: 6990,
  GASOLINE_PREMIUM: 7110,
  ETHANOL: 5040,
  DIESEL_S10: 7460,
};

// Deterministic pseudo-noise so re-running gives the same data.
const noise = (i: number, j: number, k: number) => ((i * 7 + j * 13 + k * 31) % 21) - 10; // -10..+10

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Refusing to seed in production');
  // The seed TRUNCATEs tables: never run it against a remote database by accident.
  const host = new URL(process.env.DATABASE_URL ?? 'postgresql://localhost').hostname;
  if (!['localhost', '127.0.0.1', '::1'].includes(host) && process.env.SEED_CONFIRM !== 'yes') {
    throw new Error(
      `DATABASE_URL points to ${host}, not localhost. This seed erases data: set SEED_CONFIRM=yes to proceed.`,
    );
  }

  await prisma.$executeRawUnsafe(
    'TRUNCATE price_reports, station_current_prices, stations RESTART IDENTITY CASCADE',
  );

  const bot = await prisma.user.upsert({
    where: { email: 'seed-bot@bombacerta.dev' },
    update: {},
    create: {
      email: 'seed-bot@bombacerta.dev',
      name: 'Seed Bot',
      passwordHash: await bcrypt.hash(randomBytes(16).toString('hex'), 10),
    },
  });

  const fuels = Object.keys(BASE) as FuelType[];
  const daysAgo = [18, 12, 6, 1];

  for (const [i, s] of STATIONS.entries()) {
    const id = randomUUID();
    // No CNPJ: OSM does not carry it. The ANP importer fills it in when it matches the station.
    await prisma.$executeRaw`
      INSERT INTO stations (id, name, brand, address, source, location)
      VALUES (${id}::uuid, ${s.name}, ${s.brand ?? UNKNOWN_BRAND}, ${s.address ?? UNKNOWN_ADDRESS},
              'OSM'::station_source,
              ST_SetSRID(ST_MakePoint(${s.lng}, ${s.lat}), 4326)::geography)`;

    for (const [j, fuel] of fuels.entries()) {
      // Station index 3 has an old latest report (> 7 days) to demo the "stale" badge.
      const offsets = i === 3 ? daysAgo.map((d) => d + 9) : daysAgo;
      let latest: { id: string; price: number; at: Date } | null = null;

      for (const [k, d] of offsets.entries()) {
        const price = BASE[fuel] + noise(i, j, k) * 10 + k * 5; // slow upward drift
        const at = new Date(Date.now() - d * 86_400_000);
        const report = await prisma.priceReport.create({
          data: {
            stationId: id,
            userId: bot.id,
            fuelType: fuel,
            priceMilli: price,
            source: 'USER',
            status: 'ACTIVE',
            reportedAt: at,
          },
        });
        latest = { id: report.id, price, at };
      }
      if (latest) {
        await prisma.stationCurrentPrice.create({
          data: {
            stationId: id,
            fuelType: fuel,
            priceMilli: latest.price,
            source: 'USER',
            reportId: latest.id,
            reportedAt: latest.at,
          },
        });
      }
    }
  }
  console.log(
    `Seeded ${STATIONS.length} real stations (OpenStreetMap data from ${snapshot.osmDataTimestamp}) with FICTITIOUS prices.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
