/**
 * @file BatchOperationManager - Handles batch operations for entities
 * @module BatchOperationManager
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { ensureValidLogger } from '../../utils/loggerUtils.js';
import { validateBatchSize } from '../utils/configUtils.js';
import { InvalidArgumentError } from '../../errors/invalidArgumentError.js';
import IBatchOperationManager from '../interfaces/IBatchOperationManager.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../services/entityLifecycleManager.js').EntityLifecycleManager} EntityLifecycleManager */
/** @typedef {import('../services/componentMutationService.js').ComponentMutationService} ComponentMutationService */

/**
 * @typedef {object} BatchOperationResult
 * @property {Array<object>} successes - Successfully processed items
 * @property {Array<{item: object, error: Error}>} failures - Failed items with errors
 * @property {number} totalProcessed - Total number of items processed
 * @property {number} successCount - Number of successful operations
 * @property {number} failureCount - Number of failed operations
 * @property {number} processingTime - Total processing time in milliseconds
 */

/**
 * @typedef {object} BatchCreateSpec
 * @property {string} definitionId - Entity definition ID
 * @property {object} [opts] - Creation options
 * @property {string} [opts.instanceId] - Optional instance ID
 * @property {object} [opts.componentOverrides] - Component overrides
 */

/**
 * @typedef {object} BatchComponentSpec
 * @property {string} instanceId - Entity instance ID
 * @property {string} componentTypeId - Component type ID
 * @property {object} componentData - Component data
 */

/**
 * @class BatchOperationManager
 * @description Handles batch operations for entity creation, updates, and deletions
 * @implements {IBatchOperationManager}
 */
export default class BatchOperationManager extends IBatchOperationManager {
  /** @type {EntityLifecycleManager} */
  #lifecycleManager;
  /** @type {ComponentMutationService} */
  #componentMutationService;
  /** @type {ILogger} */
  #logger;
  /** @type {number} */
  #defaultBatchSize;
  /** @type {boolean} */
  #enableTransactions;

