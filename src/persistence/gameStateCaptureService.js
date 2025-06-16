// src/persistence/gameStateCaptureService.js

import { CURRENT_ACTOR_COMPONENT_ID } from '../constants/componentIds.js';
import { CORE_MOD_ID } from '../constants/core.js';
import { setupService } from '../utils/serviceInitializer.js';

/**
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../entities/entityManager.js').default} EntityManager
 * @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry
 * @typedef {import('../engine/playtimeTracker.js').default} PlaytimeTracker
 * @typedef {import('./componentCleaningService.js').default} ComponentCleaningService
 * @typedef {import('./saveMetadataBuilder.js').default} SaveMetadataBuilder
 * @typedef {import('../entities/entity.js').default} Entity
 */

/**
 * @class GameStateCaptureService
 * @description Captures the current game state for saving.
 */
class GameStateCaptureService {
  /** @type {ILogger} */
  #logger;
  /** @type {EntityManager} */
  #entityManager;
  /** @type {IDataRegistry} */
  #dataRegistry;
  /** @type {PlaytimeTracker} */
  #playtimeTracker;
  /** @type {ComponentCleaningService} */
  #componentCleaningService;
  /** @type {SaveMetadataBuilder} */
  #metadataBuilder;

  /**
   * Creates a new GameStateCaptureService instance.
   *
   * @param {object} deps - Constructor dependencies.
   * @param {ILogger} deps.logger - Logging service.
   * @param {EntityManager} deps.entityManager - Entity manager.
   * @param {IDataRegistry} deps.dataRegistry - Data registry.
   * @param {PlaytimeTracker} deps.playtimeTracker - Playtime tracker.
   * @param {ComponentCleaningService} deps.componentCleaningService - Component cleaning service.
   * @param {SaveMetadataBuilder} deps.metadataBuilder - Builder for save metadata.
   */
  constructor({
    logger,
    entityManager,
    dataRegistry,
    playtimeTracker,
    componentCleaningService,
    metadataBuilder,
  }) {
    this.#logger = setupService('GameStateCaptureService', logger, {
      entityManager: { value: entityManager },
      dataRegistry: { value: dataRegistry, requiredMethods: ['getAll'] },
      playtimeTracker: {
        value: playtimeTracker,
        requiredMethods: ['getTotalPlaytime'],
      },
      componentCleaningService: {
        value: componentCleaningService,
        requiredMethods: ['clean'],
      },
      metadataBuilder: { value: metadataBuilder, requiredMethods: ['build'] },
    });
    this.#entityManager = entityManager;
    this.#dataRegistry = dataRegistry;
    this.#playtimeTracker = playtimeTracker;
    this.#componentCleaningService = componentCleaningService;
    this.#metadataBuilder = metadataBuilder;
    this.#logger.debug('GameStateCaptureService: Instance created.');
  }

  /**
   * Determines if cleaned component data should be saved.
   *
   * @param {*} data - Component data after cleaning.
   * @returns {boolean} True if data is non-null and either not an object or an
   *   object with at least one key.
   * @private
   */
  #hasMeaningfulData(data) {
    return (
      data != null && (typeof data !== 'object' || Object.keys(data).length > 0)
    );
  }

  /**
   * Cleans and prepares component data for serialization.
   *
   * @param {Map<string, any>} componentEntries - Raw component map from the entity.
   * @param {string} entityId - Identifier of the owning entity.
   * @returns {Record<string, any>} Object containing cleaned components.
   * @private
   */
  #applyComponentCleaners(componentEntries, entityId) {
    const components = {};
    for (const [componentTypeId, componentData] of componentEntries) {
      if (componentTypeId === CURRENT_ACTOR_COMPONENT_ID) {
        this.#logger.debug(
          `GameStateCaptureService.captureCurrentGameState: Skipping component '${CURRENT_ACTOR_COMPONENT_ID}' for entity '${entityId}' during save.`
        );
        continue;
      }

      const dataToSave = this.#componentCleaningService.clean(
        componentTypeId,
        componentData
      );

      if (this.#hasMeaningfulData(dataToSave)) {
        components[componentTypeId] = dataToSave;
      } else {
        this.#logger.debug(
          `Skipping component '${componentTypeId}' for entity '${entityId}' as it is empty after cleaning.`
        );
      }
    }
    return components;
  }

  /**
   * Serializes a single entity for saving.
   *
   * @param {Entity} entity - The entity instance to serialize.
   * @returns {{instanceId: string, definitionId: string, components: Record<string, any>}}
   *   Clean serialized representation of the entity.
   * @private
   */
  #serializeEntity(entity) {
    const components = this.#applyComponentCleaners(
      entity.componentEntries,
      entity.id
    );
    return {
      instanceId: entity.id,
      definitionId: entity.definitionId,
      components,
    };
  }

  /**
   * Builds the active mods manifest section for the save data.
   *
   * @returns {{modId: string, version: string}[]} Array of active mod info.
   * @private
   */
  #buildActiveModsManifest() {
    /** @type {import('../../data/schemas/mod.manifest.schema.json').ModManifest[]} */
    const loadedManifestObjects = this.#dataRegistry.getAll('mod_manifests');
    let activeModsManifest = [];
    if (loadedManifestObjects && loadedManifestObjects.length > 0) {
      activeModsManifest = loadedManifestObjects.map((manifest) => ({
        modId: manifest.id,
        version: manifest.version,
      }));
      this.#logger.debug(
        `GameStateCaptureService: Captured ${activeModsManifest.length} active mods from 'mod_manifests' type in registry.`
      );
    } else {
      this.#logger.warn(
        'GameStateCaptureService: No mod manifests found in registry under "mod_manifests" type. Mod manifest may be incomplete. Using fallback.'
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
        'GameStateCaptureService: Used fallback for mod manifest.'
      );
    }
    return activeModsManifest;
  }

  /**
   * Captures the current game state.
   *
   * @param {string | null | undefined} activeWorldName - The name of the currently active world.
   * @returns {import('../interfaces/ISaveLoadService.js').SaveGameStructure} The captured game state object.
   */
  captureCurrentGameState(activeWorldName) {
    this.#logger.debug(
      'GameStateCaptureService: Capturing current game state...'
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
      entitiesData.push(this.#serializeEntity(entity));
    }
    this.#logger.debug(
      `GameStateCaptureService: Captured ${entitiesData.length} entities.`
    );

    const activeModsManifest = this.#buildActiveModsManifest();

    const currentTotalPlaytime = this.#playtimeTracker.getTotalPlaytime();
    this.#logger.debug(
      `GameStateCaptureService: Fetched total playtime: ${currentTotalPlaytime}s.`
    );

    const metadata = this.#metadataBuilder.build(
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
      `GameStateCaptureService: Game state capture complete. Game Title: ${metadata.gameTitle}, ${entitiesData.length} entities captured. Playtime: ${currentTotalPlaytime}s.`
    );
    return gameStateObject;
  }
}

export default GameStateCaptureService;
