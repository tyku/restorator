import * as process from 'node:process';

import telegramConfig from './telegram.config';
import mongoConfig from './mongo.config';
import redisConfig from './redis.config';
import replicateConfig from './replicate.config';

export default () => ({
  port: process.env.PORT,
  isTest: process.env.IS_TEST,
  monthPromo: process.env.MONTH_PROMO,
  ...redisConfig(),
  ...mongoConfig(),
  ...telegramConfig(),
  ...replicateConfig(),
});
