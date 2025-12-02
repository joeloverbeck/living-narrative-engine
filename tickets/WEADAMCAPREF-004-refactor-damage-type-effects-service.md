# WEADAMCAPREF-004: Refactor DamageTypeEffectsService

## Summary

Modify `DamageTypeEffectsService` to accept a damage entry object directly instead of looking up damage types from a registry. This removes the indirect coupling and enables per-weapon effect customization.

## Dependencies

- WEADAMCAPREF-001 (schema defines damage entry structure)
- WEADAMCAPREF-002 (component exists for type reference)

## Files to Touch

| File | Action | Description |
|------|--------|-------------|
| `src/anatomy/services/damageTypeEffectsService.js` | UPDATE | Change method signature and remove registry lookup |
| `tests/unit/anatomy/services/damageTypeEffectsService.test.js` | UPDATE | Update tests for new signature |

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
