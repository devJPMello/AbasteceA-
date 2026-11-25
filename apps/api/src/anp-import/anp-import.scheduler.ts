import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';
import type { Env } from '../config/env';
import { ANP_IMPORT_QUEUE } from '../queues/queues.module';

const SCHEDULER_ID = 'anp-weekly-import';
const REFRESH_EVERY_MS = 60 * 60 * 1000;

/**
 * Registers the weekly repeatable job. upsertJobScheduler is idempotent: restarting the API
 * (or running several instances) never creates duplicate schedules, because the scheduler id
 * is fixed and lives in Redis.
 *
 * On hosts with an ephemeral Redis (e.g. a free Key Value instance) Redis can restart while the
 * API keeps running and forget the schedule. Re-upserting every hour makes the schedule
 * self-healing instead of silently disappearing until the next deploy.
 */
@Injectable()
export class AnpImportScheduler implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(AnpImportScheduler.name);
  private timer?: NodeJS.Timeout;

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
    await this.register();
    this.timer = setInterval(() => {
      this.register().catch((err) => this.logger.error(`Could not refresh schedule: ${err}`));
    }, REFRESH_EVERY_MS);
    this.timer.unref(); // never keep the process alive just for this
  }

  onModuleDestroy() {
    clearInterval(this.timer);
  }

  async register() {
    const pattern = this.config.get('ANP_CRON', { infer: true });
    await this.queue.upsertJobScheduler(
      SCHEDULER_ID,
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
