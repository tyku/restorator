import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

import { REPLICATE_QUEUE, PHOTO_QUEUE } from './constants';
import { ReplicateQueueProcessor } from './replicate-queue.processor';
import { ReplicateQueueService } from './replicate-queue.service';
import { PhotoQueueProcessor } from './photo-queue.processor';
import { PhotoQueueService } from './photo-queue.service';
import { ServicesModule } from '../services/services.module';
import { LoggerModule } from '../logger-module/logger.module';
import { SubscriptionModule } from '../subscription-module/subscription.module';
import { AnalyticsModule } from '../analytics-module/analytics.module';
import { FilesModule } from '../files-module/files.module';

@Global()
@Module({
  imports: [
    BullModule.registerQueue({
      name: REPLICATE_QUEUE,
    }),
    BullModule.registerQueue({
      name: PHOTO_QUEUE,
    }),
    ServicesModule,
    LoggerModule,
    SubscriptionModule,
    AnalyticsModule,
    FilesModule,
  ],
  providers: [
    ReplicateQueueProcessor,
    ReplicateQueueService,
    PhotoQueueProcessor,
    PhotoQueueService,
  ],
  exports: [ReplicateQueueService, PhotoQueueService],
})
export class ReplicateQueueModule {}


