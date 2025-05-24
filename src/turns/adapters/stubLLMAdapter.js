// src/turns/adapters/stubLLMAdapter.js
// --- FILE START ---

import {ILLMAdapter} from '../interfaces/ILLMAdapter.js';

/**
 * @typedef {import('../interfaces/IActorTurnStrategy.js').ITurnAction} ITurnAction
 */

// ActorContext typedef import removed as it's no longer used

/**
 * @class StubLLMAdapter
 * @implements {ILLMAdapter}
 * @description A stub implementation of ILLMAdapter that always returns a
 * "core:wait" action with predefined speech, conforming to the expected LLM output schema.
 * This is useful for testing AI turn flows before a real LLM integration is in place.
 */
export class StubLLMAdapter extends ILLMAdapter {
    /**
     * Creates an instance of StubLLMAdapter.
     * @param {object} [dependencies={}] - Optional dependencies.
     * @param {object} [dependencies.logger] - Optional logger instance.
     */
    constructor({logger} = {}) {
        super();
        this.logger = logger || console; // Basic fallback logger
        this.logger.info('StubLLMAdapter initialized.');
    }

    /**
     * Generates a stubbed "core:wait" action.
     * The gameSummary parameter is ignored in this stub.
     * The output format matches the LLM_TURN_ACTION_SCHEMA.
     *
     * @async
     * @param {string} gameSummary - A string providing a summarized representation of the game state. (Ignored)
     * @returns {Promise<string>} A Promise that resolves to a JSON string representing
     * the "core:wait" action with "I am a robot." as speech.
     * @throws {Error} This stub implementation does not throw errors unless JSON.stringify fails.
     */
    async getAIDecision(gameSummary) {
        // actorContext parameter removed
        const actorId = 'StubActor'; // Actor ID is not directly available from parameters anymore in this stub
        this.logger.debug(`StubLLMAdapter.generateAction called. gameSummary is ignored by this stub for actor: ${actorId}.`);

        // MODIFIED: Corrected structure for the stubbed action
        // This now conforms to the LLM_TURN_ACTION_SCHEMA (actionDefinitionId, commandString, speech)
        const correctedStubbedAction = {
            actionDefinitionId: 'core:wait',
            commandString: "wait",
            speech: "I am a robot." // speech is now a top-level property
            // resolvedParameters field is removed
        };

        try {
            // The type {ITurnAction} might not perfectly match this raw LLM output structure
            // if ITurnAction is defined as the *processed* action. However, this object
            // now matches the LLM_TURN_ACTION_SCHEMA which is what LLMResponseProcessor expects.
            /** @type {object} */ // Using generic object type for the raw LLM-like output
            const objectToSerialize = correctedStubbedAction;
            const jsonOutput = JSON.stringify(objectToSerialize);
            this.logger.debug(`StubLLMAdapter: Returning JSON for ${actorId}: ${jsonOutput}`);
            return Promise.resolve(jsonOutput);
        } catch (error) {
            this.logger.error(`StubLLMAdapter: Failed to stringify stubbed action for ${actorId}. Error: ${error.message}`, error);
            // Re-throw the error as failing to stringify is a critical issue for the adapter's contract.
            throw new Error(`StubLLMAdapter: JSON.stringify failed. Details: ${error.message}`);
        }
    }
}

// --- FILE END ---