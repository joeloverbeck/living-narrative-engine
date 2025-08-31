# TSTAIMIG-006: Migrate Exercise Category Test Suites

## Objective

Migrate the 2 test files in the Exercise category from legacy patterns to the new testing infrastructure, achieving the target 80-90% code reduction while preserving all test behavior and maintaining schema validation functionality.

## Background

The Exercise category represents the simplest migration pattern focusing on schema validation tests. These files use direct JSON imports with manual property assertions and serve as the perfect starting point to validate the migration approach before tackling more complex categories.

## Dependencies

- **TSTAIMIG-001**: Infrastructure validation completed
- **TSTAIMIG-002**: Component validation completed
- **TSTAIMIG-003**: Quality assurance framework completed
- **TSTAIMIG-004**: Tracking and metrics system completed
- **TSTAIMIG-005**: Documentation templates completed
- All infrastructure components validated and ready

## Target Files

Based on the specification, this ticket will migrate:

1. **Exercise Category Test Files (2 files)**
   - `tests/integration/mods/exercise/show_off_biceps_action.test.js` (example from spec)
   - One additional exercise category test file

**Note**: The actual file count and names will be validated during execution based on the current codebase structure.

## Acceptance Criteria

### Migration Requirements

- [ ] **File Identification and Analysis**
  - [ ] Locate all exercise category test files in the codebase
  - [ ] Analyze current structure and patterns used
  - [ ] Document existing test coverage and assertions
  - [ ] Establish baseline metrics (LOC, complexity, performance)

- [ ] **Schema Validation Pattern Migration**
  - [ ] Replace direct JSON imports with ModTestFixture usage
  - [ ] Convert manual property assertions to standardized patterns
  - [ ] Preserve all visual styling validation requirements
  - [ ] Maintain JSON Logic prerequisites checking functionality

- [ ] **Infrastructure Integration**
  - [ ] Use ModTestFixture for action data loading
  - [ ] Implement standardized test structure and organization
  - [ ] Leverage existing helper methods where appropriate
  - [ ] Follow exercise category migration guide from TSTAIMIG-005

### Quality Preservation Requirements

- [ ] **Test Coverage Preservation**
  - [ ] All original test cases preserved and functional
  - [ ] All property assertions maintained
  - [ ] Visual styling validation preserved
  - [ ] Prerequisites checking with JSON Logic operational
  - [ ] Edge cases and error scenarios maintained

- [ ] **Behavioral Equivalence**
  - [ ] Migrated tests produce identical results to original tests
  - [ ] All assertions pass with same validation logic
  - [ ] Error handling behavior preserved
  - [ ] Integration with action JSON files maintained

### Success Criteria Achievement

- [ ] **Code Reduction Target**
  - [ ] Achieve 80-90% code reduction for each migrated file
  - [ ] Measure and document actual reduction percentages
  - [ ] Eliminate duplicated setup and assertion code
  - [ ] Maximize infrastructure component utilization

- [ ] **Performance Requirements**
  - [ ] Maintain <30% performance regression limit
  - [ ] Measure execution time before and after migration
  - [ ] Optimize where possible without compromising functionality
  - [ ] Document performance impact analysis

## Implementation Steps

### Phase 1: Pre-Migration Analysis

1. **File Discovery and Cataloging**
   ```bash
   # Find all exercise category test files
   find tests -path "*/exercise/*" -name "*.test.js" -type f
   
   # Analyze file structure and patterns
   grep -r "exercise:" tests/ | grep "\.test\.js"
   ```

2. **Current Pattern Analysis**
   - Document existing test structure and organization
   - Identify direct JSON import patterns
   - Catalog manual assertion patterns
   - Note visual styling validation approaches
   - Document JSON Logic prerequisites handling

3. **Baseline Metrics Collection**
   ```bash
   # Collect pre-migration metrics
   npm run metrics:collect-baseline tests/integration/mods/exercise/
   
   # Establish performance baseline
   npm run test:integration tests/integration/mods/exercise/ --profile
   ```

