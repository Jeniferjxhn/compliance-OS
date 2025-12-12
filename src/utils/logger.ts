/**
 * Winston-based logging utility with structured logging support
 */

import winston from 'winston';
import { LoggerContext } from '../types/index.js';

const logLevel = process.env.LOG_LEVEL || 'info';

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, ...metadata }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    
    // Add metadata if present
    if (Object.keys(metadata).length > 0) {
      const metaStr = JSON.stringify(metadata, null, 2);
      if (metaStr !== '{}') {
        msg += `\n${metaStr}`;
      }
    }
    
    return msg;
  })
);

export const logger = winston.createLogger({
  level: logLevel,
  format: logFormat,
  transports: [
    new winston.transports.Console({
      format: consoleFormat,
    }),
    new winston.transports.File({
      filename: 'error.log',
      level: 'error',
    }),
    new winston.transports.File({
      filename: 'combined.log',
    }),
  ],
});

/**
 * Create a child logger with specific context
 */
export function createContextLogger(context: LoggerContext): winston.Logger {
  return logger.child(context);
}

/**
 * Log with additional context
 */
export function logWithContext(
  level: string,
  message: string,
  context?: LoggerContext
): void {
  logger.log(level, message, context);
}

export default logger;

