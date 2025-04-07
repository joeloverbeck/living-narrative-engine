// src/core/gameInitializer.js

/** @typedef {import('./../../dataManager.js').default} DataManager */
/** @typedef {import('./../entities/entityManager.js').default} EntityManager */
/** @typedef {import('./../../gameStateManager.js').default} GameStateManager */
/** @typedef {import('./../../eventBus.js').default} EventBus */
/** @typedef {import('./../actions/actionExecutor.js').default} ActionExecutor */
/** @typedef {import('./../actions/actionTypes.js').ActionContext} ActionContext */

// --- Define the options object structure ---
/**
 * @typedef {object} GameInitializerOptions
 * @property {DataManager} dataManager - Manages game data loading and access.
 * @property {EntityManager} entityManager - Manages entity creation and components.
 * @property {GameStateManager} gameStateManager - Manages core game state (player, location).
 * @property {EventBus} eventBus - Facilitates decoupled communication.
 * @property {ActionExecutor} actionExecutor - Executes game actions.
 */

/**
 * Handles the one-time setup sequence for the game before the main loop starts.
 * Retrieves initial entities, sets game state, dispatches initial events/messages,
 * and performs the first 'look' action.
 */
class GameInitializer {
    #dataManager;
    #entityManager;
    #gameStateManager;
    #eventBus;
    #actionExecutor;

    /**
     * @param {GameInitializerOptions} options - Configuration object containing all dependencies.
     */
    constructor(options) {
        const {
            dataManager,
            entityManager,
            gameStateManager,
            eventBus,
            actionExecutor
        } = options || {};

        if (!dataManager) throw new Error("GameInitializer requires options.dataManager.");
        if (!entityManager) throw new Error("GameInitializer requires options.entityManager.");
        if (!gameStateManager) throw new Error("GameInitializer requires options.gameStateManager.");
        if (!eventBus) throw new Error("GameInitializer requires options.eventBus.");
        if (!actionExecutor) throw new Error("GameInitializer requires options.actionExecutor.");

        this.#dataManager = dataManager;
        this.#entityManager = entityManager;
        this.#gameStateManager = gameStateManager;
        this.#eventBus = eventBus;
        this.#actionExecutor = actionExecutor;

        console.log("GameInitializer: Instance created.");
    }

    /**
     * Executes the core game initialization sequence.
     * Retrieves player and starting location, sets initial state, dispatches
     * welcome messages and events, and triggers the initial 'look' action.
     * @returns {Promise<boolean>} - Resolves with true if initialization was successful, false otherwise.
     */
    async initializeGame() {
        console.log("GameInitializer: Starting initialization sequence...");

        try {
            // --- 1. Retrieve Player Entity ---
            // Player is assumed to be created in main.js already
            const player = this.#entityManager.getEntityInstance('core:player');
            if (!player) {
                const errorMsg = "Critical Error: Player entity 'core:player' could not be retrieved! Cannot start game.";
                console.error("GameInitializer:", errorMsg);
                this.#eventBus.dispatch('ui:message_display', {text: errorMsg, type: "error"});
                return false; // Indicate critical failure
            }
            this.#gameStateManager.setPlayer(player);
            console.log("GameInitializer: Player entity retrieved and set in GameStateManager.");

            // --- 2. Retrieve/Create Starting Location Entity ---
            const startLocationId = 'demo:room_entrance'; // Or fetch from config/dataManager
            const startLocation = this.#entityManager.createEntityInstance(startLocationId);
            if (!startLocation) {
                const errorMsg = `Critical Error: Starting location entity '${startLocationId}' could not be found or created! Cannot start game.`;
                console.error("GameInitializer:", errorMsg);
                this.#eventBus.dispatch('ui:message_display', {text: errorMsg, type: "error"});
                // Optional: Could try setting player state back to null? Probably not necessary.
                return false; // Indicate critical failure
            }
            this.#gameStateManager.setCurrentLocation(startLocation);
            console.log(`GameInitializer: Starting location '${startLocationId}' retrieved and set in GameStateManager.`);

            // --- Optional: Verify state after setting ---
            const initialPlayer = this.#gameStateManager.getPlayer();
            const initialLocation = this.#gameStateManager.getCurrentLocation();
            if (!initialPlayer || !initialLocation) {
                // This case indicates a problem within GameStateManager's setters potentially
                const errorMsg = "Internal Error: Game state inconsistency after setting player/location.";
                console.error("GameInitializer:", errorMsg);
                this.#eventBus.dispatch('ui:message_display', {text: errorMsg, type: "error"});
                return false;
            }
            console.log(`GameInitializer: Initial state confirmed - Player: ${initialPlayer.id}, Location: ${initialLocation.id}`);


            // --- 3. Dispatch Welcome Message ---
            this.#eventBus.dispatch('ui:message_display', {
                text: "Welcome to Dungeon Run Demo!",
                type: "info" // or a specific 'welcome' type
            });
            console.log("GameInitializer: Welcome message dispatched.");

            // --- 4. Dispatch Initial Room Entered Event ---
            // Ensures systems like TriggerSystem can react to the starting state
            this.#eventBus.dispatch('event:room_entered', {
                playerEntity: initialPlayer,
                newLocation: initialLocation,
                previousLocation: null // No previous location on initial entry
            });
            console.log("GameInitializer: Initial 'event:room_entered' dispatched.");

            // --- 5. Execute Initial 'look' Action ---
            console.log("GameInitializer: Executing initial 'core:action_look'.");
            /** @type {ActionContext} */
            const lookContext = {
                playerEntity: initialPlayer,
                currentLocation: initialLocation,
                targets: [], // No targets for a simple 'look'
                dataManager: this.#dataManager,
                entityManager: this.#entityManager,
                dispatch: this.#eventBus.dispatch.bind(this.#eventBus)
            };
            // We execute 'look' primarily for its side effect (dispatching messages via the handler)
            const lookResult = this.#actionExecutor.executeAction('core:action_look', lookContext);

            // Optional: Check lookResult.success, though the handler should manage errors
            if (!lookResult.success) {
                console.warn("GameInitializer: Initial 'look' action reported failure. Messages:", lookResult.messages);
                // Decide if this is critical. Usually, if 'look' fails, the messages dispatched
                // already informed the user. We might still want to proceed.
                // For now, we'll log and continue.
            } else {
                console.log("GameInitializer: Initial 'look' action executed successfully.");
            }

            console.log("GameInitializer: Initialization sequence completed successfully.");
            return true; // Indicate success

        } catch (error) {
            // Catch any unexpected errors during the initialization process
            const errorMsg = `Unexpected Error during game initialization: ${error.message}`;
            console.error("GameInitializer:", errorMsg, error);
            this.#eventBus.dispatch('ui:message_display', {
                text: "A critical error occurred during game setup. Cannot start.",
                type: "error"
            });
            return false; // Indicate critical failure
        }
    }
}

export default GameInitializer;