# Ticket 05: Update Common Schema References

## Overview

Update common schema definitions and references to ensure consistency across the multi-target action system. This includes updating shared schema definitions, type references, and validation utilities to support the enhanced event structure while maintaining backward compatibility.

## Dependencies

- Ticket 01: Update Event Schema (must be completed)
- Ticket 02: Create Schema Validation Tests (must be completed)
- Ticket 03: Add Multi-Target Validation Rules (must be completed)

## Blocks

- Ticket 06: Create Multi-Target Data Structures
- Ticket 07: Implement Multi-Target Data Extraction

## Priority: Medium

## Estimated Time: 4-6 hours

## Background

The enhanced `attempt_action.event.json` schema introduces new data structures that need to be referenced and validated consistently throughout the system. This includes updating common schema definitions, JSDoc types, and utility functions to support multi-target structures.

## Implementation Details

### 1. Update Common Schema Definitions

**File**: `data/schemas/common.schema.json`

Update the common schema file to include multi-target event structures:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "id": "schema://living-narrative-engine/common.schema.json",
  "title": "Living Narrative Engine Common Schema Definitions",
  "definitions": {
    "namespacedId": {
      "type": "string",
      "pattern": "^[a-zA-Z][a-zA-Z0-9_]*:[a-zA-Z][a-zA-Z0-9_]*$|^[a-zA-Z][a-zA-Z0-9_]*$",
      "description": "Namespaced identifier in format 'namespace:id' or simple 'id'",
      "examples": ["core:actor", "combat:throw", "simple_id"]
    },
    "entityId": {
      "type": "string",
      "pattern": "^[a-zA-Z0-9_:]+$",
      "minLength": 1,
      "description": "Entity identifier allowing letters, numbers, underscores, and colons",
      "examples": ["actor_123", "core:player", "item_456"]
    },
    "targetName": {
      "type": "string",
      "pattern": "^[a-zA-Z][a-zA-Z0-9_]*$",
      "description": "Target name for multi-target actions (alphanumeric with underscores)",
      "examples": [
        "primary",
        "secondary",
        "item",
        "recipient",
        "target",
        "tool"
      ]
    },
    "targetsObject": {
      "type": "object",
      "description": "Multi-target structure with named targets",
      "patternProperties": {
        "^[a-zA-Z][a-zA-Z0-9_]*$": {
          "$ref": "#/definitions/entityId"
        }
      },
      "additionalProperties": false,
      "minProperties": 1,
      "examples": [
        {
          "primary": "entity_123",
          "secondary": "entity_456"
        },
        {
          "item": "knife_789",
          "target": "goblin_012"
        },
        {
          "person": "alice_456",
          "clothing": "dress_789"
        }
      ]
    },
    "eventPayloadBase": {
      "type": "object",
      "description": "Base structure for all event payloads",
      "properties": {
        "eventName": {
          "type": "string",
          "description": "Event identifier"
        },
        "timestamp": {
          "type": "number",
          "minimum": 0,
          "description": "Event creation timestamp"
        }
      },
      "required": ["eventName"],
      "additionalProperties": true
    },
    "attemptActionPayload": {
      "allOf": [
        { "$ref": "#/definitions/eventPayloadBase" },
        {
          "type": "object",
          "properties": {
            "eventName": {
              "const": "core:attempt_action"
            },
            "actorId": {
              "$ref": "#/definitions/entityId",
              "description": "ID of the entity performing the action"
            },
            "actionId": {
              "$ref": "#/definitions/namespacedId",
              "description": "ID of the action being performed"
            },
            "targets": {
              "$ref": "#/definitions/targetsObject",
              "description": "Multi-target structure (optional for backward compatibility)"
            },
            "targetId": {
              "anyOf": [
                { "$ref": "#/definitions/entityId" },
                { "type": "null" }
              ],
              "description": "Primary target for backward compatibility"
            },
            "originalInput": {
              "type": "string",
              "minLength": 1,
              "description": "Original command text entered by user"
            }
          },
          "required": ["eventName", "actorId", "actionId", "originalInput"],
          "anyOf": [{ "required": ["targets"] }, { "required": ["targetId"] }]
        }
      ]
    },
    "validationResult": {
      "type": "object",
      "description": "Standard validation result structure",
      "properties": {
        "isValid": {
          "type": "boolean",
          "description": "Whether validation passed"
        },
        "errors": {
          "type": "array",
          "items": { "type": "string" },
          "description": "Array of error messages"
        },
        "warnings": {
          "type": "array",
          "items": { "type": "string" },
          "description": "Array of warning messages"
        },
        "details": {
          "type": "object",
          "description": "Additional validation details",
          "additionalProperties": true
        }
      },
      "required": ["isValid", "errors", "warnings"],
      "additionalProperties": false
    },
    "multiTargetValidationDetails": {
      "type": "object",
      "description": "Detailed validation information for multi-target events",
      "properties": {
        "hasMultipleTargets": {
          "type": "boolean",
          "description": "Whether event has multiple targets"
        },
        "targetCount": {
          "type": "integer",
          "minimum": 0,
          "description": "Number of targets in the event"
        },
        "primaryTarget": {
          "anyOf": [{ "$ref": "#/definitions/entityId" }, { "type": "null" }],
          "description": "Determined primary target"
        },
        "consistencyIssues": {
          "type": "array",
          "items": {
            "type": "string",
            "enum": [
              "targetId_mismatch",
              "primary_target_mismatch",
              "duplicate_targets"
            ]
          },
          "description": "Array of consistency issue types"
        }
      },
      "required": [
        "hasMultipleTargets",
        "targetCount",
        "primaryTarget",
        "consistencyIssues"
      ],
      "additionalProperties": false
    }
  }
}
```

### 2. Update Type Definitions

**File**: `src/types/multiTargetTypes.js`

Create comprehensive type definitions for multi-target structures:

```javascript
/**
 * @file Type definitions for multi-target action system
 */

