/**
 * @file preValidationUtils.js
 * @description Pre-validation utilities that provide fail-fast, specific error messages
 * for common AJV validation issues, particularly for operation type validation.
 */

import OperationValidationError from '../errors/operationValidationError.js';
import {
  toSchemaFileName,
  toTokenName,
  toHandlerClassName,
} from './operationNamingUtils.js';

/**
 * CRITICAL: Pre-validation whitelist for operation types
 *
 * ⚠️ EVERY new operation MUST be added here before validation will pass
 *
 * When adding a new operation handler:
 * 1. Add operation type constant to this array
 * 2. Ensure it matches the "const" value in your schema exactly
 * 3. Run `npm run validate` or `npm run validate:strict` to verify consistency
 *
 * Common mistake: Forgetting this step causes "Unknown operation type" errors
 *
 * Related files:
 * - data/schemas/operations/[operationName].schema.json (type constant)
 * - src/dependencyInjection/registrations/interpreterRegistrations.js (registry mapping)
 *
 * @see CLAUDE.md "Adding New Operations - Complete Checklist" for complete checklist
 */
export const KNOWN_OPERATION_TYPES = [
  'ADD_COMPONENT',
  'ADD_PERCEPTION_LOG_ENTRY',
  'APPLY_DAMAGE',
  'ATOMIC_MODIFY_COMPONENT',
  'AUTO_MOVE_CLOSENESS_PARTNERS',
  'AUTO_MOVE_FOLLOWERS',
  'BREAK_BIDIRECTIONAL_CLOSENESS',
  'BREAK_CLOSENESS_WITH_TARGET',
  'BREAK_FOLLOW_RELATION',
  'BURN_ENERGY',
  'CHECK_FOLLOW_CYCLE',
  'CONSUME_ITEM',
  'DIGEST_FOOD',
  'DISPATCH_EVENT',
  'DISPATCH_PERCEPTIBLE_EVENT',
  'DISPATCH_SPEECH',
  'DISPATCH_THOUGHT',
  'DRINK_ENTIRELY',
  'DRINK_FROM',
  'DROP_ITEM_AT_LOCATION',
  'END_TURN',
  'ESTABLISH_BIDIRECTIONAL_CLOSENESS',
  'ESTABLISH_FOLLOW_RELATION',
  'ESTABLISH_LYING_CLOSENESS',
  'ESTABLISH_SITTING_CLOSENESS',
  'FOR_EACH',
  'GET_DAMAGE_CAPABILITIES',
  'GET_NAME',
  'GET_TIMESTAMP',
  'HAS_BODY_PART_WITH_COMPONENT_VALUE',
  'HAS_COMPONENT',
  'IF',
  'IF_CO_LOCATED',
  'LOCK_GRABBING',
  'LOCK_MOUTH_ENGAGEMENT',
  'LOCK_MOVEMENT',
  'LOG',
  'MATH',
  'MERGE_CLOSENESS_CIRCLE',
  'MODIFY_ARRAY_FIELD',
  'MODIFY_COMPONENT',
  'MODIFY_CONTEXT_ARRAY',
  'MODIFY_PART_HEALTH',
  'OPEN_CONTAINER',
  'PICK_RANDOM_ENTITY',
  'PICK_UP_ITEM_FROM_LOCATION',
  'PREPARE_ACTION_CONTEXT',
  'PUT_IN_CONTAINER',
  'QUERY_COMPONENT',
  'QUERY_COMPONENTS',
  'QUERY_ENTITIES',
  'QUERY_LOOKUP',
  'REBUILD_LEADER_LIST_CACHE',
  'REGENERATE_DESCRIPTION',
  'REMOVE_COMPONENT',
  'REMOVE_FROM_CLOSENESS_CIRCLE',
  'REMOVE_LYING_CLOSENESS',
  'REMOVE_SITTING_CLOSENESS',
  'RESOLVE_DIRECTION',
  'RESOLVE_HIT_LOCATION',
  'RESOLVE_OUTCOME',
  'SEQUENCE',
  'SET_VARIABLE',
  'SYSTEM_MOVE_ENTITY',
  'TAKE_FROM_CONTAINER',
  'TRANSFER_ITEM',
  'UNEQUIP_CLOTHING',
  'UNLOCK_GRABBING',
  'UNLOCK_MOUTH_ENGAGEMENT',
  'UNLOCK_MOVEMENT',
  'UNWIELD_ITEM',
  'UPDATE_HUNGER_STATE',
  'UPDATE_PART_HEALTH_STATE',
  'VALIDATE_CONTAINER_CAPACITY',
  'VALIDATE_INVENTORY_CAPACITY',
];

