// src/turns/services/LLMResponseProcessor.js
// --- FILE START ---

/** @typedef {import('../interfaces/IActorTurnStrategy.js').ITurnAction} ITurnAction */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../interfaces/ILLMResponseProcessor.js').ILLMResponseProcessor} ILLMResponseProcessor_Interface_Typedef */

import {ILLMResponseProcessor} from '../interfaces/ILLMResponseProcessor.js';
import {FALLBACK_AI_ACTION} from '../constants/aiConstants.js';
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
            // In a real app, you might throw a more specific error or log this with a dedicated logger for the constructor.
            // For now, simple error suffices.
            throw new Error("LLMResponseProcessor: Constructor requires a valid ISchemaValidator instance with 'validate' and 'isSchemaLoaded' methods.");
        }
        this.#schemaValidator = schemaValidator;

        // It's a good practice to ensure the schema is loaded into the validator during application setup.
        // However, we can add a check here for robustness, though LLMResponseProcessor itself won't add it.
        // This check is more for developer awareness during testing/debugging.
        // A logger passed to constructor would be ideal for this message.
        if (!this.#schemaValidator.isSchemaLoaded(LLM_TURN_ACTION_SCHEMA_ID)) {
            console.warn(`LLMResponseProcessor: Schema with ID '${LLM_TURN_ACTION_SCHEMA_ID}' is not loaded in the provided schema validator. Validation will fail if this schema is required.`);
            // Depending on strictness, you might throw an error here if the schema is absolutely critical
            // and its absence indicates a setup problem.
            // throw new Error(`LLMResponseProcessor: Critical schema '${LLM_TURN_ACTION_SCHEMA_ID}' not loaded.`);
        }
    }

    /**
     * @private
     * Generates a fallback ITurnAction specific to LLM processing errors.
     * @param {string} errorContext - A string describing the error (e.g., 'json_parse_error', 'json_schema_validation_error').
     * @param {string} actorId - The ID of the actor.
     * @param {any} [problematicOutput=null] - The problematic LLM output, parsed JSON, or validation errors.
     * @returns {ITurnAction} The fallback ITurnAction.
     */
    _createProcessingFallbackAction(errorContext, actorId, problematicOutput = null) {
        const baseFallback = {...FALLBACK_AI_ACTION}; // Shallow copy
        // Ensure resolvedParameters is also copied if it's an object
        const resolvedParameters = {
            ...(baseFallback.resolvedParameters || {}),
            errorContext: `llm_processing:${errorContext}`,
            actorId: actorId,
        };
        // Only add problematicOutput if it's not null/undefined to avoid clutter
        if (problematicOutput !== null && typeof problematicOutput !== 'undefined') {
            resolvedParameters.problematicOutput = problematicOutput;
        }

        return {
            ...baseFallback,
            commandString: `AI LLM Processing Error for ${actorId}: ${errorContext}. Waiting.`,
            resolvedParameters,
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
                // Handle cases where the response might be an empty string or just whitespace
                throw new Error("LLM JSON response is null, undefined, or empty.");
            }
            parsedJson = JSON.parse(llmJsonResponse);
        } catch (parseError) {
            logger.error(`LLMResponseProcessor: Failed to parse LLM JSON response for actor ${actorId}. Error: ${parseError.message}. Response:`, {
                rawResponse: llmJsonResponse, // Log raw response for debugging
                actorId,
                error: parseError
            });
            return this._createProcessingFallbackAction('json_parse_error', actorId, llmJsonResponse);
        }

        // 2. Schema Validation
        // Ensure the schema validator and the specific schema ID are available
        if (!this.#schemaValidator || !LLM_TURN_ACTION_SCHEMA_ID) {
            logger.error(`LLMResponseProcessor: Schema validator or schema ID '${LLM_TURN_ACTION_SCHEMA_ID}' not available for actor ${actorId}. Cannot validate.`, {actorId});
            return this._createProcessingFallbackAction('schema_validator_unavailable', actorId, parsedJson);
        }

        const validationResult = this.#schemaValidator.validate(LLM_TURN_ACTION_SCHEMA_ID, parsedJson);

        if (!validationResult.isValid) {
            logger.error(`LLMResponseProcessor: LLM response JSON schema validation failed for actor ${actorId}. Errors:`, {
                validationErrors: validationResult.errors, // Ajv errors
                parsedJson, // Log the parsed JSON that failed validation
                actorId
            });
            // Include validation errors in the fallback action for better diagnostics
            return this._createProcessingFallbackAction('json_schema_validation_error', actorId, {
                parsedJsonAttempt: parsedJson, // What was parsed
                validationErrors: validationResult.errors // What Ajv reported
            });
        }

        // 3. Destructure and Basic Type Checks (Post-Schema Validation)
        // At this point, schema validation has confirmed presence and basic types of required fields.
        // We can be more confident in destructuring.
        const {actionDefinitionId, resolvedParameters, commandString, speech} = parsedJson;

        // The schema already enforces 'actionDefinitionId' and 'commandString' are non-empty strings
        // and 'resolvedParameters' is an object, and 'speech' is a string.
        // Further specific business logic checks can still be here if needed,
        // but basic structure and type are covered by the schema.

        // Construct finalAction
        const finalAction = {
            actionDefinitionId: actionDefinitionId.trim(), // Schema ensures it's a string
            resolvedParameters: resolvedParameters,       // Schema ensures it's an object
            commandString: commandString.trim(),         // Schema ensures it's a string
            // Potentially include speech directly in the turn action if your ITurnAction supports it,
            // or if it's handled via commandString or resolvedParameters (e.g., for a 'say' action).
            // For now, assuming ITurnAction primarily uses actionDefinitionId, resolvedParameters, commandString.
            // If ITurnAction needs a dedicated 'speech' field, add it here.
            // Example: speech: speech, (if ITurnAction has a speech property)
        };

        logger.info(`LLMResponseProcessor: Successfully validated and transformed LLM output to ITurnAction for actor ${actorId}. Action: ${finalAction.actionDefinitionId}`);
        logger.debug(`LLMResponseProcessor: Transformed ITurnAction details for ${actorId}:`, {
            actorId,
            action: finalAction,
            speechOutput: speech // Log the speech separately if not directly part of ITurnAction
        });

        return finalAction;
    }
}

// --- FILE END ---