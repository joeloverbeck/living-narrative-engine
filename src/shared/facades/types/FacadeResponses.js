/**
 * @file Standard response types and utilities for facade operations
 * @description Defines consistent response formats used across all facade implementations
 * @see src/clothing/facades/IClothingSystemFacade.js
 * @see src/anatomy/facades/IAnatomySystemFacade.js
 */

/**
 * Base response structure for all facade operations
 *
 * @typedef {object} BaseFacadeResponse
 * @property {boolean} success - Whether the operation was successful
 * @property {*} [data] - Operation result data (if successful)
 * @property {object} [error] - Error information (if operation failed)
 * @property {object} metadata - Operation metadata
 * @property {string} metadata.operationType - Type of operation performed
 * @property {number} metadata.timestamp - Operation timestamp
 * @property {number} metadata.duration - Operation duration in milliseconds
 * @property {string} [metadata.requestId] - Request identifier for tracking
 * @property {object} [metadata.performance] - Performance metrics
 */

/**
 * Error information structure
 *
 * @typedef {object} FacadeError
 * @property {string} code - Error code identifier
 * @property {string} message - Human-readable error message
 * @property {string} [type] - Error type/category
 * @property {object} [details] - Additional error details
 * @property {string} [stack] - Error stack trace (in development)
 * @property {object[]} [context] - Context information where error occurred
 */

/**
 * Validation result structure
 *
 * @typedef {object} ValidationResult
 * @property {boolean} valid - Whether validation passed
 * @property {object[]} [errors] - Validation errors
 * @property {object[]} [warnings] - Validation warnings
 * @property {object[]} [suggestions] - Suggestions for fixing issues
 * @property {object} [metadata] - Validation metadata
 */

/**
 * Query response for list operations
 *
 * @typedef {BaseFacadeResponse} QueryResponse
 * @property {object[]} data - Array of result items
 * @property {object} pagination - Pagination information
 * @property {number} pagination.total - Total number of items available
 * @property {number} pagination.count - Number of items in current response
 * @property {number} pagination.offset - Current offset
 * @property {number} [pagination.limit] - Items per page limit
 * @property {boolean} pagination.hasMore - Whether more items are available
 * @property {object} [filters] - Applied filters
 * @property {string} [sortBy] - Sort field used
 * @property {string} [sortOrder] - Sort order used
 */

/**
 * Single item response
 *
 * @typedef {BaseFacadeResponse} ItemResponse
 * @property {object} data - Single result item
 * @property {boolean} [cached] - Whether result was served from cache
 * @property {string} [cacheKey] - Cache key used (if applicable)
 */

/**
 * Modification operation response
 *
 * @typedef {BaseFacadeResponse} ModificationResponse
 * @property {object} data - Modified entity/item data
 * @property {object} [changes] - Details of changes made
 * @property {object[]} [changes.added] - Items that were added
 * @property {object[]} [changes.removed] - Items that were removed
 * @property {object[]} [changes.modified] - Items that were modified
 * @property {object[]} [affectedEntities] - Other entities affected by the change
 * @property {ValidationResult} [validation] - Validation results
 * @property {boolean} [rollbackAvailable] - Whether operation can be rolled back
 */

/**
 * Bulk operation response
 *
 * @typedef {BaseFacadeResponse} BulkResponse
 * @property {object} data - Bulk operation results
 * @property {number} data.processed - Number of items processed
 * @property {number} data.successful - Number of successful operations
 * @property {number} data.failed - Number of failed operations
 * @property {object[]} [data.results] - Individual operation results
 * @property {object[]} [data.errors] - Errors that occurred
 * @property {object} [progress] - Progress information
 * @property {boolean} [partial] - Whether operation completed partially
 */

/**
 * Validation operation response
 *
 * @typedef {BaseFacadeResponse} ValidationResponse
 * @property {ValidationResult} data - Validation results
 * @property {object} [suggestions] - Suggested fixes or improvements
 * @property {boolean} [autoFixApplied] - Whether automatic fixes were applied
 * @property {object[]} [fixedIssues] - Issues that were automatically fixed
 */

/**
 * Description generation response
 *
 * @typedef {BaseFacadeResponse} DescriptionResponse
 * @property {object} data - Generated description data
 * @property {string} data.description - Generated description text
 * @property {string} [data.style] - Style used for generation
 * @property {string} [data.perspective] - Narrative perspective used
 * @property {object} [data.context] - Context used in generation
 * @property {string[]} [data.focusAreas] - Areas of focus in description
 * @property {object} [generationMetadata] - Metadata about generation process
 */

