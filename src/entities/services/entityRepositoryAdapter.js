/**
 * @file EntityRepositoryAdapter - Encapsulates entity storage operations
 * @description Provides a clean interface for entity storage operations,
 * wrapping the MapManager functionality with proper error handling and logging.
 */

import { MapManager } from '../../utils/mapManagerUtils.js';
import { validateDependency } from '../../utils/dependencyUtils.js';
import { ensureValidLogger } from '../../utils/loggerUtils.js';
import { EntityNotFoundError } from '../../errors/entityNotFoundError.js';
import { DuplicateEntityError } from '../../errors/duplicateEntityError.js';
import MonitoringCoordinator from '../monitoring/MonitoringCoordinator.js';

/** @typedef {import('../entity.js').default} Entity */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../monitoring/MonitoringCoordinator.js').default} MonitoringCoordinator */

/**
 * @class EntityRepositoryAdapter
 * @description Provides a service layer for entity storage operations,
 * encapsulating MapManager functionality with proper error handling.
 */
export class EntityRepositoryAdapter {
  /** @type {MapManager} @private */
  #mapManager;
  /** @type {ILogger} @private */
  #logger;
  /** @type {Map<string, Set<string>>} @private - componentType -> Set<entityId> */
  #componentIndex;
  /** @type {MonitoringCoordinator} @private */
  #monitoringCoordinator;

