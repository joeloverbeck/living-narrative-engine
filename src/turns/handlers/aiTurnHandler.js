// src/core/turns/handlers/aiTurnHandler.js
// ──────────────────────────────────────────────────────────────────────────────
//  AITurnHandler Class
// ──────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {import('../../entities/entity.js').default} Entity
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../ports/ITurnEndPort.js').ITurnEndPort} ITurnEndPort
 * @typedef {import('../interfaces/ILLMAdapter.js').ILLMAdapter} ILLMAdapter
 * @typedef {import('../strategies/aiPlayerStrategy.js').AIPlayerStrategy} AIPlayerStrategy_Instance // Renamed for clarity
 * @typedef {import('../interfaces/ITurnContext.js').ITurnContext} ITurnContext
 * @typedef {import('../states/turnIdleState.js').TurnIdleState} TurnIdleState // For type hinting initial state
 * @typedef {import('../../commands/interfaces/ICommandProcessor.js').ICommandProcessor} ICommandProcessor
 * @typedef {import('../../commands/interfaces/ICommandOutcomeInterpreter.js').ICommandOutcomeInterpreter} ICommandOutcomeInterpreter
 * @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher
 * @typedef {import('../../services/subscriptionLifecycleManager.js').default} SubscriptionLifecycleManager
 * @typedef {import('../context/turnContext.js').TurnContextServices} TurnContextServices
 * @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager
 * @typedef {import('../../interfaces/IActionDiscoverySystem.js').IActionDiscoverySystem} IActionDiscoverySystem
 */

import {BaseTurnHandler} from './baseTurnHandler.js';
import {TurnIdleState as ConcreteTurnIdleState} from '../states/turnIdleState.js';
// Import AIPlayerStrategy for instantiation
import {AIPlayerStrategy} from '../strategies/aiPlayerStrategy.js';
import {TurnContext} from '../context/turnContext.js'; // Concrete TurnContext for instantiation

// --- NEW IMPORTS ---
import {AIGameStateProvider} from '../services/AIGameStateProvider.js';
import {AIPromptFormatter} from '../services/AIPromptFormatter.js';
import {LLMResponseProcessor} from '../services/LLMResponseProcessor.js';


/**
 * @class AITurnHandler
 * @extends BaseTurnHandler
 * @description
 * Handles turns for AI-controlled actors. It initializes with necessary dependencies
 * for AI decision-making and turn management, extending BaseTurnHandler for core
 * state machine functionality.
 */
export class AITurnHandler extends BaseTurnHandler {
    /** @type {ITurnEndPort} */
    #turnEndPort;
    /** @type {object} */ // Placeholder for more specific game world access type
    #gameWorldAccess;
    /** @type {ILLMAdapter} */
    #illmAdapter;
    /** @type {ICommandProcessor} */
    #commandProcessor;
    /** @type {ICommandOutcomeInterpreter} */
    #commandOutcomeInterpreter;
    /** @type {ISafeEventDispatcher} */
    #safeEventDispatcher;
    /** @type {SubscriptionLifecycleManager} */
    #subscriptionManager;

    /** @type {IActionDiscoverySystem} */
    #actionDiscoverySystem;

    // --- NEW: Flags for managing external AI response waiting ---
    /** @private @type {boolean} */
    #aiIsAwaitingExternalEvent = false;
    /** @private @type {string|null} */
    #aiAwaitingExternalEventForActorId = null;

    /** @type {IEntityManager} */
    #entityManager;

    // --- END NEW ---


