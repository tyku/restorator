import { Action, Ctx, Hears, On, Start, Update } from 'nestjs-telegraf';
import { Scenes } from 'telegraf';

import { LoggerProvider } from '../logger-module/logger.provider';
import { SubscriptionProvider } from '../subscription-module/subscription.provider';
import { ESubscriptionType } from '../subscription-module/constants/types';
import { getScene } from './libs/scenes';
import { getTariffById } from './constants/tariffs';
import { AnalyticsProvider } from '../analytics-module/analytics.provider';
import {
  EAnalyticsEventName,
} from '../analytics-module/constants/types';
import { PaymentProvider } from '../payments-module/payment.provider';
import { EPaymentProvider, EPaymentStatus } from '../payments-module/constants/types';

@Update()
export class TelegramUpdate {
  constructor(
    private logger: LoggerProvider,
    private subscriptionProvider: SubscriptionProvider,
    private analyticsProvider: AnalyticsProvider,
    private paymentProvider: PaymentProvider,
  ) {}

  @Start()
  async onStart(
    @Ctx()
    ctx: Scenes.SceneContext & { startPayload: Record<string, any> },
  ): Promise<void> {
    const chatId = ctx.from?.id || ctx.chat?.id;
    
    if (chatId) {
      await this.analyticsProvider.trackBotStart(chatId, {
        username: ctx.from?.username,
        firstName: ctx.from?.first_name,
        startPayload: ctx.startPayload,
      });
    }

    await ctx.scene.leave();

    if (ctx.session) {
      for (const key of Object.keys(ctx.session)) {
        delete ctx.session[key];
      }
    }

    if (ctx.session?.__scenes) {
      delete ctx.session.__scenes;
    }

    await ctx.scene.enter('NEWUSER_SCENE_ID');
  }

  // @Action('promo_code')
  // async onPromocode(@Ctx() ctx: Scenes.SceneContext) {
  //   try {
  //     await ctx.scene.leave();
  //   } catch (e) {}

  //   await ctx.scene.enter('PROMOCODE_SCENE_ID');
  // }

  // @Action(/^trainer:.+$/)
  // async onTrainer(
  //   @Ctx() ctx: Scenes.SceneContext & { update: { callback_query: any } },
  // ) {
  //   try {
  //     await ctx.deleteMessage();
  //   } catch (e) {
  //     this.logger.error(`${this.constructor.name} onTrainer error:`, e);
  //   }

  //   const action = ctx.update.callback_query?.data;
  //   const value = action.split(':')[1];

  //   await ctx.scene.enter('TRAINER_SCENE_ID', { contextName: value });
  // }

  //
  // @Action('withdraw')
  // async onWithdraw(@Ctx() ctx: SceneContext) {
  //   delete ctx.session.source;
  //
  //   try {
  //     await ctx.deleteMessage();
  //   } catch (e) {}
  //
  //   await ctx.scene.enter('WITHDRAW_SCENE_ID');
  // }
  //
  // @Action(/^regenerate_v2:.+$/)
  // async onRegenerateV2(@Ctx() ctx: SceneContext) {
  //   delete ctx.session.source;
  //   const action = ctx.update.callback_query?.data;
  //
  //   const requestId = action.split(':')[1];
  //
  //   try {
  //     await ctx.deleteMessage();
  //   } catch (e) {}
  //
  //   await ctx.scene.enter('REGENERATE_SCENE_ID', { requestId });
  // }
  //
  // @Action('menu')
  // async onMenu(@Ctx() ctx: SceneContext & TSession) {
  //   try {
  //     await ctx.deleteMessage();
  //   } catch (e) {}
  //
  //   await ctx.scene.enter('MENU_SCENE_ID');
  // }
  //
  // @Action(['back_payment'])
  // async back(
  //   @Ctx() ctx: SceneContext,
  // ): Promise<void> {
  //   try {
  //     await ctx.deleteMessage();
  //   } catch (e) {}
  //
  //   await ctx.scene.enter('PAYMENT_WIZARD_ID');
  // }
  //
  // @Action(['referral'])
  // async referral(
  //   @Ctx() ctx: SceneContext,
  // ): Promise<void> {
  //   try {
  //     await ctx.deleteMessage();
  //   } catch (e) {}
  //
  //   await ctx.scene.enter('REFERRAL_SCENE_ID');
  // }
  //
  // @Action('payment_again')
  // async onPaymentAgain(@Ctx() ctx: SceneContext) {
  //   try {
  //     await ctx.deleteMessage();
  //   } catch (e) {}
  //
  //   await ctx.scene.enter('PAYMENT_WIZARD_ID');
  // }
  //
  // @Action('dice_again')
  // async diceMessage(@Ctx() ctx: SceneContext) {
  //   await ctx.scene.enter('DICE_SCENE_ID');
  // }
  //
  // @Action('darts_again')
  // async dartsMessage(@Ctx() ctx: SceneContext) {
  //   await ctx.scene.enter('DARTS_SCENE_ID');
  // }
  //

