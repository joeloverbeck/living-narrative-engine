// src/llms/llmJsonService.js
// --- FILE START ---
/**
 * @file Service for cleaning and parsing JSON produced by Large Language Models.
 */

import { cleanLLMJsonOutput } from '../utils/jsonCleaning.js';
import {
  JsonProcessingError,
  initialParse,
  repairAndParse,
} from '../utils/jsonRepair.js';
import { ensureValidLogger } from '../utils/loggerUtils.js';
import { safeDispatchError } from '../utils/safeDispatchErrorUtils.js';

/**
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 */

/**
 * @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher
 */

/**
 * Service providing utilities to sanitize and parse JSON output from LLMs.
 */
export class LlmJsonService {
  /**
   * Remove conversational prefixes and markdown wrappers from raw LLM output.
   *
   * @param {any} rawOutput - The raw string or value from the LLM.
   * @returns {any} Cleaned string if `rawOutput` is a string, otherwise the value as provided.
   */
  clean(rawOutput) {
    return cleanLLMJsonOutput(rawOutput);
  }

  /**
   * Parse a JSON string, attempting a repair on failure.
   *
   * @param {string} jsonString - The raw JSON string to parse.
   * @param {{logger?: ILogger, dispatcher?: ISafeEventDispatcher}} [options] - Optional logger and dispatcher to use during parsing.
   * @returns {Promise<object>} Parsed JSON object.
   * @throws {JsonProcessingError|TypeError} When parsing fails.
   */
  async parseAndRepair(jsonString, { logger, dispatcher } = {}) {
    const log = ensureValidLogger(logger, 'LlmJsonService');

    if (typeof jsonString !== 'string') {
      const message = "Input 'jsonString' must be a string.";
      if (dispatcher) {
        safeDispatchError(
          dispatcher,
          `parseAndRepair: ${message} Received type: ${typeof jsonString}`
        );
      } else {
        log.error(
          `parseAndRepair: ${message} Received type: ${typeof jsonString}`
        );
      }
      throw new TypeError(message);
    }

    const cleaned = cleanLLMJsonOutput(jsonString);

    if (cleaned === null || cleaned.trim() === '') {
      const msg = 'Cleaned JSON string is null or empty, cannot parse.';
      if (dispatcher) {
        safeDispatchError(dispatcher, `parseAndRepair: ${msg}`, {
          originalInput: jsonString,
        });
      } else {
        log.error(`parseAndRepair: ${msg}`, { originalInput: jsonString });
      }
      throw new JsonProcessingError(msg, {
        stage: 'initial_clean',
        attemptedJsonString: jsonString,
      });
    }

    try {
      const parsed = initialParse(cleaned, log);
      log.debug(
        'parseAndRepair: Successfully parsed JSON on first attempt after cleaning.',
        {
          inputLength: jsonString.length,
          cleanedLength: cleaned.length,
        }
      );
      return parsed;
    } catch (initialError) {
      log.warn(
        `parseAndRepair: Initial JSON.parse failed after cleaning. Attempting repair. Error: ${initialError.message}`,
        {
          originalInputLength: jsonString.length,
          cleanedJsonStringLength: cleaned.length,
          cleanedJsonPreview:
            cleaned.substring(0, 100) + (cleaned.length > 100 ? '...' : ''),
          error: { message: initialError.message, name: initialError.name },
        }
      );
      return repairAndParse(cleaned, log, dispatcher, initialError);
    }
  }
}

// --- FILE END ---
