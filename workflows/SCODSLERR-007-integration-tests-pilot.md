# SCODSLERR-007: Create Integration Tests for Pilot Resolver

## Overview

Create comprehensive integration tests for the migrated filterResolver to validate the new error handling system in real-world scenarios.

## Objectives

- Test filterResolver with new error handling
- Validate error buffer population
- Test error categorization in practice
- Ensure backward compatibility
- Validate dev vs prod behavior

## Implementation Details

### Location

`tests/integration/scopeDsl/filterResolverErrorHandling.integration.test.js`

### Required Imports

```javascript
import { jest } from '@jest/globals';
import { describe, it, expect, beforeEach } from '@jest/globals';
import ScopeEngine from '../../../src/scopeDsl/engine.js';
import ScopeDslErrorHandler from '../../../src/scopeDsl/core/scopeDslErrorHandler.js';
import { ScopeDslError } from '../../../src/scopeDsl/errors/scopeDslError.js';
import { parseDslExpression } from '../../../src/scopeDsl/parser/parser.js';
import { ErrorCodes } from '../../../src/scopeDsl/constants/errorCodes.js';
import { ErrorCategories } from '../../../src/scopeDsl/constants/errorCategories.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import { SimpleEntityManager } from '../../common/entities/index.js';
```

### Test Setup

```javascript
let errorHandler;
let scopeEngine;
let mockEntityManager;
let mockJsonLogicEval;

beforeEach(() => {
  const mockLogger = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn()
  };
  
  errorHandler = new ScopeDslErrorHandler({ logger: mockLogger });
  scopeEngine = new ScopeEngine({ errorHandler });
  
  // Create mock entity manager
  mockEntityManager = new SimpleEntityManager([
    {
      id: 'test-actor',
      components: {
        'core:actor': { type: 'player' },
        'core:inventory': { items: ['sword', 'shield'] }
      }
    }
  ]);
  
  // Create mock JSON Logic evaluator
  mockJsonLogicEval = new JsonLogicEvaluationService({ logger: mockLogger });
});
```

### Test Scenarios

#### 1. Missing Context Tests

```javascript
describe('FilterResolver Error Handling - Missing Context', () => {
  it('should handle missing actor with proper error code', () => {
    const scopeWithFilter = 'actor.items[{"==": [{"var": "type"}, "weapon"]}]';
    const ast = parseDslExpression(scopeWithFilter);
    const context = { /* missing actor */ };
    const runtimeCtx = { 
      entityManager: mockEntityManager,
      jsonLogicEval: mockJsonLogicEval 
    };
    
    expect(() => {
      scopeEngine.resolve(ast, null, runtimeCtx);
    }).toThrow(ScopeDslError);
    
    const errors = errorHandler.getErrorBuffer();
    expect(errors[0].code).toBe('SCOPE_1001');
    expect(errors[0].category).toBe('missing_context');
  });
});
```

#### 2. Invalid Filter Tests

```javascript
describe('FilterResolver Error Handling - Invalid Filters', () => {
  it('should handle malformed JSON Logic filter', () => {
    const invalidFilter = 'actor.items[{"invalid": "filter"}]';
    const ast = parseDslExpression(invalidFilter);
    const actorEntity = { id: 'test-actor' };
    const runtimeCtx = {
      entityManager: mockEntityManager,
      jsonLogicEval: mockJsonLogicEval
    };

    expect(() => {
      scopeEngine.resolve(ast, actorEntity, runtimeCtx);
    }).toThrow(ScopeDslError);

    const errors = errorHandler.getErrorBuffer();
    expect(errors[0].code).toBe('SCOPE_2003');
    expect(errors[0].category).toBe('invalid_data');
  });
});
```

#### 3. Error Buffer Management

```javascript
describe('Error Buffer Management', () => {
  it('should accumulate multiple errors in buffer', () => {
    // Trigger multiple different errors
    const testCases = [
      { scope: 'invalid.scope', expectedCode: 'SCOPE_3002' },
      { scope: 'actor[missing]', expectedCode: 'SCOPE_1001' },
      { scope: 'cycle.reference', expectedCode: 'SCOPE_4001' },
    ];

    const runtimeCtx = {
      entityManager: mockEntityManager,
      jsonLogicEval: mockJsonLogicEval
    };

    for (const test of testCases) {
      try {
        const ast = parseDslExpression(test.scope);
        scopeEngine.resolve(ast, null, runtimeCtx);
      } catch (e) {
        // Expected error
      }
    }

    const buffer = errorHandler.getErrorBuffer();
    expect(buffer).toHaveLength(3);
    expect(buffer.map((e) => e.code)).toEqual(
      testCases.map((e) => e.expectedCode)
    );
  });
});
```

#### 4. Environment-Specific Behavior