  /**
   * @class
   * @param {object} deps - Dependencies
   * @param {EntityLifecycleManager} deps.lifecycleManager - Entity lifecycle manager
   * @param {ComponentMutationService} deps.componentMutationService - Component mutation service
   * @param {ILogger} deps.logger - Logger instance
   * @param {number} [deps.defaultBatchSize] - Default batch size
   * @param {boolean} [deps.enableTransactions] - Enable transaction-like behavior
   */
  constructor({
    lifecycleManager,
    componentMutationService,
    logger,
    defaultBatchSize = 50,
    enableTransactions = true,
  }) {
    super();
    validateDependency(logger, 'ILogger', console, {
      requiredMethods: ['info', 'error', 'warn', 'debug'],
    });
    this.#logger = ensureValidLogger(logger, 'BatchOperationManager');

    validateDependency(
      lifecycleManager,
      'EntityLifecycleManager',
      this.#logger,
      {
        requiredMethods: ['createEntityInstance', 'removeEntityInstance'],
      }
    );
    this.#lifecycleManager = lifecycleManager;

    validateDependency(
      componentMutationService,
      'ComponentMutationService',
      this.#logger,
      {
        requiredMethods: ['addComponent', 'removeComponent'],
      }
    );
    this.#componentMutationService = componentMutationService;

    this.#defaultBatchSize = defaultBatchSize;
    this.#enableTransactions = enableTransactions;

    this.#logger.debug('BatchOperationManager initialized', {
      defaultBatchSize: this.#defaultBatchSize,
      enableTransactions: this.#enableTransactions,
    });
  }

  /**
   * Creates multiple entities in batch.
   *
   * @param {BatchCreateSpec[]} entitySpecs - Array of entity specifications
   * @param {object} [options] - Batch options
   * @param {number} [options.batchSize] - Batch size override
   * @param {boolean} [options.stopOnError] - Stop processing on first error
   * @param {boolean} [options.enableParallel] - Enable parallel processing
   * @returns {Promise<BatchOperationResult>} Batch operation result
   */
  async batchCreateEntities(entitySpecs, options = {}) {
    const {
      batchSize = this.#defaultBatchSize,
      stopOnError = false,
      enableParallel = false,
    } = options;

    this.#validateBatchSpecs(entitySpecs, batchSize);

    const startTime = performance.now();
    const result = {
      successes: [],
      failures: [],
      totalProcessed: 0,
      successCount: 0,
      failureCount: 0,
      processingTime: 0,
    };

    this.#logger.info(
      `Starting batch entity creation: ${entitySpecs.length} entities`
    );

    // Process in batches
    for (let i = 0; i < entitySpecs.length; i += batchSize) {
      const batch = entitySpecs.slice(i, i + batchSize);

      try {
        const batchResult = enableParallel
          ? await this.#processBatchParallel(batch, 'create')
          : await this.#processBatchSequential(batch, 'create');

        result.successes.push(...batchResult.successes);
        result.failures.push(...batchResult.failures);
        result.totalProcessed += batchResult.totalProcessed;
        result.successCount += batchResult.successCount;
        result.failureCount += batchResult.failureCount;

        if (stopOnError && batchResult.failureCount > 0) {
          this.#logger.warn(
            `Stopping batch creation due to error in batch ${Math.floor(i / batchSize) + 1}`
          );
          break;
        }
      } catch (error) {
        this.#logger.error(
          `Batch creation failed for batch ${Math.floor(i / batchSize) + 1}:`,
          error
        );

        if (stopOnError) {
          throw error;
        }

        // Mark entire batch as failed
        for (const spec of batch) {
          result.failures.push({ item: spec, error });
          result.failureCount++;
          result.totalProcessed++;
        }
      }
    }

    result.processingTime = performance.now() - startTime;

    this.#logger.info(`Batch entity creation completed`, {
      totalProcessed: result.totalProcessed,
      successes: result.successCount,
      failures: result.failureCount,
      processingTime: result.processingTime,
    });

    return result;
  }

  /**
   * Adds components to multiple entities in batch.
   *
   * @param {BatchComponentSpec[]} componentSpecs - Array of component specifications
   * @param {object} [options] - Batch options
   * @returns {Promise<BatchOperationResult>} Batch operation result
   */
  async batchAddComponents(componentSpecs, options = {}) {
    const {
      batchSize = this.#defaultBatchSize,
      stopOnError = false,
      enableParallel = false,
    } = options;

    this.#validateBatchSpecs(componentSpecs, batchSize);

    const startTime = performance.now();
    const result = {
      successes: [],
      failures: [],
      totalProcessed: 0,
      successCount: 0,
      failureCount: 0,
      processingTime: 0,
    };

    this.#logger.info(
      `Starting batch component addition: ${componentSpecs.length} components`
    );

    // Process in batches
    for (let i = 0; i < componentSpecs.length; i += batchSize) {
      const batch = componentSpecs.slice(i, i + batchSize);

      try {
        const batchResult = enableParallel
          ? await this.#processBatchParallel(batch, 'addComponent')
          : await this.#processBatchSequential(batch, 'addComponent');

        result.successes.push(...batchResult.successes);
        result.failures.push(...batchResult.failures);
        result.totalProcessed += batchResult.totalProcessed;
        result.successCount += batchResult.successCount;
        result.failureCount += batchResult.failureCount;

        if (stopOnError && batchResult.failureCount > 0) {
          this.#logger.warn(
            `Stopping batch component addition due to error in batch ${Math.floor(i / batchSize) + 1}`
          );
          break;
        }
      } catch (error) {
        this.#logger.error(
          `Batch component addition failed for batch ${Math.floor(i / batchSize) + 1}:`,
          error
        );

        if (stopOnError) {
          throw error;
        }

        // Mark entire batch as failed
        for (const spec of batch) {
          result.failures.push({ item: spec, error });
          result.failureCount++;
          result.totalProcessed++;
        }
      }
    }

    result.processingTime = performance.now() - startTime;

    this.#logger.info(`Batch component addition completed`, {
      totalProcessed: result.totalProcessed,
      successes: result.successCount,
      failures: result.failureCount,
      processingTime: result.processingTime,
    });

    return result;
  }

  /**
   * Removes multiple entities in batch.
   *
   * @param {string[]} instanceIds - Array of entity instance IDs
   * @param {object} [options] - Batch options
   * @returns {Promise<BatchOperationResult>} Batch operation result
   */
  async batchRemoveEntities(instanceIds, options = {}) {
    const {
      batchSize = this.#defaultBatchSize,
      stopOnError = false,
      enableParallel = false,
    } = options;

    this.#validateBatchSpecs(instanceIds, batchSize);

    const startTime = performance.now();
    const result = {
      successes: [],
      failures: [],
      totalProcessed: 0,
      successCount: 0,
      failureCount: 0,
      processingTime: 0,
    };

    this.#logger.info(
      `Starting batch entity removal: ${instanceIds.length} entities`
    );

    // Process in batches
    for (let i = 0; i < instanceIds.length; i += batchSize) {
      const batch = instanceIds.slice(i, i + batchSize);

      try {
        const batchResult = enableParallel
          ? await this.#processBatchParallel(batch, 'remove')
          : await this.#processBatchSequential(batch, 'remove');

        result.successes.push(...batchResult.successes);
        result.failures.push(...batchResult.failures);
        result.totalProcessed += batchResult.totalProcessed;
        result.successCount += batchResult.successCount;
        result.failureCount += batchResult.failureCount;

        if (stopOnError && batchResult.failureCount > 0) {
          this.#logger.warn(
            `Stopping batch removal due to error in batch ${Math.floor(i / batchSize) + 1}`
          );
          break;
        }
      } catch (error) {
        this.#logger.error(
          `Batch removal failed for batch ${Math.floor(i / batchSize) + 1}:`,
          error
        );

        if (stopOnError) {
          throw error;
        }

        // Mark entire batch as failed
        for (const instanceId of batch) {
          result.failures.push({ item: instanceId, error });
          result.failureCount++;
          result.totalProcessed++;
        }
      }
    }

    result.processingTime = performance.now() - startTime;

    this.#logger.info(`Batch entity removal completed`, {
      totalProcessed: result.totalProcessed,
      successes: result.successCount,
      failures: result.failureCount,
      processingTime: result.processingTime,
    });

    return result;
  }

  /**
   * Processes a batch sequentially.
   *
   * @param {Array} batch - Batch to process
   * @param {string} operation - Operation type
   * @returns {Promise<BatchOperationResult>} Batch result
   */
  async #processBatchSequential(batch, operation) {
    const result = {
      successes: [],
      failures: [],
      totalProcessed: 0,
      successCount: 0,
      failureCount: 0,
      processingTime: 0,
    };

    for (const item of batch) {
      result.totalProcessed++;

      try {
        const operationResult = await this.#executeOperation(item, operation);
        result.successes.push(operationResult);
        result.successCount++;
      } catch (error) {
        result.failures.push({ item, error });
        result.failureCount++;
      }
    }

    return result;
  }

  /**
   * Processes a batch in parallel.
   *
   * @param {Array} batch - Batch to process
   * @param {string} operation - Operation type
   * @returns {Promise<BatchOperationResult>} Batch result
   */
  async #processBatchParallel(batch, operation) {
    const result = {
      successes: [],
      failures: [],
      totalProcessed: batch.length,
      successCount: 0,
      failureCount: 0,
      processingTime: 0,
    };

    const promises = batch.map(async (item) => {
      try {
        const operationResult = await this.#executeOperation(item, operation);
        return { success: true, result: operationResult };
      } catch (error) {
        return { success: false, item, error };
      }
    });

    const results = await Promise.allSettled(promises);

    for (const promiseResult of results) {
      if (promiseResult.status === 'fulfilled') {
        const {
          success,
          result: operationResult,
          item,
          error,
        } = promiseResult.value;
        if (success) {
          result.successes.push(operationResult);
          result.successCount++;
        } else {
          result.failures.push({ item, error });
          result.failureCount++;
        }
      } else {
        result.failures.push({ item: null, error: promiseResult.reason });
        result.failureCount++;
      }
    }

    return result;
  }

  /**
   * Executes a single operation.
   *
   * @param {*} item - Item to process
   * @param {string} operation - Operation type
   * @returns {Promise<*>} Operation result
   */
  async #executeOperation(item, operation) {
    switch (operation) {
      case 'create':
        return await this.#lifecycleManager.createEntityInstance(
          item.definitionId,
          item.opts
        );

      case 'addComponent':
        return await this.#componentMutationService.addComponent(
          item.instanceId,
          item.componentTypeId,
          item.componentData
        );

      case 'remove':
        return await this.#lifecycleManager.removeEntityInstance(item);

      /* istanbul ignore next -- defensive guard for unexpected operations */
      default:
        throw new Error(`Unknown batch operation: ${operation}`);
    }
  }

  /**
   * Validates batch specifications.
   *
   * @param {Array} specs - Specifications to validate
   * @param {number} batchSize - Batch size
   */
  #validateBatchSpecs(specs, batchSize) {
    if (!Array.isArray(specs)) {
      throw new InvalidArgumentError('Batch specifications must be an array');
    }

    if (specs.length === 0) {
      throw new InvalidArgumentError('Batch specifications cannot be empty');
    }

    validateBatchSize(batchSize);
  }

  /**
   * Gets batch operation statistics.
   *
   * @returns {object} Statistics
   */
  getStats() {
    return {
      defaultBatchSize: this.#defaultBatchSize,
      enableTransactions: this.#enableTransactions,
      // Add more statistics as needed
    };
  }

  /**
   * Sets the default batch size.
   *
   * @param {number} batchSize - New batch size
   */
  setDefaultBatchSize(batchSize) {
    validateBatchSize(batchSize);
    this.#defaultBatchSize = batchSize;
    this.#logger.debug(`Default batch size set to ${batchSize}`);
  }

  /**
   * Enables or disables transaction-like behavior.
   *
   * @param {boolean} enabled - Whether to enable transactions
   */
  setTransactionsEnabled(enabled) {
    this.#enableTransactions = enabled;
    this.#logger.debug(`Transactions ${enabled ? 'enabled' : 'disabled'}`);
  }
}
