import { Module } from '@nestjs/common';
import { AlertMatcherService } from './alert-matcher.service';
import { AlertsController } from './alerts.controller';
import { AlertsProcessor } from './alerts.processor';
import { AlertsService } from './alerts.service';
import { EmailChannel, InAppChannel, NotificationsService } from './notifications.service';
import { PriceEventsPublisher } from './price-events.publisher';

@Module({
  controllers: [AlertsController],
  providers: [
    AlertsService,
    AlertMatcherService,
    AlertsProcessor,
    NotificationsService,
    InAppChannel,
    EmailChannel,
    PriceEventsPublisher,
  ],
  exports: [PriceEventsPublisher],
})
export class AlertsModule {}
