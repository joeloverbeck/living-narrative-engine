/* eslint-disable no-console */
/* eslint-disable no-undef */
// src/logging/bootstrapLogger.js

import { LogLevel } from './consoleLogger.js';
import * as environmentUtils from '../utils/environmentUtils.js';

const { getEnvironmentVariable: importedGetEnvironmentVariable } = environmentUtils;

/**
 * @description Safely reads an environment variable even when the environment utilities module is partially mocked.
 * @param {string} key - Environment variable name.
 * @param {string} [defaultValue] - Fallback value when the variable is unavailable.
 * @returns {string} Environment variable value or the provided fallback.
 */
function safeGetEnvironmentVariable(key, defaultValue = '') {
  if (typeof importedGetEnvironmentVariable === 'function') {
    return importedGetEnvironmentVariable(key, defaultValue);
  }

  const hasProcessEnv =
    typeof process !== 'undefined' &&
    typeof process?.env === 'object' &&
    process.env !== null &&
    typeof process.env[key] === 'string';
  if (hasProcessEnv) {
    return process.env[key];
  }

  const globalKey = `__${key}__`;
  if (typeof globalThis !== 'undefined' && globalKey in globalThis) {
    const value = globalThis[globalKey];
    return value === undefined || value === null ? defaultValue : String(value);
  }

  if (
    typeof globalThis !== 'undefined' &&
    typeof globalThis.env === 'object' &&
    globalThis.env !== null &&
    key in globalThis.env
  ) {
    const envValue = globalThis.env[key];
    return envValue === undefined || envValue === null
      ? defaultValue
      : String(envValue);
  }

  return defaultValue;
}

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
 * @param {object} [options]
 * @param {string | number} [options.level] - Explicit log level override.
 * @param {number} [options.defaultLevel] - Fallback log level when no override is found.
 * @returns {number} Resolved {@link LogLevel} value.
 */
export function resolveBootstrapLogLevel({ level, defaultLevel = LogLevel.INFO } = {}) {
  const levelCandidates = [
    level,
    safeGetEnvironmentVariable('DEBUG_LOG_LEVEL', ''),
    safeGetEnvironmentVariable('DEBUG_LOG_MODE', ''),
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
 * @description Parses DEBUG_NAMESPACES environment variable into a Set of enabled namespaces.
 * @returns {Set<string>} Set of enabled debug namespaces
 */
export function resolveDebugNamespaces() {
  const namespacesEnv = safeGetEnvironmentVariable('DEBUG_NAMESPACES', '');
  if (!namespacesEnv) {
    return new Set();
  }

  // Parse comma-separated list of namespaces
  const namespaces = namespacesEnv
    .split(',')
    .map((ns) => ns.trim())
    .filter((ns) => ns.length > 0);

  return new Set(namespaces);
}

/**
 * @description Writes log arguments to the console, preferring the fallback method to
 * ensure compatibility with test environments that spy on {@link console.log}.
 * @param {keyof Console} method - Primary console method to invoke.
 * @param {keyof Console | undefined} fallback - Secondary console method invoked first.
 * @param {any[]} args - Arguments to forward to the console implementation.
 * @returns {void}
 */
function callConsoleWithFallback(method, fallback, args) {
  if (fallback && typeof console[fallback] === 'function') {
    console[fallback](...args);
  }

  if (
    typeof console[method] === 'function' &&
    (!fallback || console[method] !== console[fallback])
  ) {
    console[method](...args);
  }
}

/**
 * @description Creates a lightweight logger that respects the resolved bootstrap log level.
 * Intended for use during early bootstrap before the primary logger is available.
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
        if (typeof console.debug === 'function') {
          console.debug(...args);
        } else {
          callConsoleWithFallback('log', undefined, args);
        }
      }
    },
    info: (...args) => {
      if (level <= LogLevel.INFO) {
        callConsoleWithFallback('info', 'log', args);
      }
    },
    warn: (...args) => {
      if (level <= LogLevel.WARN) {
        if (typeof console.warn === 'function') {
          console.warn(...args);
        } else {
          callConsoleWithFallback('log', undefined, args);
        }
      }
    },
    error: (...args) => {
      if (level <= LogLevel.ERROR) {
        if (typeof console.error === 'function') {
          console.error(...args);
        } else {
          callConsoleWithFallback('log', undefined, args);
        }
      }
    },
    getLevel: () => level,
  };
}

export { LogLevel };

