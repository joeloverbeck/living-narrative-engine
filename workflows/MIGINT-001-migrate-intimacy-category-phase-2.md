# MIGINT-001: Migrate Intimacy Category Test Suites - Phase 2

## Objective

Migrate the next 9 test files of the remaining 17 files in the Intimacy category from legacy `createRuleTestEnvironment` patterns to the new ModTestFixture infrastructure, building on the successful patterns established in Phase 1.

## Background

Phase 1 successfully migrated 9 of 27 intimacy test files to ModTestFixture, achieving 80-90% code reduction while preserving all test functionality. Phase 2 continues this migration with 9 additional files, focusing on standard action tests that follow similar patterns to those already completed.

The ModTestFixture pattern has been proven to work excellently for intimacy category tests, providing significant improvements in maintainability and readability through helper methods and simplified event validation.

## Dependencies

- **TSTAIMIG-010**: Phase 1 migration completed ✅
- Established ModTestFixture patterns from Phase 1
- Direct usage pattern (not inheritance) validated
- Helper methods and assertion utilities proven effective

## Target Files (Phase 2)

**9 of the remaining 17 files using createRuleTestEnvironment:**

1. `hug_tight_rule_execution.test.js`
2. `kiss_back_passionately.test.js`  
3. `kiss_cheek_action.test.js`
4. `kiss_neck_sensually_action.test.js`
5. `lick_lips_action.test.js`
6. `massage_shoulders_action.test.js`
7. `nibble_earlobe_playfully_action.test.js`
8. `nibble_lower_lip.test.js`
9. `nuzzle_face_into_neck_action.test.js`

**Migration approach:**
- Apply direct ModTestFixture.forAction() pattern
- Use async beforeEach as required
- Leverage createCloseActors() and assertion helpers
- Consider auto-loading to reduce imports

## Implementation Steps

### Step 1: Initial Assessment
- Review each target file for unique patterns or complexity
- Identify any special relationship component requirements
- Document any deviations from standard patterns

### Step 2: Batch Migration (Files 1-5)
```javascript
// Target Pattern (from Phase 1 success)
import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';

describe('intimacy:[action_name] action integration', () => {
  let testFixture;

  beforeEach(async () => {
    // Option 1: With explicit imports
    testFixture = await ModTestFixture.forAction(
      'intimacy',
      'intimacy:[action_name]',
      actionRule,
      conditionFile
    );
    
    // Option 2: With auto-loading (preferred for Phase 2)
    testFixture = await ModTestFixture.forAction(
      'intimacy',
      'intimacy:[action_name]'
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('successfully executes [action description]', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob']);
    
    // Add relationship-specific components if needed
    // Reset entities after component modifications
    
    await testFixture.executeAction(scenario.actor.id, scenario.target.id);
    
    // Use assertion helpers or direct event inspection
    testFixture.assertActionSuccess();
  });
});
```

### Step 3: Batch Migration (Files 6-9)
- Continue applying established patterns
- Document any edge cases or special handling required
- Ensure consistency with Phase 1 migrations

### Step 4: Validation
- Run all migrated tests to ensure they pass
- Verify code reduction targets (80-90%)
- Check performance regression (<30%)
- Ensure all test cases are preserved

## Acceptance Criteria

### Technical Requirements

- [ ] **ModTestFixture Direct Usage**
  - [ ] Use `await ModTestFixture.forAction()` in beforeEach
  - [ ] Apply async pattern correctly
  - [ ] No class inheritance (direct usage only)
  - [ ] Proper cleanup in afterEach

- [ ] **Code Simplification**
  - [ ] Remove manual handler creation
  - [ ] Eliminate complex mocking boilerplate
  - [ ] Use helper methods (createCloseActors, etc.)
  - [ ] Leverage assertion helpers where appropriate

- [ ] **Auto-Loading Feature**
  - [ ] Evaluate auto-loading for each file
  - [ ] Use when it reduces complexity
  - [ ] Document decision for each file

### Quality Metrics

- [ ] **Code Reduction**: 80-90% reduction achieved for all 9 files
- [ ] **Test Preservation**: 100% of test cases maintained
- [ ] **Performance**: <30% regression limit maintained
- [ ] **Pattern Consistency**: Matches Phase 1 patterns

## File Naming Reminders

- **Rule files**: Use underscores (e.g., `kiss_back_passionately.rule.json`)
- **Condition files**: Use hyphens (e.g., `event-is-action-kiss-back-passionately.condition.json`)
- **Test files**: Use underscores (e.g., `kiss_back_passionately.test.js`)

## Special Considerations

### hug_tight_rule_execution.test.js
- Note: This is a rule execution test, not just action discovery
- May require special handling compared to standard action tests
- Verify if it tests multiple rule paths or edge cases

### Relationship Component Patterns
Based on Phase 1, these components may be needed:
- `intimacy:kissing` - for kiss-related actions
- `intimacy:touching` - for physical contact actions
- Remember to call `testFixture.reset()` after adding components

## Success Criteria

### Quantitative
- [ ] 9 files successfully migrated
- [ ] 80-90% code reduction per file
- [ ] <30% performance regression
- [ ] All tests passing

### Qualitative
- [ ] Improved readability and maintainability
- [ ] Consistent with Phase 1 patterns
- [ ] Clear documentation of any special cases
- [ ] Ready for Phase 3 migration

## Deliverables

1. **9 Migrated Test Files**
   - Following ModTestFixture pattern
   - Properly async/await implemented
   - Using appropriate helper methods

2. **Migration Notes**
   - Document any special handling required
   - Note auto-loading decisions
   - Capture lessons for Phase 3

3. **Validation Report**
   - Test execution results
   - Performance metrics
   - Code reduction measurements

## Next Steps

Upon completion of Phase 2:
- **MIGINT-002**: Phase 3 migration (final 8 files)
- Will complete the intimacy category migration
- Includes complex rule tests in rules/ subdirectory
- Special handling for closenessActionAvailability test

## Risk Mitigation

- If a file proves unusually complex, document why and consider deferring to Phase 3
- Keep original files as reference until migration is validated
- Run tests frequently during migration to catch issues early
- Consider grouping similar action patterns for efficiency

## Definition of Done

- [ ] All 9 target files migrated to ModTestFixture
- [ ] All tests passing with no regressions
- [ ] Code reduction targets achieved
- [ ] Migration notes documented
- [ ] Ready for Phase 3 migration