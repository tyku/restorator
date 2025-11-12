export type TReplicateResponse = {
    id: string;
    model: string;
    version: string;
    input: {
        image: string;
        model_size: string;
    };
    logs: string;
    output: string;
    data_removed: boolean;
    error: string | null;
    source: 'api';
    status: 'succeeded' | 'failed' | 'processing';
    urls: {
        cancel: string;
        get: string;
        stream: string;
        web: string;
      },
};
