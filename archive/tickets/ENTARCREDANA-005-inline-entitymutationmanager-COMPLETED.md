# ENTARCREDANA-005: Inline EntityMutationManager into EntityManager

## Status: ✅ COMPLETED (2026-01-08)

## Summary

Move the three methods from `EntityMutationManager` directly into `EntityManager`, eliminating this thin delegation wrapper. The manager adds only validation and logging before delegating to `ComponentMutationService` and `EntityLifecycleManager`.

## Priority: Medium | Effort: Medium | Risk: Low

## Rationale

`EntityMutationManager` (145 lines) is 90% delegation:
- `addComponent()`: Validates parameters + logs + delegates to `ComponentMutationService.addComponent()`
- `removeComponent()`: Validates parameters + logs + delegates to `ComponentMutationService.removeComponent()`
- `removeEntityInstance()`: Logs + delegates to `EntityLifecycleManager.removeEntityInstance()`

By inlining these methods, we remove an unnecessary abstraction layer while preserving all validation and logging behavior.

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/entities/entityManager.js` | **Modify** - Inline mutation methods, remove manager instantiation |
| `tests/unit/entities/entityManager.addComponent.test.js` | **Modify** - Verify inlined behavior |
| `tests/unit/entities/entityManager.removeComponent.test.js` | **Modify** - Verify inlined behavior |

## Out of Scope

- **DO NOT** delete `EntityMutationManager.js` - that's ENTARCREDANA-006
- **DO NOT** delete `EntityMutationManager.test.js` - that's ENTARCREDANA-006
- **DO NOT** modify `EntityCreationManager` - that's ENTARCREDANA-004
- **DO NOT** modify `ComponentMutationService` - logic stays there
- **DO NOT** modify `EntityLifecycleManager` - logic stays there
- **DO NOT** modify `EntityQueryManager` - that one has actual logic and stays

## Implementation Details

### Step 1: Understand Current EntityMutationManager Methods

**Current `addComponent` (EntityMutationManager lines 74-98):**
```javascript
async addComponent(instanceId, componentTypeId, componentData) {
  // Validate instanceId and componentTypeId
  validateInstanceAndComponent(
    instanceId,
    componentTypeId,
    this.#logger,
    'EntityMutationManager.addComponent'
  );

  if (!componentData || typeof componentData !== 'object') {
    throw new InvalidArgumentError(
      'EntityMutationManager.addComponent: componentData must be an object.'
    );
  }

  this.#logger.debug(
    `EntityMutationManager.addComponent: Adding component '${componentTypeId}' to entity '${instanceId}'`
  );

  return await this.#componentMutationService.addComponent(
    instanceId,
    componentTypeId,
    componentData
  );
}
```

**Current `removeComponent` (EntityMutationManager lines 110-127):**
```javascript
async removeComponent(instanceId, componentTypeId) {
  // Validate instanceId and componentTypeId
  validateInstanceAndComponent(
    instanceId,
    componentTypeId,
    this.#logger,
    'EntityMutationManager.removeComponent'
  );

  this.#logger.debug(
    `EntityMutationManager.removeComponent: Removing component '${componentTypeId}' from entity '${instanceId}'`
  );

  await this.#componentMutationService.removeComponent(
    instanceId,
    componentTypeId
  );
}
```

**Current `removeEntityInstance` (EntityMutationManager lines 137-143):**
```javascript
async removeEntityInstance(instanceId) {
  this.#logger.debug(
    `EntityMutationManager.removeEntityInstance: Removing entity '${instanceId}'`
  );

  return await this.#lifecycleManager.removeEntityInstance(instanceId);
}
```

### Step 2: Check for validateInstanceAndComponent Utility

The manager uses `validateInstanceAndComponent` from a utility file. Find its location:

```bash
grep -r "validateInstanceAndComponent" src/ --include="*.js"
```

This utility should remain in place and be imported by EntityManager.

### Step 3: Modify EntityManager - Remove Mutation Manager Instantiation

**File:** `src/entities/entityManager.js`

Find where `EntityMutationManager` is instantiated and remove:

**Before:**
```javascript
this.#mutationManager = new EntityMutationManager({
  logger: this.#logger,
  componentMutationService: this.#componentMutationService,
  lifecycleManager: this.#lifecycleManager,
});
```

**After:**
```javascript
// EntityMutationManager removed - methods inlined below
```

Remove the private field declaration:
```javascript
// Remove: #mutationManager;
```

Remove the import:
```javascript
// Remove: import EntityMutationManager from './managers/EntityMutationManager.js';
```

Add import for validation utility (if not already present):
```javascript
import { validateInstanceAndComponent } from './utils/validationUtils.js';
// Or wherever the utility is located
```

### Step 4: Modify EntityManager - Inline addComponent

Find the existing `addComponent` method and replace:

**Before:**
```javascript
async addComponent(instanceId, componentTypeId, componentData) {
  return await this.#mutationManager.addComponent(instanceId, componentTypeId, componentData);
}
```

**After:**
```javascript
async addComponent(instanceId, componentTypeId, componentData) {
  validateInstanceAndComponent(
    instanceId,
    componentTypeId,
    this.#logger,
    'EntityManager.addComponent'
  );

  if (!componentData || typeof componentData !== 'object') {
    throw new InvalidArgumentError(
      'EntityManager.addComponent: componentData must be an object.'
    );
  }

  this.#logger.debug(
    `EntityManager.addComponent: Adding component '${componentTypeId}' to entity '${instanceId}'`
  );

  return await this.#componentMutationService.addComponent(
    instanceId,
    componentTypeId,
    componentData
  );
}
```

### Step 5: Modify EntityManager - Inline removeComponent

Find the existing `removeComponent` method and replace:

**Before:**
```javascript
async removeComponent(instanceId, componentTypeId) {
  return await this.#mutationManager.removeComponent(instanceId, componentTypeId);
}
```

**After:**
```javascript
async removeComponent(instanceId, componentTypeId) {
  validateInstanceAndComponent(
    instanceId,
    componentTypeId,
    this.#logger,
    'EntityManager.removeComponent'
  );

  this.#logger.debug(
    `EntityManager.removeComponent: Removing component '${componentTypeId}' from entity '${instanceId}'`
  );

  await this.#componentMutationService.removeComponent(
    instanceId,
    componentTypeId
  );
}
```

### Step 6: Modify EntityManager - Inline removeEntityInstance

Find the existing `removeEntityInstance` method and replace:

**Before:**
```javascript
async removeEntityInstance(instanceId) {
  return await this.#mutationManager.removeEntityInstance(instanceId);
}
```

**After:**
```javascript
async removeEntityInstance(instanceId) {
  this.#logger.debug(
    `EntityManager.removeEntityInstance: Removing entity '${instanceId}'`
  );

  return await this.#lifecycleManager.removeEntityInstance(instanceId);
}
```

### Step 7: Verify Existing Tests

**Note:** The existing test suites already comprehensively cover the inlined behavior. No new tests are needed.

**File:** `tests/unit/entities/entityManager.addComponent.test.js`
- ✅ Already tests invalid instanceId/componentTypeId via `runInvalidIdPairTests`
- ✅ Already tests null componentData rejection (line 164-176)
- ✅ Already tests non-object componentData rejection (line 178-198)
- ✅ Already tests EntityNotFoundError (line 127-136)
- ✅ Already tests ValidationError (line 138-162)
- ✅ Already tests event dispatching

**File:** `tests/unit/entities/entityManager.removeComponent.test.js`
- ✅ Already tests invalid instanceId/componentTypeId via `runInvalidIdPairTests`
- ✅ Already tests EntityNotFoundError (line 81-91)
- ✅ Already tests idempotent behavior (line 63-79)
- ✅ Already tests event dispatching

## Acceptance Criteria

### Tests That Must Pass

- [ ] `npm run test:unit -- --testPathPattern="entityManager.addComponent"` passes
- [ ] `npm run test:unit -- --testPathPattern="entityManager.removeComponent"` passes
- [ ] `npm run test:unit -- --testPathPattern="entityManager"` passes (all)
- [ ] `npm run test:integration` passes
- [ ] `npm run test:ci` passes
- [ ] `npm run typecheck` passes

### Invariants That Must Remain True

1. **Identical Behavior**: `addComponent` must behave identically (same validation, logging, delegation)
2. **Identical Behavior**: `removeComponent` must behave identically (same validation, logging, delegation)
3. **Identical Behavior**: `removeEntityInstance` must behave identically (same logging, delegation)
4. **Validation Preserved**: All parameter validation must still occur
5. **Error Messages Preserved**: Error messages must match existing format
6. **Logging Preserved**: Debug logging must still occur for all methods
7. **EntityMutationManager Still Exists**: File not deleted yet (that's ENTARCREDANA-006)

## Verification Steps

```bash
# Run specific tests
npm run test:unit -- --testPathPattern="entityManager.addComponent"
npm run test:unit -- --testPathPattern="entityManager.removeComponent"

