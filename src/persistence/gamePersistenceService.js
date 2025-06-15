import { IGamePersistenceService } from '../interfaces/IGamePersistenceService.js';

// --- JSDoc Type Imports ---
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/ISaveLoadService.js').ISaveLoadService} ISaveLoadService */
/** @typedef {import('../interfaces/ISaveLoadService.js').SaveGameStructure} SaveGameStructure */
/** @typedef {import('../interfaces/ISaveLoadService.js').LoadGameResult} LoadGameResult */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../engine/playtimeTracker.js').default} PlaytimeTracker */
/** @typedef {import('../dependencyInjection/appContainer.js').default} AppContainer */
/** @typedef {import('../turns/interfaces/ITurnManager.js').ITurnManager} ITurnManager */
/** @typedef {import('../loaders/worldLoader.js').default} WorldLoader */
/** @typedef {import('../../data/schemas/mod.manifest.schema.json').ModManifest} ModManifest */

// --- Import Tokens ---
// tokens import removed as not used after refactor
import { deepClone } from '../utils/objectUtils.js';
// --- MODIFICATION START: Import component IDs for cleaning logic ---
import {
  CURRENT_ACTOR_COMPONENT_ID,
  NOTES_COMPONENT_ID,
  PERCEPTION_LOG_COMPONENT_ID,
  SHORT_TERM_MEMORY_COMPONENT_ID,
} from '../constants/componentIds.js';
import { CORE_MOD_ID } from '../constants/core';
// --- MODIFICATION END ---

class GamePersistenceService extends IGamePersistenceService {
  #logger;
  #saveLoadService;
  #entityManager;
  #dataRegistry;
  #playtimeTracker;
  #componentCleaners;

