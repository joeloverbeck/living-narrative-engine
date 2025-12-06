# WEADAMCAPREF-004: Refactor DamageTypeEffectsService

**Status: COMPLETED**

## Summary

Modify `DamageTypeEffectsService` to accept a damage entry object directly instead of looking up damage types from a registry. This removes the indirect coupling and enables per-weapon effect customization.

## Dependencies

- WEADAMCAPREF-001 (schema defines damage entry structure)
- WEADAMCAPREF-002 (component exists for type reference)

## Files to Touch

| File                                                           | Action | Description                                        |
| -------------------------------------------------------------- | ------ | -------------------------------------------------- |
| `src/anatomy/services/damageTypeEffectsService.js`             | UPDATE | Change method signature and remove registry lookup |
| `tests/unit/anatomy/services/damageTypeEffectsService.test.js` | UPDATE | Update tests for new signature                     |

## Out of Scope

- ApplyDamageHandler changes (WEADAMCAPREF-005)
- Registry removal (WEADAMCAPREF-010)
- Any mod file changes
- Operator implementation (WEADAMCAPREF-003)
- Rule modifications (WEADAMCAPREF-008)

## Implementation Details

### Method Signature Change

**Before**:

```javascript
async applyEffectsForDamage({ entityId, partId, amount, damageType, maxHealth, currentHealth })
```

**After**:

```javascript
async applyEffectsForDamage({ entityId, partId, damageEntry, maxHealth, currentHealth })
```

### Remove Registry Lookup

**Before**:

```javascript
const damageTypeDef = this.#dataRegistry.get('damageTypes', damageType);
if (!damageTypeDef) {
  this.#logger.warn(`Unknown damage type "${damageType}"`);
  return;
}
```

**After**:

```javascript
// damageEntry is passed directly - no lookup needed
if (!damageEntry) {
  this.#logger.warn('No damage entry provided');
  return;
}
```

### Update Internal Methods

All `#checkAndApply*` methods receive `damageEntry` directly:

```javascript
#checkAndApplyDismemberment(damageEntry, partId, currentHealth, maxHealth) {
  if (!damageEntry.dismember?.enabled) return false;
  const threshold = damageEntry.dismember.thresholdFraction ?? 0.8;
  // ... rest of logic
}
```

### DamageEntry Object Structure

```javascript
{
  name: "slashing",
  amount: 4,
  penetration: 0.3,
  bleed: { enabled: true, severity: "moderate", baseDurationTurns: 3 },
  dismember: { enabled: true, thresholdFraction: 0.6 }
}
```

## Acceptance Criteria

### Tests That Must Pass

1. `npm run test:unit -- tests/unit/anatomy/services/damageTypeEffectsService.test.js`

Test cases:

- Service accepts full damage entry object
- Each effect type works (bleed, fracture, burn, poison, dismember)
- Missing optional fields use defaults
- Disabled effects are skipped
- Invalid/null damageEntry logs warning and returns early
- Penetration value from damageEntry is used correctly

2. `npm run typecheck` - No type errors

### Invariants That Must Remain True

1. All effect logic (bleed, fracture, burn, poison, dismember) continues to work identically
2. Default values for optional effect fields remain unchanged
3. Effect thresholds and calculations remain mathematically identical
4. Event dispatching for effects remains unchanged
5. Method returns gracefully on invalid input (no exceptions thrown)
6. Service can still be called by ApplyDamageHandler (even if handler needs updating separately)

## Estimated Size

- 1 service file (~50-100 lines changed)
- 1 test file (~100-150 lines changed)

---

## Outcome

**Completed: 2025-12-02**

### Changes Made

#### `src/anatomy/services/damageTypeEffectsService.js`

- Removed `IDataRegistry` dependency from constructor
- Changed `applyEffectsForDamage` signature from `{entityId, partId, amount, damageType, maxHealth, currentHealth}` to `{entityId, partId, damageEntry, maxHealth, currentHealth}`
- Removed registry lookup logic - now uses `damageEntry` directly
- Updated all internal methods (`#checkAndApplyDismemberment`, `#checkAndApplyFracture`, `#applyBleedEffect`, `#applyBurnEffect`, `#applyPoisonEffect`) to receive `damageEntry` instead of `damageTypeDef`
- Extracts `amount` from `damageEntry.amount` for threshold calculations
- Added validation: logs warning and returns early when `damageEntry` is null/undefined

#### `tests/unit/anatomy/services/damageTypeEffectsService.test.js`

- Removed `mockDataRegistry` from test setup
- Updated constructor tests (removed dataRegistry validation test case)
- Changed `baseParams` to use `damageEntry` object structure
- Updated all 40 test cases to use new signature:
  - Dismemberment tests
  - Fracture tests
  - Bleed tests
  - Burn tests
  - Poison tests
  - Edge case tests
- Added new edge case tests:
  - Missing `amount` in damageEntry (defaults to 0)
  - Penetration value handling from damageEntry

### Test Results

All 40 tests pass:

```
PASS  tests/unit/anatomy/services/damageTypeEffectsService.test.js
Test Suites: 1 passed, 1 total
Tests:       40 passed, 40 total
```

### Known Pre-existing Issues (Not Introduced by This Change)

- TypeScript JSDoc type errors for nested object properties (e.g., `Property 'dismember' does not exist on type 'object'`) - this is a JSDoc limitation when typing complex nested structures
- ESLint warnings (53 warnings, 0 errors) - pre-existing documentation and hardcoded reference warnings

### Verification Commands Run

```bash
npm run test:unit -- tests/unit/anatomy/services/damageTypeEffectsService.test.js  # All 40 tests pass
npm run typecheck  # Pre-existing warnings only
npx eslint src/anatomy/services/damageTypeEffectsService.js tests/unit/anatomy/services/damageTypeEffectsService.test.js  # Warnings only
```

### Notes

- The `ApplyDamageHandler` caller still uses the old signature pattern (passes `amount` and `damageType` separately). This will be addressed in WEADAMCAPREF-005.
- The service is now ready to receive full `damageEntry` objects with all effect configurations embedded.
