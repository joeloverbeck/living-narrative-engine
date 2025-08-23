# MOVLOCK-007: Unit Tests for Lock Movement Handler

**Status**: NOT_STARTED  
**Priority**: MEDIUM  
**Dependencies**: MOVLOCK-001  
**Estimated Effort**: 1.5 hours

## Context

Comprehensive unit tests are required for the LockMovementHandler to ensure it correctly locks movement for both legacy and anatomy-based entities. Tests must cover success cases, error handling, and edge cases with a target of 90%+ code coverage.

## Implementation Steps

### 1. Create Test File

**File**: `tests/unit/logic/operationHandlers/lockMovementHandler.test.js`

### 2. Test Structure Template

```javascript
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import LockMovementHandler from '../../../../src/logic/operationHandlers/lockMovementHandler.js';
import { updateMovementLock } from '../../../../src/utils/movementUtils.js';
import { safeDispatchError } from '../../../../src/utils/safeDispatchErrorUtils.js';

// Mock the dependencies
jest.mock('../../../../src/utils/movementUtils.js');
jest.mock('../../../../src/utils/safeDispatchErrorUtils.js');
jest.mock('../../../../src/utils/loggerUtils.js', () => ({
  ensureValidLogger: jest.fn(
    (logger) => logger || { debug: jest.fn(), error: jest.fn() }
  ),
}));

describe('LockMovementHandler', () => {
  let handler;
  let mockLogger;
  let mockEntityManager;
  let mockSafeEventDispatcher;
  let executionContext;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock logger
    mockLogger = {
      debug: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
    };

    // Setup mock entity manager
    mockEntityManager = {
      getComponentData: jest.fn(),
      addComponent: jest.fn(),
      updateComponent: jest.fn(),
    };

    // Setup mock event dispatcher
    mockSafeEventDispatcher = {
      dispatch: jest.fn(),
    };

    // Create handler instance
    handler = new LockMovementHandler({
      logger: mockLogger,
      entityManager: mockEntityManager,
      safeEventDispatcher: mockSafeEventDispatcher,
    });

    // Setup execution context
    executionContext = {
      logger: mockLogger,
    };
  });

  // Test cases go here...
});
```

### 3. Required Test Cases

#### 3.1 Constructor Tests

```javascript
describe('constructor', () => {
  it('should create instance with valid dependencies', () => {
    expect(handler).toBeInstanceOf(LockMovementHandler);
  });

  it('should validate entityManager dependency', () => {
    expect(() => {
      new LockMovementHandler({
        logger: mockLogger,
        entityManager: null,
        safeEventDispatcher: mockSafeEventDispatcher,
      });
    }).toThrow();
  });

  it('should validate safeEventDispatcher dependency', () => {
    expect(() => {
      new LockMovementHandler({
        logger: mockLogger,
        entityManager: mockEntityManager,
        safeEventDispatcher: null,
      });
    }).toThrow();
  });

  it('should handle missing logger gracefully', () => {
    const handlerWithoutLogger = new LockMovementHandler({
      logger: null,
      entityManager: mockEntityManager,
      safeEventDispatcher: mockSafeEventDispatcher,
    });
    expect(handlerWithoutLogger).toBeInstanceOf(LockMovementHandler);
  });
});
```

#### 3.2 Execute Method - Success Cases

```javascript
describe('execute - success cases', () => {
  it('should successfully lock movement for valid actor_id', async () => {
    const params = { actor_id: 'test-actor-123' };

    await handler.execute(params, executionContext);

    expect(updateMovementLock).toHaveBeenCalledWith(
      mockEntityManager,
      'test-actor-123',
      true
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      '[LockMovementHandler] Successfully locked movement for entity: test-actor-123'
    );
    expect(safeDispatchError).not.toHaveBeenCalled();
  });

  it('should handle different actor_id formats', async () => {
    const params = { actor_id: 'core:actor:player' };

    await handler.execute(params, executionContext);

    expect(updateMovementLock).toHaveBeenCalledWith(
      mockEntityManager,
      'core:actor:player',
      true
    );
  });
});
```

#### 3.3 Execute Method - Error Cases

