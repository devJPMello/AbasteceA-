import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import type { Message, NotificationChannel, Recipient } from './notifications.service';

interface ExpoTicket {
  status: 'ok' | 'error';
  message?: string;
  details?: { error?: string };
}

/**
 * Push notifications through Expo's push service (which relays to FCM/APNs).
 * One message per registered device of the user. Tokens Expo reports as DeviceNotRegistered
 * (app uninstalled, token rotated) are deleted so we stop pushing to dead devices.
 */
@Injectable()
export class ExpoPushChannel implements NotificationChannel {
  readonly name = 'expo-push';
  private readonly logger = new Logger(ExpoPushChannel.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async send(to: Recipient, message: Message) {
    const devices = await this.prisma.deviceToken.findMany({
      where: { userId: to.id },
      select: { token: true },
    });
    if (devices.length === 0) return;

    const accessToken = this.config.get('EXPO_ACCESS_TOKEN', { infer: true });
    const res = await fetch(this.config.get('EXPO_PUSH_URL', { infer: true }), {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(
        devices.map((d) => ({
          to: d.token,
          title: message.title,
          body: message.body,
          sound: 'default',
          channelId: 'alerts',
        })),
      ),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Expo push responded HTTP ${res.status}`);

    // Tickets come back in the same order as the messages we sent.
    const { data } = (await res.json()) as { data: ExpoTicket[] };
    const dead = devices
      .filter(
        (_, i) => data[i]?.status === 'error' && data[i]?.details?.error === 'DeviceNotRegistered',
      )
      .map((d) => d.token);
    if (dead.length > 0) {
      await this.prisma.deviceToken.deleteMany({ where: { token: { in: dead } } });
      this.logger.log(`Removed ${dead.length} unregistered device token(s)`);
    }
  }
}
