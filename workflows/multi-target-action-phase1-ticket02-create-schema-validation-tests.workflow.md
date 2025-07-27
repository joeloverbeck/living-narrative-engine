# Ticket 02: Create Schema Validation Tests

## Overview

Create comprehensive test suite for the enhanced `attempt_action.event.json` schema to validate both legacy single-target events and new multi-target events. This ensures the schema changes work correctly and maintain backward compatibility.

## Dependencies

- Ticket 01: Update Event Schema (must be completed)

## Blocks

- Ticket 03: Add Multi-Target Validation Rules
- Ticket 07: Implement Multi-Target Data Extraction

## Priority: Critical

## Estimated Time: 6-8 hours

## Background

With the enhanced event schema supporting multi-target actions, we need comprehensive tests to ensure:
1. All existing legacy event formats continue to validate
2. New multi-target event formats validate correctly
3. Invalid event formats are properly rejected with clear error messages
4. Performance requirements are met
5. Edge cases are handled appropriately

## Implementation Details

### 1. Create Schema Test File

**File**: `tests/unit/schemas/attemptActionEventSchema.test.js`

```javascript
/**
 * @file Tests for enhanced attempt_action event schema validation
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { TestBedClass } from '../../common/testbed.js';
import { AjvSchemaValidator } from '../../../src/validation/ajvSchemaValidator.js';

describe('Attempt Action Event Schema - Enhanced Multi-Target Support', () => {
  let testBed;
  let validator;
  const SCHEMA_ID = 'core:attempt_action';

  beforeEach(async () => {
    testBed = new TestBedClass();
    validator = testBed.get('IAjvSchemaValidator') || new AjvSchemaValidator();
    
    // Ensure schema is loaded
    await validator.loadSchema(SCHEMA_ID);
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Legacy Single-Target Event Validation', () => {
    it('should validate basic legacy event format', () => {
      const legacyEvent = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'core:follow',
        targetId: 'target_456',
        originalInput: 'follow Alice'
      };

      const result = validator.validate(SCHEMA_ID, legacyEvent);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate legacy event with timestamp', () => {
      const legacyEvent = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'core:follow',
        targetId: 'target_456',
        originalInput: 'follow Alice',
        timestamp: 1640995200000
      };

      const result = validator.validate(SCHEMA_ID, legacyEvent);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate legacy event with null targetId', () => {
      const legacyEvent = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'core:emote',
        targetId: null,
        originalInput: 'smile'
      };

      const result = validator.validate(SCHEMA_ID, legacyEvent);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject legacy event with empty string targetId', () => {
      const legacyEvent = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'core:follow',
        targetId: '',
        originalInput: 'follow Alice'
      };

      const result = validator.validate(SCHEMA_ID, legacyEvent);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('targetId must not be empty string');
    });
  });

  describe('Multi-Target Event Validation', () => {
    it('should validate multi-target event with item and target', () => {
      const multiTargetEvent = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'combat:throw',
        targets: {
          item: 'knife_789',
          target: 'goblin_012'
        },
        targetId: 'knife_789',
        originalInput: 'throw knife at goblin',
        timestamp: 1640995200000
      };

      const result = validator.validate(SCHEMA_ID, multiTargetEvent);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate multi-target event with person and clothing', () => {
      const multiTargetEvent = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'interaction:adjust',
        targets: {
          person: 'alice_456',
          clothing: 'dress_789'
        },
        targetId: 'alice_456',
        originalInput: 'adjust Alice\'s red dress',
        timestamp: 1640995200000
      };

      const result = validator.validate(SCHEMA_ID, multiTargetEvent);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate single-target event using targets object', () => {
      const singleTargetEvent = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'core:follow',
        targets: {
          primary: 'target_456'
        },
        targetId: 'target_456',
        originalInput: 'follow Alice',
        timestamp: 1640995200000
      };

      const result = validator.validate(SCHEMA_ID, singleTargetEvent);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate multi-target event with many targets', () => {
      const multiTargetEvent = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'complex:multi_action',
        targets: {
          primary: 'target_1',
          secondary: 'target_2',
          item: 'item_3',
          location: 'location_4',
          tool: 'tool_5'
        },
        targetId: 'target_1',
        originalInput: 'complex multi-target action',
        timestamp: 1640995200000
      };

      const result = validator.validate(SCHEMA_ID, multiTargetEvent);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Required Field Validation', () => {
    it('should reject event missing eventName', () => {
      const invalidEvent = {
        actorId: 'actor_123',
        actionId: 'core:follow',
        targetId: 'target_456',
        originalInput: 'follow Alice'
      };

      const result = validator.validate(SCHEMA_ID, invalidEvent);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing required field: eventName');
    });

    it('should reject event missing actorId', () => {
      const invalidEvent = {
        eventName: 'core:attempt_action',
        actionId: 'core:follow',
        targetId: 'target_456',
        originalInput: 'follow Alice'
      };

      const result = validator.validate(SCHEMA_ID, invalidEvent);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing required field: actorId');
    });

    it('should reject event missing actionId', () => {
      const invalidEvent = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        targetId: 'target_456',
        originalInput: 'follow Alice'
      };

      const result = validator.validate(SCHEMA_ID, invalidEvent);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing required field: actionId');
    });

    it('should reject event missing originalInput', () => {
      const invalidEvent = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'core:follow',
        targetId: 'target_456'
      };

      const result = validator.validate(SCHEMA_ID, invalidEvent);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing required field: originalInput');
    });

    it('should reject event with empty required string fields', () => {
      const invalidEvent = {
        eventName: 'core:attempt_action',
        actorId: '',
        actionId: 'core:follow',
        targetId: 'target_456',
        originalInput: 'follow Alice'
      };

      const result = validator.validate(SCHEMA_ID, invalidEvent);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('actorId must not be empty');
    });
  });

  describe('Target Requirement Validation', () => {
    it('should reject event with neither targets nor targetId', () => {
      const invalidEvent = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'core:action',
        originalInput: 'some action'
      };

      const result = validator.validate(SCHEMA_ID, invalidEvent);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Must have either targets object or targetId');
    });

    it('should reject event with empty targets object', () => {
      const invalidEvent = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'core:action',
        targets: {},
        originalInput: 'some action'
      };

      const result = validator.validate(SCHEMA_ID, invalidEvent);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('targets object must have at least one property');
    });

    it('should validate event with targets but no targetId when targets has single property', () => {
      // Note: This should be valid but will generate a warning in consistency checks
      const event = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'core:action',
        targets: {
          primary: 'target_123'
        },
        originalInput: 'some action'
      };

      const result = validator.validate(SCHEMA_ID, event);
      expect(result.isValid).toBe(false); // Should require targetId when targets exist
      expect(result.errors).toContain('targetId is required when targets object exists');
    });
  });

  describe('Target Consistency Validation', () => {
    it('should warn when targetId does not match primary target', () => {
      const event = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'core:action',
        targets: {
          primary: 'target_123',
          secondary: 'target_456'
        },
        targetId: 'target_456', // Does not match primary
        originalInput: 'some action'
      };

      const result = validator.validate(SCHEMA_ID, event);
      expect(result.isValid).toBe(true); // Still valid, but should log warning
      expect(result.warnings).toContain('targetId should match primary target in targets object');
    });

    it('should validate when targetId matches first target in targets object', () => {
      const event = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'core:action',
        targets: {
          item: 'target_123',
          recipient: 'target_456'
        },
        targetId: 'target_123', // Matches first target
        originalInput: 'some action'
      };

      const result = validator.validate(SCHEMA_ID, event);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Data Type Validation', () => {
    it('should reject event with invalid eventName', () => {
      const invalidEvent = {
        eventName: 'invalid:event_name',
        actorId: 'actor_123',
        actionId: 'core:follow',
        targetId: 'target_456',
        originalInput: 'follow Alice'
      };

      const result = validator.validate(SCHEMA_ID, invalidEvent);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('eventName must be "core:attempt_action"');
    });

    it('should reject event with non-string actorId', () => {
      const invalidEvent = {
        eventName: 'core:attempt_action',
        actorId: 123,
        actionId: 'core:follow',
        targetId: 'target_456',
        originalInput: 'follow Alice'
      };

      const result = validator.validate(SCHEMA_ID, invalidEvent);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('actorId must be a string');
    });

    it('should reject event with non-object targets', () => {
      const invalidEvent = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'core:action',
        targets: 'invalid_string',
        targetId: 'target_123',
        originalInput: 'some action'
      };

      const result = validator.validate(SCHEMA_ID, invalidEvent);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('targets must be an object');
    });

    it('should reject event with non-string target values', () => {
      const invalidEvent = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'core:action',
        targets: {
          primary: 123,
          secondary: 'valid_target'
        },
        targetId: 'valid_target',
        originalInput: 'some action'
      };

      const result = validator.validate(SCHEMA_ID, invalidEvent);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('target values must be strings');
    });

    it('should reject event with negative timestamp', () => {
      const invalidEvent = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'core:follow',
        targetId: 'target_456',
        originalInput: 'follow Alice',
        timestamp: -1
      };

      const result = validator.validate(SCHEMA_ID, invalidEvent);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('timestamp must be non-negative');
    });
  });

  describe('Additional Properties Validation', () => {
    it('should reject event with additional unknown properties', () => {
      const invalidEvent = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'core:follow',
        targetId: 'target_456',
        originalInput: 'follow Alice',
        unknownProperty: 'should not be allowed'
      };

      const result = validator.validate(SCHEMA_ID, invalidEvent);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Additional property "unknownProperty" not allowed');
    });
  });
});
```

