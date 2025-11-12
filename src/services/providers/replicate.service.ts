import { Injectable } from '@nestjs/common';

import { BaseService } from '../base.service';
import { REPLICATE_PROVIDER_TOKEN } from '../constants';

import type { TReplicateResponse } from '../types/replicate';

@Injectable()
export class ReplicateService extends BaseService {
    protected providerName = REPLICATE_PROVIDER_TOKEN;

    async colorizePhoto(fileUrl: string): Promise<TReplicateResponse> {
        return this.request('/v1/predictions', {
            method: 'POST',
            headers: {
                ...this.getAuthHeaders(),   
                'Content-Type': 'application/json', 
                'Prefer': 'wait',
            },
            data: {
                version: this.getVersion(),
                input: {
                    image: fileUrl,
                    model_size: 'large',
                },
            },
        });
    } 

    private getAuthHeaders() {
        const replicationToken = this.configService.getOrThrow<{token: string}>(`providers.${this.providerName}`);

        return { 'Authorization': `Bearer ${replicationToken.token}` };
    }

    private getVersion() {
        const replicationToken = this.configService.getOrThrow<{version: string}>(`providers.${this.providerName}`);

        return replicationToken.version;
    }
}