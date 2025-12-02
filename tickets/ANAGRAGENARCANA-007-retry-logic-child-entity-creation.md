# ANAGRAGENARCANA-007: Add Retry Logic to Child Entity Creation

## Metadata
- **ID**: ANAGRAGENARCANA-007
- **Priority**: MEDIUM
- **Severity**: P7
- **Effort**: Low
- **Source**: `reports/anatomy-graph-generation-architecture-analysis.md` - R7
- **Related Issue**: HIGH-02 (No Root Entity Retry for Child Entities)

---

## Problem Statement

Root entity creation has exponential backoff retry logic (max 5 retries) to handle transient failures, but child entity creation has no such protection. This inconsistency means that if the entity manager is slow or temporarily unavailable during graph construction, child entities might fail while the root succeeds, leading to incomplete anatomy graphs.

### Current Implementation

```javascript
// src/anatomy/entityGraphBuilder.js

// Root entity - HAS retry logic (lines 141-157)
async createRootEntity(rootDefinitionId, recipe, ownerId, componentOverrides) {
  let attempt = 0;
  const maxAttempts = 5;

  while (attempt < maxAttempts) {
    try {
      return await this.#entityManager.createEntity(/* ... */);
    } catch (err) {
      attempt++;
      if (attempt >= maxAttempts) throw err;
      await this.#delay(Math.pow(2, attempt) * 100); // Exponential backoff
    }
  }
}

// Child entity - NO retry logic
async createAndAttachPart(parentId, socketId, partDefId, componentOverrides, ownerId) {
  // Direct call, no retry
  return this.#entityManager.createEntity(/* ... */);
}
```

---

## Affected Files

| File | Line(s) | Change Type |
|------|---------|-------------|
| `src/anatomy/entityGraphBuilder.js` | `createAndAttachPart` method | Add retry logic |

---

## Implementation Steps

### Step 1: Extract Retry Logic into Reusable Helper

Create a private method for retry logic:

```javascript
/**
 * Executes an async operation with exponential backoff retry.
 *
 * @param {Function} operation - Async function to execute
 * @param {Object} options - Retry options
 * @param {number} options.maxAttempts - Maximum number of attempts (default: 5)
 * @param {number} options.baseDelayMs - Base delay in milliseconds (default: 100)
 * @param {string} options.operationName - Name for logging purposes
 * @returns {Promise<*>} Result of the operation
 * @throws {Error} If all attempts fail
 */
async #executeWithRetry(operation, options = {}) {
  const {
    maxAttempts = 5,
    baseDelayMs = 100,
    operationName = 'operation'
  } = options;

  let attempt = 0;

  while (attempt < maxAttempts) {
    try {
      return await operation();
    } catch (err) {
      attempt++;

      if (attempt >= maxAttempts) {
        this.#logger.error(
          `${operationName} failed after ${maxAttempts} attempts`,
          { error: err.message }
        );
        throw err;
      }

      const delayMs = Math.pow(2, attempt) * baseDelayMs;
      this.#logger.warn(
        `${operationName} attempt ${attempt} failed, retrying in ${delayMs}ms`,
        { error: err.message }
      );

      await this.#delay(delayMs);
    }
  }
}

/**
 * Delays execution for specified milliseconds.
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise<void>}
 */
#delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

### Step 2: Apply Retry to createAndAttachPart

Update the child entity creation method to use retry:

```javascript
/**
 * Creates a child entity and attaches it to a parent via a socket.
 *
 * @param {string} parentId - Parent entity ID
 * @param {string} socketId - Socket to attach to
 * @param {string} partDefId - Entity definition ID for the part
 * @param {Object} componentOverrides - Component overrides to apply
 * @param {string} ownerId - Owner of the anatomy graph
 * @returns {Promise<string>} Created entity ID
 */
async createAndAttachPart(parentId, socketId, partDefId, componentOverrides, ownerId) {
  return this.#executeWithRetry(
    async () => {
      const entityId = await this.#entityManager.createEntity({
        definitionId: partDefId,
        componentOverrides,
        ownerId
      });

      await this.#socketManager.attachToSocket(parentId, socketId, entityId);

      return entityId;
    },
    {
      maxAttempts: 5,
      baseDelayMs: 100,
      operationName: `createAndAttachPart(${partDefId} -> ${parentId}:${socketId})`
    }
  );
}
```

### Step 3: Refactor createRootEntity to Use Helper

Update root entity creation to use the same helper:

```javascript
async createRootEntity(rootDefinitionId, recipe, ownerId, componentOverrides) {
  return this.#executeWithRetry(
    async () => {
      return this.#entityManager.createEntity({
        definitionId: rootDefinitionId,
        componentOverrides,
        ownerId,
        // ... other root-specific options
      });
    },
    {
      maxAttempts: 5,
      baseDelayMs: 100,
      operationName: `createRootEntity(${rootDefinitionId})`
    }
  );
}
```

### Step 4: Add Configuration Option (Optional Enhancement)

Allow retry configuration via constructor:

```javascript
class EntityGraphBuilder {
  #retryConfig;