/**
 * @typedef {string} EntityId
 * Entity identifier allowing letters, numbers, underscores, and colons
 * @example "actor_123" | "core:player" | "item_456"
 */

/**
 * @typedef {string} NamespacedId
 * Namespaced identifier in format 'namespace:id' or simple 'id'
 * @example "core:actor" | "combat:throw" | "simple_id"
 */

/**
 * @typedef {string} TargetName
 * Target name for multi-target actions (alphanumeric with underscores)
 * @example "primary" | "secondary" | "item" | "recipient" | "target" | "tool"
 */

/**
 * @typedef {Object.<TargetName, EntityId>} TargetsObject
 * Multi-target structure with named targets
 * @example
 * {
 *   "primary": "entity_123",
 *   "secondary": "entity_456"
 * }
 * @example
 * {
 *   "item": "knife_789",
 *   "target": "goblin_012"
 * }
 */

/**
 * @typedef {Object} AttemptActionPayload
 * Enhanced attempt action event payload with multi-target support
 * @property {string} eventName - Must be "core:attempt_action"
 * @property {EntityId} actorId - ID of the entity performing the action
 * @property {NamespacedId} actionId - ID of the action being performed
 * @property {TargetsObject} [targets] - Multi-target structure (optional)
 * @property {EntityId|null} [targetId] - Primary target for backward compatibility
 * @property {string} originalInput - Original command text entered by user
 * @property {number} [timestamp] - Event creation timestamp
 */

/**
 * @typedef {Object} ValidationResult
 * Standard validation result structure
 * @property {boolean} isValid - Whether validation passed
 * @property {string[]} errors - Array of error messages
 * @property {string[]} warnings - Array of warning messages
 * @property {Object} [details] - Additional validation details
 */

/**
 * @typedef {Object} MultiTargetValidationDetails
 * Detailed validation information for multi-target events
 * @property {boolean} hasMultipleTargets - Whether event has multiple targets
 * @property {number} targetCount - Number of targets in the event
 * @property {EntityId|null} primaryTarget - Determined primary target
 * @property {string[]} consistencyIssues - Array of consistency issue types
 */