/**
 * Graph operation response (for anatomy system)
 *
 * @typedef {BaseFacadeResponse} GraphResponse
 * @property {object} data - Graph data
 * @property {object[]} data.nodes - Graph nodes
 * @property {object[]} data.edges - Graph edges
 * @property {object} [data.properties] - Graph properties
 * @property {object} [analysis] - Graph analysis results
 * @property {ValidationResult} [validation] - Graph validation results
 */

/**
 * Compatibility check response
 *
 * @typedef {BaseFacadeResponse} CompatibilityResponse
 * @property {object} data - Compatibility results
 * @property {boolean} data.compatible - Whether items are compatible
 * @property {string} [data.reason] - Reason for incompatibility
 * @property {object[]} [data.conflicts] - Specific conflicts found
 * @property {object[]} [data.requirements] - Requirements for compatibility
 * @property {object[]} [data.suggestions] - Suggestions for resolving conflicts
 */

/**
 * Transfer operation response
 *
 * @typedef {BaseFacadeResponse} TransferResponse
 * @property {object} data - Transfer results
 * @property {string} data.fromEntity - Source entity ID
 * @property {string} data.toEntity - Target entity ID
 * @property {object[]} data.transferred - Items that were transferred
 * @property {object[]} [data.failed] - Items that failed to transfer
 * @property {object} [mapping] - ID mapping for transferred items
 * @property {ValidationResult} [validation] - Validation results for target
 */

/**
 * Create a successful response
 *
 * @param {*} data - Response data
 * @param {string} operationType - Type of operation
 * @param {object} [options] - Additional options
 * @returns {BaseFacadeResponse} Success response
 */
export function createSuccessResponse(data, operationType, options = {}) {
  const response = {
    success: true,
    data,
    metadata: {
      operationType,
      timestamp: Date.now(),
      duration: options.duration || 0,
      ...options.metadata,
    },
  };

  if (options.requestId) {
    response.metadata.requestId = options.requestId;
  }

  if (options.performance) {
    response.metadata.performance = options.performance;
  }

  if (options.cached !== undefined) {
    response.cached = options.cached;
  }

  if (options.cacheKey) {
    response.cacheKey = options.cacheKey;
  }

  return response;
}

/**
 * Create an error response
 *
 * @param {Error|string} error - Error object or message
 * @param {string} operationType - Type of operation
 * @param {object} [options] - Additional options
 * @returns {BaseFacadeResponse} Error response
 */
export function createErrorResponse(error, operationType, options = {}) {
  let errorInfo;

  if (error instanceof Error) {
    errorInfo = {
      code: error.code || 'UNKNOWN_ERROR',
      message: error.message,
      type: error.constructor.name,
      details: error.details || {},
    };

    // Include stack trace in development
    if (process.env.NODE_ENV === 'development') {
      errorInfo.stack = error.stack;
    }
  } else if (typeof error === 'string') {
    errorInfo = {
      code: 'FACADE_ERROR',
      message: error,
      type: 'FacadeError',
    };
  } else {
    errorInfo = {
      code: 'INVALID_ERROR',
      message: 'Invalid error object provided',
      type: 'FacadeError',
    };
  }

  const response = {
    success: false,
    error: errorInfo,
    metadata: {
      operationType,
      timestamp: Date.now(),
      duration: options.duration || 0,
      ...options.metadata,
    },
  };

  if (options.requestId) {
    response.metadata.requestId = options.requestId;
  }

  if (options.context) {
    response.error.context = options.context;
  }

  return response;
}

/**
 * Create a query response with pagination
 *
 * @param {object[]} items - Result items
 * @param {object} pagination - Pagination info
 * @param {string} operationType - Operation type
 * @param {object} [options] - Additional options
 * @returns {QueryResponse} Query response
 */
export function createQueryResponse(
  items,
  pagination,
  operationType,
  options = {}
) {
  const response = createSuccessResponse({}, operationType, options);

  response.data = items;
  response.pagination = {
    total: pagination.total || items.length,
    count: items.length,
    offset: pagination.offset || 0,
    hasMore: pagination.hasMore || false,
    ...pagination,
  };

  if (options.filters) {
    response.filters = options.filters;
  }

  if (options.sortBy) {
    response.sortBy = options.sortBy;
    response.sortOrder = options.sortOrder || 'asc';
  }

  return response;
}

/**
 * Create a modification response
 *
 * @param {object} data - Modified data
 * @param {object} changes - Change details
 * @param {string} operationType - Operation type
 * @param {object} [options] - Additional options
 * @returns {ModificationResponse} Modification response
 */
