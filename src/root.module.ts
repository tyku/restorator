import { session } from 'telegraf';
import { TelegrafModule } from 'nestjs-telegraf';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import Redis from 'ioredis';

import configs from './configs';
import { TelegramModule } from './telegram-module/telegram.module';
import { LoggerModule } from './logger-module/logger.module';
import { ServicesModule } from './services/services.module';
import { ReplicateQueueModule } from './queue-module/replicate-queue.module';
import { AnalyticsModule } from './analytics-module/analytics.module';
import { PaymentModule } from './payments-module/payment.module';

function createRedisStore(redis: Redis, ttl = 86400) {
  return {
    async get(key: string) {
      const data = await redis.get(key);
      return data ? JSON.parse(data) : undefined;
    },
    async set(key: string, value: any) {
      await redis.set(key, JSON.stringify(value), 'EX', ttl);
    },
    async delete(key: string) {
      await redis.del(key);
    },
  };
}

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [configs],
      envFilePath: ['.env'],
      isGlobal: true,
    }),
    BullModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('redis.host'),
          port: configService.get<number>('redis.port'),
          password: configService.get<string>('redis.password'),
        },
      }),
      inject: [ConfigService],
    }),
    TelegrafModule.forRootAsync({
      imports: [TelegramModule],
      useFactory: (configService: ConfigService) => {
        const redisHost = configService.get<string>('redis.host')!;
        const redisPort = configService.get<number>('redis.port')!;
        const redisPassword = configService.get<string>('redis.password')!;

        const redis = new Redis({
          host: redisHost || 'localhost',
          port: redisPort,
          password: redisPassword,
          db: 10,
        });

        return {
          botName: 'restavrator',
          token: configService.get<string>('telegram.botAccessToken')!,
          middlewares: [
            // session(),
            session({ store: createRedisStore(redis) }),
            async (ctx, next) => {
              if (ctx.update.message?.text === '/start') {
                if (ctx.scene && typeof ctx.scene.leave === 'function') {
                  await ctx.scene.leave();
                }
                if (ctx.session && ctx.session.__scenes) {
                  delete ctx.session.__scenes;
                }
              }
              return next();
            },
          ],
          include: [TelegramModule],
        };
      },
      inject: [ConfigService],
    }),
    MongooseModule.forRootAsync({
      imports: [],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('mongo.connectionString'),
      }),
      inject: [ConfigService],
    }),
        ServicesModule,
        LoggerModule,
        ReplicateQueueModule,
        AnalyticsModule,
        PaymentModule,
      ],
  controllers: [],
  providers: [],
})
export class RootModel {}
