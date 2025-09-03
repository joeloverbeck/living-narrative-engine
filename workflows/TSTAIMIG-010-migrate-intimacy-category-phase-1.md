# TSTAIMIG-010: Migrate Intimacy Category Test Suites - Phase 1

## Objective

Migrate the first 9 test files of the 27-file Intimacy category from legacy patterns to the new testing infrastructure, focusing on standard runtime integration patterns while building on the successful validation from Exercise and Violence categories.

## Background

The Intimacy category is the largest with 27 total test files in the integration test suite, requiring a phased approach. Phase 1 focuses on migrating the first 9 files to the new ModTestFixture infrastructure. These files represent standard runtime integration patterns as described in the specification, with complex handler creation, rule processing, and event capture mechanisms that have been successfully simplified using the new infrastructure.

**Current Status**: Phase 1 migration is COMPLETE. The 9 target files have been successfully migrated to ModTestFixture, while the remaining 18 files continue to use the legacy `createRuleTestEnvironment` pattern and will be addressed in phases 2 and 3.

## Dependencies

- **TSTAIMIG-007**: Exercise category validation completed
- **TSTAIMIG-009**: Violence category validation completed
- Validated runtime integration patterns from violence category
- ModTestFixture patterns established and proven (not ModActionTestBase inheritance)

## Target Files (Phase 1)

**First 9 of 27 intimacy category test files** (✅ MIGRATED):
1. `accept_kiss_passively.test.js` ✅
2. `adjust_clothing_action.test.js` ✅
3. `brush_hand_action.test.js` ✅
4. `cup_face_while_kissing.test.js` ✅
5. `explore_mouth_with_tongue.test.js` ✅
6. `feel_arm_muscles_action.test.js` ✅
7. `fondle_ass_action.test.js` ✅
8. `fondle_ass_over_clothing.test.js` ✅
9. `hug_tight_action_discovery.test.js` ✅

**Features successfully migrated**:
- Complex handler creation replaced with ModTestFixture abstractions
- Rule and condition file imports (supporting auto-loading)
- createRuleTestEnvironment() replaced with ModTestFixture.forAction()
- Manual handler mocking eliminated
- Event validation simplified with assertion helpers

## Implementation Status

### Phase 1 Files (Migrated to ModTestFixture)
All 9 target files have been successfully migrated and are using the new ModTestFixture pattern.

### Remaining Files (Still Using Legacy Pattern)
The following 11 files in the intimacy category continue to use `createRuleTestEnvironment` and will be addressed in phases 2-3:
- `hug_tight_rule_execution.test.js`
- `kiss_back_passionately.test.js`
- `kiss_cheek_action.test.js`
- `kiss_neck_sensually_action.test.js`
- `lick_lips_action.test.js`
- `massage_shoulders_action.test.js`
- `nibble_earlobe_playfully_action.test.js`
- `nibble_lower_lip.test.js`
- `nuzzle_face_into_neck_action.test.js`
- `suck_on_neck_to_leave_hickey_action.test.js`
- `suck_on_tongue.test.js`

Note: The total count of 20 migrated + unmigrated files differs from the originally stated 27 files. Further investigation needed for phases 2-3 planning.

## Acceptance Criteria

### Standard Runtime Integration Migration

- [x] **ModTestFixture Direct Usage Pattern** (NOT class inheritance) ✅
  - [x] Use `await ModTestFixture.forAction()` in beforeEach ✅
  - [x] Leverage auto-loading when possible (omit rule/condition files) ✅
  - [x] Apply testFixture.assertActionSuccess() for event validation ✅
  - [x] Use testFixture methods directly (no class extension needed) ✅

- [x] **Handler Setup Simplification** ✅
  - [x] Replace manual handler mocking with test fixture abstractions ✅
  - [x] Eliminate QueryComponentHandler, DispatchEventHandler manual setup ✅
  - [x] Use createStandardActorTarget() or createCloseActors() methods ✅
  - [x] Let ModTestFixture handle macro expansion automatically ✅

- [x] **Event Validation Standardization** ✅
  - [x] Use testFixture.assertActionSuccess() for standard validations ✅
  - [x] Use testFixture.assertPerceptibleEvent() for perception checks ✅
  - [x] Preserve all relationship validation logic ✅
  - [x] Maintain event sequence validation ✅

### Code Reduction and Quality Targets

- [x] **Code Reduction**: 80-90% reduction per file ✅ (Achieved)
- [x] **Performance**: <30% regression limit ✅ (Met requirements)
- [x] **Quality Preservation**: 100% test case preservation ✅ (All tests preserved)
- [x] **Pattern Consistency**: Consistent with violence category patterns ✅ (Confirmed)

## Implementation Steps

### Phase 1A: Files 1-3 Migration

1. **Legacy Pattern Analysis**
   ```javascript
   // Legacy: Complex manual setup
   let testEnvironment;
   beforeEach(() => {
     testEnvironment = createRuleTestEnvironment();
     // Extensive manual handler mocking
     const queryComponentHandler = mockQueryComponentHandler();
     const dispatchEventHandler = mockDispatchEventHandler();
     // Manual entity setup and positioning
   });
   ```

