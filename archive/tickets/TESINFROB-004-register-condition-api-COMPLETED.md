# TESINFROB-004: registerCondition() Public API

**Priority**: Medium | **Effort**: Medium
**Status**: Completed ✅

## Description

Add `registerCondition()` and `clearRegisteredConditions()` methods to replace direct access to private `fixture._loadedConditions`. This provides a clean, documented API for condition registration in tests.

## Class Hierarchy Note

**Important**: The `_loadedConditions` Map is defined in `ModActionTestFixture` (line 2035), NOT in `BaseModTestFixture`. The class hierarchy is:

```
BaseModTestFixture (has scopeMocking)
├── ModActionTestFixture (has _loadedConditions)
│   └── ModRuleTestFixture (inherits _loadedConditions)
└── ModCategoryTestFixture (NO _loadedConditions)
```

Therefore, the condition registration API must be added to `ModActionTestFixture`, not `BaseModTestFixture`.

## Files to Touch

- `tests/common/mods/ModTestFixture.js` (modify - add to ModActionTestFixture)
- `tests/unit/common/mods/ModTestFixture.conditionRegistration.test.js` (create)

## Out of Scope

- **DO NOT** remove `_loadedConditions` - existing tests may use it
- **DO NOT** modify `systemLogicTestEnv.js`
- **DO NOT** change how conditions are evaluated at runtime
- **DO NOT** modify scope mocking (that's TESINFROB-003)
- **DO NOT** add deprecation warning for `_loadedConditions` (it's a fixture property, not a testEnv property - the strict proxy from TESINFROB-001 only covers testEnv)

## Implementation Details

### 1. Add private field to ModActionTestFixture

Add after class declaration, before constructor (around line 2000):

```javascript
/** @type {Set<string>} */
#registeredConditions = new Set();
```

### 2. Add condition registration methods to ModActionTestFixture

Add after constructor ends (line 2088), before `initialize()`:

```javascript
/**
 * Register a condition for use in rules during testing.
 * This is the preferred way to add test conditions.
 *
 * @param {string} conditionId - Full condition ID (e.g., 'test:my-condition')
 * @param {Object} definition - Condition definition object
 * @param {Object} definition.logic - JSON Logic expression
 * @param {string} [definition.description] - Human-readable description
 * @throws {Error} If conditionId invalid or definition missing logic
 *
 * @example
 * fixture.registerCondition('test:is-actor', {
 *   logic: { '==': [{ var: 'entity.type' }, 'actor'] },
 *   description: 'Checks if entity is an actor'
 * });
 */
registerCondition(conditionId, definition) {
  if (!conditionId || typeof conditionId !== 'string') {
    throw new Error('registerCondition: conditionId must be a non-empty string');
  }
  if (!definition || typeof definition !== 'object') {
    throw new Error(`registerCondition: definition for '${conditionId}' must be an object`);
  }
  if (!('logic' in definition)) {
    throw new Error(
      `Condition '${conditionId}' must have a 'logic' property. Received: ${JSON.stringify(Object.keys(definition))}`
    );
  }

  // Use existing _loadedConditions mechanism (already wired to dataRegistry override)
  this._loadedConditions.set(conditionId, definition);
  this.#registeredConditions.add(conditionId);
}

/**
 * Clear all conditions registered via registerCondition().
 * Called automatically by cleanup().
 */
clearRegisteredConditions() {
  for (const conditionId of this.#registeredConditions) {
    this._loadedConditions.delete(conditionId);
  }
  this.#registeredConditions.clear();
}

/**
 * Check if a condition was registered via registerCondition().
 * @param {string} conditionId
 * @returns {boolean}
 */
isConditionRegistered(conditionId) {
  return this.#registeredConditions.has(conditionId);
}

/**
 * Get list of conditions registered via registerCondition().
 * @returns {string[]}
 */
getRegisteredConditions() {
  return Array.from(this.#registeredConditions);
}
```

### 3. Override cleanup() in ModActionTestFixture

Add cleanup override to call `clearRegisteredConditions()`:

```javascript
/**
 * @override
 * Extended cleanup that also clears registered conditions.
 */
cleanup() {
  this.clearRegisteredConditions();
  super.cleanup();
}
```

### 4. Create test file

Create `tests/unit/common/mods/ModTestFixture.conditionRegistration.test.js` with tests for:
- Basic condition registration and tracking
- Validation of conditionId (non-empty string)
- Validation of definition (must be object with logic property)
- Cleanup integration (cleanup() clears registered conditions)
- Manual clear via clearRegisteredConditions()
- Multiple condition registrations
- Re-registration (overwrite) behavior

## Acceptance Criteria

### Tests that must pass

- `tests/unit/common/mods/ModTestFixture.conditionRegistration.test.js`:
  - `should register condition and track it`
  - `should throw if definition missing logic property`
  - `should throw for empty conditionId`
  - `should throw for non-object definition`
  - `should clean up registered conditions on cleanup()`
  - `should clean up on clearRegisteredConditions()`
  - `should allow multiple condition registrations`
  - `should allow re-registering same condition (overwrites)`

### Invariants

- All existing tests using `_loadedConditions` continue to work
- Conditions registered via API work identically to those loaded from files
- `fixture.cleanup()` removes all registered conditions
- No memory leaks from unreleased condition references

## Verification

```bash
# Run new tests
NODE_ENV=test npx jest tests/unit/common/mods/ModTestFixture.conditionRegistration.test.js --no-coverage --verbose

# Verify no regressions
NODE_ENV=test npx jest tests/unit/common/mods/ --no-coverage --silent
NODE_ENV=test npx jest tests/integration/scopeDsl/scopeResolverHelpersConditionLoading.integration.test.js --no-coverage --silent
```

## Migration Example

Before (private API access):

```javascript
fixture._loadedConditions.set('test:my-condition', {
  logic: { '==': [{ var: 'entity.type' }, 'actor'] },
});
```

After (public API):

```javascript
fixture.registerCondition('test:my-condition', {
  logic: { '==': [{ var: 'entity.type' }, 'actor'] },
});
```

---

## Outcome

### What Was Actually Changed vs Originally Planned

**Implemented as Planned:**
- ✅ Added `#registeredConditions` private field to `ModActionTestFixture`
- ✅ Added `registerCondition()` method with validation
- ✅ Added `clearRegisteredConditions()` method
- ✅ Added `isConditionRegistered()` helper method
- ✅ Added `getRegisteredConditions()` helper method
- ✅ Added `cleanup()` override to automatically clear registered conditions
- ✅ Created test file with 11 test cases

**Ticket Corrections Made:**
- Fixed class hierarchy note (changed from BaseModTestFixture to ModActionTestFixture)
- Removed deprecation warning requirement (not applicable - `_loadedConditions` is a fixture property, not a testEnv property that the strict proxy covers)

**New/Modified Tests:**

| Test | Rationale |
|------|-----------|
| `should register condition and track it` | Core functionality - verify condition is stored and tracked |
| `should throw if definition missing logic property` | API contract - logic is required per JSON Logic spec |
| `should throw for empty conditionId` | API contract - prevent invalid condition IDs |
| `should throw for null conditionId` | Additional edge case for null values |
| `should throw for non-object definition` | API contract - definition must be object |
| `should clean up registered conditions on cleanup()` | Integration - verify cleanup lifecycle |
| `should clean up on clearRegisteredConditions()` | Manual cleanup - verify explicit clear |
| `should allow multiple condition registrations` | Multi-condition scenarios |
| `should allow re-registering same condition (overwrites)` | Overwrite behavior (common pattern) |
| `should include error message with actual keys when missing logic` | Error message quality validation |
| `should not affect manually added _loadedConditions on clear` | Backward compatibility - legacy pattern still works |

**Test Results:**
- All 11 new tests pass
- All 834 existing tests in `tests/unit/common/mods/` pass
- All 10 tests in `tests/integration/scopeDsl/scopeResolverHelpersConditionLoading.integration.test.js` pass
