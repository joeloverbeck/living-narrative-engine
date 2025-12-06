# APPDAME2ECOV-004: Propagation Bookkeeping E2E Coverage

Status: Completed

## Summary

Add e2e test coverage for damage propagation bookkeeping: `propagatedFrom` metadata on propagated damage, `anatomy:internal_damage_propagated` event payloads, and propagated entries appearing in composed narrative with grouped sentences.

## Background

Per `specs/apply-damage-e2e-coverage-spec.md`, the existing e2e suites do not assert propagation bookkeeping even though the runtime already records it:

- `propagatedFrom` metadata is attached to propagated damage entries (per-hop parent ID, not original root)
- `anatomy:internal_damage_propagated` payload fields are `ownerEntityId`, `sourcePartId`, `targetPartId`, `damageAmount`, `damageTypeId`, and `timestamp`
- Propagated damage entries appear in the composed narrative
- Narrative groups primary and propagated damage into coherent sentences

## Files Expected to Touch

### New Files

- `tests/e2e/actions/propagationBookkeeping.e2e.test.js` - New e2e test suite

### Files Referenced (Read-Only for Context)

- `src/anatomy/services/damagePropagationService.js` - Propagation logic
- `src/logic/services/damageResolutionService.js` - Event dispatching
- `src/anatomy/services/damageNarrativeComposer.js` - Narrative composition
- `tests/e2e/actions/damagePropagationFlow.e2e.test.js` - Existing propagation tests

## Out of Scope

- Modifications to production code (`src/`)
- Modifications to existing e2e test files
- Changes to propagation probability/modifier logic
- Changes to socket resolution logic
- Narrative dispatch mechanics (APPDAME2ECOV-001)
- Hit resolution controls (APPDAME2ECOV-002)
- Metadata/tags coverage (APPDAME2ECOV-003)
- Death mechanics

## Acceptance Criteria

### Tests That Must Pass

1. **propagatedFrom metadata present**
   - Test: `should attach propagatedFrom metadata to propagated damage entries`
   - Verifies: Propagated `anatomy:damage_applied` entries include `propagatedFrom` with the immediate parent part ID

2. **Propagation event payload structure**
   - Test: `should dispatch anatomy:internal_damage_propagated with expected payload fields`
   - Verifies: Payload contains `ownerEntityId`, `sourcePartId`, `targetPartId`, `damageAmount`, `damageTypeId`, and numeric `timestamp`

3. **Propagated entries in narrative**
   - Test: `should include propagated damage in composed narrative`
   - Verifies: Narrative text mentions both primary and propagated damage targets (via `core:perceptible_event` description)

4. **Narrative grouping of propagated damage**
   - Test: `should group multiple propagated hits of the same damage type into one sentence`
   - Verifies: Propagated parts share a single propagation sentence (e.g., "their heart and artery suffer slashing damage")

5. **Recursive propagation parentage**
   - Test: `should preserve propagatedFrom linkage per hop in a recursive chain`
   - Verifies: Each propagated entry references its direct parent (torso → heart, heart → artery)

### Invariants That Must Remain True

- Existing e2e tests in `tests/e2e/actions/` continue to pass
- Existing `damagePropagationFlow.e2e.test.js` tests remain unaffected
- No changes to production behavior (tests only)
- Test follows existing patterns in `damagePropagationFlow.e2e.test.js`
- Uses `ModTestFixture` and `ModEntityBuilder` from test utilities
- Properly cleans up test resources in `afterEach`

## Implementation Notes

- Build entities with multi-level part hierarchy (torso → heart → vessels)
- Configure propagation rules via `anatomy:damage_propagation` component
- Spy on event bus to capture `anatomy:internal_damage_propagated` events
- Validate `propagatedFrom` via queued `anatomy:damage_applied` events (per-hop parent IDs)
- Compare captured events with narrative output for consistency
- Use existing socket/propagation setup from `damagePropagationFlow.e2e.test.js` as reference

## Outcome

- Added `tests/e2e/actions/propagationBookkeeping.e2e.test.js` covering propagatedFrom metadata, propagation event payload fields, narrative inclusion, grouping, and recursive parentage.
- No production code changes were required; coverage aligns with the existing runtime behavior.
- Ran the targeted suite with `--runInBand` to avoid the known jest worker crash when parallelizing.

## Testing Command

```bash
NODE_ENV=test npx jest tests/e2e/actions/propagationBookkeeping.e2e.test.js --no-coverage --verbose
```

## Dependencies

- None (new standalone test file)
- Builds on patterns from `damagePropagationFlow.e2e.test.js`

## Estimated Size

Medium - Single test file with ~7-8 test cases, requires hierarchical entity setup
