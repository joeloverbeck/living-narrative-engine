/**
 * @file Utility functions for bulk component operations with infinite recursion prevention
 * @see componentMutationService.js, safeErrorLogger.js
 */

import { ensureValidLogger } from './loggerUtils.js';
import createSafeErrorLogger from './safeErrorLogger.js';

/**
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../events/eventBus.js').default} EventBus
 * @typedef {import('../entities/services/componentMutationService.js').ComponentMutationService} ComponentMutationService
 */

/**
 * Configuration for bulk component operations.
 * 
 * @typedef {object} BulkOperationConfig
 * @property {string} [context='bulk-operation'] - Operation context for logging
 * @property {number} [batchSize=50] - Number of operations per batch
 * @property {number} [timeoutMs=30000] - Total operation timeout
 * @property {boolean} [continueOnError=true] - Whether to continue on individual failures
 * @property {boolean} [enableBatchMode=true] - Whether to enable EventBus batch mode
 */

/**
 * Result of a bulk component operation.
 * 
 * @typedef {object} BulkOperationResult
 * @property {number} total - Total number of operations attempted
 * @property {number} successful - Number of successful operations
 * @property {number} failed - Number of failed operations
 * @property {Array<{id: string, component: string, error: Error}>} failures - Details of failures
 * @property {number} durationMs - Total operation duration in milliseconds
 */

/**
 * Creates bulk component operation utilities with recursion protection.
 * 
 * @param {object} deps - Dependencies
 * @param {ComponentMutationService} deps.componentMutationService - Component mutation service
 * @param {EventBus} deps.eventBus - Event bus instance
 * @param {ILogger} deps.logger - Logger instance
 * @returns {object} Bulk operation utilities
 */
export function createBulkComponentOperations({
  componentMutationService,
  eventBus,
  logger
}) {
  const safeLogger = ensureValidLogger(logger, 'BulkComponentOperations');
  const errorLogger = createSafeErrorLogger({ logger: safeLogger, eventBus });
  
  /**
   * Adds multiple components to multiple entities in batches with recursion protection.
   * 
   * @param {Array<{entityId: string, componentTypeId: string, componentData: object}>} operations - Component operations to perform
   * @param {BulkOperationConfig} [config] - Operation configuration
   * @returns {Promise<BulkOperationResult>} Operation results
   */
  async function bulkAddComponents(operations, config = {}) {
    const defaultConfig = {
      context: 'bulk-component-add',
      batchSize: 50,
      timeoutMs: 30000,
      continueOnError: true,
      enableBatchMode: true
    };
    
    const operationConfig = { ...defaultConfig, ...config };
    const startTime = Date.now();
    
    const result = {
      total: operations.length,
      successful: 0,
      failed: 0,
      failures: [],
      durationMs: 0
    };
    
    if (operations.length === 0) {
      result.durationMs = Date.now() - startTime;
      return result;
    }
    
    safeLogger.debug(
      `BulkComponentOperations: Starting bulk add of ${operations.length} components with context: ${operationConfig.context}`
    );
    
    // Use game loading mode for recursion protection
    return await errorLogger.withGameLoadingMode(
      async () => {
        // Process operations in batches
        for (let i = 0; i < operations.length; i += operationConfig.batchSize) {
          const batch = operations.slice(i, i + operationConfig.batchSize);
          
          safeLogger.debug(
            `BulkComponentOperations: Processing batch ${Math.floor(i / operationConfig.batchSize) + 1} of ${Math.ceil(operations.length / operationConfig.batchSize)} (${batch.length} operations)`
          );
          
          // Process batch operations
          await Promise.allSettled(
            batch.map(async (operation) => {
              try {
                await componentMutationService.addComponent(
                  operation.entityId,
                  operation.componentTypeId,
                  operation.componentData
                );
                result.successful++;
              } catch (error) {
                result.failed++;
                result.failures.push({
                  id: operation.entityId,
                  component: operation.componentTypeId,
                  error
                });
                
                errorLogger.safeError(
                  `BulkComponentOperations: Failed to add component ${operation.componentTypeId} to entity ${operation.entityId}`,
                  error,
                  { operation }
                );
                
                if (!operationConfig.continueOnError) {
                  throw error;
                }
              }
            })
          );
          
          // Check for timeout
          if (Date.now() - startTime > operationConfig.timeoutMs) {
            errorLogger.safeWarn(
              `BulkComponentOperations: Operation timeout reached after ${Date.now() - startTime}ms`
            );
            break;
          }
        }
        
        result.durationMs = Date.now() - startTime;
        
        safeLogger.debug(
          `BulkComponentOperations: Completed bulk add operation. ` +
          `${result.successful} successful, ${result.failed} failed, ${result.durationMs}ms duration`
        );
        
        return result;
      },
      {
        context: operationConfig.context,
        timeoutMs: operationConfig.timeoutMs
      }
    );
  }
  
  /**
   * Safely adds components to a single entity during game loading.
   * Automatically manages batch mode for the operation.
   * 
   * @param {string} entityId - Entity ID
   * @param {Array<{componentTypeId: string, componentData: object}>} components - Components to add
   * @param {BulkOperationConfig} [config] - Operation configuration
   * @returns {Promise<BulkOperationResult>} Operation results
   */
  async function safeAddComponentsToEntity(entityId, components, config = {}) {
    const operations = components.map(component => ({
      entityId,
      componentTypeId: component.componentTypeId,
      componentData: component.componentData
    }));
    
    return await bulkAddComponents(operations, {
      ...config,
      context: `safe-add-components-entity:${entityId}`
    });
  }
  
  /**
   * Creates a batch operation context that can be reused for multiple operations.
   * Useful when you need to perform several bulk operations in sequence.
   * 
   * @param {BulkOperationConfig} [config] - Context configuration
   * @returns {object} Batch operation context
   */
  function createBatchContext(config = {}) {
    const contextConfig = {
      context: 'batch-context',
      timeoutMs: 60000, // Longer timeout for contexts
      ...config
    };
    
    let isContextActive = false;
    
    return {
      /**
       * Starts the batch context with game loading mode.
       */
      async start() {
        if (isContextActive) {
          safeLogger.warn('BulkComponentOperations: Batch context already active');
          return;
        }
        
        isContextActive = true;
        errorLogger.enableGameLoadingMode(contextConfig);
        safeLogger.debug(`BulkComponentOperations: Batch context started: ${contextConfig.context}`);
      },
      
      /**
       * Ends the batch context and disables game loading mode.
       */
      async end() {
        if (!isContextActive) {
          return;
        }
        
        isContextActive = false;
        errorLogger.disableGameLoadingMode();
        safeLogger.debug(`BulkComponentOperations: Batch context ended: ${contextConfig.context}`);
      },
      
      /**
       * Executes a function within the batch context.
       * 
       * @param {Function} fn - Function to execute
       * @returns {Promise<any>} Function result
       */
      async execute(fn) {
        await this.start();
        try {
          return await fn();
        } finally {
          await this.end();
        }
      },
      
      /**
       * Returns whether the context is currently active.
       */
      isActive() {
        return isContextActive;
      }
    };
  }
  
  return {
    bulkAddComponents,
    safeAddComponentsToEntity,
    createBatchContext
  };
}

export default createBulkComponentOperations;