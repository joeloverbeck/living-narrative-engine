// src/core/gameStateInitializer.js

// --- Type Imports ---
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('./gameStateManager.js').default} GameStateManager */
/** @typedef {import('./services/gameDataRepository.js').GameDataRepository} GameDataRepository */
// --- Added Type Imports ---
/** @typedef {import('../services/validatedEventDispatcher.js').default} ValidatedEventDispatcher */
/** @typedef {import('./interfaces/coreServices.js').ILogger} ILogger */

import {POSITION_COMPONENT_ID} from '../types/components.js';

/**
 * Service responsible for setting up the initial game state using GameDataRepository,
 * dispatching the initial 'event:room_entered', and logging operations.
 */
class GameStateInitializer {
  /** @type {EntityManager} */
  #entityManager;
  /** @type {GameStateManager} */
  #gameStateManager;
  /** @type {GameDataRepository} */
  #repository;
  // --- Added Private Fields ---
  /** @type {ValidatedEventDispatcher} */
  #validatedDispatcher;
  /** @type {ILogger} */
  #logger;

  /**
     * Creates a new GameStateInitializer instance.
     * @param {object} dependencies
     * @param {EntityManager} dependencies.entityManager
     * @param {GameStateManager} dependencies.gameStateManager
     * @param {GameDataRepository} dependencies.gameDataRepository - The game data repository.
     * @param {ValidatedEventDispatcher} dependencies.validatedDispatcher - Service for dispatching validated events.
     * @param {ILogger} dependencies.logger - Logging service.
     * @throws {Error} If any required dependency is not provided or invalid.
     */
  constructor({entityManager, gameStateManager, gameDataRepository, validatedDispatcher, logger}) { // <-- Updated Parameter key
    if (!entityManager) throw new Error('GameStateInitializer requires an EntityManager.');
    if (!gameStateManager) throw new Error('GameStateInitializer requires a GameStateManager.');
    if (!gameDataRepository) throw new Error('GameStateInitializer requires a GameDataRepository.');
    // --- Added Validation Checks ---
    if (!validatedDispatcher || typeof validatedDispatcher.dispatchValidated !== 'function') {
      throw new Error('GameStateInitializer requires a valid ValidatedEventDispatcher instance.');
    }
    // Basic logger check (ensures it has common methods)
    if (!logger || typeof logger.info !== 'function' || typeof logger.error !== 'function' || typeof logger.debug !== 'function' || typeof logger.warn !== 'function') {
      throw new Error('GameStateInitializer requires a valid ILogger instance.');
    }

    this.#entityManager = entityManager;
    this.#gameStateManager = gameStateManager;
    this.#repository = gameDataRepository;
    // --- Store New Dependencies ---
    this.#validatedDispatcher = validatedDispatcher;
    this.#logger = logger;

    // --- Use Logger ---
    this.#logger.info('GameStateInitializer: Instance created with dependencies (EntityManager, GameStateManager, GameDataRepository, ValidatedEventDispatcher, ILogger).');
  }

