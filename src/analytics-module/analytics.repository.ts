import {
  FilterQuery,
  Model,
  ProjectionType,
  QueryOptions,
} from 'mongoose';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import { Analytics, AnalyticsDocument } from './analytics.model';

@Injectable()
export class AnalyticsRepository {
  constructor(@InjectModel(Analytics.name) private model: Model<Analytics>) {}

  create(data: Partial<Analytics>) {
    return this.model.create(data);
  }

  find(
    filter: FilterQuery<AnalyticsDocument>,
    projection?: ProjectionType<AnalyticsDocument>,
    options?: QueryOptions<AnalyticsDocument>,
  ) {
    return this.model.find<AnalyticsDocument>(filter, projection, options);
  }

  findOne(
    filter?: FilterQuery<AnalyticsDocument>,
    projection?: ProjectionType<AnalyticsDocument>,
    options?: QueryOptions<AnalyticsDocument>,
  ) {
    return this.model.findOne<AnalyticsDocument>(filter, projection, options);
  }
}