export function createModificationResponse(
  data,
  changes,
  operationType,
  options = {}
) {
  const response = createSuccessResponse(data, operationType, options);

  response.changes = changes;

  if (options.affectedEntities) {
    response.affectedEntities = options.affectedEntities;
  }

  if (options.validation) {
    response.validation = options.validation;
  }

  if (options.rollbackAvailable !== undefined) {
    response.rollbackAvailable = options.rollbackAvailable;
  }

  return response;
}

/**
 * Create a bulk operation response
 *
 * @param {object} results - Bulk operation results
 * @param {string} operationType - Operation type
 * @param {object} [options] - Additional options
 * @returns {BulkResponse} Bulk response
 */
export function createBulkResponse(results, operationType, options = {}) {
  const response = createSuccessResponse(results, operationType, options);

  if (options.progress) {
    response.progress = options.progress;
  }

  if (options.partial !== undefined) {
    response.partial = options.partial;
  }

  return response;
}

/**
 * Create a validation response
 *
 * @param {ValidationResult} validation - Validation results
 * @param {string} operationType - Operation type
 * @param {object} [options] - Additional options
 * @returns {ValidationResponse} Validation response
 */
export function createValidationResponse(
  validation,
  operationType,
  options = {}
) {
  const response = createSuccessResponse(validation, operationType, options);

  if (options.suggestions) {
    response.suggestions = options.suggestions;
  }

  if (options.autoFixApplied !== undefined) {
    response.autoFixApplied = options.autoFixApplied;
  }

  if (options.fixedIssues) {
    response.fixedIssues = options.fixedIssues;
  }

  return response;
}

/**
 * Create a graph response (for anatomy system)
 *
 * @param {object} graphData - Graph data including nodes and edges
 * @param {string} operationType - Operation type
 * @param {object} [options] - Additional options
 * @returns {GraphResponse} Graph response
 */
export function createGraphResponse(graphData, operationType, options = {}) {
  const response = createSuccessResponse(graphData, operationType, options);

  if (options.analysis) {
    response.analysis = options.analysis;
  }

  if (options.validation) {
    response.validation = options.validation;
  }

  return response;
}

/**
 * Create a description generation response
 *
 * @param {object} descriptionData - Description data including text and metadata
 * @param {string} operationType - Operation type
 * @param {object} [options] - Additional options
 * @returns {DescriptionResponse} Description response
 */
export function createDescriptionResponse(
  descriptionData,
  operationType,
  options = {}
) {
  const response = createSuccessResponse(
    descriptionData,
    operationType,
    options
  );

  if (options.generationMetadata) {
    response.generationMetadata = options.generationMetadata;
  }

  return response;
}

/**
 * Wrap a response with timing information
 *
 * @param {Function} operation - Operation function to execute
 * @param {string} operationType - Operation type
 * @param {object} [options] - Additional options
 * @returns {Promise<BaseFacadeResponse>} Response with timing
 */
export async function withTiming(operation, operationType, options = {}) {
  const startTime = Date.now();

  try {
    const result = await operation();
    const duration = Date.now() - startTime;

    if (result && typeof result === 'object' && 'success' in result) {
      // Already a facade response, just update timing
      result.metadata = result.metadata || {};
      result.metadata.duration = duration;
      return result;
    }

    // Wrap result in success response
    return createSuccessResponse(result, operationType, {
      duration,
      ...options,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    return createErrorResponse(error, operationType, {
      duration,
      ...options,
    });
  }
}

/**
 * Check if a response indicates success
 *
 * @param {BaseFacadeResponse} response - Response to check
 * @returns {boolean} True if response indicates success
 */
export function isSuccessResponse(response) {
  return response && typeof response === 'object' && response.success === true;
}

/**
 * Check if a response indicates an error
 *
 * @param {BaseFacadeResponse} response - Response to check
 * @returns {boolean} True if response indicates an error
 */
export function isErrorResponse(response) {
  return response && typeof response === 'object' && response.success === false;
}

/**
 * Extract error information from a response
 *
 * @param {BaseFacadeResponse} response - Response to extract error from
 * @returns {FacadeError|null} Error information or null if no error
 */
export function getErrorInfo(response) {
  if (isErrorResponse(response)) {
    return response.error;
  }
  return null;
}

/**
 * Extract data from a successful response
 *
 * @param {BaseFacadeResponse} response - Response to extract data from
 * @returns {*} Response data or null if error response
 */
export function getResponseData(response) {
  if (isSuccessResponse(response)) {
    return response.data;
  }
  return null;
}
