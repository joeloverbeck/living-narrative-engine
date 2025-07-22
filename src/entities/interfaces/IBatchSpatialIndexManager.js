/**
 * @file IBatchSpatialIndexManager - Interface for batch spatial index operations
 * @module IBatchSpatialIndexManager
 */

/**
 * @typedef {object} LocationUpdate
 * @property {string} entityId - Entity ID
 * @property {string} oldLocationId - Previous location ID
 * @property {string} newLocationId - New location ID
 */

/**
 * @typedef {object} BatchIndexResult
 * @property {Array} successful - Successfully processed operations
 * @property {Array} failed - Failed operations
 * @property {number} totalProcessed - Total operations processed
 * @property {number} indexSize - Final index size
 * @property {number} processingTime - Processing time in milliseconds
 */

/**
 * @interface IBatchSpatialIndexManager
 * @description Interface for batch operations on spatial index management
 */
export default class IBatchSpatialIndexManager {
  /**
   * Adds multiple entities to locations in batch.
   *
   * @param {Array<{entityId: string, locationId: string}>} additions - Entities to add
   * @param {object} [options] - Batch options
   * @param {number} [options.batchSize] - Batch size override
   * @param {boolean} [options.enableParallel] - Enable parallel processing
   * @returns {Promise<BatchIndexResult>} Batch result
   */
  async batchAdd(additions, options = {}) {
    throw new Error('Method not implemented');
  }

  /**
   * Removes multiple entities from the spatial index in batch.
   *
   * @param {string[]} entityIds - Entity IDs to remove
   * @param {object} [options] - Batch options
   * @returns {Promise<BatchIndexResult>} Batch result
   */
  async batchRemove(entityIds, options = {}) {
    throw new Error('Method not implemented');
  }

  /**
   * Moves multiple entities to new locations in batch.
   *
   * @param {LocationUpdate[]} updates - Location updates
   * @param {object} [options] - Batch options
   * @returns {Promise<BatchIndexResult>} Batch result
   */
  async batchMove(updates, options = {}) {
    throw new Error('Method not implemented');
  }

  /**
   * Rebuilds the spatial index with new entity locations.
   *
   * @param {Array<{entityId: string, locationId: string}>} entityLocations - New entity locations
   * @param {object} [options] - Rebuild options
   * @returns {Promise<BatchIndexResult>} Rebuild result
   */
  async rebuild(entityLocations, options = {}) {
    throw new Error('Method not implemented');
  }

  /**
   * Validates entities at multiple locations in batch.
   *
   * @param {string[]} locationIds - Location IDs to validate
   * @param {object} [options] - Validation options
   * @returns {Promise<object>} Validation results
   */
  async batchValidateLocations(locationIds, options = {}) {
    throw new Error('Method not implemented');
  }

  /**
   * Performs batch synchronization of spatial index with entity repository.
   *
   * @param {Function} entityProvider - Function that returns all entities with locations
   * @param {object} [options] - Sync options
   * @returns {Promise<BatchIndexResult>} Synchronization result
   */
  async synchronize(entityProvider, options = {}) {
    throw new Error('Method not implemented');
  }

  /**
   * Gets batch operation statistics.
   *
   * @returns {object} Statistics
   */
  getStats() {
    throw new Error('Method not implemented');
  }

  /**
   * Sets the default batch size.
   *
   * @param {number} batchSize - New batch size
   */
  setDefaultBatchSize(batchSize) {
    throw new Error('Method not implemented');
  }
}
