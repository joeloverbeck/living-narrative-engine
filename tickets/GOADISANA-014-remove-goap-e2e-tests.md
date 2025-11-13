# GOADISANA-014: Remove GOAP E2E Tests

## Context

The GOAP end-to-end tests simulate complete gameplay scenarios with GOAP-controlled NPCs (cats, goblins, etc.). These tests verify that GOAP actors can select and execute actions based on goals. With the GOAP system removed, these scenarios cannot run.

**Fatal Flaw Context**: These E2E tests validated complete GOAP decision workflows including effects-based planning for NPC behavior - workflows built on the flawed effects-generation approach.

## Objective

Remove the `tests/e2e/goap/` directory containing all GOAP-specific end-to-end tests.

## Files Affected

**To be REMOVED** (16 files in `tests/e2e/goap/`):
- `catBehavior.e2e.test.js`
- `multipleActors.e2e.test.js`
- `goblinBehavior.e2e.test.js`
- `CompleteGoapDecisionWithRealMods.e2e.test.js`
- `GoalPrioritySelectionWorkflow.e2e.test.js`
- `ActionSelectionWithEffectSimulation.e2e.test.js`
- `PlanningEffectsMatchRuleExecution.e2e.test.js`
- `PlanCachingAndInvalidation.e2e.test.js`
- `MultiActorConcurrentGoapDecisions.e2e.test.js`
- `AbstractPreconditionConditionalEffects.e2e.test.js`
- `MultiTurnGoalAchievement.e2e.test.js`
- `GoalRelevanceAndSatisfactionEvaluation.e2e.test.js`
- `CrossModGoalAndActionInteraction.e2e.test.js`
- `ErrorRecoveryAndGracefulDegradation.e2e.test.js`
- `EffectsValidationCLI.e2e.test.js`
- `EffectsGenerationCLI.e2e.test.js`

## Detailed Steps

1. **Verify directory exists**:
   ```bash
   test -d tests/e2e/goap/ && echo "Directory exists" || echo "Directory not found"
   ```

2. **List files to be removed** (for documentation):
   ```bash
   find tests/e2e/goap/ -name "*.test.js" > tickets/removed-e2e-tests-list.txt
   ```

3. **Remove entire directory**:
   ```bash
   rm -rf tests/e2e/goap/
   ```

4. **Verify removal**:
   ```bash
   test -d tests/e2e/goap/ && echo "ERROR: Directory still exists" || echo "OK: Directory removed"
   ```

5. **Verify e2e tests still run** (other tests):
   ```bash
   npm run test:e2e
   ```

## Acceptance Criteria

- [ ] `tests/e2e/goap/` directory removed completely
- [ ] All 16 e2e test files removed
- [ ] List of removed files documented in `tickets/removed-e2e-tests-list.txt`
- [ ] Remaining e2e tests still pass: `npm run test:e2e` succeeds
- [ ] No orphaned test files remain in tests/e2e/
- [ ] Commit message lists all removed test files

## Dependencies

**Requires**:
- GOADISANA-011 (schema cleanup complete)

**Can run in PARALLEL with**:
- GOADISANA-012 (unit tests removal)
- GOADISANA-013 (integration tests removal)
- GOADISANA-015 (performance tests removal)
- GOADISANA-016 (memory tests removal)
- GOADISANA-017 (test helpers removal)

## Verification Commands

```bash
# Verify directory removed
test -d tests/e2e/goap/ && echo "FAIL" || echo "PASS"

# Check file list backup
cat tickets/removed-e2e-tests-list.txt

# Verify no goap test files remain
find tests/e2e/ -name "*goap*"
# Should return empty

# Run remaining e2e tests
npm run test:e2e

# Check test count
find tests/e2e/ -name "*.test.js" | wc -l
```

## Expected Test Output

After removal:
- Total e2e tests reduced by 16 files
- All remaining e2e tests should pass
- No GOAP NPC behavior tests
- NPC behavior coverage reduced (expected)

## Notable Removed Scenarios

- **catBehavior.e2e.test.js**: Cat NPC using GOAP for autonomous behavior
- **goblinBehavior.e2e.test.js**: Goblin NPC with goal-driven actions
- **PlanningEffectsMatchRuleExecution.e2e.test.js**: Validated the core flaw (effects vs execution mismatch)
- **MultiTurnGoalAchievement.e2e.test.js**: Multi-turn planning scenarios

## Future Considerations

When implementing task-based NPC system:
- Create new e2e tests for task-based behavior
- Test NPC decision-making without effects-based planning
- Verify graceful degradation with stub provider
- May want to recreate cat/goblin behavior tests with new system

## Notes

- These were the most comprehensive GOAP tests (full scenarios)
- Tests demonstrated GOAP in action but validated flawed approach
- All test files remain in git history for reference
- NPC behavior testing will need to be rebuilt for task-based system
- E2E CLI tests (EffectsValidationCLI, EffectsGenerationCLI) also removed