  constructor({
    logger,
    saveLoadService,
    entityManager,
    dataRegistry,
    playtimeTracker,
  }) {
    super();
    const missingDependencies = [];
    if (!logger) missingDependencies.push('logger');
    if (!saveLoadService) missingDependencies.push('saveLoadService');
    if (!entityManager) missingDependencies.push('entityManager');
    if (!dataRegistry) missingDependencies.push('dataRegistry');
    if (!playtimeTracker) missingDependencies.push('playtimeTracker');

    if (missingDependencies.length > 0) {
      const errorMessage = `GamePersistenceService: Fatal - Missing required dependencies: ${missingDependencies.join(', ')}.`;
      if (logger && typeof logger.error === 'function') {
        logger.error(errorMessage);
      } else {
        console.error(errorMessage);
      }
      throw new Error(errorMessage);
    }

    this.#logger = logger;
    this.#saveLoadService = saveLoadService;
    this.#entityManager = entityManager;
    this.#dataRegistry = dataRegistry;
    this.#playtimeTracker = playtimeTracker;
    this.#componentCleaners = new Map([
      [NOTES_COMPONENT_ID, this.#cleanNotesComponent.bind(this)],
      [
        SHORT_TERM_MEMORY_COMPONENT_ID,
        this.#cleanShortTermMemoryComponent.bind(this),
      ],
      [
        PERCEPTION_LOG_COMPONENT_ID,
        this.#cleanPerceptionLogComponent.bind(this),
      ],
    ]);
    this.#logger.debug('GamePersistenceService: Instance created.');
  }

  /**
   * Deep clones and cleans component data based on configured cleaners.
   *
   * @param {string} componentId - The component identifier.
   * @param {any} componentData - The raw component data.
   * @returns {any} The cleaned clone of the component data.
   * @private
   */
  #cleanComponentData(componentId, componentData) {
    let dataToSave;
    try {
      dataToSave = deepClone(componentData);
    } catch (e) {
      this.#logger.error(
        'GamePersistenceService.#cleanComponentData deepClone failed:',
        e,
        componentData
      );
      throw new Error('Failed to deep clone object data.');
    }

    const cleaner = this.#componentCleaners.get(componentId);
    if (cleaner) {
      dataToSave = cleaner(dataToSave);
    }
    return dataToSave;
  }

  /**
   * Removes empty `notes` arrays from notes components.
   *
   * @param {any} data - Component data to clean.
   * @returns {any} Cleaned component data.
   * @private
   */
  #cleanNotesComponent(data) {
    if (data.notes && Array.isArray(data.notes) && data.notes.length === 0) {
      this.#logger.debug(
        `Omitting empty 'notes' array from component '${NOTES_COMPONENT_ID}'.`
      );
      delete data.notes;
    }
    return data;
  }

  /**
   * Removes blank `thoughts` strings from short-term memory components.
   *
   * @param {any} data - Component data to clean.
   * @returns {any} Cleaned component data.
   * @private
   */
  #cleanShortTermMemoryComponent(data) {
    if (
      data.thoughts &&
      typeof data.thoughts === 'string' &&
      !data.thoughts.trim()
    ) {
      this.#logger.debug(
        `Omitting blank 'thoughts' from component '${SHORT_TERM_MEMORY_COMPONENT_ID}'.`
      );
      delete data.thoughts;
    }
    return data;
  }

  /**
   * Cleans perception log entries of empty speech fields.
   *
   * @param {any} data - Component data to clean.
   * @returns {any} Cleaned component data.
   * @private
   */
  #cleanPerceptionLogComponent(data) {
    if (data.log && Array.isArray(data.log)) {
      data.log.forEach((entry) => {
        if (
          entry?.action?.speech &&
          typeof entry.action.speech === 'string' &&
          !entry.action.speech.trim()
        ) {
          this.#logger.debug(
            "Omitting blank 'speech' from a perception log entry."
          );
          delete entry.action.speech;
        }
      });
    }
    return data;
  }

  /**
   * Builds the active mods manifest section for the save data.
   *
   * @returns {{modId: string, version: string}[]} Array of active mod info.
   * @private
   */
  #buildActiveModsManifest() {
    /** @type {ModManifest[]} */
    const loadedManifestObjects = this.#dataRegistry.getAll('mod_manifests');
    let activeModsManifest = [];
    if (loadedManifestObjects && loadedManifestObjects.length > 0) {
      activeModsManifest = loadedManifestObjects.map((manifest) => ({
        modId: manifest.id,
        version: manifest.version,
      }));
      this.#logger.debug(
        `GamePersistenceService: Captured ${activeModsManifest.length} active mods from 'mod_manifests' type in registry.`
      );
    } else {
      this.#logger.warn(
        'GamePersistenceService: No mod manifests found in registry under "mod_manifests" type. Mod manifest may be incomplete. Using fallback.'
      );
      const coreModManifest = loadedManifestObjects?.find(
        (m) => m.id === CORE_MOD_ID
      );
      if (coreModManifest) {
        activeModsManifest = [
          { modId: CORE_MOD_ID, version: coreModManifest.version },
        ];
      } else {
        activeModsManifest = [
          { modId: CORE_MOD_ID, version: 'unknown_fallback' },
        ];
      }
      this.#logger.debug(
        'GamePersistenceService: Used fallback for mod manifest.'
      );
    }
    return activeModsManifest;
  }

  /**
   * Creates the metadata block for the save data.
   *
   * @param {string | null | undefined} activeWorldName - Name of the active world.
   * @param {number} playtimeSeconds - Current total playtime.
   * @returns {object} Metadata object for the save file.
   * @private
   */
  #createMetadata(activeWorldName, playtimeSeconds) {
    const currentWorldNameForMeta = activeWorldName || 'Unknown Game';
    if (!activeWorldName) {
      this.#logger.warn(
        `GamePersistenceService.captureCurrentGameState: No activeWorldName was provided by the caller. Defaulting gameTitle to 'Unknown Game'.`
      );
    }
    return {
      saveFormatVersion: '1.0.0',
      engineVersion: '0.1.0-stub',
      gameTitle: currentWorldNameForMeta,
      timestamp: new Date().toISOString(),
      playtimeSeconds,
      saveName: '',
    };
  }

  /**
   * Captures the current game state.
   *
   * @param {string | null | undefined} activeWorldName - The name of the currently active world, passed from GameEngine.
   * @returns {SaveGameStructure} The captured game state object.
   */
  captureCurrentGameState(activeWorldName) {
    this.#logger.debug(
      'GamePersistenceService: Capturing current game state...'
    );

    if (!this.#entityManager)
      throw new Error('EntityManager not available for capturing game state.');
    if (!this.#dataRegistry)
      throw new Error('DataRegistry not available for capturing mod manifest.');
    if (!this.#playtimeTracker)
      throw new Error(
        'PlaytimeTracker not available for capturing game state.'
      );

    const entitiesData = [];
    for (const entity of this.#entityManager.activeEntities.values()) {
      const components = {};
      for (const [componentTypeId, componentData] of entity.componentEntries) {
        if (componentTypeId === CURRENT_ACTOR_COMPONENT_ID) {
          this.#logger.debug(
            `GamePersistenceService.captureCurrentGameState: Skipping component '${CURRENT_ACTOR_COMPONENT_ID}' for entity '${entity.id}' during save.`
          );
          continue;
        }

        const dataToSave = this.#cleanComponentData(
          componentTypeId,
          componentData
        );

        if (dataToSave !== null && typeof dataToSave !== 'object') {
          components[componentTypeId] = dataToSave;
        } else if (Object.keys(dataToSave).length > 0) {
          components[componentTypeId] = dataToSave;
        } else {
          this.#logger.debug(
            `Skipping component '${componentTypeId}' for entity '${entity.id}' as it is empty after cleaning.`
          );
        }
      }
      entitiesData.push({
        instanceId: entity.id,
        definitionId: entity.definitionId,
        components: components,
      });
    }
    this.#logger.debug(
      `GamePersistenceService: Captured ${entitiesData.length} entities.`
    );

    const activeModsManifest = this.#buildActiveModsManifest();

    const currentTotalPlaytime = this.#playtimeTracker.getTotalPlaytime();
    this.#logger.debug(
      `GamePersistenceService: Fetched total playtime: ${currentTotalPlaytime}s.`
    );

    const metadata = this.#createMetadata(
      activeWorldName,
      currentTotalPlaytime
    );

    const gameStateObject = {
      metadata,
      modManifest: {
        activeMods: activeModsManifest,
      },
      gameState: {
        entities: entitiesData,
        playerState: {},
        worldState: {},
        engineInternals: {},
      },
      integrityChecks: {
        gameStateChecksum: 'PENDING_CALCULATION',
      },
    };

    this.#logger.debug(
      `GamePersistenceService: Game state capture complete. Game Title: ${metadata.gameTitle}, ${entitiesData.length} entities captured. Playtime: ${currentTotalPlaytime}s.`
    );
    return gameStateObject;
  }

  isSavingAllowed(isEngineInitialized) {
    if (!isEngineInitialized) {
      this.#logger.warn(
        'GamePersistenceService.isSavingAllowed: Save attempt while engine not initialized.'
      );
      return false;
    }
    this.#logger.debug(
      'GamePersistenceService.isSavingAllowed: Check returned true (currently a basic stub).'
    );
    return true;
  }

  async saveGame(saveName, isEngineInitialized, activeWorldName) {
    this.#logger.debug(
      `GamePersistenceService: Manual save triggered with name: "${saveName}". Active world hint: "${activeWorldName || 'N/A'}".`
    );

    if (!this.#saveLoadService) {
      const errorMsg = 'SaveLoadService is not available. Cannot save game.';
      this.#logger.error(`GamePersistenceService.saveGame: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }

    if (!this.isSavingAllowed(isEngineInitialized)) {
      const errorMsg = 'Saving is not currently allowed.';
      this.#logger.warn(
        `GamePersistenceService.saveGame: Saving is not currently allowed.`
      );
      return { success: false, error: errorMsg };
    }

    try {
      this.#logger.debug(
        `GamePersistenceService.saveGame: Capturing current game state for save "${saveName}".`
      );
      const gameStateObject = this.captureCurrentGameState(activeWorldName);
      if (!gameStateObject.metadata) gameStateObject.metadata = {};
      gameStateObject.metadata.saveName = saveName;
      this.#logger.debug(
        `GamePersistenceService.saveGame: Set saveName "${saveName}" in gameStateObject.metadata.`
      );

      this.#logger.debug(
        `GamePersistenceService.saveGame: Delegating to ISaveLoadService.saveManualGame for "${saveName}".`
      );
      const result = await this.#saveLoadService.saveManualGame(
        saveName,
        gameStateObject
      );

      if (result.success) {
        this.#logger.debug(
          `GamePersistenceService.saveGame: Manual save successful: ${result.message || `Save "${saveName}" completed.`}`
        );
      } else {
        this.#logger.error(
          `GamePersistenceService.saveGame: Manual save failed: ${result.error || 'Unknown error from SaveLoadService.'}`
        );
      }
      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'An unknown error occurred.';
      this.#logger.error(
        `GamePersistenceService.saveGame: An unexpected error occurred during saveGame for "${saveName}": ${errorMessage}`,
        error
      );
      return {
        success: false,
        error: `Unexpected error during save: ${errorMessage}`,
      };
    }
  }

  async restoreGameState(deserializedSaveData) {
    this.#logger.debug(
      'GamePersistenceService.restoreGameState: Starting game state restoration...'
    );

    if (!deserializedSaveData?.gameState) {
      const errorMsg =
        'Invalid save data structure provided (missing gameState).';
      this.#logger.error(
        `GamePersistenceService.restoreGameState: ${errorMsg}`
      );
      return { success: false, error: errorMsg };
    }
    if (!this.#entityManager)
      return { success: false, error: 'EntityManager not available.' };
    if (!this.#playtimeTracker)
      return { success: false, error: 'PlaytimeTracker not available.' };

    try {
      this.#entityManager.clearAll();
      this.#logger.debug(
        'GamePersistenceService.restoreGameState: Existing entity state cleared.'
      );
    } catch (error) {
      const errorMsg = `Failed to clear existing entity state: ${error.message}`;
      this.#logger.error(
        `GamePersistenceService.restoreGameState: ${errorMsg}`,
        error
      );
      return {
        success: false,
        error: `Critical error during state clearing: ${errorMsg}`,
      };
    }

    this.#logger.debug(
      'GamePersistenceService.restoreGameState: Restoring entities...'
    );
    const entitiesToRestore = deserializedSaveData.gameState.entities;

    if (!Array.isArray(entitiesToRestore)) {
      this.#logger.warn(
        'GamePersistenceService.restoreGameState: entitiesToRestore is not an array. No entities will be restored.'
      );
    } else {
      for (const savedEntityData of entitiesToRestore) {
        if (!savedEntityData?.instanceId || !savedEntityData?.definitionId) {
          this.#logger.warn(
            `GamePersistenceService.restoreGameState: Invalid entity data in save (missing instanceId or definitionId). Skipping. Data: ${JSON.stringify(savedEntityData)}`
          );
          continue;
        }
        try {
          // When restoring, we explicitly tolerate missing keys (like 'thoughts' or 'notes')
          // because reconstructEntity should not fail if a property is missing from the data.
          const restoredEntity =
            this.#entityManager.reconstructEntity(savedEntityData);
          if (!restoredEntity) {
            this.#logger.warn(
              `GamePersistenceService.restoreGameState: Failed to restore entity with instanceId: ${savedEntityData.instanceId} (Def: ${savedEntityData.definitionId}). reconstructEntity indicated failure.`
            );
          }
        } catch (entityError) {
          this.#logger.warn(
            `GamePersistenceService.restoreGameState: Error during reconstructEntity for instanceId: ${savedEntityData.instanceId}. Error: ${entityError.message}. Skipping.`,
            entityError
          );
        }
      }
    }
    this.#logger.debug(
      'GamePersistenceService.restoreGameState: Entity restoration complete.'
    );

    if (
      deserializedSaveData.metadata &&
      typeof deserializedSaveData.metadata.playtimeSeconds === 'number'
    ) {
      try {
        this.#playtimeTracker.setAccumulatedPlaytime(
          deserializedSaveData.metadata.playtimeSeconds
        );
        this.#logger.debug(
          `GamePersistenceService.restoreGameState: Restored accumulated playtime: ${deserializedSaveData.metadata.playtimeSeconds}s.`
        );
      } catch (playtimeError) {
        this.#logger.error(
          `GamePersistenceService.restoreGameState: Error setting accumulated playtime: ${playtimeError.message}. Resetting.`,
          playtimeError
        );
        this.#playtimeTracker.setAccumulatedPlaytime(0);
      }
    } else {
      this.#logger.warn(
        'GamePersistenceService.restoreGameState: Playtime data not found/invalid. Resetting playtime.'
      );
      this.#playtimeTracker.setAccumulatedPlaytime(0);
    }

    this.#logger.debug(
      'GamePersistenceService.restoreGameState: Skipping turn count restoration as TurnManager is restarted on load.'
    );

    this.#logger.debug(
      'GamePersistenceService.restoreGameState: Placeholder for PlayerState/WorldState restoration.'
    );
    this.#logger.debug(
      'GamePersistenceService.restoreGameState: Game state restoration process complete.'
    );
    return { success: true };
  }

  async loadAndRestoreGame(saveIdentifier) {
    this.#logger.debug(
      `GamePersistenceService: Attempting to load and restore game from: ${saveIdentifier}.`
    );
    if (!this.#saveLoadService) {
      return {
        success: false,
        error: 'SaveLoadService is not available.',
        data: null,
      };
    }

    let loadResult;
    try {
      loadResult = await this.#saveLoadService.loadGameData(saveIdentifier);
    } catch (serviceError) {
      const errorMsg = `Unexpected error calling SaveLoadService.loadGameData for "${saveIdentifier}": ${serviceError.message}`;
      this.#logger.error(
        `GamePersistenceService.loadAndRestoreGame: ${errorMsg}`,
        serviceError
      );
      return {
        success: false,
        error: `Unexpected error during data loading: ${serviceError.message}`,
        data: null,
      };
    }

    if (!loadResult?.success || !loadResult?.data) {
      const reason = loadResult?.error || 'Load failed or no data returned.';
      this.#logger.error(
        `GamePersistenceService.loadAndRestoreGame: Failed to load raw game data from ${saveIdentifier}. Reason: ${reason}`
      );
      return {
        success: false,
        error: loadResult?.error || 'Failed to load raw game data.',
        data: null,
      };
    }

    this.#logger.debug(
      `GamePersistenceService.loadAndRestoreGame: Raw game data loaded from ${saveIdentifier}. Restoring state.`
    );
    const gameDataToRestore = /** @type {SaveGameStructure} */ (
      loadResult.data
    );
    const restoreResult = await this.restoreGameState(gameDataToRestore);

    if (restoreResult.success) {
      this.#logger.debug(
        `GamePersistenceService.loadAndRestoreGame: Game state restored successfully for ${saveIdentifier}.`
      );
      return { success: true, data: gameDataToRestore };
    } else {
      this.#logger.error(
        `GamePersistenceService.loadAndRestoreGame: Failed to restore game state for ${saveIdentifier}. Error: ${restoreResult.error}`
      );
      return {
        success: false,
        error: restoreResult.error || 'Failed to restore game state.',
        data: null,
      };
    }
  }
}

export default GamePersistenceService;
