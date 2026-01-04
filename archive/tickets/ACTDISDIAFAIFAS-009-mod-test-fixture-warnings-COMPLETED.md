# ACTDISDIAFAIFAS-009 – ModTestFixture Component Conflict Warnings - COMPLETED

## Problem

Test fixtures silently create entities with components that conflict with action definitions. `createStandardActorTarget()` adds `personal-space-states:closeness` by default, which is in `forbidden_components` for `get_close`, causing silent test failures.

## Proposed Scope

Add validation to ModTestFixture that:
1. Warns when entity components conflict with loaded action's forbidden_components
2. Provides clear console warning with component and action IDs
3. Can be disabled with `{ validateConflicts: false }` for edge case testing
4. Defaults to warning (opt-out to disable)

## File List

- `tests/common/mods/ModTestFixture.js` (specifically `ModActionTestFixture` class)
- `tests/unit/common/mods/ModTestFixture.componentConflictWarnings.test.js` (NEW)

**Note**: The original test file name `ModTestFixture.validation.test.js` was changed because that file already exists for SCHVALTESINT-001/002 schema validation.

## Out of Scope

- Production code changes
- Other test helpers (ModEntityBuilder, etc.)
- Action discovery service changes
- Modifying how fixtures create entities
- Breaking existing test patterns

## Acceptance Criteria

### Tests

Run: `npm run test:unit -- tests/unit/common/mods/ModTestFixture.componentConflictWarnings.test.js`

Required test cases:
- **Warning logged when entity has forbidden_components for loaded action**: Console.warn called
- **Warning includes component ID and action ID**: Clear identification
- **`{ validateConflicts: false }` disables warnings**: Opt-out works
- **Warning doesn't prevent entity creation**: Non-blocking
- **No warning when no conflicts exist**: Clean case
- **Multiple conflicts logged separately**: Each conflict warned
- **Warning includes fixture method name**: e.g., "createStandardActorTarget"
- **Works with forAction factory**: Primary use case

### Invariants

- Existing tests continue to pass (warnings don't break execution)
- Warnings don't break test execution (console.warn only)
- Default behavior is to warn (opt-out to disable)
- Entity creation unchanged - only adds warning
- No performance impact on non-action fixtures

### Warning Format

```
[ModTestFixture Warning] Entity 'Actor' has component 'personal-space-states:closeness'
which is in forbidden_components.actor for action 'personal-space:get_close'.
This may cause the action to be unavailable in tests.
To disable this warning, use: createStandardActorTarget([...], { validateConflicts: false })
```

### Integration Points

**Note**: The ticket originally used `#loadedAction` but actual code uses `this._actionDefinition`.

```javascript
// In ModActionTestFixture entity creation methods:
#validateComponentConflicts(entity, options = {}) {
  if (options.validateConflicts === false) return;
  if (!this._actionDefinition) return;

  const forbiddenActor = this._actionDefinition.forbidden_components?.actor || [];
  const entityComponents = Object.keys(entity.components || {});

  const conflicts = entityComponents.filter(c => forbiddenActor.includes(c));

  for (const conflict of conflicts) {
    console.warn(
      `[ModTestFixture Warning] Entity '${entity.id}' has component '${conflict}' ` +
      `which is in forbidden_components.actor for action '${this._actionDefinition.id || this.actionId}'.`
    );
  }
}

createStandardActorTarget(names, options = {}) {
  // After entity creation (existing logic)...
  // Add validation for each entity:
  this.#validateComponentConflicts(scenario.actor, mergedOptions);
  this.#validateComponentConflicts(scenario.target, mergedOptions);
  // ... rest unchanged
}
```

### Example Usage

```javascript
// Default: Warnings enabled
const fixture = await ModTestFixture.forAction('personal-space', 'personal-space:get_close');
fixture.createStandardActorTarget(['Actor', 'Target']);
// Console: [ModTestFixture Warning] Entity 'Actor' has component...

// Opt-out for edge case testing
fixture.createStandardActorTarget(['Actor', 'Target'], { validateConflicts: false });
// No warning

// Alternative: Disable globally for fixture
const fixture = await ModTestFixture.forAction('personal-space', 'personal-space:get_close', {
  validateConflicts: false
});
```

## Dependencies

- ACTDISDIAFAIFAS-008 (ActionDiscoveryService Diagnostics) - should be completed first to understand diagnostic patterns

## Outcome

### Discrepancies Found and Corrected

The original ticket made several incorrect assumptions that were corrected before implementation:

1. **Private field naming**: Ticket assumed `#loadedAction` but code uses `this._actionDefinition`
2. **Test file naming conflict**: Ticket proposed `ModTestFixture.validation.test.js` which already existed for SCHVALTESINT-001/002 schema validation - changed to `ModTestFixture.componentConflictWarnings.test.js`
3. **Class location**: Implementation is in `ModActionTestFixture` class (not `ModTestFixture`)

### Changes Made

| File | Change |
|------|--------|
| `tests/common/mods/ModTestFixture.js` | Added `#validateComponentConflicts()` private method to `ModActionTestFixture` class; modified `createStandardActorTarget()` to call validation for actor and target entities |
| `tests/unit/common/mods/ModTestFixture.componentConflictWarnings.test.js` | **NEW** - 14 test cases covering all acceptance criteria |

### Test Results

- All 14 new tests pass
- All 250 existing ModTestFixture tests pass
- All 29 get_close integration tests pass
- No breaking changes to existing test patterns

### Acceptance Criteria Verified

| Criterion | Status |
|-----------|--------|
| Warning logged when conflict | ✅ Implemented and tested |
| Warning includes IDs | ✅ Component ID and action ID included |
| Opt-out works | ✅ `{ validateConflicts: false }` disables warnings |
| Non-blocking | ✅ Uses console.warn, doesn't throw |
| Clean case | ✅ No warning when no conflicts |
| Multiple conflicts | ✅ Each conflict logged separately |
| Method name included | ✅ `createStandardActorTarget` in message |
| Performance | ✅ Early return when no action loaded |
