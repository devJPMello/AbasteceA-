import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Loads the repo .env (if present) and points the app at a dedicated test database. */
export function loadTestEnv() {
  for (const file of [resolve(__dirname, '../.env'), resolve(__dirname, '../../../.env')]) {
    try {
      for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
        const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
        if (m && process.env[m[1]!] === undefined) process.env[m[1]!] = m[2]!;
      }
    } catch {
      /* no .env file: CI provides variables directly */
    }
  }
  const url = new URL(process.env.DATABASE_URL!);
  url.pathname = '/bomba_certa_test';
  process.env.TEST_DATABASE_URL = url.toString();
  process.env.DATABASE_URL = url.toString();
  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET ??= 'test-secret-with-at-least-32-characters!!';
  process.env.REDIS_URL ??= 'redis://localhost:6379';
}

loadTestEnv();
