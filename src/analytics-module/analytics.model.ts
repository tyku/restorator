import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { EAnalyticsEventType, EAnalyticsEventName } from './constants/types';

export type AnalyticsDocument = HydratedDocument<Analytics>;

@Schema({ timestamps: true })
export class Analytics {
  @Prop({ required: true })
  chatId: number;

  @Prop({ required: true, enum: EAnalyticsEventType })
  eventType: EAnalyticsEventType;

  @Prop({ required: true, enum: EAnalyticsEventName })
  eventName: EAnalyticsEventName;

  @Prop({ type: Object, default: {} })
  metadata?: Record<string, any>;

  @Prop()
  error?: string;

  @Prop()
  errorStack?: string;
}

export const AnalyticsSchema = SchemaFactory.createForClass(Analytics);
AnalyticsSchema.index({ chatId: 1, createdAt: -1 });
AnalyticsSchema.index({ eventType: 1, createdAt: -1 });
AnalyticsSchema.index({ eventName: 1, createdAt: -1 });

