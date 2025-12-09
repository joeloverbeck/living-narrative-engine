# TREWOUACT-006: Create Rule Execution Integration Tests

**Status**: ✅ Completed

## Summary
Create comprehensive integration tests for the `handle_treat_wounded_part` rule, verifying rule structure for all four outcome branches (CRITICAL_SUCCESS, SUCCESS, FAILURE, FUMBLE) and executing the SUCCESS path via the default mock behavior.

## Files to Touch
- `tests/integration/mods/first-aid/handle_treat_wounded_part_rule.test.js` (CREATE)

## Out of Scope
- DO NOT modify any mod data files (those are TREWOUACT-001 through 004)
- DO NOT create action discovery tests (that's TREWOUACT-005)
- DO NOT modify any existing test files
- DO NOT modify test infrastructure (ModTestFixture, ModEntityBuilder, etc.)
- DO NOT modify the fixture or helper files in `tests/common/`
- DO NOT modify operation handlers (MODIFY_PART_HEALTH, APPLY_DAMAGE)

## Corrected Assumptions (vs Original Ticket)

### Original Assumptions (Incorrect)
| Assumption | Reality |
|------------|---------|
| Outcome path: `context.outcomeType` | Actual: `context.treatmentResult.outcome` |
| Outcome mocking via `additionalPayload.outcomeType` | Not supported - RESOLVE_OUTCOME uses internal mock |
| Reference test (disinfect) shows outcome testing | Disinfect is deterministic, no RESOLVE_OUTCOME |
| Each outcome can be tested via execution | `chanceCalculationService` mock always returns SUCCESS |

### Corrected Testing Approach
Since the test infrastructure's `chanceCalculationService.resolveOutcome()` mock always returns `SUCCESS`:

1. **Test SUCCESS path via actual execution** - The default mock behavior
2. **Test rule structure** - Validate IF conditions and operations for all 4 outcomes exist
3. **Skip actual execution for other outcomes** - Would require infrastructure changes out of scope

This matches the pattern used in other chance-based rule tests like `throw_item_at_target_rule_execution.test.js`.

## Implementation Details

### Test File Structure
Follow the pattern established in `tests/integration/mods/first-aid/handle_disinfect_wounded_part_rule.test.js`.

```javascript
import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';
import treatRule from '../../../../data/mods/first-aid/rules/handle_treat_wounded_part.rule.json' assert { type: 'json' };
import treatCondition from '../../../../data/mods/first-aid/conditions/event-is-action-treat-wounded-part.condition.json' assert { type: 'json' };

const ACTION_ID = 'first-aid:treat_wounded_part';
```

### Required Test Scenarios

1. **SUCCESS outcome (via execution)**
   - Uses default mock returning SUCCESS
   - Heals +10 HP on the wounded body part
   - Logs proper message: "{actorName} successfully treats {targetName}'s wounded {bodyPartName}."
   - Regenerates descriptions for primary and secondary
   - Health is clamped to maxHealth bounds

2. **Action filtering (via execution)**
   - Rule ignores unrelated actions (e.g., `core:wait`)

3. **Rule structure validation (static analysis)**
   - Validates all 4 IF conditions exist with correct outcome checks
   - RESOLVE_OUTCOME operation comes before IF conditions
   - `result_variable` is `treatmentResult`

4. **CRITICAL_SUCCESS branch structure**
   - MODIFY_PART_HEALTH with delta +20
   - 2 REGENERATE_DESCRIPTION operations (primary and secondary)

5. **FUMBLE branch structure**
   - APPLY_DAMAGE with 10 piercing damage
   - 2 REGENERATE_DESCRIPTION operations

6. **FAILURE branch structure**
   - No MODIFY_PART_HEALTH or APPLY_DAMAGE
   - No REGENERATE_DESCRIPTION operations

### Scenario Setup Requirements
Each execution test needs:
- A room entity
- A medic actor with `skills:medicine_skill`
- A patient actor with `anatomy:body`
- A wounded body part with `anatomy:part_health` (currentHealth < maxHealth)

## Acceptance Criteria

### Specific Tests That Must Pass
All tests in this file must pass:
- `npm run test:integration -- tests/integration/mods/first-aid/handle_treat_wounded_part_rule.test.js`

### Test Coverage Requirements
- At least 7 distinct test cases
- Test SUCCESS execution with health modification
- Test action filtering for unrelated events
- Test rule structure for all 4 outcome branches
- Test specific operations in each branch

### Invariants That Must Remain True
- Existing test files unchanged
- Test infrastructure (ModTestFixture, etc.) unchanged
- `MODIFY_PART_HEALTH` operation handler unchanged
- `APPLY_DAMAGE` operation handler unchanged
- No modifications to the JSON rule file during test execution

## Verification Steps
1. Run `npm run test:integration -- tests/integration/mods/first-aid/handle_treat_wounded_part_rule.test.js`
2. Verify all tests pass
3. Verify no test pollution (tests are independent)
4. Run ESLint on new file: `npx eslint tests/integration/mods/first-aid/handle_treat_wounded_part_rule.test.js`

## Dependencies
- TREWOUACT-002 (condition file must exist) ✅
- TREWOUACT-004 (rule file must exist) ✅

## Estimated Complexity
Medium - requires understanding of rule structure validation and execution testing patterns

## Outcome

### Files Created
- `tests/integration/mods/first-aid/handle_treat_wounded_part_rule.test.js` - 7 test cases covering SUCCESS execution and rule structure validation

### Infrastructure Fixes Required
Despite the "Out of Scope" constraints, the following infrastructure fixes were necessary to make the tests pass (user explicitly overrode constraints):

1. **`tests/common/mods/ModTestHandlerFactory.js`**:
   - Added `MODIFY_PART_HEALTH` handler registration
   - Extended `NON_OPERATION_TYPES` to include damage types (piercing, slashing, etc.) to fix validation false positives
   - Added `'first-aid'` to `categoryMappings`

2. **`tests/common/engine/systemLogicTestEnv.js`**:
   - Added `NON_OPERATION_TYPES` set to exclude damage types from operation validation

3. **`src/logic/operationHandlers/modifyPartHealthHandler.js`** (production fix):
   - Added import for `resolveEntityId` from `entityRefUtils.js`
   - Modified `#resolveEntityRef` to use `resolveEntityId` for placeholder support (e.g., "secondary", "actor")

### Key Discovery: Macro Behavior Difference
The rule uses `core:logSuccessOutcomeAndEndTurn` macro which does NOT dispatch `core:perceptible_event` (unlike `core:logSuccessAndEndTurn` used by deterministic rules). Test assertions were adjusted with `shouldHavePerceptibleEvent: false`.

### Test Results
All 7 tests pass:
- ✅ `successfully executes treat action and heals body part (SUCCESS outcome)`
- ✅ `ignores unrelated actions`
- ✅ `rule structure has correct IF conditions for all four outcomes`
- ✅ `rule has RESOLVE_OUTCOME operation before IF conditions`
- ✅ `CRITICAL_SUCCESS branch applies +20 HP and regenerates descriptions`
- ✅ `FUMBLE branch applies damage via APPLY_DAMAGE operation`
- ✅ `FAILURE branch has no health-modifying operations`
