/**
 * @file BatchSpatialIndexManager - Batch operations for spatial index management
 * @module BatchSpatialIndexManager
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { ensureValidLogger } from '../../utils/loggerUtils.js';
import { processBatch } from '../utils/batchOperationUtils.js';
import { InvalidArgumentError } from '../../errors/invalidArgumentError.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../spatialIndexManager.js').default} SpatialIndexManager */

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
 * @class BatchSpatialIndexManager
 * @description Handles batch operations for spatial index management
 */
export default class BatchSpatialIndexManager {
  /** @type {SpatialIndexManager} */
  #spatialIndex;
  /** @type {ILogger} */
  #logger;
  /** @type {number} */
  #defaultBatchSize;

  /**
   * @class
   * @param {object} deps - Dependencies
   * @param {SpatialIndexManager} deps.spatialIndex - Spatial index manager
   * @param {ILogger} deps.logger - Logger instance
   * @param {number} [deps.defaultBatchSize] - Default batch size
   */
  constructor({ spatialIndex, logger, defaultBatchSize = 100 }) {
    validateDependency(logger, 'ILogger', console, {
      requiredMethods: ['info', 'error', 'warn', 'debug'],
    });
    this.#logger = ensureValidLogger(logger, 'BatchSpatialIndexManager');

    validateDependency(spatialIndex, 'SpatialIndexManager', this.#logger, {
      requiredMethods: ['add', 'remove', 'move', 'getEntitiesAtLocation'],
    });
    this.#spatialIndex = spatialIndex;

    this.#defaultBatchSize = defaultBatchSize;