  @Hears('📱️Меню')
  async menu(@Ctx() ctx: Scenes.SceneContext) {
    const chatId = ctx.from?.id || ctx.chat?.id;
    
    if (chatId) {
      await this.analyticsProvider.trackButtonClick(
        chatId,
        EAnalyticsEventName.MENU_BUTTON,
      );
    }

    await ctx.reply('👌', {
      reply_markup: {
        remove_keyboard: true,
      },
    });
    await ctx.scene.leave();

    await ctx.scene.enter('MENU_SCENE_ID');
  }

  @On('pre_checkout_query')
  async onPreCheckoutQuery(@Ctx() ctx: Scenes.SceneContext) {
    try {
      if (!ctx.preCheckoutQuery) {
        return;
      }

      const chatId = ctx.from?.id || ctx.chat?.id;
      
      if (!chatId) {
        await ctx.answerPreCheckoutQuery(false, 'Ошибка получения данных пользователя');
        return;
      }

      let payloadData;
      try {
        payloadData = JSON.parse(ctx.preCheckoutQuery.invoice_payload);
      } catch (e) {
        this.logger.error(`${this.constructor.name} onPreCheckoutQuery: failed to parse payload: ${e}`);
        await ctx.answerPreCheckoutQuery(false, 'Ошибка обработки платежа');
        return;
      }

      const { tariffId, amount, chatId: payloadChatId } = payloadData;
      const tariff = getTariffById(tariffId);

      if (!tariff) {
        this.logger.error(`${this.constructor.name} onPreCheckoutQuery: tariff not found: ${tariffId}`);
        await ctx.answerPreCheckoutQuery(false, 'Тариф не найден');
        return;
      }

      const userId = payloadChatId || chatId;
      const externalPaymentId = ctx.preCheckoutQuery.id;

      // Создаем запись о платеже
      await this.paymentProvider.create({
        chatId: userId,
        provider: EPaymentProvider.TELEGRAM_STARS,
        amount: tariff.amount,
        price: tariff.price,
        tariffId: tariff.id,
        externalPaymentId: externalPaymentId,
        metadata: {
          currency: ctx.preCheckoutQuery.currency,
          totalAmount: ctx.preCheckoutQuery.total_amount,
          invoicePayload: ctx.preCheckoutQuery.invoice_payload,
        },
      });
      
      await this.analyticsProvider.trackAction(
        userId,
        EAnalyticsEventName.PAYMENT_INITIATED,
        {
          invoicePayload: ctx.preCheckoutQuery.invoice_payload,
          currency: ctx.preCheckoutQuery.currency,
          totalAmount: ctx.preCheckoutQuery.total_amount,
        },
      );

      // Всегда подтверждаем запрос
      await ctx.answerPreCheckoutQuery(true);
    } catch (e) {
      this.logger.error(`${this.constructor.name} onPreCheckoutQuery: ${e}`);
      
      const chatId = ctx.from?.id || ctx.chat?.id;
      if (chatId) {
        await this.analyticsProvider.trackError(
          chatId,
          EAnalyticsEventName.PAYMENT_ERROR,
          e instanceof Error ? e : new Error(String(e)),
          { action: 'pre_checkout_query' },
        );
      }
      
      try {
        await ctx.answerPreCheckoutQuery(false, 'Произошла ошибка при обработке платежа');
      } catch (err) {
        this.logger.error(`${this.constructor.name} onPreCheckoutQuery answerPreCheckoutQuery: ${err}`);
      }
    }
  }

