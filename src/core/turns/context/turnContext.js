// src/core/turns/context/turnContext.js
// --- FILE START ---
/**
 * @typedef {import('../../../entities/entity.js').default} Entity
 * @description Represents an entity in the game, such as a player or NPC.
 */
/**
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 * @description Defines the interface for a logging service.
 */
/**
 * @typedef {import('../../interfaces/IPlayerPromptService.js').IPlayerPromptService} IPlayerPromptService
 * @description Defines the interface for a service that handles player prompts.
 */
/**
 * @typedef {import('../../game/GameWorld.js').GameWorld} GameWorld
 * // Or a more specific/minimal interface if GameWorld is too broad
 * @description Represents the game world or a minimal interface to it.
 */
/**
 * @typedef {function(Error | null): void} OnEndTurnCallback
 * @description Callback function to signal the end of a turn.
 */
/**
 * @typedef {import('../handlers/baseTurnHandler.js').BaseTurnHandler} BaseTurnHandler
 */
/**
 * @typedef {function(): boolean} IsAwaitingExternalEventProvider
 * @description Function that returns true if the turn is awaiting an external event.
 */
/**
 * @typedef {function(boolean, string): void} OnSetAwaitingExternalEventCallback
 */
/**
 * @typedef {import('../../services/subscriptionLifecycleManager.js').default} SubscriptionLifecycleManager
 */
/**
 * @typedef {import('../../interfaces/ICommandProcessor.js').ICommandProcessor} ICommandProcessor
 */
/**
 * @typedef {import('../../interfaces/ICommandOutcomeInterpreter.js').ICommandOutcomeInterpreter} ICommandOutcomeInterpreter
 */
/**
 * @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher
 */
/**
 * @typedef {import('../../ports/ITurnEndPort.js').ITurnEndPort} ITurnEndPort
 */

/**
 * @typedef {object} TurnContextServices
 * @property {IPlayerPromptService} [playerPromptService]
 * @property {GameWorld | object} [game] // Replace 'object' with a specific minimal game interface if applicable
 * @property {ICommandProcessor} [commandProcessor]
 * @property {ICommandOutcomeInterpreter} [commandOutcomeInterpreter]
 * @property {ISafeEventDispatcher} [safeEventDispatcher]
 * @property {SubscriptionLifecycleManager} [subscriptionManager]
 * @property {ITurnEndPort} [turnEndPort]
 * // Add other services as needed by ITurnContext methods
 */

import {ITurnContext} from '../interfaces/ITurnContext.js';

/**
 * @class TurnContext
 * @implements {ITurnContext}
 * @description
 * Concrete implementation of ITurnContext. Provides a lightweight, per-turn
 * container for essential data (like the current actor) and services (like logging,
 * player prompts, game world access) needed by turn states and strategies.
 * It aims to decouple turn logic from specific turn handler implementations.
 */
export class TurnContext extends ITurnContext {
    /** @type {Entity} */
    #actor;
    /** @type {ILogger} */
    #logger;
    /** @type {TurnContextServices} */
    #services;
    /** @type {OnEndTurnCallback} */
    #onEndTurnCallback;
    /** @type {IsAwaitingExternalEventProvider} */
    #isAwaitingExternalEventProvider;
    /** @type {OnSetAwaitingExternalEventCallback} */
    #onSetAwaitingExternalEventCallback; // Added
    /** @type {BaseTurnHandler} */
    #handlerInstance; // To facilitate state transitions

    /**
     * Creates an instance of TurnContext.
     * @param {object} params
     * @param {Entity} params.actor - The current actor whose turn is being processed.
     * @param {ILogger} params.logger - The logger instance for turn-specific logging.
     * @param {TurnContextServices} params.services - A bag of services accessible during the turn.
     * @param {OnEndTurnCallback} params.onEndTurnCallback - Callback to execute when endTurn() is called.
     * @param {IsAwaitingExternalEventProvider} params.isAwaitingExternalEventProvider - Function to check if awaiting an external event.
     * @param {OnSetAwaitingExternalEventCallback} params.onSetAwaitingExternalEventCallback - Callback to inform handler to set its waiting flag.
     * @param {BaseTurnHandler} params.handlerInstance - The turn handler instance for requesting transitions.
     */
    constructor({
                    actor,
                    logger,
                    services,
                    onEndTurnCallback,
                    isAwaitingExternalEventProvider, // Keep this one
                    onSetAwaitingExternalEventCallback, // Added
                    handlerInstance // Added
                }) {
        super();

        if (!actor) {
            throw new Error('TurnContext: actor is required.');
        }
        if (!logger) {
            throw new Error('TurnContext: logger is required.');
        }
        if (!services) {
            throw new Error('TurnContext: services bag is required (can be an empty object).');
        }
        if (typeof onEndTurnCallback !== 'function') {
            throw new Error('TurnContext: onEndTurnCallback function is required.');
        }
        if (typeof isAwaitingExternalEventProvider !== 'function') {
            throw new Error('TurnContext: isAwaitingExternalEventProvider function is required.');
        }
        if (typeof onSetAwaitingExternalEventCallback !== 'function') { // Added check
            throw new Error('TurnContext: onSetAwaitingExternalEventCallback function is required.');
        }
        if (!handlerInstance) { // Added check
            throw new Error('TurnContext: handlerInstance (BaseTurnHandler) is required for transitions.');
        }

        this.#actor = actor;
        this.#logger = logger;
        this.#services = services;
        this.#onEndTurnCallback = onEndTurnCallback;
        this.#isAwaitingExternalEventProvider = isAwaitingExternalEventProvider;
        this.#onSetAwaitingExternalEventCallback = onSetAwaitingExternalEventCallback; // Store it
        this.#handlerInstance = handlerInstance;

        // Freezing in production is a good practice but commented out for brevity during dev/example.
        // if (Object.freeze && typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'production') {
        //     Object.freeze(this);
        // }
    }

