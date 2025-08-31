# EXEPHAMIG-005: Migrate Exercise Category Test Files

## Overview

Execute the migration of Exercise category test files to new testing infrastructure as the first phase of the systematic mod test migration strategy. Exercise category serves as the pilot phase to validate migration tooling and establish patterns for subsequent phases.

## Background Context

The Living Narrative Engine project has 2 test files in the Exercise category that need to be migrated from legacy testing patterns to the new infrastructure using ModActionTestBase, ModEntityScenarios, ModAssertionHelpers, and related components.

Exercise category represents the **simplest migration scenario** with schema validation patterns rather than complex runtime integration, making it ideal for:
- Validating migration tooling with real files
- Establishing migration workflow patterns
- Identifying infrastructure gaps before more complex phases
- Demonstrating code reduction benefits (44% reduction expected)

## Problem Statement

The Exercise category contains legacy test files that use manual, duplicated patterns:

**Target Files for Migration**:
1. `tests/integration/mods/exercise/show_off_biceps_action.test.js` (45+ lines → 25 lines expected)
2. `tests/integration/mods/exercise/rules/showOffBicepsRule.integration.test.js` (rule test pattern)

**Current Issues**:
- Manual schema validation with duplicated assertion logic
- Direct JSON import patterns instead of infrastructure helpers
- No reuse of common test patterns
- Inconsistent assertion patterns across similar tests

## Technical Requirements

### 1. File Migration Specifications

#### Target File 1: `show_off_biceps_action.test.js`

**Current Pattern** (Schema Validation):
```javascript
/**
 * @file Integration tests for the exercise:show_off_biceps action.
 * @description Tests basic action properties and structure validation.
 */

import { describe, it, expect } from '@jest/globals';
import showOffBicepsAction from '../../../../data/mods/exercise/actions/show_off_biceps.action.json';

describe('Exercise Mod: Show Off Biceps Action', () => {
  describe('Action Properties', () => {
    it('should have correct action properties', () => {
      // Assert: Verify action structure
      expect(showOffBicepsAction.id).toBe('exercise:show_off_biceps');
      expect(showOffBicepsAction.name).toBe('Show Off Biceps');
      expect(showOffBicepsAction.targets).toBe('none');
      expect(showOffBicepsAction.template).toBe('show off your muscular arms');
    });

    it('should use correct Orange Flame visual styling', () => {
      // Assert: Verify WCAG compliant colors
      expect(showOffBicepsAction.visual.backgroundColor).toBe('#e65100');
      expect(showOffBicepsAction.visual.textColor).toBe('#ffffff');
      expect(showOffBicepsAction.visual.hoverBackgroundColor).toBe('#ff6f00');
      expect(showOffBicepsAction.visual.hoverTextColor).toBe('#ffffff');
    });

    it('should have prerequisites for muscular/hulking arms', () => {
      // Assert: Verify prerequisites exist
      expect(showOffBicepsAction.prerequisites).toHaveLength(1);
      const prerequisite = showOffBicepsAction.prerequisites[0];
      expect(prerequisite.logic.or).toBeDefined();
      expect(prerequisite.logic.or).toHaveLength(2);
    });
  });
});
```

**Target Pattern** (Using New Infrastructure):
```javascript
import { ModAssertionHelpers } from '../../common/mods/ModAssertionHelpers.js';

describe('Exercise Mod: Show Off Biceps Action', () => {
  let actionData;

  beforeEach(async () => {
    actionData = await ModAssertionHelpers.loadActionData('exercise', 'show_off_biceps');
  });

  describe('Action Properties', () => {
    it('should have correct action properties', () => {
      ModAssertionHelpers.assertActionStructure(actionData, {
        id: 'exercise:show_off_biceps',
        name: 'Show Off Biceps',
        targets: 'none',
        template: 'show off your muscular arms'
      });
    });

    it('should use correct Orange Flame visual styling', () => {
      ModAssertionHelpers.assertVisualStyling(actionData.visual, {
        backgroundColor: '#e65100',
        textColor: '#ffffff',
        hoverBackgroundColor: '#ff6f00',
        hoverTextColor: '#ffffff'
      });
    });

    it('should have prerequisites for muscular/hulking arms', () => {
      ModAssertionHelpers.assertPrerequisites(actionData.prerequisites, {
        count: 1,
        logicType: 'or',
        conditions: ['muscular_arms', 'hulking_arms']
      });
    });
  });
});
```

