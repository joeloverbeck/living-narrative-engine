// src/entities/spatialIndexManager.js

import { POSITION_COMPONENT_ID } from '../constants/componentIds.js';
import { ISpatialIndexManager } from '../interfaces/ISpatialIndexManager.js';
import { MapManager } from '../utils/mapManagerUtils.js';
import { isValidId } from '../utils/idValidation.js';

/**
 * Manages a spatial index mapping location IDs to the entities present
 * based on their position data. Handles entities whose locationId might be null.
 *
 * @implements {ISpatialIndexManager}
 */
class SpatialIndexManager extends MapManager {
  /** @type {import('./interfaces/IBatchSpatialIndexManager.js').default} */
  #batchSpatialIndexManager;
  /** @type {boolean} */
  #enableBatchOperations;

  /**
   * @param {object} dependencies
   * @param {import('../interfaces/coreServices.js').ILogger} dependencies.logger
   * @param {import('./interfaces/IBatchSpatialIndexManager.js').default} [dependencies.batchSpatialIndexManager] - Batch spatial index manager
   * @param {boolean} [dependencies.enableBatchOperations] - Enable batch operations
   */
  constructor({
    logger,
    batchSpatialIndexManager,
    enableBatchOperations = false,
  } = {}) {
    super();
    /** @type {import('../interfaces/coreServices.js').ILogger} */
    this.logger = logger || console;
    this.#batchSpatialIndexManager = batchSpatialIndexManager;
    this.#enableBatchOperations = enableBatchOperations;
    /**
     * The core spatial index.
     * Maps locationId (string) to a Set of entityIds (string) present in that location.
     * Location IDs are always non-null, non-empty strings.
     *
     * @type {Map<string, Set<string>>}
     */
    this.locationIndex = this.items; // Inherits `items` from MapManager
    this.logger.debug('SpatialIndexManager initialized.', {
      batchOperationsEnabled: this.#enableBatchOperations,
    });
  }