    /**
     * Creates an instance of AITurnHandler.
     * @param {object} dependencies - The dependencies required by the handler.
     * @param {ILogger} dependencies.logger - The logging service.
     * @param {ITurnEndPort} dependencies.turnEndPort - Port for notifying when a turn ends.
     * @param {object} dependencies.gameWorldAccess - Service or object providing access to game world data.
     * @param {ILLMAdapter} dependencies.illmAdapter - Adapter for communicating with the Large Language Model for AI decisions.
     * @param {ICommandProcessor} dependencies.commandProcessor - Service to process commands.
     * @param {ICommandOutcomeInterpreter} dependencies.commandOutcomeInterpreter - Service to interpret command outcomes.
     * @param {ISafeEventDispatcher} dependencies.safeEventDispatcher - Service for dispatching events safely.
     * @param {SubscriptionLifecycleManager} dependencies.subscriptionManager - Service to manage subscriptions.
     * @param {IEntityManager} dependencies.entityManager - Service for managing entities.
     * @param {IActionDiscoverySystem} dependencies.actionDiscoverySystem - Service for discovering available actions.
     * @throws {Error} If any required dependency is missing or invalid.
     */
    constructor({
                    logger,
                    turnEndPort,
                    gameWorldAccess,
                    illmAdapter,
                    commandProcessor,
                    commandOutcomeInterpreter,
                    safeEventDispatcher,
                    subscriptionManager,
                    entityManager,
                    actionDiscoverySystem,
                }) {
        // 1. Call super() first with base dependencies
        super({logger});

        // 2. 'this' is now available. Validate derived dependencies.
        if (!turnEndPort || typeof turnEndPort.notifyTurnEnded !== 'function') {
            const errorMsg = `${this.constructor.name} Constructor: Invalid or missing ITurnEndPort dependency.`;
            this._logger.error(errorMsg, {turnEndPort});
            throw new Error(errorMsg);
        }
        if (!gameWorldAccess) { // Basic check, can be refined if gameWorldAccess has a specific interface
            const errorMsg = `${this.constructor.name} Constructor: Missing gameWorldAccess dependency.`;
            this._logger.error(errorMsg, {gameWorldAccess});
            throw new Error(errorMsg);
        }
        if (!illmAdapter || typeof illmAdapter.generateAction !== 'function') {
            const errorMsg = `${this.constructor.name} Constructor: Invalid or missing ILLMAdapter dependency.`;
            this._logger.error(errorMsg, {illmAdapter});
            throw new Error(errorMsg);
        }
        if (!commandProcessor || typeof commandProcessor.processCommand !== 'function') {
            const errorMsg = `${this.constructor.name} Constructor: Invalid or missing ICommandProcessor dependency.`;
            this._logger.error(errorMsg, {commandProcessor});
            throw new Error(errorMsg);
        }
        if (!commandOutcomeInterpreter || typeof commandOutcomeInterpreter.interpret !== 'function') {
            const errorMsg = `${this.constructor.name} Constructor: Invalid or missing ICommandOutcomeInterpreter dependency.`;
            this._logger.error(errorMsg, {commandOutcomeInterpreter});
            throw new Error(errorMsg);
        }
        if (!safeEventDispatcher || typeof safeEventDispatcher.dispatchSafely !== 'function') {
            const errorMsg = `${this.constructor.name} Constructor: Invalid or missing ISafeEventDispatcher dependency.`;
            this._logger.error(errorMsg, {safeEventDispatcher});
            throw new Error(errorMsg);
        }
        if (!subscriptionManager || typeof subscriptionManager.subscribeToTurnEnded !== 'function') { // Example check
            const errorMsg = `${this.constructor.name} Constructor: Invalid or missing SubscriptionLifecycleManager dependency.`;
            this._logger.error(errorMsg, {subscriptionManager});
            throw new Error(errorMsg);
        }
        if (!entityManager || typeof entityManager.getEntityInstance !== 'function') { // <<< ADD VALIDATION
            const errorMsg = `${this.constructor.name} Constructor: Invalid or missing IEntityManager dependency.`;
            this._logger.error(errorMsg, {entityManager});
            throw new Error(errorMsg);
        }
        if (!actionDiscoverySystem || typeof actionDiscoverySystem.getValidActions !== 'function') {
            const errorMsg = `${this.constructor.name} Constructor: Invalid or missing IActionDiscoverySystem dependency.`;
            this._logger.error(errorMsg, {actionDiscoverySystem});
            throw new Error(errorMsg);
        }


        // 3. Assign derived dependencies to private fields
        this.#turnEndPort = turnEndPort;
        this.#gameWorldAccess = gameWorldAccess;
        this.#illmAdapter = illmAdapter;
        this.#commandProcessor = commandProcessor;
        this.#commandOutcomeInterpreter = commandOutcomeInterpreter;
        this.#safeEventDispatcher = safeEventDispatcher;
        this.#subscriptionManager = subscriptionManager;
        this.#entityManager = entityManager;
        this.#actionDiscoverySystem = actionDiscoverySystem;

        // --- NEW: Initialize AI waiting flags ---
        this.#aiIsAwaitingExternalEvent = false;
        this.#aiAwaitingExternalEventForActorId = null;
        // --- END NEW ---

        // 4. Create the initial state, passing 'this' (the handler instance)
        const initialState = new ConcreteTurnIdleState(this);

        // 5. Set the initial state using the protected method from BaseTurnHandler
        this._setInitialState(initialState);

        this._logger.debug(`${this.constructor.name} initialized successfully. Dependencies assigned. Initial state set to ${initialState.getStateName()}.`);
    }

