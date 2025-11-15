import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { InjectBot } from 'nestjs-telegraf';
import type { Job } from 'bullmq';
import type { Telegraf } from 'telegraf';
import * as path from 'path';

import { PHOTO_QUEUE } from './constants';
import type { PhotoProcessJobData } from './interfaces/photo-job.interface';
import { FilesProvider } from '../files-module/files.provider';
import { LoggerProvider } from '../logger-module/logger.provider';
import { SubscriptionProvider } from '../subscription-module/subscription.provider';
import { FileDownloaderProvider, ReplicateService } from '../services/providers';
import { ReplicateQueueService } from './replicate-queue.service';
import { AnalyticsProvider } from '../analytics-module/analytics.provider';
import { EAnalyticsEventName } from '../analytics-module/constants/types';
import {
  saveFile,
  deleteFileByRequestId,
  localFileToDataUrl,
} from '../telegram-module/libs/file-utils';
import { escapeText } from '../telegram-module/libs/escape-text';

@Processor(PHOTO_QUEUE, {
  concurrency: 1,   
})
export class PhotoQueueProcessor extends WorkerHost {
  private readonly uploadsDir = path.join(process.cwd(), 'uploads');


  constructor(
    @InjectBot() private bot: Telegraf,
    private readonly fileProvider: FilesProvider,
    private readonly subscriptionProvider: SubscriptionProvider,
    private readonly logger: LoggerProvider,
    private readonly replicateProvider: ReplicateService,
    private readonly fileDownloaderProvider: FileDownloaderProvider,
    private readonly replicateQueueService: ReplicateQueueService,
    private readonly analyticsProvider: AnalyticsProvider,
  ) {
    super();
  }

  async process(job: Job<PhotoProcessJobData>): Promise<any> {
    const { chatId, fileId, fileLink, requestId } = job.data;

    try {
      // Проверяем баланс перед началом обработки
      // Если баланса нет, просто пропускаем без сообщения
      // (сообщение уже было показано в photo.provider.ts при первом случае)
      const balance = await this.subscriptionProvider.getBalance(chatId);

      if (balance <= 0) {
        this.logger.warn(
          `Insufficient balance for photo processing (chatId=${chatId}, requestId=${requestId})`,
        );
        // Не отправляем сообщение - первый раз сцена оплаты уже была показана
        return;
      }

      // Генерируем уникальное имя файла и сохраняем в локальную папку
      const fileName = `${requestId}.jpg`;

      const downloadedFile = await this.fileDownloaderProvider.getFile(fileLink);
      const localFilePath = await saveFile(
        downloadedFile,
        this.uploadsDir,
        fileName,
      );

      this.logger.log(`Photo saved to: ${localFilePath}`);

      await this.fileProvider.create({
        chatId,
        requestId,
        href: fileLink,
      });

      await this.analyticsProvider.trackAction(
        chatId,
        EAnalyticsEventName.PHOTO_UPLOADED,
        {
          requestId,
          fileId,
        },
      );

      // Преобразуем локальный файл в base64 data URL
      const dataUrl = await localFileToDataUrl(localFilePath);

      const processedFile = await this.replicateProvider.colorizePhoto(dataUrl);

      if (processedFile.status === 'failed') {
        await this.bot.telegram.sendMessage(
          chatId,
          'Что-то пошло не так, но мы уже изучаем вопрос',
        );
        await deleteFileByRequestId(requestId, this.uploadsDir, '.jpg');
        return;
      }

      await this.bot.telegram.sendMessage(
        chatId,
        escapeText(
          '📸 Отлично! Фото принято в работу.\n\n' +
            '⏳ Обработка займёт около минуты — нейросеть уже раскрашивает твоё фото.',
        ),
        {
          parse_mode: 'MarkdownV2',
          reply_markup: {
            keyboard: [[{ text: '📱️Меню' }]],
            resize_keyboard: true,
            one_time_keyboard: false,
          },
        },
      );

      if (processedFile.status === 'succeeded') {
        // Списываем баланс атомарно только после успешной обработки
        const subscriptionResult = await this.subscriptionProvider.sub(chatId, 1);

        if (!subscriptionResult) {
          this.logger.warn(
            `Balance was insufficient after processing (chatId=${chatId}, requestId=${requestId})`,
          );
        }

        await this.analyticsProvider.trackAction(chatId, EAnalyticsEventName.PHOTO_PROCESSED, {
          requestId,
          status: 'succeeded',
        });

        await this.bot.telegram.sendPhoto(chatId, processedFile.output, {
          caption: '🎨 Раскрашено с помощью @mediaglowupbot',
        });

        const balanceLeft = await this.subscriptionProvider.getBalance(chatId);

        let replyText =
          '📸 Нравится результат? ' +
          'Поделись фото с друзьями — пусть тоже попробуют раскрасить свои старые снимки!\n\n' +
          `💰 Ваш баланс: 🎨 ${balanceLeft} обработок\n\n`;

        if (balanceLeft > 0) {
          replyText +=
            'Можешь продолжать — просто отправьте новую фотографию, и я обработаю их автоматически.';

          await this.bot.telegram.sendMessage(chatId, escapeText(replyText), {
            parse_mode: 'MarkdownV2',
          });
        } else {
          replyText +=
            'Чтобы продолжить работу, пополните баланс — и я смогу обработать следующие фотографии.';

          await this.bot.telegram.sendMessage(chatId, escapeText(replyText), {
            parse_mode: 'MarkdownV2',
            reply_markup: {
              inline_keyboard: [
                [{ text: '💳 Пополнить баланс', callback_data: 'refill_balance' }],
              ],
            },
          });
        }

        await deleteFileByRequestId(requestId, this.uploadsDir, '.jpg');
        this.logger.log(`File deleted: ${requestId}.jpg`);

        return processedFile;
      }

      if (processedFile.status === 'processing') {
        await this.bot.telegram.sendMessage(
          chatId,
          'Фотография обрабатывается... Скоро она будет готова',
        );
        await this.replicateQueueService.addJob({
          predictionId: processedFile.id,
          chatId,
          requestId,
        });

        return;
      }
    } catch (e) {
      this.logger.error(`${this.constructor.name} process: ${e}`);

      await this.analyticsProvider.trackError(
        chatId,
        EAnalyticsEventName.PROCESSING_ERROR,
        e instanceof Error ? e : new Error(String(e)),
        {
          requestId,
          action: 'process_file',
        },
      );

      await deleteFileByRequestId(requestId, this.uploadsDir, '.jpg');

      try {
        await this.bot.telegram.sendMessage(
          chatId,
          'Что-то пошло не так, но мы уже изучаем вопрос',
        );
      } catch (sendError) {
        this.logger.error(
          `Failed to send error message to chat ${chatId}: ${sendError}`,
        );
      }

      throw e;
    }
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<PhotoProcessJobData> | undefined, error: Error): Promise<void> {
    this.logger.error(`Photo job failed: jobId=${job?.id}, error=${error.message}`);

    if (job?.data?.chatId) {
      await this.analyticsProvider.trackError(
        job.data.chatId,
        EAnalyticsEventName.PROCESSING_ERROR,
        error,
        {
          requestId: job.data.requestId,
          chatId: job.data.chatId,
          jobId: job.id,
          attempts: job.attemptsMade,
        },
      );
    }
  }
}

