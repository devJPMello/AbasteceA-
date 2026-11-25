/**
 * Runs the ANP import once, outside the schedule. Uses the COMPILED app (dist): Nest's dependency
 * injection needs decorator metadata, which tsx/esbuild does not emit.
 *   pnpm --filter @bomba-certa/api anp:import -- --file=path/to/10-gasolina-etanol.csv
 *   pnpm --filter @bomba-certa/api anp:import            (downloads ANP_DATASET_URL)
 */
require('reflect-metadata');
const { readFile } = require('node:fs/promises');
const { NestFactory } = require('@nestjs/core');
const { ConfigService } = require('@nestjs/config');
const { AppModule } = require('../dist/app.module');
const { AnpImportService, decodeAnpFile } = require('../dist/anp-import/anp-import.service');

// Buffer.buffer can be a larger shared pool: slice exactly this file's bytes.
const toArrayBuffer = (b) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'warn', 'error'],
  });
  try {
    const importer = app.get(AnpImportService);
    const file = process.argv.find((a) => a.startsWith('--file='))?.slice('--file='.length);
    let summary;
    if (file) {
      summary = await importer.importFromText(decodeAnpFile(toArrayBuffer(await readFile(file))));
    } else {
      const url = app.get(ConfigService).get('ANP_DATASET_URL');
      if (!url) throw new Error('Set ANP_DATASET_URL or pass --file=<path>');
      summary = await importer.importFromUrl(url);
    }
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
