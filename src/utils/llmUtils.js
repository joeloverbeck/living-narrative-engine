// src/utils/llmUtils.js
// --- FILE START ---

/**
 * @file Utility functions for handling Large Language Model (LLM) outputs,
 * including cleaning, parsing, repairing, and validating JSON.
 */

// Import the chosen JSON repair library
import {repairJson} from '@toolsycc/json-repair';

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
        this.name = "JsonProcessingError";
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
    "certainly, here is the json object:",
    "here is the json output:",
    "here is the json:",
    "here is your json:",
    "here's the json:",
    "okay, here's the json:",
    "sure, here is the json:",
    "the json response is:"
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
            logger.error(`parseAndRepairJson: ${errorMessage} Received type: ${typeof jsonString}`);
        }
        throw new TypeError(errorMessage);
    }

    const cleanedJsonString = cleanLLMJsonOutput(jsonString); // [cite: 1, 995]

    if (cleanedJsonString === null || cleanedJsonString.trim() === '') {
        const errorMessage = "Cleaned JSON string is null or empty, cannot parse.";
        if (logger && typeof logger.error === 'function') {
            logger.error(`parseAndRepairJson: ${errorMessage}`, {originalInput: jsonString});
        }
        throw new JsonProcessingError(errorMessage, {
            stage: 'initial_clean',
            attemptedJsonString: jsonString
        });
    }

    try {
        // Attempt initial parsing
        const parsedObject = JSON.parse(cleanedJsonString); // [cite: 1, 997]
        if (logger && typeof logger.debug === 'function') {
            logger.debug("parseAndRepairJson: Successfully parsed JSON on first attempt after cleaning.", {
                inputLength: jsonString.length,
                cleanedLength: cleanedJsonString.length
            });
        }
        return parsedObject;
    } catch (initialParseError) {
        if (logger && typeof logger.warn === 'function') {
            logger.warn(`parseAndRepairJson: Initial JSON.parse failed after cleaning. Attempting repair. Error: ${initialParseError.message}`, { // [cite: 1, 998]
                originalInputLength: jsonString.length,
                cleanedJsonStringLength: cleanedJsonString.length,
                cleanedJsonPreview: cleanedJsonString.substring(0, 100) + (cleanedJsonString.length > 100 ? '...' : ''),
                error: {message: initialParseError.message, name: initialParseError.name}
            });
        }

        try {
            // Attempt repair using the chosen library
            const repairedString = repairJson(cleanedJsonString); // [cite: 1, 999]

            // Attempt to parse the repaired string
            const repairedObject = JSON.parse(repairedString); // [cite: 1, 1000]
            if (logger && typeof logger.info === 'function') {
                logger.info("parseAndRepairJson: Successfully parsed JSON after repair.", { // [cite: 1, 1000]
                    originalInputLength: jsonString.length,
                    cleanedLength: cleanedJsonString.length,
                    repairedLength: repairedString.length
                });
            }
            return repairedObject;
        } catch (repairAndParseError) {
            const errorMessage = `Failed to parse JSON even after repair attempt. Repair/Parse Error: ${repairAndParseError.message}`;
            if (logger && typeof logger.error === 'function') {
                logger.error(`parseAndRepairJson: ${errorMessage}`, { // [cite: 1, 1000]
                    originalInputLength: jsonString.length,
                    cleanedJsonStringLength: cleanedJsonString.length,
                    cleanedJsonPreview: cleanedJsonString.substring(0, 100) + (cleanedJsonString.length > 100 ? '...' : ''),
                    initialParseError: {message: initialParseError.message, name: initialParseError.name},
                    repairAndParseError: {message: repairAndParseError.message, name: repairAndParseError.name}
                });
            }
            throw new JsonProcessingError(errorMessage, { // [cite: 1, 1000]
                stage: 'final_parse_after_repair',
                originalError: repairAndParseError,
                initialParseError, // include the first error as well for context
                attemptedJsonString: cleanedJsonString // The string fed to the repairer
            });
        }
    }
}


/**
 * @typedef {object} LLMActionValidationResult
 * @property {boolean} isValid - Whether the JSON object conforms to the LLM_TURN_ACTION_SCHEMA.
 * @property {string[]|null} errors - An array of error messages if invalid, otherwise null.
 */

