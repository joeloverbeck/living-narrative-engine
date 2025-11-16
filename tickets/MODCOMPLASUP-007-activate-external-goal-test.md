# MODCOMPLASUP-007: Activate and Fix External Goal Satisfaction Test

**Spec Reference**: `specs/modify-component-planner-support.md` - Section 8, Integration Tests
**Related GOAP Spec**: `specs/goap-system-specs.md` - Goal selection, replanning

## Summary
Activate the currently skipped "External Goal Satisfaction" integration test and verify it passes with the new numeric constraint planning implementation.

## Problem
The test at `tests/integration/goap/replanning.integration.test.js:157-249` is currently skipped because the planner cannot handle numeric goals with MODIFY_COMPONENT effects. With the new implementation complete, this test should now pass.

## Test Details

### Location
**File**: `tests/integration/goap/replanning.integration.test.js`
**Lines**: 157-249
**Status**: Currently marked with `.skip`

### Test Scenario
```javascript
it('should handle goal satisfied externally between turns', async () => {
  // Setup hunger system
  const { controller, entityManager } = await createGoapTestSetup({
    tasks: {
      test: {
        eat: {
          id: 'test:eat',
          planningEffects: [{
            type: 'MODIFY_COMPONENT',
            parameters: {
              entityId: 'actor',
              componentId: 'core:needs',
              modifications: { hunger: -60 },
              mode: 'decrement'
            }
          }]
        }
      }
    }
  });

  // Create actor with hunger
  const actorId = entityManager.createEntity('test:actor');
  entityManager.addComponent(actorId, 'core:needs', { hunger: 80 });

  // Register goal
  const goal = createTestGoal({
    id: 'test:hunger_goal',
    relevance: { '>': [{ var: 'actor.components.core:needs.hunger' }, 50] },
    goalState: { '<=': [{ var: 'actor.components.core:needs.hunger' }, 30] }
  });

  // Execute first turn - should select eat action
  await controller.executeTurn(actorId);

  // Verify plan selected eat action
  const plan = controller.getActivePlan();
  expect(plan.tasks).toContainEqual(expect.objectContaining({ id: 'test:eat' }));
});
```

## Objectives
- Remove `.skip` from the test
- Verify test passes with new implementation
- Fix any issues that prevent the test from passing
- Ensure test assertions are comprehensive

## Implementation Steps

### Step 1: Remove Skip Marker
```javascript
// Line 157 - BEFORE
it.skip('should handle goal satisfied externally between turns', async () => {

// Line 157 - AFTER
it('should handle goal satisfied externally between turns', async () => {
```

### Step 2: Run Test and Verify

```bash
npm run test:integration -- tests/integration/goap/replanning.integration.test.js --testNamePattern="should handle goal satisfied externally"
```

### Step 3: Fix Any Failures

If test fails, investigate:
1. **Goal relevance not detected**: Check if relevance condition evaluates correctly
2. **Goal distance calculation incorrect**: Verify NumericConstraintEvaluator
3. **Action not applicable**: Check GoapPlanner._isActionApplicable logic
4. **Plan creation failed**: Verify planner can find path to goal
5. **Test setup issues**: Ensure test data properly configured

### Step 4: Enhance Assertions

Add comprehensive assertions to verify behavior:

```javascript
it('should handle goal satisfied externally between turns', async () => {
  // ... existing setup ...

  // Execute first turn
  await controller.executeTurn(actorId);

  // Verify plan created
  const plan = controller.getActivePlan(actorId);
  expect(plan).toBeDefined();
  expect(plan.tasks).toBeDefined();
  expect(plan.tasks).toHaveLength(1);
  expect(plan.tasks[0].id).toBe('test:eat');

  // Verify goal distance calculation
  const currentState = {
    actor: {
      components: {
        'core:needs': { hunger: 80 }
      }
    }
  };

  const heuristic = controller.getHeuristic();
  const distance = heuristic.calculateDistance(currentState, goal);
  expect(distance).toBe(50); // 80 - 30 = 50

  // Simulate action effect
  const nextState = {
    actor: {
      components: {
        'core:needs': { hunger: 20 } // 80 - 60
      }
    }
  };

  const nextDistance = heuristic.calculateDistance(nextState, goal);
  expect(nextDistance).toBe(0); // Goal satisfied
});
```

## Dependencies
- MODCOMPLASUP-001: NumericConstraintEvaluator implemented
- MODCOMPLASUP-002: GoalDistanceHeuristic enhanced
- MODCOMPLASUP-003: DI registration complete
- MODCOMPLASUP-004: GoapPlanner enhanced
- MODCOMPLASUP-005: PlanningEffectsSimulator enhanced
- MODCOMPLASUP-006: Integration tests passing

## Testing Requirements

### Validation Commands
```bash
# Run specific test
npm run test:integration -- tests/integration/goap/replanning.integration.test.js --testNamePattern="should handle goal satisfied externally"

# Run full replanning test suite
npm run test:integration -- tests/integration/goap/replanning.integration.test.js

# Run all GOAP integration tests
npm run test:integration -- tests/integration/goap/
```

### Success Criteria for Test
- ✅ Test executes without `.skip`
- ✅ Goal relevance correctly evaluated
- ✅ Goal distance correctly calculated (50 for initial state)
- ✅ Eat action identified as applicable
- ✅ Plan created with eat action
- ✅ Post-action distance correctly calculated (0 for satisfied goal)
- ✅ No errors or warnings in test output

## Troubleshooting Guide

### Issue 1: Test Times Out
**Symptoms**: Test hangs or exceeds timeout
**Cause**: Infinite planning loop or slow heuristic
**Fix**: Add timeout to test, verify heuristic performance

### Issue 2: Plan is Null
**Symptoms**: `expect(plan).toBeDefined()` fails
**Cause**: No applicable actions found
**Fix**: Verify action applicability logic, check preconditions

### Issue 3: Wrong Distance Calculated
**Symptoms**: Distance assertion fails
**Cause**: NumericConstraintEvaluator bug
**Fix**: Debug calculateDistance with test state

### Issue 4: Action Not Selected
**Symptoms**: Plan doesn't contain eat action
**Cause**: Action doesn't reduce distance or preconditions fail
**Fix**: Verify _actionReducesDistance logic

## Acceptance Criteria
- [ ] `.skip` removed from test (line 157)
- [ ] Test runs without skip
- [ ] All test assertions pass
- [ ] Test execution time < 1 second
- [ ] No errors in console output
- [ ] No warnings about missing dependencies
- [ ] Test demonstrates correct numeric planning behavior
- [ ] Related tests in suite still passing
- [ ] ESLint passes
- [ ] TypeScript type checking passes

## Estimated Effort
0.5 hours (if implementation correct) to 1 hour (if debugging needed)

## Follow-up Tickets
- MODCOMPLASUP-008: Update GOAP documentation
- MODCOMPLASUP-009: Schema updates for MODIFY_COMPONENT
