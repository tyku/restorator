import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue, JobsOptions, Job } from 'bullmq';

import { PHOTO_PROCESS_JOB, PHOTO_QUEUE } from './constants';
import type { PhotoProcessJobData } from './interfaces/photo-job.interface';

const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  removeOnComplete: true,
  removeOnFail: false,
  backoff: {
    type: 'exponential',
    delay: 2_000,
  },
};

@Injectable()
export class PhotoQueueService {
  constructor(
    @InjectQueue(PHOTO_QUEUE) private readonly photoQueue: Queue,
  ) {}

  async addJob(
    data: PhotoProcessJobData,
    options: JobsOptions = DEFAULT_JOB_OPTIONS,
  ): Promise<Job<PhotoProcessJobData>> {
    return this.photoQueue.add(PHOTO_PROCESS_JOB, data, {
      ...DEFAULT_JOB_OPTIONS,
      ...options,
      // Группируем задачи по chatId для последовательной обработки
      jobId: `${data.chatId}-${data.requestId}`,
    });
  }
}

