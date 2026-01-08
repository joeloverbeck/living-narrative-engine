# ENTARCREDANA-004: Inline EntityCreationManager into EntityManager

## Summary

Move the two methods from `EntityCreationManager` directly into `EntityManager`, eliminating this thin delegation wrapper. The manager adds only logging and minimal validation before delegating to `EntityLifecycleManager`.

## Priority: Medium | Effort: Medium | Risk: Low

## Rationale

`EntityCreationManager` (100 lines) is 95% delegation:
- `createEntityInstance()`: Logs + delegates to `EntityLifecycleManager.createEntityInstance()`
- `reconstructEntity()`: Validates input type + logs + delegates to `EntityLifecycleManager.reconstructEntity()`

By inlining these methods, we remove an unnecessary abstraction layer while preserving all validation and logging behavior.

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/entities/entityManager.js` | **Modify** - Inline creation methods, remove manager instantiation |
| `tests/unit/entities/entityManager.lifecycle.test.js` | **Modify** - Verify inlined behavior |

## Out of Scope

- **DO NOT** delete `EntityCreationManager.js` - that's ENTARCREDANA-006
- **DO NOT** delete `EntityCreationManager.test.js` - that's ENTARCREDANA-006
- **DO NOT** modify `EntityMutationManager` - that's ENTARCREDANA-005
- **DO NOT** modify `EntityLifecycleManager` - logic stays there
- **DO NOT** modify `EntityQueryManager` - that one has actual logic and stays

## Implementation Details

### Step 1: Understand Current EntityCreationManager Methods

**Current `createEntityInstance` (EntityCreationManager lines 63-72):**
```javascript
async createEntityInstance(definitionId, opts = {}) {
  this.#logger.debug(`EntityCreationManager: Creating entity instance for definition '${definitionId}'`);
  return await this.#lifecycleManager.createEntityInstance(definitionId, opts);
}
```

**Current `reconstructEntity` (EntityCreationManager lines 87-99):**
```javascript
reconstructEntity(serializedEntity) {
  if (!serializedEntity || typeof serializedEntity !== 'object') {
    throw new Error('reconstructEntity requires a serialized entity object');
  }
  this.#logger.debug('EntityCreationManager: Reconstructing entity from serialized data');
  return this.#lifecycleManager.reconstructEntity(serializedEntity);
}
```

### Step 2: Modify EntityManager - Remove Creation Manager Instantiation

**File:** `src/entities/entityManager.js`

Find where `EntityCreationManager` is instantiated (around line 220-230) and remove:

**Before:**
```javascript
this.#creationManager = new EntityCreationManager({
  logger: this.#logger,
  lifecycleManager: this.#lifecycleManager,
});
```

**After:**
```javascript
// EntityCreationManager removed - methods inlined below
```

Remove the private field declaration:
```javascript
// Remove: #creationManager;
```

Remove the import:
```javascript
// Remove: import EntityCreationManager from './managers/EntityCreationManager.js';
```

### Step 3: Modify EntityManager - Inline createEntityInstance

Find the existing `createEntityInstance` method that delegates to the manager and replace:

**Before:**
```javascript
async createEntityInstance(definitionId, opts = {}) {
  return await this.#creationManager.createEntityInstance(definitionId, opts);
}
```

**After:**
```javascript
async createEntityInstance(definitionId, opts = {}) {
  this.#logger.debug(`Creating entity instance for definition '${definitionId}'`);
  return await this.#lifecycleManager.createEntityInstance(definitionId, opts);
}
```

### Step 4: Modify EntityManager - Inline reconstructEntity

Find the existing `reconstructEntity` method and replace:

**Before:**
```javascript
reconstructEntity(serializedEntity) {
  return this.#creationManager.reconstructEntity(serializedEntity);
}
```

**After:**
```javascript
reconstructEntity(serializedEntity) {
  if (!serializedEntity || typeof serializedEntity !== 'object') {
    throw new Error('reconstructEntity requires a serialized entity object');
  }
  this.#logger.debug('Reconstructing entity from serialized data');
  return this.#lifecycleManager.reconstructEntity(serializedEntity);
}
```

### Step 5: Update Tests

**File:** `tests/unit/entities/entityManager.lifecycle.test.js`

Add/update tests to verify the inlined behavior:

```javascript
describe('createEntityInstance (inlined from EntityCreationManager)', () => {
  it('should log debug message before delegating to lifecycleManager', async () => {
    const mockLogger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    const mockLifecycleManager = {
      createEntityInstance: jest.fn().mockResolvedValue({ id: 'entity-1' })
    };

    const manager = createTestEntityManager({
      logger: mockLogger,
      entityLifecycleManager: mockLifecycleManager
    });

    await manager.createEntityInstance('test:definition', { initialData: {} });

    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Creating entity instance')
    );
    expect(mockLifecycleManager.createEntityInstance).toHaveBeenCalledWith(
      'test:definition',
      { initialData: {} }
    );
  });
});

describe('reconstructEntity (inlined from EntityCreationManager)', () => {
  it('should throw if serializedEntity is not an object', () => {
    const manager = createTestEntityManager();

    expect(() => manager.reconstructEntity(null)).toThrow('requires a serialized entity object');
    expect(() => manager.reconstructEntity('string')).toThrow('requires a serialized entity object');
    expect(() => manager.reconstructEntity(undefined)).toThrow('requires a serialized entity object');
  });

  it('should log debug message before delegating to lifecycleManager', () => {
    const mockLogger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    const mockLifecycleManager = {
      reconstructEntity: jest.fn().mockReturnValue({ id: 'entity-1' })
    };

    const manager = createTestEntityManager({
      logger: mockLogger,
      entityLifecycleManager: mockLifecycleManager
    });

    manager.reconstructEntity({ id: 'entity-1', definitionId: 'test:def' });

    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Reconstructing entity')
    );
  });
});
```

## Acceptance Criteria

### Tests That Must Pass

- [ ] `npm run test:unit -- --testPathPattern="entityManager"` passes
- [ ] `npm run test:integration` passes
- [ ] `npm run test:ci` passes
- [ ] `npm run typecheck` passes

### Invariants That Must Remain True

1. **Identical Behavior**: `createEntityInstance` must behave identically (same validation, logging, delegation)
2. **Identical Behavior**: `reconstructEntity` must behave identically (same validation, logging, delegation)
3. **Validation Preserved**: `reconstructEntity` must still throw on invalid input
4. **Logging Preserved**: Debug logging must still occur for both methods
5. **EntityCreationManager Still Exists**: File not deleted yet (that's ENTARCREDANA-006)
6. **Existing Tests Pass**: All existing EntityManager tests must continue to pass

## Verification Steps

```bash
# Run EntityManager tests
npm run test:unit -- --testPathPattern="entityManager"

# Run all unit tests
npm run test:unit

# Run integration tests
npm run test:integration

# Run full test suite
npm run test:ci

# Type check
npm run typecheck

# Lint modified files
npx eslint src/entities/entityManager.js tests/unit/entities/entityManager.lifecycle.test.js
```

## Dependencies

- Can be done after ENTARCREDANA-003 or in parallel with Phase 1
- Independent of ENTARCREDANA-005

## Blocked By

- None (but recommended after Phase 1 completion)

## Blocks

- ENTARCREDANA-006 (file deletion)
