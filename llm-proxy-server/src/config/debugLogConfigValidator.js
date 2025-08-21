/**
 * @file Debug log configuration validator utilities
 * @description Provides validation functions for debug logging configuration values
 * @see appConfig.js, logStorageService.js
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';

/**
 * @typedef {object} ValidationResult
 * @property {boolean} valid - Whether the validation passed
 * @property {*} value - The validated/parsed value
 * @property {string} [error] - Error message if validation failed
 */

/**
 * Validates that a directory path exists or can be created
 * @param {string} dirPath - The directory path to validate
 * @returns {Promise<ValidationResult>} Validation result
 */
export async function validatePath(dirPath) {
  if (!dirPath || typeof dirPath !== 'string') {
    return {
      valid: false,
      value: null,
      error: 'Path must be a non-empty string',
    };
  }

  const normalizedPath = path.normalize(dirPath);

  try {
    // Check if path exists
    const stats = await fs.stat(normalizedPath).catch(() => null);

    if (stats) {
      if (!stats.isDirectory()) {
        return {
          valid: false,
          value: null,
          error: `Path exists but is not a directory: ${normalizedPath}`,
        };
      }

      // Check if directory is writable
      await fs.access(normalizedPath, fs.constants.W_OK);

      return {
        valid: true,
        value: normalizedPath,
      };
    }

    // Path doesn't exist, try to create it
    await fs.mkdir(normalizedPath, { recursive: true });

    // Verify it was created and is writable
    await fs.access(normalizedPath, fs.constants.W_OK);

    return {
      valid: true,
      value: normalizedPath,
    };
  } catch (error) {
    return {
      valid: false,
      value: null,
      error: `Cannot access or create directory: ${error.message}`,
    };
  }
}

/**
 * Parses a file size string to bytes
 * @param {string} sizeString - Size string like '10MB', '1GB', '500KB'
 * @returns {ValidationResult} Validation result with size in bytes
 */
export function parseFileSize(sizeString) {
  if (!sizeString || typeof sizeString !== 'string') {
    return {
      valid: false,
      value: null,
      error: 'File size must be a non-empty string',
    };
  }

  const pattern = /^(\d+(?:\.\d+)?)\s*([KMGT]?B)$/i;
  const match = sizeString.trim().match(pattern);

  if (!match) {
    return {
      valid: false,
      value: null,
      error: `Invalid file size format: ${sizeString}. Expected format: 10MB, 1GB, 500KB`,
    };
  }

  const [, numberStr, unit] = match;
  const number = parseFloat(numberStr);

  if (isNaN(number) || number <= 0) {
    return {
      valid: false,
      value: null,
      error: `Invalid file size number: ${numberStr}`,
    };
  }

  const units = {
    B: 1,
    KB: 1024,
    MB: 1024 * 1024,
    GB: 1024 * 1024 * 1024,
    TB: 1024 * 1024 * 1024 * 1024,
  };

  const multiplier = units[unit.toUpperCase()];
  const bytes = Math.floor(number * multiplier);

  // Validate reasonable limits (minimum 1MB, maximum 1GB)
  const minBytes = 1024 * 1024; // 1MB
  const maxBytes = 1024 * 1024 * 1024; // 1GB

  if (bytes < minBytes) {
    return {
      valid: false,
      value: null,
      error: `File size too small: ${sizeString}. Minimum is 1MB`,
    };
  }

  if (bytes > maxBytes) {
    return {
      valid: false,
      value: null,
      error: `File size too large: ${sizeString}. Maximum is 1GB`,
    };
  }

  return {
    valid: true,
    value: bytes,
  };
}

/**
 * Validates retention days value
 * @param {number} days - Number of days to validate
 * @returns {ValidationResult} Validation result
 */
export function validateRetentionDays(days) {
  if (typeof days !== 'number') {
    return {
      valid: false,
      value: null,
      error: 'Retention days must be a number',
    };
  }

  if (!Number.isInteger(days)) {
    return {
      valid: false,
      value: null,
      error: 'Retention days must be an integer',
    };
  }

  if (days < 1 || days > 365) {
    return {
      valid: false,
      value: null,
      error: `Retention days must be between 1 and 365, got ${days}`,
    };
  }

  return {
    valid: true,
    value: days,
  };
}

/**
 * Validates a cron schedule expression
 * @param {string} schedule - Cron schedule string
 * @returns {ValidationResult} Validation result
 */
