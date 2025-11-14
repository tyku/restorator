import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue, QueueEvents, JobsOptions, Job } from 'bullmq';

import { REPLICATE_COLORIZE_JOB, REPLICATE_QUEUE } from './constants';
import type { ReplicateColorizeJobData } from './interfaces/replicate-job.interface';

const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 30, // Увеличиваем количество попыток для обработки фото
  removeOnComplete: true,
  removeOnFail: false,
  backoff: {
    type: 'exponential',
    delay: 5_000, // Начинаем с 5 секунд, экспоненциально увеличиваем
  },
};

const WAIT_TIMEOUT_MS = 1000 * 60 * 5; // 5 minutes

@Injectable()
export class ReplicateQueueService {
  constructor(
    @InjectQueue(REPLICATE_QUEUE) private readonly replicateQueue: Queue  ) {}

  async addJob(
    data: ReplicateColorizeJobData,
    options: JobsOptions = DEFAULT_JOB_OPTIONS,
  ): Promise<Job<ReplicateColorizeJobData>> {
    return this.replicateQueue.add(REPLICATE_COLORIZE_JOB, data, options);
  }
}