    // --- NEW: Methods for ITurnContext callbacks regarding external event waiting ---
    /**
     * Provider function for ITurnContext to check if the AI handler is awaiting an external event.
     * @returns {boolean} True if awaiting, false otherwise.
     * @private
     */
    _getAIIsAwaitingExternalEventFlag() {
        const currentActorInContext = this.getTurnContext()?.getActor();
        // Only return true if the flag is set AND it's for the actor of the current context
        if (this.#aiIsAwaitingExternalEvent && this.#aiAwaitingExternalEventForActorId === currentActorInContext?.id) {
            return true;
        }
        // If the flag is set but for a different actor (e.g., stale context), log a warning but return false for this context.
        if (this.#aiIsAwaitingExternalEvent && this.#aiAwaitingExternalEventForActorId !== currentActorInContext?.id) {
            this._logger.warn(`${this.constructor.name}._getAIIsAwaitingExternalEventFlag: Flag is true for ${this.#aiAwaitingExternalEventForActorId}, but current context actor is ${currentActorInContext?.id}. Returning false for this context.`);
        }
        return false;
    }

    /**
     * Callback function for ITurnContext to set the AI handler's awaiting state.
     * @param {boolean} isAwaiting - True if the handler should mark itself as waiting.
     * @param {string} actorId - The ID of the actor for whom the wait is being set.
     * @private
     */
    _setAIIsAwaitingExternalEventFlag(isAwaiting, actorId) {
        const currentActorInContext = this.getTurnContext()?.getActor();
        if (actorId !== currentActorInContext?.id) {
            this._logger.error(
                `${this.constructor.name}._setAIIsAwaitingExternalEventFlag: Attempt to set flag for actor ${actorId} ` +
                `but current context actor is ${currentActorInContext?.id}. This indicates a potential logic error. Flag state not changed for ${actorId}.`
            );
            return; // Do not change state if actor mismatch
        }

        const oldFlag = this.#aiIsAwaitingExternalEvent;
        const oldActorId = this.#aiAwaitingExternalEventForActorId;

        this.#aiIsAwaitingExternalEvent = !!isAwaiting; // Ensure boolean
        this.#aiAwaitingExternalEventForActorId = this.#aiIsAwaitingExternalEvent ? actorId : null;

        if (oldFlag !== this.#aiIsAwaitingExternalEvent || oldActorId !== this.#aiAwaitingExternalEventForActorId) {
            this._logger.debug(
                `${this.constructor.name}._setAIIsAwaitingExternalEventFlag: ` +
                `AI waiting flag for actor ${actorId} changed from ${oldFlag} (for ${oldActorId}) to ${this.#aiIsAwaitingExternalEvent}.`
            );
        }
    }

    // --- END NEW ---


