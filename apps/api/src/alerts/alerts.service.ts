import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MAX_ALERTS_PER_USER, type CreateAlertInput } from '@bomba-certa/shared';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { PriceEventsPublisher } from './price-events.publisher';

interface AlertRow {
  id: string;
  fuel_type: string;
  target_price_milli: number;
  radius_meters: number;
  active: boolean;
  last_notified_at: Date | null;
  created_at: Date;
  lat: number;
  lng: number;
}

const toDto = (r: AlertRow) => ({
  id: r.id,
  fuelType: r.fuel_type,
  targetPriceMilli: r.target_price_milli,
  radiusMeters: r.radius_meters,
  active: r.active,
  lat: r.lat,
  lng: r.lng,
  lastNotifiedAt: r.last_notified_at,
  createdAt: r.created_at,
});

@Injectable()
export class AlertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: PriceEventsPublisher,
  ) {}

  async create(userId: string, input: CreateAlertInput) {
    const count = await this.prisma.priceAlert.count({ where: { userId } });
    if (count >= MAX_ALERTS_PER_USER) {
      throw new BadRequestException(`Limit of ${MAX_ALERTS_PER_USER} alerts reached`);
    }
    const id = randomUUID();
    await this.prisma.$executeRaw`
      INSERT INTO price_alerts (id, user_id, fuel_type, target_price_milli, radius_meters, center)
      VALUES (${id}::uuid, ${userId}::uuid, ${input.fuelType}::fuel_type, ${input.targetPriceMilli},
              ${input.radiusMeters},
              ST_SetSRID(ST_MakePoint(${input.lng}, ${input.lat}), 4326)::geography)`;
    // The condition may already hold: ask the worker to check right away.
    await this.events.alertCreated(id);
    return this.findOne(userId, id);
  }

  async list(userId: string) {
    const rows = await this.prisma.$queryRaw<AlertRow[]>`
      SELECT id, fuel_type, target_price_milli, radius_meters, active, last_notified_at, created_at,
             ST_Y(center::geometry) AS lat, ST_X(center::geometry) AS lng
      FROM price_alerts WHERE user_id = ${userId}::uuid ORDER BY created_at DESC`;
    return rows.map(toDto);
  }

  async remove(userId: string, id: string) {
    const { count } = await this.prisma.priceAlert.deleteMany({ where: { id, userId } });
    if (count === 0) throw new NotFoundException('Alert not found');
  }

  private async findOne(userId: string, id: string) {
    const [row] = await this.prisma.$queryRaw<AlertRow[]>`
      SELECT id, fuel_type, target_price_milli, radius_meters, active, last_notified_at, created_at,
             ST_Y(center::geometry) AS lat, ST_X(center::geometry) AS lng
      FROM price_alerts WHERE id = ${id}::uuid AND user_id = ${userId}::uuid`;
    return toDto(row!);
  }
}
