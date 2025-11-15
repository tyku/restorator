import { Action, Ctx, Message, On, Scene, SceneEnter } from 'nestjs-telegraf';
import { Scenes } from 'telegraf';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';

import { FilesProvider } from '../../files-module/files.provider';
import { LoggerProvider } from '../../logger-module/logger.provider';
import { escapeText } from '../libs/escape-text';
import { SubscriptionProvider } from 'src/subscription-module/subscription.provider';
import { EmptyBalanceException } from 'src/subscription-module/errors/empty-balance.error';
import { saveFile, deleteFileByRequestId, localFileToDataUrl } from '../libs/file-utils';
import { FileDownloaderProvider, ReplicateService } from 'src/services/providers';
import { ReplicateQueueService } from 'src/queue-module/replicate-queue.service';
import { AnalyticsProvider } from 'src/analytics-module/analytics.provider';
import { EAnalyticsEventName } from 'src/analytics-module/constants/types';

type TChat = {
  id: number;
  [k: string]: any;
};

const generateContextId = () => uuidv4();

const getFileName = (path: string = '') => path.split('/').reverse()[0];

@Scene('PHOTO_SCENE_ID')
export class PhotoProvider {
  private readonly uploadsDir = path.join(process.cwd(), 'uploads');

  constructor(
    private fileProvider: FilesProvider,
    private subscriptionProvider: SubscriptionProvider,
    private logger: LoggerProvider,
    private replicateProvider: ReplicateService,
    private fileDownloaderProvider: FileDownloaderProvider,
    private replicateQueueService: ReplicateQueueService,
    private analyticsProvider: AnalyticsProvider,
  ) {}

  @SceneEnter()
  async onSceneEnter(@Ctx() ctx: Scenes.SceneContext) {
    const chatId = ctx.from?.id || ctx.chat?.id;
    
    if (chatId) {
      await this.analyticsProvider.trackSceneEnter(chatId, 'PHOTO_SCENE_ID');
    }

    const balance = await this.subscriptionProvider.getBalance(chatId!);

    if(balance <= 0) {
      await ctx.scene.leave();
      await ctx.scene.enter('PAYMENT_SCENE_ID');
      
      return;
    }
    
    await ctx.replyWithMarkdownV2(
      'Прикрепите одно или несколько фото и нажмите "Обработать ✅", когда будете готовы ',
      {
        reply_markup: {
          keyboard: [[{ text: '📱️Меню' }]],
          resize_keyboard: true,
          one_time_keyboard: false,
        },
      },
    );
  }

  @On('document')
  async onDocument(
    @Ctx() ctx: Scenes.SceneContext,
    @Message('chat') chat: TChat,
    @Message('document') document: Record<string, any>,
  ) {
    const isImage = document.mime_type.startsWith('image/');

      if (!isImage) {
        await ctx.reply('Файл не является фотографией 😳');

        return;
      }
      await this.processFile(ctx, chat, document)
  }

  @On('photo')
  async onPhoto(
    @Ctx() ctx: Scenes.SceneContext,
    @Message('chat') chat: TChat,
    @Message('photo') photo: Record<string, any>,
  ) {
    const origFile = photo.reverse()[0];
    await this.processFile(ctx, chat, origFile);
  }

