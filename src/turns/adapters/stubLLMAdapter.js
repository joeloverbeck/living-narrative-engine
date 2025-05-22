// src/turns/adapters/stubLLMAdapter.js
// --- FILE START ---

import { ILLMAdapter } from '../interfaces/ILLMAdapter.js';

/**
 * @typedef {import('../interfaces/IActorTurnStrategy.js').ITurnAction} ITurnAction
 */
/**
 * @typedef {import('../interfaces/ILLMAdapter.js').ActorContext} ActorContext
 */

/**
 * @class StubLLMAdapter
 * @implements {ILLMAdapter}
 * @description A stub implementation of ILLMAdapter that always returns a
 * "core:wait" action with predefined speech. This is useful for testing
 * AI turn flows before a real LLM integration is in place.
 */
export class StubLLMAdapter extends ILLMAdapter {
    /**
     * Creates an instance of StubLLMAdapter.
     * @param {object} [dependencies={}] - Optional dependencies.
     * @param {object} [dependencies.logger] - Optional logger instance.
     */
    constructor({ logger } = {}) {
        super();
        this.logger = logger || console; // Basic fallback logger
        this.logger.info('StubLLMAdapter initialized.');
    }

    /**
     * Generates a stubbed "core:wait" action.
     * The gameSummary and actorContext parameters are ignored in this stub.
     *
     * @async
     * @param {string} gameSummary - A string providing a summarized representation of the game state. (Ignored)
     * @param {ActorContext} actorContext - An object containing specific contextual information about the AI actor. (Ignored)
     * @returns {Promise<string>} A Promise that resolves to a JSON string representing
     * the "core:wait" action with "I am a robot." as speech.
     * @throws {Error} This stub implementation does not throw errors unless JSON.stringify fails.
     */
    async generateAction(gameSummary, actorContext) {
        const actorId = actorContext?.actorId || 'UnknownActor';
        this.logger.debug(`StubLLMAdapter.generateAction called for actor ${actorId}. gameSummary and actorContext are ignored by this stub.`);

        /** @type {ITurnAction} */
        const stubbedAction = {
            actionDefinitionId: 'core:wait',
            resolvedParameters: {
                speech: "I am a robot."
            },
            commandString: "wait"
        };

        try {
            const jsonOutput = JSON.stringify(stubbedAction);
            this.logger.debug(`StubLLMAdapter: Returning JSON for actor ${actorId}: ${jsonOutput}`);
            return Promise.resolve(jsonOutput);
        } catch (error) {
            this.logger.error(`StubLLMAdapter: Failed to stringify stubbed action for actor ${actorId}. Error: ${error.message}`, error);
            // Re-throw the error as failing to stringify is a critical issue for the adapter's contract.
            throw new Error(`StubLLMAdapter: JSON.stringify failed. Details: ${error.message}`);
        }
    }
}

// --- FILE END ---