/* eslint-disable no-console */
// src/logging/bootstrapLogger.js

import { LogLevel } from './consoleLogger.js';
import { getEnvironmentVariable } from '../utils/environmentUtils.js';

/** @type {Record<string, number>} */
const LOG_LEVEL_MAP = {
  DEBUG: LogLevel.DEBUG,
  INFO: LogLevel.INFO,
  WARN: LogLevel.WARN,
  WARNING: LogLevel.WARN,
  ERROR: LogLevel.ERROR,
  NONE: LogLevel.NONE,
  SILENT: LogLevel.NONE,
};

/** @type {Record<string, number>} */
const MODE_LEVEL_MAP = {
  console: LogLevel.DEBUG,
  development: LogLevel.DEBUG,
  debug: LogLevel.DEBUG,
  trace: LogLevel.DEBUG,
  verbose: LogLevel.DEBUG,
  production: LogLevel.INFO,
  info: LogLevel.INFO,
  warn: LogLevel.WARN,
  warning: LogLevel.WARN,
  error: LogLevel.ERROR,
  none: LogLevel.NONE,
  silent: LogLevel.NONE,
};

/**
 * @description Normalizes a raw log level input into a {@link LogLevel} value if possible.
 *
 * @param {string | number | undefined | null} candidate - Raw log level input.
 * @returns {number | undefined} Normalized {@link LogLevel} value or undefined if invalid.
 */
function normalizeLogLevel(candidate) {
  if (candidate === null || candidate === undefined) {
    return undefined;
  }

  if (typeof candidate === 'number') {
    return Object.values(LogLevel).includes(candidate) ? candidate : undefined;
  }

  const normalized = String(candidate).trim();
  if (!normalized) {
    return undefined;
  }

  const directMatch = LOG_LEVEL_MAP[normalized.toUpperCase()];
  if (directMatch !== undefined) {
    return directMatch;
  }

  const modeMatch = MODE_LEVEL_MAP[normalized.toLowerCase()];
  return modeMatch;
}

/**
 * @description Determines the effective log level to use for bootstrap logging.
 *
 * @param {object} [options]
 * @param {string | number} [options.level] - Explicit log level override.
 * @param {number} [options.defaultLevel=LogLevel.INFO] - Fallback log level when no override is found.
 * @returns {number} Resolved {@link LogLevel} value.
 */
export function resolveBootstrapLogLevel({ level, defaultLevel = LogLevel.INFO } = {}) {
  const levelCandidates = [
    level,
    getEnvironmentVariable('DEBUG_LOG_LEVEL', ''),
    getEnvironmentVariable('DEBUG_LOG_MODE', ''),
  ];

  for (const candidate of levelCandidates) {
    const resolved = normalizeLogLevel(candidate);
    if (resolved !== undefined) {
      return resolved;
    }
  }

  return defaultLevel;
}

/**
 * @description Creates a lightweight logger that respects the resolved bootstrap log level.
 * Intended for use during early bootstrap before the primary logger is available.
 *
 * @param {object} [options]
 * @param {string | number} [options.level] - Explicit log level override.
 * @param {number} [options.defaultLevel] - Fallback log level when no override is found.
 * @returns {{
 *   debug: (...args: any[]) => void,
 *   info: (...args: any[]) => void,
 *   warn: (...args: any[]) => void,
 *   error: (...args: any[]) => void,
 *   getLevel: () => number,
 * }} Logger-like object respecting the configured bootstrap log level.
 */
export function createBootstrapLogger(options = {}) {
  const level = resolveBootstrapLogLevel(options);

  return {
    debug: (...args) => {
      if (level <= LogLevel.DEBUG) {
        console.debug(...args);
      }
    },
    info: (...args) => {
      if (level <= LogLevel.INFO) {
        console.info(...args);
      }
    },
    warn: (...args) => {
      if (level <= LogLevel.WARN) {
        console.warn(...args);
      }
    },
    error: (...args) => {
      if (level <= LogLevel.ERROR) {
        console.error(...args);
      }
    },
    getLevel: () => level,
  };
}

export { LogLevel };

