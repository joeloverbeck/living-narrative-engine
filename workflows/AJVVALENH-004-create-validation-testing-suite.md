# AJVVALENH-004: Create Validation Testing Suite

## Priority: 2 - High

## Problem Statement
The Living Narrative Engine has 41 different operation types, but there's no comprehensive test suite that validates each operation type's schema validation behavior. This makes it difficult to ensure validation works correctly for all operations and makes it risky to modify validation logic. We need a systematic testing suite that covers all operation types with both positive and negative test cases.

## Current State
- 41 operation types defined in `data/schemas/operations/`
- No systematic validation tests for operations
- No negative test cases for common mistakes
- No verification that error messages are helpful
- Validation behavior is untested for many operation types

## Technical Requirements

### 1. Test Suite Structure

Create a comprehensive validation test suite:
```
tests/unit/validation/operations/
├── operationValidation.test.js          # Main test orchestrator
├── fixtures/
│   ├── validOperations.js               # Valid examples for all 41 types
│   ├── invalidOperations.js             # Invalid examples with expected errors
│   └── edgeCases.js                     # Edge cases and boundary conditions
└── helpers/
    ├── operationTestFactory.js          # Generate test cases
    └── validationTestRunner.js          # Run validation tests
```

### 2. Operation Test Coverage Matrix

#### All 41 Operation Types to Test
Based on the anyOf array in operation.schema.json:
```javascript
const operationTypes = [
  'IF',
  'QUERY_COMPONENT',
  'SET_COMPONENT',
  'ADD_ENTITY',
  'REMOVE_ENTITY',
  'MOVE_ENTITY',
  'ADD_TAG',
  'REMOVE_TAG',
  'SET_VARIABLE',
  'INCREMENT_VARIABLE',
  'APPEND_TO_LIST',
  'REMOVE_FROM_LIST',
  'TRIGGER_EVENT',
  'SEND_MESSAGE',
  'SHOW_PROMPT',
  'PLAY_SOUND',
  'STOP_SOUND',
  'CHANGE_SCENE',
  'START_DIALOGUE',
  'END_DIALOGUE',
  'EXECUTE_SCRIPT',
  'WAIT',
  'RANDOM_CHOICE',
  'WEIGHTED_CHOICE',
  'QUERY_ENTITIES',
  'FILTER_ENTITIES',
  'SORT_ENTITIES',
  'MAP_ENTITIES',
  'REDUCE_ENTITIES',
  'FOR_EACH',
  'WHILE',
  'BREAK',
  'CONTINUE',
  'RETURN',
  'TRY_CATCH',
  'PARALLEL',
  'SEQUENCE',
  'RACE',
  'DELAY',
  'THROTTLE',
  'DEBOUNCE'
];
```

### 3. Test Case Generation

#### Valid Operation Examples
```javascript
// tests/unit/validation/operations/fixtures/validOperations.js
export const validOperations = {
  IF: {
    minimal: {
      type: 'IF',
      parameters: {
        condition: { '==': [1, 1] },
        then_actions: []
      }
    },
    complete: {
      type: 'IF',
      parameters: {
        condition: { '==': [{ var: 'health' }, 0] },
        then_actions: [
          { type: 'SET_COMPONENT', parameters: { componentId: 'state', data: { alive: false } } }
        ],
        else_actions: [
          { type: 'TRIGGER_EVENT', parameters: { eventType: 'CONTINUE' } }
        ]
      }
    },
    nested: {
      type: 'IF',
      parameters: {
        condition: { '>': [{ var: 'level' }, 5] },
        then_actions: [
          {
            type: 'IF',
            parameters: {
              condition: { '==': [{ var: 'class' }, 'warrior'] },
              then_actions: [/* ... */]
            }
          }
        ]
      }
    }
  },
  
  QUERY_COMPONENT: {
    minimal: {
      type: 'QUERY_COMPONENT',
      parameters: {
        componentId: 'core:health',
        query: { path: 'current' }
      }
    },
    withTarget: {
      type: 'QUERY_COMPONENT',
      parameters: {
        componentId: 'core:health',
        query: { path: 'current' },
        targetEntity: 'player'
      }
    }
  },
  
  // ... examples for all 41 types
};
```

