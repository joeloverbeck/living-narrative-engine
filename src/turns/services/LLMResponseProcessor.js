// src/turns/services/LLMResponseProcessor.js
// --- FILE START ---

/** @typedef {import('../interfaces/IActorTurnStrategy.js').ITurnAction} ITurnAction_Imported */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../interfaces/ILLMResponseProcessor.js').ILLMResponseProcessor} ILLMResponseProcessor_Interface_Typedef */
/** @typedef {import('../../utils/llmUtils.js').JsonProcessingError} JsonProcessingError */

import {ILLMResponseProcessor} from '../interfaces/ILLMResponseProcessor.js';
import {LLM_TURN_ACTION_SCHEMA_ID} from '../schemas/llmOutputSchemas.js';
// Importing parseAndRepairJson instead of just cleanLLMJsonOutput
import {parseAndRepairJson} from '../../utils/llmUtils.js';

const BASE_FALLBACK_WAIT_ACTION = {
    actionDefinitionId: 'core:wait', // Default to a safe 'wait' action
    commandString: 'wait',           // Basic command for waiting
    speech: '',                      // No speech by default for fallback
};

/**
 * @typedef {object} LlmProcessingFailureInfo
 * @description Contains detailed information about a failure during LLM response processing.
 * @property {string} errorContext - The type of error (e.g., 'json_parse_error', 'json_schema_validation_error', 'invalid_input_type').
 * @property {string} [rawResponse] - The raw LLM response string, especially if JSON parsing failed (can be null if original input was null).
 * @property {string} [cleanedResponse] - The LLM response string after cleaning/repair attempt, if applicable.
 * @property {object} [parsedResponse] - The parsed LLM response, if parsing succeeded but schema validation or other issues occurred.
 * @property {Array<object>} [validationErrors] - Specific schema validation errors, if applicable.
 * @property {string} [parseErrorStage] - If 'json_parse_error', the stage from JsonProcessingError (e.g., 'initial_clean', 'repair', 'final_parse_after_repair').
 */

/**
 * @typedef {object} ProcessedTurnAction
 * @description Represents the output of this processor, compatible with ITurnAction_Imported but with explicit inclusion of 'speech' and the new 'llmProcessingFailureInfo'.
 * @property {string} actionDefinitionId - The unique System Identifier for the action.
 * @property {string} commandString - The actual command string to be processed.
 * @property {string} speech - The exact words the character will say.
 * @property {LlmProcessingFailureInfo} [llmProcessingFailureInfo] - Optional. Details of LLM processing failure, if this is a fallback action.
 * @property {object} [resolvedParameters] - Optional. As per ITurnAction_Imported (though not typically populated by this LLM processor).
 */


/**
 * @class LLMResponseProcessor
 * @extends {ILLMResponseProcessor}
 * @description Responsible for parsing, validating (using JSON schema), and transforming
 * LLM JSON responses into {@link ProcessedTurnAction} objects.
 */
export class LLMResponseProcessor extends ILLMResponseProcessor {
    /**
     * @private
     * @type {ISchemaValidator}
     */
    #schemaValidator;

    /**
     * Creates an instance of LLMResponseProcessor.
     * @param {object} dependencies - The dependencies for this processor.
     * @param {ISchemaValidator} dependencies.schemaValidator - Validator for LLM responses.
     * @throws {Error} If schemaValidator is invalid.
     */
    constructor({schemaValidator}) {
        super();
        if (!schemaValidator || typeof schemaValidator.validate !== 'function' || typeof schemaValidator.isSchemaLoaded !== 'function') {
            throw new Error("LLMResponseProcessor: Constructor requires a valid ISchemaValidator instance with 'validate' and 'isSchemaLoaded' methods.");
        }
        this.#schemaValidator = schemaValidator;

        if (!this.#schemaValidator.isSchemaLoaded(LLM_TURN_ACTION_SCHEMA_ID)) {
            console.warn(`LLMResponseProcessor: Schema with ID '${LLM_TURN_ACTION_SCHEMA_ID}' is not loaded in the provided schema validator. Validation will fail if this schema is required.`);
        }
    }

