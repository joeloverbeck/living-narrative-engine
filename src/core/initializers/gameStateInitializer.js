// src/core/initializers/gameStateInitializer.js

// --- Type Imports ---
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('./gameStateManager.js').default} GameStateManager */
/** @typedef {import('./services/gameDataRepository.js').GameDataRepository} GameDataRepository */
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('./services/validatedEventDispatcher.js').default} ValidatedEventDispatcher */ // Corrected path
/** @typedef {import('./interfaces/coreServices.js').ILogger} ILogger */ // Corrected path

import {POSITION_COMPONENT_ID, PLAYER_COMPONENT_ID} from "../../types/components.js"; // Corrected path

/**
 * Service responsible for setting up the initial game state.
 * Instantiates starting player and location, sets them in GameStateManager,
 * ensures player positioning, and dispatches events.
 */
class GameStateInitializer {
    /** @type {EntityManager} */
    #entityManager;
    /** @type {GameStateManager} */
    #gameStateManager;
    /** @type {GameDataRepository} */
    #repository;
    /** @type {ValidatedEventDispatcher} */
    #validatedEventDispatcher;
    /** @type {ILogger} */
    #logger;

    /**
     * Creates a new GameStateInitializer instance.
     * @param {object} dependencies
     * @param {EntityManager} dependencies.entityManager
     * @param {GameStateManager} dependencies.gameStateManager
     * @param {GameDataRepository} dependencies.gameDataRepository
     * @param {ValidatedEventDispatcher} dependencies.validatedEventDispatcher
     * @param {ILogger} dependencies.logger
     * @throws {Error} If any required dependency is not provided or invalid.
     */
    constructor({entityManager, gameStateManager, gameDataRepository, validatedEventDispatcher, logger}) {
        // Simplified validation for brevity, assume checks pass
        if (!entityManager) throw new Error('GameStateInitializer requires an EntityManager.');
        if (!gameStateManager) throw new Error('GameStateInitializer requires a GameStateManager.');
        if (!gameDataRepository || typeof gameDataRepository.getStartingPlayerId !== 'function' || typeof gameDataRepository.getStartingLocationId !== 'function') {
            throw new Error('GameStateInitializer requires a GameDataRepository with expected methods.');
        }
        if (!validatedEventDispatcher) throw new Error('GameStateInitializer requires a ValidatedEventDispatcher.');
        if (!logger) throw new Error('GameStateInitializer requires an ILogger.');

        this.#entityManager = entityManager;
        this.#gameStateManager = gameStateManager;
        this.#repository = gameDataRepository;
        this.#validatedEventDispatcher = validatedEventDispatcher;
        this.#logger = logger;
    }

