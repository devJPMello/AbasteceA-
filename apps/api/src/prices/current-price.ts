import type { Prisma } from '@prisma/client';

export interface PriceRecord {
  id: string;
  stationId: string;
  fuelType: string;
  priceMilli: number;
  source: string;
  reportedAt: Date;
}

/**
 * Upsert into the denormalized current-price table, but only if this report is newer
 * than what is stored. Doing it in a single ON CONFLICT ... WHERE statement keeps it atomic,
 * so a late-activated old report (or an ANP row) can never overwrite a newer price.
 */
export async function applyCurrentPrice(tx: Prisma.TransactionClient, report: PriceRecord) {
  await tx.$executeRaw`
    INSERT INTO station_current_prices
      (station_id, fuel_type, price_milli, source, report_id, reported_at)
    VALUES (${report.stationId}::uuid, ${report.fuelType}::fuel_type, ${report.priceMilli},
            ${report.source}::price_source, ${report.id}::uuid, ${report.reportedAt})
    ON CONFLICT (station_id, fuel_type) DO UPDATE
      SET price_milli = EXCLUDED.price_milli,
          source      = EXCLUDED.source,
          report_id   = EXCLUDED.report_id,
          reported_at = EXCLUDED.reported_at
      WHERE station_current_prices.reported_at <= EXCLUDED.reported_at`;
}
