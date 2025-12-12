/**
 * Configuration management with environment variable validation
 */

import dotenv from 'dotenv';
import { Config } from '../types/index.js';
import { logger } from './logger.js';

// Load environment variables
dotenv.config();

/**
 * Validates that required environment variables are present
 */
function validateEnvironment(): void {
  const required = ['OPENAI_API_KEY'];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    );
  }

  logger.info('Environment variables validated successfully');
}

/**
 * Loads and validates configuration from environment variables
 */
export function loadConfig(): Config {
  validateEnvironment();

  const config: Config = {
    openai: {
      apiKey: process.env.OPENAI_API_KEY!,
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    },
    compliance: {
      url: process.env.COMPLIANCE_URL || 'https://compliance-j9ehback.manus.space/login',
      username: process.env.COMPLIANCE_USERNAME || 'admin',
      password: process.env.COMPLIANCE_PASSWORD || 'password123',
    },
    browser: {
      headless: process.env.HEADLESS !== 'false',
      timeout: parseInt(process.env.BROWSER_TIMEOUT || '30000', 10),
    },
    logging: {
      level: process.env.LOG_LEVEL || 'info',
    },
    output: {
      dir: process.env.OUTPUT_DIR || './reports',
    },
  };

  logger.info('Configuration loaded successfully', {
    openaiModel: config.openai.model,
    headless: config.browser.headless,
    logLevel: config.logging.level,
  });

  return config;
}

export default loadConfig;