    /** @override */
    getActor() {
        return this.#actor;
    }

    /** @override */
    getLogger() {
        return this.#logger;
    }

    /** @override */
    getPlayerPromptService() {
        if (!this.#services.playerPromptService) {
            this.#logger.error("TurnContext: PlayerPromptService not available in services bag.");
            throw new Error("TurnContext: PlayerPromptService not available in services bag.");
        }
        return this.#services.playerPromptService;
    }

    /** @override */
    getGame() {
        if (!this.#services.game) {
            this.#logger.error("TurnContext: Game service/world not available in services bag.");
            throw new Error("TurnContext: Game service/world not available in services bag.");
        }
        return this.#services.game;
    }

    /** @override */
    getCommandProcessor() {
        if (!this.#services.commandProcessor) {
            this.#logger.error("TurnContext: CommandProcessor not available in services bag.");
            throw new Error("TurnContext: CommandProcessor not available in services bag.");
        }
        return this.#services.commandProcessor;
    }

    /** @override */
    getCommandOutcomeInterpreter() {
        if (!this.#services.commandOutcomeInterpreter) {
            this.#logger.error("TurnContext: CommandOutcomeInterpreter not available in services bag.");
            throw new Error("TurnContext: CommandOutcomeInterpreter not available in services bag.");
        }
        return this.#services.commandOutcomeInterpreter;
    }

    /** @override */
    getSafeEventDispatcher() {
        if (!this.#services.safeEventDispatcher) {
            this.#logger.error("TurnContext: SafeEventDispatcher not available in services bag.");
            throw new Error("TurnContext: SafeEventDispatcher not available in services bag.");
        }
        return this.#services.safeEventDispatcher;
    }

    /** @override */
    getSubscriptionManager() {
        if (!this.#services.subscriptionManager) {
            this.#logger.error("TurnContext: SubscriptionManager not available in services bag.");
            throw new Error("TurnContext: SubscriptionManager not available in services bag.");
        }
        return this.#services.subscriptionManager;
    }

    /** @override */
    getTurnEndPort() {
        if (!this.#services.turnEndPort) {
            this.#logger.error("TurnContext: TurnEndPort not available in services bag.");
            throw new Error("TurnContext: TurnEndPort not available in services bag.");
        }
        return this.#services.turnEndPort;
    }

    /** @override */
    endTurn(errorOrNull = null) {
        this.#onEndTurnCallback(errorOrNull);
    }

    /** @override */
    isAwaitingExternalEvent() {
        return this.#isAwaitingExternalEventProvider();
    }

    /**
     * Creates a new TurnContext instance for a different actor, sharing the same logger,
     * services, and lifecycle callbacks as the original context.
     * @param {Entity} newActor - The new actor for whom to create the context.
     * @returns {TurnContext} A new TurnContext instance.
     * @deprecated This method might lead to state inconsistencies if services or callbacks are actor-specific.
     * Prefer creating a new TurnContext with fresh, actor-appropriate dependencies.
     */
    cloneForActor(newActor) {
        this.#logger.warn("TurnContext.cloneForActor is deprecated. Prefer creating a new TurnContext with actor-specific dependencies.");
        if (!newActor) {
            throw new Error('TurnContext.cloneForActor: newActor is required.');
        }
        // Cloning handlerInstance by reference is correct here as it's the same handler.
        return new TurnContext({
            actor: newActor,
            logger: this.#logger,
            services: this.#services, // Services bag is shared by reference - potential issue
            onEndTurnCallback: this.#onEndTurnCallback, // Callback is shared - potential issue
            isAwaitingExternalEventProvider: this.#isAwaitingExternalEventProvider,
            onSetAwaitingExternalEventCallback: this.#onSetAwaitingExternalEventCallback, // Share callback
            handlerInstance: this.#handlerInstance // Share handler instance
        });
    }

    /** @override */
    async requestTransition(StateClass, constructorArgs = []) {
        const NewStateInstance = new StateClass(this.#handlerInstance, ...constructorArgs);
        await this.#handlerInstance._transitionToState(NewStateInstance);
    }

    /** @override */
    setAwaitingExternalEvent(isAwaiting, actorId) {
        this.#onSetAwaitingExternalEventCallback(isAwaiting, actorId);
    }
}

// --- FILE END ---