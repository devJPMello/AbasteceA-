import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env';
import { ANP_IMPORT_QUEUE } from '../queues/queues.module';
import { AnpImportService } from './anp-import.service';

/** Worker for the weekly ANP import. Concurrency 1: the geocoder is rate limited anyway. */
@Processor(ANP_IMPORT_QUEUE, { concurrency: 1 })
export class AnpImportProcessor extends WorkerHost {
  private readonly logger = new Logger(AnpImportProcessor.name);

  constructor(
    private readonly importer: AnpImportService,
    private readonly config: ConfigService<Env, true>,
  ) {
    super();
  }

  async process() {
    const url = this.config.get('ANP_DATASET_URL', { infer: true });
    if (!url) {
      this.logger.warn('ANP_DATASET_URL is not set: skipping import');
      return;
    }
    return this.importer.importFromUrl(url);
  }
}
