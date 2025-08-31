# TSTAIMIG-010: Migrate Intimacy Category Test Suites - Phase 1

## Objective

Migrate the first 9 test files of the 27-file Intimacy category from legacy patterns to the new testing infrastructure, focusing on standard runtime integration patterns while building on the successful validation from Exercise and Violence categories.

## Background

The Intimacy category is the largest with 27 files, requiring a phased approach. This represents standard runtime integration patterns as described in the specification, with complex handler creation, rule processing, and event capture mechanisms that need to be simplified using the new infrastructure.

## Dependencies

- **TSTAIMIG-007**: Exercise category validation completed
- **TSTAIMIG-009**: Violence category validation completed
- Validated runtime integration patterns from violence category
- ModActionTestBase patterns established and proven

## Target Files (Phase 1)

**9 intimacy category test files** featuring:
- Complex handler creation with manual dependency injection
- Rule and condition file imports with macro expansion
- createRuleTestEnvironment() usage patterns
- Extensive manual handler mocking patterns
- Event validation through captured event arrays

## Acceptance Criteria

### Standard Runtime Integration Migration

- [ ] **ModActionTestBase Extension Pattern**
  - [ ] Replace manual handler setup with ModActionTestBase
  - [ ] Use ModTestFixture to replace createRuleTestEnvironment() complexity
  - [ ] Apply assertActionSuccess() for event validation
  - [ ] Minimize custom code through base class usage

- [ ] **Handler Setup Simplification**
  - [ ] Replace manual handler mocking with test fixture abstractions
  - [ ] Eliminate QueryComponentHandler, DispatchEventHandler manual setup
  - [ ] Use infrastructure for entity creation and positioning
  - [ ] Standardize macro expansion handling

- [ ] **Event Validation Standardization**
  - [ ] Convert captured event arrays to assertion helper usage
  - [ ] Replace manual event filtering with standardized patterns
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

2. **Migrated Pattern Implementation**
   ```javascript
   // Migrated: ModActionTestBase usage
   class KissCheekActionTest extends ModActionTestBase {
     constructor() {
       super('intimacy', 'intimacy:kiss_cheek', kissCheekRule, eventIsActionKissCheek);
     }
     
     setupTestEntities() {
       const actor = new ModEntityBuilder('actor1')
         .withName('TestActor')
         .atLocation('test-location')
         .build();
         
       const target = new ModEntityBuilder('target1')
         .withName('TestTarget')
         .inSameLocationAs(actor)
         .build();
         
       return { actor, target };
     }
   }
   ```

### Phase 1B: Files 4-6 Migration
- Apply learned patterns from first 3 files
- Refine infrastructure usage based on early experience
- Document any intimacy-specific adaptations needed

### Phase 1C: Files 7-9 Migration
- Optimize patterns based on phase experience
- Establish consistent intimacy category conventions
- Prepare patterns for phases 2 and 3

## Success Criteria

### Quantitative Metrics
- [ ] **Code Reduction**: 80-90% for all 9 files
- [ ] **Performance**: <30% regression per file
- [ ] **Test Preservation**: 100% of test cases maintained
- [ ] **Infrastructure Usage**: Maximum infrastructure utilization

### Qualitative Metrics
- [ ] **Pattern Consistency**: Consistent patterns across all 9 files
- [ ] **Maintainability**: Significantly improved maintainability
- [ ] **Documentation**: Complete migration documentation
- [ ] **Knowledge Transfer**: Patterns ready for phases 2 and 3

## Deliverables

1. **Migrated Test Files** (9 files)
   - Standard runtime integration patterns applied
   - ModActionTestBase extensions implemented
   - Event validation standardized
   - Code reduction targets achieved

2. **Intimacy Category Pattern Library**
   - Standard runtime integration patterns for intimacy
   - Handler setup simplification patterns
   - Event validation standardization patterns
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
- [ ] Standard runtime integration patterns validated
- [ ] Patterns documented and ready for phases 2 and 3
- [ ] Ready for intimacy phase 2 migration (TSTAIMIG-011)