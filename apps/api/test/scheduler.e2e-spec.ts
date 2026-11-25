import { getQueueToken } from '@nestjs/bullmq';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Queue } from 'bullmq';
import { ANP_IMPORT_QUEUE } from '../src/queues/queues.module';
import type { AnpImportScheduler } from '../src/anp-import/anp-import.scheduler';

describe('ANP weekly schedule (e2e, real Redis)', () => {
  const apps: INestApplication[] = [];

  /**
   * ConfigModule.forRoot() validates the environment when app.module.ts is first imported,
   * so the variables must be set *before* that import: hence the dynamic import here.
   */
  const boot = async () => {
    const { AppModule } = await import('../src/app.module');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();
    apps.push(app);
    return { app, queue: app.get<Queue>(getQueueToken(ANP_IMPORT_QUEUE)) };
  };

  beforeAll(() => {
    process.env.ANP_IMPORT_ENABLED = 'true';
    process.env.ANP_DATASET_URL = 'https://example.invalid/anp.csv';
    process.env.ANP_CRON = '0 9 * * 6';
  });

  afterAll(async () => {
    await Promise.all(apps.map((a) => a.close().catch(() => undefined)));
    delete process.env.ANP_IMPORT_ENABLED;
    delete process.env.ANP_DATASET_URL;
    delete process.env.ANP_CRON;
  });

  it('registers one repeatable job and does not duplicate it across restarts', async () => {
    const first = await boot();
    const schedulers = await first.queue.getJobSchedulers();
    expect(schedulers).toHaveLength(1);
    expect(schedulers[0]).toMatchObject({ key: 'anp-weekly-import', pattern: '0 9 * * 6' });
    await first.app.close();

    // A restart (or a second API instance) upserts the same scheduler id: still one.
    const second = await boot();
    expect(await second.queue.getJobSchedulers()).toHaveLength(1);

    // Redis may restart (ephemeral hosting) and forget the schedule: register() restores it.
    await second.queue.removeJobScheduler('anp-weekly-import');
    expect(await second.queue.getJobSchedulers()).toHaveLength(0);
    const { AnpImportScheduler: Scheduler } =
      await import('../src/anp-import/anp-import.scheduler');
    await second.app.get<AnpImportScheduler>(Scheduler).register();
    expect(await second.queue.getJobSchedulers()).toHaveLength(1);

    // Do not leave a schedule behind in the shared test Redis.
    await second.queue.removeJobScheduler('anp-weekly-import');
    await second.queue.obliterate({ force: true });
  });
});