  /**
     * Executes the initial game state setup logic.
     * Retrieves starting IDs from GameDataRepository, creates player and starting location entities,
     * sets them in the GameStateManager, positions the player in the starting location,
     * and dispatches the initial 'event:room_entered' event.
     * Assumes GameDataRepository has successfully loaded data for the selected world *before* this method is called.
     * @returns {Promise<boolean>} True if setup and initial event dispatch were successful, false otherwise.
     */
  async setupInitialState() { // <-- Made async to allow await for dispatch
    try {
      this.#logger.info('GameStateInitializer: Setting up initial game state...');

      this.#logger.debug('GameStateInitializer: Retrieving starting IDs from GameDataRepository...');
      const startingPlayerId = this.#repository.getStartingPlayerId();
      const startingLocationId = this.#repository.getStartingLocationId();

      if (!startingPlayerId) {
        throw new Error("GameStateInitializer Error: Failed to retrieve startingPlayerId from loaded world manifest. Manifest invalid, missing 'startingPlayerId' property, or data not loaded?");
      }
      if (!startingLocationId) {
        throw new Error("GameStateInitializer Error: Failed to retrieve startingLocationId from loaded world manifest. Manifest invalid, missing 'startingLocationId' property, or data not loaded?");
      }
      this.#logger.info(`GameStateInitializer: Using startingPlayerId: ${startingPlayerId}, startingLocationId: ${startingLocationId}`);


      // --- 1. Retrieve Definition & Create Player Entity ---
      this.#logger.debug(`GameStateInitializer: Checking definition for player '${startingPlayerId}'...`);
      if (!this.#repository.getEntityDefinition(startingPlayerId)) {
        throw new Error(`Player definition '${startingPlayerId}' (from manifest) not found in loaded data.`);
      }
      this.#logger.debug(`GameStateInitializer: Instantiating player entity '${startingPlayerId}'...`);
      const player = this.#entityManager.createEntityInstance(startingPlayerId);
      if (!player) {
        throw new Error(`Failed to instantiate player entity '${startingPlayerId}'.`);
      }
      this.#gameStateManager.setPlayer(player);
      this.#logger.info(`GameStateInitializer: Player entity '${player.id}' created and set.`);

      // --- 2. Retrieve Definition & Create Starting Location Entity ---
      this.#logger.debug(`GameStateInitializer: Checking definition for location '${startingLocationId}'...`);
      if (!this.#repository.getEntityDefinition(startingLocationId)) {
        throw new Error(`Starting location definition '${startingLocationId}' (from manifest) not found in loaded data.`);
      }
      this.#logger.debug(`GameStateInitializer: Instantiating location entity '${startingLocationId}'...`);
      const startLocation = this.#entityManager.createEntityInstance(startingLocationId);
      if (!startLocation) {
        throw new Error(`Failed to instantiate starting location entity '${startingLocationId}'.`);
      }
      this.#gameStateManager.setCurrentLocation(startLocation);
      this.#logger.info(`GameStateInitializer: Starting location '${startLocation.id}' created and set.`);

      // --- 3. Place Player in Starting Location ---
      this.#logger.debug(`GameStateInitializer: Attempting to set player '${player.id}' position to location '${startLocation.id}'...`);
      const playerPos = player.getComponentData(POSITION_COMPONENT_ID);
      if (playerPos && typeof playerPos.setLocation === 'function') { // Check setLocation exists
        playerPos.setLocation(startLocation.id, 0, 0); // Default to 0,0 in the location
        this.#logger.info(`GameStateInitializer: Updated player's position data to location ${startLocation.id}`);
        // Note: EntityManager addComponent/removeComponent handles SpatialIndex updates.
        // If setLocation modifies the data *in place* without going through EntityManager,
        // we might need to manually notify the spatial index here or refactor setLocation.
        // Assuming for now that the data object is shared and the index reads the latest.
      } else {
        this.#logger.warn(`GameStateInitializer: Player '${player.id}' missing position data or setLocation method. Attempting to add component.`);
        try {
          // Use EntityManager to add component, ensuring validation and spatial index update
          await this.#entityManager.addComponent(player.id, POSITION_COMPONENT_ID, {locationId: startLocation.id, x: 0, y: 0});
          this.#logger.info(`GameStateInitializer: Added position component via EntityManager to player '${player.id}' for location ${startLocation.id}`);
        } catch (addCompError) {
          this.#logger.error(`GameStateInitializer: Failed to add position data via EntityManager to player '${player.id}': ${addCompError.message}`, addCompError);
          throw new Error(`Could not set player's initial position in ${startLocation.id}`);
        }
      }

      this.#logger.info('GameStateInitializer: Initial state setup complete. Dispatching initial event:room_entered...');

      // --- 4. Dispatch Initial event:room_entered Event ---
      this.#logger.info(`GameStateInitializer: Dispatching event:room_entered for player ${player.id} entering location ${startLocation.id}...`);
      await this.#validatedDispatcher.dispatchValidated(
        'event:room_entered',                                   // Event Name
        {                                                       // Payload
          playerId: player.id,
          newLocationId: startLocation.id,
          previousLocationId: null                            // Initial entry has no previous location
        },
        {}                                                      // Options (default)
      );
      this.#logger.info(`GameStateInitializer: Successfully dispatched initial event:room_entered for player ${player.id}.`);
      // --- End Dispatch Logic ---


      this.#logger.info('GameStateInitializer: setupInitialState method completed successfully.');
      return true; // Indicate success

    } catch (error) {
      // Use logger for errors
      this.#logger.error(`GameStateInitializer: CRITICAL ERROR during initial game state setup: ${error.message}`, error);
      // Ensure GameStateManager state reflects potential partial failure if needed
      // (e.g., if player was set but location failed) - current logic is mostly atomic.
      return false; // Indicate failure
    }
  }
}

export default GameStateInitializer;