    this.#logger.debug('BatchSpatialIndexManager initialized', {
      defaultBatchSize: this.#defaultBatchSize,
    });
  }

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
    const { batchSize = this.#defaultBatchSize, enableParallel = false } =
      options;

    this.#validateBatchInput(additions, 'additions');

    const startTime = performance.now();
    this.#logger.info(
      `Starting batch spatial index addition: ${additions.length} entities`
    );

    const processor = async (addition) => {
      const { entityId, locationId } = addition;
      this.#spatialIndex.add(entityId, locationId);
      return { entityId, locationId, operation: 'add' };
    };

    const result = await processBatch(additions, processor, {
      batchSize,
      enableParallel,
      stopOnError: false,
    });

    const batchResult = {
      successful: result.successes,
      failed: result.failures,
      totalProcessed: result.totalProcessed,
      indexSize: this.#spatialIndex.size || 0,
      processingTime: performance.now() - startTime,
    };

    this.#logger.info(`Batch spatial index addition completed`, {
      successful: result.successCount,
      failed: result.failureCount,
      totalProcessed: result.totalProcessed,
      processingTime: batchResult.processingTime,
    });

    return batchResult;
  }

  /**
   * Removes multiple entities from the spatial index in batch.
   *
   * @param {string[]} entityIds - Entity IDs to remove
   * @param {object} [options] - Batch options
   * @returns {Promise<BatchIndexResult>} Batch result
   */
  async batchRemove(entityIds, options = {}) {
    const { batchSize = this.#defaultBatchSize, enableParallel = false } =
      options;

    this.#validateBatchInput(entityIds, 'entityIds');

    const startTime = performance.now();
    this.#logger.info(
      `Starting batch spatial index removal: ${entityIds.length} entities`
    );

    const processor = async (entityId) => {
      const removed = this.#spatialIndex.remove(entityId);
      return { entityId, removed, operation: 'remove' };
    };

    const result = await processBatch(entityIds, processor, {
      batchSize,
      enableParallel,
      stopOnError: false,
    });

    const batchResult = {
      successful: result.successes,
      failed: result.failures,
      totalProcessed: result.totalProcessed,
      indexSize: this.#spatialIndex.size || 0,
      processingTime: performance.now() - startTime,
    };

    this.#logger.info(`Batch spatial index removal completed`, {
      successful: result.successCount,
      failed: result.failureCount,
      totalProcessed: result.totalProcessed,
      processingTime: batchResult.processingTime,
    });

    return batchResult;
  }

  /**
   * Moves multiple entities to new locations in batch.
   *
   * @param {LocationUpdate[]} updates - Location updates
   * @param {object} [options] - Batch options
   * @returns {Promise<BatchIndexResult>} Batch result
   */
  async batchMove(updates, options = {}) {
    const { batchSize = this.#defaultBatchSize, enableParallel = false } =
      options;

    this.#validateBatchInput(updates, 'updates');

    const startTime = performance.now();
    this.#logger.info(
      `Starting batch spatial index move: ${updates.length} entities`
    );

    const processor = async (update) => {
      const { entityId, oldLocationId, newLocationId } = update;

      // Validate the update
      if (!entityId || !newLocationId) {
        throw new InvalidArgumentError(
          'EntityId and newLocationId are required'
        );
      }

      const moved = this.#spatialIndex.move(
        entityId,
        oldLocationId,
        newLocationId
      );
      return {
        entityId,
        oldLocationId,
        newLocationId,
        moved,
        operation: 'move',
      };
    };

    const result = await processBatch(updates, processor, {
      batchSize,
      enableParallel,
      stopOnError: false,
    });

    const batchResult = {
      successful: result.successes,
      failed: result.failures,
      totalProcessed: result.totalProcessed,
      indexSize: this.#spatialIndex.size || 0,
      processingTime: performance.now() - startTime,
    };

    this.#logger.info(`Batch spatial index move completed`, {
      successful: result.successCount,
      failed: result.failureCount,
      totalProcessed: result.totalProcessed,
      processingTime: batchResult.processingTime,
    });

    return batchResult;
  }

  /**
   * Rebuilds the spatial index with new entity locations.
   *
   * @param {Array<{entityId: string, locationId: string}>} entityLocations - New entity locations
   * @param {object} [options] - Rebuild options
   * @returns {Promise<BatchIndexResult>} Rebuild result
   */
  async rebuild(entityLocations, options = {}) {
    const { batchSize = this.#defaultBatchSize, enableParallel = false } =
      options;

    this.#validateBatchInput(entityLocations, 'entityLocations');

    const startTime = performance.now();
    this.#logger.info(
      `Starting spatial index rebuild: ${entityLocations.length} entities`
    );

    // Clear existing index
    this.#spatialIndex.clear();

    const processor = async (entityLocation) => {
      const { entityId, locationId } = entityLocation;
      this.#spatialIndex.add(entityId, locationId);
      return { entityId, locationId, operation: 'rebuild' };
    };

    const result = await processBatch(entityLocations, processor, {
      batchSize,
      enableParallel,
      stopOnError: false,
    });

    const batchResult = {
      successful: result.successes,
      failed: result.failures,
      totalProcessed: result.totalProcessed,
      indexSize: this.#spatialIndex.size || 0,
      processingTime: performance.now() - startTime,
    };

    this.#logger.info(`Spatial index rebuild completed`, {
      successful: result.successCount,
      failed: result.failureCount,
      totalProcessed: result.totalProcessed,
      finalIndexSize: batchResult.indexSize,
      processingTime: batchResult.processingTime,
    });

    return batchResult;
  }

  /**
   * Validates entities at multiple locations in batch.
   *
   * @param {string[]} locationIds - Location IDs to validate
   * @param {object} [options] - Validation options
   * @returns {Promise<object>} Validation results
   */
  async batchValidateLocations(locationIds, options = {}) {
    const { batchSize = this.#defaultBatchSize, enableParallel = true } =
      options;

    this.#validateBatchInput(locationIds, 'locationIds');

    const startTime = performance.now();
    this.#logger.info(
      `Starting batch location validation: ${locationIds.length} locations`
    );

    const processor = async (locationId) => {
      const entities = this.#spatialIndex.getEntitiesAtLocation(locationId);
      return {
        locationId,
        entityCount: entities.length,
        entities: entities.slice(0, 10), // Limit to first 10 for performance
        operation: 'validate',
      };
    };

    const result = await processBatch(locationIds, processor, {
      batchSize,
      enableParallel,
      stopOnError: false,
    });

    const validationResult = {
      successful: result.successes,
      failed: result.failures,
      totalProcessed: result.totalProcessed,
      totalEntities: result.successes.reduce(
        (sum, loc) => sum + loc.entityCount,
        0
      ),
      processingTime: performance.now() - startTime,
    };

    this.#logger.info(`Batch location validation completed`, {
      locationsValidated: result.successCount,
      totalEntities: validationResult.totalEntities,
      processingTime: validationResult.processingTime,
    });

    return validationResult;
  }

  /**
   * Performs batch synchronization of spatial index with entity repository.
   *
   * @param {Function} entityProvider - Function that returns all entities with locations
   * @param {object} [options] - Sync options
   * @returns {Promise<BatchIndexResult>} Synchronization result
   */
  async synchronize(entityProvider, options = {}) {
    const { batchSize = this.#defaultBatchSize, enableParallel = false } =
      options;

    if (typeof entityProvider !== 'function') {
      throw new InvalidArgumentError('entityProvider must be a function');
    }

    const startTime = performance.now();
    this.#logger.info('Starting spatial index synchronization');

    try {
      // Get all entities with their locations
      const entities = await entityProvider();

      if (!Array.isArray(entities)) {
        throw new InvalidArgumentError('entityProvider must return an array');
      }

      // Rebuild the index with current entities
      const result = await this.rebuild(entities, {
        batchSize,
        enableParallel,
      });

      this.#logger.info('Spatial index synchronization completed', {
        entitiesProcessed: result.totalProcessed,
        successful: result.successful.length,
        failed: result.failed.length,
        processingTime: result.processingTime,
      });

      return result;
    } catch (error) {
      this.#logger.error('Spatial index synchronization failed:', error);
      throw error;
    }
  }

  /**
   * Validates batch input.
   *
   * @param {Array} input - Input to validate
   * @param {string} inputName - Name of the input for error messages
   */
  #validateBatchInput(input, inputName) {
    if (!Array.isArray(input)) {
      throw new InvalidArgumentError(`${inputName} must be an array`);
    }

    if (input.length === 0) {
      throw new InvalidArgumentError(`${inputName} cannot be empty`);
    }
  }

  /**
   * Gets batch operation statistics.
   *
   * @returns {object} Statistics
   */
  getStats() {
    return {
      defaultBatchSize: this.#defaultBatchSize,
      indexSize: this.#spatialIndex.size || 0,
      // Add spatial index stats if available
      spatialIndexStats:
        typeof this.#spatialIndex.getStats === 'function'
          ? this.#spatialIndex.getStats()
          : null,
    };
  }

  /**
   * Sets the default batch size.
   *
   * @param {number} batchSize - New batch size
   */
  setDefaultBatchSize(batchSize) {
    if (typeof batchSize !== 'number' || batchSize <= 0) {
      throw new InvalidArgumentError('batchSize must be a positive number');
    }
    this.#defaultBatchSize = batchSize;
    this.#logger.debug(`Default batch size set to ${batchSize}`);
  }
}
