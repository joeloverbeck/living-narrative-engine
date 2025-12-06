/**
 * @file Common option types and utilities for facade operations
 * @description Defines standardized option objects used across all facade implementations
 * @see src/clothing/facades/IClothingSystemFacade.js
 * @see src/anatomy/facades/IAnatomySystemFacade.js
 */

/**
 * Base options for all facade operations
 *
 * @typedef {object} BaseFacadeOptions
 * @property {boolean} [cache=true] - Whether to use caching for this operation
 * @property {number} [timeout] - Operation timeout in milliseconds
 * @property {boolean} [validate=true] - Whether to validate inputs/outputs
 * @property {object} [metadata] - Additional metadata to include in operation
 * @property {string} [requestId] - Unique identifier for request tracking
 */

/**
 * Query operation options
 *
 * @typedef {BaseFacadeOptions} QueryOptions
 * @property {boolean} [includeMetadata=false] - Include item/entity metadata in results
 * @property {string[]} [fields] - Specific fields to include in results
 * @property {object} [filters] - Additional filters to apply
 * @property {number} [limit] - Maximum number of results to return
 * @property {number} [offset] - Number of results to skip (for pagination)
 * @property {string} [sortBy] - Field to sort results by
 * @property {string} [sortOrder='asc'] - Sort order ('asc' or 'desc')
 */

/**
 * Modification operation options
 *
 * @typedef {BaseFacadeOptions} ModificationOptions
 * @property {boolean} [force=false] - Force operation even if validation fails
 * @property {boolean} [dryRun=false] - Preview operation without making changes
 * @property {string} [reason] - Reason for the modification (for audit trail)
 * @property {boolean} [cascade=true] - Apply cascading changes to related entities
 * @property {object} [constraints] - Additional constraints to enforce
 * @property {boolean} [notifyOnChange=true] - Dispatch events for changes
 */

/**
 * Bulk operation options
 *
 * @typedef {ModificationOptions} BulkOptions
 * @property {number} [batchSize=10] - Number of items to process per batch
 * @property {boolean} [parallel=false] - Whether to process batches in parallel
 * @property {boolean} [stopOnError=true] - Stop processing if an error occurs
 * @property {boolean} [returnResults=false] - Return results for each item
 * @property {Function} [onProgress] - Progress callback function
 * @property {Function} [onError] - Error callback function
 */

/**
 * Validation operation options
 *
 * @typedef {BaseFacadeOptions} ValidationOptions
 * @property {string} [level='strict'] - Validation level ('strict', 'moderate', 'lenient')
 * @property {boolean} [includeWarnings=false] - Include warnings in validation results
 * @property {string[]} [skipRules] - Validation rules to skip
 * @property {object} [customRules] - Custom validation rules to apply
 * @property {boolean} [fixIssues=false] - Attempt to automatically fix issues
 */

/**
 * Transfer operation options (for moving items/parts between entities)
 *
 * @typedef {ModificationOptions} TransferOptions
 * @property {boolean} [keepOriginal=false] - Keep original item/part after transfer
 * @property {object} [mapping] - Custom mapping for transferred items
 * @property {boolean} [validateCompatibility=true] - Check compatibility before transfer
 * @property {string} [transferMode='move'] - Transfer mode ('move', 'copy', 'link')
 * @property {boolean} [updateReferences=true] - Update references after transfer
 */

/**
 * Description generation options
 *
 * @typedef {BaseFacadeOptions} DescriptionOptions
 * @property {string} [style='default'] - Description style ('default', 'detailed', 'brief')
 * @property {string} [perspective='third'] - Narrative perspective ('first', 'second', 'third')
 * @property {boolean} [includeHidden=false] - Include hidden or internal details
 * @property {string[]} [focus] - Specific aspects to focus on
 * @property {object} [context] - Additional context for description generation
 * @property {string} [language='en'] - Language for generated description
 */

/**
 * Cache-related options
 *
 * @typedef {object} CacheOptions
 * @property {boolean} [useCache=true] - Whether to use caching
 * @property {number} [ttl] - Cache time-to-live in milliseconds
 * @property {string} [cacheKey] - Custom cache key (auto-generated if not provided)
 * @property {boolean} [forceRefresh=false] - Force cache refresh
 * @property {string} [cacheNamespace] - Cache namespace for organization
 */

/**
 * Event options for facade operations
 *
 * @typedef {object} EventOptions
 * @property {boolean} [dispatch=true] - Whether to dispatch events for this operation
 * @property {string[]} [suppressEvents] - Event types to suppress
 * @property {object} [eventMetadata] - Additional metadata to include in events
 * @property {boolean} [waitForHandlers=false] - Wait for event handlers to complete
 */

