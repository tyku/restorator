import { Ctx, Message, On, Scene, SceneEnter } from 'nestjs-telegraf';
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
  ) {}

  @SceneEnter()
  async onSceneEnter(@Ctx() ctx: Scenes.SceneContext) {
    // try {
    //   await ctx.deleteMessage();
    // } catch (e) {}
    //

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

    // (ctx.session as any).requestId = generateContextId();
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
        await ctx.scene.leave();
        await ctx.scene.enter('PAYMENT_SCENE_ID');
        
        return;
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

      // Преобразуем локальный файл в base64 data URL
      const dataUrl = await localFileToDataUrl(localFilePath);

      const processedFile = await this.replicateProvider.colorizePhoto(dataUrl);

      if(processedFile.status === 'failed') {
        await ctx.reply('Что-то пошло не так, но мы уже изучаем вопрос');
        return;
      }

      await ctx.replyWithMarkdownV2(
        escapeText('📸 Отлично! Фото принято в работу.'),
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

        await ctx.replyWithPhoto(processedFile.output);

        // Удаляем файл из папки uploads после успешной обработки
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

      await deleteFileByRequestId(requestId, this.uploadsDir, '.jpg');

      // if (!(e instanceof EmptyBalanceException)) {
      await ctx.reply('Что-то пошло не так, но мы уже изучаем вопрос');
      // }

      return;
    }
  }
}
