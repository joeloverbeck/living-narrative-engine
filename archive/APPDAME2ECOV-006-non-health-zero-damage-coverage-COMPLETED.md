# APPDAME2ECOV-006: Non-Health Parts and Zero-Damage Paths E2E Coverage

## Summary

Add focused e2e coverage for APPLY_DAMAGE edge paths: parts without `anatomy:part_health`, non-positive damage amounts, and `exclude_damage_types` when a weapon declares multiple damage entries.

## Status

Completed — coverage added, no production code changes required.

## Background

Current behavior (verified in `src/logic/services/damageResolutionService.js` and `applyDamageHandler.js`):

- Non-positive `finalDamageEntry.amount` triggers an early return with no events or propagation; the temporary damage session is cleaned up in `finally`.
- Parts without `anatomy:part_health` still record damage in the session and dispatch `anatomy:damage_applied`, but they never emit `anatomy:part_health_changed`.
- Legacy `amount` + `damage_type` rejects negative amounts; JSON damage entries with negative amounts are skipped via the non-positive check above.
- `exclude_damage_types` is evaluated per APPLY_DAMAGE call (per damage entry). The swing-at-target rule loops entries individually, so there is no shared multi-entry damage session to preserve.
- Integration coverage already exists for zero-damage skips (`tests/integration/anatomy/damage-application.integration.test.js`), but there is no e2e coverage around the full handler stack or exclude lists with mixed entries.

## Files Expected to Touch

### New Files

- `tests/e2e/actions/damageEdgeCases.e2e.test.js` - New e2e test suite

### Files Referenced (Read-Only for Context)

- `src/logic/operationHandlers/applyDamageHandler.js` - Exclusion list handling and parameter validation
- `src/logic/services/damageResolutionService.js` - Non-positive damage early return and session cleanup
- `tests/e2e/actions/swingAtTargetFullFlow.e2e.test.js` - Existing exclude_damage_types coverage pattern

## Out of Scope

- Production logic changes (expectation is tests-only)
- Schema or rules changes
- Action narrative/dispatch coverage (other APPDAME2ECOV tickets)

## Acceptance Criteria

### Tests That Must Pass

1. **Part without health still handled**
   - Verifies APPLY_DAMAGE does not throw when the part lacks `anatomy:part_health`, emits `anatomy:damage_applied`, and skips any `anatomy:part_health_changed`.

2. **Healthless parts never get health updates**
   - Confirms no `anatomy:part_health_changed` is dispatched when targeting a part without health (guards against accidental component creation).

3. **Zero damage early return**
   - Ensures non-positive damage yields no damage or health events and leaves the target state untouched.

4. **Negative damage early return**
   - Confirms negative damage entries are skipped the same way as zero (no events, no state change).

5. **Exclude list skips only matching entries**
   - Using a weapon with mixed damage entries and `exclude_damage_types` set, excluded entries are ignored while allowed entries reduce health and emit damage/health events.

6. **Exclude-all yields no damage**
   - When every entry is excluded, no damage or health events occur.

### Invariants That Must Remain True

- Existing e2e tests in `tests/e2e/actions/` continue to pass.
- Legacy exclude test in `swingAtTargetFullFlow.e2e.test.js` remains unchanged.
- No public API or production behavior changes; tests mirror current logic.
- Tests use `ModTestFixture` + `ModEntityBuilder` patterns and clean up in `afterEach`.

## Implementation Notes

- Build parts with `anatomy:part` while omitting `anatomy:part_health` to exercise the no-health path.
- Pass `{ damage_entry: { name, amount } }` for non-positive scenarios to hit the service-level early return.
- For exclusion, reuse swing-at-target handler wiring and provide weapons with mixed entries where piercing is excluded by default.
- Assert on dispatched event types (`anatomy:damage_applied`, `anatomy:part_health_changed`) and resulting health components where applicable.

## Testing Command

```bash
NODE_ENV=test npx jest tests/e2e/actions/damageEdgeCases.e2e.test.js --no-coverage --verbose
```

## Dependencies

- None (new standalone test file)

## Outcome

- Added `tests/e2e/actions/damageEdgeCases.e2e.test.js` to cover healthless parts, non-positive damage, and per-entry exclude lists.
- Confirmed current implementation already skips non-positive damage and keeps damage_applied on parts without health; no behavior changes needed.
- Clarified acceptance criteria to reflect per-entry exclusion semantics and existing integration coverage for zero-damage paths.

## Estimated Size

Medium - Single test file with ~6 targeted cases
