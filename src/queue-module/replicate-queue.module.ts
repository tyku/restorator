import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

import { REPLICATE_QUEUE } from './constants';
import { ReplicateQueueProcessor } from './replicate-queue.processor';
import { ReplicateQueueService } from './replicate-queue.service';
import { ServicesModule } from '../services/services.module';
import { LoggerModule } from '../logger-module/logger.module';
import { SubscriptionModule } from '../subscription-module/subscription.module';
import { AnalyticsModule } from '../analytics-module/analytics.module';

@Global()
@Module({
  imports: [
    BullModule.registerQueue({
      name: REPLICATE_QUEUE,
    }),
    ServicesModule,
    LoggerModule,
    SubscriptionModule,
    AnalyticsModule,
  ],
  providers: [ReplicateQueueProcessor, ReplicateQueueService],
  exports: [ReplicateQueueService],
})
export class ReplicateQueueModule {}


