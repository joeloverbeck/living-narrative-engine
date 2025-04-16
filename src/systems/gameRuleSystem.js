// src/systems/gameRuleSystem.js

/** @typedef {import('../core/eventBus.js').default} EventBus */
/** @typedef {import('../core/gameStateManager.js').default} GameStateManager */
/** @typedef {import('../actions/actionExecutor.js').default} ActionExecutor */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../core/dataManager.js').default} DataManager */
/** @typedef {import('../entities/entity.js').default} Entity */

/** @typedef {import('../actions/actionTypes.js').ActionContext} ActionContext */


import {EVENT_ENTITY_MOVED} from "../types/eventTypes.js";

/**
 * Manages overarching game rules, potentially including time progression,
 * environmental effects, recurring checks, or other systemic behaviors
 * not directly tied to specific entity actions or location-based triggers.
 *
 * **Includes hardcoded rules like automatic 'look' on game start and player movement.**
 */
class GameRuleSystem {
    #eventBus;
    #gameStateManager;
    #actionExecutor;
    #entityManager;
    #dataManager;

    /**
     * @param {object} options Container for dependencies.
     * @param {EventBus} options.eventBus The central event bus.
     * @param {GameStateManager} options.gameStateManager Manages the overall game state.
     * @param {ActionExecutor} options.actionExecutor Executes game actions.
     * @param {EntityManager} options.entityManager Manages game entities and components.
     * @param {DataManager} options.dataManager Provides access to game data definitions.
     * @throws {Error} If any required dependency is missing.
     */
    constructor(options) {
        if (!options) {
            throw new Error("GameRuleSystem constructor requires an options object.");
        }
        const {eventBus, gameStateManager, actionExecutor, entityManager, dataManager} = options;

        // --- Dependency Validation (AC 4) ---
        if (!eventBus) throw new Error("GameRuleSystem requires options.eventBus.");
        if (!gameStateManager) throw new Error("GameRuleSystem requires options.gameStateManager.");
        if (!actionExecutor) throw new Error("GameRuleSystem requires options.actionExecutor.");
        if (!entityManager) throw new Error("GameRuleSystem requires options.entityManager.");
        if (!dataManager) throw new Error("GameRuleSystem requires options.dataManager.");

        this.#eventBus = eventBus;
        this.#gameStateManager = gameStateManager;
        this.#actionExecutor = actionExecutor;
        this.#entityManager = entityManager;
        this.#dataManager = dataManager;

        console.log("GameRuleSystem: Instance created.");
    }

    /**
     * Initializes the GameRuleSystem by subscribing to events needed for
     * built-in game rules (like auto-look).
     * (AC 3)
     */
    initialize() {
        console.log("GameRuleSystem: Initializing subscriptions for game rules...");

        // --- Subscribe Handlers for Built-in Rules ---
        // Handler for the *initial* game start look
        this.#eventBus.subscribe('event:room_entered', this.#handleInitialRoomEntered.bind(this));
        console.log("GameRuleSystem: Subscribed #handleInitialRoomEntered to 'event:room_entered' for initial auto-look.");

        // Handler for subsequent player moves (look after move)
        this.#eventBus.subscribe(EVENT_ENTITY_MOVED, this.#handlePlayerMovedLook.bind(this));
        console.log("GameRuleSystem: Subscribed #handlePlayerMovedLook to '" + EVENT_ENTITY_MOVED + "' for post-move auto-look.");

        // Future logic like turn progression subscriptions would go here.
        // Example: this.#eventBus.subscribe('core:turn_ended', this.#handleTurnEnd.bind(this));

        console.log("GameRuleSystem: Initialization complete.");
    }

    /**
     * Handles the 'event:room_entered' event specifically for the initial game load scenario.
     * If the previousLocation is null/undefined, it triggers an automatic 'look' action.
     * (AC 1)
     * @private
     * @param {{ newLocation: Entity, playerEntity: Entity, previousLocation?: Entity | null }} eventData
     */
    async #handleInitialRoomEntered(eventData) {
        const {newLocation, playerEntity, previousLocation} = eventData;

        if (!newLocation || !playerEntity) {
            console.error("GameRuleSystem #handleInitialRoomEntered: Received 'event:room_entered' but newLocation or playerEntity was missing.", eventData);
            return;
        }

