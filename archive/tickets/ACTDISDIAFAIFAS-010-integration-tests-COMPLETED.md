# ACTDISDIAFAIFAS-010 – Diagnostic Integration Tests

## Problem

Need end-to-end validation that diagnostics work across the full pipeline and reproduce the original failure scenario from the spec.

## Corrections Made (API Discrepancies)

During implementation, the following discrepancies were found between the original ticket assumptions and the actual codebase:

| Original Assumption | Actual Implementation |
|---------------------|----------------------|
| `fixture.discoverActionsWithDiagnostics(actorId)` | Method on `ActionDiscoveryServiceTestBed`, not `ModTestFixture`. ModTestFixture has `discoverWithDiagnostics(actorId, expectedActionId)` for console-based debugging |
| `result.diagnostics.componentFiltering.rejectedActions` directly from ModTestFixture | `DiscoveryDiagnostics` on ModTestFixture wraps scope resolver only and logs to console. True programmatic diagnostics available via `ActionDiscoveryService.getValidActions(actor, {}, { diagnostics: true })` |
| `skipComponents` option in `createStandardActorTarget` | Does **NOT exist** - must use `ModEntityBuilder` directly without closeness component |
| `expect(actions).toContainAction()` works automatically | Must import domain matchers: `import '../../common/mods/domainMatchers.js'` |

## Proposed Scope

Create integration tests that:
1. Validate end-to-end diagnostic flow with real mod definitions
2. Reproduce the original `get_close` failure scenario
3. Verify diagnostics would have explained the issue
4. Test condition_ref error suggestions with real conditions

## File List

- `tests/integration/actions/actionDiscoveryDiagnosticsIntegration.test.js` (NEW)
- `tests/integration/mods/personal-space/get_close_diagnostics.test.js` (NEW)

## Out of Scope

- Production code changes (all code changes completed in prior tickets)
- Additional feature work
- Performance testing
- Modifying existing mod files
- Creating new mod definitions

## Acceptance Criteria

### Tests

Run:
- `npm run test:integration -- tests/integration/actions/actionDiscoveryDiagnosticsIntegration.test.js`
- `npm run test:integration -- tests/integration/mods/personal-space/get_close_diagnostics.test.js`

#### actionDiscoveryDiagnosticsIntegration.test.js

Required test cases:
- **End-to-end diagnostic flow with real mod definitions**: Load real mods, request diagnostics
- **ComponentFilteringStage rejections captured**: Forbidden component rejections in diagnostics
- **TargetValidationStage rejections captured**: Target validation failures in diagnostics
- **Scope resolution errors include context**: Errors have sufficient debugging info
- **Diagnostics match actual rejection reasons**: Diagnostics accurately reflect what happened
- **Empty diagnostics when all actions available**: Clean success case
- **Diagnostics don't affect action results**: Same actions returned with/without diagnostics

#### get_close_diagnostics.test.js

Required test cases:
- **Reproduces original failure scenario from spec**: Actor with closeness component
- **Diagnostics explain forbidden_component rejection**: Clear explanation
- **Specifies which component caused rejection**: `personal-space-states:closeness`
- **Specifies which action was rejected**: `personal-space:get_close`
- **Without diagnostics, action simply not returned**: Original behavior preserved
- **Removing component allows action**: Demonstrates the fix

### Invariants

- Tests use real mod data from `data/mods/`, not mocks
- Tests don't modify existing mod files
- Tests validate spec requirements are met
- Tests follow existing integration test patterns
- Tests cleanup properly (no state leakage)

### Test Structure (Corrected)

```javascript
// tests/integration/mods/personal-space/get_close_diagnostics.test.js
import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder, ModEntityScenarios } from '../../../common/mods/ModEntityBuilder.js';
import '../../../common/mods/domainMatchers.js';

describe('get_close action diagnostic reproduction', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction('personal-space', 'personal-space:get_close');
  });

  afterEach(() => {
    fixture.cleanup();
  });

  it('reproduces original failure: actor with closeness component', async () => {
    // Create actor WITH the closeness component (original problem)
    const scenario = fixture.createStandardActorTarget(['Actor', 'Target']);

    // Action not available (original behavior)
    const actions = await fixture.discoverActions(scenario.actor.id);
    expect(actions).not.toContainAction('personal-space:get_close');
  });

  it('removing closeness component allows action', async () => {
    // Create actor WITHOUT the closeness component using ModEntityBuilder
    const actor = fixture.createEntity()
      .withId('actor-no-closeness')
      .asActor()
      .withName('Actor')
      .atLocation(fixture.getDefaultLocation())
      .build();

    const target = fixture.createEntity()
      .withId('target-entity')
      .asActor()
      .withName('Target')
      .atLocation(fixture.getDefaultLocation())
      .build();

    const actions = await fixture.discoverActions(actor.id);
    expect(actions).toContainAction('personal-space:get_close');
  });
});
```

### Validation Requirements

From spec `action-discovery-diagnostics-fail-fast.md`:

1. **Action Discovery with Diagnostics**: Verify diagnostic output matches spec format
2. **condition_ref Error with Context**: Verify context fields present in errors
3. **Test Fixture Validation**: Verify warning would have been logged

## Dependencies

- ACTDISDIAFAIFAS-008 (ActionDiscoveryService Diagnostics) - must be completed first
- ACTDISDIAFAIFAS-009 (ModTestFixture Warnings) - must be completed first

---

## ✅ COMPLETED

**Date**: 2026-01-04

### Implementation Summary

Created two integration test files that validate the action discovery diagnostics system:

1. **`tests/integration/actions/actionDiscoveryDiagnosticsIntegration.test.js`** (12 tests)
   - End-to-end diagnostic flow with real mod definitions
   - ComponentFilteringStage rejections captured in diagnostics
   - TargetValidationStage rejections captured in diagnostics
   - Scope resolution errors include context
   - Diagnostics match actual rejection reasons
   - Empty diagnostics when all actions available
   - Diagnostics don't affect action results
   - Zero overhead when diagnostics disabled
   - Error handling in diagnostics aggregation

2. **`tests/integration/mods/personal-space/get_close_diagnostics.test.js`** (9 tests)
   - Reproduces original failure scenario from spec
   - Diagnostics explain forbidden_component rejection
   - Specifies which component caused rejection (`personal-space-states:closeness`)
   - Specifies which action was rejected (`personal-space:get_close`)
   - Without diagnostics, action simply not returned
   - Removing component allows action
   - Spec validation requirements

### Test Results

```
PASS tests/integration/actions/actionDiscoveryDiagnosticsIntegration.test.js (12 tests)
PASS tests/integration/mods/personal-space/get_close_diagnostics.test.js (9 tests)

Test Suites: 2 passed, 2 total
Tests:       21 passed, 21 total
```

### Acceptance Criteria Met

- ✅ End-to-end diagnostic flow validates properly
- ✅ Original `get_close` failure scenario reproduced
- ✅ Diagnostics would have explained the issue
- ✅ Tests use real mod data from `data/mods/`
- ✅ Tests don't modify existing mod files
- ✅ Tests follow existing integration test patterns
- ✅ Tests cleanup properly (no state leakage)

### API Corrections Applied

The ticket's original assumptions about the API were corrected:
- Used `ActionDiscoveryService.getValidActions(actor, {}, { diagnostics: true })` directly
- Used `ModEntityBuilder` without non-existent `skipComponents` option
- Imported domain matchers correctly
