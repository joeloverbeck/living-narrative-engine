// src/entities/spatialIndexManager.js

import { POSITION_COMPONENT_ID } from '../constants/componentIds.js';

/**
 * Manages a spatial index mapping location IDs to the entities present
 * based on their position data. Handles entities whose locationId might be null.
 */
class SpatialIndexManager {
  constructor() {
    /**
     * The core spatial index.
     * Maps locationId (string) to a Set of entityIds (string) present in that location.
     * Location IDs are always non-null, non-empty strings.
     *
     * @type {Map<string, Set<string>>}
     */
    this.locationIndex = new Map();
    console.log('SpatialIndexManager initialized.');
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
    // Validate entityId first
    if (typeof entityId !== 'string' || entityId.trim() === '') {
      console.warn(
        `SpatialIndexManager.addEntity: Invalid entityId (${entityId}). Skipping.`
      );
      return;
    }

    // Ignore calls where locationId is null/undefined or empty/whitespace.
    if (typeof locationId !== 'string' || locationId.trim() === '') {
      // This entity is not in a trackable location (e.g., null locationId), so don't index it.
      return;
    }

    // Proceed only if locationId is a valid, non-empty string
    if (!this.locationIndex.has(locationId)) {
      this.locationIndex.set(locationId, new Set());
    }
    const locationSet = this.locationIndex.get(locationId);
    if (!locationSet.has(entityId)) {
      locationSet.add(entityId);
    }
  }

  /**
   * Removes an entity from the index for a specific location.
   * If the location's set becomes empty after removal, the location entry is removed from the index.
   * **Handles potentially null/undefined locationId gracefully by doing nothing.**
   *
   * @param {string} entityId - The ID of the entity to remove.
   * @param {string | null | undefined} locationId - The location ID from which to remove the entity. Should typically be the entity's last valid location.
   */
  removeEntity(entityId, locationId) {
    // Validate entityId first
    if (typeof entityId !== 'string' || entityId.trim() === '') {
      console.warn(
        `SpatialIndexManager.removeEntity: Invalid entityId (${entityId}). Skipping.`
      );
      return;
    }

    // If locationId is not a valid string key, we can't remove anything anyway.
    if (typeof locationId !== 'string' || locationId.trim() === '') {
      // Cannot remove from a null/invalid location.
      return;
    }

    // Proceed only if locationId is a valid string
    if (this.locationIndex.has(locationId)) {
      const locationSet = this.locationIndex.get(locationId);
      const removed = locationSet.delete(entityId);
      if (removed) {
        // Clean up empty sets
        if (locationSet.size === 0) {
          this.locationIndex.delete(locationId);
        }
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
    if (typeof entityId !== 'string' || entityId.trim() === '') {
      console.warn(
        'SpatialIndexManager.updateEntityLocation: Invalid entityId. Skipping.'
      );
      return;
    }

    // Normalize potential empty/whitespace strings to null for consistent comparison
    const effectiveOldLocationId =
      typeof oldLocationId === 'string' && oldLocationId.trim() !== ''
        ? oldLocationId.trim()
        : null;
    const effectiveNewLocationId =
      typeof newLocationId === 'string' && newLocationId.trim() !== ''
        ? newLocationId.trim()
        : null;

    // No actual change in indexed location, do nothing
    if (effectiveOldLocationId === effectiveNewLocationId) {
      return;
    }

    // If oldLocationId is valid (not null/undefined), remove entityId from its set.
    if (effectiveOldLocationId) {
      this.removeEntity(entityId, effectiveOldLocationId);
    }

    // If newLocationId is valid, add the entityId to the set for newLocationId.
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
    if (typeof locationId !== 'string' || locationId.trim() === '') {
      return new Set(); // Return empty set for invalid/null locations
    }

    if (this.locationIndex.has(locationId)) {
      // Return a copy to prevent external modification of the internal set
      return new Set(this.locationIndex.get(locationId));
    }
    return new Set(); // Return an empty set if location doesn't exist.
  }

  /**
   * Builds the spatial index from scratch using all active entities
   * managed by the provided EntityManager. Assumes entities have their
   * position data correctly set. Clears the existing index first.
   * Only entities with a valid, non-null `locationId` string in their
   * position data will be indexed.
   *
   * @param {object} entityManager - The EntityManager instance holding active entities. Expected to have an `activeEntities` Map or similar iterable.
   */
  buildIndex(entityManager) {
    console.log('SpatialIndexManager: Building index from active entities...');
    this.locationIndex.clear(); // Start fresh

    if (
      !entityManager ||
      typeof entityManager.activeEntities?.entries !== 'function'
    ) {
      console.error(
        'SpatialIndexManager.buildIndex: Invalid EntityManager or missing activeEntities iterable provided.'
      );
      return;
    }

    let indexedCount = 0;
    for (const [entityId, entity] of entityManager.activeEntities.entries()) {
      // --- Correction: Check if entity is invalid OR if getComponentData is NOT a function ---
      if (!entity || typeof entity.getComponentData !== 'function') {
        console.warn(
          `SpatialIndexManager.buildIndex: Skipping invalid entity object for ID ${entityId}.`
        );
        continue;
      }

      const positionComp = entity.getComponentData(POSITION_COMPONENT_ID);
      // addEntity internally checks if positionComp.locationId is a valid string
      if (positionComp) {
        // Let addEntity handle the null/invalid check for locationId
        this.addEntity(entityId, positionComp.locationId);
        // We only count if addEntity actually *could* have indexed it (i.e. locationId was valid)
        if (
          typeof positionComp.locationId === 'string' &&
          positionComp.locationId.trim() !== ''
        ) {
          indexedCount++;
        }
      }
    }
    // Corrected log message: indexedCount reflects entities *successfully added* to the index.
    console.log(
      `SpatialIndexManager: Index build complete. Added ${indexedCount} entities with valid location IDs to the index.`
    );
  }

  /**
   * Clears the entire spatial index.
   */
  clearIndex() {
    this.locationIndex.clear();
    console.log('SpatialIndexManager: Index cleared.');
  }
}

export default SpatialIndexManager;
