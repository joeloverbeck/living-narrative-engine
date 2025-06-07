// src/utils/llmUtils.js
// --- FILE START ---

/**
 * @file Utility functions for handling Large Language Model (LLM) outputs,
 * including cleaning, parsing, repairing, and validating JSON.
 */

// Import the chosen JSON repair library
import { repairJson } from '@toolsycc/json-repair';

/**
 * Custom error class for errors encountered during JSON processing,
 * including parsing and repair attempts.
 */
export class JsonProcessingError extends Error {
  /**
   * @param {string} message - The error message.
   * @param {object} [details] - Additional details about the error.
   * @param {string} [details.stage] - The stage where the error occurred (e.g., 'initial_parse', 'repair', 'final_parse').
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

// List of common conversational prefixes to remove.
// Exported because the provided test file imports it.
export const CONVERSATIONAL_PREFIXES = [
  'certainly, here is the json object:',
  'here is the json output:',
  'here is the json:',
  'here is your json:',
  "here's the json:",
  "okay, here's the json:",
  'sure, here is the json:',
  'the json response is:',
];

// Regex to identify and extract content from markdown code block wrappers.
const MARKDOWN_WRAPPER_REGEX = /^```(?:json|markdown)?\s*?\n?(.*?)\n?\s*?```$/s;

/**
 * Sanitizes raw string responses from LLMs by removing common extraneous text,
 * conversational artifacts, and markdown code block wrappers.
 * This is intended as a first step in a JSON post-processing pipeline,
 * ensuring that subsequent parsing attempts operate on the cleanest possible string.
 *
 * @param {any} rawOutput - The raw output received from the LLM.
 * Could be a string or any other data type.
 * @returns {any} If `rawOutput` is a string, it returns the cleaned string.
 * Otherwise, it returns the `rawOutput` as is without modification.
 * If cleaning results in an empty string (e.g., input was only
 * prefixes/wrappers and whitespace), an empty string is returned.
 */
export function cleanLLMJsonOutput(rawOutput) {
  if (typeof rawOutput !== 'string') {
    return rawOutput;
  }

  // Initial trim to handle leading/trailing whitespace on the overall input.
  let currentString = rawOutput.trim();

  // 1. Attempt to remove conversational prefixes.
  //    Prefixes are case-insensitive and can be followed by optional whitespace.
  //    They are expected at the very beginning of the (now initially trimmed) string.
  for (const prefix of CONVERSATIONAL_PREFIXES) {
    const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const prefixRegex = new RegExp(`^${escapedPrefix}\\s*`, 'i');

    if (prefixRegex.test(currentString)) {
      currentString = currentString.replace(prefixRegex, '');
      // Trim again after prefix removal to ensure the string starts cleanly
      // for the subsequent markdown wrapper check.
      currentString = currentString.trim();
      break; // Only remove the first matching prefix.
    }
  }

  // 2. Attempt to remove markdown code block wrappers.
  //    The regex is designed to match if the wrapper encompasses the entire (remaining, trimmed) string.
  const match = currentString.match(MARKDOWN_WRAPPER_REGEX);
  if (match && typeof match[1] === 'string') {
    // match[1] contains the content *inside* the wrapper.
    currentString = match[1];
  }

  // 3. Final trim. This cleans the content extracted from the wrapper,
  //    or the string if it had no recognized prefixes or wrappers but might have had internal content
  //    that now needs trimming (e.g. if a wrapper contained only spaces).
  return currentString.trim();
}

/**
 * @typedef {object} ILogger - Assumed logger interface.
 * @property {(message: any, ...optionalParams: any[]) => void} debug
 * @property {(message: any, ...optionalParams: any[]) => void} info
 * @property {(message: any, ...optionalParams: any[]) => void} warn
 * @property {(message: any, ...optionalParams: any[]) => void} error
 */

/**
 * Parses a JSON string, attempting to repair it if initial parsing fails.
 * It first cleans the input string using `cleanLLMJsonOutput`.
 *
 * @async
 * @param {string} jsonString - The raw JSON string to parse and potentially repair.
 * @param {ILogger} [logger] - Optional logger instance for logging warnings and errors.
 * @returns {Promise<object>} A promise that resolves with the parsed JavaScript object.
 * @throws {JsonProcessingError} If the input string is invalid, or if parsing fails even after repair attempts.
 * @throws {TypeError} If `jsonString` is not a string.
 */
export async function parseAndRepairJson(jsonString, logger) {
  if (typeof jsonString !== 'string') {
    const errorMessage = "Input 'jsonString' must be a string.";
    if (logger && typeof logger.error === 'function') {
      logger.error(
        `parseAndRepairJson: ${errorMessage} Received type: ${typeof jsonString}`
      );
    }
    throw new TypeError(errorMessage);
  }

  const cleanedJsonString = cleanLLMJsonOutput(jsonString); // [cite: 1, 995]

  if (cleanedJsonString === null || cleanedJsonString.trim() === '') {
    const errorMessage = 'Cleaned JSON string is null or empty, cannot parse.';
    if (logger && typeof logger.error === 'function') {
      logger.error(`parseAndRepairJson: ${errorMessage}`, {
        originalInput: jsonString,
      });
    }
    throw new JsonProcessingError(errorMessage, {
      stage: 'initial_clean',
      attemptedJsonString: jsonString,
    });
  }

  try {
    // Attempt initial parsing
    const parsedObject = JSON.parse(cleanedJsonString); // [cite: 1, 997]
    if (logger && typeof logger.debug === 'function') {
      logger.debug(
        'parseAndRepairJson: Successfully parsed JSON on first attempt after cleaning.',
        {
          inputLength: jsonString.length,
          cleanedLength: cleanedJsonString.length,
        }
      );
    }
    return parsedObject;
  } catch (initialParseError) {
    if (logger && typeof logger.warn === 'function') {
      logger.warn(
        `parseAndRepairJson: Initial JSON.parse failed after cleaning. Attempting repair. Error: ${initialParseError.message}`,
        {
          // [cite: 1, 998]
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
    }

    try {
      // Attempt repair using the chosen library
      const repairedString = repairJson(cleanedJsonString); // [cite: 1, 999]

      // Attempt to parse the repaired string
      const repairedObject = JSON.parse(repairedString); // [cite: 1, 1000]
      if (logger) {
        logger.debug(
          'parseAndRepairJson: Successfully parsed JSON after repair.',
          {
            // [cite: 1, 1000]
            originalInputLength: jsonString.length,
            cleanedLength: cleanedJsonString.length,
            repairedLength: repairedString.length,
          }
        );
      }
      return repairedObject;
    } catch (repairAndParseError) {
      const errorMessage = `Failed to parse JSON even after repair attempt. Repair/Parse Error: ${repairAndParseError.message}`;
      if (logger && typeof logger.error === 'function') {
        logger.error(`parseAndRepairJson: ${errorMessage}`, {
          // [cite: 1, 1000]
          originalInputLength: jsonString.length,
          cleanedJsonStringLength: cleanedJsonString.length,
          cleanedJsonPreview:
            cleanedJsonString.substring(0, 100) +
            (cleanedJsonString.length > 100 ? '...' : ''),
          initialParseError: {
            message: initialParseError.message,
            name: initialParseError.name,
          },
          repairAndParseError: {
            message: repairAndParseError.message,
            name: repairAndParseError.name,
          },
        });
      }
      throw new JsonProcessingError(errorMessage, {
        // [cite: 1, 1000]
        stage: 'final_parse_after_repair',
        originalError: repairAndParseError,
        initialParseError, // include the first error as well for context
        attemptedJsonString: cleanedJsonString, // The string fed to the repairer
      });
    }
  }
}

// --- FILE END ---
