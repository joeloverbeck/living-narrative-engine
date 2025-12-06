# WIECOM-007: Integration Tests

## Status: ✅ COMPLETED

## Summary

Create integration tests that verify the complete wielding workflow: action execution → component addition → activity description generation.

## Dependencies

- WIECOM-001 through WIECOM-005 must be completed
- WIECOM-006 should be completed (schema tests passing)

## Reassessed Assumptions (Corrected from Original)

The original ticket assumed no integration tests existed. After reassessment:

| Original Assumption                                      | Actual State                                                                                                                                                             | Impact                               |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------ |
| `wieldThreateninglyRuleExecution.test.js` needs creation | `wieldingComponentWorkflow.integration.test.js` ALREADY EXISTS with rule execution coverage                                                                              | Skip creation - already covered      |
| No rule execution tests exist                            | 285 lines of tests in `wieldingComponentWorkflow.integration.test.js` covering first wield, second wield, duplicate prevention, description regeneration, rule structure | Skip - comprehensive coverage exists |
| Activity description tests need creation                 | Activity system supports `isMultiTarget`/`targetRoleIsArray` but no wielding-specific activity description tests                                                         | CREATE - this is needed              |
| Edge case tests need creation                            | Schema tests exist but edge cases not covered at integration level                                                                                                       | CREATE - this is needed              |
| Action gating tests need creation                        | These should be stubs for future work                                                                                                                                    | CREATE - stubs only                  |

## Revised Files to Touch

| File                                                                     | Action              | Description                                                        |
| ------------------------------------------------------------------------ | ------------------- | ------------------------------------------------------------------ |
| `tests/integration/mods/weapons/wieldThreateninglyRuleExecution.test.js` | ~~CREATE~~ **SKIP** | Already covered by `wieldingComponentWorkflow.integration.test.js` |
| `tests/integration/mods/positioning/wieldingActivityDescription.test.js` | CREATE              | Activity description tests with multi-item formatting              |
| `tests/integration/mods/weapons/wieldingEdgeCases.test.js`               | CREATE              | Edge case tests                                                    |
| `tests/integration/mods/weapons/wieldingActionGating.test.js`            | CREATE              | Action gating stubs (skipped)                                      |

## Out of Scope

- **DO NOT** modify any source code files
- **DO NOT** modify any mod data files
- **DO NOT** modify any existing test files
- **DO NOT** create unit tests (see WIECOM-006)
- **DO NOT** implement action gating tests (documented for future)
- **DO NOT** test stop-wielding functionality (not yet implemented)

## Implementation Details

### Test Suite 1: Rule Execution - ALREADY EXISTS

**File**: `tests/integration/mods/weapons/wieldingComponentWorkflow.integration.test.js`

This file ALREADY provides comprehensive coverage:

- ✅ First wield component creation
- ✅ Second wield array append
- ✅ Duplicate wield prevention
- ✅ Description regeneration trigger
- ✅ Rule structure validation (QUERY_COMPONENT, IF, MODIFY_ARRAY_FIELD, ADD_COMPONENT, REGENERATE_DESCRIPTION)

**No additional rule execution tests needed.**

### Test Suite 2: Activity Description - TO CREATE

**File**: `tests/integration/mods/positioning/wieldingActivityDescription.test.js`

Tests activity system integration with wielding component's multi-item array support.

### Test Suite 3: Edge Cases - TO CREATE

**File**: `tests/integration/mods/weapons/wieldingEdgeCases.test.js`

Tests edge conditions at integration level.

### Test Suite 4: Action Gating (Future) - TO CREATE

**File**: `tests/integration/mods/weapons/wieldingActionGating.test.js`

Stubs only - for future implementation.

## Acceptance Criteria

### Specific Tests That Must Pass