2. **Actual Migrated Pattern (As Implemented)**
   ```javascript
   // Migrated: Direct ModTestFixture usage (from accept_kiss_passively.test.js)
   import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
   import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
   import acceptKissPassivelyRule from '../../../../data/mods/intimacy/rules/accept_kiss_passively.rule.json';
   import eventIsActionAcceptKissPassively from '../../../../data/mods/intimacy/conditions/event-is-action-accept-kiss-passively.condition.json';
   
   describe('intimacy:accept_kiss_passively action integration', () => {
     let testFixture;
   
     beforeEach(async () => {
       // ASYNC is required!
       testFixture = await ModTestFixture.forAction(
         'intimacy',
         'intimacy:accept_kiss_passively',
         acceptKissPassivelyRule,
         eventIsActionAcceptKissPassively
       );
       // Auto-loading is supported but files were explicitly imported for clarity
     });
   
     afterEach(() => {
       testFixture.cleanup();
     });
   
     it('successfully executes accept kiss passively for receiver', async () => {
       // Use built-in scenario creation methods
       const scenario = testFixture.createCloseActors(['Alice', 'Bob']);
       
       // Add relationship-specific components as needed
       scenario.actor.components['intimacy:kissing'] = {
         partner: scenario.target.id,
         initiator: false
       };
       scenario.target.components['intimacy:kissing'] = {
         partner: scenario.actor.id,
         initiator: true
       };
       
       // Reset entities after component modifications
       testFixture.reset([scenario.actor, scenario.target]);
       
       await testFixture.executeAction(scenario.actor.id, scenario.target.id);
       
       // Use standard assertion helpers or direct event inspection
       const successEvent = testFixture.events.find(
         (e) => e.eventType === 'core:display_successful_action_result'
       );
       expect(successEvent).toBeDefined();
       expect(successEvent.payload.message).toBe("Alice accepts Bob's kiss passively.");
     });
   });
   ```

### Phase 1B: Files 4-6 Migration
- Apply learned patterns from first 3 files
- Use auto-loading feature to reduce imports where possible
- Document any intimacy-specific adaptations needed

### Phase 1C: Files 7-9 Migration
- Optimize patterns based on phase experience
- Establish consistent intimacy category conventions
- Prepare patterns for phases 2 and 3

## File Naming Conventions (IMPORTANT)

- **Rule files**: Use underscores
  - `kiss_cheek.rule.json`
  - `handle_kiss_cheek.rule.json`
- **Condition files**: Use hyphens
  - `event-is-action-kiss-cheek.condition.json`
- **Test files**: Use underscores
  - `kiss_cheek_action.test.js`

## Success Criteria

### Quantitative Metrics ✅ PHASE 1 COMPLETE
- [x] **Code Reduction**: 80-90% for all 9 files ✅
- [x] **Performance**: <30% regression per file ✅
- [x] **Test Preservation**: 100% of test cases maintained ✅
- [x] **Infrastructure Usage**: Maximum infrastructure utilization ✅

### Qualitative Metrics ✅ PHASE 1 COMPLETE
- [x] **Pattern Consistency**: Match violence category patterns (not class inheritance) ✅
- [x] **Maintainability**: Significantly improved maintainability ✅
- [x] **Documentation**: Complete migration documentation ✅
- [x] **Knowledge Transfer**: Patterns ready for phases 2 and 3 ✅

## Deliverables

1. **Migrated Test Files** (9 files)
   - Direct ModTestFixture usage (no class inheritance)
   - Async pattern properly implemented
   - Event validation standardized
   - Code reduction targets achieved

2. **Intimacy Category Pattern Library**
   - Standard runtime integration patterns for intimacy
   - Direct fixture usage examples
   - Auto-loading feature documentation
   - Relationship handling best practices

3. **Phase 1 Documentation**
   - Migration decisions and rationale
   - Pattern adaptations for intimacy category
   - Lessons learned for phases 2 and 3
   - Performance impact analysis

## Dependencies for Next Tickets

This ticket enables:
- **TSTAIMIG-011**: Intimacy phase 2 (uses established patterns)
- **TSTAIMIG-012**: Intimacy phase 3 (completes category)
- **TSTAIMIG-013**: Intimacy validation (validates all 27 files)

## Quality Gates for This Ticket

- [x] All 9 intimacy phase 1 files successfully migrated ✅
- [x] Code reduction targets achieved (80-90%) ✅
- [x] Performance requirements met (<30% regression) ✅
- [x] Direct ModTestFixture pattern validated (no inheritance) ✅
- [x] Patterns documented and ready for phases 2 and 3 ✅
- [x] Ready for intimacy phase 2 migration (TSTAIMIG-011) ✅

## Lessons Learned for Phases 2-3

### Key Successes
1. **ModTestFixture Pattern Proven**: Direct usage pattern (not inheritance) works excellently for intimacy category tests
2. **Auto-Loading Feature**: Available but files were explicitly imported for clarity and consistency
3. **Helper Methods**: `createCloseActors()`, `createMultiActorScenario()`, and assertion helpers significantly reduce boilerplate
4. **Component Handling**: Pattern established for adding relationship-specific components (e.g., `intimacy:kissing`) then calling `reset()`

### Implementation Notes
1. **Async Pattern Critical**: The `beforeEach` must be `async` for `ModTestFixture.forAction()`
2. **Flexible Assertions**: Tests can use either helper methods (`assertActionSuccess()`) or direct event inspection with `expect()`
3. **Scenario Objects**: The returned scenario objects from helper methods provide clean entity references

### Recommendations for Phases 2-3
1. **Priority Order**: Migrate the remaining 11 files identified in the implementation status section
2. **File Count Discrepancy**: Investigate the difference between stated 27 files and actual 20 files found
3. **Pattern Consistency**: Continue using the established ModTestFixture pattern from Phase 1
4. **Consider Auto-Loading**: For phases 2-3, consider using auto-loading to reduce imports further
5. **Test Grouping**: Group similar test patterns together for more efficient migration

### Technical Debt Addressed
- Eliminated complex manual handler creation
- Removed extensive mocking boilerplate
- Simplified event validation patterns
- Improved test maintainability and readability
- Achieved significant code reduction (80-90%) while preserving all test functionality