### 2. Create Performance Tests

**File**: `tests/unit/schemas/attemptActionEventSchema.performance.test.js`

```javascript
/**
 * @file Performance tests for attempt_action event schema validation
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { TestBedClass } from '../../common/testbed.js';
import { AjvSchemaValidator } from '../../../src/validation/ajvSchemaValidator.js';

describe('Attempt Action Event Schema - Performance Tests', () => {
  let testBed;
  let validator;
  const SCHEMA_ID = 'core:attempt_action';

  beforeEach(async () => {
    testBed = new TestBedClass();
    validator = testBed.get('IAjvSchemaValidator') || new AjvSchemaValidator();
    await validator.loadSchema(SCHEMA_ID);
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Validation Performance', () => {
    it('should validate legacy events within 5ms', () => {
      const legacyEvent = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'core:follow',
        targetId: 'target_456',
        originalInput: 'follow Alice'
      };

      const startTime = performance.now();
      
      // Run validation 100 times to get average
      for (let i = 0; i < 100; i++) {
        validator.validate(SCHEMA_ID, legacyEvent);
      }
      
      const endTime = performance.now();
      const averageTime = (endTime - startTime) / 100;

      expect(averageTime).toBeLessThan(5); // 5ms target
    });

    it('should validate multi-target events within 5ms', () => {
      const multiTargetEvent = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'combat:throw',
        targets: {
          item: 'knife_789',
          target: 'goblin_012'
        },
        targetId: 'knife_789',
        originalInput: 'throw knife at goblin',
        timestamp: 1640995200000
      };

      const startTime = performance.now();
      
      // Run validation 100 times to get average
      for (let i = 0; i < 100; i++) {
        validator.validate(SCHEMA_ID, multiTargetEvent);
      }
      
      const endTime = performance.now();
      const averageTime = (endTime - startTime) / 100;

      expect(averageTime).toBeLessThan(5); // 5ms target
    });

    it('should handle complex multi-target events efficiently', () => {
      const complexEvent = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'complex:action',
        targets: {
          primary: 'target_1',
          secondary: 'target_2',
          item1: 'item_1',
          item2: 'item_2',
          location: 'location_1',
          tool: 'tool_1',
          recipient: 'recipient_1',
          container: 'container_1'
        },
        targetId: 'target_1',
        originalInput: 'complex action with many targets',
        timestamp: 1640995200000
      };

      const startTime = performance.now();
      
      // Run validation 50 times
      for (let i = 0; i < 50; i++) {
        validator.validate(SCHEMA_ID, complexEvent);
      }
      
      const endTime = performance.now();
      const averageTime = (endTime - startTime) / 50;

      expect(averageTime).toBeLessThan(10); // 10ms target for complex events
    });
  });

  describe('Memory Usage', () => {
    it('should not cause significant memory leaks', () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Create and validate many events
      for (let i = 0; i < 1000; i++) {
        const event = {
          eventName: 'core:attempt_action',
          actorId: `actor_${i}`,
          actionId: 'core:action',
          targetId: `target_${i}`,
          originalInput: `action ${i}`
        };
        
        validator.validate(SCHEMA_ID, event);
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Should not increase memory by more than 1MB for 1000 validations
      expect(memoryIncrease).toBeLessThan(1024 * 1024); // 1MB
    });
  });
});
```

