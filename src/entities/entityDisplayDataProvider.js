// src/services/entityDisplayDataProvider.js

import {
  PORTRAIT_COMPONENT_ID,
  DESCRIPTION_COMPONENT_ID,
  POSITION_COMPONENT_ID,
  EXITS_COMPONENT_ID,
} from '../constants/componentIds.js';
import { validateDependency } from '../utils/validationUtils.js';
import { ensureValidLogger } from '../utils';
import { getEntityDisplayName } from '../utils/entityUtils.js';
import { isNonBlankString } from '../utils/textUtils.js';
import { safeDispatchError } from '../utils/safeDispatchErrorUtils.js';
import { extractModId } from '../utils/idUtils.js';
import { InvalidEntityIdError } from '../errors/invalidEntityIdError.js';

/**
 * @typedef {import('../interfaces/IEntityManager.js').IEntityManager} IEntityManager
 * @typedef {import('../interfaces/ILogger.js').ILogger} ILogger
 * @typedef {import('./entity.js').default} Entity
 * @typedef {import('../interfaces/CommonTypes.js').NamespacedId} NamespacedId
 */

/**
 * @typedef {object} ProcessedExit
 * @property {string} description - The direction or description of the exit (e.g., "north", "a shimmering portal").
 * @property {NamespacedId | string | undefined} target - The identifier of the target location (instance ID or definition ID).
 * @property {NamespacedId | string | undefined} [id] - Alias for target, for compatibility.
 */

