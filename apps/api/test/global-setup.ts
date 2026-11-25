import { PrismaClient } from '@prisma/client';
import { execSync } from 'node:child_process';
import { loadTestEnv } from './env';

/** Creates the test database if needed and applies all migrations (incl. PostGIS). */
export default async function globalSetup() {
  loadTestEnv();
  const testUrl = new URL(process.env.TEST_DATABASE_URL!);
  const adminUrl = new URL(testUrl.toString());
  adminUrl.pathname = '/postgres';

  const admin = new PrismaClient({ datasources: { db: { url: adminUrl.toString() } } });
  const exists = await admin.$queryRaw<
    { n: number }[]
  >`SELECT 1 AS n FROM pg_database WHERE datname = 'bomba_certa_test'`;
  if (exists.length === 0) await admin.$executeRawUnsafe('CREATE DATABASE bomba_certa_test');
  await admin.$disconnect();

  execSync('pnpm exec prisma migrate deploy', {
    cwd: __dirname + '/..',
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: testUrl.toString() },
  });
}
