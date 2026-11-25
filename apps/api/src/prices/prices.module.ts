import { Module } from '@nestjs/common';
import { AlertsModule } from '../alerts/alerts.module';
import { PricesController } from './prices.controller';
import { PricesService } from './prices.service';

@Module({
  imports: [AlertsModule],
  controllers: [PricesController],
  providers: [PricesService],
  exports: [PricesService],
})
export class PricesModule {}
