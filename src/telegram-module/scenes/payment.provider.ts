import { Action, Ctx, Scene, SceneEnter } from 'nestjs-telegraf';
import { SubscriptionProvider } from 'src/subscription-module/subscription.provider';
import { Scenes } from 'telegraf';

import { escapeText } from '../libs/escape-text';
import { TARIFFS, getTariffById } from '../constants/tariffs';
import { LoggerProvider } from 'src/logger-module/logger.provider';
import {
  getProcessingWordAccusative,
  getProcessingWordNominative,
  getPhotoWordGenitive,
} from '../libs/declension';

@Scene('PAYMENT_SCENE_ID')
export class PaymentProvider {
  constructor(
    private subscriptionProvider: SubscriptionProvider,
    private logger: LoggerProvider,
  ) {}

  @SceneEnter()
  async onSceneEnter(@Ctx() ctx: Scenes.SceneContext & { update?: { callback_query?: any; message?: any } }) {
    try {
      await ctx.deleteMessage();
    } catch (e) {}

    await ctx.replyWithMarkdownV2('🎛️', {
      reply_markup: {
        keyboard: [[{ text: '📱️Меню' }]],
        resize_keyboard: true,
        one_time_keyboard: false,
      },
    });
    
    const chatId = 
      ctx.update?.callback_query?.message?.chat?.id ||
      ctx.update?.message?.chat?.id ||
      ctx.from?.id ||
      ctx.chat?.id;

    if (!chatId) {
      this.logger.error(`${this.constructor.name} onSceneEnter: chatId is undefined`);
      await ctx.reply('Произошла ошибка. Попробуйте еще раз.');
      return;
    }

    const balance = await this.subscriptionProvider.getBalance(chatId);

    const tariffButtons = TARIFFS.map((tariff) => [
      {
        text: tariff.label,
        callback_data: `payment_${tariff.id.replace('tariff_', '')}`,
      },
    ]);

    await ctx.replyWithMarkdownV2(
      escapeText(
        `💰 Ваш баланс: 🎨 ${balance} обработок\n` +
          'После оплаты звёзды сразу зачислятся, и вы сможете продолжить обработку фотографий.\n\n' +
          'Выберите тариф:',
      ),
      {
        reply_markup: {
          inline_keyboard: [
            ...tariffButtons,
            [
              {
                text: '⬅️ Назад',
                callback_data: 'back_to_menu',
              },
            ],
          ],
        },
      },
    );
  }

  @Action(/^payment_(1|3|10|20)$/)
  async onTariffSelect(
    @Ctx() ctx: Scenes.SceneContext & { update: { callback_query: any } },
  ) {
    try {
      const callbackData = ctx.update.callback_query?.data;
      if (!callbackData) {
        return;
      }

      const tariffNumber = callbackData.replace('payment_', '');
      const tariffId = `tariff_${tariffNumber}`;
      const tariff = getTariffById(tariffId);

      if (!tariff) {
        this.logger.error(`${this.constructor.name} onTariffSelect: tariff not found for ${tariffId}`);
        await ctx.answerCbQuery('Тариф не найден');
        return;
      }

      await ctx.answerCbQuery();

      const chatId = 
        ctx.update.callback_query?.from?.id ||
        ctx.update.callback_query?.message?.chat?.id ||
        ctx.from?.id ||
        ctx.chat?.id;

      if (!chatId) {
        this.logger.error(`${this.constructor.name} onTariffSelect: chatId is undefined`);
        await ctx.answerCbQuery('Ошибка получения данных пользователя');
        return;
      }

      const payload = JSON.stringify({
        tariffId: tariff.id,
        amount: tariff.amount,
        chatId: chatId,
      });

      const processingWord = getProcessingWordAccusative(tariff.amount);
      const processingWordLabel = getProcessingWordNominative(tariff.amount);
      const photoWord = getPhotoWordGenitive(tariff.amount);

      await ctx.replyWithInvoice({
        title: `${tariff.name} - ${tariff.amount} ${photoWord}`,
        description: `Пополнение баланса на ${tariff.amount} ${processingWord} за ${tariff.price} звезд`,
        payload: payload,
        currency: 'XTR',
        prices: [{ label: `${tariff.amount} ${processingWordLabel}`, amount: tariff.price }],
        provider_token: '',
        start_parameter: `payment_${tariffNumber}`,
        is_flexible: false,
        need_name: false,
        need_phone_number: false,
        need_email: false,
        need_shipping_address: false,
      });
    } catch (e) {
      this.logger.error(`${this.constructor.name} onTariffSelect: ${e}`);
      await ctx.answerCbQuery('Произошла ошибка. Попробуйте еще раз.');
    }
  }

  @Action('back_to_menu')
  async onBackToMenu(@Ctx() ctx: Scenes.SceneContext) {
    try {
      await ctx.deleteMessage();
    } catch (e) {}

    await ctx.scene.leave();
    await ctx.scene.enter('MENU_SCENE_ID');
  }
}
