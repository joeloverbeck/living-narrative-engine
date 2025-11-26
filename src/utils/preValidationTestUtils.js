/**
 * @file preValidationTestUtils.js
 * @description Node.js-specific test utilities for pre-validation.
 * These functions require filesystem access and should only be used in tests (Node.js environment).
 * This module is NOT bundled for browser builds.
 * @see preValidationUtils.js for browser-safe validation functions
 */

import {
  generateParameterRules,
  validateCoverage,
} from './parameterRuleGenerator.js';
import { KNOWN_OPERATION_TYPES } from './preValidationUtils.js';

// ============================================================================
// Schema-Derived Parameter Rules (Lazy Initialization)
// ============================================================================

/** @type {object|null} Auto-generated rules from schemas, initialized lazily */
let _schemaGeneratedRules = null;

/** @type {boolean} Whether schema-derived rules have been initialized */
let _rulesInitialized = false;

/**
 * Manual parameter rules for typo detection
 *
 * @private
 */
const OPERATION_PARAMETER_RULES = {
  GET_NAME: {
    required: ['entity_ref', 'result_variable'],
    invalidFields: ['entity_id'],
    fieldCorrections: {
      entity_id: 'entity_ref',
    },
  },
  QUERY_COMPONENT: {
    required: ['entity_ref', 'component_type', 'result_variable'],
    invalidFields: ['entity_id'],
    fieldCorrections: {
      entity_id: 'entity_ref',
    },
  },
  ADD_COMPONENT: {
    required: ['entity_ref', 'component_type'],
    invalidFields: ['entity_id'],
    fieldCorrections: {
      entity_id: 'entity_ref',
    },
  },
  REMOVE_COMPONENT: {
    required: ['entity_ref', 'component_type'],
    invalidFields: ['entity_id'],
    fieldCorrections: {
      entity_id: 'entity_ref',
    },
  },
};

/**
 * Gets the combined operation parameter rules (schema + manual)
 *
 * @returns {object} Map of operation type to parameter rules
 * @throws {Error} If rules have not been initialized via initializeParameterRules()
 */
export function getOperationParameterRules() {
  if (!_rulesInitialized) {
    throw new Error(
      'Operation parameter rules not initialized. ' +
        'Call initializeParameterRules() during startup.'
    );
  }
  return _schemaGeneratedRules;
}

/**
 * Initializes operation parameter rules from schemas
 *
 * Should be called during application startup before any validation that
 * requires schema-derived parameter rules. If not called, the existing
 * manual OPERATION_PARAMETER_RULES continue to function.
 *
 * NOTE: This function requires Node.js filesystem access (fs/promises, path)
 * and should only be used in Node.js environments (tests, scripts).
 *
 * @param {object} [options] - Initialization options
 * @param {boolean} [options.assertCoverage] - Assert all known types have rules (default: true)
 * @returns {Promise<void>}
 * @throws {Error} If assertCoverage is true and coverage is incomplete (INV-3)
 */
export async function initializeParameterRules(options = {}) {
  const { assertCoverage = true } = options;

  if (_rulesInitialized) {
    return; // Already initialized
  }

  const schemaRules = await generateParameterRules();

  // Merge schema-derived rules with manual typo-detection rules
  // Manual rules take precedence for invalidFields/fieldCorrections
  _schemaGeneratedRules = {};
  for (const [type, rule] of Object.entries(schemaRules)) {
    const manualRule = OPERATION_PARAMETER_RULES[type];
    _schemaGeneratedRules[type] = {
      ...rule,
      // Preserve manual typo-detection features if they exist
      invalidFields: manualRule?.invalidFields || [],
      fieldCorrections: manualRule?.fieldCorrections || {},
    };
  }

  _rulesInitialized = true;

  if (assertCoverage) {
    const { missing, extra } = validateCoverage(
      _schemaGeneratedRules,
      KNOWN_OPERATION_TYPES
    );

    if (missing.length > 0) {
      throw new Error(
        `INV-3 Violation: Missing parameter rules for operation types: ${missing.join(', ')}. ` +
          `Ensure all operations have schemas in data/schemas/operations/`
      );
    }

    if (extra.length > 0) {
      // eslint-disable-next-line no-console -- Intentional warning for schema drift detection
      console.warn(
        `Warning: Found parameter rules for types not in KNOWN_OPERATION_TYPES: ${extra.join(', ')}. ` +
          `Consider adding to KNOWN_OPERATION_TYPES if these are valid operations.`
      );
    }
  }
}

/**
 * Resets initialization state (for testing only)
 *
 * @internal
 */
export function _resetParameterRulesForTesting() {
  _schemaGeneratedRules = null;
  _rulesInitialized = false;
}

/**
 * Checks if parameter rules have been initialized
 *
 * @returns {boolean} True if initializeParameterRules() has been called
 */
export function isParameterRulesInitialized() {
  return _rulesInitialized;
}