// ============================================================================
// Validation Infrastructure
// ============================================================================
//
// NOTE: Node.js-specific schema initialization functions (initializeParameterRules,
// getOperationParameterRules, _resetParameterRulesForTesting, isParameterRulesInitialized)
// have been moved to preValidationTestUtils.js to keep this module browser-compatible.
// Those functions require filesystem access and are only used in tests.
// ============================================================================

/**
 * Detailed operation validation result
 *
 * This is a browser-safe validation result that indicates what SHOULD exist
 * based on naming conventions, without performing filesystem checks.
 *
 * @typedef {object} ValidationResult
 * @property {boolean} isValid - Overall validation status (true if in whitelist)
 * @property {object} checks - Individual check results
 * @property {boolean} checks.inWhitelist - Type is in KNOWN_OPERATION_TYPES
 * @property {boolean} checks.expectedSchemaPath - Expected schema file path (informational)
 * @property {boolean} checks.expectedTokenName - Expected DI token name (informational)
 * @property {boolean} checks.expectedHandlerClass - Expected handler class name (informational)
 * @property {string[]} missingRegistrations - List of registration types that may be missing
 * @property {string} operationType - The operation type that was validated
 * @property {object} expectedPaths - Expected file paths and names (for error messages)
 * @property {string} expectedPaths.schemaFile - Expected schema file path
 * @property {string} expectedPaths.tokenName - Expected token name
 * @property {string} expectedPaths.handlerClass - Expected handler class name
 */

/**
 * Validates operation type and returns detailed results
 *
 * Browser-safe validation that checks the whitelist and provides detailed
 * information about expected registrations without filesystem access.
 *
 * Performs validation:
 * 1. Checks if type is in KNOWN_OPERATION_TYPES whitelist
 * 2. Calculates expected paths/names for all registration points
 * 3. Returns detailed results for error reporting
 *
 * Note: This function runs in both Node.js and browser contexts,
 * so it cannot perform file system checks. The result includes
 * expected paths/names based on naming conventions only.
 *
 * @param {string} operationType - The operation type to validate
 * @param {object} logger - Logger instance with debug, warn, error methods
 * @param {object} options - Validation options
 * @param {boolean} options.throwOnError - Throw error if validation fails (default: true)
 * @returns {ValidationResult} Detailed validation result
 * @throws {OperationValidationError} If validation fails and throwOnError is true
 */
export function validateOperationType(operationType, logger, options = {}) {
  const { throwOnError = true } = options;

  // Calculate expected paths and names (browser-safe, no filesystem access)
  const expectedPaths = {
    schemaFile: `data/schemas/operations/${toSchemaFileName(operationType)}`,
    tokenName: toTokenName(operationType),
    handlerClass: toHandlerClassName(operationType),
  };

  // Check whitelist (the only actual validation we can do browser-safe)
  const inWhitelist = KNOWN_OPERATION_TYPES.includes(operationType);

  // Build checks object (informational only, except for whitelist)
  const checks = {
    inWhitelist,
    expectedSchemaPath: expectedPaths.schemaFile,
    expectedTokenName: expectedPaths.tokenName,
    expectedHandlerClass: expectedPaths.handlerClass,
  };

  // Determine missing registrations
  const missingRegistrations = [];
  if (!inWhitelist) {
    // If not in whitelist, assume all registrations might be missing
    // (we can't verify without filesystem access)
    missingRegistrations.push('whitelist', 'schema', 'reference', 'token', 'handler', 'mapping');
  }

  // Build result
  const result = {
    isValid: inWhitelist,
    checks,
    missingRegistrations,
    operationType,
    expectedPaths,
  };

  // Log results
  if (result.isValid) {
    logger.debug('Operation type validation passed', {
      operationType,
      expectedPaths,
    });
  } else {
    logger.warn('Operation validation failed', {
      operationType,
      missingRegistrations,
      expectedPaths,
    });
  }

  // Throw error if requested and validation failed
  if (!result.isValid && throwOnError) {
    const error = new OperationValidationError(operationType, missingRegistrations);
    logger.error('Operation validation error', {
      operationType,
      errorMessage: error.message,
    });
    throw error;
  }

  return result;
}

/**
 * Result of pre-validation check
 *
 * @typedef {object} PreValidationResult
 * @property {boolean} isValid - Whether pre-validation passed
 * @property {string|null} error - Specific error message if validation failed
 * @property {string|null} path - Path to the problematic element
 * @property {string[]|null} suggestions - Suggested fixes or valid values
 */