        // Check if this is the initial entry (no previous location)
        if (previousLocation === null || previousLocation === undefined) {
            console.log("GameRuleSystem: Initial game load detected (no previousLocation). Triggering initial 'look'.");

            /** @type {ActionContext} */
            const lookContext = {
                playerEntity: playerEntity,
                currentLocation: newLocation,
                parsedCommand: {
                    actionId: 'core:look',
                    directObjectPhrase: null,
                    preposition: null,
                    indirectObjectPhrase: null,
                    originalInput: '[AUTO_LOOK_INITIAL]', // Indicate source
                    error: null
                },
                dataManager: this.#dataManager,
                entityManager: this.#entityManager,
                dispatch: this.#eventBus.dispatch.bind(this.#eventBus),
                eventBus: this.#eventBus
            };

            try {
                const lookResult = await this.#actionExecutor.executeAction('core:look', lookContext);
                if (!lookResult.success) {
                    console.warn(`GameRuleSystem: Initial 'core:look' execution reported failure. Messages:`, lookResult.messages);
                } else {
                    console.log(`GameRuleSystem: Initial 'core:look' executed successfully.`);
                }
            } catch (error) {
                console.error("GameRuleSystem: Uncaught error executing initial 'core:look':", error);
                this.#eventBus.dispatch('ui:message_display', {
                    text: "Internal Error: Failed to perform initial look.",
                    type: 'error'
                });
            }
        }
        // No 'else' needed - subsequent moves are handled by #handlePlayerMovedLook
    }

    /**
     * Handles the EVENT_ENTITY_MOVED event, specifically for the player.
     * Updates the game state's current location and triggers an automatic 'look'.
     * (AC 2)
     * @private
     * @param {{ entityId: string, newLocationId: string, oldLocationId: string | null }} eventData
     */
    async #handlePlayerMovedLook(eventData) {
        const {entityId, newLocationId} = eventData;
        const player = this.#gameStateManager.getPlayer();

        // Only act if the moved entity is the player
        if (!player || entityId !== player.id) {
            return;
        }

        console.log(`GameRuleSystem: Player moved to ${newLocationId}. Handling post-move auto-look.`);

        // Fetch the new location entity instance
        const newLocationEntity = this.#entityManager.getEntityInstance(newLocationId);

        if (!newLocationEntity) {
            console.error(`GameRuleSystem: Failed to find instance for location ${newLocationId}! Cannot proceed with post-move logic.`);
            this.#eventBus.dispatch('ui:message_display', {
                text: `Critical Error: Cannot process arrival at ${newLocationId}. Location data might be missing or corrupted.`,
                type: 'error'
            });
            return;
        }

        // Update GameStateManager's current location *before* looking
        this.#gameStateManager.setCurrentLocation(newLocationEntity);
        console.log(`GameRuleSystem: Updated GameStateManager's current location to ${newLocationId}.`);

        // Trigger Automatic 'Look'
        console.log(`GameRuleSystem: Triggering automatic 'look' for player in ${newLocationId}.`);
        /** @type {ActionContext} */
        const lookContext = {
            playerEntity: player,
            currentLocation: newLocationEntity,
            parsedCommand: {
                actionId: 'core:look',
                directObjectPhrase: null,
                preposition: null,
                indirectObjectPhrase: null,
                originalInput: '[AUTO_LOOK_MOVE]', // Indicate source
                error: null
            },
            dataManager: this.#dataManager,
            entityManager: this.#entityManager,
            dispatch: this.#eventBus.dispatch.bind(this.#eventBus),
            eventBus: this.#eventBus
        };

        try {
            const lookResult = await this.#actionExecutor.executeAction('core:look', lookContext);
            if (!lookResult.success) {
                console.warn(`GameRuleSystem: Automatic 'core:look' after move reported failure. Messages:`, lookResult.messages);
            } else {
                console.log(`GameRuleSystem: Automatic 'core:look' after move executed successfully.`);
            }
        } catch (error) {
            console.error("GameRuleSystem: Uncaught error executing automatic 'core:look' after move:", error);
            this.#eventBus.dispatch('ui:message_display', {
                text: "Internal Error: Failed to perform automatic look after moving.",
                type: 'error'
            });
        }
    }

    // --- Example Placeholder Methods (for potential future use) ---
    // #handleTurnEnd(eventData) {
    //    console.log("GameRuleSystem: Processing end-of-turn rules...");
    //    // Implement hunger/thirst updates, status effect ticks, etc.
    // }
    //
    // #updateWorldState() {
    //    console.log("GameRuleSystem: Updating world state (e.g., weather, time)...");
    // }
}

export default GameRuleSystem;