// src/persistence/gameStateCaptureService.js
// --- FILE START ---

import { CURRENT_ACTOR_COMPONENT_ID } from '../constants/componentIds.js';
import { CHECKSUM_PENDING } from '../constants/persistence.js';
import { BaseService } from '../utils/serviceBase.js';

/**
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../entities/entityManager.js').default} EntityManager
 * @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry
 * @typedef {import('../engine/playtimeTracker.js').default} PlaytimeTracker
 * @typedef {import('./componentCleaningService.js').default} ComponentCleaningService
 * @typedef {import('./saveMetadataBuilder.js').default} SaveMetadataBuilder
 * @typedef {import('./activeModsManifestBuilder.js').default} ActiveModsManifestBuilder
 * @typedef {import('../entities/entity.js').default} Entity
 */

/**
 * @class GameStateCaptureService
 * @description Captures the current game state for saving.
 */
class GameStateCaptureService extends BaseService {
  /** @type {ILogger} */
  #logger;
  /** @type {EntityManager} */
  #entityManager;
  /** @type {PlaytimeTracker} */
  #playtimeTracker;
  /** @type {ComponentCleaningService} */
  #componentCleaningService;
  /** @type {SaveMetadataBuilder} */
  #metadataBuilder;
  /** @type {ActiveModsManifestBuilder} */
  #activeModsManifestBuilder;

  /**
   * Creates a new GameStateCaptureService instance.
   *
   * @param {object} deps - Constructor dependencies.
   * @param {ILogger} deps.logger - Logging service.
   * @param {EntityManager} deps.entityManager - Entity manager.
   * @param {PlaytimeTracker} deps.playtimeTracker - Playtime tracker.
   * @param {ComponentCleaningService} deps.componentCleaningService - Component cleaning service.
   * @param {SaveMetadataBuilder} deps.metadataBuilder - Builder for save metadata.
   * @param {ActiveModsManifestBuilder} deps.activeModsManifestBuilder - Builder for active mods manifest.
   */
  constructor({
    logger,
    entityManager,
    playtimeTracker,
    componentCleaningService,
    metadataBuilder,
    activeModsManifestBuilder,
  }) {
    super();
    this.#logger = this._init('GameStateCaptureService', logger, {
      entityManager: { value: entityManager },
      playtimeTracker: {
        value: playtimeTracker,
        requiredMethods: ['getTotalPlaytime'],
      },
      componentCleaningService: {
        value: componentCleaningService,
        requiredMethods: ['clean'],
      },
      metadataBuilder: { value: metadataBuilder, requiredMethods: ['build'] },
      activeModsManifestBuilder: {
        value: activeModsManifestBuilder,
        requiredMethods: ['build'],
      },
    });
    this.#entityManager = entityManager;
    this.#playtimeTracker = playtimeTracker;
    this.#componentCleaningService = componentCleaningService;
    this.#metadataBuilder = metadataBuilder;
    this.#activeModsManifestBuilder = activeModsManifestBuilder;
    this.#logger.debug('GameStateCaptureService: Instance created.');
  }

  /**
   * Determines if cleaned component data should be saved.
   *
   * @param {*} data - Component data after cleaning.
   * @returns {boolean} True if data is non-null and either not an object or an
   * object with at least one key.
   * @private
   */
  #hasMeaningfulData(data) {
    return (
      data !== null &&
      data !== undefined &&
      (typeof data !== 'object' || Object.keys(data).length > 0)
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
   * @returns {{instanceId: string, definitionId: string, overrides: Record<string, any>}}
   * Clean serialized representation of the entity.
   * @private
   */
  #serializeEntity(entity) {
    const overrides = this.#applyComponentCleaners(
      entity.componentEntries,
      entity.id
    );
    return {
      instanceId: entity.id,
      definitionId: entity.definitionId,
      overrides,
    };
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

    const entitiesData = [];
    for (const entity of this.#entityManager.activeEntities.values()) {
      entitiesData.push(this.#serializeEntity(entity));
    }
    this.#logger.debug(
      `GameStateCaptureService: Captured ${entitiesData.length} entities.`
    );

    const activeModsManifest = this.#activeModsManifestBuilder.build();

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
        gameStateChecksum: CHECKSUM_PENDING,
      },
    };

    this.#logger.debug(
      `GameStateCaptureService: Game state capture complete. Game Title: ${metadata.gameTitle}, ${entitiesData.length} entities captured. Playtime: ${currentTotalPlaytime}s.`
    );
    return gameStateObject;
  }
}

export default GameStateCaptureService;
// --- FILE END ---
