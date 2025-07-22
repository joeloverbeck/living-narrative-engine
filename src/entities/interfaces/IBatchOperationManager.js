/**
 * @file IBatchOperationManager - Interface for batch entity operations
 * @module IBatchOperationManager
 */

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
 * @interface IBatchOperationManager
 * @description Interface for batch operations on entities
 */
export default class IBatchOperationManager {
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
    throw new Error('Method not implemented');
  }

  /**
   * Adds components to multiple entities in batch.
   *
   * @param {BatchComponentSpec[]} componentSpecs - Array of component specifications
   * @param {object} [options] - Batch options
   * @returns {Promise<BatchOperationResult>} Batch operation result
   */
  async batchAddComponents(componentSpecs, options = {}) {
    throw new Error('Method not implemented');
  }

  /**
   * Removes multiple entities in batch.
   *
   * @param {string[]} instanceIds - Array of entity instance IDs
   * @param {object} [options] - Batch options
   * @returns {Promise<BatchOperationResult>} Batch operation result
   */
  async batchRemoveEntities(instanceIds, options = {}) {
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

  /**
   * Enables or disables transaction-like behavior.
   *
   * @param {boolean} enabled - Whether to enable transactions
   */
  setTransactionsEnabled(enabled) {
    throw new Error('Method not implemented');
  }
}
