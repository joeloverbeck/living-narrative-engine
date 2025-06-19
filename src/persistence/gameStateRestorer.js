// src/persistence/gameStateRestorer.js

import { setupService } from '../utils/serviceInitializerUtils.js';
import {
  createPersistenceFailure,
  createPersistenceSuccess,
} from '../utils/persistenceResultUtils.js';
import {
  PersistenceError,
  PersistenceErrorCodes,
} from './persistenceErrors.js';

/**
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../entities/entityManager.js').default} EntityManager
 * @typedef {import('../engine/playtimeTracker.js').default} PlaytimeTracker
 * @typedef {import('../interfaces/ISaveLoadService.js').SaveGameStructure} SaveGameStructure
 */

/**
 * Restores previously saved game state into the engine.
 *
 * @class GameStateRestorer
 */
class GameStateRestorer {
  /** @type {ILogger} */
  #logger;
  /** @type {EntityManager} */
  #entityManager;
  /** @type {PlaytimeTracker} */
  #playtimeTracker;

  /**
   * Creates a new GameStateRestorer instance.
   *
   * @param {object} deps - Constructor dependencies.
   * @param {ILogger} deps.logger - Logging service.
   * @param {EntityManager} deps.entityManager - Entity manager.
   * @param {PlaytimeTracker} deps.playtimeTracker - Playtime tracker.
   */
  constructor({ logger, entityManager, playtimeTracker }) {
    this.#logger = setupService('GameStateRestorer', logger, {
      entityManager: {
        value: entityManager,
        requiredMethods: ['clearAll', 'reconstructEntity'],
      },
      playtimeTracker: {
        value: playtimeTracker,
        requiredMethods: ['setAccumulatedPlaytime'],
      },
    });
    this.#entityManager = entityManager;
    this.#playtimeTracker = playtimeTracker;
    this.#logger.debug('GameStateRestorer: Instance created.');
  }

  /**
   * Restores a single serialized entity via the EntityManager.
   *
   * @param {{instanceId: string, definitionId: string, components: Record<string, any>}} savedEntityData
   *   Serialized entity data from the save file.
   * @returns {void}
   * @private
   */
  _restoreEntity(savedEntityData) {
    try {
      const restoredEntity =
        this.#entityManager.reconstructEntity(savedEntityData);
      if (!restoredEntity) {
        this.#logger.warn(
          `GameStateRestorer.restoreGameState: Failed to restore entity with instanceId: ${savedEntityData.instanceId} (Def: ${savedEntityData.definitionId}). reconstructEntity indicated failure.`
        );
      }
    } catch (entityError) {
      this.#logger.warn(
        `GameStateRestorer.restoreGameState: Error during reconstructEntity for instanceId: ${savedEntityData.instanceId}. Error: ${entityError.message}. Skipping.`,
        entityError
      );
    }
  }

  /**
   * Validates restore data and required dependencies.
   *
   * @param {SaveGameStructure | any} data - Parsed save data object.
   * @returns {{success: false, error: PersistenceError} | null} Failure object or null if validation passes.
   * @private
   */
  _validateRestoreInput(data) {
    if (!data?.gameState) {
      const errorMsg =
        'Invalid save data structure provided (missing gameState).';
      this.#logger.error(`GameStateRestorer.restoreGameState: ${errorMsg}`);
      return createPersistenceFailure(
        PersistenceErrorCodes.INVALID_GAME_STATE,
        errorMsg
      );
    }
    if (!this.#entityManager) {
      return createPersistenceFailure(
        PersistenceErrorCodes.UNEXPECTED_ERROR,
        'EntityManager not available.'
      );
    }
    if (!this.#playtimeTracker) {
      return createPersistenceFailure(
        PersistenceErrorCodes.UNEXPECTED_ERROR,
        'PlaytimeTracker not available.'
      );
    }
    return createPersistenceSuccess(null);
  }

  /**
   * Clears existing entities before restoration.
   *
   * @returns {{success: false, error: PersistenceError} | null} Failure object or null on success.
   * @private
   */
  _clearEntities() {
    try {
      this.#entityManager.clearAll();
      this.#logger.debug(
        'GameStateRestorer.restoreGameState: Existing entity state cleared.'
      );
      return createPersistenceSuccess(null);
    } catch (error) {
      const errorMsg = `Failed to clear existing entity state: ${error.message}`;
      this.#logger.error(
        `GameStateRestorer.restoreGameState: ${errorMsg}`,
        error
      );
      return createPersistenceFailure(
        PersistenceErrorCodes.UNEXPECTED_ERROR,
        `Critical error during state clearing: ${errorMsg}`
      );
    }
  }

  /**
   * Restores all serialized entities from save data.
   *
   * @param {any[]} entitiesArray - Array of serialized entity records.
   * @returns {void}
   * @private
   */
  _restoreEntities(entitiesArray) {
    const entitiesToRestore = entitiesArray;
    if (!Array.isArray(entitiesToRestore)) {
      this.#logger.warn(
        'GameStateRestorer.restoreGameState: entitiesToRestore is not an array. No entities will be restored.'
      );
      return createPersistenceSuccess(null);
    }
    for (const savedEntityData of entitiesToRestore) {
      if (!savedEntityData?.instanceId || !savedEntityData?.definitionId) {
        this.#logger.warn(
          `GameStateRestorer.restoreGameState: Invalid entity data in save (missing instanceId or definitionId). Skipping. Data: ${JSON.stringify(savedEntityData)}`
        );
        continue;
      }
      this._restoreEntity(savedEntityData);
    }
    this.#logger.debug(
      'GameStateRestorer.restoreGameState: Entity restoration complete.'
    );
    return createPersistenceSuccess(null);
  }

  /**
   * Restores accumulated playtime via PlaytimeTracker.
   *
   * @param {number | undefined} playtimeSeconds - Total playtime from metadata.
   * @returns {void}
   * @private
   */
  _restorePlaytime(playtimeSeconds) {
    if (typeof playtimeSeconds === 'number') {
      try {
        this.#playtimeTracker.setAccumulatedPlaytime(playtimeSeconds);
        this.#logger.debug(
          `GameStateRestorer.restoreGameState: Restored accumulated playtime: ${playtimeSeconds}s.`
        );
      } catch (playtimeError) {
        this.#logger.error(
          `GameStateRestorer.restoreGameState: Error setting accumulated playtime: ${playtimeError.message}. Resetting.`,
          playtimeError
        );
        this.#playtimeTracker.setAccumulatedPlaytime(0);
      }
    } else {
      this.#logger.warn(
        'GameStateRestorer.restoreGameState: Playtime data not found/invalid. Resetting playtime.'
      );
      this.#playtimeTracker.setAccumulatedPlaytime(0);
    }
    return createPersistenceSuccess(null);
  }

  /**
   * Finalizes the restore process. Currently just logs completion.
   *
   * @returns {{success: true}}
   * @private
   */
  _finalizeRestore() {
    this.#logger.debug(
      'GameStateRestorer.restoreGameState: Skipping turn count restoration as TurnManager is restarted on load.'
    );
    this.#logger.debug(
      'GameStateRestorer.restoreGameState: Placeholder for PlayerState/WorldState restoration.'
    );
    this.#logger.debug(
      'GameStateRestorer.restoreGameState: Game state restoration process complete.'
    );
    return createPersistenceSuccess(null);
  }

  /**
   * Restores game state from a SaveGameStructure object.
   *
   * @param {SaveGameStructure} deserializedSaveData - Parsed save data.
   * @returns {Promise<{success: boolean, error?: PersistenceError}>} Result of the restoration.
   */
  async restoreGameState(deserializedSaveData) {
    this.#logger.debug(
      'GameStateRestorer.restoreGameState: Starting game state restoration...'
    );

    let stepResult = this._validateRestoreInput(deserializedSaveData);
    if (!stepResult.success) return stepResult;

    stepResult = this._clearEntities();
    if (!stepResult.success) return stepResult;

    this.#logger.debug(
      'GameStateRestorer.restoreGameState: Restoring entities...'
    );

    stepResult = this._restoreEntities(deserializedSaveData.gameState.entities);
    if (!stepResult.success) return stepResult;

    stepResult = this._restorePlaytime(
      deserializedSaveData.metadata?.playtimeSeconds
    );
    if (!stepResult.success) return stepResult;

    stepResult = this._finalizeRestore();
    if (!stepResult.success) return stepResult;

    return { success: true };
  }
}

export default GameStateRestorer;
