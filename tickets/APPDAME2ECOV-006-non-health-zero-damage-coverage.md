# APPDAME2ECOV-006: Non-Health Parts and Zero-Damage Paths E2E Coverage

## Summary

Add e2e test coverage for edge cases: parts without `anatomy:part_health`, zero/negative damage early-return, and exclusion lists when multiple entries mix excluded + allowed damage types.

## Background

Per `specs/apply-damage-e2e-coverage-spec.md`, the existing e2e suites lack coverage for:

- Parts that exist without `anatomy:part_health` component (e.g., cosmetic parts)
- Zero damage amount early-return behavior
- Negative damage amount handling
- `exclude_damage_types` when multiple entries mix excluded + allowed types

## Files Expected to Touch

### New Files

- `tests/e2e/actions/damageEdgeCases.e2e.test.js` - New e2e test suite

### Files Referenced (Read-Only for Context)

- `src/logic/operationHandlers/applyDamageHandler.js` - Early return logic
- `src/logic/services/damageResolutionService.js` - Damage application
- `tests/e2e/actions/swingAtTargetFullFlow.e2e.test.js` - Has exclude_damage_types test

## Out of Scope

- Modifications to production code (`src/`)
- Modifications to existing e2e test files
- Changes to damage calculation logic
- Changes to component schemas
- Narrative dispatch (APPDAME2ECOV-001)
- Hit resolution controls (APPDAME2ECOV-002)
- Metadata/tags coverage (APPDAME2ECOV-003)
- Propagation bookkeeping (APPDAME2ECOV-004)
- Session event queueing (APPDAME2ECOV-005)

## Acceptance Criteria

### Tests That Must Pass

1. **Parts without part_health component**
   - Test: `should handle damage to parts without anatomy:part_health gracefully`
   - Verifies: No errors thrown, appropriate handling when part lacks health

2. **Part without health skips damage application**
   - Test: `should skip damage application for parts without health component`
   - Verifies: No `anatomy:part_health_changed` event for health-less parts

3. **Zero damage early return**
   - Test: `should early-return without side effects when damage amount is zero`
   - Verifies: No events dispatched, no session modifications for zero damage

4. **Negative damage handling**
   - Test: `should handle negative damage amounts appropriately`
   - Verifies: System handles negative damage (either reject or treat as healing)

5. **Exclusion list with mixed entries - allowed processed**
   - Test: `should process allowed damage types when exclusion list present`
   - Verifies: Non-excluded entries are applied normally

6. **Exclusion list with mixed entries - excluded skipped**
   - Test: `should skip excluded damage types in multi-entry weapon`
   - Verifies: Excluded entries produce no damage events

7. **All entries excluded produces no damage**
   - Test: `should produce no damage when all entries are excluded`
   - Verifies: No damage events when entire weapon is excluded

8. **Partial exclusion preserves damage session**
   - Test: `should maintain valid damage session when some entries excluded`
   - Verifies: Session correctly tracks only processed (non-excluded) entries

### Invariants That Must Remain True

- Existing e2e tests in `tests/e2e/actions/` continue to pass
- Existing exclude_damage_types test in `swingAtTargetFullFlow.e2e.test.js` unaffected
- No changes to production behavior (tests only)
- Test follows existing patterns in `swingAtTargetFullFlow.e2e.test.js`
- Uses `ModTestFixture` and `ModEntityBuilder` from test utilities
- Properly cleans up test resources in `afterEach`
- No exceptions thrown for edge cases (graceful handling)

## Implementation Notes

- Create parts with `anatomy:part` but without `anatomy:part_health`
- Create weapons with damage amount of 0 and negative values
- Create multi-entry weapons with mixed excluded/allowed damage types
- Use `exclude_damage_types` parameter in APPLY_DAMAGE operation
- Spy on event bus to verify no spurious events in edge cases
- Verify error handling paths don't throw uncaught exceptions

## Example Test Data

```javascript
// Part without health
const cosmeticPart = new ModEntityBuilder('cosmetic-part').withComponent(
  'anatomy:part',
  { type: 'hair', subType: 'hair' }
);
// No anatomy:part_health

// Weapon with zero damage
const zeroDamageEntry = { name: 'touch', amount: 0, type: 'bludgeoning' };

// Mixed exclusion scenario
const mixedWeapon = {
  entries: [
    { name: 'fire', amount: 10, type: 'fire' },
    { name: 'slash', amount: 8, type: 'slashing' },
  ],
};
// exclude_damage_types: ['fire'] should only process 'slash'
```

## Testing Command

```bash
NODE_ENV=test npx jest tests/e2e/actions/damageEdgeCases.e2e.test.js --no-coverage --verbose
```

## Dependencies

- None (new standalone test file)

## Estimated Size

Medium - Single test file with ~8 test cases