```bash
# Existing workflow tests
NODE_ENV=test npx jest tests/integration/mods/weapons/wieldingComponentWorkflow.integration.test.js --no-coverage --verbose

# New activity description tests
NODE_ENV=test npx jest tests/integration/mods/positioning/wieldingActivityDescription.test.js --no-coverage --verbose

# New edge case tests
NODE_ENV=test npx jest tests/integration/mods/weapons/wieldingEdgeCases.test.js --no-coverage --verbose

# Full integration suite
NODE_ENV=test npm run test:integration -- --testPathPattern="wield" --no-coverage
```

### Invariants That Must Remain True

1. Tests use `ModTestFixture` pattern from `docs/testing/mod-testing-guide.md`
2. Tests follow existing integration test patterns
3. Tests properly clean up after each test (`afterEach`)
4. Tests use domain matchers from `tests/common/mods/domainMatchers.js`
5. Tests don't modify global state
6. Action gating tests are `describe.skip` (not implemented yet)
7. All tests are deterministic (no timing issues)

## Reference Files

Study these for test patterns:

- `tests/integration/mods/weapons/wieldingComponentWorkflow.integration.test.js` - Existing workflow test
- `tests/integration/mods/weapons/wield_threateningly_action.test.js` - Existing action test
- `tests/integration/mods/positioning/kneel_before_action.test.js` - Rule execution pattern
- `docs/testing/mod-testing-guide.md` - ModTestFixture usage

## Diff Size Estimate

Creating 3 new test files (reduced from 4):

- `wieldingActivityDescription.test.js`: ~100 lines
- `wieldingEdgeCases.test.js`: ~80 lines
- `wieldingActionGating.test.js`: ~40 lines (stubs only)

Total: ~220 lines of new test code (reduced from ~340).

## Outcome

### Implementation Summary

Successfully created 3 new integration test files as planned:

| File                                                                     | Tests | Lines | Status             |
| ------------------------------------------------------------------------ | ----- | ----- | ------------------ |
| `tests/integration/mods/positioning/wieldingActivityDescription.test.js` | 10    | ~393  | ✅ All passing     |
| `tests/integration/mods/weapons/wieldingEdgeCases.test.js`               | 8     | ~335  | ✅ All passing     |
| `tests/integration/mods/weapons/wieldingActionGating.test.js`            | 10    | ~61   | ✅ Skipped (stubs) |

### Test Coverage Added

**Activity Description Tests (10 tests)**:

- Single weapon description generation and formatting
- Two weapons with "and" conjunction
- Three weapons with Oxford comma formatting
- Four+ weapons formatting
- `shouldDescribeInActivity: false` behavior
- Priority 70 default
- `targetRoleIsArray` flag preservation
- `{actor}` placeholder replacement
- `{targets}` placeholder replacement

**Edge Case Tests (8 tests)**:

- Empty `wielded_item_ids` array handling
- Namespaced weapon IDs (e.g., `weapons:silver_revolver`)
- Mixed namespaced and simple IDs
- Component removal gracefully handled
- Many wielded items (5+) support
- Stale/missing weapon entity references
- IDs with underscores
- IDs with hyphens

**Action Gating Stubs (10 todo tests)**:

- Wield action gating scenarios
- Stop-wield action gating scenarios
- Action discovery filtering

### Test Results

```
Test Suites: 1 skipped, 9 passed, 9 of 10 total
Tests:       10 skipped, 107 passed, 117 total
```

### Key Findings During Implementation

1. **Activity metadata property name**: The `ActivityMetadataCollectionSystem` uses `sourceComponent` not `sourceComponentId` for tracking component sources
2. **EntityManager.getComponent returns null**: When component not found, returns `null` not `undefined`
3. **Test patterns**: Used `AnatomyIntegrationTestBed` for activity description tests and `ModTestFixture.forAction()` for edge case tests

### Files Created

1. `tests/integration/mods/positioning/wieldingActivityDescription.test.js` (~393 lines)
2. `tests/integration/mods/weapons/wieldingEdgeCases.test.js` (~335 lines)
3. `tests/integration/mods/weapons/wieldingActionGating.test.js` (~61 lines)
