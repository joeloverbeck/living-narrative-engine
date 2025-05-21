// src/core/turns/handlers/aiTurnHandler.js
// ──────────────────────────────────────────────────────────────────────────────
//  AITurnHandler Class - Updated to use ITurnContext
// ──────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {import('../../entities/entity.js').default} Entity
 */
/**
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 */
/** @typedef {import('../interfaces/ITurnContext.js').ITurnContext} ITurnContext */
/** @typedef {import('../states/ITurnState.js').ITurnState} ITurnState */
/** @typedef {import('../context/turnContext.js').TurnContextServices} TurnContextServices */
/** @typedef {import('../context/turnContext.js').TurnContext} ConcreteTurnContext */ // Alias for clarity
/** @typedef {import('../ports/ITurnEndPort.js').ITurnEndPort} ITurnEndPort */
// TODO: Add typedef for AIPlayerStrategy if/when defined
// /** @typedef {import('../strategies/aiPlayerStrategy.js').AIPlayerStrategy} AIPlayerStrategy */


import {BaseTurnHandler} from './baseTurnHandler.js';
import {TurnIdleState} from '../states/turnIdleState.js';
import {TurnContext} from '../context/turnContext.js'; // Using ConcreteTurnContext for instantiation

// TODO: Import AI-specific services (e.g., AIService, LLMConnector) when needed.
// Example: import {AIService} from '../../services/aiService.js';

/**
 * @class AITurnHandler
 * @extends BaseTurnHandler
 * @description
 * Handles turns for AI-controlled actors. Extends BaseTurnHandler and uses ITurnContext.
 * Future implementations will include logic for AI decision-making.
 */
export class AITurnHandler extends BaseTurnHandler {

    // AI-specific dependencies would go here, e.g.:
    // /** @type {AIService} */
    // #aiService;
    /** @type {object} */ // Placeholder for game world access
    #gameWorldAccess;
    /** @type {ITurnEndPort} */
    #turnEndPort;
    // TODO: Add other AI-specific services, e.g., CommandProcessor if AI generates commands
    // /** @type {import('../../interfaces/ICommandProcessor.js').ICommandProcessor} */
    // #commandProcessor;


    /**
     * Creates an instance of AITurnHandler.
     * @param {object} deps
     * @param {ILogger} deps.logger - The logger service.
     * @param {object} [deps.gameWorldAccess={}] - Access to the game world.
     * @param {ITurnEndPort} deps.turnEndPort - Port to notify on turn end.
     * // TODO: Add other AI-specific dependencies:
     * // @param {AIService} deps.aiService
     * // @param {import('../../interfaces/ICommandProcessor.js').ICommandProcessor} [deps.commandProcessor]
     */
    constructor({
                    logger,
                    gameWorldAccess = {},
                    turnEndPort,
                    // aiService, // Example
                    // commandProcessor // Example
                }) {
        // 1. Call super() first
        super({logger});

        // 2. 'this' is now available. Validate derived dependencies
        if (!gameWorldAccess) throw new Error('AITurnHandler: gameWorldAccess is required.');
        if (!turnEndPort) throw new Error('AITurnHandler: turnEndPort is required.');
        // if (!aiService) throw new Error('AITurnHandler: aiService is required.');

        // 3. Assign derived dependencies
        this.#gameWorldAccess = gameWorldAccess;
        this.#turnEndPort = turnEndPort;
        // this.#aiService = aiService;
        // this.#commandProcessor = commandProcessor;

        // 4. Create the initial state, passing 'this'
        const initialState = new TurnIdleState(this);

        // 5. Set the initial state
        this._setInitialState(initialState);

        this._logger.debug(`${this.constructor.name} initialised. Dependencies assigned. Initial state set.`);
    }

    /**
     * @override
     * Initiates a turn for the AI-controlled actor. Creates and sets ITurnContext.
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
        this._logger.info(`${this.constructor.name}.startTurn for AI actor ${actor.id}.`);

        // TODO: AI will need its own strategy for decision making.
        // This strategy would be part of the services or constructed here.
        // Example: const aiStrategy = new AIPlayerStrategy({ aiService: this.#aiService, actor });

        /** @type {TurnContextServices} */
        const servicesForContext = {
            // PlayerPromptService is typically not for AI.
            // AI might need a different way to "output" its decisions or actions if logging isn't enough.
            game: this.#gameWorldAccess,
            // commandProcessor: this.#commandProcessor, // If AI generates commands string/objects
            // commandOutcomeInterpreter: this.#commandOutcomeInterpreter, // If AI uses same command flow
            // safeEventDispatcher: this.#safeEventDispatcher, // If AI needs to dispatch events
            // subscriptionManager: this.#subscriptionManager, // If AI needs to subscribe to events
            turnEndPort: this.#turnEndPort,
            // AI specific services could be added here, or accessed by an AIStrategy from its own dependencies.
            // For example, an `aiService` could be passed if the AI states/strategies need it directly from context.
            // However, it's often cleaner for the AIPlayerStrategy to encapsulate AI service interaction.
        };

