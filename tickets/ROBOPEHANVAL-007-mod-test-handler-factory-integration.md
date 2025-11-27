# ROBOPEHANVAL-007: Update ModTestHandlerFactory for Handler Validation

## Summary

Update the test infrastructure (`ModTestHandlerFactory`) to ensure test fixtures register all required handlers, preventing silent failures in tests due to missing handlers.

## Background

The spec mentions the recent `UNWIELD_ITEM` handler incident:
> The `UNWIELD_ITEM` handler was implemented but not added to `ModTestHandlerFactory.createHandlersWithItemsSupport()`. Integration tests appeared to pass but the unwield behavior never executed.

With ROBOPEHANVAL-003 in place (fail-fast on missing handlers), such tests will now FAIL instead of silently passing. However, we should also:
1. Ensure test helper methods register comprehensive handler sets
2. Consider adding validation or documentation for test authors

## Files to Touch

### Modify

| File | Change |
|------|--------|
| `tests/common/mods/ModTestHandlerFactory.js` | Audit and update handler registration methods |

### Create

| File | Purpose |
|------|---------|
| `tests/unit/common/mods/ModTestHandlerFactory.completeness.test.js` | Tests verifying handler completeness |

## Out of Scope

- **DO NOT** modify production code (`src/`)
- **DO NOT** modify the validation service or error classes
- **DO NOT** change how handlers are implemented
- **DO NOT** change the DI system
- **DO NOT** modify individual test files (just the factory)

## Implementation Details

### Audit Current Methods

Review each handler factory method and ensure it registers handlers for all operation types used by rules in that category:

| Method | Expected Operations |
|--------|-------------------|
| `createHandlersWithItemsSupport` | DROP_ITEM_AT_LOCATION, PICK_UP_ITEM_FROM_LOCATION, TRANSFER_ITEM, OPEN_CONTAINER, TAKE_FROM_CONTAINER, PUT_IN_CONTAINER, **UNWIELD_ITEM**, etc. |
| `createStandardHandlers` | ADD_COMPONENT, REMOVE_COMPONENT, SET_COMPONENT_VALUE, DISPATCH_EVENT, etc. |
| `createHandlersWithPositioningSupport` | Positioning-related operations |

### Adding Missing Handlers

For each method, verify:
1. What rules does this category test?
2. What operations do those rules use?
3. Are all those operations' handlers registered?

Example fix pattern:

```javascript
// BEFORE
createHandlersWithItemsSupport(registry, dependencies) {
  this.createStandardHandlers(registry, dependencies);
  registry.register('DROP_ITEM_AT_LOCATION', ...);
  registry.register('PICK_UP_ITEM_FROM_LOCATION', ...);
  // Missing: UNWIELD_ITEM
}

// AFTER
createHandlersWithItemsSupport(registry, dependencies) {
  this.createStandardHandlers(registry, dependencies);
  registry.register('DROP_ITEM_AT_LOCATION', ...);
  registry.register('PICK_UP_ITEM_FROM_LOCATION', ...);
  registry.register('UNWIELD_ITEM', ...);  // Added
}
```

### Validation Helper (Optional Enhancement)

Consider adding a helper method that tests can use to verify they have all needed handlers:

```javascript
/**
 * Validates that all operation types used by the given rule have handlers registered.
 * Useful for test debugging.
 */
static validateHandlersForRule(rule, registry) {
  const missing = [];
  for (const action of rule.actions || []) {
    if (!registry.hasHandler(action.type)) {
      missing.push(action.type);
    }
  }
  if (missing.length > 0) {
    throw new Error(`Test setup incomplete: missing handlers for ${missing.join(', ')}`);
  }
}
```

### Documentation Comments

Add JSDoc comments to each factory method listing which operation types it registers:

```javascript
/**
 * Creates handlers for item-related operations.
 *
 * Registered operations:
 * - DROP_ITEM_AT_LOCATION
 * - PICK_UP_ITEM_FROM_LOCATION
 * - TRANSFER_ITEM
 * - UNWIELD_ITEM
 * - OPEN_CONTAINER
 * - TAKE_FROM_CONTAINER
 * - PUT_IN_CONTAINER
 * - VALIDATE_INVENTORY_CAPACITY
 */
createHandlersWithItemsSupport(registry, dependencies) {
```

## Acceptance Criteria

### Tests That Must Pass

1. **Completeness Tests** (`tests/unit/common/mods/ModTestHandlerFactory.completeness.test.js`):
   - `createHandlersWithItemsSupport` registers all item operation handlers
   - `createStandardHandlers` registers all standard operation handlers
   - `createHandlersWithPositioningSupport` (if exists) registers all positioning handlers
   - Each factory method registers handlers consistently

2. **Existing Integration Tests**:
   - All item mod integration tests pass
   - All positioning mod integration tests pass
   - No tests fail due to missing handlers
   - `npm run test:integration` passes

3. **Regression**:
   - Tests that passed before (correctly) still pass
   - Tests that were silently broken now either:
     a. Pass (if we added the missing handler)
     b. Fail with clear `MissingHandlerError` (if handler genuinely missing)

### Invariants That Must Remain True

1. Test infrastructure uses same handler patterns as production
2. Factory methods are comprehensive for their stated purpose
3. Adding a new operation to production requires updating test infrastructure
4. Factory method documentation accurately reflects registered handlers

## Estimated Scope

- ~50-100 lines of implementation changes (depends on how many handlers are missing)
- ~100 lines of test code
- Medium diff, potentially touches many methods

## Risk Assessment

**MEDIUM RISK**: Changes to test infrastructure affect many tests. If we add handlers incorrectly:
1. Tests might pass that shouldn't
2. Tests might fail that should pass

Mitigate by:
1. Running full test suite before and after
2. Reviewing each added handler carefully
3. Checking that handler implementations match production

## Dependencies

- ROBOPEHANVAL-003 (fail-fast behavior) should be in place first
- This reveals which handlers are missing in test infrastructure

## Dependents

- None - this is the final test infrastructure update

## Implementation Notes

This ticket may reveal that many handlers are missing from test infrastructure. If the scope becomes too large, consider:
1. Splitting into multiple tickets by category (items, positioning, etc.)
2. Prioritizing based on which tests are currently failing
