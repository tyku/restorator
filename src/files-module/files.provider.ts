import { Injectable } from '@nestjs/common';

import { FilesRepository } from './files.repository';

@Injectable()
export class FilesProvider {
  constructor(private model: FilesRepository) {}

  getFile(requestId: string, type: string) {
    return this.model.findOne({ requestId, type }).lean().exec();
  }

  createOrUpdate(filter: Record<string, any>, data: Record<string, any>) {
    return this.model.findOneAndUpdate(filter, {
      $push: { hrefs: data.href },
    });
  }

  update(requestId: string, type: string, data: Record<string, any>) {
    return this.model.updateOne({ requestId, type }, data, {
      upsert: true,
      new: true,
    });
  }

  getList(filter: Record<string, any>) {
    return this.model.find(filter).lean().exec();
  }
}