    /**
     * @private
     * Generates a fallback ProcessedTurnAction specific to LLM processing errors.
     * @param {string} errorContext - A string describing the error.
     * @param {string} actorId - The ID of the actor.
     * @param {ILogger} logger - Logger instance for detailed logging.
     * @param {object | null} [errorDetailsInput=null] - Object containing details relevant to the error type.
     * @param {any} [errorDetailsInput.rawLlmResponse] - The original raw LLM response.
     * @param {string} [errorDetailsInput.cleanedLlmResponse] - The LLM response after cleaning/repair attempt.
     * @param {object} [errorDetailsInput.parsedJsonAttempt] - The JSON object if parsing succeeded but validation failed.
     * @param {Array<object>} [errorDetailsInput.validationErrors] - Validation errors if schema validation failed.
     * @param {string} [errorDetailsInput.parseErrorStage] - Stage of parsing error, if applicable.
     * @returns {ProcessedTurnAction} The fallback ProcessedTurnAction.
     */
    _createProcessingFallbackAction(errorContext, actorId, logger, errorDetailsInput = null) {
        const loggableErrorReason = `AI LLM Processing Error for ${actorId}: ${errorContext}.`;

        /** @type {LlmProcessingFailureInfo} */
        const failureInfo = {errorContext};
        let problematicOutputDetailsForLog = errorDetailsInput;

        const rawLlmResponse = (typeof errorDetailsInput === 'object' && errorDetailsInput !== null) ? errorDetailsInput.rawLlmResponse : undefined;
        const cleanedLlmResponse = (typeof errorDetailsInput === 'object' && errorDetailsInput !== null) ? errorDetailsInput.cleanedLlmResponse : undefined;
        const parsedJsonAttempt = (typeof errorDetailsInput === 'object' && errorDetailsInput !== null) ? errorDetailsInput.parsedJsonAttempt : undefined;
        const validationErrors = (typeof errorDetailsInput === 'object' && errorDetailsInput !== null) ? errorDetailsInput.validationErrors : undefined;
        const parseErrorStage = (typeof errorDetailsInput === 'object' && errorDetailsInput !== null) ? errorDetailsInput.parseErrorStage : undefined;


        if (errorContext === 'json_parse_error' || errorContext === 'invalid_input_type') {
            failureInfo.rawResponse = (errorDetailsInput && errorDetailsInput.hasOwnProperty('rawLlmResponse')) ? rawLlmResponse : null;
            if (cleanedLlmResponse !== undefined) {
                failureInfo.cleanedResponse = cleanedLlmResponse;
                problematicOutputDetailsForLog = cleanedLlmResponse;
            } else {
                problematicOutputDetailsForLog = failureInfo.rawResponse;
            }
            if (parseErrorStage) failureInfo.parseErrorStage = parseErrorStage;
        } else if (errorContext === 'json_schema_validation_error') {
            if (rawLlmResponse !== undefined) failureInfo.rawResponse = rawLlmResponse;
            if (cleanedLlmResponse !== undefined) failureInfo.cleanedResponse = cleanedLlmResponse; // The string that was successfully parsed
            if (parsedJsonAttempt !== undefined) failureInfo.parsedResponse = parsedJsonAttempt;
            if (validationErrors !== undefined) failureInfo.validationErrors = validationErrors;
            problematicOutputDetailsForLog = parsedJsonAttempt;
        } else if (errorContext === 'schema_validator_unavailable') {
            if (rawLlmResponse !== undefined) failureInfo.rawResponse = rawLlmResponse;
            if (cleanedLlmResponse !== undefined) failureInfo.cleanedResponse = cleanedLlmResponse;
            if (parsedJsonAttempt !== undefined) failureInfo.parsedResponse = parsedJsonAttempt;
            problematicOutputDetailsForLog = parsedJsonAttempt;
        }


        const fallbackAction = {
            ...BASE_FALLBACK_WAIT_ACTION,
            llmProcessingFailureInfo: failureInfo,
        };

        logger.error(`LLMResponseProcessor: ${loggableErrorReason} Creating fallback action.`, {
            actorId,
            errorContext,
            problematicOutputDetails: problematicOutputDetailsForLog,
            llmFailureInfo: failureInfo,
            fallbackActionTaken: fallbackAction
        });

        return fallbackAction;
    }