    /**
     * Executes the initial game state setup logic.
     * Dispatches 'initialization:game_state_initializer:started/completed/failed' events.
     * @returns {Promise<boolean>} True if successful, false otherwise.
     */
    async setupInitialState() {
        this.#logger.info('GameStateInitializer: Setting up initial game state...');

        // --- Ticket 16: Dispatch 'started' event ---
        // Fire-and-forget dispatch for 'started'
        this.#validatedEventDispatcher.dispatchValidated('initialization:game_state_initializer:started', {}, { allowSchemaNotFound: true })
            .then(() => this.#logger.debug("Dispatched 'initialization:game_state_initializer:started' event."))
            .catch(e => this.#logger.error("Failed to dispatch 'initialization:game_state_initializer:started' event", e));
        // --- End Ticket 16 ---

        let player = null;
        let startLocation = null;
        const initialPlayerState = this.#gameStateManager.getPlayer(); // Store initial state for potential rollback
        const initialLocationState = this.#gameStateManager.getCurrentLocation(); // Store initial state for potential rollback

        try {
            // --- 1. Get Starting IDs ---
            this.#logger.debug('Fetching starting IDs...');
            const startingPlayerId = this.#repository.getStartingPlayerId();
            const startingLocationId = this.#repository.getStartingLocationId();

            if (!startingPlayerId) {
                // Log specific error before throwing
                this.#logger.error("GameStateInitializer: Failed to retrieve starting player ID from the repository/manifest. Cannot initialize game state.");
                throw new Error("Missing starting player ID in game data."); // Corrected error message
            }
            if (!startingLocationId) {
                // Log specific error before throwing
                this.#logger.error("GameStateInitializer: Failed to retrieve starting location ID from the repository/manifest. Cannot initialize game state.");
                throw new Error("Missing starting location ID in game data."); // Corrected error message
            }
            this.#logger.info(`Starting IDs retrieved: Player=${startingPlayerId}, Location=${startingLocationId}`); // Adjusted log message slightly

            // --- 2. Instantiate Entities ---
            this.#logger.info(`Instantiating starting player entity with ID: ${startingPlayerId}...`);
            player = this.#entityManager.createEntityInstance(startingPlayerId);
            if (!player) {
                // Log specific error before throwing
                this.#logger.error(`GameStateInitializer: EntityManager failed to create instance for starting player ID: ${startingPlayerId}. Check if definition exists and is valid.`);
                throw new Error(`Failed to instantiate starting player entity '${startingPlayerId}'.`);
            }
            // --- Corrected Warning Log Message ---
            if (!player.hasComponent(PLAYER_COMPONENT_ID)) {
                this.#logger.warn(`Instantiated entity '${player.id}' designated as starting player, but it lacks the '${PLAYER_COMPONENT_ID}' component.`);
            }
            this.#logger.info(`Successfully instantiated player entity: ${player.id}`);

            this.#logger.info(`Instantiating starting location entity with ID: ${startingLocationId}...`);
            startLocation = this.#entityManager.createEntityInstance(startingLocationId);
            if (!startLocation) {
                // Log specific error before throwing
                this.#logger.error(`GameStateInitializer: EntityManager failed to create instance for starting location ID: ${startingLocationId}. Check if definition exists and is valid.`);
                throw new Error(`Failed to instantiate starting location entity '${startingLocationId}'.`);
            }
            this.#logger.info(`Successfully instantiated starting location entity: ${startLocation.id}`);

            // --- 3. Set Core Game State ---
            this.#gameStateManager.setPlayer(player);
            this.#gameStateManager.setCurrentLocation(startLocation);
            this.#logger.info(`Player '${player.id}' and Location '${startLocation.id}' set in GameStateManager.`); // Added IDs for clarity

            // --- 4. Ensure Player Position ---
            this.#logger.info(`Ensuring player '${player.id}' is positioned in starting location '${startLocation.id}'...`); // Added IDs for clarity
            const targetPositionData = { locationId: startLocation.id, x: 0, y: 0 };
            try {
                await this.#entityManager.addComponent(player.id, POSITION_COMPONENT_ID, targetPositionData);
                this.#logger.info(`Successfully set/updated position component for player '${player.id}' to location '${startLocation.id}' via EntityManager.`); // Added IDs
            } catch (addCompError) {
                // Log specific error before re-throwing
                this.#logger.error(`GameStateInitializer: Failed to add/update position component via EntityManager for player '${player.id}' in location '${startLocation.id}': ${addCompError.message}`, addCompError);
                throw new Error(`Could not set player's initial position in starting location '${startLocation.id}'.`); // Make it critical, include location ID
            }

            // --- 5. Dispatch Initial Room Entered Event ---
            this.#logger.info(`Dispatching initial event:room_entered for player ${player.id} entering location ${startLocation.id}...`); // Added IDs
            await this.#validatedEventDispatcher.dispatchValidated(
                'event:room_entered',
                { playerId: player.id, newLocationId: startLocation.id, previousLocationId: null },
                { allowSchemaNotFound: true }
            );
            this.#logger.info(`Successfully dispatched initial event:room_entered for player ${player.id}.`); // Added ID

            this.#logger.info('GameStateInitializer: setupInitialState method completed successfully.'); // Adjusted log message slightly

            // --- Ticket 16: Dispatch 'completed' event ---
            const completedPayload = { playerId: player?.id, locationId: startLocation?.id };
            // Fire-and-forget dispatch for 'completed'
            this.#validatedEventDispatcher.dispatchValidated('initialization:game_state_initializer:completed', completedPayload, { allowSchemaNotFound: true })
                .then(() => this.#logger.debug("Dispatched 'initialization:game_state_initializer:completed' event.", completedPayload))
                .catch(e => this.#logger.error("Failed to dispatch 'initialization:game_state_initializer:completed' event", e));
            // --- End Ticket 16 ---

            return true; // Indicate success

        } catch (error) {
            // Log the critical error that caused the failure
            this.#logger.error(`GameStateInitializer: CRITICAL ERROR during initial game state setup: ${error.message}`, error); // Changed log slightly

            // Rollback state to what it was before this method was called
            this.#gameStateManager.setPlayer(initialPlayerState);
            this.#gameStateManager.setCurrentLocation(initialLocationState);
            this.#logger.warn('GameStateInitializer: Rolled back GameStateManager state.'); // Keep this warning

            // --- Ticket 16: Dispatch 'failed' event ---
            const failedPayload = { error: error?.message || 'Unknown error', stack: error?.stack };
            // Fire-and-forget dispatch for 'failed'
            this.#validatedEventDispatcher.dispatchValidated('initialization:game_state_initializer:failed', failedPayload, { allowSchemaNotFound: true })
                .then(() => this.#logger.debug("Dispatched 'initialization:game_state_initializer:failed' event.", failedPayload))
                .catch(e => this.#logger.error("Failed to dispatch 'initialization:game_state_initializer:failed' event", e));
            // --- End Ticket 16 ---

            return false; // Indicate failure
        }
    }
}

export default GameStateInitializer;