import { Injectable } from '@nestjs/common';

import { BaseService } from '../base.service';
import { TELEGRAM_PROVIDER_TOKEN } from '../constants';

import type { TReplicateResponse } from '../types/replicate';

@Injectable()
export class FileDownloaderProvider extends BaseService {
    protected providerName = TELEGRAM_PROVIDER_TOKEN;

    async getFile(fileUrl: string) {
        return this.request(fileUrl, {
            method: 'GET',
            responseType: 'arraybuffer',
        });
    }
}