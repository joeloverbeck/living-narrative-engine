/**
 * @module jsonRepair
 * @description Utilities for repairing and parsing JSON from LLM output.
 */

import { repairJson } from '@toolsycc/json-repair';
import { safeDispatchError } from './safeDispatchErrorUtils.js';

/**
 * Custom error class for errors encountered during JSON processing,
 * including parsing and repair attempts.
 */
export class JsonProcessingError extends Error {
  /**
   * @param {string} message - The error message.
   * @param {object} [details] - Additional details about the error.
   * @param {string} [details.stage] - The stage where the error occurred.
   * @param {Error} [details.originalError] - The original error object, if any.
   * @param {string} [details.attemptedJsonString] - The JSON string that was being processed.
   */
  constructor(message, details = {}) {
    super(message);
    this.name = 'JsonProcessingError';
    this.stage = details.stage;
    this.originalError = details.originalError;
    this.attemptedJsonString = details.attemptedJsonString;
    if (details.originalError && details.originalError.stack) {
      this.stack = `${this.stack}\nCaused by: ${details.originalError.stack}`;
    }
  }
}

/**
 * Attempts to parse a cleaned JSON string.
 *
 * @param {string} cleanedJsonString - The cleaned JSON string to parse.
 * @param {import('../interfaces/coreServices.js').ILogger} log - Logger instance.
 * @returns {object} Parsed JSON object.
 * @throws {Error} Re-throws any `JSON.parse` error.
 */
export function initialParse(cleanedJsonString, log) {
  try {
    return JSON.parse(cleanedJsonString);
  } catch (error) {
    if (log && typeof log.debug === 'function') {
      log.debug('initialParse: JSON.parse failed', { message: error.message });
    }
    throw error;
  }
}

/**
 * Attempts to repair a JSON string and then parse the result.
 *
 * @param {string} cleanedString - The cleaned JSON string to repair.
 * @param {import('../interfaces/coreServices.js').ILogger} log - Logger used for debug or error output.
 * @param {object} [dispatcher] - Optional dispatcher for error reporting.
 * @param {Error} initialError - The error thrown from `initialParse`.
 * @returns {object} The repaired and parsed object.
 * @throws {JsonProcessingError} If repair or parsing fails.
 */
export function repairAndParse(cleanedString, log, dispatcher, initialError) {
  try {
    const repairedString = repairJson(cleanedString);
    const repairedObject = JSON.parse(repairedString);
    log.debug('parseAndRepairJson: Successfully parsed JSON after repair.', {
      cleanedLength: cleanedString.length,
      repairedLength: repairedString.length,
    });
    return repairedObject;
  } catch (repairAndParseError) {
    const errorMessage = `Failed to parse JSON even after repair attempt. Repair/Parse Error: ${repairAndParseError.message}`;
    if (dispatcher) {
      safeDispatchError(dispatcher, `parseAndRepairJson: ${errorMessage}`, {
        cleanedJsonStringLength: cleanedString.length,
        cleanedJsonPreview:
          cleanedString.substring(0, 100) +
          (cleanedString.length > 100 ? '...' : ''),
        initialParseError: {
          message: initialError.message,
          name: initialError.name,
        },
        repairAndParseError: {
          message: repairAndParseError.message,
          name: repairAndParseError.name,
        },
      });
    } else {
      log.error(`parseAndRepairJson: ${errorMessage}`, {
        cleanedJsonStringLength: cleanedString.length,
        cleanedJsonPreview:
          cleanedString.substring(0, 100) +
          (cleanedString.length > 100 ? '...' : ''),
        initialParseError: {
          message: initialError.message,
          name: initialError.name,
        },
        repairAndParseError: {
          message: repairAndParseError.message,
          name: repairAndParseError.name,
        },
      });
    }
    throw new JsonProcessingError(errorMessage, {
      stage: 'final_parse_after_repair',
      originalError: repairAndParseError,
      initialParseError: initialError,
      attemptedJsonString: cleanedString,
    });
  }
}
