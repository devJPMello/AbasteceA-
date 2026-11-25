import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { ALERTS_QUEUE } from '../queues/queues.module';

export const STATION_PRICE_CHANGED = 'station-price-changed';
export const ALERT_CREATED = 'alert-created';

/**
 * Publishes domain events to the alerts queue. Producers (prices, ANP import) only know this
 * class, never BullMQ, which keeps them easy to unit-test with a one-method mock.
 */
@Injectable()
export class PriceEventsPublisher {
  constructor(@InjectQueue(ALERTS_QUEUE) private readonly queue: Queue) {}

  /**
   * No jobId on purpose: deduplicating by station+fuel would drop an event that arrives while
   * an earlier job is still running, and that job may already have read the old price.
   * Jobs are idempotent (the alert claim is a conditional UPDATE), so extra jobs are harmless.
   */
  stationPriceChanged(stationId: string, fuelType: string) {
    return this.queue.add(
      STATION_PRICE_CHANGED,
      { stationId, fuelType },
      {
        removeOnComplete: true,
        removeOnFail: 500,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      },
    );
  }

  alertCreated(alertId: string) {
    return this.queue.add(
      ALERT_CREATED,
      { alertId },
      {
        jobId: `alert_${alertId}`, // BullMQ forbids ":" in custom ids
        removeOnComplete: true,
        removeOnFail: 500,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      },
    );
  }
}
