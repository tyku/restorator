import {Scene, SceneEnter, Ctx, On, Action} from 'nestjs-telegraf';

import { Input, Scenes } from 'telegraf';
import * as path from 'node:path';

import type { InputMediaPhoto } from 'telegraf/types';

import { escapeText } from '../libs/escape-text';
import { LoggerProvider } from 'src/logger-module/logger.provider';
import { SubscriptionProvider } from 'src/subscription-module/subscription.provider';

type TSession = { session: { source: string; __scenes: Record<string, any> } };
type TUpdate = { update: any };

@Scene('MENU_SCENE_ID')
export class MenuProvider {

  constructor(
    private logger: LoggerProvider,
    private subscriptionProvider: SubscriptionProvider,
  ) {}

  @SceneEnter()
  async onSceneEnter(@Ctx() ctx: Scenes.SceneContext & TUpdate & TSession) {
    try {
      const chatId =
          ctx.update?.message?.chat?.id ||
          ctx.update?.callback_query?.message?.chat?.id;

      const replyText = '👋 Привет! Я — бот, который превращает старые чёрно-белые фото в цветные и восстанавливает их качество.\n' +
          'Просто отправь мне фото или документ — я всё сделаю автоматически.\n\n' +
          '*❗️Чтобы получить лучший результат, отправляй фотографии в исходном качестве, без сжатия (как документ)*\n\n' +
          'Примеры результатов 👇';

      await ctx.replyWithMarkdownV2(escapeText(replyText));

      const mediaGroup: InputMediaPhoto[] = [
        {
          type: 'photo',
          media: Input.fromLocalFile(path.join(__dirname, 'photos', '1.png')),
          caption: 'Исходное фото',
        },
        {
          type: 'photo',
          media: Input.fromLocalFile(path.join(__dirname, 'photos', '1_c.png')),
          caption: 'Отреставрированное фото',
        },
      ];

      const mediaGroup2: InputMediaPhoto[] = [
        {
          type: 'photo',
          media: Input.fromLocalFile(path.join(__dirname, '..', '..', '..', 'photos', '2.jpg')),
        },
        {
          type: 'photo',
          media: Input.fromLocalFile(path.join(__dirname, '..', '..', '..', 'photos', '2_c.png')),
        },
      ];

      await ctx.telegram.sendMediaGroup(chatId, mediaGroup);
      await ctx.telegram.sendMediaGroup(chatId, mediaGroup2);

      const balance = await this.subscriptionProvider.getBalance(chatId);

      await ctx.replyWithMarkdownV2(
          escapeText(`💰 Текущий баланс: 🎨 ${balance} обработок\n\n` +
              '📷 Чтобы получить лучший результат, отправляй фотографии в исходном качестве, без сжатия — как документ. ✨\n' +
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
    try {
      await ctx.deleteMessage();
    } catch (e) {}

    await ctx.scene.leave();
    await ctx.scene.enter('PAYMENT_SCENE_ID');
  }

  @Action('process_photo')
  async onActionPhoto(@Ctx() ctx: Scenes.SceneContext) {
    try {
      await ctx.deleteMessage();
    } catch (e) {}

    await ctx.scene.leave();
    await ctx.scene.enter('PHOTO_SCENE_ID');
  }
}
