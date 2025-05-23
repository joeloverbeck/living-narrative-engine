// src/turns/services/LLMResponseProcessor.js
// --- FILE START ---

/** @typedef {import('../interfaces/IActorTurnStrategy.js').ITurnAction} ITurnAction */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../interfaces/ILLMResponseProcessor.js').ILLMResponseProcessor} ILLMResponseProcessor_Interface_Typedef */

import {ILLMResponseProcessor} from '../interfaces/ILLMResponseProcessor.js';
// MODIFICATION: FALLBACK_AI_ACTION might need adjustment if ITurnAction no longer expects resolvedParameters at all.
// Let's define a modified fallback that omits resolvedParameters.
const BASE_FALLBACK_WAIT_ACTION = {
    actionDefinitionId: 'core:wait', // Default to a safe 'wait' action
    commandString: 'wait',           // Basic command for waiting
    speech: '',                      // No speech by default for fallback
};

// MODIFICATION: Import the shared schema ID
import {LLM_TURN_ACTION_SCHEMA_ID} from '../schemas/llmOutputSchemas.js';

/**
 * @class LLMResponseProcessor
 * @extends {ILLMResponseProcessor}
 * @description Responsible for parsing, validating (using JSON schema), and transforming
 * LLM JSON responses into ITurnAction objects.
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
     * Generates a fallback ITurnAction specific to LLM processing errors.
     * @param {string} errorContext - A string describing the error (e.g., 'json_parse_error', 'json_schema_validation_error').
     * @param {string} actorId - The ID of the actor.
     * @param {ILogger} logger - Logger instance for detailed logging.
     * @param {any} [problematicOutput=null] - The problematic LLM output, parsed JSON, or validation errors for logging.
     * @returns {ITurnAction} The fallback ITurnAction.
     */
    _createProcessingFallbackAction(errorContext, actorId, logger, problematicOutput = null) {
        const fallbackCommandString = `AI LLM Processing Error for ${actorId}: ${errorContext}. Executing fallback: wait.`;

        // Log the detailed error context
        logger.error(`LLMResponseProcessor: Creating fallback action for actor ${actorId} due to ${errorContext}.`, {
            actorId,
            errorContext,
            problematicOutput, // Log the problematic output for debugging
            fallbackAction: { // Log what action is being taken
                ...BASE_FALLBACK_WAIT_ACTION,
                commandString: fallbackCommandString,
            }
        });

        return {
            ...BASE_FALLBACK_WAIT_ACTION, // Uses the modified fallback without resolvedParameters
            commandString: fallbackCommandString,
            // No resolvedParameters here
        };
    }

    /**
     * Parses, validates, and transforms the LLM's JSON response string.
     * @param {string} llmJsonResponse - The JSON string response from the LLM.
     * @param {string} actorId - The ID of the actor for whom the action is being generated.
     * @param {ILogger} logger - Logger instance for detailed logging.
     * @returns {ITurnAction} A valid ITurnAction, or a fallback action if processing fails.
     */
    processResponse(llmJsonResponse, actorId, logger) {
        let parsedJson;

        // 1. JSON Parsing
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

        // 2. Schema Validation
        if (!this.#schemaValidator || !LLM_TURN_ACTION_SCHEMA_ID) {
            logger.error(`LLMResponseProcessor: Schema validator or schema ID '${LLM_TURN_ACTION_SCHEMA_ID}' not available for actor ${actorId}. Cannot validate.`, {actorId});
            // Pass logger to fallback action
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

        // 3. Destructure (Post-Schema Validation)
        // Schema validation confirmed presence and basic types of required fields.
        // resolvedParameters is no longer expected.
        const {actionDefinitionId, commandString, speech} = parsedJson;

        // Construct finalAction without resolvedParameters
        const finalAction = {
            actionDefinitionId: actionDefinitionId.trim(),
            commandString: commandString.trim(),
            speech: speech, // speech is already a string as per schema, "" is valid.
            // No resolvedParameters property
        };

        logger.info(`LLMResponseProcessor: Successfully validated and transformed LLM output to ITurnAction for actor ${actorId}. Action: ${finalAction.actionDefinitionId}`);
        logger.debug(`LLMResponseProcessor: Transformed ITurnAction details for ${actorId}:`, {
            actorId,
            action: finalAction, // This now correctly lacks resolvedParameters
            // speechOutput is already part of finalAction.speech
        });

        return finalAction;
    }
}

// --- FILE END ---