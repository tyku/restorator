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
    // Атомарная операция: находим и списываем баланс в одной транзакции
    // Условие balance >= amount гарантирует, что списание произойдет только если баланса достаточно
    const result = await this.subscriptionRepo.findOneAndUpdate(
      { chatId, balance: { $gte: amount } },
      { $inc: { balance: -amount } },
    ).exec();

    if (!result) {
      this.logger.error(`Balance insufficient for subtraction (chatId=${chatId}, amount=${amount})`);
      return null;
    }

    return result;
  }

  async getBalance(chatId: number) {
    const actualBalances = await this.subscriptionRepo.find({ chatId }, { 'balance': 1 }).lean().exec();

    return actualBalances.reduce((acc, curr) => acc + curr.balance, 0);
  }
}
