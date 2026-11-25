import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CONFIRMATIONS_REQUIRED,
  PRICE_FRESHNESS_DAYS,
  REPORT_COOLDOWN_HOURS,
  type CreatePriceReportInput,
  type FuelType,
} from '@bomba-certa/shared';
import { Prisma, type PriceReport } from '@prisma/client';
import type { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { MIN_SAMPLES_FOR_REFERENCE, isPlausible } from './plausibility';

type Tx = Prisma.TransactionClient;

@Injectable()
export class PricesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async createReport(userId: string, input: CreatePriceReportInput) {
    const station = await this.prisma.station.findUnique({
      where: { id: input.stationId },
      select: { id: true },
    });
    if (!station) throw new NotFoundException('Station not found');

    await this.assertCooldown(userId, input);

    const reference = await this.cityMedian(input.fuelType);
    const pct = this.config.get('PRICE_PLAUSIBILITY_PCT', { infer: true });
    const status = isPlausible(input.priceMilli, reference, pct) ? 'ACTIVE' : 'PENDING';

    return this.prisma.$transaction(async (tx) => {
      const report = await tx.priceReport.create({
        data: {
          stationId: input.stationId,
          userId,
          fuelType: input.fuelType,
          priceMilli: input.priceMilli,
          source: 'USER',
          status,
        },
      });
      if (status === 'ACTIVE') await this.applyCurrentPrice(tx, report);
      return report;
    });
  }

  async confirmReport(userId: string, reportId: string) {
    const report = await this.prisma.priceReport.findUnique({ where: { id: reportId } });
    if (!report) throw new NotFoundException('Report not found');
    if (report.source === 'ANP') throw new BadRequestException('ANP reports cannot be confirmed');
    if (report.userId === userId)
      throw new ForbiddenException('You cannot confirm your own report');
    if (report.status === 'REJECTED') throw new ConflictException('Report was rejected');

    return this.prisma.$transaction(async (tx) => {
      // Composite PK (report, user) makes a second vote fail with P2002 -> 409.
      await tx.reportConfirmation.create({ data: { reportId, userId } });
      const updated = await tx.priceReport.update({
        where: { id: reportId },
        data: { confirmationsCount: { increment: 1 } },
      });
      if (updated.status === 'PENDING' && updated.confirmationsCount >= CONFIRMATIONS_REQUIRED) {
        const activated = await tx.priceReport.update({
          where: { id: reportId },
          data: { status: 'ACTIVE' },
        });
        await this.applyCurrentPrice(tx, activated);
        return activated;
      }
      return updated;
    });
  }

  /** One report per user + station + fuel every REPORT_COOLDOWN_HOURS. */
  private async assertCooldown(userId: string, input: CreatePriceReportInput) {
    const since = new Date(Date.now() - REPORT_COOLDOWN_HOURS * 3_600_000);
    const last = await this.prisma.priceReport.findFirst({
      where: {
        userId,
        stationId: input.stationId,
        fuelType: input.fuelType,
        reportedAt: { gte: since },
      },
      orderBy: { reportedAt: 'desc' },
      select: { reportedAt: true },
    });
    if (!last) return;
    const retryAfterSeconds = Math.ceil(
      (last.reportedAt.getTime() + REPORT_COOLDOWN_HOURS * 3_600_000 - Date.now()) / 1000,
    );
    throw new HttpException(
      `You already reported this fuel at this station. Try again in ${Math.ceil(retryAfterSeconds / 60)} min.`,
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  /**
   * Median of the fresh current prices for a fuel across the city.
   * Median (not mean) so a single absurd value cannot drag the reference.
   * percentile_cont(0.5) is the SQL median; returns null with too few samples.
   */
  private async cityMedian(fuelType: FuelType): Promise<number | null> {
    const [row] = await this.prisma.$queryRaw<{ median: number | null; samples: bigint }[]>`
      SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY price_milli)::float8 AS median,
             count(*) AS samples
      FROM station_current_prices
      WHERE fuel_type = ${fuelType}::fuel_type
        AND reported_at > now() - make_interval(days => ${PRICE_FRESHNESS_DAYS}::int)`;
    if (!row || Number(row.samples) < MIN_SAMPLES_FOR_REFERENCE) return null;
    return row.median;
  }

  /**
   * Upsert into the denormalized current-price table, but only if this report is newer
   * than what is stored. Doing it in a single ON CONFLICT ... WHERE statement keeps it atomic,
   * so a late-activated old report can never overwrite a newer price.
   */
  private async applyCurrentPrice(tx: Tx, report: PriceReport) {
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
}