4. **Migration Planning**
   - Create migration approach for each identified file
   - Plan infrastructure component utilization
   - Design new test structure using templates from TSTAIMIG-005
   - Identify custom requirements and solutions

### Phase 2: Migration Execution

1. **First File Migration** (show_off_biceps_action.test.js or equivalent)

   **Before Pattern (Legacy)**:
   ```javascript
   import showOffBicepsAction from '../../../../data/mods/exercise/actions/show_off_biceps.action.json';
   
   describe('Show Off Biceps Action Tests', () => {
     it('should have correct action properties', () => {
       expect(showOffBicepsAction.id).toBe('exercise:show_off_biceps');
       expect(showOffBicepsAction.name).toBe('Show Off Biceps');
       expect(showOffBicepsAction.targets).toBe('none');
       expect(showOffBicepsAction.template).toBe('show off your muscular arms');
       // ... more manual assertions
     });
     
     it('should have valid visual styling', () => {
       // Visual styling validation logic
     });
     
     it('should have correct prerequisites', () => {
       // JSON Logic prerequisites validation
     });
   });
   ```

   **After Pattern (Migrated)**:
   ```javascript
   import { ModTestFixture } from '../../common/mods/ModTestFixture.js';
   
   describe('Show Off Biceps Action Tests', () => {
     let testFixture;
     
     beforeEach(() => {
       testFixture = ModTestFixture.forAction('exercise', 'exercise:show_off_biceps', 
         ruleFile, conditionFile);
     });
     
     it('should have correct action properties', () => {
       const actionData = testFixture.getActionData();
       expect(actionData.id).toBe('exercise:show_off_biceps');
       expect(actionData.name).toBe('Show Off Biceps');
       expect(actionData.targets).toBe('none');
       expect(actionData.template).toBe('show off your muscular arms');
     });
     
     // Additional test cases using infrastructure helpers
   });
   ```

2. **Second File Migration**
   - Apply same patterns learned from first file
   - Adapt for any unique requirements of second file
   - Maintain consistency with migration patterns
   - Document any pattern variations or adaptations

### Phase 3: Quality Gate Validation

1. **Execute Quality Gates**
   ```bash
   # Pre-migration validation
   npm run qa:pre-migration tests/integration/mods/exercise/[file].test.js
   
   # Migration pattern validation  
   npm run qa:validate-patterns [migrated-file]
   
   # Post-migration validation
   npm run qa:post-migration [original] [migrated]
   ```

2. **Metrics Collection and Analysis**
   ```bash
   # Collect post-migration metrics
   npm run metrics:collect-migrated [migrated-file]
   
   # Calculate code reduction
   npm run metrics:calculate-reduction [original] [migrated]
   
   # Performance comparison
   npm run compare:performance [original] [migrated]
   ```

3. **Coverage and Behavior Verification**
   ```bash
   # Run migrated tests
   npm run test:integration [migrated-files]
   
   # Verify coverage preservation  
   npm run verify:coverage [migrated-files]
   
   # Behavioral equivalence check
   npm run verify:behavior-equivalence [original] [migrated]
   ```

### Phase 4: Documentation and Reporting

1. **Migration Decision Documentation**
   - Document all migration decisions using templates from TSTAIMIG-005
   - Record infrastructure component choices and rationale
   - Note any custom patterns or adaptations required
   - Capture lessons learned and optimization opportunities

2. **Progress Tracking Updates**
   ```bash
   # Update migration progress
   npm run metrics:update-progress exercise completed
   
   # Generate category progress report
   npm run metrics:category-report exercise
   ```

## Migration Patterns for Exercise Category

### Pattern 1: Direct JSON Import to ModTestFixture

**Legacy Pattern**:
```javascript
import actionJson from '../../../../data/mods/exercise/actions/[action].action.json';
```