/**
 * Validates a JavaScript object against the LLM_TURN_ACTION_SCHEMA.
 * The schema requires 'actionDefinitionId' (string, non-empty),
 * 'commandString' (string, non-empty), and 'speech' (string, can be empty),
 * and no additional properties.
 *
 * Target Schema LLM_TURN_ACTION_SCHEMA:
 * {
 * "type": "object",
 * "properties": {
 * "actionDefinitionId": {
 * "type": "string",
 * "description": "The unique System Identifier for the action to be performed (e.g., 'core:wait', 'core:go', 'app:take_item'). This MUST be one of the 'System ID' values provided in the 'Your available actions are:' section.",
 * "minLength": 1
 * },
 * "commandString": {
 * "type": "string",
 * "description": "The actual command string that will be processed by the game's command parser (e.g., 'wait', 'go north', 'take a_torch from sconce', 'say Hello there'). This should be based on the 'Base Command' from the available actions list and MUST be augmented with all necessary details (e.g., specific targets, directions, items) to be a complete, parsable command. If the action implies speech, it might also be part of this string (e.g., 'say Hello'). This field is MANDATORY and must be self-sufficient.",
 * "minLength": 1
 * },
 * "speech": {
 * "type": "string",
 * "description": "The exact words the character will say aloud. Provide an empty string (\\"\\") if the character chooses not to speak this turn. This speech might also be incorporated into the 'commandString' if appropriate for the game's parser (e.g., a 'say' command). This field is MANDATORY."
 * }
 * },
 * "required": ["actionDefinitionId", "commandString", "speech"],
 * "additionalProperties": false
 * }
 *
 * @param {any} jsonObject - The JavaScript object to validate.
 * @returns {LLMActionValidationResult} An object containing a boolean 'isValid'
 * and an array of 'errors' if invalid, or null for 'errors' if valid.
 */
export function validateLLMActionSchema(jsonObject) {
    const errorMessages = [];

    // AC2: If jsonObject is not an object, or is null
    if (typeof jsonObject !== 'object' || jsonObject === null) {
        return {isValid: false, errors: ["Input must be a valid object."]};
    }

    const allowedProperties = ['actionDefinitionId', 'commandString', 'speech'];

    // AC3, AC4, AC5: Check actionDefinitionId
    if (!Object.prototype.hasOwnProperty.call(jsonObject, 'actionDefinitionId')) {
        errorMessages.push("Missing required property: actionDefinitionId.");
    } else {
        if (typeof jsonObject.actionDefinitionId !== 'string') {
            errorMessages.push("Property 'actionDefinitionId' must be a string.");
        } else if (jsonObject.actionDefinitionId.trim() === '') {
            errorMessages.push("Property 'actionDefinitionId' must not be empty.");
        }
    }

    // AC6, AC7, AC8: Check commandString
    if (!Object.prototype.hasOwnProperty.call(jsonObject, 'commandString')) {
        errorMessages.push("Missing required property: commandString.");
    } else {
        if (typeof jsonObject.commandString !== 'string') {
            errorMessages.push("Property 'commandString' must be a string.");
        } else if (jsonObject.commandString.trim() === '') {
            errorMessages.push("Property 'commandString' must not be empty.");
        }
    }

    // AC9, AC10: Check speech
    if (!Object.prototype.hasOwnProperty.call(jsonObject, 'speech')) {
        errorMessages.push("Missing required property: speech.");
    } else {
        if (typeof jsonObject.speech !== 'string') {
            errorMessages.push("Property 'speech' must be a string.");
        }
        // AC12.6: Empty string for speech is valid, so no further check here.
    }

    // AC11: Check for additional properties
    const extraProperties = [];
    for (const key in jsonObject) {
        if (Object.prototype.hasOwnProperty.call(jsonObject, key) && !allowedProperties.includes(key)) {
            extraProperties.push(key);
        }
    }
    if (extraProperties.length > 0) {
        errorMessages.push(`Object contains disallowed additional properties: [${extraProperties.join(', ')}].`);
    }

    // AC12: If all checks pass
    if (errorMessages.length === 0) {
        return {isValid: true, errors: null};
    } else {
        return {isValid: false, errors: errorMessages};
    }
}


