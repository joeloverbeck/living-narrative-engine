# APPDAME2ECOV-008: Death Ordering with Damage Narrative E2E Coverage

## Summary

The gap is narrower than originally stated. We already have e2e coverage that proves `DamageResolutionService` dispatches the composed narrative before flushing queued effect events and before `anatomy:entity_died` on vital-organ kills (see `tests/e2e/actions/damageSessionEventQueueing.e2e.test.js`). The remaining hole is ensuring the dying-state path (`isDying` without `shouldFinalize`) still emits a `core:perceptible_event` damage narrative when the target crosses the 10% threshold.

## Background

- Narrative dispatch and event ordering on the `shouldFinalize` (vital organ) path are already covered by `damageSessionEventQueueing.e2e.test.js` and `damageNarrativeDispatch.e2e.test.js`.
- `DeathCheckService.processDyingTurn` intentionally emits only the death final message (`entity_died` + `perceptible_event` with `perceptionType: entity_died`) and does **not** compose a new damage narrative; the last damage application is expected to have already emitted one.
- Missing assertion: entering the dying state must not suppress the damage narrative from the same damage session.

## Files Expected to Touch

- `tests/e2e/actions/damageSessionEventQueueing.e2e.test.js` – add a dying-state narrative ordering assertion alongside existing ordering checks.

### Files Referenced (Read-Only for Context)

- `src/logic/services/damageResolutionService.js` – session finalization + narrative dispatch before death finalization
- `src/anatomy/services/deathCheckService.js` – `evaluateDeathConditions` adds `anatomy:entity_dying`; `processDyingTurn` emits final death message without damage narrative
- `tests/e2e/actions/deathMechanics.e2e.test.js` – baseline dying/death behavior

## Out of Scope

- Production code changes (behavior is already correct)
- Additional death ordering tests for vital organ kills (covered)
- Narrative content/phrasing changes (APPDAME2ECOV-001)
- Hit resolution controls (APPDAME2ECOV-002)
- Metadata/tags coverage (APPDAME2ECOV-003)
- Propagation bookkeeping (APPDAME2ECOV-004)
- Session event queueing (APPDAME2ECOV-005)
- Non-health / zero-damage paths (APPDAME2ECOV-006)
- Description regeneration (APPDAME2ECOV-007)

## Acceptance Criteria

1. **Dying transition still yields a damage narrative**
   - A damage session that drives overall health below 10% (enters dying) must dispatch `core:perceptible_event` (`perceptionType: damage_received`) even though `anatomy:entity_dying` fires earlier in the flow.
   - Event order expectation: `anatomy:entity_dying` precedes the damage narrative; the narrative precedes queued effect events.

2. **Existing ordering coverage remains intact**
   - The existing vital-organ ordering assertions in `damageSessionEventQueueing.e2e.test.js` continue to pass unchanged.

## Testing Command

```bash
NODE_ENV=test npx jest tests/e2e/actions/damageSessionEventQueueing.e2e.test.js --no-coverage --verbose --runInBand
```

## Estimated Size

Small – one additional e2e test case in an existing suite.

## Outcome

### Completed
- Added a dying-state ordering test to `tests/e2e/actions/damageSessionEventQueueing.e2e.test.js` that proves `anatomy:entity_dying` dispatches before the damage narrative and that the narrative still precedes queued session events.
- Exercised the flow with a sub-10% health survivor (non-vital part) to ensure dying-state evaluation does not suppress damage narratives.
- Ran `NODE_ENV=test npx jest tests/e2e/actions/damageSessionEventQueueing.e2e.test.js --no-coverage --verbose --runInBand`.

### Changes to Scope
- Recognized that vital-organ death ordering/narrative coverage already exists in `damageSessionEventQueueing.e2e.test.js` and `damageNarrativeDispatch.e2e.test.js`; no new tests added for that path.
- No production code changes required; work limited to the existing e2e suite.