  /**
   * @param {object} deps - Dependencies
   * @param {ILogger} deps.logger - Logger instance
   * @param {MonitoringCoordinator} [deps.monitoringCoordinator] - Monitoring coordinator
   */
  constructor({ logger, monitoringCoordinator }) {
    validateDependency(logger, 'ILogger', console, {
      requiredMethods: ['info', 'error', 'warn', 'debug'],
    });

    // MonitoringCoordinator is optional
    if (monitoringCoordinator) {
      validateDependency(
        monitoringCoordinator,
        'MonitoringCoordinator',
        console,
        {
          requiredMethods: ['executeMonitored', 'getCircuitBreaker'],
        }
      );
    }

    this.#logger = ensureValidLogger(logger, 'EntityRepositoryAdapter');
    this.#mapManager = new MapManager({ throwOnInvalidId: false });
    this.#componentIndex = new Map();
    this.#monitoringCoordinator = monitoringCoordinator;

    this.#logger.debug(
      'EntityRepositoryAdapter initialized with component index.'
    );
  }

  /**
   * Add an entity to the repository.
   *
   * @param {Entity} entity - Entity to add
   * @throws {DuplicateEntityError} If entity with same ID already exists
   */
  add(entity) {
    // If monitoring is enabled, wrap the execution synchronously
    if (this.#monitoringCoordinator) {
      const performanceMonitor =
        this.#monitoringCoordinator.getPerformanceMonitor();
      return performanceMonitor.timeSync(
        'repository.add',
        () => this.#addCore(entity),
        `entity:${entity.id}`
      );
    }

    // Otherwise, execute directly
    return this.#addCore(entity);
  }

  /**
   * Core implementation of add.
   *
   * @private
   * @param {Entity} entity - Entity to add
   * @throws {DuplicateEntityError} If entity with same ID already exists
   */
  #addCore(entity) {
    if (this.#mapManager.has(entity.id)) {
      const msg = `Entity with ID '${entity.id}' already exists in repository.`;
      this.#logger.error(msg);
      throw new DuplicateEntityError(entity.id, msg);
    }

    this.#mapManager.add(entity.id, entity);

    // Index the entity's components
    this.#indexEntityComponents(entity);

    this.#logger.debug(
      `Entity '${entity.id}' added to repository with ${entity.componentTypeIds?.length || 0} components indexed.`
    );
  }

  /**
   * Get an entity by ID.
   *
   * @param {string} entityId - Entity ID to lookup
   * @returns {Entity|undefined} Entity if found, undefined otherwise
   */
  get(entityId) {
    // If monitoring is enabled, wrap the execution synchronously
    if (this.#monitoringCoordinator) {
      const performanceMonitor =
        this.#monitoringCoordinator.getPerformanceMonitor();
      return performanceMonitor.timeSync(
        'repository.get',
        () => this.#getCore(entityId),
        `entity:${entityId}`
      );
    }

    // Otherwise, execute directly
    return this.#getCore(entityId);
  }

  /**
   * Core implementation of get.
   *
   * @private
   * @param {string} entityId - Entity ID to lookup
   * @returns {Entity|undefined} Entity if found, undefined otherwise
   */
  #getCore(entityId) {
    return this.#mapManager.get(entityId);
  }

  /**
   * Check if an entity exists in the repository.
   *
   * @param {string} entityId - Entity ID to check
   * @returns {boolean} True if entity exists
   */
  has(entityId) {
    // If monitoring is enabled, wrap the execution synchronously
    if (this.#monitoringCoordinator) {
      const performanceMonitor =
        this.#monitoringCoordinator.getPerformanceMonitor();
      return performanceMonitor.timeSync(
        'repository.has',
        () => this.#hasCore(entityId),
        `entity:${entityId}`
      );
    }

    // Otherwise, execute directly
    return this.#hasCore(entityId);
  }

  /**
   * Core implementation of has.
   *
   * @private
   * @param {string} entityId - Entity ID to check
   * @returns {boolean} True if entity exists
   */
  #hasCore(entityId) {
    return this.#mapManager.has(entityId);
  }

  /**
   * Remove an entity from the repository.
   *
   * @param {string} entityId - Entity ID to remove
   * @returns {boolean} True if entity was removed, false if not found
   * @throws {EntityNotFoundError} If entity is not found
   */
  remove(entityId) {
    // If monitoring is enabled, wrap the execution synchronously
    if (this.#monitoringCoordinator) {
      const performanceMonitor =
        this.#monitoringCoordinator.getPerformanceMonitor();
      return performanceMonitor.timeSync(
        'repository.remove',
        () => this.#removeCore(entityId),
        `entity:${entityId}`
      );
    }

    // Otherwise, execute directly
    return this.#removeCore(entityId);
  }

  /**
   * Core implementation of remove.
   *
   * @private
   * @param {string} entityId - Entity ID to remove
   * @returns {boolean} True if entity was removed, false if not found
   * @throws {EntityNotFoundError} If entity is not found
   */
  #removeCore(entityId) {
    const entity = this.#mapManager.get(entityId);
    if (!entity) {
      const msg = `Entity with ID '${entityId}' not found in repository.`;
      this.#logger.error(msg);
      throw new EntityNotFoundError(entityId);
    }

    // Remove from component index
    this.#unindexEntityComponents(entity);

    const removed = this.#mapManager.remove(entityId);
    if (removed) {
      this.#logger.debug(
        `Entity '${entityId}' removed from repository and component index.`
      );
    }
    return removed;
  }

  /**
   * Clear all entities from the repository.
   */
  clear() {
    this.#mapManager.clear();
    this.#componentIndex.clear();
    this.#logger.info(
      'All entities cleared from repository and component index.'
    );
  }

  /**
   * Get an iterator over all entities in the repository.
   *
   * @returns {IterableIterator<Entity>} Iterator over all entities
   */
  entities() {
    return this.#mapManager.values();
  }

  /**
   * Get the count of entities in the repository.
   *
   * @returns {number} Number of entities
   */
  size() {
    return this.#mapManager.items.size;
  }

  /**
   * Get all entity IDs in the repository.
   *
   * @returns {string[]} Array of all entity IDs
   */
  getAllEntityIds() {
    return Array.from(this.#mapManager.keys());
  }

  /**
   * Get entity IDs that have a specific component type.
   * Returns empty Set if no entities have the component.
   *
   * @param {string} componentType - Component type to search for
   * @returns {Set<string>} Set of entity IDs with the component
   */
  getEntityIdsByComponent(componentType) {
    return this.#componentIndex.get(componentType) || new Set();
  }

  /**
   * Update component index when a component is added to an entity.
   *
   * @param {string} entityId - Entity ID
   * @param {string} componentType - Component type being added
   */
  indexComponentAdd(entityId, componentType) {
    if (!this.#componentIndex.has(componentType)) {
      this.#componentIndex.set(componentType, new Set());
    }
    this.#componentIndex.get(componentType).add(entityId);

    // Debug logging for sitting:allows_sitting component
    if (componentType === 'sitting:allows_sitting') {
      this.#logger.debug(
        `[DEBUG] Indexed sitting:allows_sitting for entity '${entityId}'`,
        {
          entityId,
          componentType,
          indexSize: this.#componentIndex.get(componentType).size,
          allEntitiesWithComponent: Array.from(
            this.#componentIndex.get(componentType)
          ),
        }
      );
    }

    this.#logger.debug(
      `Indexed component '${componentType}' for entity '${entityId}'`
    );
  }

  /**
   * Update component index when a component is removed from an entity.
   *
   * @param {string} entityId - Entity ID
   * @param {string} componentType - Component type being removed
   */
  indexComponentRemove(entityId, componentType) {
    const entitySet = this.#componentIndex.get(componentType);
    if (entitySet) {
      entitySet.delete(entityId);
      if (entitySet.size === 0) {
        this.#componentIndex.delete(componentType);
      }
      this.#logger.debug(
        `Unindexed component '${componentType}' for entity '${entityId}'`
      );
    }
  }

  /**
   * Index all components of an entity.
   *
   * @private
   * @param {Entity} entity - Entity whose components to index
   */
  #indexEntityComponents(entity) {
    if (entity.componentTypeIds) {
      for (const componentType of entity.componentTypeIds) {
        this.indexComponentAdd(entity.id, componentType);
      }
    }
  }

  /**
   * Remove all components of an entity from the index.
   *
   * @private
   * @param {Entity} entity - Entity whose components to unindex
   */
  #unindexEntityComponents(entity) {
    if (entity.componentTypeIds) {
      for (const componentType of entity.componentTypeIds) {
        this.indexComponentRemove(entity.id, componentType);
      }
    }
  }

  /**
   * Batch add multiple entities.
   *
   * @param {Entity[]} entities - Entities to add
   * @returns {object} Results with successes and errors
   */
  batchAdd(entities) {
    const results = [];
    const errors = [];

    for (const entity of entities) {
      try {
        this.add(entity);
        results.push(entity);
      } catch (error) {
        errors.push({ entity, error });
      }
    }

    if (errors.length > 0) {
      this.#logger.warn(`Batch add completed with ${errors.length} errors`);
    }

    return { entities: results, errors };
  }

  /**
   * Batch remove multiple entities.
   *
   * @param {string[]} entityIds - Entity IDs to remove
   * @returns {object} Results with successes and errors
   */
  batchRemove(entityIds) {
    const results = [];
    const errors = [];

    for (const entityId of entityIds) {
      try {
        const removed = this.remove(entityId);
        if (removed) {
          results.push(entityId);
        }
      } catch (error) {
        errors.push({ entityId, error });
      }
    }

    if (errors.length > 0) {
      this.#logger.warn(`Batch remove completed with ${errors.length} errors`);
    }

    return { removedIds: results, errors };
  }
}

export default EntityRepositoryAdapter;
