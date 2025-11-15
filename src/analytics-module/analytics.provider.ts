import { Injectable } from '@nestjs/common';
import { AnalyticsRepository } from './analytics.repository';
import {
  EAnalyticsEventType,
  EAnalyticsEventName,
} from './constants/types';
import { LoggerProvider } from '../logger-module/logger.provider';

@Injectable()
export class AnalyticsProvider {
  constructor(
    private analyticsRepo: AnalyticsRepository,
    private logger: LoggerProvider,
  ) {}

  /**
   * Логирует заход пользователя в бот
   */
  async trackBotStart(chatId: number, metadata?: Record<string, any>) {
    try {
      await this.analyticsRepo.create({
        chatId,
        eventType: EAnalyticsEventType.BOT_START,
        eventName: EAnalyticsEventName.START_COMMAND,
        metadata,
      });
    } catch (error) {
      this.logger.error(`Analytics trackBotStart error: ${error.message}`);
    }
  }

  /**
   * Логирует нажатие кнопки
   */
  async trackButtonClick(
    chatId: number,
    buttonName: EAnalyticsEventName,
    metadata?: Record<string, any>,
  ) {
    try {
      await this.analyticsRepo.create({
        chatId,
        eventType: EAnalyticsEventType.BUTTON_CLICK,
        eventName: buttonName,
        metadata,
      });
    } catch (error) {
      this.logger.error(`Analytics trackButtonClick error: ${error.message}`);
    }
  }

  /**
   * Логирует действие пользователя
   */
  async trackAction(
    chatId: number,
    actionName: EAnalyticsEventName,
    metadata?: Record<string, any>,
  ) {
    try {
      await this.analyticsRepo.create({
        chatId,
        eventType: EAnalyticsEventType.ACTION_PERFORMED,
        eventName: actionName,
        metadata,
      });
    } catch (error) {
      this.logger.error(`Analytics trackAction error: ${error.message}`);
    }
  }

  /**
   * Логирует ошибку
   */
  async trackError(
    chatId: number | undefined,
    errorName: EAnalyticsEventName,
    error: Error | string,
    metadata?: Record<string, any>,
  ) {
    try {
      const errorMessage = error instanceof Error ? error.message : error;
      const errorStack = error instanceof Error ? error.stack : undefined;

      await this.analyticsRepo.create({
        chatId: chatId || 0,
        eventType: EAnalyticsEventType.ERROR,
        eventName: errorName,
        error: errorMessage,
        errorStack,
        metadata,
      });
    } catch (err) {
      this.logger.error(`Analytics trackError error: ${err.message}`);
    }
  }

  /**
   * Логирует вход в сцену
   */
  async trackSceneEnter(chatId: number, sceneName: string, metadata?: Record<string, any>) {
    try {
      await this.analyticsRepo.create({
        chatId,
        eventType: EAnalyticsEventType.ACTION_PERFORMED,
        eventName: EAnalyticsEventName.SCENE_ENTERED,
        metadata: {
          sceneName,
          ...metadata,
        },
      });
    } catch (error) {
      this.logger.error(`Analytics trackSceneEnter error: ${error.message}`);
    }
  }

  /**
   * Логирует выход из сцены
   */
  async trackSceneLeave(chatId: number, sceneName: string, metadata?: Record<string, any>) {
    try {
      await this.analyticsRepo.create({
        chatId,
        eventType: EAnalyticsEventType.ACTION_PERFORMED,
        eventName: EAnalyticsEventName.SCENE_LEFT,
        metadata: {
          sceneName,
          ...metadata,
        },
      });
    } catch (error) {
      this.logger.error(`Analytics trackSceneLeave error: ${error.message}`);
    }
  }
}

