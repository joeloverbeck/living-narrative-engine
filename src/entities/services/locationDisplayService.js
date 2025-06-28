// src/entities/services/locationDisplayService.js

import {
  NAME_COMPONENT_ID,
  DESCRIPTION_COMPONENT_ID,
  EXITS_COMPONENT_ID,
  PORTRAIT_COMPONENT_ID,
} from '../../constants/componentIds.js';
import { validateDependency } from '../../utils/dependencyUtils.js';
import { ensureValidLogger } from '../../utils/loggerUtils.js';
import { isNonBlankString } from '../../utils/textUtils.js';
import { getEntityDisplayName } from '../../utils/entityUtils.js';
import { buildPortraitInfo } from '../utils/portraitUtils.js';
import { InvalidEntityIdError } from '../../errors/invalidEntityIdError.js';

/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../../interfaces/ILogger.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../entity.js').default} Entity */
/** @typedef {import('../../interfaces/CommonTypes.js').NamespacedId} NamespacedId */

/**
 * @typedef {object} ProcessedExit
 * @property {string} description - The direction or description of the exit.
 * @property {NamespacedId | string | undefined} target - The identifier of the target location.
 * @property {NamespacedId | string | undefined} [id] - Alias for target.
 */

/**
 * @typedef {object} PortraitData
 * @property {string} imagePath - The full, resolved path to the portrait image.
 * @property {string | null} altText - The alternative text for the image.
 */

/**
 * @class LocationDisplayService
 * @description Provides display-oriented queries for location entities.
 */
export class LocationDisplayService {
  /** @type {IEntityManager} */
  #entityManager;
  /** @type {ILogger} */
  #logger;
  /** @type {ISafeEventDispatcher} */
  #safeEventDispatcher;

  /** @private */
  _logPrefix = '[LocationDisplayService]';

  /**
   * @param {object} deps
   * @param {IEntityManager} deps.entityManager
   * @param {ILogger} deps.logger
   * @param {ISafeEventDispatcher} deps.safeEventDispatcher
   */
  constructor({ entityManager, logger, safeEventDispatcher }) {
    validateDependency(logger, 'logger', console, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });
    const effectiveLogger = ensureValidLogger(logger, 'LocationDisplayService');

    validateDependency(entityManager, 'entityManager', effectiveLogger, {
      requiredMethods: ['getEntityInstance'],
    });

    validateDependency(
      safeEventDispatcher,
      'safeEventDispatcher',
      effectiveLogger,
      { requiredMethods: ['dispatch'] }
    );

    this.#entityManager = entityManager;
    this.#logger = effectiveLogger;
    this.#safeEventDispatcher = safeEventDispatcher;
    this.#logger.debug(`${this._logPrefix} Service instantiated.`);
  }

  /**
   * @private
   * @param {NamespacedId | string} entityId
   * @returns {Entity}
   * @throws {InvalidEntityIdError}
   */
  #fetchEntity(entityId) {
    if (!entityId) {
      throw new InvalidEntityIdError(entityId);
    }
    return this.#entityManager.getEntityInstance(entityId);
  }

  /**
   * @private
   * @param {NamespacedId | string} entityId
   * @param {*} fallback
   * @param {(entity: Entity) => *} callback
   * @param {string} [notFoundMsg]
   * @returns {*}
   */
  #withEntity(entityId, fallback, callback, notFoundMsg) {
    let entity;
    try {
      entity = this.#fetchEntity(entityId);
    } catch (error) {
      if (error instanceof InvalidEntityIdError) {
        this.#logger.warn(
          `${this._logPrefix} fetchEntity called with null or empty entityId.`
        );
        return fallback;
      }
      throw error;
    }

    if (!entity) {
      if (notFoundMsg) {
        this.#logger.debug(`${this._logPrefix} ${notFoundMsg}`);
      }
      return fallback;
    }

    return callback(entity);
  }

  /**
   * @private
   * @param {NamespacedId | string} entityId
   * @param {string} [defaultName]
   * @returns {string}
   */
  #getEntityName(entityId, defaultName = 'Unknown Entity') {
    return this.#withEntity(
      entityId,
      defaultName,
      (entity) => getEntityDisplayName(entity, defaultName, this.#logger),
      `getEntityName: Entity with ID '${entityId}' not found. Returning default name.`
    );
  }

  /**
   * @private
   * @param {NamespacedId | string} entityId
   * @param {string} [defaultDescription]
   * @returns {string}
   */
  #getEntityDescription(entityId, defaultDescription = '') {
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
   * Retrieves detailed display information for a location entity.
   *
   * @param {NamespacedId | string} locationEntityId
   * @returns {{ name: string, description: string, exits: Array<ProcessedExit> } | null}
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

    const name = this.#getEntityName(locationEntityId, 'Unnamed Location');
    const description = this.#getEntityDescription(
      locationEntityId,
      'No description available.'
    );

    const exitsComponentData =
      locationEntity.getComponentData(EXITS_COMPONENT_ID);
    let processedExits = [];

    if (exitsComponentData && Array.isArray(exitsComponentData)) {
      processedExits = this.parseRawExits(exitsComponentData, locationEntityId);
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
   * Retrieves portrait data for a location entity.
   *
   * @param {NamespacedId | string} locationEntityId
   * @returns {PortraitData | null}
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
        const info = buildPortraitInfo(
          entity,
          'getLocationPortraitData',
          this.#logger,
          this.#safeEventDispatcher,
          this._logPrefix
        );
        if (!info) return null;
        return { imagePath: info.path, altText: info.altText };
      },
      `getLocationPortraitData: Location entity with ID '${locationEntityId}' not found.`
    );
  }

  /**
   * @param {Array<*>} exitsComponentData
   * @param {NamespacedId | string} locationEntityId
   * @returns {ProcessedExit[]}
   */
  parseRawExits(exitsComponentData, locationEntityId) {
    if (!Array.isArray(exitsComponentData)) {
      return [];
    }
    return exitsComponentData
      .map((exit) => this.#normalizeExitItem(exit, locationEntityId))
      .filter((exit) => exit !== null);
  }

  /**
   * @param {*} exit
   * @param {NamespacedId | string} locationEntityId
   * @returns {ProcessedExit | null}
   */
  #normalizeExitItem(exit, locationEntityId) {
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
  }
}

export default LocationDisplayService;