/**
 * Common parameter validation rules for specific operation types
 */
const OPERATION_PARAMETER_RULES = {
  GET_NAME: {
    required: ['entity_ref', 'result_variable'],
    invalidFields: ['entity_id'], // Common mistake
    fieldCorrections: {
      entity_id: 'entity_ref'
    }
  },
  QUERY_COMPONENT: {
    required: ['entity_ref', 'component_type', 'result_variable'],
    invalidFields: ['entity_id'],
    fieldCorrections: {
      entity_id: 'entity_ref'
    }
  },
  ADD_COMPONENT: {
    required: ['entity_ref', 'component_type'],
    invalidFields: ['entity_id'],
    fieldCorrections: {
      entity_id: 'entity_ref'
    }
  },
  REMOVE_COMPONENT: {
    required: ['entity_ref', 'component_type'],
    invalidFields: ['entity_id'],
    fieldCorrections: {
      entity_id: 'entity_ref'
    }
  }
};

/**
 * Validates operation parameters for known operation types
 *
 * @param {string} operationType - The operation type
 * @param {any} parameters - The parameters object
 * @param {string} path - Current path for error reporting
 * @returns {PreValidationResult} Validation result
 */
function validateOperationParameters(operationType, parameters, path) {
  const rules = OPERATION_PARAMETER_RULES[operationType];
  if (!rules) {
    // No specific rules for this operation type
    return { isValid: true, error: null, path: null, suggestions: null };
  }

  if (!parameters || typeof parameters !== 'object') {
    return {
      isValid: false,
      error: `Operation type "${operationType}" requires a parameters object`,
      path,
      suggestions: [
        `Required parameters: ${rules.required.join(', ')}`
      ],
    };
  }

  // Check for invalid fields (common mistakes)
  if (rules.invalidFields) {
    for (const invalidField of rules.invalidFields) {
      if (invalidField in parameters) {
        const correction = rules.fieldCorrections?.[invalidField];
        return {
          isValid: false,
          error: `Invalid parameter "${invalidField}" in ${operationType} operation`,
          path: `${path}.parameters`,
          suggestions: [
            correction ? `Use "${correction}" instead of "${invalidField}"` : `Remove "${invalidField}"`,
            `${operationType} expects: ${rules.required.join(', ')}`,
            correction && parameters[invalidField]
              ? `Change to: "${correction}": "${parameters[invalidField]}"`
              : null
          ].filter(Boolean),
        };
      }
    }
  }

  return { isValid: true, error: null, path: null, suggestions: null };
}

/**
 * Validates the structure of a single operation object
 *
 * @param {any} operation - The operation object to validate
 * @param {string} path - Current path for error reporting
 * @returns {PreValidationResult} Validation result
 */
export function validateOperationStructure(operation, path = 'root') {
  // Check if operation is an object
  if (!operation || typeof operation !== 'object') {
    return {
      isValid: false,
      error: 'Operation must be an object',
      path,
      suggestions: [
        'Ensure the operation is a valid JSON object with type and parameters fields',
      ],
    };
  }

  // Check for macro reference (alternative valid structure)
  if (operation.macro && typeof operation.macro === 'string') {
    // This is a macro reference, which is valid but has different structure
    if (operation.type) {
      return {
        isValid: false,
        error: 'Macro reference should not have a type field',
        path,
        suggestions: [
          'Remove the type field when using macro reference',
          'Use either {"macro": "namespace:id"} OR {"type": "OPERATION_TYPE", "parameters": {...}}',
        ],
      };
    }
    return { isValid: true, error: null, path: null, suggestions: null };
  }

  // Check for missing type field
  if (!operation.type) {
    return {
      isValid: false,
      error: 'Missing required "type" field in operation',
      path,
      suggestions: [
        'Add a "type" field with one of the valid operation types',
        'Valid operation types include: ' +
          KNOWN_OPERATION_TYPES.slice(0, 5).join(', ') +
          '...',
        `If this is a macro reference, use {"macro": "namespace:id"} instead`,
      ],
    };
  }

  // Check for invalid type
  if (typeof operation.type !== 'string') {
    return {
      isValid: false,
      error: 'Operation "type" field must be a string',
      path,
      suggestions: [
        'Ensure the type field is a string value like "QUERY_COMPONENT"',
      ],
    };
  }

  // Check for unknown type (warning, not error)
  if (!KNOWN_OPERATION_TYPES.includes(operation.type)) {
    return {
      isValid: false,
      error: `Unknown operation type "${operation.type}"`,
      path,
      suggestions: [
        'Valid operation types include:',
        ...KNOWN_OPERATION_TYPES.slice(0, 10),
        KNOWN_OPERATION_TYPES.length > 10
          ? `... and ${KNOWN_OPERATION_TYPES.length - 10} more`
          : '',
      ].filter(Boolean),
    };
  }

  // Check for missing parameters (required for most operations)
  if (!operation.parameters && operation.type !== 'END_TURN') {
    return {
      isValid: false,
      error: `Missing "parameters" field for operation type "${operation.type}"`,
      path,
      suggestions: [
        'Add a "parameters" object with the required fields for this operation type',
      ],
    };
  }

  // Validate parameters for known operation types
  if (operation.parameters) {
    const paramResult = validateOperationParameters(operation.type, operation.parameters, path);
    if (!paramResult.isValid) {
      return paramResult;
    }
  }

  return { isValid: true, error: null, path: null, suggestions: null };
}

