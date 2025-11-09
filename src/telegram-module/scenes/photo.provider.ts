import {Ctx, Message, On, Scene, SceneEnter} from 'nestjs-telegraf';
import { Scenes } from 'telegraf';
import { v4 as uuidv4 } from 'uuid';

import { FilesProvider } from '../../files-module/files.provider';
import { LoggerProvider } from '../../logger-module/logger.provider';
import {escapeText} from "../libs/escape-text";

type TChat = {
  id: number;
  [k: string]: any;
};

const generateContextId = () => uuidv4();

const getFileName = (path: string = '') => path.split('/').reverse()[0];

@Scene('PHOTO_SCENE_ID')
export class PhotoProvider {
  constructor(
      private fileProvider: FilesProvider,
      private logger: LoggerProvider
  ) {}

  @SceneEnter()
  async onSceneEnter(@Ctx() ctx: Scenes.SceneContext) {
    // try {
    //   await ctx.deleteMessage();
    // } catch (e) {}
    //

    await ctx.replyWithMarkdownV2('Прикрепите одно или несколько фото и нажмите \"Обработать ✅\", когда будете готовы ', {
      reply_markup: {
        keyboard: [[{ text: '📱️Меню' }]],
        resize_keyboard: true,
        one_time_keyboard: false,
      },
    });


    (ctx.session as any).requestId = generateContextId();

  }

  @On('document')
  async onDocument(
      @Ctx() ctx: Scenes.SceneContext,
      @Message('chat') chat: TChat,
      @Message('document') document: Record<string, any>,
  ) {
    try {
      const isImage = document.mime_type.startsWith('image/');

      if (!isImage) {
        await ctx.reply('Файл не является фотографией 😳');

        return;
      }

      await ctx.replyWithMarkdownV2(escapeText('📸 Отлично! Фото принято в работу.'), {
        reply_markup: {
          keyboard: [[{ text: 'Обработать ✅' }], [{ text: '📱️Меню' }]],
          resize_keyboard: true,
          one_time_keyboard: false,
        },
      });

      const fileId = document.file_id;
      const fileLink = await ctx.telegram.getFileLink(fileId);

      await this.fileProvider.createOrUpdate({
        chatId: chat.id,
        requestId: (ctx.session as any).requestId
      }, {
        href: fileLink.href,
      });
    } catch (e) {
      this.logger.error(`${this.constructor.name} onDocument: ${e}`);
      await ctx.reply('Что-то пошло не так, но мы уже изучаем вопрос' );

      return;
    }
  }
}
