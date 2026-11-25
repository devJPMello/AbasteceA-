import { Module } from '@nestjs/common';
import { AlertMatcherService } from './alert-matcher.service';
import { AlertsController } from './alerts.controller';
import { DevicesController } from './devices.controller';
import { ExpoPushChannel } from './expo-push.channel';
import { AlertsProcessor } from './alerts.processor';
import { AlertsService } from './alerts.service';
import { EmailChannel, InAppChannel, NotificationsService } from './notifications.service';
import { PriceEventsPublisher } from './price-events.publisher';

@Module({
  controllers: [AlertsController, DevicesController],
  providers: [
    AlertsService,
    AlertMatcherService,
    AlertsProcessor,
    NotificationsService,
    InAppChannel,
    EmailChannel,
    ExpoPushChannel,
    PriceEventsPublisher,
  ],
  exports: [PriceEventsPublisher],
})
export class AlertsModule {}