/**
 * Recursively validates all operations in a data structure
 *
 * @param {any} data - The data structure to scan (could be operation, array, or object)
 * @param {string} basePath - Base path for error reporting
 * @param {boolean} inOperationContext - Whether we're currently in a context where operations are expected
 * @returns {PreValidationResult} First validation error found, or success
 */
export function validateAllOperations(
  data,
  basePath = 'root',
  inOperationContext = false
) {
  if (!data) {
    return { isValid: true, error: null, path: null, suggestions: null };
  }

  // If we're in an operation context and this is an array, validate each element as an operation
  if (Array.isArray(data) && inOperationContext) {
    for (let i = 0; i < data.length; i++) {
      const result = validateOperationStructure(data[i], `${basePath}[${i}]`);
      if (!result.isValid) {
        // Enhanced error with operation index and snippet
        const enhancedError = {
          ...result,
          error: `Operation at index ${i} failed validation: ${result.error}`,
          path: `${basePath}[${i}]`,
          suggestions: [
            ...(result.suggestions || []),
            `Problematic operation: ${JSON.stringify(data[i], null, 2).substring(0, 200)}...`
          ]
        };
        return enhancedError;
      }

      // Skip recursive validation for macro references
      // Macro references are already fully validated by validateOperationStructure
      if (data[i].macro) {
        continue; // Macro references don't need internal structure validation
      }

      // Only recursively validate internal structure for operations, not macros
      // Also only check parameters field if it exists (not all operations have parameters)
      if (data[i].type && data[i].parameters) {
        const recursiveResult = validateAllOperations(
          data[i].parameters,
          `${basePath}[${i}].parameters`,
          false
        );
        if (!recursiveResult.isValid) {
          return recursiveResult;
        }
      }
    }
    return { isValid: true, error: null, path: null, suggestions: null };
  }

  // If this is an object, check for operation fields and other properties
  if (typeof data === 'object' && !Array.isArray(data)) {
    // Check common fields that contain operations
    const operationFields = ['actions', 'then_actions', 'else_actions'];

    for (const field of operationFields) {
      if (data[field]) {
        // These fields contain arrays of operations
        const result = validateAllOperations(
          data[field],
          `${basePath}.${field}`,
          true
        );
        if (!result.isValid) {
          return result;
        }
      }
    }

    // For other object properties, recurse but NOT in operation context
    for (const [key, value] of Object.entries(data)) {
      if (
        !operationFields.includes(key) &&
        key !== 'type' &&
        key !== 'parameters' &&
        key !== 'macro'
      ) {
        const result = validateAllOperations(
          value,
          `${basePath}.${key}`,
          false
        );
        if (!result.isValid) {
          return result;
        }
      }
    }
  }

  return { isValid: true, error: null, path: null, suggestions: null };
}

/**
 * Validates rule-specific structure
 *
 * @param {any} ruleData - The rule data to validate
 * @param {string} _filePath - File path for error context (unused but kept for API compatibility)
 * @returns {PreValidationResult} Validation result
 */
