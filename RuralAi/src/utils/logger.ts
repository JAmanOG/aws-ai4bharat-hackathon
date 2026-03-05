/**
 * Lightweight logger for the RuralAi frontend.
 *
 * In __DEV__ mode, logs are printed to the React Native console (visible in
 * Metro terminal and Chrome DevTools). In production builds, only warnings
 * and errors are logged.
 *
 * Usage:
 *   import { logger } from '../utils/logger';
 *   logger.info('VoiceScreen', 'Recording started');
 *   logger.error('API', 'Request failed', error);
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// In dev show everything; in production only warn+error
const MIN_LEVEL: LogLevel = __DEV__ ? 'debug' : 'warn';

function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[MIN_LEVEL];
}

function formatTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}.${String(d.getMilliseconds()).padStart(3, '0')}`;
}

function log(level: LogLevel, tag: string, message: string, extra?: unknown) {
  if (!shouldLog(level)) return;

  const prefix = `[${formatTime()}] [${level.toUpperCase()}] [${tag}]`;
  const text = `${prefix} ${message}`;

  switch (level) {
    case 'debug':
      console.debug(text, extra ?? '');
      break;
    case 'info':
      console.log(text, extra ?? '');
      break;
    case 'warn':
      console.warn(text, extra ?? '');
      break;
    case 'error':
      console.error(text, extra ?? '');
      break;
  }
}

export const logger = {
  debug: (tag: string, message: string, extra?: unknown) => log('debug', tag, message, extra),
  info: (tag: string, message: string, extra?: unknown) => log('info', tag, message, extra),
  warn: (tag: string, message: string, extra?: unknown) => log('warn', tag, message, extra),
  error: (tag: string, message: string, extra?: unknown) => log('error', tag, message, extra),
};
