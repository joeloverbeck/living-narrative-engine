// src/turns/strategies/aiPlayerStrategy.js
// --- FILE START ---

/** @typedef {import('../interfaces/ITurnContext.js').ITurnContext} ITurnContext */
/** @typedef {import('../interfaces/IActorTurnStrategy.js').ITurnAction} ITurnAction */
/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */

// --- Interface Imports ---
import {IActorTurnStrategy} from '../interfaces/IActorTurnStrategy.js';
import {ILLMAdapter} from '../interfaces/ILLMAdapter.js';
// Component ID imports (e.g., DESCRIPTION_COMPONENT_ID, EXITS_COMPONENT_ID, etc.)
// are confirmed removed as this responsibility is now with AIGameStateProvider.

// --- New Service Interface Imports ---
import {IAIGameStateProvider} from '../interfaces/IAIGameStateProvider.js';
import {IAIPromptFormatter} from '../interfaces/IAIPromptFormatter.js';
import {ILLMResponseProcessor} from '../interfaces/ILLMResponseProcessor.js';

import {FALLBACK_AI_ACTION} from '../constants/aiConstants.js'; // Centralized import. Local definition confirmed removed.

/**
 * @class AIPlayerStrategy
 * @implements {IActorTurnStrategy}
 * @description Implements the IActorTurnStrategy for AI-controlled actors.
 * This class orchestrates the AI's decision-making process. It utilizes
 * IAIGameStateProvider to gather game state, IAIPromptFormatter to create an LLM prompt,
 * ILLMAdapter to communicate with the LLM, and ILLMResponseProcessor to parse
 * the LLM's response into a valid ITurnAction.
 */
export class AIPlayerStrategy extends IActorTurnStrategy {
    /**
     * @private
     * @type {ILLMAdapter}
     */
    #llmAdapter;

    /**
     * @private
     * @type {IAIGameStateProvider}
     */
    #gameStateProvider;

    /**
     * @private
     * @type {IAIPromptFormatter}
     */
    #promptFormatter;

    /**
     * @private
     * @type {ILLMResponseProcessor}
     */
    #llmResponseProcessor;

    /**
     * Creates an instance of AIPlayerStrategy.
     * @param {object} dependencies - The dependencies for this strategy.
     * @param {ILLMAdapter} dependencies.llmAdapter - Adapter for LLM communication.
     * @param {IAIGameStateProvider} dependencies.gameStateProvider - Provider for AI game state.
     * @param {IAIPromptFormatter} dependencies.promptFormatter - Formatter for LLM prompts.
     * @param {ILLMResponseProcessor} dependencies.llmResponseProcessor - Processor for LLM responses.
     * @throws {Error} If any dependency is invalid.
     */
    constructor({llmAdapter, gameStateProvider, promptFormatter, llmResponseProcessor}) {
        super();

        if (!llmAdapter || typeof llmAdapter.generateAction !== 'function') {
            throw new Error("AIPlayerStrategy: Constructor requires a valid ILLMAdapter instance with a generateAction method.");
        }
        if (!gameStateProvider || typeof gameStateProvider.buildGameState !== 'function') {
            throw new Error("AIPlayerStrategy: Constructor requires a valid IAIGameStateProvider instance with a buildGameState method.");
        }
        if (!promptFormatter || typeof promptFormatter.formatPrompt !== 'function') {
            throw new Error("AIPlayerStrategy: Constructor requires a valid IAIPromptFormatter instance with a formatPrompt method.");
        }
        if (!llmResponseProcessor || typeof llmResponseProcessor.processResponse !== 'function') {
            throw new Error("AIPlayerStrategy: Constructor requires a valid ILLMResponseProcessor instance with a processResponse method.");
        }

        this.#llmAdapter = llmAdapter;
        this.#gameStateProvider = gameStateProvider;
        this.#promptFormatter = promptFormatter;
        this.#llmResponseProcessor = llmResponseProcessor;
    }

    /**
     * @private
     * Safely gets the logger from the context or returns a console fallback.
     * This method is retained as it's used by decideAction.
     * @param {ITurnContext | null | undefined} context - The turn context.
     * @returns {ILogger} A logger instance.
     */
    _getSafeLogger(context) {
        try {
            if (context && typeof context.getLogger === 'function') {
                const logger = context.getLogger();
                if (logger && typeof logger.error === 'function' && typeof logger.info === 'function' && typeof logger.warn === 'function' && typeof logger.debug === 'function') {
                    return logger;
                }
            }
        } catch (e) {
            console.error("AIPlayerStrategy: Error retrieving logger from context, using console. Error:", e);
        }
        // Fallback logger
        return {
            info: (...args) => console.info("[AIPlayerStrategy (fallback logger)]", ...args),
            warn: (...args) => console.warn("[AIPlayerStrategy (fallback logger)]", ...args),
            error: (...args) => console.error("[AIPlayerStrategy (fallback logger)]", ...args),
            debug: (...args) => console.debug("[AIPlayerStrategy (fallback logger)]", ...args),
        };
    }

