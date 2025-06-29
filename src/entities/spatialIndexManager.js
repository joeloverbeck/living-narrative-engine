// src/entities/spatialIndexManager.js

import { POSITION_COMPONENT_ID } from '../constants/componentIds.js';
import { ISpatialIndexManager } from '../interfaces/ISpatialIndexManager.js';
import { MapManager } from '../utils/mapManagerUtils.js';
import { isValidId } from './utils/idValidation.js';

/**
 * Manages a spatial index mapping location IDs to the entities present
 * based on their position data. Handles entities whose locationId might be null.
 *
 * @implements {ISpatialIndexManager}
 */
class SpatialIndexManager extends MapManager {
  /**
   * @param {object} dependencies
   * @param {import('../interfaces/coreServices.js').ILogger} dependencies.logger
   */
  constructor({ logger } = {}) {
    super();
    /** @type {import('../interfaces/coreServices.js').ILogger} */
    this.logger = logger || console;
    /**
     * The core spatial index.
     * Maps locationId (string) to a Set of entityIds (string) present in that location.
     * Location IDs are always non-null, non-empty strings.
     *
     * @type {Map<string, Set<string>>}
     */
    this.locationIndex = this.items; // Inherits `items` from MapManager
    this.logger.info('SpatialIndexManager initialized.');
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

    if (!this.has(locationId)) {
      this.add(locationId, new Set());
    }
    const locationSet = this.get(locationId);
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

    if (this.has(locationId)) {
      const locationSet = this.get(locationId);
      const removed = locationSet.delete(entityId);
      if (removed && locationSet.size === 0) {
        this.remove(locationId); // remove is from MapManager, acts on this.items (this.locationIndex)
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

    const effectiveOldLocationId = isValidId(
      oldLocationId,
      'SpatialIndexManager.updateEntityLocation',
      this.logger
    )
      ? oldLocationId.trim()
      : null;
    const effectiveNewLocationId = isValidId(
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

    if (this.has(locationId)) {
      return new Set(this.get(locationId)); // Return a copy
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
    this.clear(); // clear is from MapManager, acts on this.items (this.locationIndex)
    this.logger.info('SpatialIndexManager: Index cleared.');
  }
}

export default SpatialIndexManager;
