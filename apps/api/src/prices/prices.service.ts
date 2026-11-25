import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
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
import type { PriceReport } from '@prisma/client';
import { PriceEventsPublisher } from '../alerts/price-events.publisher';
import type { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { applyCurrentPrice } from './current-price';
import { MIN_SAMPLES_FOR_REFERENCE, isPlausible } from './plausibility';

/** ANP is a field survey, so it can be up to ~2 weeks old and still be a good reference. */
const ANP_REFERENCE_DAYS = 21;

@Injectable()
export class PricesService {
  private readonly logger = new Logger(PricesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
    private readonly events: PriceEventsPublisher,
  ) {}

  /**
   * Called after the DB transaction commits. Best effort: if Redis is down the price is still
   * saved (the source of truth); alerts for it are simply late. A transactional outbox would
   * make this exactly-once, at the cost of more moving parts.
   */
  private async publishPriceChange(report: PriceReport) {
    try {
      await this.events.stationPriceChanged(report.stationId, report.fuelType);
    } catch (err) {
      this.logger.error(`Could not enqueue alert check: ${String(err)}`);
    }
  }

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

    const created = await this.prisma.$transaction(async (tx) => {
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
      if (status === 'ACTIVE') await applyCurrentPrice(tx, report);
      return report;
    });
    if (created.status === 'ACTIVE') await this.publishPriceChange(created);
    return created;
  }

  async confirmReport(userId: string, reportId: string) {
    const report = await this.prisma.priceReport.findUnique({ where: { id: reportId } });
    if (!report) throw new NotFoundException('Report not found');
    if (report.source === 'ANP') throw new BadRequestException('ANP reports cannot be confirmed');
    if (report.userId === userId)
      throw new ForbiddenException('You cannot confirm your own report');
    if (report.status === 'REJECTED') throw new ConflictException('Report was rejected');

    const result = await this.prisma.$transaction(async (tx) => {
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
        await applyCurrentPrice(tx, activated);
        return { report: activated, activated: true };
      }
      return { report: updated, activated: false };
    });
    if (result.activated) await this.publishPriceChange(result.report);
    return result.report;
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
   * Reference price for plausibility: the city median for a fuel.
   *
   * ANP survey prices come first: they are independent of app users, so a coordinated group
   * of fake reports cannot drag the reference. Only if ANP has too few samples do we fall back
   * to the median of all fresh prices. Median (not mean) so one absurd value cannot skew it;
   * percentile_cont(0.5) is the SQL median. Returns null when there is not enough data.
   */
  private async cityMedian(fuelType: FuelType): Promise<number | null> {
    const anp = await this.medianOf(fuelType, 'ANP', ANP_REFERENCE_DAYS);
    if (anp !== null) return anp;
    return this.medianOf(fuelType, null, PRICE_FRESHNESS_DAYS);
  }

  private async medianOf(
    fuelType: FuelType,
    source: 'ANP' | null,
    days: number,
  ): Promise<number | null> {
    const [row] = await this.prisma.$queryRaw<{ median: number | null; samples: bigint }[]>`
      SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY price_milli)::float8 AS median,
             count(*) AS samples
      FROM station_current_prices
      WHERE fuel_type = ${fuelType}::fuel_type
        AND (${source}::text IS NULL OR source = ${source}::price_source)
        AND reported_at > now() - make_interval(days => ${days}::int)`;
    if (!row || Number(row.samples) < MIN_SAMPLES_FOR_REFERENCE) return null;
    return row.median;
  }
}