  @On('successful_payment')
  async onSuccessfulPayment(@Ctx() ctx: Scenes.SceneContext) {
    try {
      const payment = (ctx.message as any)?.successful_payment;
      if (!payment) {
        return;
      }

      let payloadData;
      try {
        payloadData = JSON.parse(payment.invoice_payload);
      } catch (e) {
        this.logger.error(`${this.constructor.name} onSuccessfulPayment: failed to parse payload: ${e}`);
        await ctx.reply('Произошла ошибка при обработке платежа. Обратитесь в поддержку.');
        return;
      }

      const { tariffId, amount, chatId } = payloadData;
      const tariff = getTariffById(tariffId);

      if (!tariff) {
        this.logger.error(`${this.constructor.name} onSuccessfulPayment: tariff not found: ${tariffId}`);
        await ctx.reply('Тариф не найден. Обратитесь в поддержку.');
        return;
      }

      const userId = chatId || ctx.from?.id || ctx.chat?.id;
      if (!userId) {
        this.logger.error(`${this.constructor.name} onSuccessfulPayment: userId is undefined`);
        await ctx.reply('Произошла ошибка при обработке платежа. Обратитесь в поддержку.');
        return;
      }

      // Обновляем статус платежа на SUCCESS
      const telegramPaymentId = payment.telegram_payment_charge_id || payment.provider_payment_charge_id;
      
      // Пытаемся найти платеж по externalPaymentId (из pre_checkout_query.id)
      // или по telegram_payment_charge_id
      let updatedPayment: any = null;
      
      if (telegramPaymentId) {
        updatedPayment = await this.paymentProvider.updateStatusByExternalId(
          telegramPaymentId,
          EPaymentProvider.TELEGRAM_STARS,
          {
            status: EPaymentStatus.SUCCESS,
            metadata: {
              telegramPaymentChargeId: telegramPaymentId,
              providerPaymentChargeId: payment.provider_payment_charge_id,
              currency: payment.currency,
              totalAmount: payment.total_amount,
            },
          },
        );
      }

      // Если не нашли по externalPaymentId, ищем по chatId + tariffId + статус PENDING
      if (!updatedPayment) {
        const pendingPayments = await this.paymentProvider.findByChatId(userId, 10);
        const pendingPayment = pendingPayments.find(
          (p) => p.tariffId === tariff.id && p.status === EPaymentStatus.PENDING && p.provider === EPaymentProvider.TELEGRAM_STARS,
        );
        
        if (pendingPayment) {
          updatedPayment = await this.paymentProvider.updateStatus(
            pendingPayment._id.toString(),
            {
              status: EPaymentStatus.SUCCESS,
              externalPaymentId: telegramPaymentId,
              metadata: {
                telegramPaymentChargeId: telegramPaymentId,
                providerPaymentChargeId: payment.provider_payment_charge_id,
                currency: payment.currency,
                totalAmount: payment.total_amount,
              },
            },
          );
        }
      }

      // Если все еще не нашли, создаем новый платеж (на случай, если pre_checkout_query не сработал)
      if (!updatedPayment) {
        this.logger.warn(
          `${this.constructor.name} onSuccessfulPayment: payment record not found, creating new one`,
        );
        await this.paymentProvider.create({
          chatId: userId,
          provider: EPaymentProvider.TELEGRAM_STARS,
          amount: tariff.amount,
          price: tariff.price,
          tariffId: tariff.id,
          externalPaymentId: telegramPaymentId,
          metadata: {
            telegramPaymentChargeId: telegramPaymentId,
            providerPaymentChargeId: payment.provider_payment_charge_id,
            currency: payment.currency,
            totalAmount: payment.total_amount,
          },
        });
      }

      // Пополняем баланс
      await this.subscriptionProvider.createOrUpdate(
        {
          chatId: userId,
          type: ESubscriptionType.PAID,
        },
        {
          $setOnInsert: { chatId: userId, type: ESubscriptionType.PAID },
          $inc: { balance: tariff.amount },
        },
      );

      const newBalance = await this.subscriptionProvider.getBalance(userId);

      await this.analyticsProvider.trackAction(
        userId,
        EAnalyticsEventName.PAYMENT_SUCCESS,
        {
          tariffId,
          amount: tariff.amount,
          price: tariff.price,
          newBalance,
        },
      );

      await ctx.reply(
        `✅ Платеж успешно обработан!\n\n` +
          `💰 Зачислено: 🎨 ${tariff.amount} обработок\n` +
          `💰 Текущий баланс: 🎨 ${newBalance} обработок\n\n` +
          `Спасибо! Пусть ваши фото станут ещё ярче и живее 🌈`,
      );
    } catch (e) {
      this.logger.error(`${this.constructor.name} onSuccessfulPayment: ${e}`);
      
      const chatId = ctx.from?.id || ctx.chat?.id;
      if (chatId) {
        await this.analyticsProvider.trackError(
          chatId,
          EAnalyticsEventName.PAYMENT_ERROR,
          e instanceof Error ? e : new Error(String(e)),
          { action: 'successful_payment' },
        );
      }
      
      await ctx.reply('Произошла ошибка при обработке платежа. Обратитесь в поддержку.');
    }
  }
}
