// src/turns/services/LLMResponseProcessor.js
// --- FILE START ---

/** @typedef {import('../interfaces/IActorTurnStrategy.js').ITurnAction} ITurnAction_Imported */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../interfaces/ILLMResponseProcessor.js').ILLMResponseProcessor} ILLMResponseProcessor_Interface_Typedef */

import {ILLMResponseProcessor} from '../interfaces/ILLMResponseProcessor.js';
import {LLM_TURN_ACTION_SCHEMA_ID} from '../schemas/llmOutputSchemas.js';

const BASE_FALLBACK_WAIT_ACTION = {
    actionDefinitionId: 'core:wait', // Default to a safe 'wait' action
    commandString: 'wait',           // Basic command for waiting
    speech: '',                      // No speech by default for fallback
};

/**
 * @typedef {object} LlmProcessingFailureInfo
 * @description Contains detailed information about a failure during LLM response processing.
 * @property {string} errorContext - The type of error (e.g., 'json_parse_error', 'json_schema_validation_error').
 * @property {string} [rawResponse] - The raw LLM response string, especially if JSON parsing failed (can be null if original input was null).
 * @property {object} [parsedResponse] - The parsed LLM response, if parsing succeeded but schema validation or other issues occurred.
 * @property {Array<object>} [validationErrors] - Specific schema validation errors, if applicable.
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
     * The commandString of this action will be a simple, parsable command (e.g., "wait").
     * Detailed error information is stored in the `llmProcessingFailureInfo` property.
     * @param {string} errorContext - A string describing the error (e.g., 'json_parse_error', 'json_schema_validation_error').
     * @param {string} actorId - The ID of the actor.
     * @param {ILogger} logger - Logger instance for detailed logging.
     * @param {any} [rawProblematicOutput=null] - The problematic LLM output (raw string for parse error, null, or an object with parsedJson/validationErrors for schema errors).
     * @returns {ProcessedTurnAction} The fallback ProcessedTurnAction.
     */
    _createProcessingFallbackAction(errorContext, actorId, logger, rawProblematicOutput = null) {
        const loggableErrorReason = `AI LLM Processing Error for ${actorId}: ${errorContext}.`;

        /** @type {LlmProcessingFailureInfo} */
        const failureInfo = {errorContext};

        if (errorContext === 'json_parse_error') {
            // For json_parse_error, rawProblematicOutput is the original llmJsonResponse
            // (which could be a string, null, or undefined that became null due to the default parameter).
            failureInfo.rawResponse = rawProblematicOutput;
        } else if (rawProblematicOutput !== null) { // For other error contexts, only process if rawProblematicOutput isn't null
            if (errorContext === 'json_schema_validation_error' && typeof rawProblematicOutput === 'object') {
                failureInfo.parsedResponse = rawProblematicOutput.parsedJsonAttempt;
                failureInfo.validationErrors = rawProblematicOutput.validationErrors;
            } else if (errorContext === 'schema_validator_unavailable' && typeof rawProblematicOutput === 'object') {
                failureInfo.parsedResponse = rawProblematicOutput; // Assuming rawProblematicOutput IS the parsedJson here
            }
            // Note: Generic 'test_error' or other unhandled errorContexts with non-null object rawProblematicOutput
            // won't have their details (like problematicOutput.detail) specifically assigned to failureInfo properties here
            // beyond what's logged in problematicOutputDetails.
        }
        // If rawProblematicOutput is null and errorContext is not 'json_parse_error',
        // failureInfo will only contain errorContext.

        const fallbackAction = {
            ...BASE_FALLBACK_WAIT_ACTION,
            llmProcessingFailureInfo: failureInfo,
        };

        logger.error(`LLMResponseProcessor: ${loggableErrorReason} Creating fallback action.`, {
            actorId,
            errorContext,
            problematicOutputDetails: rawProblematicOutput,
            fallbackActionTaken: fallbackAction
        });

        return fallbackAction;
    }

    /**
     * Parses, validates, and transforms the LLM's JSON response string.
     * @param {string} llmJsonResponse - The JSON string response from the LLM.
     * @param {string} actorId - The ID of the actor for whom the action is being generated.
     * @param {ILogger} logger - Logger instance for detailed logging.
     * @returns {ProcessedTurnAction} A valid ProcessedTurnAction, or a fallback action with `llmProcessingFailureInfo` if processing fails.
     */
    processResponse(llmJsonResponse, actorId, logger) {
        let parsedJson;

        try {
            if (llmJsonResponse === null || typeof llmJsonResponse === 'undefined' || llmJsonResponse.trim() === '') {
                throw new Error("LLM JSON response is null, undefined, or empty.");
            }
            parsedJson = JSON.parse(llmJsonResponse);
        } catch (parseError) {
            logger.error(`LLMResponseProcessor: Failed to parse LLM JSON response for actor ${actorId}. Error: ${parseError.message}. Response:`, {
                rawResponse: llmJsonResponse,
                actorId,
                error: parseError
            });
            return this._createProcessingFallbackAction('json_parse_error', actorId, logger, llmJsonResponse);
        }

        if (!this.#schemaValidator || !LLM_TURN_ACTION_SCHEMA_ID) {
            logger.error(`LLMResponseProcessor: Schema validator or schema ID '${LLM_TURN_ACTION_SCHEMA_ID}' not available for actor ${actorId}. Cannot validate.`, {actorId});
            return this._createProcessingFallbackAction('schema_validator_unavailable', actorId, logger, parsedJson);
        }

        const validationResult = this.#schemaValidator.validate(LLM_TURN_ACTION_SCHEMA_ID, parsedJson);

        if (!validationResult.isValid) {
            logger.error(`LLMResponseProcessor: LLM response JSON schema validation failed for actor ${actorId}. Errors:`, {
                validationErrors: validationResult.errors,
                parsedJson,
                actorId
            });
            return this._createProcessingFallbackAction('json_schema_validation_error', actorId, logger, {
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