/**
 * @interface ISpatialIndexManager
 * @description
 * Defines the contract for managing a spatial index of entities based on their location.
 */
export class ISpatialIndexManager {
  /**
   * Adds or updates an entity's presence in the index for a given location.
   *
   * @param {string} entityId
   * @param {string|null|undefined} locationId
   */
  addEntity(entityId, locationId) {
    throw new Error('ISpatialIndexManager.addEntity not implemented.');
  }

  /**
   * Removes an entity from the index.
   *
   * @param {string} entityId
   * @param {string|null|undefined} locationId
   */
  removeEntity(entityId, locationId) {
    throw new Error('ISpatialIndexManager.removeEntity not implemented.');
  }

  /**
   * Updates an entity's location from an old location to a new one.
   *
   * @param {string} entityId
   * @param {string|null|undefined} oldLocationId
   * @param {string|null|undefined} newLocationId
   */
  updateEntityLocation(entityId, oldLocationId, newLocationId) {
    throw new Error(
      'ISpatialIndexManager.updateEntityLocation not implemented.'
    );
  }

  /**
   * Retrieves a set of all entity IDs currently registered in the specified location.
   *
   * @param {string} locationId
   * @returns {Set<string>}
   */
  getEntitiesInLocation(locationId) {
    throw new Error(
      'ISpatialIndexManager.getEntitiesInLocation not implemented.'
    );
  }

  /**
   * Builds or rebuilds the entire spatial index based on the current state of entities.
   *
   * @param {object} entityManager  – An object with an `activeEntities` iterable.
   */
  buildIndex(entityManager) {
    throw new Error('ISpatialIndexManager.buildIndex not implemented.');
  }

  /**
   * Clears all entries from the spatial index.
   */
  clearIndex() {
    throw new Error('ISpatialIndexManager.clearIndex not implemented.');
  }
}
