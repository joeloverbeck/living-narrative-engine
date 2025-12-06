# APPDAME2ECOV-005: Session Event Queueing and Flush Order E2E Coverage

## Summary

Add e2e test coverage verifying that queued effect events (`bleeding_started`, `burning_started`, `poisoned_started`, `fractured`, `dismembered`) flush after narrative composition and preserve correct order relative to death finalization.

## Background

Per `specs/apply-damage-e2e-coverage-spec.md`, the existing e2e suites lack tests that verify:

- Effect events are queued during damage processing
- Queued events flush after narrative composition completes
- Event ordering is preserved (narrative → effects → death if applicable)
- Multiple effect types flush in expected order

## Files Expected to Touch

### New Files

- `tests/e2e/actions/sessionEventQueueing.e2e.test.js` - New e2e test suite

### Files Referenced (Read-Only for Context)

- `src/logic/services/damageResolutionService.js` - Session management, event queueing
- `src/anatomy/services/damageTypeEffectsService.js` - Effect event generation
- `src/anatomy/services/damageNarrativeComposer.js` - Narrative composition timing
- `tests/e2e/actions/damageEffectsTriggers.e2e.test.js` - Existing effect tests

## Out of Scope

- Modifications to production code (`src/`)
- Modifications to existing e2e test files
- Changes to event bus implementation
- Changes to damage session implementation
- Narrative content/phrasing (APPDAME2ECOV-001)
- Hit resolution controls (APPDAME2ECOV-002)
- Metadata/tags coverage (APPDAME2ECOV-003)
- Propagation bookkeeping (APPDAME2ECOV-004)

## Acceptance Criteria

### Tests That Must Pass

1. **Effects queued during damage processing**
   - Test: `should queue effect events during damage resolution`
   - Verifies: Effect events are not dispatched immediately during `applyDamage`

2. **Events flush after narrative composition**
   - Test: `should flush queued events after narrative composition completes`
   - Verifies: `core:perceptible_event` (narrative) dispatched before effect events

3. **Bleeding event order**
   - Test: `should dispatch bleeding_started after narrative event`
   - Verifies: `bleeding_started` event follows `core:perceptible_event`

4. **Burning event order**
   - Test: `should dispatch burning_started after narrative event`
   - Verifies: `burning_started` event follows `core:perceptible_event`

5. **Poisoned event order**
   - Test: `should dispatch poisoned_started after narrative event`
   - Verifies: `poisoned_started` event follows `core:perceptible_event`

6. **Fractured and dismembered order**
   - Test: `should dispatch fractured and dismembered events after narrative`
   - Verifies: Structural damage events follow narrative in correct sequence

7. **Multiple effects preserve queue order**
   - Test: `should preserve order when multiple effect types are triggered`
   - Verifies: Effects flush in consistent order (e.g., bleed → burn → fracture)

8. **Death finalization after effect events**
   - Test: `should dispatch death events after effect events when fatal`
   - Verifies: `entity:died` follows all effect events in fatal damage scenario

### Invariants That Must Remain True

- Existing e2e tests in `tests/e2e/actions/` continue to pass
- Existing `damageEffectsTriggers.e2e.test.js` tests remain unaffected
- No changes to production behavior (tests only)
- Test follows existing patterns in `damageEffectsTriggers.e2e.test.js`
- Uses `ModTestFixture` and `ModEntityBuilder` from test utilities
- Properly cleans up test resources in `afterEach`
- Event ordering is deterministic and reproducible

## Implementation Notes

- Create spy that captures all events in dispatch order with timestamps
- Build weapons that trigger multiple effect types simultaneously
- Compare event dispatch indices to verify ordering
- For death ordering test, use fatal damage to vital organ
- Verify `executionContext.damageSession.queuedEvents` during processing
- Test both session with `shouldFinalize=true` and `shouldFinalize=false`

## Testing Command

```bash
NODE_ENV=test npx jest tests/e2e/actions/sessionEventQueueing.e2e.test.js --no-coverage --verbose
```

## Dependencies

- None (new standalone test file)
- Builds on patterns from `damageEffectsTriggers.e2e.test.js`

## Estimated Size

Medium - Single test file with ~8 test cases, requires careful event ordering verification
