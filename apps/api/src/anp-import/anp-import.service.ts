import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { PriceEventsPublisher } from '../alerts/price-events.publisher';
import type { Env } from '../config/env';
import { applyCurrentPrice } from '../prices/current-price';
import { PrismaService } from '../prisma/prisma.service';
import { latestPerStationFuel, parseAnpCsv, type AnpRow } from './anp-csv';
import { UNKNOWN_ADDRESS, UNKNOWN_BRAND } from '../stations/station-defaults';
import { GEOCODER, type Geocoder } from './geocoder';
import { resolveByName, resolveCandidates } from './station-matching';

export interface ImportSummary {
  rowsRead: number;
  rowsImported: number;
  rowsSkipped: number;
  stationsCreated: number;
  /** Existing stations (e.g. from OpenStreetMap) that received a CNPJ by proximity + brand. */
  stationsMatched: number;
  /** Stations skipped because several existing ones were equally plausible (never guessed). */
  stationsAmbiguous: number;
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
        stationsMatched: 0,
        stationsAmbiguous: 0,
      };

      const byStation = new Map<string, AnpRow[]>();
      for (const row of rows) byStation.set(row.cnpj, [...(byStation.get(row.cnpj) ?? []), row]);

      for (const [cnpj, stationRows] of byStation) {
        const { id: stationId, outcome } = await this.ensureStation(cnpj, stationRows[0]!);
        if (!stationId) {
          summary.rowsSkipped += stationRows.length; // not located, or ambiguous: no price is written
          if (outcome === 'ambiguous') summary.stationsAmbiguous++;
          continue;
        }
        if (outcome === 'created') summary.stationsCreated++;
        if (outcome === 'matched') summary.stationsMatched++;
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

  /**
   * Finds (or creates) the station for an ANP row, in this order:
   *  1. by CNPJ: the key; also what makes re-imports cheap and idempotent;
   *  2. by PROXIMITY + BRAND among stations that have no CNPJ yet (e.g. imported from
   *     OpenStreetMap): geocode the ANP address, look within ANP_MATCH_RADIUS_METERS with
   *     ST_DWithin, and merge only when exactly one candidate is clearly the same station;
   *  3. otherwise create a new station (the geocoding result is stored: the DB is the cache).
   * An ambiguous match is skipped and logged: a duplicate pin is better than prices on the wrong
   * station.
   */
  private async ensureStation(
    cnpj: string,
    row: AnpRow,
  ): Promise<{
    id: string | null;
    outcome: 'existing' | 'matched' | 'created' | 'ambiguous' | 'ungeocoded';
  }> {
    const existing = await this.prisma.station.findUnique({
      where: { cnpj },
      select: { id: true },
    });
    if (existing) return { id: existing.id, outcome: 'existing' };

    const city = this.config.get('ANP_MUNICIPALITY', { infer: true });
    const query = [row.street, row.number, row.district, city, 'Tocantins', 'Brasil']
      .filter(Boolean)
      .join(', ');
    const point = await this.geocoder.geocode(query);
    if (!point) {
      // Palmas' block addresses ("QUADRA 406 NORTE AV NS 6") are often not understood by the
      // geocoder. Fall back to the station NAME among stations without a CNPJ.
      const byName = await this.matchByName(cnpj, row);
      if (byName) return byName;
      this.logger.warn(`Skipping station ${cnpj}: address could not be geocoded`);
      return { id: null, outcome: 'ungeocoded' };
    }

    // ST_DWithin on geography takes metres and uses the GIST index; closest candidates first.
    const radius = this.config.get('ANP_MATCH_RADIUS_METERS', { infer: true });
    const candidates = await this.prisma.$queryRaw<{ id: string; brand: string }[]>`
      SELECT id, brand
      FROM stations
      WHERE cnpj IS NULL
        AND ST_DWithin(location, ST_SetSRID(ST_MakePoint(${point.lng}, ${point.lat}), 4326)::geography, ${radius})
      ORDER BY ST_Distance(location, ST_SetSRID(ST_MakePoint(${point.lng}, ${point.lat}), 4326)::geography)`;

    const match = resolveCandidates(candidates, row.brand);
    if (match.kind === 'ambiguous') {
      this.logger.warn(
        `Station ${cnpj} (${row.stationName}, ${row.brand}) is ambiguous between ${match.ids.length} nearby stations (${match.ids.join(', ')}): skipped, not guessed`,
      );
      return { id: null, outcome: 'ambiguous' };
    }
    if (match.kind === 'matched' && (await this.claimStation(match.id, cnpj, row))) {
      return { id: match.id, outcome: 'matched' };
    }

    const id = randomUUID();
    await this.prisma.$executeRaw`
      INSERT INTO stations (id, name, brand, cnpj, address, city, source, location)
      VALUES (${id}::uuid, ${row.stationName}, ${row.brand}, ${cnpj}, ${row.address},
              ${city}, 'ANP'::station_source,
              ST_SetSRID(ST_MakePoint(${point.lng}, ${point.lat}), 4326)::geography)`;
    return { id, outcome: 'created' };
  }

  /**
   * Guarded by cnpj IS NULL: if another row claimed the station meanwhile, nothing changes.
   * Only fills what we did not know (placeholders); never overwrites good data.
   */
  private async claimStation(id: string, cnpj: string, row: AnpRow): Promise<boolean> {
    const updated = await this.prisma.$executeRaw`
      UPDATE stations
      SET cnpj = ${cnpj},
          brand = CASE WHEN brand = ${UNKNOWN_BRAND} THEN ${row.brand} ELSE brand END,
          address = CASE WHEN address = ${UNKNOWN_ADDRESS} THEN ${row.address} ELSE address END
      WHERE id = ${id}::uuid AND cnpj IS NULL`;
    return updated === 1;
  }

  /** Name-based fallback for rows that could not be located. Null = no usable match. */
  private async matchByName(
    cnpj: string,
    row: AnpRow,
  ): Promise<{ id: string | null; outcome: 'matched' | 'ambiguous' } | null> {
    const candidates = await this.prisma.$queryRaw<{ id: string; name: string; brand: string }[]>`
      SELECT id, name, brand FROM stations WHERE cnpj IS NULL`;
    const match = resolveByName(candidates, row.stationName, row.brand);
    if (match.kind === 'ambiguous') {
      this.logger.warn(
        `Station ${cnpj} (${row.stationName}) matches ${match.ids.length} stations by name (${match.ids.join(', ')}): skipped, not guessed`,
      );
      return { id: null, outcome: 'ambiguous' };
    }
    if (match.kind === 'matched' && (await this.claimStation(match.id, cnpj, row))) {
      this.logger.log(
        `Station ${cnpj} (${row.stationName}) matched by name (address not geocodable)`,
      );
      return { id: match.id, outcome: 'matched' };
    }
    return null;
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