### 3. Create Test Helper Functions

**File**: `tests/common/schemaTestHelpers.js`

```javascript
/**
 * @file Helper functions for schema testing
 */

/**
 * Creates a valid legacy event for testing
 * @param {Object} overrides - Properties to override
 * @returns {Object} Valid legacy event
 */
export function createValidLegacyEvent(overrides = {}) {
  return {
    eventName: 'core:attempt_action',
    actorId: 'actor_123',
    actionId: 'core:follow',
    targetId: 'target_456',
    originalInput: 'follow Alice',
    ...overrides
  };
}

/**
 * Creates a valid multi-target event for testing
 * @param {Object} targets - Target definitions
 * @param {Object} overrides - Properties to override
 * @returns {Object} Valid multi-target event
 */
export function createValidMultiTargetEvent(targets = {}, overrides = {}) {
  const defaultTargets = {
    item: 'knife_789',
    target: 'goblin_012'
  };
  
  const finalTargets = { ...defaultTargets, ...targets };
  const primaryTarget = finalTargets.primary || Object.values(finalTargets)[0];
  
  return {
    eventName: 'core:attempt_action',
    actorId: 'actor_123',
    actionId: 'combat:throw',
    targets: finalTargets,
    targetId: primaryTarget,
    originalInput: 'throw knife at goblin',
    timestamp: Date.now(),
    ...overrides
  };
}

/**
 * Validates an event and provides detailed error information
 * @param {Object} validator - AJV validator instance
 * @param {string} schemaId - Schema ID to validate against
 * @param {Object} event - Event to validate
 * @returns {Object} Validation result with detailed information
 */
export function validateEventWithDetails(validator, schemaId, event) {
  const result = validator.validate(schemaId, event);
  
  return {
    isValid: result.isValid,
    errors: result.errors || [],
    warnings: result.warnings || [],
    event: event,
    schemaId: schemaId
  };
}

/**
 * Creates a test suite for schema validation
 * @param {string} suiteName - Name of the test suite
 * @param {Array} testCases - Array of test case objects
 * @returns {Function} Jest describe function
 */
export function createSchemaTestSuite(suiteName, testCases) {
  return describe(suiteName, () => {
    testCases.forEach(testCase => {
      it(testCase.name, () => {
        const result = testCase.validator.validate(testCase.schemaId, testCase.data);
        
        if (testCase.shouldValidate) {
          expect(result.isValid).toBe(true);
          expect(result.errors).toHaveLength(0);
        } else {
          expect(result.isValid).toBe(false);
          expect(result.errors.length).toBeGreaterThan(0);
          
          if (testCase.expectedError) {
            expect(result.errors).toContain(testCase.expectedError);
          }
        }
      });
    });
  });
}
```

