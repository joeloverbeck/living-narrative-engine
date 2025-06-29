// src/services/entityDisplayDataProvider.js

import {
  PORTRAIT_COMPONENT_ID,
  POSITION_COMPONENT_ID,
} from '../constants/componentIds.js';
import { validateDependency } from '../utils/dependencyUtils.js';
import { ensureValidLogger } from '../utils/loggerUtils.js';
import { buildPortraitInfo } from './utils/portraitUtils.js';
import { withEntity } from './utils/entityFetchHelpers.js';
import { getDisplayName, getDescription } from './utils/displayHelpers.js';

/**
 * @typedef {import('../interfaces/IEntityManager.js').IEntityManager} IEntityManager
 * @typedef {import('../interfaces/ILogger.js').ILogger} ILogger
 * @typedef {import('./entity.js').default} Entity
 * @typedef {import('../interfaces/CommonTypes.js').NamespacedId} NamespacedId
 * @typedef {import('./services/locationDisplayService.js').LocationDisplayService} LocationDisplayService
 */

/**
 * Service to centralize common entity data retrieval and preparation logic for UI display.
 * It encapsulates fetching entities and their component data, processing it for display,
 * and handling cases where entities or components are not found.
 */
export class EntityDisplayDataProvider {
  /** @type {IEntityManager} */
  #entityManager;
  /** @type {ILogger} */
  #logger;
  /** @type {ISafeEventDispatcher} */
  #safeEventDispatcher;
  /** @type {LocationDisplayService} */
  #locationDisplayService;

  /**
   * @private
   * @readonly
   * @type {string}
   */
  _logPrefix = '[EntityDisplayDataProvider]';

  /**
   * Creates an instance of EntityDisplayDataProvider.
   *
   * @param {object} dependencies - The dependencies for the service.
   * @param {IEntityManager} dependencies.entityManager - The entity manager instance.
   * @param {ILogger} dependencies.logger - The logger instance.
   * @param {ISafeEventDispatcher} dependencies.safeEventDispatcher - The safe event dispatcher instance.
   * @param {LocationDisplayService} dependencies.locationDisplayService - Service for location display queries.
   */
  constructor({
    entityManager,
    logger,
    safeEventDispatcher,
    locationDisplayService,
  }) {
    validateDependency(logger, 'logger', console, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });
    const effectiveLogger = ensureValidLogger(
      logger,
      'EntityDisplayDataProvider'
    );

    validateDependency(entityManager, 'entityManager', effectiveLogger, {
      requiredMethods: ['getEntityInstance'],
    });

    validateDependency(
      safeEventDispatcher,
      'safeEventDispatcher',
      effectiveLogger,
      {
        requiredMethods: ['dispatch'],
      }
    );

    validateDependency(
      locationDisplayService,
      'locationDisplayService',
      effectiveLogger,
      {
        requiredMethods: ['getLocationDetails', 'getLocationPortraitData'],
      }
    );

