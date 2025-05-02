// src/core/initializers/gameStateInitializer.js

// --- Type Imports ---
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../interfaces/IWorldContext.js').default} IWorldContext */ // Keep for dependency injection, even if methods aren't used
/** @typedef {import('./services/gameDataRepository.js').GameDataRepository} GameDataRepository */
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('./services/validatedEventDispatcher.js').default} ValidatedEventDispatcher */
/** @typedef {import('./interfaces/coreServices.js').ILogger} ILogger */

import {POSITION_COMPONENT_ID, PLAYER_COMPONENT_ID} from "../../types/components.js"; // Assuming 'core:current_actor' is handled as a string ID for now

/**
 * Service responsible for setting up the initial game state.
 * Instantiates starting player and location, ensures player positioning,
 * marks the starting player with the 'core:current_actor' component,
 * and dispatches initialization events.
 */
class GameStateInitializer {
    /** @type {EntityManager} */
    #entityManager;
    /** @type {IWorldContext} */
    #worldContext; // Keep for DI signature
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
     * @param {IWorldContext} dependencies.worldContext - Required for dependency injection pattern, though its state methods are no longer used here.
     * @param {GameDataRepository} dependencies.gameDataRepository
     * @param {ValidatedEventDispatcher} dependencies.validatedEventDispatcher
     * @param {ILogger} dependencies.logger
     * @throws {Error} If any required dependency is not provided or invalid.
     */
    constructor({entityManager, worldContext, gameDataRepository, validatedEventDispatcher, logger}) {
        // Simplified validation for brevity, assume checks pass
        if (!entityManager) throw new Error('GameStateInitializer requires an EntityManager.');
        if (!worldContext) throw new Error('GameStateInitializer requires a WorldContext for DI.'); // Updated reason
        if (!gameDataRepository || typeof gameDataRepository.getStartingPlayerId !== 'function' || typeof gameDataRepository.getStartingLocationId !== 'function') {
            throw new Error('GameStateInitializer requires a GameDataRepository with expected methods.');
        }
        if (!validatedEventDispatcher) throw new Error('GameStateInitializer requires a ValidatedEventDispatcher.');
        if (!logger) throw new Error('GameStateInitializer requires an ILogger.');

        this.#entityManager = entityManager;
        this.#worldContext = worldContext; // Store it, even if unused
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
        this.#validatedEventDispatcher.dispatchValidated('initialization:game_state_initializer:started', {}, {allowSchemaNotFound: true})
            .then(() => this.#logger.debug("Dispatched 'initialization:game_state_initializer:started' event."))
            .catch(e => this.#logger.error("Failed to dispatch 'initialization:game_state_initializer:started' event", e));
        // --- End Ticket 16 ---

        let player = null;
        let startLocation = null;

        try {
            // --- 1. Get Starting IDs ---
            this.#logger.debug('Fetching starting IDs...');
            const startingPlayerId = this.#repository.getStartingPlayerId();
            const startingLocationId = this.#repository.getStartingLocationId();

            if (!startingPlayerId) {
                this.#logger.error("GameStateInitializer: Failed to retrieve starting player ID from the repository/manifest. Cannot initialize game state.");
                throw new Error("Missing starting player ID in game data.");
            }
            if (!startingLocationId) {
                this.#logger.error("GameStateInitializer: Failed to retrieve starting location ID from the repository/manifest. Cannot initialize game state.");
                throw new Error("Missing starting location ID in game data.");
            }
            this.#logger.info(`Starting IDs retrieved: Player=${startingPlayerId}, Location=${startingLocationId}`);

            // --- 2. Instantiate Entities ---
            this.#logger.info(`Instantiating starting player entity with ID: ${startingPlayerId}...`);
            player = this.#entityManager.createEntityInstance(startingPlayerId);
            if (!player) {
                this.#logger.error(`GameStateInitializer: EntityManager failed to create instance for starting player ID: ${startingPlayerId}. Check if definition exists and is valid.`);
                throw new Error(`Failed to instantiate starting player entity '${startingPlayerId}'.`);
            }
            // --- Check for Player Component ---
            if (!player.hasComponent(PLAYER_COMPONENT_ID)) {
                this.#logger.warn(`Instantiated entity '${player.id}' designated as starting player, but it lacks the '${PLAYER_COMPONENT_ID}' component.`);
            }
            this.#logger.info(`Successfully instantiated player entity: ${player.id}`);

            // --- Mark Player as Current Actor ---
            try {
                await this.#entityManager.addComponent(player.id, 'core:current_actor', {});
                this.#logger.info(`Marked player entity ${player.id} as core:current_actor via EntityManager.`);
            } catch (addActorCompError) {
                this.#logger.error(`GameStateInitializer: Failed to add 'core:current_actor' component via EntityManager for player '${player.id}': ${addActorCompError.message}`, addActorCompError);
                throw new Error(`Could not mark player '${player.id}' as the current actor.`);
            }

            this.#logger.info(`Instantiating starting location entity with ID: ${startingLocationId}...`);
            startLocation = this.#entityManager.createEntityInstance(startingLocationId);
            if (!startLocation) {
                this.#logger.error(`GameStateInitializer: EntityManager failed to create instance for starting location ID: ${startingLocationId}. Check if definition exists and is valid.`);
                throw new Error(`Failed to instantiate starting location entity '${startingLocationId}'.`);
            }
            this.#logger.info(`Successfully instantiated starting location entity: ${startLocation.id}`);

            // --- 3. Set Core Game State (REMOVED) ---
            // REMOVED: this.#worldContext.setPlayer(player);
            // REMOVED: this.#worldContext.setCurrentLocation(startLocation);
            // REMOVED Log: this.#logger.info(`Player '${player.id}' and Location '${startLocation.id}' set in WorldContext.`);

            // --- 4. Ensure Player Position ---
            this.#logger.info(`Ensuring player '${player.id}' is positioned in starting location '${startLocation.id}'...`);
            const targetPositionData = {locationId: startLocation.id, x: 0, y: 0};
            try {
                await this.#entityManager.addComponent(player.id, POSITION_COMPONENT_ID, targetPositionData);
                this.#logger.info(`Successfully set/updated position component for player '${player.id}' to location '${startLocation.id}' via EntityManager.`);
            } catch (addPosCompError) {
                this.#logger.error(`GameStateInitializer: Failed to add/update position component via EntityManager for player '${player.id}' in location '${startLocation.id}': ${addPosCompError.message}`, addPosCompError);
                throw new Error(`Could not set player's initial position in starting location '${startLocation.id}'.`);
            }

            // --- 5. Dispatch Initial Room Entered Event ---
            this.#logger.info(`Dispatching initial event:room_entered for player ${player.id} entering location ${startLocation.id}...`);
            await this.#validatedEventDispatcher.dispatchValidated(
                'event:room_entered',
                {playerId: player.id, newLocationId: startLocation.id, previousLocationId: null},
                {allowSchemaNotFound: true}
            );
            this.#logger.info(`Successfully dispatched initial event:room_entered for player ${player.id}.`);

            this.#logger.info('GameStateInitializer: setupInitialState method completed successfully.');

            // --- Ticket 16: Dispatch 'completed' event ---
            const completedPayload = {playerId: player?.id, locationId: startLocation?.id};
            this.#validatedEventDispatcher.dispatchValidated('initialization:game_state_initializer:completed', completedPayload, {allowSchemaNotFound: true})
                .then(() => this.#logger.debug("Dispatched 'initialization:game_state_initializer:completed' event.", completedPayload))
                .catch(e => this.#logger.error("Failed to dispatch 'initialization:game_state_initializer:completed' event", e));
            // --- End Ticket 16 ---

            return true; // Indicate success

        } catch (error) {
            this.#logger.error(`GameStateInitializer: CRITICAL ERROR during initial game state setup: ${error.message}`, error);

            // REMOVED: Rollback state to what it was before this method was called
            // REMOVED: this.#worldContext.setPlayer(initialPlayerState);
            // REMOVED: this.#worldContext.setCurrentLocation(initialLocationState);
            // REMOVED Log: this.#logger.warn('GameStateInitializer: Rolled back WorldContext state.');

            // --- Ticket 16: Dispatch 'failed' event ---
            const failedPayload = {error: error?.message || 'Unknown error', stack: error?.stack};
            this.#validatedEventDispatcher.dispatchValidated('initialization:game_state_initializer:failed', failedPayload, {allowSchemaNotFound: true})
                .then(() => this.#logger.debug("Dispatched 'initialization:game_state_initializer:failed' event.", failedPayload))
                .catch(e => this.#logger.error("Failed to dispatch 'initialization:game_state_initializer:failed' event", e));
            // --- End Ticket 16 ---

            return false; // Indicate failure
        }
    }
}

export default GameStateInitializer;