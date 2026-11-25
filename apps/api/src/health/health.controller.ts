import { InjectQueue } from '@nestjs/bullmq';
import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { ALERTS_QUEUE } from '../queues/queues.module';

@ApiTags('health')
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(ALERTS_QUEUE) private readonly queue: Queue,
  ) {}

  /** Liveness: the process answers. Touches nothing, so it is safe to ping every few minutes. */
  @Get()
  @ApiOperation({ summary: 'Liveness probe (no dependencies checked)' })
  live() {
    return { status: 'ok' };
  }

  /** Readiness: the dependencies this API needs are reachable. */
  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe (checks PostgreSQL and Redis)' })
  async ready() {
    const [db, redis] = await Promise.allSettled([
      this.prisma.$queryRaw`SELECT 1`,
      this.queue.getJobCounts(), // a real round trip to Redis
    ]);
    const checks = {
      database: db.status === 'fulfilled' ? 'up' : 'down',
      redis: redis.status === 'fulfilled' ? 'up' : 'down',
    };
    if (db.status === 'rejected' || redis.status === 'rejected') {
      throw new ServiceUnavailableException({ status: 'unavailable', checks });
    }
    return { status: 'ok', checks };
  }
}