export function validateCronSchedule(schedule) {
  if (!schedule || typeof schedule !== 'string') {
    return {
      valid: false,
      value: null,
      error: 'Cron schedule must be a non-empty string',
    };
  }

  // Basic cron validation (5 fields: minute hour day month weekday)
  // This is a simplified validation - a full cron parser would be more robust
  const cronPattern =
    /^(\*|([0-9]|[1-5][0-9])|\*\/([0-9]|[1-5][0-9]))\s+(\*|([0-9]|1[0-9]|2[0-3])|\*\/([0-9]|1[0-9]|2[0-3]))\s+(\*|([1-9]|[12][0-9]|3[01])|\*\/([1-9]|[12][0-9]|3[01]))\s+(\*|([1-9]|1[0-2])|\*\/([1-9]|1[0-2]))\s+(\*|([0-6])|\*\/([0-6]))$/;

  const trimmedSchedule = schedule.trim();

  if (!cronPattern.test(trimmedSchedule)) {
    return {
      valid: false,
      value: null,
      error: `Invalid cron schedule format: ${schedule}. Expected format: '0 2 * * *' (minute hour day month weekday)`,
    };
  }

  return {
    valid: true,
    value: trimmedSchedule,
  };
}

/**
 * Validates a complete debug logging configuration object
 * @param {object} config - Debug logging configuration to validate
 * @returns {Promise<ValidationResult>} Validation result
 */
export async function validateDebugLoggingConfig(config) {
  if (!config || typeof config !== 'object') {
    return {
      valid: false,
      value: null,
      error: 'Debug logging configuration must be an object',
    };
  }

  const errors = [];
  const validatedConfig = {
    enabled: config.enabled === true,
    storage: {},
    performance: {},
    cleanup: {},
  };

  // Validate storage configuration
  if (config.storage) {
    // Validate path
    if (config.storage.path) {
      const pathResult = await validatePath(config.storage.path);
      if (!pathResult.valid) {
        errors.push(`storage.path: ${pathResult.error}`);
      } else {
        validatedConfig.storage.path = pathResult.value;
      }
    }

    // Validate retention days
    if (config.storage.retentionDays !== undefined) {
      const retentionResult = validateRetentionDays(
        config.storage.retentionDays
      );
      if (!retentionResult.valid) {
        errors.push(`storage.retentionDays: ${retentionResult.error}`);
      } else {
        validatedConfig.storage.retentionDays = retentionResult.value;
      }
    }

    // Validate max file size
    if (config.storage.maxFileSize) {
      const sizeResult = parseFileSize(config.storage.maxFileSize);
      if (!sizeResult.valid) {
        errors.push(`storage.maxFileSize: ${sizeResult.error}`);
      } else {
        validatedConfig.storage.maxFileSizeBytes = sizeResult.value;
        validatedConfig.storage.maxFileSize = config.storage.maxFileSize;
      }
    }

    // Compression is a boolean
    validatedConfig.storage.compression = config.storage.compression === true;
  }

  // Validate performance configuration
  if (config.performance) {
    // Validate write buffer size
    if (config.performance.writeBufferSize !== undefined) {
      const bufferSize = config.performance.writeBufferSize;
      if (
        typeof bufferSize !== 'number' ||
        bufferSize < 1 ||
        bufferSize > 10000
      ) {
        errors.push(
          `performance.writeBufferSize: Must be a number between 1 and 10000, got ${bufferSize}`
        );
      } else {
        validatedConfig.performance.writeBufferSize = bufferSize;
      }
    }

    // Validate flush interval
    if (config.performance.flushInterval !== undefined) {
      const interval = config.performance.flushInterval;
      if (typeof interval !== 'number' || interval < 100 || interval > 60000) {
        errors.push(
          `performance.flushInterval: Must be a number between 100 and 60000ms, got ${interval}`
        );
      } else {
        validatedConfig.performance.flushInterval = interval;
      }
    }

    // Validate max concurrent writes
    if (config.performance.maxConcurrentWrites !== undefined) {
      const maxWrites = config.performance.maxConcurrentWrites;
      if (typeof maxWrites !== 'number' || maxWrites < 1 || maxWrites > 100) {
        errors.push(
          `performance.maxConcurrentWrites: Must be a number between 1 and 100, got ${maxWrites}`
        );
      } else {
        validatedConfig.performance.maxConcurrentWrites = maxWrites;
      }
    }
  }

  // Validate cleanup configuration
  if (config.cleanup) {
    // Validate cron schedule
    if (config.cleanup.schedule) {
      const scheduleResult = validateCronSchedule(config.cleanup.schedule);
      if (!scheduleResult.valid) {
        errors.push(`cleanup.schedule: ${scheduleResult.error}`);
      } else {
        validatedConfig.cleanup.schedule = scheduleResult.value;
      }
    }

    // Cleanup enabled is a boolean
    validatedConfig.cleanup.enabled = config.cleanup.enabled === true;
  }

  if (errors.length > 0) {
    return {
      valid: false,
      value: null,
      error: `Debug logging configuration validation failed:\n${errors.join('\n')}`,
    };
  }

  return {
    valid: true,
    value: validatedConfig,
  };
}
