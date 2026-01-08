# ENTARCREDANA-001: Add LocationQueryService to EntityManager

## Summary

Add `LocationQueryService` as a dependency to `EntityManager` and implement the `getEntitiesInLocation(locationId)` method directly. This is the only unique functionality that `EntityManagerAdapter` provides beyond pure delegation.

## Priority: High | Effort: Low | Risk: Low

## Rationale

The `EntityManagerAdapter` wraps `EntityManager` with 23 methods, but 22 of them are pure delegation (96% redundant). The single unique method is `getEntitiesInLocation()`, which delegates to `LocationQueryService`. By adding this service directly to `EntityManager`, we enable the adapter's elimination in subsequent tickets.

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/entities/entityManager.js` | **Modify** - Add locationQueryService dependency and method |
| `tests/unit/entities/entityManager.lifecycle.test.js` | **Modify** - Add tests for new method |

## Out of Scope

- **DO NOT** modify `EntityManagerAdapter` - that's ENTARCREDANA-003
- **DO NOT** change DI registrations - that's ENTARCREDANA-002
- **DO NOT** delete any files - that's ENTARCREDANA-003
- **DO NOT** modify `EntityCreationManager` or `EntityMutationManager` - that's ENTARCREDANA-004/005
- **DO NOT** modify `IEntityManager` interface - method already defined there

## Implementation Details

### Step 1: Modify EntityManager Constructor

**File:** `src/entities/entityManager.js`

Add `locationQueryService` to the constructor parameters (around line 160-176):

```javascript
constructor({
  registry,
  validator,
  logger,
  dispatcher,
  idGenerator,
  idGeneratorFactory,
  cloner,
  clonerFactory,
  defaultPolicy,
  defaultPolicyFactory,
  entityRepository,
  componentMutationService,
  definitionCache,
  entityLifecycleManager,
  monitoringCoordinator,
  batchOperationManager,
  locationQueryService, // NEW - add this parameter
}) {
  // ... existing validation ...

  // Store locationQueryService (add after other private field assignments)
  this.#locationQueryService = locationQueryService;
}
```

### Step 2: Add Private Field

Add the private field declaration near other private fields (around line 80-100):

```javascript
#locationQueryService;
```

### Step 3: Implement getEntitiesInLocation Method

Add the method implementation (near other query methods, around line 400-500):

```javascript
/**
 * Gets all entity instance IDs in a specific location.
 * @param {string} locationId - The location entity ID
 * @returns {Set<string>} Set of entity instance IDs in the location
 */
getEntitiesInLocation(locationId) {
  if (!this.#locationQueryService) {
    return new Set();
  }
  return this.#locationQueryService.getEntitiesInLocation(locationId);
}
```

**Note:** The method returns an empty Set if `locationQueryService` is not provided, maintaining backward compatibility with existing tests that don't provide this dependency.

### Step 4: Add Unit Tests

**File:** `tests/unit/entities/entityManager.lifecycle.test.js`

Add a new describe block for the location query functionality:

```javascript
describe('getEntitiesInLocation', () => {
  it('should delegate to locationQueryService when provided', () => {
    const mockLocationQueryService = {
      getEntitiesInLocation: jest.fn().mockReturnValue(new Set(['entity-1', 'entity-2']))
    };

    const manager = new EntityManager({
      // ... required deps ...
      locationQueryService: mockLocationQueryService
    });

    const result = manager.getEntitiesInLocation('location-123');

    expect(mockLocationQueryService.getEntitiesInLocation).toHaveBeenCalledWith('location-123');
    expect(result).toEqual(new Set(['entity-1', 'entity-2']));
  });

  it('should return empty Set when locationQueryService not provided', () => {
    const manager = new EntityManager({
      // ... required deps without locationQueryService ...
    });

    const result = manager.getEntitiesInLocation('location-123');

    expect(result).toEqual(new Set());
  });
});
```

## Acceptance Criteria

### Tests That Must Pass

- [ ] `npm run test:unit -- --testPathPattern="entityManager.lifecycle"` passes
- [ ] `npm run test:unit -- --testPathPattern="entityManager"` passes (all EntityManager tests)
- [ ] `npm run test:integration` passes (no regressions)
- [ ] `npm run typecheck` passes

### Invariants That Must Remain True

1. **Backward Compatibility**: EntityManager must still work without locationQueryService (tests that don't provide it must pass)
2. **API Contract**: The `getEntitiesInLocation` method must match the signature defined in `IEntityManager` interface
3. **No Side Effects**: Adding this dependency must not change behavior of any other EntityManager methods
4. **Optional Dependency**: locationQueryService must be optional in constructor (not validated as required)

## Verification Steps

```bash
# Run specific tests
npm run test:unit -- --testPathPattern="entityManager.lifecycle"

# Run all EntityManager tests
npm run test:unit -- --testPathPattern="entityManager"

# Run full test suite to catch regressions
npm run test:ci

# Type check
npm run typecheck

# Lint modified files
npx eslint src/entities/entityManager.js tests/unit/entities/entityManager.lifecycle.test.js
```

## Dependencies

- None (this is the first ticket in the sequence)

## Blocked By

- None

## Blocks

- ENTARCREDANA-002 (DI registration update)
- ENTARCREDANA-003 (adapter deletion)
