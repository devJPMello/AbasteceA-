import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';
import type { Env } from '../config/env';
import { ANP_IMPORT_QUEUE } from '../queues/queues.module';

/**
 * Registers the weekly repeatable job. upsertJobScheduler is idempotent: restarting the API
 * (or running several instances) never creates duplicate schedules, because the scheduler id
 * is fixed and lives in Redis.
 */
@Injectable()
export class AnpImportScheduler implements OnApplicationBootstrap {
  private readonly logger = new Logger(AnpImportScheduler.name);

  constructor(
    @InjectQueue(ANP_IMPORT_QUEUE) private readonly queue: Queue,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async onApplicationBootstrap() {
    if (!this.config.get('ANP_IMPORT_ENABLED', { infer: true })) return;
    if (!this.config.get('ANP_DATASET_URL', { infer: true })) {
      this.logger.warn('ANP_IMPORT_ENABLED is true but ANP_DATASET_URL is missing: not scheduling');
      return;
    }
    const pattern = this.config.get('ANP_CRON', { infer: true });
    await this.queue.upsertJobScheduler(
      'anp-weekly-import',
      { pattern, tz: this.config.get('ANP_CRON_TZ', { infer: true }) },
      {
        name: 'import',
        opts: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 60_000 },
          removeOnComplete: 20,
          removeOnFail: 50,
        },
      },
    );
    this.logger.log(`ANP weekly import scheduled (${pattern})`);
  }
}
