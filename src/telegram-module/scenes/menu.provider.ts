import {Scene, SceneEnter, Ctx, On, Action} from 'nestjs-telegraf';

import { Input, Scenes } from 'telegraf';
import * as path from 'node:path';

import type { InputMediaPhoto } from 'telegraf/types';

import { escapeText } from '../libs/escape-text';
import { LoggerProvider } from 'src/logger-module/logger.provider';
import { SubscriptionProvider } from 'src/subscription-module/subscription.provider';
import { AnalyticsProvider } from 'src/analytics-module/analytics.provider';
import { EAnalyticsEventName } from 'src/analytics-module/constants/types';

type TSession = { session: { source: string; __scenes: Record<string, any> } };
type TUpdate = { update: any };

@Scene('MENU_SCENE_ID')
export class MenuProvider {

  constructor(
    private logger: LoggerProvider,
    private subscriptionProvider: SubscriptionProvider,
    private analyticsProvider: AnalyticsProvider,
  ) {}

  @SceneEnter()
  async onSceneEnter(@Ctx() ctx: Scenes.SceneContext & TUpdate & TSession) {
    try {
      const chatId =
          ctx.update?.message?.chat?.id ||
          ctx.update?.callback_query?.message?.chat?.id;

      if (chatId) {
        await this.analyticsProvider.trackSceneEnter(chatId, 'MENU_SCENE_ID');
      }

      const balance = await this.subscriptionProvider.getBalance(chatId);

      await ctx.replyWithMarkdownV2(
          escapeText(`💰 Текущий баланс: 🎨 ${balance} обработок\n\n` +
              '📷 Что бы получить лучший результат, отправляй фотографии в исходном качестве, без сжатия — как документ. ✨\n' +
              'Ты можешь отправлять сразу несколько фото — каждое обработается по очереди автоматически. Просто загрузи их в чат 👇'),
          {
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: 'Обработать',
                    callback_data: 'process_photo'
                  },
                ],
                [
                  {
                    text: '💳 Пополнить баланс',
                    callback_data: 'refill_balance'
                  },
                ],
              ],
            },
          },
      );
    } catch (e) {
      this.logger.error(`${this.constructor.name} onSceneEnter: ${e}`);
      await ctx.reply('Что-то пошло не так, но мы уже разбираемся');
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

  @Action('process_photo')
  async onActionPhoto(@Ctx() ctx: Scenes.SceneContext) {
    const chatId = ctx.from?.id || ctx.chat?.id;
    
    if (chatId) {
      await this.analyticsProvider.trackButtonClick(
        chatId,
        EAnalyticsEventName.PHOTO_SCENE_BUTTON,
      );
      await this.analyticsProvider.trackSceneLeave(chatId, 'MENU_SCENE_ID');
    }

    try {
      await ctx.deleteMessage();
    } catch (e) {}

    await ctx.scene.leave();
    await ctx.scene.enter('PHOTO_SCENE_ID');
  }
}
