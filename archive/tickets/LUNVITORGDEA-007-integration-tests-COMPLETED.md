# LUNVITORGDEA-007: Integration Tests for Respiratory Organ Death

## Status: COMPLETED

## Summary

Create integration tests covering the full respiratory death scenarios, from organ destruction through to death event dispatch. Tests the `requiresAllDestroyed` flag functionality for respiratory organs.

## Dependencies

- LUNVITORGDEA-001 (Schema updates) ✅
- LUNVITORGDEA-002 (Human lung entities) ✅
- LUNVITORGDEA-003 (Collective death check) ✅
- LUNVITORGDEA-004 (Oxygen handler filter) ✅
- LUNVITORGDEA-005 (Death message) ✅
- LUNVITORGDEA-006 (Unit tests) ✅

## File List

### Files to Create
- `tests/integration/anatomy/respiratoryOrganDeath.integration.test.js`

### Files to Reference (read-only)
- `src/anatomy/services/deathCheckService.js`
- `src/logic/operationHandlers/depleteOxygenHandler.js` (corrected from `src/breathing/handlers/oxygenDepleteHandler.js`)
- `src/breathing/services/hypoxiaTickSystem.js`
- `data/mods/anatomy/entities/definitions/human_lung_left.entity.json`
- `data/mods/anatomy/entities/definitions/human_lung_right.entity.json`
- `tests/integration/anatomy/deathCheckIntegration.test.js` (existing pattern reference)

## Assumptions Corrected

### Original Incorrect Assumptions
1. ~~`src/breathing/handlers/oxygenDepleteHandler.js`~~ → **Actual**: `src/logic/operationHandlers/depleteOxygenHandler.js`
2. ~~Full mod-loading test bed with `createIntegrationTestBed()`~~ → **Actual**: Use mock-based approach matching existing `deathCheckIntegration.test.js` pattern
3. ~~Non-existent helper methods~~ (`getOrganByType`, `destroyOrgan`, `simulateBreathingTicks`, etc.) → **Actual**: Direct mock setup and service calls

### Test Approach Changed
- Uses mock-based integration testing (matching existing patterns)
- Tests `DeathCheckService` directly with mocked dependencies
- Verifies `#checkCollectiveVitalOrganDestruction` behavior
- Does NOT require full mod loading (too complex, not needed for this scope)

## Out of Scope

- DO NOT modify source code files
- DO NOT modify existing unit test files
- DO NOT create complex mod-loading test infrastructure
- DO NOT test creature entities (done in 008)

## Implementation Details

The test file follows the established pattern from `deathCheckIntegration.test.js`, testing:

1. **Single Lung Destruction**: Verify NO instant death when one lung remains
2. **Both Lungs Destruction**: Verify instant death with respiratory cause
3. **Death Message**: Verify correct death message is included
4. **Order of Destruction**: Verify behavior is symmetric (left-then-right = right-then-left)
5. **Mixed Scenarios**: Verify heart/brain death still works alongside lung mechanics

## Acceptance Criteria

### Tests That Must Pass
- All new integration tests must pass
- `npm run test:integration -- tests/integration/anatomy/respiratoryOrganDeath.integration.test.js`
- No regressions in existing integration tests

### Coverage Requirements
- All scenarios from overview ticket (LUNVITORGDEA-000) must be covered:
  - ✅ Destroying one lung does NOT cause instant death
  - ✅ Destroying both lungs DOES cause instant death
  - ✅ Brain/heart/spine behavior is unchanged

### Invariants That Must Remain True
1. Tests verify full event dispatch chain
2. Tests are independent and can run in any order
3. Tests use Jest's mock cleanup in afterEach

## Verification Commands

```bash
# Run new integration test file
npm run test:integration -- tests/integration/anatomy/respiratoryOrganDeath.integration.test.js

# Run with verbose output
npm run test:integration -- tests/integration/anatomy/respiratoryOrganDeath.integration.test.js --verbose

# Verify no regressions in existing death check tests
npm run test:integration -- tests/integration/anatomy/deathCheckIntegration.test.js
```

## Estimated Diff Size

~350 lines in new test file.

## Outcome

### Files Created
- `tests/integration/anatomy/respiratoryOrganDeath.integration.test.js` (~280 lines)

### Test Results
All 11 new tests pass:
```
PASS tests/integration/anatomy/respiratoryOrganDeath.integration.test.js
  Respiratory Organ Death Integration
    single lung destruction - should NOT cause instant death
      ✓ should NOT trigger death when only left lung is destroyed
      ✓ should NOT trigger death when only right lung is destroyed
    both lungs destruction - should cause instant death
      ✓ should trigger death when both lungs are destroyed
      ✓ should dispatch death event with respiratory organ type when both lungs destroyed
    destruction order symmetry
      ✓ destroying left lung then right lung should cause death
      ✓ destroying right lung then left lung should cause death
    mixed scenarios - heart/brain/spine still cause instant death
      ✓ should trigger death when heart destroyed (single vital organ)
      ✓ should trigger death when brain destroyed even with healthy lungs
      ✓ should NOT trigger death when one lung destroyed and heart healthy
    edge cases
      ✓ should handle entity with no respiratory organs gracefully
      ✓ should handle wounded but not destroyed lungs correctly

Tests: 11 passed, 11 total
```

No regressions in existing tests (17 tests in `deathCheckIntegration.test.js` pass).

### Deviations from Original Plan
1. **Death message verification**: Original plan specified verifying `deathMessage` in result object. Actual implementation: `#checkCollectiveVitalOrganDestruction` returns `{ organType, destroyedCount }` without `deathMessage`. Tests verify `vitalOrganDestroyed` flag and death event dispatch instead, which correctly validates the functionality without requiring source code changes.

2. **Actual line count**: ~280 lines vs estimated ~350 lines (more concise implementation).