# Run all EntityManager tests
npm run test:unit -- --testPathPattern="entityManager"

# Run integration tests
npm run test:integration

# Run full test suite
npm run test:ci

# Type check
npm run typecheck

# Lint modified files
npx eslint src/entities/entityManager.js \
  tests/unit/entities/entityManager.addComponent.test.js \
  tests/unit/entities/entityManager.removeComponent.test.js
```

## Dependencies

- Can be done in parallel with ENTARCREDANA-004
- Independent of Phase 1 (but recommended after)

## Blocked By

- None (but recommended after Phase 1 completion)

## Blocks

- ENTARCREDANA-006 (file deletion)

---

## Outcome

### What Was Actually Changed vs. Originally Planned

**Ticket Corrections Made (Prior to Implementation):**
The ticket's code snippets were corrected to match actual implementation:
- Validation logic: Changed from allowing null (`componentData !== null && typeof componentData !== 'object'`) to rejecting null (`!componentData || typeof componentData !== 'object'`)
- Error type: Changed from generic `new Error()` to `InvalidArgumentError`
- Import path: Corrected to `src/utils/idValidation.js` (not `validationUtils.js`)

**Implementation Changes:**
| Planned | Actual |
|---------|--------|
| Modify `entityManager.js` | ✅ Done - inlined 3 methods, removed `#mutationManager` field |
| Modify test files | ❌ Not needed - existing tests already comprehensive |
| Add `validateInstanceAndComponent` import | ✅ Done |
| Add `InvalidArgumentError` import | ✅ Done |
| Remove `EntityMutationManager` import | ✅ Done |
| Keep `EntityMutationManager.js` file | ✅ Done - file preserved for ENTARCREDANA-006 |

**Test Results:**
- All 179 EntityManager unit tests: ✅ PASS
- All 1615 entity-related tests: ✅ PASS
- Integration tests: ✅ PASS
- Typecheck: Pre-existing unrelated errors only
- ESLint: Pre-existing unrelated warnings only

**No New Tests Added:**
The existing test suites already comprehensively cover all inlined behavior including:
- Invalid ID validation via `runInvalidIdPairTests`
- Null/non-object componentData rejection
- EntityNotFoundError scenarios
- Event dispatching verification

**Files Modified:**
1. `src/entities/entityManager.js` - Inlined mutation methods, ~30 lines net change
2. `tickets/ENTARCREDANA-005-inline-entitymutationmanager.md` - Corrected assumptions, added completion status
