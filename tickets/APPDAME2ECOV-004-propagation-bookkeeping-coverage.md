# APPDAME2ECOV-004: Propagation Bookkeeping E2E Coverage

## Summary

Add e2e test coverage for damage propagation bookkeeping: `propagatedFrom` metadata, `anatomy:internal_damage_propagated` event payloads, and propagated entries appearing in composed narrative with grouped sentences.

## Background

Per `specs/apply-damage-e2e-coverage-spec.md`, the existing e2e suites do not assert:

- `propagatedFrom` metadata is attached to propagated damage entries
- `anatomy:internal_damage_propagated` event payload structure and contents
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
   - Verifies: Propagated entries contain `propagatedFrom` with source part reference

2. **propagatedFrom contains source part**
   - Test: `should include source part ID in propagatedFrom metadata`
   - Verifies: `propagatedFrom.partId` matches the originating part

3. **Internal damage propagated event dispatched**
   - Test: `should dispatch anatomy:internal_damage_propagated event`
   - Verifies: Event bus receives the propagation event

4. **Propagation event payload structure**
   - Test: `should include source, target, and damage info in propagation event payload`
   - Verifies: Payload contains `sourcePart`, `targetPart`, `damageAmount`, `damageType`

5. **Propagated entries in narrative**
   - Test: `should include propagated damage in composed narrative`
   - Verifies: Narrative text mentions both primary and propagated damage targets

6. **Narrative grouping of propagated damage**
   - Test: `should group primary and propagated damage into coherent narrative sentences`
   - Verifies: Narrative flows naturally (e.g., "struck the chest, damage spreading to the heart")

7. **Multi-level propagation tracking**
   - Test: `should track propagatedFrom through recursive propagation chain`
   - Verifies: Grandchild propagation still references original source

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
- Access `executionContext.damageSession` to verify `propagatedFrom` tracking
- Compare captured events with narrative output for consistency
- Use existing socket/propagation setup from `damagePropagationFlow.e2e.test.js` as reference

## Testing Command

```bash
NODE_ENV=test npx jest tests/e2e/actions/propagationBookkeeping.e2e.test.js --no-coverage --verbose
```

## Dependencies

- None (new standalone test file)
- Builds on patterns from `damagePropagationFlow.e2e.test.js`

## Estimated Size

Medium - Single test file with ~7-8 test cases, requires hierarchical entity setup
