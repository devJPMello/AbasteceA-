import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { PriceEventsPublisher } from '../alerts/price-events.publisher';
import type { Env } from '../config/env';
import { applyCurrentPrice } from '../prices/current-price';
import { PrismaService } from '../prisma/prisma.service';
import { latestPerStationFuel, parseAnpCsv, type AnpRow } from './anp-csv';
import { GEOCODER, type Geocoder } from './geocoder';

export interface ImportSummary {
  rowsRead: number;
  rowsImported: number;
  rowsSkipped: number;
  stationsCreated: number;
}

/** ANP files are Latin-1 in some releases and UTF-8 in others: try strict UTF-8 first. */
export function decodeAnpFile(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder('windows-1252').decode(buffer);
  }
}

@Injectable()
export class AnpImportService {
  private readonly logger = new Logger(AnpImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
    @Inject(GEOCODER) private readonly geocoder: Geocoder,
    private readonly events: PriceEventsPublisher,
  ) {}

  /** Downloads the configured dataset and imports it. */
  async importFromUrl(url: string) {
    const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
    if (!res.ok) throw new Error(`ANP download failed: HTTP ${res.status}`);
    return this.importFromText(decodeAnpFile(await res.arrayBuffer()));
  }

  /**
   * Idempotent: re-importing the same file adds nothing (see the partial unique index
   * price_reports_anp_unique). Every execution is recorded in anp_import_runs.
   */
  async importFromText(text: string): Promise<ImportSummary> {
    const run = await this.prisma.anpImportRun.create({ data: { status: 'RUNNING' } });
    try {
      const parsed = parseAnpCsv(text, {
        municipality: this.config.get('ANP_MUNICIPALITY', { infer: true }),
        state: this.config.get('ANP_STATE', { infer: true }),
      });
      const rows = latestPerStationFuel(parsed.rows);
      const summary: ImportSummary = {
        rowsRead: parsed.totalRows,
        rowsImported: 0,
        rowsSkipped: parsed.invalidRows,
        stationsCreated: 0,
      };

      const byStation = new Map<string, AnpRow[]>();
      for (const row of rows) byStation.set(row.cnpj, [...(byStation.get(row.cnpj) ?? []), row]);

      for (const [cnpj, stationRows] of byStation) {
        const { id: stationId, created } = await this.ensureStation(cnpj, stationRows[0]!);
        if (!stationId) {
          summary.rowsSkipped += stationRows.length; // could not locate it on the map
          continue;
        }
        if (created) summary.stationsCreated++;
        for (const row of stationRows) {
          if (await this.insertReport(stationId, row)) summary.rowsImported++;
        }
      }

      await this.prisma.anpImportRun.update({
        where: { id: run.id },
        data: {
          status: 'SUCCEEDED',
          finishedAt: new Date(),
          rowsRead: summary.rowsRead,
          rowsImported: summary.rowsImported,
          rowsSkipped: summary.rowsSkipped,
        },
      });
      this.logger.log(`ANP import finished: ${JSON.stringify(summary)}`);
      return summary;
    } catch (err) {
      await this.prisma.anpImportRun.update({
        where: { id: run.id },
        data: { status: 'FAILED', finishedAt: new Date(), error: String(err).slice(0, 1000) },
      });
      throw err;
    }
  }

  /** Match by CNPJ; geocode and create only unknown stations (the DB is the geocoding cache). */
  private async ensureStation(cnpj: string, row: AnpRow) {
    const existing = await this.prisma.station.findUnique({
      where: { cnpj },
      select: { id: true },
    });
    if (existing) return { id: existing.id, created: false };

    const city = this.config.get('ANP_MUNICIPALITY', { infer: true });
    const query = [row.street, row.number, row.district, city, 'Tocantins', 'Brasil']
      .filter(Boolean)
      .join(', ');
    const point = await this.geocoder.geocode(query);
    if (!point) {
      this.logger.warn(`Skipping station ${cnpj}: address could not be geocoded`);
      return { id: null, created: false };
    }

    const id = randomUUID();
    await this.prisma.$executeRaw`
      INSERT INTO stations (id, name, brand, cnpj, address, city, source, location)
      VALUES (${id}::uuid, ${row.stationName}, ${row.brand}, ${cnpj}, ${row.address},
              ${city}, 'ANP'::price_source,
              ST_SetSRID(ST_MakePoint(${point.lng}, ${point.lat}), 4326)::geography)`;
    return { id, created: true };
  }

  /** Returns true when a new report was stored (false = already imported before). */
  private async insertReport(stationId: string, row: AnpRow): Promise<boolean> {
    const id = randomUUID();
    const inserted = await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ id: string }[]>`
        INSERT INTO price_reports
          (id, station_id, user_id, fuel_type, price_milli, source, status, reported_at)
        VALUES (${id}::uuid, ${stationId}::uuid, NULL, ${row.fuelType}::fuel_type, ${row.priceMilli},
                'ANP'::price_source, 'ACTIVE'::report_status, ${row.collectedAt})
        ON CONFLICT (station_id, fuel_type, reported_at) WHERE source = 'ANP' DO NOTHING
        RETURNING id`;
      if (rows.length === 0) return false;
      await applyCurrentPrice(tx, {
        id,
        stationId,
        fuelType: row.fuelType,
        priceMilli: row.priceMilli,
        source: 'ANP',
        reportedAt: row.collectedAt,
      });
      return true;
    });
    if (inserted) {
      try {
        await this.events.stationPriceChanged(stationId, row.fuelType);
      } catch (err) {
        this.logger.error(`Could not enqueue alert check: ${String(err)}`);
      }
    }
    return inserted;
  }
}