    /**
     * @override
     * Initiates an AI actor's turn.
     * @param {Entity} actor - The AI entity whose turn is to be started.
     * @returns {Promise<void>}
     */
    async startTurn(actor) {
        this._logger.debug(`${this.constructor.name}.startTurn called for AI actor ${actor?.id}.`);
        super._assertHandlerActive(); // 1. Perform assertions to ensure the handler is active

        if (!actor || typeof actor.id !== 'string' || actor.id.trim() === '') { // 1. ...and the actor parameter is valid.
            this._logger.error(`${this.constructor.name}.startTurn: actor is required and must have a valid id.`);
            throw new Error(`${this.constructor.name}.startTurn: actor is required and must have a valid id.`);
        }
        this._logger.debug(`${this.constructor.name}.startTurn: Actor ${actor.id} validated.`);

        // 2. Set the current actor internally
        this._setCurrentActorInternal(actor);
        this._logger.debug(`${this.constructor.name}.startTurn: Current actor set to ${actor.id}.`);

        // 3. Instantiate new AI services
        // Note: Consider lifecycle. For now, new instances per turn/strategy.
        // If these become stateful or expensive, AITurnHandler might receive them via its own constructor.
        const gameStateProvider = new AIGameStateProvider();
        const promptFormatter = new AIPromptFormatter();
        const llmResponseProcessor = new LLMResponseProcessor();
        this._logger.debug(`${this.constructor.name}.startTurn: Instantiated AIGameStateProvider, AIPromptFormatter, LLMResponseProcessor for actor ${actor.id}.`);


        // 4. Instantiate AIPlayerStrategy with all dependencies
        const aiStrategy = new AIPlayerStrategy({
            llmAdapter: this.#illmAdapter, // Existing dependency from AITurnHandler's constructor
            gameStateProvider: gameStateProvider,
            promptFormatter: promptFormatter,
            llmResponseProcessor: llmResponseProcessor,
        });
        this._logger.debug(`${this.constructor.name}.startTurn: AIPlayerStrategy (with new dependencies) instantiated for actor ${actor.id}.`);

        // 5. Prepare a TurnContextServices bag
        /** @type {TurnContextServices} */
        const servicesForContext = {
            game: this.#gameWorldAccess,
            turnEndPort: this.#turnEndPort,
            commandProcessor: this.#commandProcessor,
            commandOutcomeInterpreter: this.#commandOutcomeInterpreter,
            safeEventDispatcher: this.#safeEventDispatcher,
            subscriptionManager: this.#subscriptionManager,
            entityManager: this.#entityManager,
            actionDiscoverySystem: this.#actionDiscoverySystem,
            // Note: playerPromptService is omitted as it's not typically used by AIs directly.
        };
        this._logger.debug(`${this.constructor.name}.startTurn: TurnContextServices bag prepared for actor ${actor.id}.`);

        // 6. Create a new TurnContext instance
        const newTurnContext = new TurnContext({
            actor: actor,
            logger: this._logger,
            services: servicesForContext,
            strategy: aiStrategy, // Pass the newly created strategy
            onEndTurnCallback: (errorOrNull) => this._handleTurnEnd(actor.id, errorOrNull),
            isAwaitingExternalEventProvider: this._getAIIsAwaitingExternalEventFlag.bind(this),
            onSetAwaitingExternalEventCallback: this._setAIIsAwaitingExternalEventFlag.bind(this),
            handlerInstance: this,
        });
        this._logger.debug(`${this.constructor.name}.startTurn: TurnContext created for AI actor ${actor.id}.`);

        // 7. Set this new context as the current turn context
        this._setCurrentTurnContextInternal(newTurnContext);
        this._logger.debug(`${this.constructor.name}.startTurn: New TurnContext set as current for actor ${actor.id}.`);

        // 8. Delegate to the current state's (initially TurnIdleState) startTurn(this, actor) method
        if (!this._currentState) {
            this._logger.error(`${this.constructor.name}.startTurn: Critical - _currentState is null before calling startTurn on it for actor ${actor.id}.`);
            throw new Error("AITurnHandler: _currentState is null, cannot start turn.");
        }
        this._logger.debug(`${this.constructor.name}.startTurn: Delegating to ${this._currentState.getStateName()}.startTurn for actor ${actor.id}.`);
        await this._currentState.startTurn(this, actor);
        this._logger.info(`${this.constructor.name}.startTurn: Turn initiation for AI actor ${actor.id} successfully delegated to current state.`);
    }