export function validateRuleStructure(ruleData, _filePath = 'unknown') {
  if (!ruleData || typeof ruleData !== 'object') {
    return {
      isValid: false,
      error: 'Rule data must be an object',
      path: 'root',
      suggestions: ['Ensure the rule file contains a valid JSON object'],
    };
  }

  // Check for required rule fields
  if (!ruleData.event_type) {
    return {
      isValid: false,
      error: 'Missing required "event_type" field in rule',
      path: 'root',
      suggestions: [
        'Add an "event_type" field with a namespaced event ID like "core:entity_thought"',
      ],
    };
  }

  if (!ruleData.actions) {
    return {
      isValid: false,
      error: 'Missing required "actions" field in rule',
      path: 'root',
      suggestions: ['Add an "actions" array with at least one operation'],
    };
  }

  if (!Array.isArray(ruleData.actions)) {
    return {
      isValid: false,
      error: 'Rule "actions" field must be an array',
      path: 'actions',
      suggestions: ['Change the actions field to an array of operations'],
    };
  }

  if (ruleData.actions.length === 0) {
    return {
      isValid: false,
      error: 'Rule "actions" array cannot be empty',
      path: 'actions',
      suggestions: ['Add at least one operation to the actions array'],
    };
  }

  // Validate all operations in the rule
  return validateAllOperations(ruleData, 'root');
}


/**
 * Validates macro-specific structure
 *
 * @param {any} macroData - The macro data to validate
 * @param {string} _filePath - File path for error context (unused but kept for API compatibility)
 * @returns {PreValidationResult} Validation result
 */
export function validateMacroStructure(macroData, _filePath = 'unknown') {
  if (!macroData || typeof macroData !== 'object') {
    return {
      isValid: false,
      error: 'Macro data must be an object',
      path: 'root',
      suggestions: ['Ensure the macro file contains a valid JSON object'],
    };
  }

  // Check for required macro fields
  if (!macroData.id) {
    return {
      isValid: false,
      error: 'Missing required "id" field in macro',
      path: 'root',
      suggestions: [
        'Add an "id" field with a namespaced identifier like "modId:macroName"',
      ],
    };
  }

  if (!macroData.description) {
    return {
      isValid: false,
      error: 'Missing required "description" field in macro',
      path: 'root',
      suggestions: ['Add a "description" field explaining what the macro does'],
    };
  }

  if (!macroData.actions) {
    return {
      isValid: false,
      error: 'Missing required "actions" field in macro',
      path: 'root',
      suggestions: ['Add an "actions" array with at least one operation'],
    };
  }

  if (!Array.isArray(macroData.actions)) {
    return {
      isValid: false,
      error: 'Macro "actions" field must be an array',
      path: 'actions',
      suggestions: ['Change the actions field to an array of operations'],
    };
  }

  if (macroData.actions.length === 0) {
    return {
      isValid: false,
      error: 'Macro "actions" array cannot be empty',
      path: 'actions',
      suggestions: ['Add at least one operation to the actions array'],
    };
  }

  // Validate all operations in the macro
  return validateAllOperations(macroData, 'root');
}

/**
 * Performs comprehensive pre-validation based on expected schema type
 *
 * @param {any} data - Data to validate
 * @param {string} schemaId - Schema ID being validated against
 * @param {string} filePath - File path for error context
 * @returns {PreValidationResult} Validation result
 */
export function performPreValidation(data, schemaId, filePath = 'unknown') {
  // Check for rule-specific validation
  if (schemaId === 'schema://living-narrative-engine/rule.schema.json') {
    return validateRuleStructure(data, filePath);
  }

  // Check for macro-specific validation (fail-fast before AJV circular ref issues)
  if (schemaId === 'schema://living-narrative-engine/macro.schema.json') {
    return validateMacroStructure(data, filePath);
  }

  // For other schemas, skip pre-validation to avoid conflicts
  return { isValid: true, error: null, path: null, suggestions: null };
}

/**
 * Generates a user-friendly error message from pre-validation result
 *
 * @param {PreValidationResult} result - Pre-validation result
 * @param {string} fileName - File name for context
 * @param {string} _schemaId - Schema ID for context (unused but kept for API compatibility)
 * @returns {string} Formatted error message
 */
export function formatPreValidationError(result, fileName, _schemaId) {
  if (result.isValid) {
    return 'No pre-validation errors';
  }

  const lines = [
    `Pre-validation failed for '${fileName}':`,
    `  Location: ${result.path}`,
    `  Error: ${result.error}`,
  ];

  if (result.suggestions && result.suggestions.length > 0) {
    lines.push('  Suggestions:');
    result.suggestions.forEach((suggestion) => {
      lines.push(`    - ${suggestion}`);
    });
  }

  return lines.join('\n');
}

// Re-export naming utilities for backward compatibility
// (These are now defined in operationNamingUtils.js to break circular dependency)
export { toSchemaFileName, toTokenName, toHandlerClassName };