#### Invalid Operation Examples
```javascript
// tests/unit/validation/operations/fixtures/invalidOperations.js
export const invalidOperations = {
  IF: [
    {
      name: 'missing_type',
      operation: {
        parameters: {
          condition: { '==': [1, 1] },
          then_actions: []
        }
      },
      expectedErrors: [
        { path: 'type', message: 'required' }
      ]
    },
    {
      name: 'properties_at_wrong_level',
      operation: {
        type: 'IF',
        condition: { '==': [1, 1] },  // Should be in parameters
        then_actions: []               // Should be in parameters
      },
      expectedErrors: [
        { path: '', message: 'additionalProperties' },
        { path: 'parameters', message: 'required' }
      ]
    },
    {
      name: 'missing_required_fields',
      operation: {
        type: 'IF',
        parameters: {
          condition: { '==': [1, 1] }
          // Missing then_actions
        }
      },
      expectedErrors: [
        { path: 'parameters.then_actions', message: 'required' }
      ]
    },
    {
      name: 'invalid_condition_format',
      operation: {
        type: 'IF',
        parameters: {
          condition: 'not_an_object',  // Should be JSON Logic object
          then_actions: []
        }
      },
      expectedErrors: [
        { path: 'parameters.condition', message: 'type should be object' }
      ]
    }
  ],
  
  // ... invalid examples for all 41 types
};
```

### 4. Test Runner Implementation

#### Main Test Orchestrator
```javascript
// tests/unit/validation/operations/operationValidation.test.js
import { describe, it, expect, beforeAll } from '@jest/globals';
import { validOperations } from './fixtures/validOperations.js';
import { invalidOperations } from './fixtures/invalidOperations.js';
import { edgeCases } from './fixtures/edgeCases.js';
import { validateOperation } from '../../../../src/utils/schemaValidationUtils.js';

describe('Operation Validation Test Suite', () => {
  let validator;
  
  beforeAll(async () => {
    // Initialize validator with all operation schemas
    validator = await initializeValidator();
  });
  
  describe('Valid Operations', () => {
    operationTypes.forEach(type => {
      describe(`${type} Operation`, () => {
        const examples = validOperations[type];
        
        if (!examples) {
          it.todo(`needs valid examples for ${type}`);
          return;
        }
        
        Object.entries(examples).forEach(([name, operation]) => {
          it(`should validate ${name} example`, async () => {
            const result = await validateOperation(operation);
            
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
          });
        });
      });
    });
  });
  
  describe('Invalid Operations', () => {
    operationTypes.forEach(type => {
      describe(`${type} Operation Errors`, () => {
        const errorCases = invalidOperations[type] || [];
        
        if (errorCases.length === 0) {
          it.todo(`needs invalid examples for ${type}`);
          return;
        }
        
        errorCases.forEach(testCase => {
          it(`should reject ${testCase.name}`, async () => {
            const result = await validateOperation(testCase.operation);
            
            expect(result.valid).toBe(false);
            expect(result.errors).toBeDefined();
            
            // Verify expected errors are present
            testCase.expectedErrors.forEach(expected => {
              const hasError = result.errors.some(error => 
                error.path.includes(expected.path) &&
                error.message.includes(expected.message)
              );
              expect(hasError).toBe(true);
            });
          });
        });
      });
    });
  });
  
  describe('Edge Cases', () => {
    it('should handle deeply nested operations', async () => {
      const deeplyNested = createDeeplyNestedOperation(10);
      const result = await validateOperation(deeplyNested);
      expect(result.valid).toBe(true);
    });
    
    it('should handle operations with many actions', async () => {
      const manyActions = createOperationWithManyActions(100);
      const result = await validateOperation(manyActions);
      expect(result.valid).toBe(true);
    });
    
    it('should handle operations with complex JSON Logic', async () => {
      const complexLogic = createComplexJsonLogicOperation();
      const result = await validateOperation(complexLogic);
      expect(result.valid).toBe(true);
    });
  });
});
```

### 5. Error Message Quality Tests

```javascript
describe('Error Message Quality', () => {
  it('should provide helpful messages for structural errors', async () => {
    const wrongStructure = {
      type: 'IF',
      condition: {},  // Wrong level
      then_actions: []
    };
    
    const result = await validateOperation(wrongStructure);
    
    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toContain('parameters');
    expect(result.hints).toBeDefined();
    expect(result.hints[0]).toContain('Move');
  });
  
  it('should suggest correct operation type for typos', async () => {
    const typo = {
      type: 'IFF',  // Typo
      parameters: {
        condition: {},
        then_actions: []
      }
    };
    
    const result = await validateOperation(typo);
    
    expect(result.valid).toBe(false);
    expect(result.suggestions).toContain('IF');
  });
  
  it('should not generate cascade errors for simple issues', async () => {
    const simpleIssue = {
      type: 'QUERY_COMPONENT',
      parameters: {
        // Missing required componentId
        query: {}
      }
    };
    
    const result = await validateOperation(simpleIssue);
    
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeLessThan(10);  // Not 700+
    expect(result.errors[0].path).toContain('componentId');
  });
});
```

