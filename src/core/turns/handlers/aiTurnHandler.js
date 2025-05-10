// src/core/turns/handlers/aiTurnHandler.js
// ──────────────────────────────────────────────────────────────────────────────
//  AITurnHandler Stub Class
// ──────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {import('../../../entities/entity.js').default} Entity
 */
/**
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 */
/**
 * @typedef {import('../states/ITurnState.js').ITurnState} ITurnState
 */
/**
 * @typedef {import('../context/TurnContext.js').TurnContextServices} TurnContextServices
 */
/**
 * @typedef {import('../context/TurnContext.js').TurnContext} ConcreteTurnContext
 */


import {BaseTurnHandler} from './baseTurnHandler.js';
import {TurnIdleState} from '../states/turnIdleState.js';
import {TurnContext} from '../context/TurnContext.js'; // For creating its own TurnContext

// TODO: Import AI-specific services if/when needed, e.g., an AIService or LLMConnector
// TODO: Import AIPlayerStrategy when it's defined

/**
 * @class AITurnHandler
 * @extends BaseTurnHandler
 * @description
 * Handles turns for AI-controlled actors. This is currently a stub implementation
 * to demonstrate the extensibility of BaseTurnHandler.
 * Future implementations will include logic for AI decision-making (e.g., via LLMs or other algorithms).
 */
export class AITurnHandler extends BaseTurnHandler {

    // AI-specific dependencies would go here, e.g.:
    // #aiDecisionService;
    // #gameQueryService; // For AI to understand world state

    /**
     * Creates an instance of AITurnHandler.
     * @param {object} deps
     * @param {ILogger} deps.logger - The logger service.
     * // TODO: Add AI-specific dependencies like an AIService, GameWorld interface, etc.
     * @param {object} [deps.gameWorldAccess] - Placeholder for game world access.
     * @param {import('../../ports/ITurnEndPort.js').ITurnEndPort} deps.turnEndPort - Port to notify on turn end.
     */
    constructor({
                    logger,
                    gameWorldAccess = {}, // Example, AI will need this
                    turnEndPort // Example, AI will need this
                    // ... other AI specific dependencies
                }) {
        super({logger, initialConcreteState: new TurnIdleState(self)});
        // `self` refers to the AITurnHandler instance.

        this._logger.debug(`${this.constructor.name} initialised.`);

        // Store AI-specific dependencies
        // this.#gameWorldAccess = gameWorldAccess; // Example
        // this.#turnEndPort = turnEndPort; // Example

        // TODO: Initialize AI services, AIPlayerStrategy, etc.
    }