  constructor({ entityManager, socketManager, logger, retryConfig = {} }) {
    this.#entityManager = entityManager;
    this.#socketManager = socketManager;
    this.#logger = logger;
    this.#retryConfig = {
      maxAttempts: retryConfig.maxAttempts ?? 5,
      baseDelayMs: retryConfig.baseDelayMs ?? 100
    };
  }
}
```

---

## Testing Requirements

### Unit Tests

Create/update tests in `tests/unit/anatomy/entityGraphBuilder.test.js`:

1. **Test: Should retry child entity creation on transient failure**
```javascript
it('should retry createAndAttachPart on transient failure', async () => {
  const mockEntityManager = {
    createEntity: jest.fn()
      .mockRejectedValueOnce(new Error('Transient error'))
      .mockRejectedValueOnce(new Error('Transient error'))
      .mockResolvedValueOnce('entity-123')
  };

  const builder = new EntityGraphBuilder({
    entityManager: mockEntityManager,
    socketManager: mockSocketManager,
    logger: mockLogger
  });

  const result = await builder.createAndAttachPart(
    'parent-1', 'socket-a', 'def:arm', {}, 'owner-1'
  );

  expect(result).toBe('entity-123');
  expect(mockEntityManager.createEntity).toHaveBeenCalledTimes(3);
});
```

2. **Test: Should throw after max attempts exhausted**
```javascript
it('should throw after 5 failed attempts', async () => {
  const mockEntityManager = {
    createEntity: jest.fn().mockRejectedValue(new Error('Persistent error'))
  };

  const builder = new EntityGraphBuilder({
    entityManager: mockEntityManager,
    socketManager: mockSocketManager,
    logger: mockLogger
  });

  await expect(
    builder.createAndAttachPart('parent-1', 'socket-a', 'def:arm', {}, 'owner-1')
  ).rejects.toThrow('Persistent error');

  expect(mockEntityManager.createEntity).toHaveBeenCalledTimes(5);
});
```

3. **Test: Should log retry attempts**
```javascript
it('should log warning on retry attempts', async () => {
  const mockLogger = { warn: jest.fn(), error: jest.fn() };
  const mockEntityManager = {
    createEntity: jest.fn()
      .mockRejectedValueOnce(new Error('Transient'))
      .mockResolvedValueOnce('entity-123')
  };

  const builder = new EntityGraphBuilder({
    entityManager: mockEntityManager,
    socketManager: mockSocketManager,
    logger: mockLogger
  });

  await builder.createAndAttachPart('parent', 'socket', 'def', {}, 'owner');

  expect(mockLogger.warn).toHaveBeenCalledWith(
    expect.stringContaining('attempt 1 failed'),
    expect.any(Object)
  );
});
```

4. **Test: Exponential backoff timing**
```javascript
it('should use exponential backoff between retries', async () => {
  jest.useFakeTimers();

  const mockEntityManager = {
    createEntity: jest.fn()
      .mockRejectedValueOnce(new Error('Error 1'))
      .mockRejectedValueOnce(new Error('Error 2'))
      .mockResolvedValueOnce('entity-123')
  };

  const builder = new EntityGraphBuilder({ /* deps */ });

  const promise = builder.createAndAttachPart('p', 's', 'd', {}, 'o');

  // First retry after 200ms (2^1 * 100)
  await jest.advanceTimersByTimeAsync(200);
  // Second retry after 400ms (2^2 * 100)
  await jest.advanceTimersByTimeAsync(400);

  const result = await promise;
  expect(result).toBe('entity-123');

  jest.useRealTimers();
});
```

### Integration Tests

1. **Test: Complex anatomy graph creation with simulated transient failures**
   - Mock entity manager to fail occasionally
   - Verify complete graph still created successfully
   - Verify all retries logged appropriately

---

## Acceptance Criteria

- [ ] `#executeWithRetry` helper method implemented
- [ ] `createAndAttachPart` uses retry logic
- [ ] `createRootEntity` refactored to use same helper
- [ ] Exponential backoff implemented (2^attempt * baseDelay)
- [ ] Max attempts configurable (default: 5)
- [ ] Retry attempts logged as warnings
- [ ] Final failure logged as error
- [ ] Operation name included in logs for debugging
- [ ] Unit tests cover retry, success, and max-attempts scenarios
- [ ] All existing tests pass

---

## Dependencies

- None (can be implemented independently)

---

## Notes

- This improves reliability in environments with transient failures
- Consider making retry configurable via DI for testing purposes
- The delay helper may already exist - check for existing implementation
- Exponential backoff prevents overwhelming a recovering service
- Consider adding jitter to backoff for high-concurrency scenarios (future enhancement)
