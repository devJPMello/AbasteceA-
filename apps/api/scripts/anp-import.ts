/**
 * Runs the ANP import once, outside the schedule.
 *   pnpm --filter @bomba-certa/api anp:import                 -> downloads ANP_DATASET_URL
 *   pnpm --filter @bomba-certa/api anp:import -- --file=x.csv -> imports a local file
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { readFile } from 'node:fs/promises';
import { AppModule } from '../src/app.module';
import { AnpImportService, decodeAnpFile } from '../src/anp-import/anp-import.service';
import { ConfigService } from '@nestjs/config';

// Buffer.buffer can be a larger shared pool: slice exactly this file's bytes.
const toArrayBuffer = (b: Buffer) =>
  b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'warn', 'error'],
  });
  try {
    const importer = app.get(AnpImportService);
    const fileArg = process.argv.find((a) => a.startsWith('--file='))?.slice('--file='.length);
    const summary = fileArg
      ? await importer.importFromText(decodeAnpFile(toArrayBuffer(await readFile(fileArg))))
      : await importer.importFromUrl(
          (() => {
            const url = app.get(ConfigService).get<string>('ANP_DATASET_URL');
            if (!url) throw new Error('Set ANP_DATASET_URL or pass --file=<path>');
            return url;
          })(),
        );
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
