# MOVLOCK-008: Unit Tests for Unlock Movement Handler

**Status**: NOT_STARTED  
**Priority**: MEDIUM  
**Dependencies**: MOVLOCK-002, MOVLOCK-007  
**Estimated Effort**: 1 hour

## Context

Unit tests for the UnlockMovementHandler follow the same structure as the LockMovementHandler tests but verify the unlock operation. The tests ensure proper movement unlocking and error handling with 90%+ code coverage.

## Implementation Steps

### 1. Create Test File

**File**: `tests/unit/logic/operationHandlers/unlockMovementHandler.test.js`

### 2. Test Structure Template

```javascript
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import UnlockMovementHandler from '../../../../src/logic/operationHandlers/unlockMovementHandler.js';
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

describe('UnlockMovementHandler', () => {
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
    handler = new UnlockMovementHandler({
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
    expect(handler).toBeInstanceOf(UnlockMovementHandler);
  });

  it('should validate entityManager dependency', () => {
    expect(() => {
      new UnlockMovementHandler({
        logger: mockLogger,
        entityManager: null,
        safeEventDispatcher: mockSafeEventDispatcher,
      });
    }).toThrow();
  });

  it('should validate safeEventDispatcher dependency', () => {
    expect(() => {
      new UnlockMovementHandler({
        logger: mockLogger,
        entityManager: mockEntityManager,
        safeEventDispatcher: null,
      });
    }).toThrow();
  });

  it('should handle missing logger gracefully', () => {
    const handlerWithoutLogger = new UnlockMovementHandler({
      logger: null,
      entityManager: mockEntityManager,
      safeEventDispatcher: mockSafeEventDispatcher,
    });
    expect(handlerWithoutLogger).toBeInstanceOf(UnlockMovementHandler);
  });
});
```

#### 3.2 Execute Method - Success Cases

```javascript
describe('execute - success cases', () => {
  it('should successfully unlock movement for valid actor_id', async () => {
    const params = { actor_id: 'test-actor-123' };

    await handler.execute(params, executionContext);

    expect(updateMovementLock).toHaveBeenCalledWith(
      mockEntityManager,
      'test-actor-123',
      false // Note: false for unlocking
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      '[UnlockMovementHandler] Successfully unlocked movement for entity: test-actor-123'
    );
    expect(safeDispatchError).not.toHaveBeenCalled();
  });

  it('should handle different actor_id formats', async () => {
    const params = { actor_id: 'core:actor:player' };

    await handler.execute(params, executionContext);

    expect(updateMovementLock).toHaveBeenCalledWith(
      mockEntityManager,
      'core:actor:player',
      false
    );
  });

  it('should be idempotent - unlocking already unlocked entity', async () => {
    const params = { actor_id: 'already-unlocked-actor' };

    await handler.execute(params, executionContext);

    expect(updateMovementLock).toHaveBeenCalledWith(
      mockEntityManager,
      'already-unlocked-actor',
      false
    );
    expect(safeDispatchError).not.toHaveBeenCalled();
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
      'UNLOCK_MOVEMENT: missing actor_id parameter',
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
      'UNLOCK_MOVEMENT: failed to unlock movement for entity test-actor',
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

#### 3.4 Unlock-Specific Edge Cases

```javascript
describe('unlock-specific behaviors', () => {
  it('should handle unlocking entity that was never locked', async () => {
    const params = { actor_id: 'never-locked-actor' };

    await handler.execute(params, executionContext);

    expect(updateMovementLock).toHaveBeenCalledWith(
      mockEntityManager,
      'never-locked-actor',
      false
    );
    // Should not error - idempotent operation
    expect(safeDispatchError).not.toHaveBeenCalled();
  });

  it('should unlock movement regardless of current state', async () => {
    const params = { actor_id: 'any-state-actor' };

    await handler.execute(params, executionContext);

    expect(updateMovementLock).toHaveBeenCalledWith(
      mockEntityManager,
      'any-state-actor',
      false
    );
  });
});
```

### 4. Implementation Checklist

- [ ] Create test file in correct location
- [ ] Copy structure from lockMovementHandler tests
- [ ] Update class name to UnlockMovementHandler
- [ ] Update error messages to use 'UNLOCK_MOVEMENT'
- [ ] Update success messages to say "unlocked"
- [ ] Verify updateMovementLock called with false parameter
- [ ] Test idempotent behavior
- [ ] Test all error scenarios
- [ ] Run tests and verify coverage

## Validation Criteria

1. **All tests pass**: Green test suite
2. **Code coverage**: 90%+ line and branch coverage
3. **Correct unlock parameter**: updateMovementLock called with `false`
4. **Error messages**: Use 'UNLOCK_MOVEMENT' prefix
5. **Idempotent**: Unlocking already unlocked entities doesn't error

## Testing Requirements

Run tests with:

```bash
# Run specific test file
npm run test:unit tests/unit/logic/operationHandlers/unlockMovementHandler.test.js

# Run with coverage
npm run test:unit -- --coverage tests/unit/logic/operationHandlers/unlockMovementHandler.test.js

# Run both handler tests together
npm run test:unit tests/unit/logic/operationHandlers/*MovementHandler.test.js
```

## Key Differences from Lock Handler Tests

1. **Operation name**: 'UNLOCK_MOVEMENT' instead of 'LOCK_MOVEMENT'
2. **Lock parameter**: `false` instead of `true` in updateMovementLock calls
3. **Debug messages**: "unlocked" instead of "locked"
4. **Class name**: UnlockMovementHandler throughout
5. **Idempotent focus**: Emphasize that unlocking is safe to repeat

## Notes

- Most of the test structure can be copied from MOVLOCK-007
- Pay attention to changing all references from lock to unlock
- The idempotent nature of unlock is important - it should never error on already unlocked entities
- Maintain consistent test patterns with the lock handler tests

## References

- Handler implementation: `src/logic/operationHandlers/unlockMovementHandler.js`
- Lock handler tests: `tests/unit/logic/operationHandlers/lockMovementHandler.test.js`
- Test utilities: `tests/common/testbed.js`
- Mock patterns: Follow project's existing mock usage