## Testing Requirements

### 1. Unit Test Coverage

- **Legacy Compatibility**: All existing event formats validate correctly
- **Multi-Target Support**: New multi-target formats validate correctly
- **Required Fields**: Proper validation of required field presence and types
- **Target Requirements**: Validation of target requirement logic
- **Data Types**: Proper type checking for all fields
- **Edge Cases**: Empty strings, null values, invalid types
- **Performance**: Validation performance within specified limits

### 2. Integration Testing

- Test schema validation within the existing engine validation pipeline
- Verify error message formatting and clarity
- Test schema loading and caching performance

### 3. Performance Testing

- Validation time < 5ms for typical events
- Memory usage < 1MB increase for 1000 validations
- No memory leaks in repeated validation cycles

## Success Criteria

1. **Test Coverage**: >95% code coverage for schema validation logic
2. **Legacy Compatibility**: 100% of existing event formats pass validation
3. **Multi-Target Support**: All specified multi-target formats validate correctly
4. **Performance**: All performance targets met
5. **Error Quality**: Clear, actionable error messages for all failure cases
6. **Integration**: Tests pass within existing test framework

## Files Created

- `tests/unit/schemas/attemptActionEventSchema.test.js`
- `tests/unit/schemas/attemptActionEventSchema.performance.test.js`
- `tests/common/schemaTestHelpers.js`

## Files Modified

- None (test creation only)

## Validation Steps

1. Run all new schema validation tests
2. Verify test coverage meets requirements
3. Run performance tests and verify timing requirements
4. Test schema validation with actual AJV validator instance
5. Verify error messages are clear and helpful
6. Run integration tests with existing validation pipeline

## Notes

- Tests use the existing `TestBedClass` pattern from the project
- Performance tests include memory leak detection
- Helper functions enable easy test case creation and maintenance
- Tests cover both positive and negative validation scenarios
- All test cases include descriptive names and clear expectations

## Risk Assessment

**Low Risk**: Testing changes only, no production code modifications. Tests ensure schema changes work correctly and maintain compatibility.

## Next Steps

After this ticket completion:
1. Run tests to validate schema changes work correctly
2. Move to Ticket 03: Add Multi-Target Validation Rules
3. Begin command processor enhancement phase