**Migration Characteristics**:
- **Pattern Type**: Schema validation (not runtime integration)
- **Code Reduction**: 45+ lines → 25 lines (44% reduction)
- **Infrastructure Usage**: ModAssertionHelpers for schema validation
- **Complexity Level**: Low (ideal for first migration)

#### Target File 2: `showOffBicepsRule.integration.test.js`

**Migration Pattern**: Rule test using ModRuleTestBase infrastructure
**Expected Code Reduction**: Similar 40-50% reduction
**Infrastructure Usage**: ModRuleTestBase, ModTestFixture for rule testing patterns

### 2. Migration Execution Process

#### Phase 1A: Preparation and Baseline
1. **Backup Original Files**:
   ```bash
   # Create timestamped backups
   cp tests/integration/mods/exercise/show_off_biceps_action.test.js \
      tests/integration/mods/exercise/show_off_biceps_action.test.js.backup.$(date +%Y%m%d_%H%M%S)
   ```

2. **Capture Baseline Behavior**:
   ```bash
   # Execute baseline capture for validation
   npm run test:integration tests/integration/mods/exercise/ -- --reporter=json > exercise-baseline.json
   node scripts/captureBaseline.js tests/integration/mods/exercise/show_off_biceps_action.test.js
   ```

#### Phase 1B: Execute Migration
1. **Run Migration Scripts**:
   ```bash
   # Migrate show_off_biceps_action.test.js
   node scripts/migrateMod.js \
     --category exercise \
     --file tests/integration/mods/exercise/show_off_biceps_action.test.js \
     --template exercise-action \
     --validate

   # Migrate rule test file
   node scripts/migrateMod.js \
     --category exercise \
     --file tests/integration/mods/exercise/rules/showOffBicepsRule.integration.test.js \
     --template exercise-rule \
     --validate
   ```

2. **Validate Generated Files**:
   ```bash
   # Check syntax validity
   node -c tests/integration/mods/exercise/show_off_biceps_action.test.js

   # Verify imports resolve
   node scripts/validateImports.js tests/integration/mods/exercise/show_off_biceps_action.test.js
   ```

#### Phase 1C: Behavioral Validation
1. **Execute Migrated Tests**:
   ```bash
   # Run migrated tests
   npm run test:integration tests/integration/mods/exercise/ -- --reporter=json > exercise-migrated.json
   ```

2. **Compare Results**:
   ```bash
   # Compare baseline vs migrated behavior
   node scripts/compareMigrationResults.js exercise-baseline.json exercise-migrated.json --threshold 20
   ```

3. **Generate Migration Report**:
   ```bash
   # Generate comprehensive migration report
   node scripts/validateMigration.js \
     --original tests/integration/mods/exercise/show_off_biceps_action.test.js.backup \
     --migrated tests/integration/mods/exercise/show_off_biceps_action.test.js \
     --report-format html
   ```

### 3. Success Validation Criteria

#### Functional Validation
- **Test Execution**: All migrated tests pass when executed
- **Behavior Preservation**: Test results identical to baseline
- **Import Resolution**: All imports resolve correctly
- **Syntax Validity**: Generated code is syntactically valid JavaScript

#### Quality Validation
- **Code Reduction**: 40-50% reduction in line count achieved
- **Pattern Consistency**: Migrated files use infrastructure consistently
- **Maintainability**: Generated code follows project conventions
- **Documentation**: Generated tests include appropriate documentation

#### Performance Validation
- **Execution Time**: Test execution time within 20% of baseline
- **Migration Time**: Migration completes within 30 seconds per file
- **Memory Usage**: No significant memory usage increase

### 4. Infrastructure Dependencies

**Required Infrastructure Components**:
- `ModAssertionHelpers.loadActionData()` - Load action data from JSON
- `ModAssertionHelpers.assertActionStructure()` - Validate action properties
- `ModAssertionHelpers.assertVisualStyling()` - Validate visual styling
- `ModAssertionHelpers.assertPrerequisites()` - Validate prerequisites logic
- `ModRuleTestBase` - Base class for rule tests (for rule file migration)

**Infrastructure Validation**:
- Verify all required helpers exist and function correctly
- Validate helper method signatures match template expectations
- Ensure error handling works as expected

## Implementation Specifications

### File Structure Impact
```
tests/integration/mods/exercise/
├── show_off_biceps_action.test.js          [MIGRATED]
├── show_off_biceps_action.test.js.backup   [BACKUP]
└── rules/
    ├── showOffBicepsRule.integration.test.js         [MIGRATED]
    └── showOffBicepsRule.integration.test.js.backup  [BACKUP]
```

