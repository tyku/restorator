import { Injectable } from '@nestjs/common';
import { SubscriptionRepository } from './subscription.repository';
import {LoggerProvider} from "../logger-module/logger.provider";
import { EmptyBalanceException } from './errors/empty-balance.error';

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
    return this.subscriptionRepo.findOneAndUpdate({ chatId }, { $inc: { balance: amount } })
  }

  async sub(chatId: number, amount: number = 1) {
    const actualBalance = await this.subscriptionRepo.findOne({ chatId, balance: { $gt: 0 } }, { 'balance': 1 }).lean().exec();

    if (!actualBalance || actualBalance.balance <= 0) {
      this.logger.error(`Balance less or equal 0 (chatId=${chatId})`);

      // throw new EmptyBalanceException(`Balance less or equal 0 (chatId=${chatId})`);

      return;
    }

    return this.subscriptionRepo.findOneAndUpdate({ _id: actualBalance._id, chatId }, { $inc: { balance: -amount } })
  }

  async getBalance(chatId: number) {
    const actualBalances = await this.subscriptionRepo.find({ chatId }, { 'balance': 1 }).lean().exec();

    return actualBalances.reduce((acc, curr) => acc + curr.balance, 0);
  }
}
