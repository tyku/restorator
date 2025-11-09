import { Input, Scenes } from 'telegraf';
import {Action, Ctx, Message, Scene, SceneEnter} from 'nestjs-telegraf';
import * as path from "node:path";



import { SubscriptionProvider } from '../../subscription-module/subscription.provider';
import { escapeText } from '../libs/escape-text';
import { UserProvider } from '../../user-module/user.provider';

import type { InputMediaPhoto } from 'telegraf/types';
import type { TMessageType } from '../types/message';
import {ESubscriptionType} from "../../subscription-module/constants/types";

@Scene('NEWUSER_SCENE_ID')
export class NewUserProvider {
    constructor(
        private userProvider: UserProvider,
        private subscriptionProvider: SubscriptionProvider,
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
            await ctx.reply('Что-то пошло не так, но мы уже разбиираемся');
        }
    }

    @Action('process_for_free')
    async onAction(@Ctx() ctx: Scenes.SceneContext) {
        try {
            await ctx.editMessageReplyMarkup(undefined);
        } catch (e) {}

        await ctx.scene.leave();
        await ctx.scene.enter('PHOTO_SCENE_ID')
    }
}