    /**
     * Parses (with repair), validates, and transforms the LLM's JSON response string.
     * @async
     * @param {string} llmJsonResponse - The JSON string response from the LLM.
     * @param {string} actorId - The ID of the actor for whom the action is being generated.
     * @param {ILogger} logger - Logger instance for detailed logging.
     * @returns {Promise<ProcessedTurnAction>} A Promise that resolves to a valid ProcessedTurnAction,
     * or a fallback action with `llmProcessingFailureInfo` if processing fails.
     */
    async processResponse(llmJsonResponse, actorId, logger) {
        let parsedJson;
        // originalLlmJsonResponse is useful for logging the absolute raw input if parseAndRepairJson modifies it extensively or fails early.
        const originalLlmJsonResponse = llmJsonResponse;

        try {
            // parseAndRepairJson handles null/undefined/empty string checks internally and throws specific errors.
            // It also handles the cleaning (markdown removal, etc.).
            // It's async, so we await it.
            parsedJson = await parseAndRepairJson(llmJsonResponse, logger);
            // If parseAndRepairJson was successful, llmJsonResponse (the input to it) was the raw,
            // and `parsedJson` is the result. `cleanedResponse` for schema validation failure context
            // would be the string that `parseAndRepairJson` successfully parsed (which it doesn't directly expose,
            // but if validation fails, the input `llmJsonResponse` was successfully parsed and cleaned by it).

        } catch (error) {
            let errorContext = 'json_parse_error';
            let logMessage = `LLMResponseProcessor: Failed to parse/repair LLM JSON response for actor ${actorId}. Error: ${error.message}.`;
            let logDetails = {
                rawResponse: originalLlmJsonResponse,
                actorId,
                errorName: error.name,
                errorMessage: error.message,
            };
            let fallbackErrorDetails = {
                rawLlmResponse: originalLlmJsonResponse,
            };

            if (error.name === 'TypeError') { // From parseAndRepairJson if input is not a string
                errorContext = 'invalid_input_type';
                logMessage = `LLMResponseProcessor: Invalid input type for LLM JSON response for actor ${actorId}. Error: ${error.message}.`;
            } else if (error.name === 'JsonProcessingError') { // From parseAndRepairJson for parsing/repair issues
                /** @type {JsonProcessingError} */
                const jsonError = error;
                logDetails.cleanedResponseAttempt = jsonError.attemptedJsonString;
                logDetails.parseStage = jsonError.stage;
                if (jsonError.originalError) {
                    logDetails.originalParseErrorName = jsonError.originalError.name;
                    logDetails.originalParseErrorMessage = jsonError.originalError.message;
                }
                fallbackErrorDetails.cleanedLlmResponse = jsonError.attemptedJsonString;
                fallbackErrorDetails.parseErrorStage = jsonError.stage;
            }
            // For other unexpected errors during the parsing phase

            logger.error(logMessage, logDetails);
            return this._createProcessingFallbackAction(errorContext, actorId, logger, fallbackErrorDetails);
        }

        // At this point, parsedJson is the successfully parsed (and potentially repaired) object.
        // For schema validation context, 'cleanedLlmResponse' would conceptually be the string
        // that yielded `parsedJson`. Since `parseAndRepairJson` doesn't return the successfully parsed string,
        // `originalLlmJsonResponse` remains the best reference for "what was processed".

        if (!this.#schemaValidator || !LLM_TURN_ACTION_SCHEMA_ID) {
            logger.error(`LLMResponseProcessor: Schema validator or schema ID '${LLM_TURN_ACTION_SCHEMA_ID}' not available for actor ${actorId}. Cannot validate.`, {actorId});
            return this._createProcessingFallbackAction('schema_validator_unavailable', actorId, logger, {
                rawLlmResponse: originalLlmJsonResponse, // The input that was successfully parsed
                // cleanedLlmResponse: ??? not directly available post parseAndRepairJson, original is closest
                parsedJsonAttempt: parsedJson
            });
        }

        const validationResult = this.#schemaValidator.validate(LLM_TURN_ACTION_SCHEMA_ID, parsedJson);

        if (!validationResult.isValid) {
            logger.error(`LLMResponseProcessor: LLM response JSON schema validation failed for actor ${actorId}. Errors:`, {
                validationErrors: validationResult.errors,
                parsedJson, // This is the object that failed validation
                actorId
            });
            return this._createProcessingFallbackAction('json_schema_validation_error', actorId, logger, {
                rawLlmResponse: originalLlmJsonResponse, // The input that was successfully parsed
                // cleanedLlmResponse: ???
                parsedJsonAttempt: parsedJson,
                validationErrors: validationResult.errors
            });
        }

        const {actionDefinitionId, commandString, speech} = parsedJson;

        /** @type {ProcessedTurnAction} */
        const finalAction = {
            actionDefinitionId: actionDefinitionId.trim(),
            commandString: commandString.trim(),
            speech: speech,
        };

        logger.info(`LLMResponseProcessor: Successfully validated and transformed LLM output to ProcessedTurnAction for actor ${actorId}. Action: ${finalAction.actionDefinitionId}`);
        logger.debug(`LLMResponseProcessor: Transformed ProcessedTurnAction details for ${actorId}:`, {
            actorId,
            action: finalAction,
        });

        return finalAction;
    }
}

// --- FILE END ---