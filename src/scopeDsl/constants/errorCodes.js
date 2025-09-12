/**
 * @file Error codes for ScopeDSL system following existing numbering scheme
 * @description Defines standardized error codes for the ScopeDSL system using a hierarchical
 * numbering scheme that aligns with existing implementation patterns.
 *
 * The numbering scheme uses category-based prefixes (1000, 2000, etc.) with specific
 * subcodes for granular error identification and handling.
 */

/**
 * Error codes for ScopeDSL system following existing numbering scheme
 *
 * Base codes from existing implementation:
 * - 1000: MISSING_CONTEXT errors
 * - 2000: INVALID_DATA errors
 * - 3000: RESOLUTION_FAILURE errors
 * - 4001-4002: CYCLE_DETECTED and DEPTH_EXCEEDED (existing codes)
 * - 5000: PARSE_ERROR errors
 * - 6000: CONFIGURATION errors
 * - 9000-9999: UNKNOWN/fallback errors
 *
 * @readonly
 * @enum {string}
 */
export const ErrorCodes = Object.freeze({
  // Context errors (1xxx) - Base: SCOPE_1000
  /** Generic missing context error */
  MISSING_CONTEXT_GENERIC: 'SCOPE_1000',
  /** Actor not found in context */
  MISSING_ACTOR: 'SCOPE_1001',
  /** Invalid actor ID format */
  INVALID_ACTOR_ID: 'SCOPE_1002',
  /** Event dispatcher missing from context */
  MISSING_DISPATCHER: 'SCOPE_1003',
  /** Entity registry missing from context */
  MISSING_REGISTRY: 'SCOPE_1004',
  /** Runtime context missing or incomplete */
  MISSING_RUNTIME_CONTEXT: 'SCOPE_1005',
  /** Location context missing */
  MISSING_LOCATION: 'SCOPE_1006',
  /** Target entity missing from context */
  MISSING_TARGET: 'SCOPE_1007',

  // Data validation errors (2xxx) - Base: SCOPE_2000
  /** Generic invalid data error */
  INVALID_DATA_GENERIC: 'SCOPE_2000',
  /** Invalid node type in scope expression */
  INVALID_NODE_TYPE: 'SCOPE_2001',
  /** Node missing required parent reference */
  MISSING_NODE_PARENT: 'SCOPE_2002',
  /** Invalid node structure or format */
  INVALID_NODE_STRUCTURE: 'SCOPE_2003',
  /** Malformed scope expression syntax */
  MALFORMED_EXPRESSION: 'SCOPE_2004',
  /** Invalid component ID format */
  INVALID_COMPONENT_ID: 'SCOPE_2005',
  /** Invalid entity ID format */
  INVALID_ENTITY_ID: 'SCOPE_2006',
  /** Invalid JSON Logic filter expression */
  INVALID_FILTER_EXPRESSION: 'SCOPE_2007',
  /** Data type mismatch in operation */
  DATA_TYPE_MISMATCH: 'SCOPE_2008',

  // Resolution errors (3xxx) - Base: SCOPE_3000
  /** Generic resolution failure */
  RESOLUTION_FAILED_GENERIC: 'SCOPE_3000',
  /** Scope definition not found */
  SCOPE_NOT_FOUND: 'SCOPE_3001',
  /** JSON Logic filter evaluation failed */
  FILTER_EVAL_FAILED: 'SCOPE_3002',
  /** Entity resolution failed */
  ENTITY_RESOLUTION_FAILED: 'SCOPE_3003',
  /** Component resolution failed */
  COMPONENT_RESOLUTION_FAILED: 'SCOPE_3004',
  /** Step resolution failed in scope chain */
  STEP_RESOLUTION_FAILED: 'SCOPE_3005',
  /** Union operation resolution failed */
  UNION_RESOLUTION_FAILED: 'SCOPE_3006',
  /** Array iteration resolution failed */
  ARRAY_ITERATION_FAILED: 'SCOPE_3007',
  /** Slot access resolution failed */
  SLOT_ACCESS_FAILED: 'SCOPE_3008',
  /** Clothing step resolution failed */
  CLOTHING_STEP_FAILED: 'SCOPE_3009',
  /** Connection failed to service or endpoint */
  CONNECTION_FAILED: 'SCOPE_3010',
  /** Service not found or unavailable */
  SERVICE_NOT_FOUND: 'SCOPE_3011',
  /** Batch operation failed with partial or complete failure */
  BATCH_OPERATION_FAILED: 'SCOPE_3012',
  /** Queue processing failed */
  QUEUE_PROCESSING_FAILED: 'SCOPE_3013',
  /** Async operation failed */
  ASYNC_OPERATION_FAILED: 'SCOPE_3014',
  /** Clothing accessibility service operation failed */
  CLOTHING_ACCESS_FAILED: 'SCOPE_3015',

  // System errors (4xxx) - Existing: SCOPE_4001, SCOPE_4002
  /** Circular dependency detected (existing code) */
  CYCLE_DETECTED: 'SCOPE_4001',
  /** Maximum resolution depth exceeded (existing code) */
  MAX_DEPTH_EXCEEDED: 'SCOPE_4002',
  /** Memory limit reached during resolution */
  MEMORY_LIMIT: 'SCOPE_4003',
  /** System resource exhaustion */
  RESOURCE_EXHAUSTION: 'SCOPE_4004',
  /** Thread or execution timeout */
  EXECUTION_TIMEOUT: 'SCOPE_4005',
  /** Stack overflow in recursive operations */
  STACK_OVERFLOW: 'SCOPE_4006',
  /** Operation timeout (alias for async operations) */
  TIMEOUT: 'SCOPE_4007',
  /** Maximum retry attempts exceeded */
  MAX_RETRIES_EXCEEDED: 'SCOPE_4008',
  /** Circuit breaker open due to repeated failures */
  CIRCUIT_BREAKER_OPEN: 'SCOPE_4009',
  /** Batch error summary for aggregated errors */
  BATCH_ERROR_SUMMARY: 'SCOPE_4010',

  // Parse errors (5xxx) - Base: SCOPE_5000
  /** Generic parse error */
  PARSE_ERROR_GENERIC: 'SCOPE_5000',
  /** Invalid syntax in scope expression */
  SYNTAX_ERROR: 'SCOPE_5001',
  /** Unexpected token in expression */
  UNEXPECTED_TOKEN: 'SCOPE_5002',
  /** Unclosed brackets or quotes */
  UNCLOSED_DELIMITER: 'SCOPE_5003',
  /** Invalid operator usage */
  INVALID_OPERATOR: 'SCOPE_5004',
  /** Missing required expression components */
  MISSING_EXPRESSION_PART: 'SCOPE_5005',
  /** Invalid scope reference format */
  INVALID_SCOPE_REFERENCE: 'SCOPE_5006',

  // Configuration errors (6xxx) - Base: SCOPE_6000
  /** Generic configuration error */
  CONFIGURATION_GENERIC: 'SCOPE_6000',
  /** Invalid resolver configuration */
  INVALID_RESOLVER_CONFIG: 'SCOPE_6001',
  /** Missing required configuration */
  MISSING_CONFIG: 'SCOPE_6002',
  /** Configuration validation failed */
  CONFIG_VALIDATION_FAILED: 'SCOPE_6003',
  /** Invalid parser configuration */
  INVALID_PARSER_CONFIG: 'SCOPE_6004',
  /** Registry configuration error */
  REGISTRY_CONFIG_ERROR: 'SCOPE_6005',
  /** Engine configuration invalid */
  ENGINE_CONFIG_INVALID: 'SCOPE_6006',

  // Unknown/fallback errors (9xxx) - Base: SCOPE_9000, Fallback: SCOPE_9999
  /** Generic unknown error */
  UNKNOWN_GENERIC: 'SCOPE_9000',
  /** Unhandled exception */
  UNHANDLED_EXCEPTION: 'SCOPE_9001',
  /** Internal system error */
  INTERNAL_ERROR: 'SCOPE_9002',
  /** Unexpected state encountered */
  UNEXPECTED_STATE: 'SCOPE_9003',
  /** Operation not supported */
  OPERATION_NOT_SUPPORTED: 'SCOPE_9004',
  /** Fallback error code (from existing implementation) */
  UNKNOWN_ERROR: 'SCOPE_9999',
});
