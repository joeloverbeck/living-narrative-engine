// src/turns/services/LLMResponseProcessor.js

/** @typedef {import('../interfaces/IActorTurnStrategy.js').ITurnAction} ITurnAction */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/ILLMResponseProcessor.js').ILLMResponseProcessor} ILLMResponseProcessor_Interface_Typedef */ // JSDoc typedef for the interface class

import {ILLMResponseProcessor} from '../interfaces/ILLMResponseProcessor.js';
import {FALLBACK_AI_ACTION} from '../constants/aiConstants.js'; // Centralized import

/**
 * @class LLMResponseProcessor
 * @extends {ILLMResponseProcessor}
 * @description Responsible for parsing, validating, and transforming LLM JSON responses
 * into ITurnAction objects. It also handles errors encountered during this processing
 * by generating specific fallback actions.
 */
export class LLMResponseProcessor extends ILLMResponseProcessor {
    /**
     * Creates an instance of LLMResponseProcessor.
     */
    constructor() {
        super();
    }

    /**
     * @private
     * Generates a fallback ITurnAction specific to LLM processing errors.
     * @param {string} errorContext - A string describing the error (e.g., 'json_parse_error', 'invalid_output_type').
     * @param {string} actorId - The ID of the actor.
     * @param {any} [problematicOutput=null] - The problematic LLM output or parsed JSON, if available, for debugging.
     * @returns {ITurnAction} The fallback ITurnAction.
     */
    _createProcessingFallbackAction(errorContext, actorId, problematicOutput = null) {
        const baseFallback = {...FALLBACK_AI_ACTION};
        return {
            ...baseFallback,
            commandString: `AI LLM Processing Error for ${actorId}: ${errorContext}. Waiting.`,
            resolvedParameters: {
                ...(baseFallback.resolvedParameters || {}),
                errorContext: `llm_processing:${errorContext}`,
                actorId: actorId,
                problematicOutput: problematicOutput,
            },
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

        // JSON Parsing
        try {
            if (llmJsonResponse === null || typeof llmJsonResponse === 'undefined') {
                throw new Error("LLM JSON response is null or undefined.");
            }
            parsedJson = JSON.parse(llmJsonResponse);
        } catch (parseError) {
            logger.error(`LLMResponseProcessor: Failed to parse LLM JSON response for actor ${actorId}. Error: ${parseError.message}. Response: ${llmJsonResponse}`, {
                actorId,
                rawResponse: llmJsonResponse,
                error: parseError
            });
            // Pass llmJsonResponse as problematicOutput, which might be null/undefined here
            return this._createProcessingFallbackAction('json_parse_error', actorId, llmJsonResponse);
        }

        // Input Type Check (Validation of parsedJson)
        // An array is a valid JSON structure but not a valid top-level action object.
        if (!parsedJson || typeof parsedJson !== 'object' || Array.isArray(parsedJson)) {
            logger.error(`LLMResponseProcessor: LLM output for actor ${actorId} is not a valid object after parsing. Received type: ${Array.isArray(parsedJson) ? 'array' : typeof parsedJson}, Value:`, {
                actorId,
                output: parsedJson
            });
            return this._createProcessingFallbackAction('invalid_output_type', actorId, parsedJson);
        }

        // Destructure expected properties
        const {actionDefinitionId, resolvedParameters, commandString} = parsedJson;

        // actionDefinitionId Validation
        if (typeof actionDefinitionId !== 'string' || actionDefinitionId.trim() === '') {
            logger.error(`LLMResponseProcessor: Invalid or missing 'actionDefinitionId' in LLM output for actor ${actorId}. Received:`, {
                actorId,
                output: parsedJson
            });
            return this._createProcessingFallbackAction('missing_or_invalid_actionDefinitionId', actorId, parsedJson);
        }

        // resolvedParameters Handling
        // Should be a plain object, or will be defaulted to an empty object.
        // Arrays are not considered valid for resolvedParameters and should also default.
        let finalResolvedParameters = resolvedParameters;
        if (typeof resolvedParameters !== 'object' || resolvedParameters === null || Array.isArray(resolvedParameters)) {
            if (resolvedParameters !== undefined) { // Avoid logging for entirely missing resolvedParameters, which is fine.
                logger.warn(`LLMResponseProcessor: 'resolvedParameters' in LLM output for actor ${actorId} is not an object or is null. Defaulting to empty object. Received:`, {
                    actorId,
                    output: parsedJson // Log the whole parsedJson to see context
                });
            }
            finalResolvedParameters = {};
        }


        // commandString Handling
        const trimmedActionDefinitionId = actionDefinitionId.trim();
        const finalCommandString = (typeof commandString === 'string' && commandString.trim() !== '')
            ? commandString.trim()
            : `AI Action (${actorId}): ${trimmedActionDefinitionId}`;

        // Construct finalAction
        const finalAction = {
            actionDefinitionId: trimmedActionDefinitionId,
            resolvedParameters: finalResolvedParameters,
            commandString: finalCommandString,
        };

        logger.info(`LLMResponseProcessor: Successfully transformed LLM output to ITurnAction for actor ${actorId}. Action: ${finalAction.actionDefinitionId}`);
        logger.debug(`LLMResponseProcessor: Transformed ITurnAction details for ${actorId}:`, {
            actorId,
            action: finalAction
        });

        return finalAction;
    }
}

// --- FILE END ---