import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env';

export const ALERTS_QUEUE = 'alerts';
export const ANP_IMPORT_QUEUE = 'anp-import';

/** BullMQ wants ioredis options rather than a URL string. */
export function redisConnection(redisUrl: string) {
  const url = new URL(redisUrl);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    db: url.pathname.length > 1 ? Number(url.pathname.slice(1)) : 0,
    tls: url.protocol === 'rediss:' ? {} : undefined,
  };
}

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        connection: redisConnection(config.get('REDIS_URL', { infer: true })),
        // Isolates queues per environment so a dev server never consumes test jobs.
        prefix: `bomba:${config.get('NODE_ENV', { infer: true })}`,
      }),
    }),
    BullModule.registerQueue({ name: ALERTS_QUEUE }, { name: ANP_IMPORT_QUEUE }),
  ],
  exports: [BullModule],
})
export class QueuesModule {}
