# TSTAIMIG-010: Migrate Intimacy Category Test Suites - Phase 1

## Objective

Migrate the first 9 test files of the 27-file Intimacy category from legacy patterns to the new testing infrastructure, focusing on standard runtime integration patterns while building on the successful validation from Exercise and Violence categories.

## Background

The Intimacy category is the largest with 27 files, requiring a phased approach. This represents standard runtime integration patterns as described in the specification, with complex handler creation, rule processing, and event capture mechanisms that need to be simplified using the new infrastructure.

## Dependencies

- **TSTAIMIG-007**: Exercise category validation completed
- **TSTAIMIG-009**: Violence category validation completed
- Validated runtime integration patterns from violence category
- ModTestFixture patterns established and proven (not ModActionTestBase inheritance)

## Target Files (Phase 1)

**First 9 of 27 intimacy category test files**:
1. `accept_kiss_passively.test.js`
2. `adjust_clothing_action.test.js`
3. `brush_hand_action.test.js`
4. `cup_face_while_kissing.test.js`
5. `explore_mouth_with_tongue.test.js`
6. `feel_arm_muscles_action.test.js`
7. `fondle_ass_action.test.js`
8. `fondle_ass_over_clothing.test.js`
9. `hug_tight_action_discovery.test.js`

**Features to migrate**:
- Complex handler creation with manual dependency injection
- Rule and condition file imports (can be auto-loaded)
- createRuleTestEnvironment() usage patterns
- Extensive manual handler mocking patterns
- Event validation through captured event arrays

## Acceptance Criteria

### Standard Runtime Integration Migration

- [ ] **ModTestFixture Direct Usage Pattern** (NOT class inheritance)
  - [ ] Use `await ModTestFixture.forAction()` in beforeEach
  - [ ] Leverage auto-loading when possible (omit rule/condition files)
  - [ ] Apply testFixture.assertActionSuccess() for event validation
  - [ ] Use testFixture methods directly (no class extension needed)

- [ ] **Handler Setup Simplification**
  - [ ] Replace manual handler mocking with test fixture abstractions
  - [ ] Eliminate QueryComponentHandler, DispatchEventHandler manual setup
  - [ ] Use createStandardActorTarget() or createCloseActors() methods
  - [ ] Let ModTestFixture handle macro expansion automatically

- [ ] **Event Validation Standardization**
  - [ ] Use testFixture.assertActionSuccess() for standard validations
  - [ ] Use testFixture.assertPerceptibleEvent() for perception checks
  - [ ] Preserve all relationship validation logic
  - [ ] Maintain event sequence validation

### Code Reduction and Quality Targets

- [ ] **Code Reduction**: 80-90% reduction per file
- [ ] **Performance**: <30% regression limit
- [ ] **Quality Preservation**: 100% test case preservation
- [ ] **Pattern Consistency**: Consistent with violence category patterns

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

2. **Migrated Pattern Implementation (CORRECTED)**
   ```javascript
   // Migrated: Direct ModTestFixture usage (like violence tests)
   import { describe, it, beforeEach, afterEach } from '@jest/globals';
   import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
   import kissCheekRule from '../../../../data/mods/intimacy/rules/kiss_cheek.rule.json';
   import eventIsActionKissCheek from '../../../../data/mods/intimacy/conditions/event-is-action-kiss-cheek.condition.json';
   
   describe('intimacy:kiss_cheek action integration', () => {
     let testFixture;
   
     beforeEach(async () => {
       // ASYNC is required!
       testFixture = await ModTestFixture.forAction(
         'intimacy',
         'intimacy:kiss_cheek',
         kissCheekRule,
         eventIsActionKissCheek
       );
       // OR use auto-loading:
       // testFixture = await ModTestFixture.forAction('intimacy', 'intimacy:kiss_cheek');
     });
   
     afterEach(() => {
       testFixture.cleanup();
     });
   
     it('successfully executes kiss cheek action', async () => {
       // Use built-in scenario creation methods
       const { actor, target } = testFixture.createCloseActors(['Alice', 'Bob']);
       
       await testFixture.executeAction(actor.id, target.id);
       
       testFixture.assertActionSuccess(
         "Alice leans in to kiss Bob's cheek softly."
       );
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

### Quantitative Metrics
- [ ] **Code Reduction**: 80-90% for all 9 files
- [ ] **Performance**: <30% regression per file
- [ ] **Test Preservation**: 100% of test cases maintained
- [ ] **Infrastructure Usage**: Maximum infrastructure utilization

### Qualitative Metrics
- [ ] **Pattern Consistency**: Match violence category patterns (not class inheritance)
- [ ] **Maintainability**: Significantly improved maintainability
- [ ] **Documentation**: Complete migration documentation
- [ ] **Knowledge Transfer**: Patterns ready for phases 2 and 3

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

- [ ] All 9 intimacy phase 1 files successfully migrated
- [ ] Code reduction targets achieved (80-90%)
- [ ] Performance requirements met (<30% regression)
- [ ] Direct ModTestFixture pattern validated (no inheritance)
- [ ] Patterns documented and ready for phases 2 and 3
- [ ] Ready for intimacy phase 2 migration (TSTAIMIG-011)