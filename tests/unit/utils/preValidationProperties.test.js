/**
 * @file preValidationProperties.test.js
 * @description Property-based tests for validation consistency and invariants
 *
 * This test suite uses fast-check to verify validation behavior across
 * hundreds of randomly generated inputs, ensuring:
 * - Valid structures always validate
 * - Invalid structures always fail
 * - Validation is deterministic
 * - Errors are bounded and clear
 *
 * Related ticket: JSOSCHVALROB-002
 */

import fc from 'fast-check';
import { describe, it, expect } from '@jest/globals';
import {
  validateOperationStructure,
  validateAllOperations,
  KNOWN_OPERATION_TYPES,
} from '../../../src/utils/preValidationUtils.js';

describe('preValidationUtils - Property-Based Tests', () => {
  describe('Property 1: Valid Macro References Always Validate', () => {
    it('should validate all well-formed macro references', () => {
      fc.assert(
        fc.property(
          fc.record({
            macro: fc
              .string({ minLength: 1, maxLength: 20 })
              .map((s) => `namespace:${s}`),
            comment: fc.option(fc.string({ maxLength: 50 })),
          }),
          (macroRef) => {
            const result = validateOperationStructure(macroRef, 'test');
            expect(result.isValid).toBe(true);
            expect(result.error).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should validate macro references without comment field', () => {
      fc.assert(
        fc.property(
          fc
            .string({ minLength: 1, maxLength: 20 })
            .map((s) => ({ macro: `namespace:${s}` })),
          (macroRef) => {
            const result = validateOperationStructure(macroRef, 'test');
            expect(result.isValid).toBe(true);
            expect(result.error).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 2: Valid Operations Always Validate', () => {
    it('should validate all well-formed operations', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...KNOWN_OPERATION_TYPES),
          fc.object(),
          (type, parameters) => {
            const operation = { type, parameters };
            const result = validateOperationStructure(operation, 'test');
            expect(result.isValid).toBe(true);
            expect(result.error).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should validate operations with END_TURN type without parameters', () => {
      fc.assert(
        fc.property(fc.constant({ type: 'END_TURN' }), (operation) => {
          const result = validateOperationStructure(operation, 'test');
          expect(result.isValid).toBe(true);
          expect(result.error).toBeNull();
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 3: Hybrid Actions Always Fail', () => {
    it('should reject all actions with both type and macro fields', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...KNOWN_OPERATION_TYPES.slice(0, 10)), // Use subset for faster tests
          fc
            .string({ minLength: 1, maxLength: 20 })
            .map((s) => `namespace:${s}`),
          (type, macro) => {
            const invalidAction = { type, macro, parameters: {} };
            const result = validateOperationStructure(invalidAction, 'test');
            expect(result.isValid).toBe(false);
            expect(result.error).toContain('should not have a type field');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should provide helpful suggestions for hybrid actions', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...KNOWN_OPERATION_TYPES.slice(0, 5)),
          fc
            .string({ minLength: 1, maxLength: 20 })
            .map((s) => `namespace:${s}`),
          (type, macro) => {
            const invalidAction = { type, macro, parameters: {} };
            const result = validateOperationStructure(invalidAction, 'test');
            expect(result.suggestions).toBeTruthy();
            expect(result.suggestions.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 4: Empty Actions Always Fail', () => {
    it('should reject all actions without type or macro fields', () => {
      fc.assert(
        fc.property(
          fc.object({ maxKeys: 5 }).filter((obj) => !obj.type && !obj.macro),
          (invalidAction) => {
            const result = validateOperationStructure(invalidAction, 'test');
            expect(result.isValid).toBe(false);
            expect(result.error).toContain('Missing required "type" field');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should provide helpful error messages for empty actions', () => {
      fc.assert(
        fc.property(fc.constant({}), (emptyAction) => {
          const result = validateOperationStructure(emptyAction, 'test');
          expect(result.isValid).toBe(false);
          expect(result.error).toBeTruthy();
          expect(result.suggestions).toBeTruthy();
          expect(result.suggestions.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Invariant 1: Validation is Deterministic', () => {
    it('should produce identical results for identical valid operations', () => {
      fc.assert(
        fc.property(
          fc.record({
            type: fc.constantFrom(...KNOWN_OPERATION_TYPES.slice(0, 10)),
            parameters: fc.object({ maxDepth: 1, maxKeys: 5 }),
          }),
          (operation) => {
            const result1 = validateOperationStructure(operation, 'test');
            const result2 = validateOperationStructure(operation, 'test');
            expect(result1).toEqual(result2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should produce identical results for identical macro references', () => {
      fc.assert(
        fc.property(
          fc.record({
            macro: fc
              .string({ minLength: 1, maxLength: 20 })
              .map((s) => `namespace:${s}`),
            comment: fc.option(fc.string({ maxLength: 50 })),
          }),
          (macroRef) => {
            const result1 = validateOperationStructure(macroRef, 'test');
            const result2 = validateOperationStructure(macroRef, 'test');
            expect(result1).toEqual(result2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should produce identical results for identical invalid operations', () => {
      fc.assert(
        fc.property(fc.constant({}), (emptyOperation) => {
          const result1 = validateOperationStructure(emptyOperation, 'test');
          const result2 = validateOperationStructure(emptyOperation, 'test');
          expect(result1).toEqual(result2);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Invariant 2: Error Count is Bounded', () => {
    it('should never generate excessive errors for single operations', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.record({ type: fc.string(), parameters: fc.object() }),
            fc.record({ macro: fc.string() }),
            fc.constant({})
          ),
          (operation) => {
            const result = validateOperationStructure(operation, 'test');
            // For invalid operations, ensure we get a single clear error
            if (!result.isValid) {
              expect(result.error).toBeTruthy();
              expect(typeof result.error).toBe('string');
              expect(result.error.length).toBeLessThan(500); // Single error message
              expect(result.error.length).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should fail fast for arrays with invalid operations', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.oneof(
              fc.record({
                type: fc.constantFrom(...KNOWN_OPERATION_TYPES.slice(0, 5)),
                parameters: fc.object({ maxKeys: 3 }),
              }),
              fc.constant({}) // Invalid operation
            ),
            { minLength: 1, maxLength: 10 }
          ),
          (actions) => {
            // Must set inOperationContext=true to validate array elements
            const result = validateAllOperations(actions, 'test', true);
            // Should fail fast with one clear error, not cascade
            if (!result.isValid) {
              expect(result.error).toBeTruthy();
              expect(typeof result.error).toBe('string');
              // Should not generate 322 errors for 1 invalid action
              expect(result.error.length).toBeLessThan(1000);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Invariant 3: No Existing Tests Break', () => {
    it('should maintain backward compatibility with existing validation behavior', () => {
      // Test known good operation
      const validOperation = {
        type: 'QUERY_COMPONENT',
        parameters: {
          entity_ref: 'actor',
          component_type: 'core:name',
          result_variable: 'actor_name',
        },
      };
      const result = validateOperationStructure(validOperation, 'test');
      expect(result.isValid).toBe(true);
    });

    it('should maintain backward compatibility with known invalid operations', () => {
      // Test known bad operation
      const invalidOperation = {
        type: 'UNKNOWN_OPERATION',
        parameters: {},
      };
      const result = validateOperationStructure(invalidOperation, 'test');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Unknown operation type');
    });

    it('should maintain backward compatibility with macro references', () => {
      // Test known good macro reference
      const validMacro = {
        macro: 'core:logSuccessAndEndTurn',
        comment: 'End the action',
      };
      const result = validateOperationStructure(validMacro, 'test');
      expect(result.isValid).toBe(true);
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle operations with null parameters', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...KNOWN_OPERATION_TYPES.slice(0, 5)),
          (type) => {
            const operation = { type, parameters: null };
            const result = validateOperationStructure(operation, 'test');
            // Should fail for non-END_TURN operations
            if (type !== 'END_TURN') {
              expect(result.isValid).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle operations with undefined parameters', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...KNOWN_OPERATION_TYPES.slice(0, 5)),
          (type) => {
            const operation = { type, parameters: undefined };
            const result = validateOperationStructure(operation, 'test');
            // Should fail for non-END_TURN operations
            if (type !== 'END_TURN') {
              expect(result.isValid).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle macro references with empty string', () => {
      const invalidMacro = { macro: '' };
      const result = validateOperationStructure(invalidMacro, 'test');
      // Empty string macro is invalid - missing namespace:id format
      expect(result.isValid).toBe(false);
    });

    it('should handle macro references with non-string values', () => {
      fc.assert(
        fc.property(
          fc.oneof(fc.constant(123), fc.constant(true), fc.constant(null)),
          (nonString) => {
            const invalidMacro = { macro: nonString };
            const result = validateOperationStructure(invalidMacro, 'test');
            // Non-string macros are invalid
            expect(result.isValid).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle deeply nested parameters', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...KNOWN_OPERATION_TYPES.slice(0, 5)),
          fc.object({ maxDepth: 5, maxKeys: 3 }),
          (type, parameters) => {
            const operation = { type, parameters };
            const result = validateOperationStructure(operation, 'test');
            // Should validate regardless of parameter depth
            expect(result.isValid).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle arrays with mixed valid and invalid operations', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.oneof(
              fc.record({
                type: fc.constantFrom(...KNOWN_OPERATION_TYPES.slice(0, 3)),
                parameters: fc.object({ maxKeys: 2 }),
              }),
              fc.constant({ type: 'INVALID_TYPE', parameters: {} })
            ),
            { minLength: 2, maxLength: 5 }
          ),
          (actions) => {
            // Must set inOperationContext=true to validate array elements
            const result = validateAllOperations(actions, 'test', true);
            // Should fail if any operation is invalid
            const hasInvalid = actions.some((a) => a.type === 'INVALID_TYPE');
            if (hasInvalid) {
              expect(result.isValid).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
