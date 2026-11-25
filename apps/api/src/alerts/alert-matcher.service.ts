import { Injectable, Logger } from '@nestjs/common';
import { PRICE_FRESHNESS_DAYS } from '@bomba-certa/shared';
import { PrismaService } from '../prisma/prisma.service';
import { alertMessage } from './alert-messages';
import { NotificationsService } from './notifications.service';

interface TriggeredAlert {
  id: string;
  user_id: string;
  target_price_milli: number;
}

/**
 * Decides which alerts fire. All the geography lives in SQL (ST_DWithin), so a price change
 * at one station is matched against every alert centre in a single indexed query instead of
 * loading alerts into memory.
 *
 * Alert lifecycle (`last_notified_at`):
 *   NULL      = armed: fires the first time a fresh price <= target appears inside the radius.
 *   NOT NULL  = fired: stays quiet (no spam) until NO station in the radius is at/below the
 *               target any more, then it is re-armed.
 */
@Injectable()
export class AlertMatcherService {
  private readonly logger = new Logger(AlertMatcherService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** A station's price changed: notify armed alerts it satisfies, then re-arm stale ones. */
  async onStationPriceChanged(stationId: string, fuelType: string) {
    const [current] = await this.prisma.$queryRaw<{ price_milli: number; name: string }[]>`
      SELECT cp.price_milli, s.name
      FROM station_current_prices cp
      JOIN stations s ON s.id = cp.station_id
      WHERE cp.station_id = ${stationId}::uuid
        AND cp.fuel_type = ${fuelType}::fuel_type
        AND cp.reported_at > now() - make_interval(days => ${PRICE_FRESHNESS_DAYS}::int)`;

    if (current) {
      // ST_DWithin(alert.center, station.location, alert.radius): is this station inside the
      // alert's circle? Both columns are geography, so the radius is in metres and the GIST
      // index on price_alerts.center prunes the candidates.
      const triggered = await this.prisma.$queryRaw<TriggeredAlert[]>`
        SELECT a.id, a.user_id, a.target_price_milli
        FROM price_alerts a
        JOIN stations s ON s.id = ${stationId}::uuid
        WHERE a.active
          AND a.last_notified_at IS NULL
          AND a.fuel_type = ${fuelType}::fuel_type
          AND a.target_price_milli >= ${current.price_milli}
          AND ST_DWithin(a.center, s.location, a.radius_meters)`;

      for (const alert of triggered) {
        await this.fire(alert, {
          stationName: current.name,
          fuelType,
          priceMilli: current.price_milli,
        });
      }
    }
    await this.rearm(fuelType);
  }

  /** A new alert may already be satisfied: look for the cheapest matching station right away. */
  async onAlertCreated(alertId: string) {
    const [alert] = await this.prisma.$queryRaw<
      (TriggeredAlert & { fuel_type: string; last_notified_at: Date | null })[]
    >`
      SELECT id, user_id, target_price_milli, fuel_type, last_notified_at
      FROM price_alerts WHERE id = ${alertId}::uuid AND active`;
    if (!alert || alert.last_notified_at) return;

    const [hit] = await this.prisma.$queryRaw<{ name: string; price_milli: number }[]>`
      SELECT s.name, cp.price_milli
      FROM price_alerts a
      JOIN stations s ON ST_DWithin(a.center, s.location, a.radius_meters)
      JOIN station_current_prices cp
        ON cp.station_id = s.id AND cp.fuel_type = a.fuel_type
      WHERE a.id = ${alertId}::uuid
        AND cp.price_milli <= a.target_price_milli
        AND cp.reported_at > now() - make_interval(days => ${PRICE_FRESHNESS_DAYS}::int)
      ORDER BY cp.price_milli ASC
      LIMIT 1`;
    if (hit) {
      await this.fire(alert, {
        stationName: hit.name,
        fuelType: alert.fuel_type,
        priceMilli: hit.price_milli,
      });
    }
  }

  /**
   * Claim-then-notify: the conditional UPDATE is the lock, so two workers (or a retried job)
   * can never both notify. If delivery fails we release the claim and rethrow so BullMQ retries.
   */
  private async fire(
    alert: TriggeredAlert,
    info: { stationName: string; fuelType: string; priceMilli: number },
  ) {
    const claimed = await this.prisma.$executeRaw`
      UPDATE price_alerts SET last_notified_at = now()
      WHERE id = ${alert.id}::uuid AND last_notified_at IS NULL`;
    if (claimed === 0) return;

    try {
      await this.notifications.notify(
        alert.user_id,
        alertMessage({ ...info, targetPriceMilli: alert.target_price_milli }),
      );
      this.logger.log(`Alert ${alert.id} fired (${info.stationName} @ ${info.priceMilli})`);
    } catch (err) {
      await this.prisma.$executeRaw`
        UPDATE price_alerts SET last_notified_at = NULL WHERE id = ${alert.id}::uuid`;
      throw err;
    }
  }

  /** Re-arm fired alerts for which no fresh station in range is at/below the target any more. */
  private async rearm(fuelType: string) {
    await this.prisma.$executeRaw`
      UPDATE price_alerts a SET last_notified_at = NULL
      WHERE a.last_notified_at IS NOT NULL
        AND a.fuel_type = ${fuelType}::fuel_type
        AND NOT EXISTS (
          SELECT 1
          FROM stations s
          JOIN station_current_prices cp
            ON cp.station_id = s.id AND cp.fuel_type = a.fuel_type
          WHERE ST_DWithin(a.center, s.location, a.radius_meters)
            AND cp.price_milli <= a.target_price_milli
            AND cp.reported_at > now() - make_interval(days => ${PRICE_FRESHNESS_DAYS}::int)
        )`;
  }
}