    /**
     * @override
     * AI-specific resource reset. Calls super and resets AI waiting flags.
     * @param {string} [logContext='N/A'] - Context for logging.
     */
    _resetTurnStateAndResources(logContext = 'N/A') {
        const currentActorIdForLog = this.getCurrentActor()?.id || 'UnknownActor';
        const effectiveLogContext = `${logContext}-AITurnHandler-${currentActorIdForLog}`;
        this._logger.debug(`${this.constructor.name}._resetTurnStateAndResources called for context: '${effectiveLogContext}'.`);

        // 1. Call base class reset first (clears _currentTurnContext and _currentActor on BaseTurnHandler)
        super._resetTurnStateAndResources(effectiveLogContext);

        // 2. Perform AI-specific resets
        const oldIsAwaiting = this.#aiIsAwaitingExternalEvent;
        const oldAwaitingActorId = this.#aiAwaitingExternalEventForActorId;

        this.#aiIsAwaitingExternalEvent = false;
        this.#aiAwaitingExternalEventForActorId = null;

        if (oldIsAwaiting || oldAwaitingActorId) { // Log only if there was something to reset
            this._logger.debug(
                `${this.constructor.name}: AI 'isAwaitingExternalEvent' flags reset. Was: ${oldIsAwaiting} for actor ${oldAwaitingActorId ?? 'N/A'}. Context: '${effectiveLogContext}'.`
            );
        }

        this._logger.debug(`${this.constructor.name}: AI-specific resource reset complete for context: '${effectiveLogContext}'.`);
    }


    /**
     * @override
     * Destroys the AITurnHandler, performing AI-specific cleanup before calling super.destroy().
     * @returns {Promise<void>}
     */
    async destroy() {
        // 1. Check if already destroyed
        if (this._isDestroyed) {
            this._logger.debug(`${this.constructor.name}.destroy() called but already destroyed.`);
            return;
        }
        // Log destruction attempt (BaseTurnHandler.destroy() will also log)
        this._logger.info(`${this.constructor.name}.destroy() invoked. Current state: ${this._currentState?.getStateName() ?? 'N/A'}.`);

        // 2. AI-specific cleanup (before super.destroy())
        // This is where you'd abort ongoing AI computations or release AI service handles, if any.
        // For example, if ILLMAdapter had a method to cancel requests:
        if (this.#illmAdapter && typeof this.#illmAdapter.cancelOngoingOperations === 'function') {
            this._logger.debug(`${this.constructor.name}: Attempting to cancel ILLMAdapter ongoing operations.`);
            try {
                // Assuming cancelOngoingOperations might be async or sync
                await Promise.resolve(this.#illmAdapter.cancelOngoingOperations());
                this._logger.debug(`${this.constructor.name}: ILLMAdapter ongoing operations cancelled.`);
            } catch (e) {
                this._logger.warn(`${this.constructor.name}: Error cancelling ILLMAdapter operations during destroy: ${e.message}`, e);
            }
        } else if (this.#illmAdapter) {
            this._logger.debug(`${this.constructor.name}: ILLMAdapter does not have a 'cancelOngoingOperations' method or it's not a function.`);
        }

        // Reset AI-specific flags as part of pre-super cleanup.
        // Although _resetTurnStateAndResources (called by super.destroy) would also clear them,
        // clearing them here ensures they are reset even if super.destroy() had an issue before calling it.
        const oldIsAwaiting = this.#aiIsAwaitingExternalEvent;
        const oldAwaitingActorId = this.#aiAwaitingExternalEventForActorId;
        this.#aiIsAwaitingExternalEvent = false;
        this.#aiAwaitingExternalEventForActorId = null;
        if (oldIsAwaiting || oldAwaitingActorId) {
            this._logger.debug(`${this.constructor.name} (destroy): AI waiting flags forcibly reset. Was: ${oldIsAwaiting} for actor ${oldAwaitingActorId ?? 'N/A'}.`);
        }


        // 3. Call super.destroy()
        // This handles the core cleanup: destroying current state, resetting base resources,
        // and ensuring transition to TurnIdleState.
        await super.destroy();

        // 4. Log completion of AI-specific destruction
        this._logger.debug(`${this.constructor.name}.destroy() AI-specific handling and super.destroy() call complete.`);
    }
}

export default AITurnHandler;