import { Module } from '@nestjs/common';

import { TelegramUpdate } from './telegram.update';
import { NewUserProvider } from './scenes/new-user.provider';
import { UserModule } from '../user-module/user.module';
import { MenuProvider } from './scenes/menu.provider';
import { SubscriptionModule } from '../subscription-module/subscription.module';
import { PaymentProvider } from './scenes/payment.provider';
import { FilesModule } from '../files-module/files.module';
import { PhotoProvider } from './scenes/photo.provider';
import { AnalyticsModule } from '../analytics-module/analytics.module';
import { PaymentModule } from '../payments-module/payment.module';
// import { ReplicateQueueModule } from '../queue-module/replicate-queue.module';

@Module({
  imports: [
    UserModule,
    FilesModule,
    SubscriptionModule,
    AnalyticsModule,
    PaymentModule,
    // ReplicateQueueModule,
  ],
  providers: [
    MenuProvider,
    TelegramUpdate,
    NewUserProvider,
    // SubscriptionProvider,
    PaymentProvider,
    PhotoProvider,
  ],
})
export class TelegramModule {}
