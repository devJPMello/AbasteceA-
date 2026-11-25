import { Module } from '@nestjs/common';
import { AlertsModule } from '../alerts/alerts.module';
import { AnpImportProcessor } from './anp-import.processor';
import { AnpImportScheduler } from './anp-import.scheduler';
import { AnpImportService } from './anp-import.service';
import { GEOCODER, NominatimGeocoder } from './geocoder';

@Module({
  imports: [AlertsModule],
  providers: [
    AnpImportService,
    AnpImportProcessor,
    AnpImportScheduler,
    { provide: GEOCODER, useClass: NominatimGeocoder },
  ],
  exports: [AnpImportService],
})
export class AnpImportModule {}
