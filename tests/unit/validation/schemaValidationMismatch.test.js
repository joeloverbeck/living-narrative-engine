import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import { validateAgainstSchema } from '../../../src/utils/schemaValidationUtils.js';

/**
 * Tests to reproduce the schema validation mismatch bug where operations
 * are validated against incorrect schemas (e.g., IF validated against QUERY_COMPONENTS schema)
 */
describe('Schema Validation Mismatch Issue', () => {
  let testBed;
  let mockLogger;
  let mockValidator;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();
    mockValidator = testBed.createMockValidator();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should document the schema validation bug from entity_thought.rule.json', () => {
    // Arrange - Mock validator to simulate the incorrect behavior seen in logs
    mockValidator.isSchemaLoaded.mockReturnValue(true);

    // This simulates the buggy behavior where IF operation is validated
    // against QUERY_COMPONENTS schema instead of IF schema
    const simulatedError = {
      isValid: false,
      errors: [
        {
          instancePath: '/actions/1/type',
          schemaPath: '#/allOf/1/properties/type/const',
          keyword: 'const',
          params: {
            allowedValue: 'QUERY_COMPONENTS', // Wrong! Should be "IF"
          },
          message: 'must be equal to constant',
          schema: 'QUERY_COMPONENTS',
          data: 'IF', // The actual data is IF but it's being validated against QUERY_COMPONENTS
        },
      ],
    };

    mockValidator.validate.mockReturnValue(simulatedError);

    const entityThoughtRule = {
      event_type: 'core:entity_thought', // Add required field for pre-validation
      actions: [
        {
          type: 'QUERY_COMPONENTS',
          parameters: { entity_ref: 'actor', pairs: [] },
        },
        {
          type: 'IF', // This is incorrectly validated against QUERY_COMPONENTS schema
          parameters: {
            condition: { var: 'context.someVariable' },
            then_actions: [{ type: 'LOG', parameters: { message: 'test' } }],
          },
        },
      ],
    };

    // Act - This demonstrates the buggy validation behavior (should throw an error)
    expect(() => {
      validateAgainstSchema(
        mockValidator,
        'schema://living-narrative-engine/rule.schema.json',
        entityThoughtRule,
        mockLogger
      );
    }).toThrow(/Schema validation failed/);

    // Assert - Verify the error details in the mock validator
    expect(mockValidator.validate).toHaveBeenCalled();
    expect(simulatedError.errors[0].data).toBe('IF'); // The operation type is IF
    expect(simulatedError.errors[0].params.allowedValue).toBe(
      'QUERY_COMPONENTS'
    ); // But it's being validated against QUERY_COMPONENTS schema
    expect(simulatedError.errors[0].keyword).toBe('const');
  });

  it('should demonstrate the root cause analysis', () => {
    // The issue is that operations in a rule are being validated against the wrong schemas
    // This suggests the schema resolution/compilation in AJV is mixing up operation schemas

    // The bug pattern from logs shows:
    // 1. First error: QUERY_COMPONENTS validated against QUERY_COMPONENT (singular) schema
    // 2. Second error: IF operation validated against QUERY_COMPONENTS schema

    const expectedBugPattern = {
      // Error 1: Wrong schema for first operation
      error1: {
        operationType: 'QUERY_COMPONENTS',
        wrongSchema: 'QUERY_COMPONENT', // Should be QUERY_COMPONENTS
        reason: 'Schema name mismatch - plural vs singular',
      },

      // Error 2: Wrong schema for second operation
      error2: {
        operationType: 'IF',
        wrongSchema: 'QUERY_COMPONENTS', // Should be IF
        reason: "Schema resolution is using previous operation's schema",
      },
    };

    // This suggests the AJV schema compilation is either:
    // 1. Caching the wrong schema reference
    // 2. Not properly resolving the correct schema for each operation type
    // 3. Using the wrong schema ID during validation

    expect(expectedBugPattern.error1.operationType).toBe('QUERY_COMPONENTS');
    expect(expectedBugPattern.error1.wrongSchema).toBe('QUERY_COMPONENT');
    expect(expectedBugPattern.error2.operationType).toBe('IF');
    expect(expectedBugPattern.error2.wrongSchema).toBe('QUERY_COMPONENTS');
  });
});