  /**
   * @description Determine if an entity has a valid position component
   *   with a non-empty locationId string.
   * @private
   * @param {any} entity - Entity to validate.
   * @returns {boolean} `true` if the entity should be indexed.
   */
  #isValidEntityForIndex(entity) {
    if (!entity || typeof entity.id === 'undefined') {
      return false;
    }
    if (typeof entity.getComponentData !== 'function') {
      return false;
    }
    const locationId = entity.getComponentData(
      POSITION_COMPONENT_ID
    )?.locationId;
    return typeof locationId === 'string' && locationId.trim().length > 0;
  }

  /**
   * @override
   */
  onInvalidId(id, operation) {
    this.logger.warn(
      `SpatialIndexManager.${operation}: Invalid id (${id}). Skipping.`
    );
  }

  /**
   * Adds an entity to the index for a specific location.
   * If the location doesn't exist in the index, it's created.
   * **Ignores calls if locationId is null, undefined, or not a non-empty string.**
   *
   * @param {string} entityId - The ID of the entity to add.
   * @param {string | null | undefined} locationId - The location ID where the entity is present. Should be a valid string to be indexed.
   */
  addEntity(entityId, locationId) {
    if (!isValidId(entityId, 'SpatialIndexManager.addEntity', this.logger)) {
      this.logger.warn(
        `SpatialIndexManager.addEntity: Invalid entityId (${entityId}). Skipping.`
      );
      return;
    }

    if (!isValidId(locationId, 'SpatialIndexManager.addEntity', this.logger)) {
      return;
    }

    if (!super.has(locationId)) {
      super.add(locationId, new Set());
    }
    const locationSet = super.get(locationId);
    if (!locationSet.has(entityId)) {
      locationSet.add(entityId);
    }
  }

  /**
   * Removes an entity from the index for a specific location.
   * If the location's set becomes empty after removal, the location entry is removed from the index.
   * **Handles potentially null/undefined locationId gracefully by doing nothing if locationId is invalid.**
   *
   * @param {string} entityId - The ID of the entity to remove.
   * @param {string | null | undefined} locationId - The location ID from which to remove the entity. Should typically be the entity's last valid location.
   */
  removeEntity(entityId, locationId) {
    if (!isValidId(entityId, 'SpatialIndexManager.removeEntity', this.logger)) {
      this.logger.warn(
        `SpatialIndexManager.removeEntity: Invalid entityId (${entityId}). Skipping.`
      );
      return;
    }

    if (
      !isValidId(locationId, 'SpatialIndexManager.removeEntity', this.logger)
    ) {
      return;
    }

    if (super.has(locationId)) {
      const locationSet = super.get(locationId);
      const removed = locationSet.delete(entityId);
      if (removed && locationSet.size === 0) {
        super.remove(locationId); // remove is from MapManager, acts on this.items (this.locationIndex)
      }
    }
  }

  /**
   * Updates an entity's position in the index, moving it from an old location to a new one.
   * Handles cases where old or new location might be null/undefined.
   *
   * @param {string} entityId - The ID of the entity being moved.
   * @param {string | null | undefined} oldLocationId - The previous location ID (can be null/undefined).
   * @param {string | null | undefined} newLocationId - The new location ID (can be null/undefined).
   */
  updateEntityLocation(entityId, oldLocationId, newLocationId) {
    if (
      !isValidId(
        entityId,
        'SpatialIndexManager.updateEntityLocation',
        this.logger
      )
    ) {
      this.logger.warn(
        'SpatialIndexManager.updateEntityLocation: Invalid entityId. Skipping.'
      );
      return;
    }

    // Handle null/undefined location IDs gracefully - they are valid in this context
    const effectiveOldLocationId =
      oldLocationId &&
      isValidId(
        oldLocationId,
        'SpatialIndexManager.updateEntityLocation',
        this.logger
      )
        ? oldLocationId.trim()
        : null;
    const effectiveNewLocationId =
      newLocationId &&
      isValidId(
        newLocationId,
        'SpatialIndexManager.updateEntityLocation',
        this.logger
      )
        ? newLocationId.trim()
        : null;

    if (effectiveOldLocationId === effectiveNewLocationId) {
      return; // No change needed
    }

    if (effectiveOldLocationId) {
      this.removeEntity(entityId, effectiveOldLocationId);
    }

    if (effectiveNewLocationId) {
      this.addEntity(entityId, effectiveNewLocationId);
    }
  }

  /**
   * Retrieves all entity IDs present in a specific location.
   * Requires a valid, non-null locationId string.
   *
   * @param {string} locationId - The location ID to query. Must be a non-empty string.
   * @returns {Set<string>} A *copy* of the Set of entity IDs in the location, or an empty Set if the location is not indexed, empty, or the provided locationId is invalid/null.
   */
  getEntitiesInLocation(locationId) {
    if (
      !isValidId(
        locationId,
        'SpatialIndexManager.getEntitiesInLocation',
        this.logger
      )
    ) {
      return new Set();
    }

    if (super.has(locationId)) {
      return new Set(super.get(locationId)); // Return a copy
    }
    return new Set();
  }

  /**
   * Builds the spatial index from scratch using all active entities
   * managed by the provided EntityManager. Assumes entities have their
   * position data correctly set. Clears the existing index first.
   * Only entities with a valid, non-null, non-empty `locationId` string in their
   * position data will be indexed.
   *
   * @param {object} entityManager - The EntityManager instance holding active entities. Expected to have an `activeEntities` Map or similar iterable.
   */
  buildIndex(entityManager) {
    this.clearIndex();
    if (
      !entityManager ||
      !entityManager.entities ||
      typeof entityManager.entities[Symbol.iterator] !== 'function'
    ) {
      this.logger.error(
        'SpatialIndexManager.buildIndex: Invalid entityManager provided.'
      );
      return;
    }
    for (const entity of entityManager.entities) {
      if (!this.#isValidEntityForIndex(entity)) {
        continue;
      }
      const locationId = entity.getComponentData(
        POSITION_COMPONENT_ID
      ).locationId;
      this.addEntity(entity.id, locationId);
    }
  }

  /**
   * Clears all entries from the spatial index.
   */
  clearIndex() {
    super.clear(); // clear is from MapManager, acts on this.items (this.locationIndex)
    this.logger.info('SpatialIndexManager: Index cleared.');
  }

  // Adapter methods for BatchSpatialIndexManager API compatibility
  /**
   * Adapter method for BatchSpatialIndexManager compatibility.
   *
   * @param {string} entityId - Entity ID to add
   * @param {string} locationId - Location ID
   */
  add(entityId, locationId) {
    this.addEntity(entityId, locationId);
  }

  /**
   * Adapter method for BatchSpatialIndexManager compatibility.
   *
   * @param {string} entityId - Entity ID to remove
   * @returns {boolean} True if entity was removed
   */
  remove(entityId) {
    // Find and remove entity from all locations
    let removed = false;
    for (const [locationId, entitySet] of this.locationIndex.entries()) {
      if (entitySet.has(entityId)) {
        this.removeEntity(entityId, locationId);
        removed = true;
      }
    }
    return removed;
  }

  /**
   * Adapter method for BatchSpatialIndexManager compatibility.
   *
   * @param {string} entityId - Entity ID to move
   * @param {string} oldLocationId - Old location ID
   * @param {string} newLocationId - New location ID
   * @returns {boolean} True if entity was moved
   */
  move(entityId, oldLocationId, newLocationId) {
    this.updateEntityLocation(entityId, oldLocationId, newLocationId);
    return true; // updateEntityLocation doesn't return boolean, assume success
  }

  /**
   * Adapter method for BatchSpatialIndexManager compatibility.
   *
   * @param {string} locationId - Location ID to query
   * @returns {Array<string>} Array of entity IDs at location
   */
  getEntitiesAtLocation(locationId) {
    const entitySet = this.getEntitiesInLocation(locationId);
    return Array.from(entitySet);
  }

  /**
   * Adapter method for BatchSpatialIndexManager compatibility.
   * Clears the spatial index.
   */
  clear() {
    this.clearIndex();
  }

  /**
   * Adapter property for BatchSpatialIndexManager compatibility.
   *
   * @returns {number} Size of the spatial index
   */
  get size() {
    return this.locationIndex.size;
  }

  /**
   * Sets the batch spatial index manager (for dependency injection after construction).
   *
   * @param {import('./interfaces/IBatchSpatialIndexManager.js').default} batchSpatialIndexManager - Batch spatial index manager
   */
  setBatchSpatialIndexManager(batchSpatialIndexManager) {
    this.#batchSpatialIndexManager = batchSpatialIndexManager;
  }

  // Batch operation methods
  /**
   * Adds multiple entities to locations in batch.
   *
   * @param {Array<{entityId: string, locationId: string}>} additions - Entities to add
   * @param {object} [options] - Batch operation options
   * @returns {Promise<object>} Batch operation result
   */
  async batchAdd(additions, options = {}) {
    if (!this.#enableBatchOperations || !this.#batchSpatialIndexManager) {
      return this.#fallbackSequentialAdd(additions, options);
    }

    this.logger.info('Executing batch spatial index addition', {
      entityCount: additions.length,
    });

    return await this.#batchSpatialIndexManager.batchAdd(additions, options);
  }

  /**
   * Removes multiple entities from spatial index in batch.
   *
   * @param {string[]} entityIds - Entity IDs to remove
   * @param {object} [options] - Batch operation options
   * @returns {Promise<object>} Batch operation result
   */
  async batchRemove(entityIds, options = {}) {
    if (!this.#enableBatchOperations || !this.#batchSpatialIndexManager) {
      return this.#fallbackSequentialRemove(entityIds, options);
    }

    this.logger.info('Executing batch spatial index removal', {
      entityCount: entityIds.length,
    });

    return await this.#batchSpatialIndexManager.batchRemove(entityIds, options);
  }

  /**
   * Moves multiple entities to new locations in batch.
   *
   * @param {Array<{entityId: string, oldLocationId: string, newLocationId: string}>} updates - Location updates
   * @param {object} [options] - Batch operation options
   * @returns {Promise<object>} Batch operation result
   */
  async batchMove(updates, options = {}) {
    if (!this.#enableBatchOperations || !this.#batchSpatialIndexManager) {
      return this.#fallbackSequentialMove(updates, options);
    }

    this.logger.info('Executing batch spatial index move', {
      updateCount: updates.length,
    });

    return await this.#batchSpatialIndexManager.batchMove(updates, options);
  }

  /**
   * Rebuilds spatial index with new entity locations.
   *
   * @param {Array<{entityId: string, locationId: string}>} entityLocations - Entity locations
   * @param {object} [options] - Rebuild options
   * @returns {Promise<object>} Rebuild result
   */
  async rebuild(entityLocations, options = {}) {
    if (!this.#enableBatchOperations || !this.#batchSpatialIndexManager) {
      return this.#fallbackSequentialRebuild(entityLocations, options);
    }

    this.logger.info('Executing spatial index rebuild', {
      entityCount: entityLocations.length,
    });

    return await this.#batchSpatialIndexManager.rebuild(
      entityLocations,
      options
    );
  }

  // Fallback methods for when batch operations are disabled
  /**
   * Fallback sequential addition when batch operations are disabled.
   *
   * @param {Array<{entityId: string, locationId: string}>} additions - Entities to add
   * @param {object} [options] - Options
   * @returns {Promise<object>} Operation result
   */
  async #fallbackSequentialAdd(additions, options = {}) {
    const result = {
      successful: [],
      failed: [],
      totalProcessed: 0,
      indexSize: this.size,
      processingTime: 0,
    };

    const startTime = performance.now();

    for (const addition of additions) {
      result.totalProcessed++;
      try {
        this.addEntity(addition.entityId, addition.locationId);
        result.successful.push({
          entityId: addition.entityId,
          locationId: addition.locationId,
          operation: 'add',
        });

      } catch (error) {
        result.failed.push({ item: addition, error });

        if (options.stopOnError) {
          break;
        }
      }
    }

    result.processingTime = performance.now() - startTime;
    result.indexSize = this.size;
    return result;
  }

  /**
   * Fallback sequential removal when batch operations are disabled.
   *
   * @param {string[]} entityIds - Entity IDs to remove
   * @param {object} [options] - Options
   * @returns {Promise<object>} Operation result
   */
  async #fallbackSequentialRemove(entityIds, options = {}) {
    const result = {
      successful: [],
      failed: [],
      totalProcessed: 0,
      indexSize: this.size,
      processingTime: 0,
    };

    const startTime = performance.now();

    for (const entityId of entityIds) {
      result.totalProcessed++;
      try {
        const removed = this.remove(entityId);
        result.successful.push({
          entityId,
          removed,
          operation: 'remove',
        });

      } catch (error) {
        result.failed.push({ item: entityId, error });

        if (options.stopOnError) {
          break;
        }
      }
    }

    result.processingTime = performance.now() - startTime;
    result.indexSize = this.size;
    return result;
  }

  /**
   * Fallback sequential move when batch operations are disabled.
   *
   * @param {Array<{entityId: string, oldLocationId: string, newLocationId: string}>} updates - Location updates
   * @param {object} [options] - Options
   * @returns {Promise<object>} Operation result
   */
  async #fallbackSequentialMove(updates, options = {}) {
    const result = {
      successful: [],
      failed: [],
      totalProcessed: 0,
      indexSize: this.size,
      processingTime: 0,
    };

    const startTime = performance.now();

    for (const update of updates) {
      result.totalProcessed++;
      try {
        const moved = this.move(
          update.entityId,
          update.oldLocationId,
          update.newLocationId
        );
        result.successful.push({
          entityId: update.entityId,
          oldLocationId: update.oldLocationId,
          newLocationId: update.newLocationId,
          moved,
          operation: 'move',
        });

      } catch (error) {
        result.failed.push({ item: update, error });

        if (options.stopOnError) {
          break;
        }
      }
    }

    result.processingTime = performance.now() - startTime;
    result.indexSize = this.size;
    return result;
  }

  /**
   * Fallback sequential rebuild when batch operations are disabled.
   *
   * @param {Array<{entityId: string, locationId: string}>} entityLocations - Entity locations
   * @param {object} [options] - Options
   * @returns {Promise<object>} Operation result
   */
  async #fallbackSequentialRebuild(entityLocations, options = {}) {
    const result = {
      successful: [],
      failed: [],
      totalProcessed: 0,
      indexSize: this.size,
      processingTime: 0,
    };

    const startTime = performance.now();

    // Clear existing index
    this.clearIndex();

    for (const entityLocation of entityLocations) {
      result.totalProcessed++;
      try {
        this.addEntity(entityLocation.entityId, entityLocation.locationId);
        result.successful.push({
          entityId: entityLocation.entityId,
          locationId: entityLocation.locationId,
          operation: 'rebuild',
        });

      } catch (error) {
        result.failed.push({ item: entityLocation, error });

        if (options.stopOnError) {
          break;
        }
      }
    }

    result.processingTime = performance.now() - startTime;
    result.indexSize = this.size;
    return result;
  }
}

export default SpatialIndexManager;
