import { Ctx, Scene, SceneEnter } from 'nestjs-telegraf';
import { Scenes } from 'telegraf';

function getFormattedDate(data: Date) {
  const day = String(data.getDate()).padStart(2, '0');
  const month = String(data.getMonth() + 1).padStart(2, '0');
  const year = data.getFullYear(); // "2025"

  return `${day}.${month}.${year}`;
}

@Scene('PAYMENT_SCENE_ID')
export class PaymentProvider {
  constructor(
  ) {}

  @SceneEnter()
  async onSceneEnter(@Ctx() ctx: Scenes.SceneContext) {
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

    await ctx.reply('Страница оплаты');
  }
}
