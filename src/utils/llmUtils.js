// src/utils/llmUtils.js
// --- FILE START ---
/**
 * @file Utility functions for handling Large Language Model (LLM) JSON outputs.
 * Provides a high-level orchestrator to clean, repair, and parse JSON strings.
 */

import { ensureValidLogger } from './loggerUtils.js';
import { safeDispatchError } from './safeDispatchErrorUtils.js';
import { cleanLLMJsonOutput, CONVERSATIONAL_PREFIXES } from './jsonCleaning.js';
import {
  JsonProcessingError,
  initialParse,
  repairAndParse,
} from './jsonRepair.js';

export { cleanLLMJsonOutput, CONVERSATIONAL_PREFIXES } from './jsonCleaning.js';
export {
  JsonProcessingError,
  initialParse,
  repairAndParse,
} from './jsonRepair.js';

/**
 * Parses a JSON string, attempting to repair it if initial parsing fails.
 * It first cleans the input string using `cleanLLMJsonOutput`.
 *
 * @async
 * @param {string} jsonString - The raw JSON string to parse and potentially repair.
 * @param {import('../interfaces/coreServices.js').ILogger} [logger] - Optional logger instance.
 * @param {object} [dispatcher] - Optional dispatcher for error reporting.
 * @returns {Promise<object>} A promise that resolves with the parsed JavaScript object.
 * @throws {JsonProcessingError} If the input string is invalid, or if parsing fails even after repair attempts.
 * @throws {TypeError} If `jsonString` is not a string.
 */
export async function parseAndRepairJson(jsonString, logger, dispatcher) {
  const moduleLogger = ensureValidLogger(logger, 'LLMUtils');
  if (typeof jsonString !== 'string') {
    const errorMessage = "Input 'jsonString' must be a string.";
    if (dispatcher) {
      safeDispatchError(
        dispatcher,
        `parseAndRepairJson: ${errorMessage} Received type: ${typeof jsonString}`
      );
    } else {
      moduleLogger.error(
        `parseAndRepairJson: ${errorMessage} Received type: ${typeof jsonString}`
      );
    }
    throw new TypeError(errorMessage);
  }

  const cleanedJsonString = cleanLLMJsonOutput(jsonString);

  if (cleanedJsonString === null || cleanedJsonString.trim() === '') {
    const errorMessage = 'Cleaned JSON string is null or empty, cannot parse.';
    if (dispatcher) {
      safeDispatchError(dispatcher, `parseAndRepairJson: ${errorMessage}`, {
        originalInput: jsonString,
      });
    } else {
      moduleLogger.error(`parseAndRepairJson: ${errorMessage}`, {
        originalInput: jsonString,
      });
    }
    throw new JsonProcessingError(errorMessage, {
      stage: 'initial_clean',
      attemptedJsonString: jsonString,
    });
  }

  try {
    const parsedObject = initialParse(cleanedJsonString, moduleLogger);
    moduleLogger.debug(
      'parseAndRepairJson: Successfully parsed JSON on first attempt after cleaning.',
      {
        inputLength: jsonString.length,
        cleanedLength: cleanedJsonString.length,
      }
    );
    return parsedObject;
  } catch (initialParseError) {
    moduleLogger.warn(
      `parseAndRepairJson: Initial JSON.parse failed after cleaning. Attempting repair. Error: ${initialParseError.message}`,
      {
        originalInputLength: jsonString.length,
        cleanedJsonStringLength: cleanedJsonString.length,
        cleanedJsonPreview:
          cleanedJsonString.substring(0, 100) +
          (cleanedJsonString.length > 100 ? '...' : ''),
        error: {
          message: initialParseError.message,
          name: initialParseError.name,
        },
      }
    );

    return repairAndParse(
      cleanedJsonString,
      moduleLogger,
      dispatcher,
      initialParseError
    );
  }
}

// --- FILE END ---
