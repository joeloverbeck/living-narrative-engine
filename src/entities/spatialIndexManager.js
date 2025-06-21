// src/entities/spatialIndexManager.js

import { POSITION_COMPONENT_ID } from '../constants/componentIds.js';
import { ISpatialIndexManager } from '../interfaces/ISpatialIndexManager.js';
import { MapManager } from '../utils/mapManagerUtils.js';
import { assertValidId } from '../utils/parameterGuards.js';

/**
 * Manages a spatial index mapping location IDs to the entities present
 * based on their position data. Handles entities whose locationId might be null.
 *
 * @implements {ISpatialIndexManager}
 */
class SpatialIndexManager extends MapManager {
  constructor() {
    super();
    /**
     * The core spatial index.
     * Maps locationId (string) to a Set of entityIds (string) present in that location.
     * Location IDs are always non-null, non-empty strings.
     *
     * @type {Map<string, Set<string>>}
     */
    this.locationIndex = this.items; // Inherits `items` from MapManager
    console.log('SpatialIndexManager initialized.');
  }

  /**
   * @override
   */
  onInvalidId(id, operation) {
    console.warn(
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
    try {
      assertValidId(entityId, 'SpatialIndexManager.addEntity', console);
    } catch (error) {
      console.warn(
        `SpatialIndexManager.addEntity: Invalid entityId (${entityId}). Skipping.`
      );
      return;
    }

    // Only proceed if locationId is a valid, non-empty string
    try {
      assertValidId(locationId, 'SpatialIndexManager.addEntity', console);
    } catch (error) {
      // console.debug(`SpatialIndexManager.addEntity: Invalid or null locationId (${locationId}) for entity ${entityId}. Skipping.`);
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
    try {
      assertValidId(entityId, 'SpatialIndexManager.removeEntity', console);
    } catch (error) {
      console.warn(
        `SpatialIndexManager.removeEntity: Invalid entityId (${entityId}). Skipping.`
      );
      return;
    }

    try {
      assertValidId(locationId, 'SpatialIndexManager.removeEntity', console);
    } catch (error) {
      // console.debug(`SpatialIndexManager.removeEntity: Invalid or null locationId (${locationId}) for entity ${entityId}. Skipping.`);
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
    try {
      assertValidId(
        entityId,
        'SpatialIndexManager.updateEntityLocation',
        console
      );
    } catch (error) {
      console.warn(
        'SpatialIndexManager.updateEntityLocation: Invalid entityId. Skipping.'
      );
      return;
    }

    const effectiveOldLocationId = MapManager.isValidId(oldLocationId)
      ? oldLocationId.trim()
      : null;
    const effectiveNewLocationId = MapManager.isValidId(newLocationId)
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
    try {
      assertValidId(
        locationId,
        'SpatialIndexManager.getEntitiesInLocation',
        console
      );
    } catch (error) {
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
      typeof entityManager.entities?.values !== 'function'
    ) {
      console.error(
        'SpatialIndexManager.buildIndex: Invalid entityManager provided.'
      );
      return;
    }
    for (const entity of entityManager.entities) {
      if (
        !entity ||
        typeof entity.id === 'undefined' ||
        typeof entity.getComponentData !== 'function'
      ) {
        // console.warn(`[SpatialIndexManager.buildIndex] Skipping invalid entity object: ${JSON.stringify(entity)}`);
        continue;
      }
      const positionComponent = entity.getComponentData(POSITION_COMPONENT_ID);
      const locationId = positionComponent
        ? positionComponent.locationId
        : undefined;

      // Ensure locationId is a valid string before adding
      if (
        positionComponent &&
        locationId &&
        typeof locationId === 'string' &&
        locationId.trim()
      ) {
        this.addEntity(entity.id, locationId);
      }
    }
  }

  /**
   * Clears all entries from the spatial index.
   */
  clearIndex() {
    this.clear(); // clear is from MapManager, acts on this.items (this.locationIndex)
    console.log('SpatialIndexManager: Index cleared.');
  }
}

export default SpatialIndexManager;
