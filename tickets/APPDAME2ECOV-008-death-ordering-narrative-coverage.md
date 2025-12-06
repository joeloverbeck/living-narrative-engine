# APPDAME2ECOV-008: Death Ordering with Damage Narrative E2E Coverage

## Summary

Add e2e test coverage confirming that the `shouldFinalize` path (vital organ destruction) still composes and dispatches the damage narrative before death events, and that dying-state evaluations don't suppress narrative when a session exists.

## Background

Per `specs/apply-damage-e2e-coverage-spec.md`, the existing e2e suites lack coverage for:

- Vital organ kill path (`shouldFinalize=true`) still composes narrative before death
- Damage narrative is dispatched before `entity:died` event
- Dying-state evaluations don't suppress narrative when session exists
- Session finalization occurs in correct order relative to narrative

## Files Expected to Touch

### New Files

- `tests/e2e/actions/deathOrderingNarrative.e2e.test.js` - New e2e test suite

### Files Referenced (Read-Only for Context)

- `src/logic/services/damageResolutionService.js` - Death handling, narrative dispatch
- `src/anatomy/services/deathCheckService.js` - Death condition evaluation
- `src/anatomy/services/damageNarrativeComposer.js` - Narrative composition
- `tests/e2e/actions/deathMechanics.e2e.test.js` - Existing death tests

## Out of Scope

- Modifications to production code (`src/`)
- Modifications to existing e2e test files
- Changes to death check logic
- Changes to vital organ definitions
- Narrative content/phrasing (APPDAME2ECOV-001 covers general narrative)
- Hit resolution controls (APPDAME2ECOV-002)
- Metadata/tags coverage (APPDAME2ECOV-003)
- Propagation bookkeeping (APPDAME2ECOV-004)
- Session event queueing (APPDAME2ECOV-005)
- Edge cases (APPDAME2ECOV-006)
- Description regeneration (APPDAME2ECOV-007)

## Acceptance Criteria

### Tests That Must Pass

1. **Narrative before death on vital organ kill**
   - Test: `should dispatch damage narrative before death events on vital organ destruction`
   - Verifies: `core:perceptible_event` (narrative) precedes `entity:died` in event order

2. **Narrative contains kill information**
   - Test: `should include fatal damage information in narrative before death`
   - Verifies: Narrative text mentions the killing blow before death event fires

3. **Session finalized after narrative**
   - Test: `should finalize damage session after narrative composition on fatal hit`
   - Verifies: `shouldFinalize` path doesn't skip narrative composition

4. **Dying state doesn't suppress narrative**
   - Test: `should dispatch narrative when entering dying state`
   - Verifies: Narrative dispatched even when health drops below dying threshold

5. **Dying countdown tick preserves narrative**
   - Test: `should dispatch narrative during dying countdown damage ticks`
   - Verifies: Subsequent damage during dying state still produces narrative

6. **Death from dying expiry has final narrative**
   - Test: `should dispatch final narrative when dying countdown expires`
   - Verifies: Death from countdown expiry includes appropriate narrative

7. **Multiple damage sources before death**
   - Test: `should accumulate all damage in narrative before death event`
   - Verifies: Multi-part damage in fatal session all appears in narrative

8. **Death event follows all session events**
   - Test: `should dispatch entity:died after all session effects and narrative`
   - Verifies: Complete event ordering: narrative → effects → death

### Invariants That Must Remain True

- Existing e2e tests in `tests/e2e/actions/` continue to pass
- Existing `deathMechanics.e2e.test.js` tests remain unaffected
- No changes to production behavior (tests only)
- Test follows existing patterns in `deathMechanics.e2e.test.js`
- Uses `ModTestFixture` and `ModEntityBuilder` from test utilities
- Properly cleans up test resources in `afterEach`
- Death mechanics remain consistent with existing behavior

## Implementation Notes

- Create entities with vital organs (heart, brain) that trigger instant death
- Create spy that captures all events with ordering indices
- Track exact sequence: narrative dispatch → effect events → death event
- Test both vital organ path and dying countdown expiry
- Verify `executionContext.damageSession` state at each phase
- Use `DeathCheckService.evaluateDeathConditions` indirectly through full flow

## Example Test Scenarios

```javascript
// Scenario 1: Vital organ kill
// - Target has heart as vital organ
// - Massive damage destroys heart
// - Verify: narrative → effects → entity:died

// Scenario 2: Dying state transition
// - Target has 100 health, dying threshold at 10%
// - Apply 95 damage (enters dying, not dead)
// - Verify: narrative dispatched, entity not dead yet

// Scenario 3: Dying countdown expiry
// - Target in dying state
// - Countdown reaches 0
// - Verify: final narrative → death event
```

## Testing Command

```bash
NODE_ENV=test npx jest tests/e2e/actions/deathOrderingNarrative.e2e.test.js --no-coverage --verbose
```

## Dependencies

- None (new standalone test file)
- Builds on patterns from `deathMechanics.e2e.test.js`

## Estimated Size

Medium - Single test file with ~8 test cases, requires vital organ entity setup