### 6. Performance Benchmarks

```javascript
describe('Validation Performance', () => {
  it('should validate simple operations in <10ms', async () => {
    const simple = validOperations.IF.minimal;
    
    const start = performance.now();
    await validateOperation(simple);
    const duration = performance.now() - start;
    
    expect(duration).toBeLessThan(10);
  });
  
  it('should validate complex operations in <50ms', async () => {
    const complex = createComplexOperation();
    
    const start = performance.now();
    await validateOperation(complex);
    const duration = performance.now() - start;
    
    expect(duration).toBeLessThan(50);
  });
  
  it('should handle batch validation efficiently', async () => {
    const operations = Array(100).fill(null).map(() => 
      validOperations.IF.minimal
    );
    
    const start = performance.now();
    await Promise.all(operations.map(validateOperation));
    const duration = performance.now() - start;
    
    expect(duration).toBeLessThan(500);  // <5ms per operation
  });
});
```

### 7. Test Helpers

```javascript
// tests/unit/validation/operations/helpers/operationTestFactory.js
export class OperationTestFactory {
  static createDeeplyNestedOperation(depth) {
    if (depth === 0) {
      return {
        type: 'SET_COMPONENT',
        parameters: { componentId: 'test', data: {} }
      };
    }
    
    return {
      type: 'IF',
      parameters: {
        condition: { '==': [1, 1] },
        then_actions: [this.createDeeplyNestedOperation(depth - 1)]
      }
    };
  }
  
  static createOperationWithManyActions(count) {
    const actions = Array(count).fill(null).map((_, i) => ({
      type: 'SET_VARIABLE',
      parameters: {
        variableName: `var_${i}`,
        value: i
      }
    }));
    
    return {
      type: 'SEQUENCE',
      parameters: { actions }
    };
  }
  
  static generateAllPermutations(operationType) {
    // Generate various valid and invalid permutations
    // for comprehensive testing
  }
}
```

## Success Criteria

### Test Coverage
- [ ] All 41 operation types have valid examples
- [ ] All 41 operation types have invalid examples
- [ ] Each operation has at least 3 positive test cases
- [ ] Each operation has at least 5 negative test cases
- [ ] Edge cases are covered

### Quality Metrics
- [ ] Error messages are clear and actionable
- [ ] No anyOf cascade for simple errors
- [ ] Performance benchmarks are met
- [ ] Test suite runs in <30 seconds

### Documentation
- [ ] Each operation type is documented
- [ ] Common mistakes are documented
- [ ] Test patterns are reusable

## Dependencies
- Requires AJVVALENH-001, AJVVALENH-002, AJVVALENH-003
- Requires access to all operation schemas
- May identify issues requiring schema updates

## Estimated Complexity
- **Effort**: 8-10 hours
- **Risk**: Medium (discovering validation issues)
- **Maintenance**: Ongoing as operations are added

## Implementation Notes

### Test Organization Strategy
1. Group tests by operation type for clarity
2. Use descriptive names for test cases
3. Include the reason why each test exists
4. Make failures easy to diagnose

### Test Data Management
1. Keep fixtures maintainable and documented
2. Use factories for complex test data
3. Version test data with schema changes
4. Share common patterns between tests

### Continuous Integration
```json
// package.json
{
  "scripts": {
    "test:validation": "jest tests/unit/validation/operations",
    "test:validation:watch": "jest tests/unit/validation/operations --watch",
    "test:validation:coverage": "jest tests/unit/validation/operations --coverage"
  }
}
```

## Definition of Done
- [ ] Test suite structure created
- [ ] All 41 operations have test coverage
- [ ] Valid examples for each operation
- [ ] Invalid examples with expected errors
- [ ] Edge cases tested
- [ ] Performance benchmarks passing
- [ ] Error message quality verified
- [ ] Documentation complete
- [ ] CI integration configured

## Related Tickets
- AJVVALENH-001: Complete ajvAnyOfErrorFormatter Integration
- AJVVALENH-002: Add Comprehensive Tests for Error Formatters
- AJVVALENH-003: Implement Pre-validation Type Checker
- AJVVALENH-005: Implement Discriminated Union Schema Pattern

## Notes
This comprehensive test suite will serve as both validation of the system and documentation of how each operation should be structured. It will catch regressions, identify unclear error messages, and ensure that validation improvements actually help developers. The test suite should become the authoritative source for operation validation behavior.