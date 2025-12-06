# APPDAME2ECOV-005: Damage Session Pending Event Flush Order (E2E)

## Status

Completed

## Summary

Add e2e coverage that proves `DamageAccumulator.pendingEvents` (effect events + `anatomy:damage_applied`) flush after the composed damage narrative and before death finalization. Validate dispatch order for multi-effect hits and for fatal, vital-organ destruction.

## Background

Actual behavior (per `DamageResolutionService` and `DamageTypeEffectsService`):

- `DamageTypeEffectsService` queues effect events onto `damageSession.pendingEvents` in this order: dismembered → fractured → bleeding_started → burning_started → poisoned_started (when enabled).
- `DamageResolutionService` queues `anatomy:damage_applied`, finalizes the session, dispatches the composed `core:perceptible_event` (`perceptionType: damage_received`), then flushes `pendingEvents`, and only after that calls `finalizeDeathFromEvaluation` (which emits `anatomy:entity_died` and its own perceptible event).
- There is no `executionContext.damageSession.queuedEvents` property; the queue lives on `pendingEvents` only.

## Files Expected to Touch

### New Files

- `tests/e2e/actions/damageSessionEventQueueing.e2e.test.js` - New e2e test suite

### Files Referenced (Read-Only for Context)

- `src/logic/services/damageResolutionService.js` - Session lifecycle, narrative dispatch, pendingEvents flush
- `src/anatomy/services/damageTypeEffectsService.js` - Effect event generation/ordering
- `src/anatomy/services/damageNarrativeComposer.js` - Narrative composition timing
- `tests/e2e/actions/damageNarrativeDispatch.e2e.test.js` - Narrative dispatch patterns
- `tests/e2e/actions/deathMechanics.e2e.test.js` - Vital organ/death expectations

## Out of Scope

- Production code changes unless a test seam is missing
- Reworks to existing e2e files
- Event bus implementation changes
- Damage session lifecycle changes
- Narrative copy/content changes

## Acceptance Criteria

### Tests That Must Pass

1. **Queued effects flush after narrative (survivable hit)**
   - Test: `dispatches narrative before queued effect events`
   - Verifies: `core:perceptible_event` (`damage_received`) dispatches before queued `anatomy:*` effect events and `anatomy:damage_applied`; effect dispatch order matches service ordering (fracture → bleeding_started → burning_started → poisoned_started) when all are enabled.

2. **Fatal path flushes before death finalization**
   - Test: `flushes pending events before anatomy:entity_died on vital organ kill`
   - Verifies: In a vital-organ destruction scenario, the damage narrative fires first, queued pending events (e.g., `anatomy:fractured`, `anatomy:damage_applied`) dispatch next, and `anatomy:entity_died` comes after them.

3. **No early dispatch**
   - Assert no `anatomy:*_started` events fire before the narrative perceptible event in either scenario.

### Invariants That Must Remain True

- Existing e2e tests in `tests/e2e/actions/` continue to pass
- No changes to production behavior (tests only)
- Test follows existing patterns in `damageNarrativeDispatch.e2e.test.js` for handler wiring
- Uses `ModTestFixture` and `ModEntityBuilder` from test utilities
- Properly cleans up test resources in `afterEach`
- Event ordering is deterministic and reproducible

## Implementation Notes

- Spy on `eventBus.dispatch` to capture ordered calls and payloads
- Build a single weapon entry that forces fracture + bleed + burn + poison for a survivable hit; keep the part above 0 HP to avoid skipping ongoing effects
- For the fatal path, destroy a part marked with `anatomy:vital_organ` to trigger `finalizeDeathFromEvaluation`
- Expect `pendingEvents` to include `anatomy:damage_applied` after effect events

## Testing Command

```bash
NODE_ENV=test npx jest tests/e2e/actions/damageSessionEventQueueing.e2e.test.js --no-coverage --verbose
```

## Dependencies

- None (new standalone test file)
- Builds on patterns from `damageNarrativeDispatch.e2e.test.js`

## Estimated Size

Medium - Single test file with ~2–3 ordering-focused cases

## Outcome

- Added `tests/e2e/actions/damageSessionEventQueueing.e2e.test.js` with two ordering-focused cases (survivable multi-effect hit, fatal vital-organ hit).
- No production code changes; acceptance scope narrowed to match the actual `pendingEvents` implementation and event type prefixes.
