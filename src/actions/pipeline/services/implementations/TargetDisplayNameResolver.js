/**
 * @file TargetDisplayNameResolver - Service for resolving entity display names
 * @see MultiTargetResolutionStage.js
 */

import { BaseService } from '../base/BaseService.js';
import { ServiceError, ServiceErrorCodes } from '../base/ServiceError.js';
import { validateDependency } from '../../../../utils/dependencyUtils.js';

/** @typedef {import('../../../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../../interfaces/coreServices.js').IEntityManager} IEntityManager */
/** @typedef {import('../../../../entities/entity.js').default} Entity */

/**
 * @typedef {object} DisplayNameOptions
 * @property {boolean} [includeTitle] - Include title/role if available
 * @property {boolean} [includeId] - Include entity ID as fallback
 * @property {string} [defaultName] - Default name if none found
 * @property {boolean} [preferShortName] - Prefer short name over full name
 */

/**
 * @typedef {object} DisplayNameResult
 * @property {string} displayName - The resolved display name
 * @property {string} source - Source of the name (e.g., 'name', 'shortName', 'id', 'default')
 * @property {boolean} isDefault - Whether default name was used
 */

/**
 * Service for resolving entity display names for target presentation
 *
 * Provides:
 * - Consistent display name resolution using exact logic from MultiTargetResolutionStage
 * - Batch processing support for multiple entities
 * - Configurable fallback handling
 * - Entity manager integration
 * - Interface compliance with ITargetDisplayNameResolver
 */
export class TargetDisplayNameResolver extends BaseService {
  #entityManager;
  #fallbackName = 'Unknown Entity';

  /**
   * @param {object} deps
   * @param {IEntityManager} deps.entityManager
   * @param {ILogger} deps.logger
   */
  constructor({ entityManager, logger }) {
    super({ logger });

    validateDependency(entityManager, 'IEntityManager', null, {
      requiredMethods: ['getEntityInstance'],
    });
    this.#entityManager = entityManager;

    this.logOperation('initialized', {
      service: 'TargetDisplayNameResolver',
      entityManager: entityManager.constructor.name,
    });
  }

  /**
   * Get display name for entity using string ID
   *
   * Extracted from MultiTargetResolutionStage.js lines 713-730
   * Replicates the exact logic: try common name sources, fallback to entityId
   *
   * @param {string} entityId - Entity identifier
   * @returns {string} Display name or entityId as fallback
   */
  getEntityDisplayName(entityId) {
    if (!entityId || typeof entityId !== 'string') {
      this.logOperation(
        'getEntityDisplayName',
        {
          entityId,
          result: 'invalid_id',
        },
        'debug'
      );
      return this.#fallbackName;
    }

    try {
      const entity = this.#entityManager.getEntityInstance(entityId);
      if (!entity) {
        this.logOperation(
          'getEntityDisplayName',
          {
            entityId,
            result: 'entity_not_found',
          },
          'debug'
        );
        return entityId; // Exact fallback behavior from original
      }

      // Extract name using the exact component access pattern from production
      const name = this.#extractDisplayName(entity);

      this.logOperation(
        'getEntityDisplayName',
        {
          entityId,
          result: 'success',
          displayName: name,
        },
        'debug'
      );

      return name || entityId; // Fallback to entityId as in original
    } catch (error) {
      this.logger.warn('Failed to get entity display name', {
        entityId,
        error: error.message,
      });
      return entityId; // Exact error handling from original
    }
  }

  /**
   * Get display name for an entity (interface method)
   *
   * @param {Entity} entity - Entity to get display name for
   * @param {DisplayNameOptions} [options] - Display name options
   * @returns {string} The display name
   */
  getDisplayName(entity, options = {}) {
    if (!entity || !entity.id) {
      return options.defaultName || this.#fallbackName;
    }

    return this.getEntityDisplayName(entity.id);
  }

  /**
   * Get detailed display name information
   *
   * @param {Entity} entity - Entity to get display name for
   * @param {DisplayNameOptions} [options] - Display name options
   * @returns {DisplayNameResult} Detailed display name result
   */
  getDisplayNameDetails(entity, options = {}) {
    if (!entity || !entity.id) {
      const defaultName = options.defaultName || this.#fallbackName;
      return {
        displayName: defaultName,
        source: 'default',
        isDefault: true,
      };
    }

    const displayName = this.getEntityDisplayName(entity.id);
    const isDefault =
      displayName === entity.id || displayName === this.#fallbackName;

    let source = 'id';
    if (!isDefault) {
      // Determine source by checking components
      const nameComponent = entity.getComponentData?.('core:name');
      const descComponent = entity.getComponentData?.('core:description');
      const actorComponent = entity.getComponentData?.('core:actor');
      const itemComponent = entity.getComponentData?.('core:item');

      if (nameComponent?.text === displayName) source = 'name';
      else if (descComponent?.name === displayName) source = 'description';
      else if (actorComponent?.name === displayName) source = 'actor';
      else if (itemComponent?.name === displayName) source = 'item';
    }

    return {
      displayName,
      source,
      isDefault,
    };
  }

