import {
  Model,
  FilterQuery,
  ProjectionType,
  QueryOptions,
  UpdateQuery,
} from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { Injectable } from '@nestjs/common';

import { Files, FilesDocument } from './files.model';

@Injectable()
export class FilesRepository {
  constructor(@InjectModel(Files.name) private model: Model<Files>) {}

  create(data: Record<string, any>) {
    return this.model.create(data);
  }

  find(
    filter: FilterQuery<FilesDocument>,
    projection?: ProjectionType<FilesDocument>,
    options?: QueryOptions<FilesDocument>,
  ) {
    return this.model.find(filter, projection, options);
  }

  findOne(
    filter?: FilterQuery<FilesDocument>,
    projection?: ProjectionType<FilesDocument>,
    options?: QueryOptions<FilesDocument>,
  ) {
    return this.model.findOne(filter, projection, options);
  }

  removeOne(
    filter?: FilterQuery<FilesDocument>,
    options?: any,
  ) {
    return this.model.deleteOne(filter, options);
  }

  updateOne(
    filter: FilterQuery<FilesDocument>,
    update: UpdateQuery<FilesDocument>,
    options: any,
  ) {
    return this.model.updateOne(filter, update, options);
  }

  findOneAndUpdate(
      filter?: FilterQuery<FilesDocument>,
      update?: UpdateQuery<FilesDocument>,
  ) {
    return this.model.findOneAndUpdate(filter, update, {
      new: true,
      upsert: true,
    });
  }
}