/**
 * @typedef {object} PortraitData
 * @property {string} imagePath - The full, resolved path to the portrait image.
 * @property {string | null} altText - The alternative text for the image.
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
   */
  constructor({ entityManager, logger, safeEventDispatcher }) {
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

    this.#entityManager = entityManager;
    this.#logger = effectiveLogger;
    this.#safeEventDispatcher = safeEventDispatcher;
    this.#logger.debug(`${this._logPrefix} Service instantiated.`);
  }

  /**
   * @description Fetches an entity instance, logging a warning if the provided
   * ID is null or empty.
   * @private
   * @param {NamespacedId | string} entityId - The ID of the entity to fetch.
   * @returns {Entity} The fetched entity instance.
   * @throws {InvalidEntityIdError} If entityId is falsy.
   */
  #fetchEntity(entityId) {
    if (!entityId) {
      throw new InvalidEntityIdError(entityId);
    }
    return this.#entityManager.getEntityInstance(entityId);
  }

  /**
   * @description Helper to run logic with a fetched entity if it exists.
   * @private
   * @param {NamespacedId | string} entityId - ID of the entity to fetch.
   * @param {*} fallbackValue - Value to return when entity is missing or ID is invalid.
   * @param {(entity: Entity) => *} callback - Function executed with the entity when found.
   * @param {string} [notFoundMsg] - Optional debug message (without prefix) when entity not found.
   * @returns {*} Result of callback or the fallback value.
   * Falsy entity IDs trigger {@link InvalidEntityIdError} and result in the fallback value.
   */
  #withEntity(entityId, fallbackValue, callback, notFoundMsg) {
    let entity;
    try {
      entity = this.#fetchEntity(entityId);
    } catch (error) {
      if (error instanceof InvalidEntityIdError) {
        this.#logger.warn(
          `${this._logPrefix} fetchEntity called with null or empty entityId.`
        );
        return fallbackValue;
      }
      throw error;
    }

    if (!entity) {
      if (notFoundMsg) {
        this.#logger.debug(`${this._logPrefix} ${notFoundMsg}`);
      }
      return fallbackValue;
    }

    return callback(entity);
  }

  /**
   * @description Builds portrait path and alt text for an entity.
   * @private
   * @param {Entity} entity - The entity instance to read portrait data from.
   * @param {string} contextMsg - The calling method name for log messages.
   * @returns {{ path: string, altText: string | null } | null} Object with path
   * and alt text, or null if portrait data is invalid.
   */
  #buildPortraitInfo(entity, contextMsg) {
    const isLocation = contextMsg === 'getLocationPortraitData';
    const label = isLocation ? 'Location entity' : 'Entity';
    const successSubject = isLocation
      ? `location '${entity.id}'`
      : `'${entity.id}'`;

    const portraitComponent = entity.getComponentData(PORTRAIT_COMPONENT_ID);
    if (
      !portraitComponent ||
      typeof portraitComponent.imagePath !== 'string' ||
      !portraitComponent.imagePath.trim()
    ) {
      this.#logger.debug(
        `${this._logPrefix} ${contextMsg}: ${label} '${entity.id}' has no valid PORTRAIT_COMPONENT_ID data or imagePath.`
      );
      return null;
    }

    const modId = extractModId(entity.definitionId);
    if (!modId) {
      if (typeof entity.definitionId !== 'string' || !entity.definitionId) {
        this.#logger.warn(
          `${this._logPrefix} ${contextMsg}: Invalid or missing definitionId. Expected string, got:`,
          entity.definitionId
        );
      } else {
        safeDispatchError(
          this.#safeEventDispatcher,
          `Entity definitionId '${entity.definitionId}' has invalid format. Expected format 'modId:entityName'.`,
          {
            raw: JSON.stringify({
              definitionId: entity.definitionId,
              expectedFormat: 'modId:entityName',
              functionName: 'extractModId',
            }),
            stack: new Error().stack,
          },
          this.#logger
        );
      }
      return null;
    }

    const imagePath = portraitComponent.imagePath.trim();
    const fullPath = `/data/mods/${modId}/${imagePath}`;
    const altText = isNonBlankString(portraitComponent.altText)
      ? portraitComponent.altText.trim()
      : null;

    this.#logger.debug(
      `${this._logPrefix} ${contextMsg}: Constructed portrait path for ${successSubject}: ${fullPath}`
    );

    return { path: fullPath, altText };
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
    return this.#withEntity(
      entityId,
      defaultName,
      (entity) => getEntityDisplayName(entity, defaultName, this.#logger),
      `getEntityName: Entity with ID '${entityId}' not found. Returning default name.`
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
    return this.#withEntity(
      entityId,
      null,
      (entity) => {
        const info = this.#buildPortraitInfo(entity, 'getEntityPortraitPath');
        return info ? info.path : null;
      },
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
    return this.#withEntity(
      entityId,
      defaultDescription,
      (entity) => {
        const descriptionComponent = entity.getComponentData(
          DESCRIPTION_COMPONENT_ID
        );
        if (
          descriptionComponent &&
          typeof descriptionComponent.text === 'string'
        ) {
          return descriptionComponent.text;
        }

        this.#logger.debug(
          `${this._logPrefix} getEntityDescription: Entity '${entityId}' found, but no valid DESCRIPTION_COMPONENT_ID data. Returning default description.`
        );
        return defaultDescription;
      },
      `getEntityDescription: Entity with ID '${entityId}' not found. Returning default description.`
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
    return this.#withEntity(
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
    return this.#withEntity(
      entityId,
      null,
      (entity) => ({
        id: entity.id,
        name: this.getEntityName(entityId, entity.id),
        description: this.getEntityDescription(entityId),
        portraitPath: this.getEntityPortraitPath(entityId),
      }),
      `getCharacterDisplayInfo: Entity with ID '${entityId}' not found.`
    );
  }

  /**
   * Retrieves detailed display information for a location entity.
   * This includes its name, description, and a processed list of exits.
   *
   * @param {NamespacedId | string} locationEntityId - The instance ID of the location entity.
   * @returns {{ name: string, description: string, exits: Array<ProcessedExit> } | null}
   * Object with location details, or null when the location entity is missing
   * or required components are invalid.
   */
  getLocationDetails(locationEntityId) {
    if (!locationEntityId) {
      this.#logger.warn(
        `${this._logPrefix} getLocationDetails called with null or empty locationEntityId.`
      );
      return null;
    }

    const locationEntity =
      this.#entityManager.getEntityInstance(locationEntityId);
    if (!locationEntity) {
      this.#logger.debug(
        `${this._logPrefix} getLocationDetails: Location entity with ID '${locationEntityId}' not found.`
      );
      return null;
    }

    const name = this.getEntityName(locationEntityId, 'Unnamed Location');
    const description = this.getEntityDescription(
      locationEntityId,
      'No description available.'
    );

    const exitsComponentData =
      locationEntity.getComponentData(EXITS_COMPONENT_ID);
    let processedExits = [];

    if (exitsComponentData && Array.isArray(exitsComponentData)) {
      processedExits = this._parseLocationExits(
        exitsComponentData,
        locationEntityId
      );
    } else if (exitsComponentData) {
      this.#logger.warn(
        `${this._logPrefix} getLocationDetails: Exits component data for location '${locationEntityId}' is present but not an array.`,
        { exitsComponentData }
      );
    }

    return {
      name,
      description,
      exits: processedExits,
    };
  }

  /**
   * NEW METHOD
   * Retrieves portrait data (image path and alt text) for a given location entity.
   * A location entity must have a "core:portrait" component for this to return data.
   *
   * @param {NamespacedId | string} locationEntityId - The ID of the location entity.
   * @returns {PortraitData | null} Portrait data { imagePath: string, altText: string | null }
   * or null when the entity is missing or lacks a valid PORTRAIT_COMPONENT.
   */
  getLocationPortraitData(locationEntityId) {
    if (!locationEntityId) {
      this.#logger.warn(
        `${this._logPrefix} getLocationPortraitData called with null or empty locationEntityId.`
      );
      return null;
    }

    return this.#withEntity(
      locationEntityId,
      null,
      (entity) => {
        const info = this.#buildPortraitInfo(entity, 'getLocationPortraitData');
        if (!info) return null;
        return { imagePath: info.path, altText: info.altText };
      },
      `getLocationPortraitData: Location entity with ID '${locationEntityId}' not found.`
    );
  }

  /**
   * @description Validates and transforms raw exit data into ProcessedExit objects.
   * @private
   * @param {Array<*>} exitsComponentData - Raw exits component data.
   * @param {NamespacedId | string} locationEntityId - ID of the location entity for logging context.
   * @returns {ProcessedExit[]} Array of processed exits.
   */
  _parseLocationExits(exitsComponentData, locationEntityId) {
    if (!Array.isArray(exitsComponentData)) {
      return [];
    }
    return exitsComponentData
      .map((exit) => {
        if (typeof exit !== 'object' || exit === null) {
          this.#logger.warn(
            `${this._logPrefix} getLocationDetails: Invalid exit item in exits component for location '${locationEntityId}'. Skipping.`,
            { exit }
          );
          return null;
        }
        const exitDescription = isNonBlankString(exit.direction)
          ? exit.direction.trim()
          : 'Unspecified Exit';
        const exitTarget = isNonBlankString(exit.target)
          ? exit.target.trim()
          : undefined;

        return {
          description: exitDescription,
          target: exitTarget,
          id: exitTarget,
        };
      })
      .filter((exit) => exit !== null);
  }
}
