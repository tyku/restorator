import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { ESubscriptionType } from './constants/types';

export type SubscriptionDocument = HydratedDocument<Subscription>;

@Schema({ timestamps: true })
export class Subscription {
  @Prop({ required: true })
  chatId: number;

  @Prop({ required: true, enum: ESubscriptionType })
  type: ESubscriptionType;

  @Prop({ default: 0 })
  balance: number;
}

export const SubscriptionsSchema = SchemaFactory.createForClass(Subscription);
SubscriptionsSchema.index({ chatId: 1, type: 1 }, { unique: true });