  private async processFile(ctx: Scenes.SceneContext, chat: TChat, photo: Record<string, any>) {
    const requestId = generateContextId();

    try {
      const balance = await this.subscriptionProvider.getBalance(chat.id);

      if (balance <= 0) {
        const paymentSceneShown = (ctx.session as any)?.paymentSceneShown || false;

        if (!paymentSceneShown) {
          (ctx.session as any).paymentSceneShown = true;
          await ctx.scene.leave();
          await ctx.scene.enter('PAYMENT_SCENE_ID');
        }
        
        return;
      }

      // Сбрасываем флаг, если баланс есть (пользователь пополнил)
      if ((ctx.session as any)?.paymentSceneShown) {
        (ctx.session as any).paymentSceneShown = false;
      }

      const fileId = photo.file_id;
      const fileLink = await ctx.telegram.getFileLink(fileId);

      // Генерируем уникальное имя файла и сохраняем в локальную папку
      const fileName = `${requestId}.jpg`;

      const downloadedFile = await this.fileDownloaderProvider.getFile(fileLink.href);
      const localFilePath = await saveFile(
        downloadedFile,
        this.uploadsDir,
        fileName,
      );

      this.logger.log(`Photo saved to: ${localFilePath}`);

      await this.fileProvider.create({
        chatId: chat.id,
        requestId,
        href: fileLink.href,
      });

      await this.analyticsProvider.trackAction(
        chat.id,
        EAnalyticsEventName.PHOTO_UPLOADED,
        {
          requestId,
          fileId,
        },
      );

      // Преобразуем локальный файл в base64 data URL
      const dataUrl = await localFileToDataUrl(localFilePath);

      const processedFile = await this.replicateProvider.colorizePhoto(dataUrl);

      if(processedFile.status === 'failed') {
        await ctx.reply('Что-то пошло не так, но мы уже изучаем вопрос');
        return;
      }

      await ctx.replyWithMarkdownV2(
        escapeText('📸 Отлично! Фото принято в работу.\n\n' +
                    '⏳ Обработка займёт около минуты — нейросеть уже раскрашивает твоё фото.'),
        {
          reply_markup: {
            keyboard: [[{ text: '📱️Меню' }]],
            resize_keyboard: true,
            one_time_keyboard: false,
          },
        },
      );

      if (processedFile.status === 'succeeded') {
        await this.subscriptionProvider.sub(chat.id, 1);

        await this.analyticsProvider.trackAction(
          chat.id,
          EAnalyticsEventName.PHOTO_PROCESSED,
          {
            requestId,
            status: 'succeeded',
          },
        );

        await ctx.replyWithPhoto(processedFile.output, {
          caption: '🎨 Раскрашено с помощью @mediaglowupbot',
        });


        const balanceLeft = await this.subscriptionProvider.getBalance(chat.id);

        let replyText =
            '📸 Нравится результат? ' +
            'Поделись фото с друзьями — пусть тоже попробуют раскрасить свои старые снимки!\n\n' +
            `💰 Ваш баланс: 🎨 ${balanceLeft} обработок\n\n`;

        if (balanceLeft > 0) {
          replyText += 'Можешь продолжать — просто отправьте новую фотографию, и я обработаю их автоматически.';
          
          await ctx.replyWithMarkdownV2(escapeText(replyText));

          return;
        } else {
          replyText += 'Чтобы продолжить работу, пополните баланс — и я смогу обработать следующие фотографии.';
        
          await ctx.replyWithMarkdownV2(escapeText(replyText), {
            reply_markup: {
              inline_keyboard: [
                [{ text: '💳 Пополнить баланс', callback_data: 'refill_balance' }],
              ],
            },
          });
        }        


        await deleteFileByRequestId(requestId, this.uploadsDir, '.jpg');
        this.logger.log(`File deleted: ${requestId}.jpg`);
      }

      if (processedFile.status === 'processing') {
        await ctx.reply('Фотография обрабатывается... Скоро она будет готова');
        await this.replicateQueueService.addJob({
          predictionId: processedFile.id,
          chatId: chat.id,
          requestId: requestId,
        });

        return;
      }
    } catch (e) {
      this.logger.error(`${this.constructor.name} onDocument: ${e}`);

      await this.analyticsProvider.trackError(
        chat.id,
        EAnalyticsEventName.PROCESSING_ERROR,
        e instanceof Error ? e : new Error(String(e)),
        {
          requestId,
          action: 'process_file',
        },
      );

      await deleteFileByRequestId(requestId, this.uploadsDir, '.jpg');

      await ctx.reply('Что-то пошло не так, но мы уже изучаем вопрос');

      return;
    }
  }

  @Action('refill_balance')
  async onAction(@Ctx() ctx: Scenes.SceneContext) {
    const chatId = ctx.from?.id || ctx.chat?.id;
    
    if (chatId) {
      await this.analyticsProvider.trackButtonClick(
        chatId,
        EAnalyticsEventName.PAYMENT_BUTTON,
      );
      await this.analyticsProvider.trackSceneLeave(chatId, 'MENU_SCENE_ID');
    }

    try {
      await ctx.deleteMessage();
    } catch (e) {}

    await ctx.scene.leave();
    await ctx.scene.enter('PAYMENT_SCENE_ID');
  }
}