**Migrated Pattern**:
```javascript
let testFixture;
beforeEach(() => {
  testFixture = ModTestFixture.forAction('exercise', 'exercise:[action]', ruleFile, conditionFile);
});

const actionData = testFixture.getActionData();
```

### Pattern 2: Manual Assertions to Standardized Validation

**Legacy Pattern**:
```javascript
expect(action.property1).toBe(value1);
expect(action.property2).toBe(value2);
expect(action.property3).toBe(value3);
```

**Migrated Pattern**:
```javascript
const actionData = testFixture.getActionData();
expect(actionData).toMatchObject({
  property1: value1,
  property2: value2,
  property3: value3
});
```

### Pattern 3: Visual Styling Validation Preservation

**Approach**: Maintain existing visual styling validation logic while integrating with new infrastructure

### Pattern 4: JSON Logic Prerequisites Integration

**Approach**: Preserve JSON Logic validation while using infrastructure for action data access

## Validation Commands

```bash
# Pre-migration validation
npm run test:integration tests/integration/mods/exercise/

# Migration execution
npm run migrate:exercise-category

# Post-migration validation
npm run test:integration tests/integration/mods/exercise/ --migrated
npm run qa:validate-migration exercise

# Performance comparison
npm run performance:compare exercise

# Success criteria verification
npm run verify:success-criteria exercise
```

## Success Criteria

### Quantitative Metrics

- [ ] **Code Reduction**: 80-90% reduction achieved for each file
- [ ] **Test Preservation**: 100% of original test cases preserved
- [ ] **Performance Impact**: <30% regression in test execution time
- [ ] **Quality Gates**: 100% of quality gates pass

### Qualitative Metrics

- [ ] **Maintainability**: Tests are easier to understand and modify
- [ ] **Consistency**: Migration patterns consistent across both files
- [ ] **Infrastructure Usage**: Maximum utilization of available infrastructure
- [ ] **Documentation Quality**: Complete migration documentation created

## Deliverables

1. **Migrated Test Files**
   - 2 exercise category test files fully migrated
   - All tests passing with preserved behavior
   - Infrastructure integration complete
   - Code reduction targets achieved

2. **Migration Documentation**
   - Pre-migration analysis reports
   - Migration decision logs
   - Implementation guides
   - Post-migration reports

3. **Metrics and Analysis**
   - Code reduction measurements
   - Performance impact analysis
   - Quality preservation verification
   - Success criteria achievement report

4. **Lessons Learned**
   - Exercise category migration patterns
   - Infrastructure utilization insights
   - Optimization opportunities identified
   - Recommendations for subsequent categories

## Risk Mitigation

### Technical Risks

**Risk**: ModTestFixture doesn't support exercise category patterns
- **Mitigation**: Extend ModTestFixture or create category-specific helpers as needed

**Risk**: Visual styling validation breaks during migration
- **Mitigation**: Carefully preserve existing styling validation logic, test thoroughly

**Risk**: JSON Logic prerequisites handling changes behavior
- **Mitigation**: Validate prerequisites logic before and after migration, maintain exact behavior

### Quality Risks

**Risk**: Test coverage or behavior lost during migration
- **Mitigation**: Comprehensive testing and validation, rollback capability maintained

**Risk**: Performance regression exceeds acceptable limits
- **Mitigation**: Performance optimization, infrastructure tuning if needed

## Dependencies for Next Tickets

This ticket enables:
- **TSTAIMIG-007**: Exercise validation (needs completed migration for validation)
- **TSTAIMIG-008**: Violence category migration (uses patterns learned from exercise)
- Validation of migration infrastructure and patterns for subsequent categories

## Quality Gates for This Ticket

- [ ] All exercise category test files successfully migrated
- [ ] Code reduction targets achieved (80-90%)
- [ ] Performance requirements met (<30% regression)
- [ ] All quality gates pass
- [ ] Documentation complete and accurate
- [ ] Migration tracking updated
- [ ] Ready for exercise category validation (TSTAIMIG-007)