    /**
     * @private
     * Generates a fallback ITurnAction with a specific error context.
     * This method is retained for orchestrator-level errors. Error messages
     * have been verified as appropriate for its current scope.
     * @param {string} errorContext - A string describing the error (e.g., 'null_turn_context').
     * @param {string} [actorId='UnknownActor'] - The ID of the actor for logging purposes.
     * @returns {ITurnAction} The fallback ITurnAction.
     */
    _createFallbackAction(errorContext, actorId = 'UnknownActor') {
        return {
            actionDefinitionId: FALLBACK_AI_ACTION.actionDefinitionId,
            commandString: `AI Error for ${actorId}: ${errorContext}. Waiting.`,
            resolvedParameters: {
                errorContext: errorContext,
                actorId: actorId,
            },
        };
    }

    // Obsolete _transformAndValidateLLMOutput method (previously here and commented out)
    // has been removed. Its functionality was moved to LLMResponseProcessor.processResponse
    // as per Ticket 19 and prior refactoring.

    /**
     * Determines the action an AI actor will take for the current turn by orchestrating
     * calls to various AI services.
     * Obsolete logic for direct data gathering (location summary, actions, perception log),
     * gameSummary object construction, direct LLM prompt building, and direct JSON parsing
     * of LLM response have been confirmed removed from this method, with responsibilities
     * delegated to AIGameStateProvider, AIPromptFormatter, and LLMResponseProcessor.
     * @async
     * @param {ITurnContext} context - The turn context for the current turn.
     * @returns {Promise<ITurnAction>} A Promise that resolves to an ITurnAction object,
     * either generated by the AI or a fallback action in case of errors.
     */
    async decideAction(context) {
        const logger = this._getSafeLogger(context);
        let actor;
        let actorId = 'UnknownActor'; // Default for logging if actor retrieval fails

        try {
            // 1. Initial Validation
            if (!context) {
                logger.error("AIPlayerStrategy: Critical - ITurnContext is null or undefined in decideAction.");
                return this._createFallbackAction('null_turn_context');
            }
            actor = context.getActor();
            if (!actor || !actor.id) {
                logger.error("AIPlayerStrategy: Critical - Actor not available or ID missing in ITurnContext.");
                return this._createFallbackAction('missing_actor_in_context');
            }
            actorId = actor.id;
            logger.info(`AIPlayerStrategy: decideAction called for actor ${actorId}. Orchestrating AI decision pipeline.`);

            // 2. Build Game State DTO
            const gameStateDto = await this.#gameStateProvider.buildGameState(actor, context, logger);

            // 3. Format LLM Prompt
            const llmPromptString = this.#promptFormatter.formatPrompt(gameStateDto, logger);
            if (!llmPromptString || llmPromptString.startsWith("Error:")) { // Assuming error from formatter might be prefixed
                const promptContentDetail = llmPromptString === null ? "null" : (llmPromptString === "" ? "empty" : `"${llmPromptString}"`);
                logger.error(`AIPlayerStrategy: Prompt formatter failed or returned error for actor ${actorId}. Prompt content: ${promptContentDetail}`);
                return this._createFallbackAction('prompt_formatter_failure', actorId);
            }
            logger.info(`AIPlayerStrategy: Generated LLM prompt for actor ${actorId}. Length: ${llmPromptString.length}`);
            logger.debug(`AIPlayerStrategy: LLM Prompt for ${actorId}:\n${llmPromptString}`);

            // 4. Call LLM Adapter
            const llmJsonResponse = await this.#llmAdapter.generateAction(llmPromptString);
            logger.debug(`AIPlayerStrategy: Received LLM JSON response for actor ${actorId}: ${llmJsonResponse}`);

            // 5. Process LLM Response (and return its result)
            return this.#llmResponseProcessor.processResponse(llmJsonResponse, actorId, logger);

        } catch (error) {
            const errorMessage = error && typeof error.message === 'string' ? error.message : 'Unknown error object';
            const mainErrorMsg = `AIPlayerStrategy: Unhandled error during decideAction orchestration for actor ${actorId}: ${errorMessage}`;
            logger.error(mainErrorMsg, {errorDetails: error, stack: error.stack}); // Using error.stack for better debugging
            return this._createFallbackAction(`unhandled_orchestration_error: ${errorMessage}`, actorId);
        }
    }
}

// --- FILE END ---