/**
 * @typedef {object} ProcessLLMResponseResult
 * @property {boolean} success - Indicates if the processing was successful.
 * @property {object} [data] - The processed and validated data, conforming to {actionDefinitionId: string, commandString: string, speech: string}. Present only on success.
 * @property {string} [data.actionDefinitionId] - The validated action definition ID.
 * @property {string} [data.commandString] - The validated command string.
 * @property {string} [data.speech] - The validated speech string.
 * @property {string} [error] - A high-level error message. Present only on failure.
 * @property {object} [details] - Additional details about the error. Present only on failure.
 * @property {string} [details.stage] - The stage where the error occurred (e.g., 'parseAndRepair', 'validation').
 * @property {string} [details.originalError] - The original error message from the failing stage.
 * @property {string[]} [details.validationErrors] - Specific validation errors if the stage was 'validation'.
 * @property {any} [details.parsedObject] - The object that failed validation, if the stage was 'validation'.
 */

/**
 * Orchestrates the post-processing of a raw LLM string response.
 * It cleans, parses, attempts to repair, and validates the JSON response
 * against the expected action schema: {actionDefinitionId: string, commandString: string, speech: string}.
 * This function implements the core logic described in ticket ILLM-T1.3.4.
 *
 * @async
 * @param {string} rawResponse - The raw string response from the LLM.
 * @param {ILogger} [logger] - Optional logger instance for diagnostics.
 * @returns {Promise<ProcessLLMResponseResult>} A promise that resolves to an object indicating success or failure,
 * with data or error details.
 */
export async function processLLMResponseString(rawResponse, logger) {
    let parsedObject;

    // AC2: Call parseAndRepairJson, which internally calls cleanLLMJsonOutput.
    // AC7: parseAndRepairJson handles null/undefined rawResponse.
    try {
        parsedObject = await parseAndRepairJson(rawResponse, logger);
    } catch (error) {
        // AC3: Handle errors from parseAndRepairJson.
        const errorMessage = "Failed to parse and repair JSON response.";
        const errorStage = (error instanceof JsonProcessingError && error.stage) ? error.stage : 'parseAndRepair';
        const originalErrorMessage = error.message || String(error);

        if (logger && typeof logger.error === 'function') {
            logger.error(`processLLMResponseString: ${errorMessage} Stage: ${errorStage}. Original error: ${originalErrorMessage}`, {
                rawResponsePreview: typeof rawResponse === 'string' ? rawResponse.substring(0, 100) + (rawResponse.length > 100 ? '...' : '') : String(rawResponse),
                // originalErrorObject: error // Optionally log the full error object
            });
        }
        return {
            success: false,
            error: errorMessage,
            details: {
                stage: errorStage,
                originalError: originalErrorMessage
            }
        };
    }

    // AC4: Call validateLLMActionSchema on the successfully parsed object.
    const validationResult = validateLLMActionSchema(parsedObject);

    if (!validationResult.isValid) {
        // AC5: Handle schema validation failures.
        const errorMessage = "Parsed JSON object failed schema validation.";
        if (logger && typeof logger.error === 'function') {
            logger.error(`processLLMResponseString: ${errorMessage}`, {
                validationErrors: validationResult.errors,
                parsedObjectForValidation: parsedObject
            });
        }
        return {
            success: false,
            error: errorMessage,
            details: {
                stage: 'validation',
                validationErrors: validationResult.errors,
                parsedObject: parsedObject
            }
        };
    }

    // AC6: Handle successful validation.
    // The validatedObject is the parsedObject that passed schema validation.
    // The target output data structure is {actionDefinitionId: string, commandString: string, speech: string}.
    const validatedData = {
        actionDefinitionId: parsedObject.actionDefinitionId,
        commandString: parsedObject.commandString,
        speech: parsedObject.speech
    };

    if (logger && typeof logger.info === 'function') {
        logger.info("processLLMResponseString: Successfully processed and validated LLM response.", {
            // validatedData: validatedData // Log the final structured data
        });
    }

    return {
        success: true,
        data: validatedData
    };
}

// --- FILE END ---