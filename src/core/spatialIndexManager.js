// src/core/spatialIndexManager.js

import {PositionComponent} from '../components/positionComponent.js';

/**
 * Manages a spatial index mapping location IDs to the entities present
 * based on their PositionComponent.
 */
class SpatialIndexManager {
    constructor() {
        /**
         * The core spatial index.
         * Maps locationId (string) to a Set of entityIds (string) present in that location.
         * @type {Map<string, Set<string>>}
         */
        this.locationIndex = new Map();
        console.log("SpatialIndexManager initialized.");
    }

    /**
     * Adds an entity to the index for a specific location.
     * If the location doesn't exist in the index, it's created.
     * @param {string} entityId - The ID of the entity to add.
     * @param {string} locationId - The location ID where the entity is present.
     */
    addEntity(entityId, locationId) {
        if (!entityId || !locationId) {
            console.warn(`SpatialIndexManager.addEntity: Invalid entityId (${entityId}) or locationId (${locationId}). Skipping.`);
            return;
        }

        if (!this.locationIndex.has(locationId)) {
            this.locationIndex.set(locationId, new Set());
        }
        const locationSet = this.locationIndex.get(locationId);
        if (!locationSet.has(entityId)) {
            locationSet.add(entityId);
            // console.log(`SpatialIndex: Added entity ${entityId} to location ${locationId}`);
        } else {
            // Optional: Log if entity already exists? Might be noisy.
            // console.log(`SpatialIndex: Entity ${entityId} already present in location ${locationId}`);
        }
    }

    /**
     * Removes an entity from the index for a specific location.
     * If the location's set becomes empty after removal, the location entry is removed from the index.
     * @param {string} entityId - The ID of the entity to remove.
     * @param {string} locationId - The location ID from which to remove the entity.
     */
    removeEntity(entityId, locationId) {
        if (!entityId || !locationId) {
            console.warn(`SpatialIndexManager.removeEntity: Invalid entityId (${entityId}) or locationId (${locationId}). Skipping.`);
            return;
        }

        if (this.locationIndex.has(locationId)) {
            const locationSet = this.locationIndex.get(locationId);
            const removed = locationSet.delete(entityId);
            if (removed) {
                // console.log(`SpatialIndex: Removed entity ${entityId} from location ${locationId}`);
                // Clean up empty sets to prevent the map from growing indefinitely with empty locations
                if (locationSet.size === 0) {
                    this.locationIndex.delete(locationId);
                    // console.log(`SpatialIndex: Removed empty location entry ${locationId}`);
                }
            } else {
                // Optional: Log if entity wasn't found?
                // console.log(`SpatialIndex: Entity ${entityId} not found in location ${locationId} for removal.`);
            }
        } else {
            // Optional: Log if location wasn't found?
            // console.log(`SpatialIndex: Location ${locationId} not found in index for removal.`);
        }
    }

    /**
     * Updates an entity's position in the index, moving it from an old location to a new one.
     * Handles cases where old or new location might be null/undefined (e.g., initial placement, removal from world).
     * @param {string} entityId - The ID of the entity being moved.
     * @param {string | null | undefined} oldLocationId - The previous location ID.
     * @param {string | null | undefined} newLocationId - The new location ID.
     */
    updateEntityLocation(entityId, oldLocationId, newLocationId) {
        if (!entityId) {
            console.warn("SpatialIndexManager.updateEntityLocation: Invalid entityId. Skipping.");
            return;
        }

        // No change, do nothing
        if (oldLocationId === newLocationId) {
            return;
        }

        // Remove from old location if it existed
        if (oldLocationId) {
            this.removeEntity(entityId, oldLocationId);
        }

        // Add to new location if it exists
        if (newLocationId) {
            this.addEntity(entityId, newLocationId);
        }
        console.log(`SpatialIndex: Updated entity ${entityId} location from ${oldLocationId || 'None'} to ${newLocationId || 'None'}`);
    }

    /**
     * Retrieves all entity IDs present in a specific location.
     * @param {string} locationId - The location ID to query.
     * @returns {Set<string>} A *copy* of the Set of entity IDs in the location, or an empty Set if the location is not indexed or empty.
     */
    getEntitiesInLocation(locationId) {
        if (this.locationIndex.has(locationId)) {
            // Return a copy to prevent external modification of the internal set
            return new Set(this.locationIndex.get(locationId));
        }
        return new Set(); // Return an empty set for consistency
    }

    /**
     * Builds the spatial index from scratch using all active entities
     * managed by the provided EntityManager. Assumes entities have their
     * PositionComponent correctly set. Clears the existing index first.
     * @param {import('../entities/entityManager.js').default} entityManager - The EntityManager instance holding active entities.
     */
    buildIndex(entityManager) {
        console.log("SpatialIndexManager: Building index from active entities...");
        this.locationIndex.clear(); // Start fresh

        if (!entityManager || !entityManager.activeEntities) {
            console.error("SpatialIndexManager.buildIndex: Invalid EntityManager provided.");
            return;
        }

        let indexedCount = 0;
        for (const [entityId, entity] of entityManager.activeEntities.entries()) {
            const positionComp = entity.getComponent(PositionComponent);
            if (positionComp && positionComp.locationId) {
                this.addEntity(entityId, positionComp.locationId);
                indexedCount++;
            }
        }
        console.log(`SpatialIndexManager: Index build complete. Indexed ${indexedCount} entities with PositionComponent.`);
    }

    /**
     * Clears the entire spatial index.
     */
    clearIndex() {
        this.locationIndex.clear();
        console.log("SpatialIndexManager: Index cleared.");
    }
}

export default SpatialIndexManager;