/**
 * Resilience options for error handling and retries
 *
 * @typedef {object} ResilienceOptions
 * @property {number} [retries=0] - Number of retry attempts
 * @property {number} [retryDelay=1000] - Delay between retries in milliseconds
 * @property {Function} [fallback] - Fallback function if operation fails
 * @property {string[]} [retryableErrors] - Error types that should trigger retries
 * @property {boolean} [useCircuitBreaker=true] - Use circuit breaker pattern
 */

/**
 * Performance monitoring options
 *
 * @typedef {object} PerformanceOptions
 * @property {boolean} [trackPerformance=false] - Track operation performance
 * @property {string} [operationName] - Name for performance tracking
 * @property {object} [performanceThresholds] - Warning thresholds for performance
 * @property {boolean} [logSlowOperations=true] - Log operations that exceed thresholds
 */

/**
 * Create default options object with common settings
 *
 * @param {object} [overrides] - Option overrides
 * @returns {BaseFacadeOptions} Default options object
 */
export function createDefaultOptions(overrides = {}) {
  return {
    cache: true,
    validate: true,
    metadata: {},
    ...overrides,
  };
}

/**
 * Create query options with defaults
 *
 * @param {object} [overrides] - Option overrides
 * @returns {QueryOptions} Query options object
 */
export function createQueryOptions(overrides = {}) {
  return {
    ...createDefaultOptions(),
    includeMetadata: false,
    sortOrder: 'asc',
    ...overrides,
  };
}

/**
 * Create modification options with defaults
 *
 * @param {object} [overrides] - Option overrides
 * @returns {ModificationOptions} Modification options object
 */
export function createModificationOptions(overrides = {}) {
  return {
    ...createDefaultOptions(),
    force: false,
    dryRun: false,
    cascade: true,
    notifyOnChange: true,
    ...overrides,
  };
}

/**
 * Create bulk operation options with defaults
 *
 * @param {object} [overrides] - Option overrides
 * @returns {BulkOptions} Bulk options object
 */
export function createBulkOptions(overrides = {}) {
  return {
    ...createModificationOptions(),
    batchSize: 10,
    parallel: false,
    stopOnError: true,
    returnResults: false,
    ...overrides,
  };
}

/**
 * Create validation options with defaults
 *
 * @param {object} [overrides] - Option overrides
 * @returns {ValidationOptions} Validation options object
 */
export function createValidationOptions(overrides = {}) {
  return {
    ...createDefaultOptions(),
    level: 'strict',
    includeWarnings: false,
    fixIssues: false,
    ...overrides,
  };
}

/**
 * Create default description generation options
 *
 * @param {object} [overrides] - Option overrides
 * @returns {object} Description options object
 */
export function createDescriptionOptions(overrides = {}) {
  return {
    ...createDefaultOptions(),
    style: 'default',
    perspective: 'third-person',
    detailLevel: 'medium',
    includeContext: true,
    ...overrides,
  };
}

/**
 * Merge multiple option objects with proper precedence
 *
 * @param {...object} optionObjects - Option objects to merge (later objects override earlier ones)
 * @returns {object} Merged options object
 */
export function mergeOptions(...optionObjects) {
  return optionObjects.reduce((merged, options) => {
    if (options && typeof options === 'object') {
      return { ...merged, ...options };
    }
    return merged;
  }, {});
}

/**
 * Validate option object against expected structure
 *
 * @param {object} options - Options object to validate
 * @param {object} schema - Schema object defining allowed/required options
 * @returns {object} Validation result with { valid: boolean, errors: string[] }
 */
export function validateOptions(options, schema) {
  const errors = [];

  if (!options || typeof options !== 'object') {
    errors.push('Options must be an object');
    return { valid: false, errors };
  }

  // Check required fields
  if (schema.required && Array.isArray(schema.required)) {
    for (const field of schema.required) {
      if (!(field in options)) {
        errors.push(`Required option missing: ${field}`);
      }
    }
  }

  // Check field types
  if (schema.types && typeof schema.types === 'object') {
    for (const [field, expectedType] of Object.entries(schema.types)) {
      if (field in options) {
        const actualType = typeof options[field];
        if (
          actualType !== expectedType &&
          options[field] !== null &&
          options[field] !== undefined
        ) {
          errors.push(
            `Option ${field} must be of type ${expectedType}, got ${actualType}`
          );
        }
      }
    }
  }

  // Check allowed values
  if (schema.allowedValues && typeof schema.allowedValues === 'object') {
    for (const [field, allowedValues] of Object.entries(schema.allowedValues)) {
      if (field in options && !allowedValues.includes(options[field])) {
        errors.push(
          `Option ${field} must be one of: ${allowedValues.join(', ')}`
        );
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