```javascript
describe('execute - error cases', () => {
  it('should dispatch error when actor_id is missing', async () => {
    const params = {};

    await handler.execute(params, executionContext);

    expect(safeDispatchError).toHaveBeenCalledWith(
      mockSafeEventDispatcher,
      'LOCK_MOVEMENT: missing actor_id parameter',
      { params },
      mockLogger
    );
    expect(updateMovementLock).not.toHaveBeenCalled();
  });

  it('should dispatch error when actor_id is null', async () => {
    const params = { actor_id: null };

    await handler.execute(params, executionContext);

    expect(safeDispatchError).toHaveBeenCalled();
    expect(updateMovementLock).not.toHaveBeenCalled();
  });

  it('should dispatch error when actor_id is undefined', async () => {
    const params = { actor_id: undefined };

    await handler.execute(params, executionContext);

    expect(safeDispatchError).toHaveBeenCalled();
    expect(updateMovementLock).not.toHaveBeenCalled();
  });

  it('should handle and dispatch error when updateMovementLock throws', async () => {
    const params = { actor_id: 'test-actor' };
    const testError = new Error('Failed to update movement lock');
    updateMovementLock.mockRejectedValue(testError);

    await handler.execute(params, executionContext);

    expect(safeDispatchError).toHaveBeenCalledWith(
      mockSafeEventDispatcher,
      'LOCK_MOVEMENT: failed to lock movement for entity test-actor',
      { actor_id: 'test-actor', error: 'Failed to update movement lock' },
      mockLogger
    );
  });

  it('should handle when params is null', async () => {
    await handler.execute(null, executionContext);

    expect(safeDispatchError).toHaveBeenCalled();
    expect(updateMovementLock).not.toHaveBeenCalled();
  });

  it('should handle when params is undefined', async () => {
    await handler.execute(undefined, executionContext);

    expect(safeDispatchError).toHaveBeenCalled();
    expect(updateMovementLock).not.toHaveBeenCalled();
  });
});
```

#### 3.4 Integration with Base Class

```javascript
describe('BaseOperationHandler integration', () => {
  it('should properly extend BaseOperationHandler', () => {
    expect(handler.execute).toBeDefined();
    expect(typeof handler.execute).toBe('function');
  });

  it('should use logger from execution context', async () => {
    const contextLogger = {
      debug: jest.fn(),
      error: jest.fn(),
    };
    const customContext = { logger: contextLogger };
    const params = { actor_id: 'test-actor' };

    await handler.execute(params, customContext);

    expect(contextLogger.debug).toHaveBeenCalled();
  });
});
```

### 4. Implementation Checklist

- [ ] Create test file in correct location
- [ ] Import handler and dependencies
- [ ] Mock all external dependencies
- [ ] Setup beforeEach for test isolation
- [ ] Test constructor validation
- [ ] Test successful execution
- [ ] Test missing actor_id parameter
- [ ] Test null/undefined actor_id
- [ ] Test error handling from updateMovementLock
- [ ] Test null/undefined params object
- [ ] Test logger usage
- [ ] Verify all mocks are called correctly
- [ ] Achieve 90%+ code coverage

## Validation Criteria

1. **All tests pass**: `npm run test:unit tests/unit/logic/operationHandlers/lockMovementHandler.test.js`
2. **Code coverage**: Achieve 90%+ line and branch coverage
3. **Mock verification**: All mock calls verified with correct parameters
4. **Error scenarios**: All error paths tested
5. **Edge cases**: Null, undefined, and empty values handled

## Testing Requirements

Run tests with:

```bash
# Run specific test file
npm run test:unit tests/unit/logic/operationHandlers/lockMovementHandler.test.js

# Run with coverage
npm run test:unit -- --coverage tests/unit/logic/operationHandlers/lockMovementHandler.test.js

# Run all unit tests to ensure no regressions
npm run test:unit
```

## Notes

- Use Jest's mock system to isolate the handler from its dependencies
- The updateMovementLock utility is mocked - we're not testing its implementation
- Test both async success and error paths
- Ensure mocks are reset between tests to avoid test pollution
- Follow the project's existing test patterns (check similar handler tests)

## References

- Handler implementation: `src/logic/operationHandlers/lockMovementHandler.js`
- Similar test examples:
  - `tests/unit/logic/operationHandlers/mergeClosenessCircleHandler.test.js`
  - `tests/unit/logic/operationHandlers/removeFromClosenessCircleHandler.test.js`
- Test utilities: `tests/common/testbed.js`
