// src/core/gameStateInitializer.js

// --- Type Imports ---
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('./gameStateManager.js').default} GameStateManager */
/** @typedef {import('./services/gameDataRepository.js').GameDataRepository} GameDataRepository */
/** @typedef {import('../entities/entity.js').default} Entity */

// --- Added Type Imports ---
/** @typedef {import('../services/validatedEventDispatcher.js').default} ValidatedEventDispatcher */
import {POSITION_COMPONENT_ID, PLAYER_COMPONENT_ID} from "../types/components.js";

/** @typedef {import('./interfaces/coreServices.js').ILogger} ILogger */


 // Still useful for identifying player *logic* later

/**
 * Service responsible for setting up the initial game state.
 * It fetches starting player and location definition IDs from the GameDataRepository,
 * delegates their instantiation to the EntityManager, sets them in the GameStateManager,
 * ensures the player is positioned correctly in the starting location, and
 * dispatches the initial 'event:room_entered'.
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
   * @param {GameDataRepository} dependencies.gameDataRepository - Repository to fetch starting IDs.
   * @param {ValidatedEventDispatcher} dependencies.validatedEventDispatcher - Service for dispatching validated events.
   * @param {ILogger} dependencies.logger - Logging service.
   * @throws {Error} If any required dependency is not provided or invalid.
   */
  constructor({entityManager, gameStateManager, gameDataRepository, validatedEventDispatcher, logger}) {
    if (!entityManager) throw new Error('GameStateInitializer requires an EntityManager.');
    if (!gameStateManager) throw new Error('GameStateInitializer requires a GameStateManager.');
    // Updated check for GameDataRepository to include new methods
    if (!gameDataRepository || typeof gameDataRepository.getStartingPlayerId !== 'function' || typeof gameDataRepository.getStartingLocationId !== 'function') {
      throw new Error('GameStateInitializer requires a GameDataRepository with getStartingPlayerId and getStartingLocationId methods.');
    }
    if (!validatedEventDispatcher || typeof validatedEventDispatcher.dispatchValidated !== 'function') {
      throw new Error('GameStateInitializer requires a valid ValidatedEventDispatcher instance.');
    }
    if (!logger || typeof logger.info !== 'function' || typeof logger.error !== 'function' || typeof logger.debug !== 'function' || typeof logger.warn !== 'function') {
      throw new Error('GameStateInitializer requires a valid ILogger instance.');
    }

    this.#entityManager = entityManager;
    this.#gameStateManager = gameStateManager;
    this.#repository = gameDataRepository;
    this.#validatedEventDispatcher = validatedEventDispatcher;
    this.#logger = logger;

    this.#logger.info('GameStateInitializer: Instance created with dependencies (EntityManager, GameStateManager, GameDataRepository, ValidatedEventDispatcher, ILogger).');
  }

  /**
   * Executes the initial game state setup logic.
   * Fetches starting player/location IDs from the repository.
   * Delegates entity instantiation to EntityManager.
   * Sets player and location in GameStateManager.
   * Ensures the player's position component reflects the starting location.
   * Dispatches the initial 'event:room_entered' event.
   * Assumes data (definitions, manifest) is loaded into the registry *before* this method is called.
   * @returns {Promise<boolean>} True if setup and initial event dispatch were successful, false otherwise.
   */
  async setupInitialState() {
    try {
      this.#logger.info('GameStateInitializer: Setting up initial game state...');

      // --- 1. Get Starting IDs from Repository ---
      this.#logger.debug('GameStateInitializer: Fetching starting player and location IDs from repository...');
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
      this.#logger.info(`GameStateInitializer: Retrieved startingPlayerId: ${startingPlayerId}, startingLocationId: ${startingLocationId}`);

      // --- 2. Instantiate Starting Entities via EntityManager ---
      this.#logger.info(`GameStateInitializer: Instantiating starting player entity with ID: ${startingPlayerId}...`);
      const player = this.#entityManager.createEntityInstance(startingPlayerId);
      if (!player) {
        this.#logger.error(`GameStateInitializer: EntityManager failed to create instance for starting player ID: ${startingPlayerId}. Check if definition exists and is valid.`);
        throw new Error(`Failed to instantiate starting player entity '${startingPlayerId}'.`);
      }
      // Optional Sanity Check: Verify the instantiated player has the player component
      if (!player.hasComponent(PLAYER_COMPONENT_ID)) {
        this.#logger.warn(`GameStateInitializer: Instantiated entity '${player.id}' designated as starting player, but it lacks the '${PLAYER_COMPONENT_ID}' component.`);
        // Depending on game rules, this might be an error or just a warning.
        // throw new Error(`Starting player entity '${player.id}' definition is missing the required '${PLAYER_COMPONENT_ID}' component.`);
      }
      this.#logger.info(`GameStateInitializer: Successfully instantiated player entity: ${player.id}`);


      this.#logger.info(`GameStateInitializer: Instantiating starting location entity with ID: ${startingLocationId}...`);
      const startLocation = this.#entityManager.createEntityInstance(startingLocationId);
      if (!startLocation) {
        this.#logger.error(`GameStateInitializer: EntityManager failed to create instance for starting location ID: ${startingLocationId}. Check if definition exists and is valid.`);
        throw new Error(`Failed to instantiate starting location entity '${startingLocationId}'.`);
      }
      this.#logger.info(`GameStateInitializer: Successfully instantiated starting location entity: ${startLocation.id}`);


      // --- 3. Set Core Game State ---
      this.#gameStateManager.setPlayer(player);
      this.#gameStateManager.setCurrentLocation(startLocation);
      this.#logger.info(`GameStateInitializer: Player '${player.id}' and Location '${startLocation.id}' set in GameStateManager.`);


      // --- 4. Ensure Player is Positioned Correctly in Starting Location ---
      // The player was just created. We MUST ensure its position component is set
      // correctly for the starting location, regardless of what its definition might contain.
      this.#logger.info(`GameStateInitializer: Ensuring player '${player.id}' is positioned in starting location '${startLocation.id}'...`);
      const targetPositionData = {
        locationId: startLocation.id,
        x: 0, // Default starting coordinates within the location
        y: 0  // Adjust if specific starting points are needed/defined elsewhere
      };

      try {
        // Use EntityManager.addComponent to ensure validation and spatial index update.
        // This will add the component if missing, or overwrite it if it exists.
        await this.#entityManager.addComponent(player.id, POSITION_COMPONENT_ID, targetPositionData);

        this.#logger.info(`GameStateInitializer: Successfully set/updated position component for player '${player.id}' to location '${startLocation.id}' via EntityManager.`);
      } catch (addCompError) {
        this.#logger.error(`GameStateInitializer: Failed to add/update position component via EntityManager for player '${player.id}' in location '${startLocation.id}': ${addCompError.message}`, addCompError);
        // This is critical, throw error to halt initialization
        throw new Error(`Could not set player's initial position in starting location '${startLocation.id}'.`);
      }


      // --- 5. Dispatch Initial event:room_entered Event ---
      this.#logger.info(`GameStateInitializer: Dispatching initial event:room_entered for player ${player.id} entering location ${startLocation.id}...`);
      await this.#validatedEventDispatcher.dispatchValidated(
          'event:room_entered',                                   // Event Name
          {                                                       // Payload
            playerId: player.id,
            newLocationId: startLocation.id,
            previousLocationId: null                            // Initial entry has no previous location
          },
          { allowSchemaNotFound: true }                           // Option: Allow dispatch even if event schema isn't loaded yet during init
      );
      this.#logger.info(`GameStateInitializer: Successfully dispatched initial event:room_entered for player ${player.id}.`);


      this.#logger.info('GameStateInitializer: setupInitialState method completed successfully.');
      return true; // Indicate success

    } catch (error) {
      // Use logger for errors
      this.#logger.error(`GameStateInitializer: CRITICAL ERROR during initial game state setup: ${error.message}`, error);
      // Rollback GameStateManager state if partial setup occurred
      this.#gameStateManager.setPlayer(null);
      this.#gameStateManager.setCurrentLocation(null);
      this.#logger.warn('GameStateInitializer: Rolled back GameStateManager state due to error.');
      return false; // Indicate failure
    }
  }
}

export default GameStateInitializer;