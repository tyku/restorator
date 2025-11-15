import { Action, Ctx, Message, On, Scene, SceneEnter } from 'nestjs-telegraf';
import { Scenes } from 'telegraf';
import { v4 as uuidv4 } from 'uuid';

import { LoggerProvider } from '../../logger-module/logger.provider';
import { SubscriptionProvider } from 'src/subscription-module/subscription.provider';
import { PhotoQueueService } from 'src/queue-module/photo-queue.service';
import { AnalyticsProvider } from 'src/analytics-module/analytics.provider';
import { EAnalyticsEventName } from 'src/analytics-module/constants/types';

type TChat = {
  id: number;
  [k: string]: any;
};

const generateContextId = () => uuidv4();

@Scene('PHOTO_SCENE_ID')
export class PhotoProvider {
  constructor(
    private subscriptionProvider: SubscriptionProvider,
    private logger: LoggerProvider,
    private photoQueueService: PhotoQueueService,
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

    await this.handlePhoto(ctx, chat, document);
  }

  @On('photo')
  async onPhoto(
    @Ctx() ctx: Scenes.SceneContext,
    @Message('chat') chat: TChat,
    @Message('photo') photo: Record<string, any>,
  ) {
    const origFile = photo.reverse()[0];
    await this.handlePhoto(ctx, chat, origFile);
  }

  private async handlePhoto(
    ctx: Scenes.SceneContext,
    chat: TChat,
    photo: Record<string, any>,
  ) {
    try {
      // Проверяем баланс перед добавлением в очередь
      const balance = await this.subscriptionProvider.getBalance(chat.id);

      if (balance <= 0) {
        // Баланса не хватает - проверяем, показывали ли уже сцену оплаты
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

      const requestId = generateContextId();
      const fileId = photo.file_id;
      const fileLink = await ctx.telegram.getFileLink(fileId);

      // Добавляем задачу в очередь BullMQ
      // BullMQ гарантирует последовательную обработку (concurrency: 1)
      await this.photoQueueService.addJob({
        chatId: chat.id,
        fileId,
        fileLink: fileLink.href,
        requestId,
      });

      this.logger.log(
        `Photo processing job added to queue (chatId=${chat.id}, requestId=${requestId})`,
      );
    } catch (e) {
      this.logger.error(`${this.constructor.name} handlePhoto error: ${e}`);

      await this.analyticsProvider.trackError(
        chat.id,
        EAnalyticsEventName.PROCESSING_ERROR,
        e instanceof Error ? e : new Error(String(e)),
        {
          action: 'handle_photo',
        },
      );

      await ctx.reply('Что-то пошло не так, но мы уже изучаем вопрос');
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
