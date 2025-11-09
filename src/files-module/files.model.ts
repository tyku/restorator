import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type FilesDocument = HydratedDocument<Files>;

@Schema({ timestamps: true })
export class Files {
  @Prop()
  chatId: number;

  @Prop()
  requestId: string;

  @Prop()
  hrefs: string[];
}

export const FilesSchema = SchemaFactory.createForClass(Files);
FilesSchema.index({ chatId: 1, requestId: 1 });
FilesSchema.index({ type: 1, requestId: 1 }, { unique: true });
