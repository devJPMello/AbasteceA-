import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';
import type { Env } from '../config/env';
import { paginate } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';

export interface Recipient {
  id: string;
  email: string;
}
export interface Message {
  title: string;
  body: string;
}

/** A delivery channel. Phase 5 adds an Expo push channel behind this same interface. */
export interface NotificationChannel {
  readonly name: string;
  send(to: Recipient, message: Message): Promise<void>;
}

@Injectable()
export class InAppChannel implements NotificationChannel {
  readonly name = 'in-app';
  constructor(private readonly prisma: PrismaService) {}

  async send(to: Recipient, message: Message) {
    await this.prisma.notification.create({ data: { userId: to.id, ...message } });
  }
}

@Injectable()
export class EmailChannel implements NotificationChannel {
  readonly name = 'email';
  private readonly transporter: Transporter | null;
  private readonly from: string;

  constructor(config: ConfigService<Env, true>) {
    const smtp = config.get('SMTP_URL', { infer: true });
    this.transporter = smtp ? nodemailer.createTransport(smtp) : null;
    this.from = config.get('MAIL_FROM', { infer: true });
  }

  async send(to: Recipient, message: Message) {
    if (!this.transporter) return; // e-mail is optional: no SMTP configured
    await this.transporter.sendMail({
      from: this.from,
      to: to.email,
      subject: message.title,
      text: message.body,
    });
  }
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly secondary: NotificationChannel[];

  constructor(
    private readonly prisma: PrismaService,
    private readonly inApp: InAppChannel,
    email: EmailChannel,
  ) {
    this.secondary = [email];
  }

  /**
   * The in-app record is the source of truth: if it fails the job must retry, so it throws.
   * Other channels are best effort; a broken SMTP server must not block or duplicate alerts.
   */
  async notify(userId: string, message: Message) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, email: true },
    });
    await this.inApp.send(user, message);
    const results = await Promise.allSettled(this.secondary.map((c) => c.send(user, message)));
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        this.logger.warn(`Channel ${this.secondary[i]!.name} failed: ${String(r.reason)}`);
      }
    });
  }

  async list(userId: string, page: number, pageSize: number) {
    const [items, total, unread] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.notification.count({ where: { userId } }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);
    return { ...paginate(items, total, page, pageSize), unread };
  }

  async markRead(userId: string, id: string) {
    const { count } = await this.prisma.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
    if (count === 0) {
      const exists = await this.prisma.notification.findFirst({ where: { id, userId } });
      if (!exists) throw new NotFoundException('Notification not found');
    }
  }
}