### Migration Workflow
1. **Pre-Migration** (Day 1 Morning):
   - Validate migration tooling is ready (EXEPHAMIG-004 completed)
   - Create backups of original files
   - Capture comprehensive baselines

2. **Migration Execution** (Day 1 Afternoon):
   - Execute migration scripts on both files
   - Validate generated file syntax and imports
   - Run migrated tests to ensure they pass

3. **Validation and Analysis** (Day 2):
   - Compare behavior between original and migrated tests
   - Analyze code reduction metrics
   - Generate migration reports
   - Document any issues or insights

4. **Infrastructure Refinement** (Day 3, if needed):
   - Address any infrastructure gaps discovered
   - Refine templates based on real migration results
   - Update migration scripts if needed

## Acceptance Criteria

### Migration Success Criteria
- [ ] Both Exercise category test files successfully migrated
- [ ] All migrated tests pass when executed independently
- [ ] Test behavior is identical to original tests (validated by framework)
- [ ] Code reduction targets achieved (40-50% reduction)

### Quality Criteria
- [ ] Generated code follows project coding conventions
- [ ] All imports resolve correctly and use proper infrastructure components
- [ ] Tests are maintainable and follow consistent patterns
- [ ] Documentation and comments are appropriate and helpful

### Process Criteria
- [ ] Migration process completed within planned timeline (3 days)
- [ ] Migration tooling worked correctly with real files
- [ ] Backup and rollback procedures validated
- [ ] Migration workflow documented for subsequent phases

### Infrastructure Criteria
- [ ] Required infrastructure components work as expected
- [ ] Any infrastructure gaps identified and addressed
- [ ] Templates and migration scripts refined based on real usage
- [ ] Performance meets expectations

## Dependencies

**Prerequisites**:
- EXEPHAMIG-001: Migration Scripts Infrastructure (completed)
- EXEPHAMIG-002: Migration Templates and Utilities (completed)
- EXEPHAMIG-003: Migration Validation Framework (completed)
- EXEPHAMIG-004: Validate and Test Migration Tooling (completed)

**Enables**:
- EXEPHAMIG-006: Validate Exercise Migration Results
- EXEPHAMIG-007: Document Exercise Migration Patterns
- EXEPHAMIG-008: Phase 2 Violence Category Migration (depends on lessons learned)

## Risk Mitigation

### Migration Tooling Risk
- **Risk**: Migration scripts fail with real files despite validation
- **Mitigation**: Gradual approach, starting with simpler file first
- **Contingency**: Manual migration with tooling refinement

### Infrastructure Gap Risk
- **Risk**: Required infrastructure components missing or inadequate
- **Mitigation**: Validate infrastructure before migration execution
- **Contingency**: Implement missing components or refine existing ones

### Behavior Change Risk
- **Risk**: Migrated tests behave differently than originals
- **Mitigation**: Comprehensive baseline capture and comparison
- **Contingency**: Rollback to original files and refine migration approach

### Timeline Risk
- **Risk**: Migration takes longer than planned
- **Mitigation**: Simple files first, parallel validation processes
- **Contingency**: Extend timeline or defer complex aspects to later phases

## Success Metrics

### Quantitative Metrics
- **Migration Success Rate**: 100% (both files successfully migrated)
- **Code Reduction**: 40-50% reduction in total line count
- **Test Pass Rate**: 100% (all migrated tests pass)
- **Behavior Preservation**: 100% (identical test behavior)

### Qualitative Metrics
- **Code Quality**: Generated code meets project standards
- **Process Efficiency**: Migration workflow is smooth and documented
- **Infrastructure Validation**: Infrastructure components work as designed
- **Knowledge Generation**: Insights and patterns documented for future phases

## Timeline

**Estimated Duration**: 3 days

**Detailed Schedule**:
- **Day 1**: Migration execution and initial validation
  - Morning: Pre-migration setup and backup
  - Afternoon: Execute migrations and validate generated files
- **Day 2**: Behavioral validation and analysis
  - Full day: Compare behavior, analyze results, generate reports
- **Day 3**: Infrastructure refinement and documentation
  - Address any infrastructure issues discovered
  - Document lessons learned and patterns established

## Next Steps

Upon successful completion:
1. **EXEPHAMIG-006**: Validate Exercise Migration Results (comprehensive validation)
2. **EXEPHAMIG-007**: Document Exercise Migration Patterns (capture learnings)
3. **Phase 2 Preparation**: Apply lessons learned to Violence category migration

**Critical Success Factor**: Success in Exercise migration validates the entire migration approach and tooling. This phase establishes confidence and patterns for the remaining 54 files across 4 additional categories.