    this.#entityManager = entityManager;
    this.#logger = effectiveLogger;
    this.#safeEventDispatcher = safeEventDispatcher;
    this.#locationDisplayService = locationDisplayService;
    this.#logger.debug(`${this._logPrefix} Service instantiated.`);
  }

  /**
   * Retrieves the display name of an entity.
   * Falls back to entity ID if the name component is missing, then to a default name.
   *
   * @param {NamespacedId | string} entityId - The ID of the entity.
   * @param {string} [defaultName] - The default name to return if the entity or its name cannot be determined.
   * @returns {string} The entity's display name, its ID, or the default name.
   */
  getEntityName(entityId, defaultName = 'Unknown Entity') {
    return getDisplayName(
      this.#entityManager,
      entityId,
      defaultName,
      this.#logger,
      this._logPrefix
    );
  }

  /**
   * Retrieves the full image path for an entity's portrait.
   * Constructs the path using the mod ID derived from the entity's definitionId and the imagePath from its PORTRAIT_COMPONENT.
   *
   * @param {NamespacedId | string} entityId - The ID of the entity.
   * @returns {string | null} The full path to the portrait image
   * (e.g., /data/mods/core/portraits/hero.png), or null when the entity
   * is missing or lacks a valid PORTRAIT_COMPONENT.
   */
  getEntityPortraitPath(entityId) {
    return withEntity(
      this.#entityManager,
      entityId,
      null,
      (entity) => {
        const info = buildPortraitInfo(
          entity,
          'getEntityPortraitPath',
          this.#logger,
          this.#safeEventDispatcher,
          this._logPrefix
        );
        return info ? info.path : null;
      },
      this.#logger,
      this._logPrefix,
      `getEntityPortraitPath: Entity with ID '${entityId}' not found.`
    );
  }

  /**
   * Retrieves the description of an entity.
   *
   * @param {NamespacedId | string} entityId - The ID of the entity.
   * @param {string} [defaultDescription] - The default description to return if the entity or its description component is not found.
   * @returns {string} The entity's description or the default description.
   */
  getEntityDescription(entityId, defaultDescription = '') {
    return getDescription(
      this.#entityManager,
      entityId,
      defaultDescription,
      this.#logger,
      this._logPrefix
    );
  }

  /**
   * Retrieves the location ID of an entity from its POSITION_COMPONENT.
   *
   * @param {NamespacedId | string} entityId - The ID of the entity.
   * @returns {NamespacedId | string | null} The location ID (an entity instance ID)
   * or null if the entity is missing or lacks a valid POSITION_COMPONENT.
   */
  getEntityLocationId(entityId) {
    return withEntity(
      this.#entityManager,
      entityId,
      null,
      (entity) => {
        this.#logger.debug(
          `${this._logPrefix} getEntityLocationId: Found entity '${entityId}' with type: ${
            entity.constructor?.name || 'unknown'
          }, has getComponentData: ${typeof entity.getComponentData === 'function'}`
        );

        const positionComponent = entity.getComponentData(
          POSITION_COMPONENT_ID
        );
        this.#logger.debug(
          `${this._logPrefix} getEntityLocationId: Position component for '${entityId}':`,
          positionComponent
        );

        if (
          positionComponent &&
          typeof positionComponent.locationId === 'string' &&
          positionComponent.locationId.trim()
        ) {
          return positionComponent.locationId;
        }

        this.#logger.debug(
          `${this._logPrefix} getEntityLocationId: Entity '${entityId}' found, but no valid POSITION_COMPONENT_ID data or locationId.`
        );
        return null;
      },
      this.#logger,
      this._logPrefix,
      `getEntityLocationId: Entity with ID '${entityId}' not found.`
    );
  }

  /**
   * Compiles a display information object for a character entity.
   * This object includes the entity's ID, name, description, and portrait path.
   *
   * @param {NamespacedId | string} entityId - The ID of the character entity.
   * @returns {{ id: string, name: string, description: string, portraitPath: string | null } | null}
   * An object with character display information, or null when the entity is missing
   * or required components are invalid.
   */
  getCharacterDisplayInfo(entityId) {
    return withEntity(
      this.#entityManager,
      entityId,
      null,
      (entity) => ({
        id: entity.id,
        name: this.getEntityName(entityId, entity.id),
        description: this.getEntityDescription(entityId),
        portraitPath: this.getEntityPortraitPath(entityId),
      }),
      this.#logger,
      this._logPrefix,
      `getCharacterDisplayInfo: Entity with ID '${entityId}' not found.`
    );
  }

  /**
   * Retrieves detailed display information for a location entity.
   *
   * @param {NamespacedId | string} locationEntityId - The instance ID of the location entity.
   * @returns {{ name: string, description: string, exits: Array<import('./services/locationDisplayService.js').ProcessedExit> } | null}
   */
  getLocationDetails(locationEntityId) {
    return this.#locationDisplayService.getLocationDetails(locationEntityId);
  }

  /**
   * NEW METHOD
   * Retrieves portrait data (image path and alt text) for a given location entity.
   * A location entity must have a "core:portrait" component for this to return data.
   *
   * @param {NamespacedId | string} locationEntityId - The ID of the location entity.
   * @returns {import('./services/locationDisplayService.js').PortraitData | null} Portrait data { imagePath: string, altText: string | null }
   * or null when the entity is missing or lacks a valid PORTRAIT_COMPONENT.
   */
  getLocationPortraitData(locationEntityId) {
    return this.#locationDisplayService.getLocationPortraitData(
      locationEntityId
    );
  }
}