        const newTurnContext = new TurnContext({ // Using the concrete TurnContext class
            actor: actor,
            logger: this._logger, // Or a child logger: this._logger.createChildLogger(...)
            services: servicesForContext,
            onEndTurnCallback: (errorOrNull) => this._handleTurnEnd(actor.id, errorOrNull),
            // AI might not use the same external event provider as Player, or might have its own.
            // For a simple AI, it might always be false (it decides and acts within its turn).
            // If AI calls an async service (e.g., LLM API), this might become true.
            isAwaitingExternalEventProvider: () => false, // Placeholder, AI might have its own logic
            // AI might not use this specific flag marking. Provide a no-op or AI-specific logic.
            onSetAwaitingExternalEventCallback: (isAwaiting, anActorId) => {
                this._logger.debug(`AITurnHandler: setAwaitingExternalEvent called for ${anActorId} with ${isAwaiting}. AI handling TBD.`);
            },
            handlerInstance: this // Pass the handler instance itself
        });
        this._setCurrentTurnContextInternal(newTurnContext);

        this._logger.debug(`${this.constructor.name}: TurnContext created for AI actor ${actor.id}.`);

        // Delegate to current state (TurnIdleState initially).
        // The state receives 'this' (AITurnHandler instance) as its handler context.
        // States will then use handler.getTurnContext() to get the ITurnContext.
        // An AI-specific state (e.g., AIThinkingState) might be transitioned to by TurnIdleState
        // or a subsequent state, using the ITurnContext to interact with AI decision logic.
        try {
            await this._currentState.startTurn(this, actor);
            // For a stub, we might want to immediately log that the turn is not fully implemented
            // or even end the turn if no AI states are ready.
            this._logger.warn(`${this.constructor.name}: AI turn processing logic is a STUB for actor ${actor.id}. Turn may not proceed meaningfully without AI-specific states/strategies.`);
            // Example: If AI has no actions, it might immediately end its turn.
            // This would typically be handled by an AI's "decide action" state/strategy.
            // For this refactor, ensuring context is provided is key.
            // if (this.getTurnContext()) { // Check if context is still valid
            //    this.getTurnContext().endTurn(new Error("AI turn not fully implemented."));
            // }
        } catch (error) {
            this._logger.error(`${this.constructor.name}: Error during AI startTurn for actor ${actor.id}: ${error.message}`, error);
            if (this.getTurnContext()) {
                this.getTurnContext().endTurn(error);
            } else {
                this._handleTurnEnd(actor.id, error); // Fallback if context was lost
            }
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
        // if (this.#aiService && typeof this.#aiService.shutdown === 'function') {
        //     await this.#aiService.shutdown();
        //     this._logger.debug(`${this.constructor.name}: AI service shut down.`);
        // }

        // BaseTurnHandler.destroy() will handle current state's destroy, reset resources, and transition to Idle.
        await super.destroy();
        this._logger.debug(`${this.constructor.name}.destroy() AI-specific handling complete.`);
    }


    /**
     * @override
     * AI-specific resource reset, if any, beyond what BaseTurnHandler does.
     * Called by BaseTurnHandler._resetTurnStateAndResources.
     * @param {string} [actorIdContextForLog='N/A']
     */
    _resetTurnStateAndResources(actorIdContextForLog = 'N/A') {
        super._resetTurnStateAndResources(actorIdContextForLog); // Calls base class method first
        this._logger.debug(`${this.constructor.name}: AI-specific resources reset for '${actorIdContextForLog}'. (Currently a stub - no additional AI specific resources to reset here).`);
        // TODO: Reset any AI-specific flags or states here if they live directly on AITurnHandler
        // and are not part of the ITurnContext or managed by BaseTurnHandler.
    }

    // --- AI-Specific Lifecycle Hooks (Optional Overrides from BaseTurnHandler) ---
    // /**
    //  * @override
    //  * @param {ITurnState} currentState
    //  * @param {ITurnState | undefined} [previousState]
    //  */
    // async onEnterState(currentState, previousState) {
    //     await super.onEnterState(currentState, previousState); // Call base behavior
    //     this._logger.debug(`${this.constructor.name} specific onEnterState for AI: ${currentState.getStateName()}`);
    //     // AI-specific logic on entering a state, if any.
    // }

    // /**
    //  * @override
    //  * @param {ITurnState} currentState
    //  * @param {ITurnState | undefined} [nextState]
    //  */
    // async onExitState(currentState, nextState) {
    //     await super.onExitState(currentState, nextState); // Call base behavior
    //     this._logger.debug(`${this.constructor.name} specific onExitState for AI: ${currentState.getStateName()}`);
    //     // AI-specific logic on exiting a state, if any.
    // }
}

export default AITurnHandler;