/**
 * Development seed: Palmas-TO stations with FICTITIOUS prices.
 * Station names and coordinates are approximate placeholders around real Palmas areas;
 * they are not verified against the real stations. Safe to re-run (it resets these tables).
 */
import { PrismaClient, type FuelType } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomBytes, randomUUID } from 'node:crypto';

const prisma = new PrismaClient();

const STATIONS = [
  {
    name: 'Ipiranga Av. JK',
    brand: 'Ipiranga',
    address: 'Av. Juscelino Kubitschek, 104 Sul',
    lat: -10.1887,
    lng: -48.3318,
  },
  {
    name: 'Shell Av. NS-01',
    brand: 'Shell',
    address: 'Av. NS-01, 302 Norte',
    lat: -10.1695,
    lng: -48.335,
  },
  {
    name: 'Petrobras Teotônio Segurado',
    brand: 'Petrobras',
    address: 'Av. Teotônio Segurado, 502 Sul',
    lat: -10.2005,
    lng: -48.3342,
  },
  {
    name: 'Ale Av. LO-27',
    brand: 'Ale',
    address: 'Av. LO-27, 603 Norte',
    lat: -10.1621,
    lng: -48.3265,
  },
  {
    name: 'Ipiranga Aureny III',
    brand: 'Ipiranga',
    address: 'Av. Tocantins, Aureny III',
    lat: -10.2412,
    lng: -48.3128,
  },
  {
    name: 'Raízen Taquaralto',
    brand: 'Shell',
    address: 'Av. Principal, Taquaralto',
    lat: -10.3011,
    lng: -48.3603,
  },
  {
    name: 'Posto Bandeira Branca Plano Sul',
    brand: 'Bandeira Branca',
    address: 'ARSE 72, Plano Diretor Sul',
    lat: -10.2146,
    lng: -48.3375,
  },
  {
    name: 'Petrobras Av. NS-04',
    brand: 'Petrobras',
    address: 'Av. NS-04, 906 Sul',
    lat: -10.2331,
    lng: -48.3299,
  },
  {
    name: 'Ale Taquari',
    brand: 'Ale',
    address: 'Av. Taquari, Jardim Taquari',
    lat: -10.2788,
    lng: -48.3055,
  },
  {
    name: 'Shell Orla',
    brand: 'Shell',
    address: 'Av. Parque, Orla da Praia da Graciosa',
    lat: -10.1938,
    lng: -48.3151,
  },
  {
    name: 'Ipiranga Aeroporto',
    brand: 'Ipiranga',
    address: 'Av. Joaquim Teotônio Segurado, Aeroporto',
    lat: -10.2414,
    lng: -48.3532,
  },
  {
    name: 'Posto Bandeira Branca Norte',
    brand: 'Bandeira Branca',
    address: 'ARNO 33, Plano Diretor Norte',
    lat: -10.1553,
    lng: -48.3329,
  },
];

const BASE: Record<FuelType, number> = {
  GASOLINE_COMMON: 6190,
  GASOLINE_PREMIUM: 6490,
  ETHANOL: 4590,
  DIESEL_S10: 6090,
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
    await prisma.$executeRaw`
      INSERT INTO stations (id, name, brand, address, location)
      VALUES (${id}::uuid, ${s.name}, ${s.brand}, ${s.address},
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
  console.log(`Seeded ${STATIONS.length} stations with fictitious prices.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
