import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AnalyticsRepository } from './analytics.repository';
import { AnalyticsProvider } from './analytics.provider';
import { Analytics, AnalyticsSchema } from './analytics.model';
import { LoggerModule } from '../logger-module/logger.module';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([{ name: Analytics.name, schema: AnalyticsSchema }]),
    LoggerModule,
  ],
  providers: [AnalyticsRepository, AnalyticsProvider],
  exports: [AnalyticsProvider],
})
export class AnalyticsModule {}

