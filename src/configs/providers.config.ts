import { REPLICATE_PROVIDER_TOKEN, TELEGRAM_PROVIDER_TOKEN } from '../services/constants';

export default () => ({
  providers: {
    [REPLICATE_PROVIDER_TOKEN]: {
      endpoint: process.env.REPLICATE_ENDPOINT,
      token: process.env.REPLICATE_API_TOKEN,
      version: process.env.REPLICATE_VERSION,
    },
    [TELEGRAM_PROVIDER_TOKEN]: {
      endpoint: process.env.TELEGRAM_ENDPOINT,
    },
  },
});
