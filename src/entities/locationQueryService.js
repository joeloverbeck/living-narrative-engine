/**
 * @file Service for querying entities by location.
 * @see src/entities/locationQueryService.js
 */

import { assertValidId } from '../utils/parameterGuards.js';
import { InvalidArgumentError } from '../errors/invalidArgumentError.js';

/**
 * @typedef {import('../interfaces/coreServices.js').ISpatialIndexManager} ISpatialIndexManager
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 */

/**
 * Service for querying entities by location.
 * This service provides location-based entity queries by delegating to the spatial index manager.
 *
 * @class LocationQueryService
 */
export class LocationQueryService {
  /**
   * Create a new LocationQueryService.
   *
   * @param {object} dependencies - Constructor dependencies.
   * @param {ISpatialIndexManager} dependencies.spatialIndexManager - Spatial index manager used for lookups.
   * @param {ILogger} dependencies.logger - Logger instance.
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
      assertValidId(
        locationId,
        'LocationQueryService.getEntitiesInLocation',
        this.logger
      );
      return this.spatialIndexManager.getEntitiesInLocation(locationId);
    } catch (error) {
      if (error instanceof InvalidArgumentError) {
        this.logger.warn(
          `LocationQueryService.getEntitiesInLocation called with invalid locationId: '${locationId}'`
        );
      } else {
        this.logger.error(
          `LocationQueryService.getEntitiesInLocation: Error querying spatial index for location '${locationId}':`,
          error
        );
      }
      return new Set();
    }
  }
}