/**
 * @typedef {ValidationResult & {details: MultiTargetValidationDetails}} MultiTargetValidationResult
 * Validation result with multi-target specific details
 */

/**
 * @typedef {Object} TargetExtractionResult
 * Result of extracting target data from resolved parameters
 * @property {boolean} hasMultipleTargets - Whether multiple targets were found
 * @property {TargetsObject} targets - Extracted targets object
 * @property {EntityId|null} primaryTarget - Determined primary target
 */

/**
 * @typedef {Object} ResolvedParameters
 * Parameters resolved from action formatting stage
 * @property {boolean} [isMultiTarget] - Whether this is a multi-target action
 * @property {Object.<string, EntityId[]>} [targetIds] - Multi-target data from formatting
 * @property {EntityId} [targetId] - Legacy single target
 * @property {Object} [additionalParameters] - Other resolved parameters
 */

/**
 * @typedef {Object} TurnAction
 * Action data from the action discovery pipeline
 * @property {NamespacedId} actionDefinitionId - ID of the action definition
 * @property {ResolvedParameters} resolvedParameters - Resolved parameters
 * @property {string} commandString - Original command string
 * @property {Object} [additionalData] - Other action data
 */

/**
 * @typedef {Object} ActionFormattingResult
 * Result from action formatting stage
 * @property {string[]} formattedActions - Formatted action strings
 * @property {TargetsObject} [targetIds] - Multi-target data
 * @property {boolean} [isMultiTarget] - Multi-target flag
 */

export // Type definitions are exported via JSDoc comments above
// This allows them to be imported in other files using:
// /** @typedef {import('./multiTargetTypes.js').AttemptActionPayload} AttemptActionPayload */
 {};
```

### 3. Update Validation Utilities

**File**: `src/utils/multiTargetValidationUtils.js`

Create utility functions for multi-target validation:

```javascript
/**
 * @file Validation utilities for multi-target actions
 */

import { assertPresent, assertNonBlankString } from './validationUtils.js';

/**
 * Validates a targets object structure
 * @param {Object} targets - Targets object to validate
 * @param {string} [context='targets'] - Context for error messages
 * @returns {Object} Validation result
 */
