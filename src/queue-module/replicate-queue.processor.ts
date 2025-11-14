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
import * as path from 'path';

@Processor(REPLICATE_QUEUE)
export class ReplicateQueueProcessor extends WorkerHost {
  private readonly uploadsDir = path.join(process.cwd(), 'uploads');

  constructor(
    @InjectBot() private bot: Telegraf,
    private readonly replicateService: ReplicateService,
    private readonly logger: LoggerProvider,
    private readonly subscriptionProvider: SubscriptionProvider,
  ) {
    super();
  }

  async process(job: Job<ReplicateColorizeJobData>): Promise<any> {
    const { predictionId, chatId, requestId } = job.data;

    try {
      const processedFile = await this.replicateService.getPrediction(predictionId);

      if (processedFile.status === 'succeeded') {
        await this.subscriptionProvider.sub(chatId, 1);

        await this.bot.telegram.sendPhoto(chatId, processedFile.output, {
          caption: '✅ Фото успешно обработано!',
        });

        if (requestId) {
          await deleteFileByRequestId(requestId, this.uploadsDir, '.jpg');
          this.logger.log(`File deleted: ${requestId}.jpg`);
        }

        return processedFile;
      }

      if (processedFile.status === 'failed') {
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
  onFailed(job: Job | undefined, error: Error): void {
    this.logger.error(`Replicate job failed: jobId=${job?.id}, error=${error.message}`);
  }
}


