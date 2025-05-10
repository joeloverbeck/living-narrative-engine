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
 * @typedef {function(): boolean} IsAwaitingExternalEventProvider
 * @description Function that returns true if the turn is awaiting an external event.
 */
/**
 * @typedef {import('../../services/subscriptionLifecycleManager.js').default} SubscriptionLifecycleManager
 */
/**
 * @typedef {object} TurnContextServices
 * @property {IPlayerPromptService} [playerPromptService]
 * @property {GameWorld | object} [game] // Replace 'object' with a specific minimal game interface if applicable
 * @property {import('../../interfaces/ICommandProcessor.js').ICommandProcessor} [commandProcessor]
 * @property {import('../../interfaces/ICommandOutcomeInterpreter.js').ICommandOutcomeInterpreter} [commandOutcomeInterpreter]
 * @property {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} [safeEventDispatcher]
 * @property {SubscriptionLifecycleManager} [subscriptionManager]
 * @property {import('../../ports/ITurnEndPort.js').ITurnEndPort} [turnEndPort]
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

    /**
     * Creates an instance of TurnContext.
     * @param {object} params
     * @param {Entity} params.actor - The current actor whose turn is being processed.
     * @param {ILogger} params.logger - The logger instance for turn-specific logging.
     * @param {TurnContextServices} params.services - A bag of services accessible during the turn.
     * @param {OnEndTurnCallback} params.onEndTurnCallback - Callback to execute when endTurn() is called.
     * @param {IsAwaitingExternalEventProvider} params.isAwaitingExternalEventProvider - Function to check if awaiting an external event.
     */
    constructor({
                    actor,
                    logger,
                    services,
                    onEndTurnCallback,
                    isAwaitingExternalEventProvider
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

        this.#actor = actor;
        this.#logger = logger;
        this.#services = services; // Intentionally not freezing services itself, caller manages its immutability.
        this.#onEndTurnCallback = onEndTurnCallback;
        this.#isAwaitingExternalEventProvider = isAwaitingExternalEventProvider;

        if (Object.freeze && typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'production') {
            Object.freeze(this);
        }
    }

    /**
     * @override
     * @returns {Entity}
     */
    getActor() {
        return this.#actor;
    }

    /**
     * @override
     * @returns {ILogger}
     */
    getLogger() {
        return this.#logger;
    }

    /**
     * @override
     * @returns {IPlayerPromptService}
     * @throws {Error} If PlayerPromptService is not available.
     */
    getPlayerPromptService() {
        if (!this.#services.playerPromptService) {
            this.#logger.error("TurnContext: PlayerPromptService not available in services bag.");
            throw new Error("TurnContext: PlayerPromptService not available in services bag.");
        }
        return this.#services.playerPromptService;
    }

    /**
     * @override
     * @returns {GameWorld | object}
     * @throws {Error} If Game service/world is not available.
     */
    getGame() {
        if (!this.#services.game) {
            this.#logger.error("TurnContext: Game service/world not available in services bag.");
            throw new Error("TurnContext: Game service/world not available in services bag.");
        }
        return this.#services.game;
    }

    /**
     * Retrieves the SubscriptionLifecycleManager from the services bag.
     * @returns {SubscriptionLifecycleManager}
     * @throws {Error} If SubscriptionManager is not available.
     */
    getSubscriptionManager() {
        if (!this.#services.subscriptionManager) {
            this.#logger.error("TurnContext: SubscriptionManager not available in services bag.");
            throw new Error("TurnContext: SubscriptionManager not available in services bag.");
        }
        return this.#services.subscriptionManager;
    }

    /**
     * Retrieves the TurnEndPort from the services bag.
     * @returns {import('../../ports/ITurnEndPort.js').ITurnEndPort}
     * @throws {Error} If TurnEndPort is not available.
     */
    getTurnEndPort() {
        if (!this.#services.turnEndPort) {
            this.#logger.error("TurnContext: TurnEndPort not available in services bag.");
            throw new Error("TurnContext: TurnEndPort not available in services bag.");
        }
        return this.#services.turnEndPort;
    }

    /**
     * @override
     * @param {Error | null} [errorOrNull]
     * @returns {void}
     */
    endTurn(errorOrNull = null) {
        this.#onEndTurnCallback(errorOrNull);
    }

    /**
     * @override
     * @returns {boolean}
     */
    isAwaitingExternalEvent() {
        return this.#isAwaitingExternalEventProvider();
    }

    /**
     * Creates a new TurnContext instance for a different actor, sharing the same logger,
     * services, and lifecycle callbacks as the original context.
     * @param {Entity} newActor - The new actor for whom to create the context.
     * @returns {TurnContext} A new TurnContext instance.
     */
    cloneForActor(newActor) {
        if (!newActor) {
            throw new Error('TurnContext.cloneForActor: newActor is required.');
        }
        return new TurnContext({
            actor: newActor,
            logger: this.#logger,
            services: this.#services, // Services bag is shared by reference
            onEndTurnCallback: this.#onEndTurnCallback, // Callback is shared
            isAwaitingExternalEventProvider: this.#isAwaitingExternalEventProvider // Provider is shared
        });
    }
}

// --- FILE END ---