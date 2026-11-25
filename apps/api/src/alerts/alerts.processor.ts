import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { ALERTS_QUEUE } from '../queues/queues.module';
import { AlertMatcherService } from './alert-matcher.service';
import { ALERT_CREATED, STATION_PRICE_CHANGED } from './price-events.publisher';

/** BullMQ worker for the alerts queue. Thin on purpose: the logic is in AlertMatcherService. */
@Processor(ALERTS_QUEUE)
export class AlertsProcessor extends WorkerHost {
  private readonly logger = new Logger(AlertsProcessor.name);

  constructor(private readonly matcher: AlertMatcherService) {
    super();
  }

  async process(job: Job<{ stationId?: string; fuelType?: string; alertId?: string }>) {
    switch (job.name) {
      case STATION_PRICE_CHANGED:
        return this.matcher.onStationPriceChanged(job.data.stationId!, job.data.fuelType!);
      case ALERT_CREATED:
        return this.matcher.onAlertCreated(job.data.alertId!);
      default:
        this.logger.warn(`Unknown job "${job.name}" ignored`);
    }
  }
}