    /**
     * @override
     * Initiates a turn for the AI-controlled actor.
     * @param {Entity} actor - The AI entity whose turn is to be started.
     * @returns {Promise<void>}
     */
    async startTurn(actor) {
        super._assertHandlerActive();

        if (!actor) {
            this._logger.error(`${this.constructor.name}.startTurn: actor is required.`);
            throw new Error(`${this.constructor.name}.startTurn: actor is required.`);
        }

        this._setCurrentActorInternal(actor);
        this._logger.info(`${this.constructor.name}.startTurn for actor ${actor.id}.`);

        // TODO: AI will need its own strategy for decision making
        // const aiStrategy = new AIPlayerStrategy({ aiService: this.#aiDecisionService });

        /** @type {TurnContextServices} */
        const servicesForContext = {
            // No playerPromptService for AI
            // game: this.#gameWorldAccess, // AI needs game access
            // commandProcessor: this.#commandProcessor, // AI might generate commands to be processed
            // commandOutcomeInterpreter: this.#commandOutcomeInterpreter, // If AI uses same command flow
            // safeEventDispatcher: this.#safeEventDispatcher,
            // turnEndPort: this.#turnEndPort,
            // AI specific services could be added here or accessed directly by AIStrategy
        };

        const newTurnContext = new TurnContext({
            actor: actor,
            logger: this._logger, // Or a child logger
            services: servicesForContext,
            onEndTurnCallback: (errorOrNull) => this._handleTurnEnd(actor.id, errorOrNull),
            // AI might not use the same external event provider as Player, or might have its own.
            // For a stub, this can be a simple no-op or default.
            isAwaitingExternalEventProvider: () => false,
        });
        this._setCurrentTurnContextInternal(newTurnContext);

        this._logger.debug(`${this.constructor.name}: TurnContext created for AI actor ${actor.id}.`);

        // Delegate to current state (TurnIdleState)
        // The state will eventually call methods on this handler or its strategy
        // to get the AI's action.
        try {
            await this._currentState.startTurn(this, actor);
            // For a stub, we might want to immediately log that the turn is not fully implemented
            this._logger.warn(`${this.constructor.name}: AI turn processing logic is a STUB. Actor ${actor.id}'s turn may not proceed meaningfully.`);
            // Optionally, end the turn immediately for the stub if no further action is taken by states.
            // await this._handleTurnEnd(actor.id, new Error("AI turn not fully implemented."));
        } catch (error) {
            this._logger.error(`${this.constructor.name}: Error during AI startTurn for actor ${actor.id}: ${error.message}`, error);
            await this._handleTurnEnd(actor.id, error);
        }
    }

    /**
     * @override
     * Handles cleanup if the AITurnHandler is destroyed.
     * @returns {Promise<void>}
     */
    async destroy() {
        if (this._isDestroyed) {
            this._logger.debug(`${this.constructor.name}.destroy() called but already destroyed.`);
            return;
        }
        this._logger.info(`${this.constructor.name}.destroy() invoked (AI specific part).`);

        // TODO: Add any AI-specific cleanup here (e.g., aborting ongoing LLM calls, releasing AI resources)
        // For example:
        // if (this.#aiDecisionService && typeof this.#aiDecisionService.abort === 'function') {
        //     await this.#aiDecisionService.abort();
        // }

        const initialActorIdForDestroy = this.getCurrentActor()?.id || null;
        if (initialActorIdForDestroy /* && !this.#isTerminatingNormally -- AI might not use this flag the same way */) {
            this._logger.warn(`${this.constructor.name}.destroy: Turn for ${initialActorIdForDestroy} might have been active. Forcing _handleTurnEnd if needed.`);
            await this._handleTurnEnd(
                initialActorIdForDestroy,
                new Error('AITurnHandler destroyed unexpectedly during an active turn.'),
                true // fromDestroy flag
            );
        }

        await super.destroy(); // Call base class destroy for common cleanup
        this._logger.debug(`${this.constructor.name}.destroy() AI-specific handling complete.`);
    }


    /**
     * @override
     * AI-specific resource reset, if any, beyond what BaseTurnHandler does.
     * @param {string} [actorIdContextForLog='N/A']
     */
    _resetTurnStateAndResources(actorIdContextForLog = 'N/A') {
        super._resetTurnStateAndResources(actorIdContextForLog);
        this._logger.debug(`${this.constructor.name}: AI-specific resources reset for '${actorIdContextForLog}'. (Currently a stub - no AI specific resources to reset).`);
        // TODO: Reset any AI-specific flags or states if necessary
    }

    // --- AI-Specific Lifecycle Hooks (Optional Overrides) ---
    // /**
    //  * @override
    //  */
    // async onEnterState(currentState, previousState) {
    //     await super.onEnterState(currentState, previousState);
    //     this._logger.debug(`${this.constructor.name} specific onEnterState: ${currentState.getStateName()}`);
    // }

    // /**
    //  * @override
    //  */
    // async onExitState(currentState, nextState) {
    //     await super.onExitState(currentState, nextState);
    //     this._logger.debug(`${this.constructor.name} specific onExitState: ${currentState.getStateName()}`);
    // }
}

export default AITurnHandler;