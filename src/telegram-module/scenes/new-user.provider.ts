import { Input, Scenes } from 'telegraf';
import {Action, Ctx, Message, Scene, SceneEnter} from 'nestjs-telegraf';
import * as path from "node:path";

import { LoggerProvider } from '../../logger-module/logger.provider';
import { SubscriptionProvider } from '../../subscription-module/subscription.provider';
import { escapeText } from '../libs/escape-text';
import { UserProvider } from '../../user-module/user.provider';
import { ESubscriptionType } from '../../subscription-module/constants/types';

import type { InputMediaPhoto } from 'telegraf/types';
import type { TMessageType } from '../types/message';

@Scene('NEWUSER_SCENE_ID')
export class NewUserProvider {
    constructor(
        private userProvider: UserProvider,
        private subscriptionProvider: SubscriptionProvider,
        private logger: LoggerProvider,
    ) {
    }

    @SceneEnter()
    async onSceneEnter(
        @Ctx() ctx: Scenes.SceneContext,
        @Message('chat') chat: TMessageType['chat'],
    ) {
        try {
            const { id: chatId, first_name: firstName, username } = chat;

            await this.userProvider.createUserIfNotExists(chatId, {
                firstName,
                username,
            });

            await this.subscriptionProvider.createOrUpdate({ chatId, type: ESubscriptionType.FREE, balance: 3 }, {});

            const replyText = '📷👋 Привет! Я — бот, который превращает старые чёрно-белые фото в цветные и восстанавливает их качество.\n' +
                'Просто отправь мне фото или документ — я всё сделаю автоматически.\n\n' +
                '*❗️Чтобы получить лучший результат, отправляй фотографии в исходном качестве, без сжатия (как документ)*\n\n' +
                'Примеры результатов 👇';

            await ctx.replyWithMarkdownV2(escapeText(replyText));

            const mediaGroup: InputMediaPhoto[] = [
                {
                    type: 'photo',
                    media: Input.fromLocalFile(path.join(__dirname, '..', '..', '..', 'photos', '1.jpg')),
                },
                {
                    type: 'photo',
                    media: Input.fromLocalFile(path.join(__dirname, '..', '..', '..', 'photos', '1_c.png')),
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
            this.logger.error(`${this.constructor.name} onDocument: ${e}`);
            await ctx.reply('Что-то пошло не так, но мы уже разбиираемся');
        }
    }

    @Action('refill_balance')
    async onActionRefill(@Ctx() ctx: Scenes.SceneContext) {
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
