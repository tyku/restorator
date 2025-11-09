import {Scene, SceneEnter, Ctx, On, Action} from 'nestjs-telegraf';

import { Input, Scenes } from 'telegraf';
import * as path from 'node:path';

import type { InputMediaPhoto } from 'telegraf/types';

import { escapeText } from '../libs/escape-text';

type TSession = { session: { source: string; __scenes: Record<string, any> } };
type TUpdate = { update: any };

@Scene('MENU_SCENE_ID')
export class MenuProvider {

  @SceneEnter()
  async onSceneEnter(@Ctx() ctx: Scenes.SceneContext & TUpdate & TSession) {
    try {
      const chatId =
          ctx.update?.message?.chat?.id ||
          ctx.update?.callback_query?.message?.chat?.id;

      const replyText = '📷👋 Привет! Я — бот, который превращает старые чёрно-белые фото в цветные и восстанавливает их качество.\n' +
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

      await ctx.replyWithMarkdownV2(
          escapeText('Ты можешь обработать до 3 фотографий бесплатно — результат будет с небольшим водяным знаком.\n\n' +
              'Хочешь без водяного знака и в лучшем качестве? ✨\n' +
              'Обработка без водяного знака доступна за 10 звёзд за одно фото, можешь скидывать их сразу пачкой.'),
          {
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: 'Обработать платно',
                    callback_data: 'process_for_pay'
                  },
                  {
                    text: 'Обработать бесплатно',
                    callback_data: 'process_for_free'

                  }
                ],
              ],
            },
          },
      );
    } catch (e) {
      await ctx.reply('Что-то пошло не так, но мы уже разбираемся');
    }
  }

  @Action('process_for_free')
  async onAction(@Ctx() ctx: Scenes.SceneContext) {
    try {
      await ctx.deleteMessage();
    } catch (e) {}

    await ctx.scene.leave();
    await ctx.scene.enter('PHOTO_SCENE_ID')
  }
}
