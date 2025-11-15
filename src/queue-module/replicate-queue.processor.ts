import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { InjectBot } from 'nestjs-telegraf';
import type { Job } from 'bullmq';
import type { Telegraf } from 'telegraf';

import { REPLICATE_QUEUE } from './constants';
import type { ReplicateColorizeJobData } from './interfaces/replicate-job.interface';
import { ReplicateService } from '../services/providers/replicate.service';
import { LoggerProvider } from '../logger-module/logger.provider';
import { SubscriptionProvider } from '../subscription-module/subscription.provider';
import { deleteFileByRequestId } from '../telegram-module/libs/file-utils';
import { AnalyticsProvider } from '../analytics-module/analytics.provider';
import { EAnalyticsEventName } from '../analytics-module/constants/types';
import * as path from 'path';
import { escapeText } from 'src/telegram-module/libs/escape-text';

@Processor(REPLICATE_QUEUE)
export class ReplicateQueueProcessor extends WorkerHost {
  private readonly uploadsDir = path.join(process.cwd(), 'uploads');

  constructor(
    @InjectBot() private bot: Telegraf,
    private readonly replicateService: ReplicateService,
    private readonly logger: LoggerProvider,
    private readonly subscriptionProvider: SubscriptionProvider,
    private readonly analyticsProvider: AnalyticsProvider,
  ) {
    super();
  }

  async process(job: Job<ReplicateColorizeJobData>): Promise<any> {
    const { predictionId, chatId, requestId } = job.data;

    try {
      const processedFile = await this.replicateService.getPrediction(predictionId);

      if (processedFile.status === 'succeeded') {
        await this.subscriptionProvider.sub(chatId, 1);

        await this.analyticsProvider.trackAction(
          chatId,
          EAnalyticsEventName.PHOTO_PROCESSED,
          {
            requestId,
            status: 'succeeded',
            predictionId,
          },
        );

        await this.bot.telegram.sendPhoto(chatId, processedFile.output, {
          caption: '🎨 Раскрашено с помощью @mediaglowupbot',
        });

        const balanceLeft = await this.subscriptionProvider.getBalance(chatId);

        let replyText =
            '📸 Нравится результат? ' +
            'Поделись фото с друзьями — пусть тоже попробуют раскрасить свои старые снимки!\n\n' +
            `💰 Ваш баланс: 🎨 ${balanceLeft} обработок\n\n`;

        if (balanceLeft > 0) {
          replyText += 'Можешь продолжать — просто отправьте новую фотографию, и я обработаю их автоматически.';
          
          await this.bot.telegram.sendMessage(chatId, escapeText(replyText), { parse_mode: 'MarkdownV2' });

          return;
        } else {
          replyText += 'Чтобы продолжить работу, пополните баланс — и я смогу обработать следующие фотографии.';
        
          this.bot.telegram.sendMessage(chatId, escapeText(replyText), { 
            parse_mode: 'MarkdownV2',
            reply_markup: {
              inline_keyboard: [
                [{ text: '💳 Пополнить баланс', callback_data: 'refill_balance' }],
              ],
            },
           });
        }   

        if (requestId) {
          await deleteFileByRequestId(requestId, this.uploadsDir, '.jpg');
          this.logger.log(`File deleted: ${requestId}.jpg`);
        }

        return processedFile;
      }

      if (processedFile.status === 'failed') {
        await this.analyticsProvider.trackError(
          chatId,
          EAnalyticsEventName.REPLICATE_ERROR,
          new Error(processedFile.error || 'Processing failed'),
          {
            requestId,
            predictionId,
            status: 'failed',
          },
        );

        try {
          await this.bot.telegram.sendMessage(
            chatId,
            '❌ Произошла ошибка при обработке фото. Попробуйте еще раз.',
          );
        } catch (sendError) {
          this.logger.error(`Failed to send error message to chat ${chatId}: ${sendError.message}`);
        }

        throw new Error(processedFile.error || 'Processing failed');
      }


      throw new Error(`Prediction is still processing. Attempt ${job.attemptsMade + 1}/${job.opts.attempts}`);
    } catch (error) {
      this.logger.error(`Error processing replicate job: ${error.message}`);
      
      if (!error.message.includes('still processing')) {
        await this.analyticsProvider.trackError(
          chatId,
          EAnalyticsEventName.QUEUE_ERROR,
          error instanceof Error ? error : new Error(String(error)),
          {
            requestId,
            predictionId,
            attempt: job.attemptsMade + 1,
          },
        );

        try {
          await this.bot.telegram.sendMessage(
            chatId,
            '❌ Произошла ошибка при обработке фото. Попробуйте еще раз.',
          );
        } catch (sendError) {
          this.logger.error(`Failed to send error message to chat ${chatId}: ${sendError.message}`);
        }
      }

      throw error;
    }
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<ReplicateColorizeJobData> | undefined, error: Error): Promise<void> {
    this.logger.error(`Replicate job failed: jobId=${job?.id}, error=${error.message}`);
    
    if (job?.data?.chatId) {
      await this.analyticsProvider.trackError(
        job.data.chatId,
        EAnalyticsEventName.QUEUE_ERROR,
        error,
        {
          requestId: job.data.requestId,
          predictionId: job.data.predictionId,
          jobId: job.id,
          attempts: job.attemptsMade,
        },
      );
    }
  }
}


