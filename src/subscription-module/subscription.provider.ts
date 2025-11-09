import { Injectable } from '@nestjs/common';
import { SubscriptionRepository } from './subscription.repository';
import {LoggerProvider} from "../logger-module/logger.provider";

@Injectable()
export class SubscriptionProvider {
  constructor(
      private subscriptionRepo: SubscriptionRepository,
      private logger: LoggerProvider,
  ) {}

  async createOrUpdate(filter: Record<string, any>, update: Record<string, any>) {
    try {
      return await this.subscriptionRepo.findOneAndUpdate(filter, update).lean().exec();
    } catch(e) {
      this.logger.error(`${this.constructor.name} createOrUpdate: something went wrong (error=${e})`);

      throw new Error(`Something went wrong (error=${e})`)
    }
  }

  async hasActiveSubscription(chatId: number) {
    const activeSubscriptions = await this.subscriptionRepo
      .findOne({ chatId, dateTo: { $gte: new Date() } })
      .lean()
      .exec();

    return Boolean(activeSubscriptions);
  }

  add(chatId: number, amount: number) {
    return this.subscriptionRepo.findOneAndUpdate({ chatId }, { balance: { $inc: amount } })
  }

  async sub(chatId: number, amount: number = 1) {
    const actualBalance = await this.subscriptionRepo.findOne({ chatId }, { 'balance': 1 }).lean().exec();

    if (!actualBalance || actualBalance.balance <= 0) {
      this.logger.error(`Balance less or equal 0 (chatId=${chatId})`);

      throw new Error(`Balance less or equal 0 (chatId=${chatId})`);
    }

    return this.subscriptionRepo.findOneAndUpdate({ chatId }, { balance: { $dec: amount } })
  }
}