  /**
   * Get display names for multiple entities (interface method)
   *
   * @param {Entity[]} entities - Array of entities
   * @param {DisplayNameOptions} [options] - Display name options
   * @returns {Map<string, string>} Map of entity ID to display name
   */
  getDisplayNames(entities, options = {}) {
    if (!Array.isArray(entities)) {
      throw new ServiceError(
        'Entities must be an array',
        ServiceErrorCodes.INVALID_STATE
      );
    }

    const result = new Map();

    this.logOperation('getDisplayNames', {
      count: entities.length,
    });

    for (const entity of entities) {
      if (entity && entity.id) {
        result.set(entity.id, this.getDisplayName(entity, options));
      }
    }

    return result;
  }

  /**
   * Get display names for multiple entities using string IDs
   *
   * @param {string[]} entityIds - Entity identifiers
   * @returns {Object.<string, string>} Map of ID to display name
   */
  getEntityDisplayNames(entityIds) {
    this.validateParams({ entityIds }, ['entityIds']);

    if (!Array.isArray(entityIds)) {
      throw new ServiceError(
        'Entity IDs must be an array',
        ServiceErrorCodes.INVALID_STATE
      );
    }

    const result = {};

    this.logOperation('getEntityDisplayNames', {
      count: entityIds.length,
    });

    for (const entityId of entityIds) {
      result[entityId] = this.getEntityDisplayName(entityId);
    }

    return result;
  }

  /**
   * Format display name with additional context
   *
   * @param {Entity} entity - Entity to format
   * @param {object} context - Additional formatting context
   * @param {boolean} [context.includeLocation] - Include location in name
   * @param {boolean} [context.includeState] - Include state/condition in name
   * @returns {string} Formatted display name with context
   */
  formatWithContext(entity, context = {}) {
    if (!entity || !entity.id) {
      return this.#fallbackName;
    }

    let displayName = this.getEntityDisplayName(entity.id);

    // Get the actual entity instance with methods
    const actualEntity = this.#entityManager.getEntityInstance(entity.id);
    if (!actualEntity) {
      return displayName;
    }

    // Add location context if requested
    if (context.includeLocation) {
      const locationComponent =
        actualEntity.getComponentData?.('core:location');
      if (locationComponent?.name) {
        displayName += ` (at ${locationComponent.name})`;
      }
    }

    // Add state context if requested
    if (context.includeState) {
      const healthComponent = actualEntity.getComponentData?.('core:health');
      if (
        healthComponent?.current !== undefined &&
        healthComponent?.max !== undefined
      ) {
        const healthPercent = Math.round(
          (healthComponent.current / healthComponent.max) * 100
        );
        if (healthPercent < 100) {
          displayName += ` (${healthPercent}% health)`;
        }
      }
    }

    return displayName;
  }

  /**
   * Check if entity has a valid display name
   *
   * @param {Entity} entity - Entity to check
   * @returns {boolean} True if entity has a non-default display name
   */
  hasValidDisplayName(entity) {
    if (!entity || !entity.id) {
      return false;
    }

    const displayName = this.getEntityDisplayName(entity.id);
    return displayName !== entity.id && displayName !== this.#fallbackName;
  }

  /**
   * Set fallback name for unknown entities
   *
   * @param {string} fallbackName - Default name to use
   */
  setFallbackName(fallbackName) {
    if (typeof fallbackName !== 'string') {
      throw new ServiceError(
        'Fallback name must be a string',
        ServiceErrorCodes.VALIDATION_ERROR
      );
    }

    this.#fallbackName = fallbackName;
    this.logOperation('setFallbackName', { fallbackName });
  }

  /**
   * Extract display name from entity using various strategies
   *
   * Matches the exact logic from MultiTargetResolutionStage.js lines 718-724
   *
   * @param {object} entity - Entity instance
   * @returns {string|null} Display name or null
   * @private
   */
  #extractDisplayName(entity) {
    // Exact component access pattern from production code (lines 719-724)
    const name =
      entity.getComponentData('core:name')?.text ||
      entity.getComponentData('core:description')?.name ||
      entity.getComponentData('core:actor')?.name ||
      entity.getComponentData('core:item')?.name;

    return name || null;
  }
}