export function validateTargetsObject(targets, context = 'targets') {
  const errors = [];
  const warnings = [];

  // Basic structure validation
  if (targets === null || targets === undefined) {
    errors.push(`${context} cannot be null or undefined`);
    return { isValid: false, errors, warnings };
  }

  if (typeof targets !== 'object' || Array.isArray(targets)) {
    errors.push(`${context} must be an object`);
    return { isValid: false, errors, warnings };
  }

  const targetKeys = Object.keys(targets);

  // Check for empty object
  if (targetKeys.length === 0) {
    errors.push(`${context} object cannot be empty`);
    return { isValid: false, errors, warnings };
  }

  // Validate each target
  for (const [key, targetId] of Object.entries(targets)) {
    // Validate target key format
    if (!isValidTargetName(key)) {
      warnings.push(
        `${context} key "${key}" should follow naming conventions (alphanumeric with underscores)`
      );
    }

    // Validate target ID
    if (!targetId || typeof targetId !== 'string' || !targetId.trim()) {
      errors.push(`${context}["${key}"] must be a non-empty string`);
      continue;
    }

    if (!isValidEntityId(targetId)) {
      warnings.push(
        `${context}["${key}"] ID "${targetId}" should follow entity ID format`
      );
    }
  }

  // Check for duplicate target IDs
  const targetValues = Object.values(targets);
  const uniqueTargets = new Set(targetValues);
  if (uniqueTargets.size !== targetValues.length) {
    warnings.push(`${context} object contains duplicate target IDs`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates an attempt action payload structure
 * @param {Object} payload - Payload to validate
 * @returns {Object} Validation result with details
 */
export function validateAttemptActionPayload(payload) {
  const errors = [];
  const warnings = [];
  const details = {
    hasMultipleTargets: false,
    targetCount: 0,
    primaryTarget: null,
    consistencyIssues: [],
  };

  try {
    assertPresent(payload, 'Event payload is required');

    // Validate required fields
    validateRequiredFields(payload, errors);

    // Validate target requirements
    validateTargetRequirements(payload, errors, details);

    // Validate targets object if present
    if (payload.targets) {
      const targetsValidation = validateTargetsObject(
        payload.targets,
        'payload.targets'
      );
      errors.push(...targetsValidation.errors);
      warnings.push(...targetsValidation.warnings);

      if (targetsValidation.isValid) {
        details.targetCount = Object.keys(payload.targets).length;
        details.hasMultipleTargets = details.targetCount > 1;
        details.primaryTarget = determinePrimaryTarget(payload.targets);
      }
    }

    // Validate consistency between targets and targetId
    validateTargetConsistency(payload, warnings, details);
  } catch (error) {
    errors.push(`Validation error: ${error.message}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    details,
  };
}

/**
 * Validates required fields in attempt action payload
 * @param {Object} payload - Payload to validate
 * @param {string[]} errors - Error collection
 */
function validateRequiredFields(payload, errors) {
  const requiredFields = [
    { field: 'eventName', expectedValue: 'core:attempt_action' },
    { field: 'actorId', type: 'string' },
    { field: 'actionId', type: 'string' },
    { field: 'originalInput', type: 'string' },
  ];

  for (const { field, expectedValue, type } of requiredFields) {
    if (!payload[field]) {
      errors.push(`Missing required field: ${field}`);
      continue;
    }

    if (expectedValue && payload[field] !== expectedValue) {
      errors.push(`${field} must be "${expectedValue}"`);
      continue;
    }

    if (type && typeof payload[field] !== type) {
      errors.push(`${field} must be a ${type}`);
      continue;
    }

    if (type === 'string' && !payload[field].trim()) {
      errors.push(`${field} cannot be empty`);
    }
  }
}

/**
 * Validates target requirements (must have either targets or targetId)
 * @param {Object} payload - Payload to validate
 * @param {string[]} errors - Error collection
 * @param {Object} details - Validation details
 */
function validateTargetRequirements(payload, errors, details) {
  const hasTargets = payload.targets && Object.keys(payload.targets).length > 0;
  const hasTargetId =
    payload.targetId !== undefined && payload.targetId !== null;

  if (!hasTargets && !hasTargetId) {
    errors.push('Event must have either targets object or targetId field');
    return;
  }

  // If using targets object, must also have targetId for backward compatibility
  if (hasTargets && !hasTargetId) {
    errors.push(
      'targetId is required for backward compatibility when targets object is present'
    );
  }

  // Validate targetId type if present
  if (hasTargetId && typeof payload.targetId !== 'string') {
    errors.push('targetId must be a string when present');
  }
}

/**
 * Validates consistency between targets object and targetId
 * @param {Object} payload - Payload to validate
 * @param {string[]} warnings - Warning collection
 * @param {Object} details - Validation details
 */
function validateTargetConsistency(payload, warnings, details) {
  if (!payload.targets || !payload.targetId) {
    return;
  }

  const targetValues = Object.values(payload.targets);

  // Check if targetId matches any target in targets object
  if (!targetValues.includes(payload.targetId)) {
    warnings.push(
      `targetId "${payload.targetId}" does not match any target in targets object`
    );
    details.consistencyIssues.push('targetId_mismatch');
  }

  // Check if targetId matches expected primary target
  if (details.primaryTarget && payload.targetId !== details.primaryTarget) {
    warnings.push(
      `targetId "${payload.targetId}" does not match expected primary target "${details.primaryTarget}"`
    );
    details.consistencyIssues.push('primary_target_mismatch');
  }
}

/**
 * Determines the primary target from a targets object
 * @param {Object} targets - Targets object
 * @returns {string|null} Primary target ID
 */
export function determinePrimaryTarget(targets) {
  if (!targets || typeof targets !== 'object') {
    return null;
  }

  // Prefer explicit 'primary' key
  if (targets.primary) {
    return targets.primary;
  }

  // Common primary target key patterns (in order of preference)
  const primaryPatterns = ['target', 'recipient', 'item', 'person', 'tool'];
  for (const pattern of primaryPatterns) {
    if (targets[pattern]) {
      return targets[pattern];
    }
  }

  // Fallback to first target
  const firstKey = Object.keys(targets)[0];
  return firstKey ? targets[firstKey] : null;
}

/**
 * Validates target name format
 * @param {string} targetName - Target name to validate
 * @returns {boolean} True if valid
 */
export function isValidTargetName(targetName) {
  if (typeof targetName !== 'string') {
    return false;
  }

  // Allow alphanumeric characters and underscores, must start with letter
  return /^[a-zA-Z][a-zA-Z0-9_]*$/.test(targetName);
}

/**
 * Validates entity ID format
 * @param {string} entityId - Entity ID to validate
 * @returns {boolean} True if valid
 */
export function isValidEntityId(entityId) {
  if (typeof entityId !== 'string' || !entityId.trim()) {
    return false;
  }

  // Allow letters, numbers, underscores, and colons (for namespaced IDs)
  return /^[a-zA-Z0-9_:]+$/.test(entityId);
}

/**
 * Validates namespaced ID format
 * @param {string} namespacedId - Namespaced ID to validate
 * @returns {boolean} True if valid
 */
export function isValidNamespacedId(namespacedId) {
  if (typeof namespacedId !== 'string' || !namespacedId.trim()) {
    return false;
  }

  // Allow 'namespace:id' format or simple 'id'
  return /^[a-zA-Z][a-zA-Z0-9_]*:[a-zA-Z][a-zA-Z0-9_]*$|^[a-zA-Z][a-zA-Z0-9_]*$/.test(
    namespacedId
  );
}

/**
 * Creates a standardized validation result object
 * @param {boolean} isValid - Whether validation passed
 * @param {string[]} errors - Error messages
 * @param {string[]} warnings - Warning messages
 * @param {Object} details - Additional details
 * @returns {Object} Standardized validation result
 */
export function createValidationResult(
  isValid,
  errors = [],
  warnings = [],
  details = {}
) {
  return {
    isValid,
    errors: [...errors],
    warnings: [...warnings],
    details: { ...details },
  };
}

/**
 * Merges multiple validation results
 * @param {...Object} results - Validation results to merge
 * @returns {Object} Merged validation result
 */
export function mergeValidationResults(...results) {
  const merged = {
    isValid: true,
    errors: [],
    warnings: [],
    details: {},
  };

  for (const result of results) {
    if (!result.isValid) {
      merged.isValid = false;
    }

    merged.errors.push(...(result.errors || []));
    merged.warnings.push(...(result.warnings || []));
    Object.assign(merged.details, result.details || {});
  }

  return merged;
}
```

### 4. Create Utility Tests

**File**: `tests/unit/utils/multiTargetValidationUtils.test.js`

```javascript
/**
 * @file Tests for multi-target validation utilities
 */

import { describe, it, expect } from '@jest/globals';
import {
  validateTargetsObject,
  validateAttemptActionPayload,
  determinePrimaryTarget,
  isValidTargetName,
  isValidEntityId,
  isValidNamespacedId,
  createValidationResult,
  mergeValidationResults,
} from '../../../src/utils/multiTargetValidationUtils.js';

describe('MultiTargetValidationUtils', () => {
  describe('validateTargetsObject', () => {
    it('should validate correct targets object', () => {
      const targets = {
        item: 'knife_123',
        target: 'goblin_456',
      };

      const result = validateTargetsObject(targets);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject null targets', () => {
      const result = validateTargetsObject(null);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('targets cannot be null or undefined');
    });

    it('should reject empty targets object', () => {
      const result = validateTargetsObject({});

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('targets object cannot be empty');
    });

    it('should warn about invalid target names', () => {
      const targets = {
        'invalid-name': 'entity_123',
        '123invalid': 'entity_456',
      };

      const result = validateTargetsObject(targets);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain(
        'targets key "invalid-name" should follow naming conventions (alphanumeric with underscores)'
      );
      expect(result.warnings).toContain(
        'targets key "123invalid" should follow naming conventions (alphanumeric with underscores)'
      );
    });

    it('should reject empty target values', () => {
      const targets = {
        item: '',
        target: 'valid_target',
      };

      const result = validateTargetsObject(targets);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'targets["item"] must be a non-empty string'
      );
    });

    it('should warn about duplicate targets', () => {
      const targets = {
        item: 'same_entity',
        target: 'same_entity',
      };

      const result = validateTargetsObject(targets);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain(
        'targets object contains duplicate target IDs'
      );
    });
  });

  describe('validateAttemptActionPayload', () => {
    it('should validate correct legacy payload', () => {
      const payload = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'core:follow',
        targetId: 'target_456',
        originalInput: 'follow Alice',
      };

      const result = validateAttemptActionPayload(payload);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.details.hasMultipleTargets).toBe(false);
    });

    it('should validate correct multi-target payload', () => {
      const payload = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'combat:throw',
        targets: {
          item: 'knife_123',
          target: 'goblin_456',
        },
        targetId: 'knife_123',
        originalInput: 'throw knife at goblin',
      };

      const result = validateAttemptActionPayload(payload);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.details.hasMultipleTargets).toBe(true);
      expect(result.details.targetCount).toBe(2);
      expect(result.details.primaryTarget).toBe('knife_123');
    });

    it('should reject payload with missing required fields', () => {
      const payload = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        // Missing actionId and originalInput
      };

      const result = validateAttemptActionPayload(payload);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing required field: actionId');
      expect(result.errors).toContain('Missing required field: originalInput');
    });

    it('should reject payload with neither targets nor targetId', () => {
      const payload = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'core:action',
        originalInput: 'some action',
      };

      const result = validateAttemptActionPayload(payload);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Event must have either targets object or targetId field'
      );
    });
  });

  describe('determinePrimaryTarget', () => {
    it('should prefer explicit primary key', () => {
      const targets = {
        primary: 'primary_target',
        secondary: 'secondary_target',
      };

      const result = determinePrimaryTarget(targets);

      expect(result).toBe('primary_target');
    });

    it('should fallback to common patterns', () => {
      const targets = {
        item: 'item_target',
        recipient: 'recipient_target',
      };

      const result = determinePrimaryTarget(targets);

      expect(result).toBe('recipient_target'); // recipient comes before item in patterns
    });

    it('should fallback to first target', () => {
      const targets = {
        custom1: 'custom_target_1',
        custom2: 'custom_target_2',
      };

      const result = determinePrimaryTarget(targets);

      expect(result).toBe('custom_target_1');
    });

    it('should return null for invalid input', () => {
      expect(determinePrimaryTarget(null)).toBe(null);
      expect(determinePrimaryTarget({})).toBe(null);
      expect(determinePrimaryTarget('not_object')).toBe(null);
    });
  });

  describe('Format Validation Functions', () => {
    describe('isValidTargetName', () => {
      it('should validate correct target names', () => {
        expect(isValidTargetName('primary')).toBe(true);
        expect(isValidTargetName('item_1')).toBe(true);
        expect(isValidTargetName('targetABC')).toBe(true);
      });

      it('should reject invalid target names', () => {
        expect(isValidTargetName('123invalid')).toBe(false);
        expect(isValidTargetName('invalid-name')).toBe(false);
        expect(isValidTargetName('invalid.name')).toBe(false);
        expect(isValidTargetName('')).toBe(false);
        expect(isValidTargetName(123)).toBe(false);
      });
    });

    describe('isValidEntityId', () => {
      it('should validate correct entity IDs', () => {
        expect(isValidEntityId('entity_123')).toBe(true);
        expect(isValidEntityId('core:player')).toBe(true);
        expect(isValidEntityId('ABC123')).toBe(true);
      });

      it('should reject invalid entity IDs', () => {
        expect(isValidEntityId('')).toBe(false);
        expect(isValidEntityId('invalid-id')).toBe(false);
        expect(isValidEntityId('invalid.id')).toBe(false);
        expect(isValidEntityId(123)).toBe(false);
      });
    });

    describe('isValidNamespacedId', () => {
      it('should validate correct namespaced IDs', () => {
        expect(isValidNamespacedId('core:action')).toBe(true);
        expect(isValidNamespacedId('combat:throw')).toBe(true);
        expect(isValidNamespacedId('simple_id')).toBe(true);
      });

      it('should reject invalid namespaced IDs', () => {
        expect(isValidNamespacedId('123:invalid')).toBe(false);
        expect(isValidNamespacedId('invalid-namespace:action')).toBe(false);
        expect(isValidNamespacedId(':action')).toBe(false);
        expect(isValidNamespacedId('namespace:')).toBe(false);
        expect(isValidNamespacedId('')).toBe(false);
      });
    });
  });

  describe('Utility Functions', () => {
    describe('createValidationResult', () => {
      it('should create standardized validation result', () => {
        const result = createValidationResult(
          false,
          ['error1', 'error2'],
          ['warning1'],
          { custom: 'data' }
        );

        expect(result).toEqual({
          isValid: false,
          errors: ['error1', 'error2'],
          warnings: ['warning1'],
          details: { custom: 'data' },
        });
      });

      it('should handle default parameters', () => {
        const result = createValidationResult(true);

        expect(result).toEqual({
          isValid: true,
          errors: [],
          warnings: [],
          details: {},
        });
      });
    });

    describe('mergeValidationResults', () => {
      it('should merge multiple validation results', () => {
        const result1 = createValidationResult(true, [], ['warning1'], {
          field1: 'data1',
        });
        const result2 = createValidationResult(
          false,
          ['error1'],
          ['warning2'],
          { field2: 'data2' }
        );

        const merged = mergeValidationResults(result1, result2);

        expect(merged.isValid).toBe(false);
        expect(merged.errors).toEqual(['error1']);
        expect(merged.warnings).toEqual(['warning1', 'warning2']);
        expect(merged.details).toEqual({ field1: 'data1', field2: 'data2' });
      });
    });
  });
});
```

## Testing Requirements

### 1. Schema Validation

- All common schema definitions validate correctly
- Type references work across the system
- JSDoc types are properly defined and imported

### 2. Utility Function Testing

- All validation utilities work correctly
- Edge cases are handled appropriately
- Performance requirements are met

### 3. Integration Testing

- Schema references work with existing validation pipeline
- Type definitions are usable throughout the codebase

## Success Criteria

1. **Schema Consistency**: All schema references are consistent and valid
2. **Type Safety**: JSDoc types provide proper IDE support and validation
3. **Utility Functions**: All validation utilities work correctly and efficiently
4. **Integration**: Seamless integration with existing validation systems
5. **Documentation**: Clear, comprehensive type definitions and schemas

## Files Created

- `src/types/multiTargetTypes.js`
- `src/utils/multiTargetValidationUtils.js`
- `tests/unit/utils/multiTargetValidationUtils.test.js`

## Files Modified

- `data/schemas/common.schema.json`

## Validation Steps

1. Validate all schema definitions against JSON Schema specification
2. Test type imports in various files throughout the codebase
3. Run all utility function tests
4. Verify schema references work with existing validation
5. Test JSDoc type checking in IDE

## Notes

- Common schema definitions provide reusable components for all schemas
- Type definitions support both JSDoc and TypeScript environments
- Validation utilities are designed for reuse across the system
- All functions include comprehensive error handling and validation

## Risk Assessment

**Low Risk**: Schema and utility updates that enhance existing functionality without breaking changes. All changes are additive and maintain backward compatibility.

## Next Steps

After this ticket completion:

1. Complete Ticket 06: Create Multi-Target Data Structures
2. Move to Phase 2: Command Processor Enhancement
3. Use enhanced schemas and types throughout implementation
