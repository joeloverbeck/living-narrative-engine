# Anatomy-Based Prerequisite Test Investigation

## Issue Summary

5 tests are failing related to anatomy-based prerequisite evaluation in seduction mod actions:

1. `grab_crotch_draw_attention_action_discovery.test.js` - 1 test failing
2. `grab_crotch_draw_attention_receiving_blowjob_forbidden.test.js` - 1 test failing
3. `stroke_penis_to_draw_attention_action_discovery.test.js` - 1 test failing
4. `stroke_penis_to_draw_attention_receiving_blowjob_forbidden.test.js` - 1 test failing
5. `squeeze_breasts_draw_attention_action_discovery.test.js` - 1 test failing

All failing tests are the positive test cases (expecting action to be discovered).
All negative test cases (expecting action NOT to be discovered) pass correctly.

## Root Cause Analysis

### What Works
1. **The operators work correctly when tested in isolation**
   - Created debug test that directly calls `hasPartOfType` operator
   - Operator correctly returns `true` when entity has the required body part
   - bodyGraphService mock correctly traverses body graph and finds parts

2. **The test infrastructure is sound**
   - SimpleEntityManager correctly stores and retrieves entities
   - anatomy:body and anatomy:part components are created correctly
   - Body graph structure (pelvis → penis) is correct

3. **Negative tests pass**
   - Tests that expect NO discovery work correctly
   - This confirms the operators ARE being called and work for false cases

### What Doesn't Work
1. **Positive tests fail during action discovery pipeline**
   - Actions with anatomy prerequisites are not discovered when they should be
   - The `hasPartOfType` operator appears to not be called at all (no debug output)
   - Action discovery returns 0 actions

### Investigation Findings

1. **JsonLogic operators are correctly registered**
   - `JsonLogicCustomOperators.registerOperators()` is called in `initializeEnv()`
   - Operators are created with correct dependencies (entityManager, bodyGraphService)
   - The jsonLogic instance is shared and operators should be re-registered on reset

2. **Reset mechanism is complex**
   - `fixture.reset()` calls `resetRuleEnvironment()`
   - This creates NEW entityManager and bodyGraphService
   - New operators are created and registered on the SAME jsonLogic instance
   - However, operators should have closures over the NEW dependencies

3. **Action discovery pipeline stages**
   - ComponentFilteringStage: Filters based on required/forbidden components
   - MultiTargetResolutionStage: Resolves targets (correctly handles "none" target)
   - TargetComponentValidationStage: Validates target components
   - PrerequisiteEvaluationStage: Evaluates prerequisites (where hasPartOfType should be called)

4. **The operator is NOT being called**
   - Added console.log debugging to `hasPartOfType` operator
   - No debug output appears in failing tests
   - This suggests action is filtered out BEFORE prerequisite evaluation

### Hypothesis

The action is being filtered out at an earlier stage (likely ComponentFilteringStage or MultiTargetResolutionStage) before prerequisites are evaluated. This would explain why:
- The operator works in isolation
- Negative tests pass (they may be failing at prerequisite stage which works correctly)
- Positive tests fail (action filtered out before prerequisites)

However, the actions have no required_components, so ComponentFilteringStage shouldn't filter them out.

### Alternative Hypothesis

There may be an issue with how the action is loaded in the ActionIndex after reset. The test does:
```javascript
fixture.reset(entities);
fixture.testEnv.actionIndex.buildIndex([grabCrotchDrawAttentionAction]);
```

The actionIndex is rebuilt AFTER reset, which should be correct. But maybe there's a timing or initialization issue.

## Next Steps

1. **Add detailed logging to action discovery pipeline**
   - Log which stage filters out the action
   - Confirm whether action even enters the pipeline

2. **Verify action is correctly loaded in ActionIndex**
   - Check if action exists in index after buildIndex()
   - Verify action definition is correct

3. **Compare positive and negative test execution paths**
   - Run both tests with detailed logging
   - Identify where execution paths diverge

4. **Check if there's a scope resolution issue**
   - Action uses `targets: "none"`
   - Verify this is handled correctly in MultiTargetResolutionStage
   - Check if "none" actions reach prerequisite evaluation

## Temporary Workarounds Considered

1. **Re-register operators explicitly after reset** - Not needed, already happens
2. **Use real BodyGraphService instead of mock** - Not practical for unit tests
3. **Modify test structure to avoid reset** - Would require significant test refactoring

## Files Investigated

- `src/logic/operators/hasPartOfTypeOperator.js` - Operator implementation
- `src/logic/operators/base/BaseBodyPartOperator.js` - Base operator class
- `tests/common/engine/systemLogicTestEnv.js` - Test environment setup
- `tests/common/mods/ModTestFixture.js` - Test fixture
- `src/actions/pipeline/stages/*` - Action discovery pipeline stages
- `tests/integration/mods/seduction/*_action_discovery.test.js` - Failing tests

## Conclusion

The issue is complex and involves the interaction between:
- Test environment reset mechanism
- JsonLogic operator registration
- Action discovery pipeline
- Anatomy-based prerequisites

The operators themselves work correctly. The issue is in how they're being invoked (or not invoked) during the action discovery process after a test environment reset.

Further investigation needed to pinpoint the exact filtering stage and reason for action exclusion.