```javascript
describe('Environment-Specific Error Handling', () => {
  it('should log detailed errors in development', () => {
    process.env.NODE_ENV = 'development';
    const devLogger = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn()
    };
    
    const devErrorHandler = new ScopeDslErrorHandler({ logger: devLogger });
    const devScopeEngine = new ScopeEngine({ errorHandler: devErrorHandler });
    
    // Test detailed logging
    const invalidScope = 'invalid.scope.expression';
    const ast = parseDslExpression(invalidScope);
    
    expect(() => {
      devScopeEngine.resolve(ast, null, { entityManager: mockEntityManager });
    }).toThrow();
    
    expect(devLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('detailed'),
      expect.any(Object)
    );
  });

  it('should log minimal errors in production', () => {
    process.env.NODE_ENV = 'production';
    const prodLogger = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn()
    };
    
    const prodErrorHandler = new ScopeDslErrorHandler({ logger: prodLogger });
    const prodScopeEngine = new ScopeEngine({ errorHandler: prodErrorHandler });
    
    // Test minimal logging
    const invalidScope = 'invalid.scope.expression';
    const ast = parseDslExpression(invalidScope);
    
    expect(() => {
      prodScopeEngine.resolve(ast, null, { entityManager: mockEntityManager });
    }).toThrow();
    
    expect(prodLogger.error).toHaveBeenCalledWith(
      expect.not.stringContaining('stack'),
      expect.any(Object)
    );
  });
});
```

### Performance Testing

```javascript
describe('Error Handling Performance', () => {
  it('should handle errors efficiently', () => {
    const iterations = 1000;
    const start = performance.now();

    const runtimeCtx = {
      entityManager: mockEntityManager,
      jsonLogicEval: mockJsonLogicEval
    };

    for (let i = 0; i < iterations; i++) {
      try {
        const ast = parseDslExpression('invalid.scope');
        scopeEngine.resolve(ast, null, runtimeCtx);
      } catch (e) {
        // Expected error
      }
    }

    const duration = performance.now() - start;
    expect(duration).toBeLessThan(100); // <0.1ms per error
  });

  it('should clear error buffer efficiently', () => {
    const iterations = 100;
    
    for (let i = 0; i < iterations; i++) {
      errorHandler.clearErrorBuffer();
      
      // Add some errors
      errorHandler.handleError(
        new Error('Test error'),
        { depth: 0 },
        ErrorCategories.INVALID_DATA
      );
    }
    
    expect(errorHandler.getErrorBuffer()).toBeDefined();
  });
});
```

## Acceptance Criteria

- [ ] All integration tests pass
- [ ] Error codes correctly assigned  
- [ ] Error buffer populated properly
- [ ] Categories match expectations
- [ ] Performance requirements met
- [ ] Dev/prod behavior verified
- [ ] No memory leaks detected
- [ ] Backward compatibility maintained

## Testing Requirements

- Use real dependencies where possible
- Test with actual scope resolution
- Include edge cases and error paths
- Performance benchmarks included
- Memory usage monitored
- Test synchronous error handling (no async/await needed)

## Dependencies

- SCODSLERR-006: FilterResolver migration completed
- SCODSLERR-005: Container configuration

## Estimated Effort

- Test implementation: 4 hours
- Performance tests: 1 hour
- Documentation: 1 hour
- Total: 6 hours

## Risk Assessment

- **Low Risk**: Testing implementation
- **Consideration**: May reveal issues requiring resolver changes

## Related Spec Sections

- Section 5.2: Integration Tests
- Section 7.1: Success Metrics
- Section 5.3: Performance Tests

## Test Data Setup

```javascript
const createTestContext = () => ({
  actorEntity: { id: 'test-actor' },
  runtimeCtx: {
    entityManager: mockEntityManager,
    jsonLogicEval: mockJsonLogicEval,
    location: { id: 'location1' }
  }
});

const createInvalidContext = () => ({
  // Missing required actorEntity and runtimeCtx
});

const createTestActor = (id, components = {}) => ({
  id,
  components: {
    'core:actor': { type: 'player' },
    'core:position': { locationId: 'test-location' },
    ...components
  }
});

const createTestScope = (expression) => {
  return parseDslExpression(expression);
};
```

## Complete Test File Structure

```javascript
/**
 * @file Integration tests for filterResolver error handling
 * @description Tests the new error handling system in real-world scenarios
 */

import { jest } from '@jest/globals';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
// ... (imports as shown above)

describe('FilterResolver Error Handling Integration', () => {
  let errorHandler;
  let scopeEngine;
  let mockEntityManager;
  let mockJsonLogicEval;
  let mockLogger;

  beforeEach(() => {
    // Setup as shown above
  });

  afterEach(() => {
    errorHandler.clearErrorBuffer();
    jest.clearAllMocks();
  });

  // Test suites as shown above...
});
```
