/**
 * @file Service for querying entities by location.
 * @see src/entities/locationQueryService.js
 */

/**
 * @typedef {import('../interfaces/coreServices.js').ISpatialIndexManager} ISpatialIndexManager
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 */

/**
 * @description Service for querying entities by location.
 * This service provides location-based entity queries by delegating to the spatial index manager.
 * @class LocationQueryService
 */
export class LocationQueryService {
  /**
   * @param {object} dependencies
   * @param {ISpatialIndexManager} dependencies.spatialIndexManager
   * @param {ILogger} dependencies.logger
   */
  constructor({ spatialIndexManager, logger }) {
    /** @private */
    this.spatialIndexManager = spatialIndexManager;
    /** @private */
    this.logger = logger;

    this.logger.debug('LocationQueryService initialized.');
  }

  /**
   * Retrieves all entity instance IDs (UUIDs) present in a specific location.
   * This is often used by services like TargetResolutionService to find entities in the environment.
   *
   * @param {string} locationId - The unique ID of the location entity (which itself is an entity, typically identified by its instance ID or a well-known definition ID if it's a unique location).
   * @returns {Set<string>} A Set of entity instance IDs (UUIDs) in the specified location. Returns an empty Set if the location is not found or has no entities.
   */
  getEntitiesInLocation(locationId) {
    try {
      return this.spatialIndexManager.getEntitiesInLocation(locationId);
    } catch (error) {
      this.logger.error(
        `LocationQueryService.getEntitiesInLocation: Error querying spatial index for location '${locationId}':`,
        error
      );
      return new Set();
    }
  }
}
