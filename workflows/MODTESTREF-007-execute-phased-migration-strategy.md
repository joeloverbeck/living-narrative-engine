# MODTESTREF-007: Execute Phased Migration Strategy

## Overview

Execute the systematic migration of 56 existing mod integration test files to use the new infrastructure (ModTestHandlerFactory, ModEntityScenarios, ModAssertionHelpers, ModActionTestBase, ModTestFixture). Migration will proceed by category in phases to minimize risk and allow for iterative improvement.

## Problem Statement

### Migration Challenge

The project currently has 56 mod integration test files across 5 categories with:

- **21,600+ lines** of duplicated code that needs to be eliminated
- **Inconsistent patterns** that need to be standardized
- **Different complexity levels** requiring category-specific migration approaches
- **Mixed test patterns** requiring pattern-specific migration approaches
- **Production dependencies** requiring zero-downtime migration

### File Distribution for Migration

```
tests/integration/mods/
├── exercise/ (2 files) - Schema validation patterns
│   ├── show_off_biceps_action.test.js
│   └── rules/showOffBicepsRule.integration.test.js
├── violence/ (4 files) - Low complexity, runtime integration
│   ├── slap_action.test.js
│   ├── sucker_punch_action.test.js
│   └── rules/ (2 rule test files)
├── positioning/ (13 files) - Medium complexity, mixed patterns
│   ├── 11 action test files
│   └── rules/ (2 rule test files)
├── sex/ (10 files) - Medium-high complexity, runtime integration
│   ├── 9 action test files
│   └── rules/pressAgainstBackRule.integration.test.js
└── intimacy/ (27 files) - Highest volume, runtime integration
    ├── 18 action test files
    └── rules/ (9 rule test files)
```

### Migration Risks

- **Behavior Changes**: Risk of altering test behavior during migration
- **Performance Regression**: New infrastructure might impact test performance
- **Integration Issues**: New infrastructure might not handle edge cases
- **Development Disruption**: Migration process might block ongoing development

## Technical Requirements

### Migration Strategy

**Phased Approach by Category**:

1. **Phase 1**: Exercise (2 files) - Schema validation pattern migration
2. **Phase 2**: Violence (4 files) - Runtime integration pattern establishment
3. **Phase 3**: Positioning (13 files) - Mixed pattern complexity validation
4. **Phase 4**: Sex (10 files) - Complex runtime integration edge case testing
5. **Phase 5**: Intimacy (27 files) - Large-scale runtime integration validation

**Per-File Migration Process**:

1. **Baseline Capture**: Run existing test and capture baseline behavior
2. **Infrastructure Migration**: Convert to new infrastructure
3. **Behavior Validation**: Ensure identical behavior to baseline
4. **Performance Testing**: Verify no significant performance regression
5. **Cleanup**: Remove old patterns and update imports

### Migration Validation Framework

**File**: `tests/migration/MigrationValidator.js`

```javascript
class MigrationValidator {
  /**
   * Captures baseline behavior from existing test file
   */
  static async captureBaseline(testFilePath) {
    // Run existing test and capture:
    // - Test execution results
    // - Performance metrics
    // - Event sequences
    // - Entity states
    // - Error scenarios
  }

  /**
   * Validates migrated test produces identical behavior
   */
  static async validateMigration(originalPath, migratedPath) {
    // Compare:
    // - Test results (pass/fail)
    // - Event sequences
    // - Entity final states
    // - Error handling
    // - Performance within threshold
  }

  /**
   * Generates migration report with differences
   */
  static generateMigrationReport(originalPath, migratedPath, results) {
    // Create detailed report showing:
    // - Behavior differences (if any)
    // - Performance impact
    // - Code reduction metrics
    // - Migration recommendations
  }
}
```

### Phase-by-Phase Migration Plans

## Phase 1: Exercise Category Migration (Week 1)

**Target Files** (2 files):

- `tests/integration/mods/exercise/show_off_biceps_action.test.js`
- `tests/integration/mods/exercise/rules/showOffBicepsRule.integration.test.js`

**Migration Approach**:

### show_off_biceps_action.test.js Migration

**Before** (current schema validation pattern):

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

**After** (using new infrastructure for schema validation):

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

**Code Reduction**: 45+ lines → 25 lines (44% reduction)
**Note**: Exercise category uses schema validation pattern, not runtime integration

### Phase 1 Validation Process

1. **Baseline Capture**:

   ```bash
   npm run test:integration tests/integration/mods/exercise/ -- --reporter=json > exercise-baseline.json
   ```

2. **Migration Execution**:
   - Convert `show_off_biceps_action.test.js` using ModTestFixture
   - Convert `showOffBicepsRule.integration.test.js` using ModRuleTestBase

3. **Behavior Validation**:

   ```bash
   npm run test:integration tests/integration/mods/exercise/ -- --reporter=json > exercise-migrated.json
   node scripts/compareMigrationResults.js exercise-baseline.json exercise-migrated.json
   ```

4. **Performance Validation**:
   - Measure test execution time before/after
   - Ensure no more than 20% performance regression
   - Document improvements or degradations

## Phase 2: Violence Category Migration (Week 2)

**Target Files** (4 files):

- `tests/integration/mods/violence/slap_action.test.js`
- `tests/integration/mods/violence/sucker_punch_action.test.js`
- `tests/integration/mods/violence/rules/slapRule.integration.test.js`
- `tests/integration/mods/violence/rules/suckerPunchRule.integration.test.js`

**Migration Challenges**:

- Tests may include anatomy components for body-related violence
- Failure scenarios for missing prerequisites
- Different entity setup patterns for attacker/victim relationships

**Example Migration**:

**Before** (slap_action.test.js):

```javascript
// 50+ lines of manual setup and execution
it('should successfully execute slap action', async () => {
  testEnv.reset([
    {
      id: 'actor1',
      components: {
        [NAME_COMPONENT_ID]: { text: 'Alice' },
        [POSITION_COMPONENT_ID]: { locationId: 'room1' },
        'positioning:closeness': { partners: ['target1'] },
      },
    },
    {
      id: 'target1',
      components: {
        [NAME_COMPONENT_ID]: { text: 'Bob' },
        [POSITION_COMPONENT_ID]: { locationId: 'room1' },
        'positioning:closeness': { partners: ['actor1'] },
      },
    },
  ]);

  await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
    eventName: 'core:attempt_action',
    actorId: 'actor1',
    actionId: 'violence:slap',
    targetId: 'target1',
    originalInput: 'slap target1',
  });

  // Manual assertions...
});
```

**After**:

```javascript
// tests/integration/mods/violence/slap_action.test.js
import { ModActionTestBase } from '../../../common/mods/ModActionTestBase.js';
import slapRule from '../../../../data/mods/violence/rules/handle_slap.rule.json';
import eventIsActionSlap from '../../../../data/mods/violence/conditions/event-is-action-slap.condition.json';

class SlapActionTest extends ModActionTestBase {
  constructor() {
    super('violence', 'violence:slap', slapRule, eventIsActionSlap);
  }
}

describe('Violence: Slap Action', () => {
  const testSuite = new SlapActionTest();
  testSuite.createTestSuite();
});

  await fixture.executeAction(actor.id, target.id);
  fixture.assertActionSuccess('Alice slaps Bob');
});
```

## Phase 3: Positioning Category Migration (Week 3)

**Target Files** (13 files):

- 11 action test files (kneel_before, stand_behind, turn_around, etc.)
- 2 rule test files

**Migration Challenges**:

- Tests require ADD_COMPONENT handler for dynamic positioning components
- Complex positioning relationship management
- Component addition verification patterns

**Infrastructure Usage**:

```javascript
beforeEach(async () => {
  fixture = await ModTestFixture.forAction('positioning', 'kneel_before');
});

it('should add kneeling position component', async () => {
  const { actor, target } = fixture.createCloseActors(['Alice', 'Bob']);

  await fixture.executeAction(actor.id, target.id);
  fixture.assertActionSuccess();
  fixture.assertComponentAdded(actor.id, 'positioning:kneeling_before', {
    target: target.id,
  });
});
```

## Phase 4: Sex Category Migration (Week 4)

**Target Files** (10 files):

- 9 action test files (fondle_breasts, rub_penis, pump_penis, etc.)
- 1 rule test file (pressAgainstBackRule)

**Migration Challenges**:

- Most complex anatomy component requirements
- Failure scenarios for missing body parts
- Explicit content validation patterns
- Complex entity relationship setups

**Infrastructure Extensions Needed**:

```javascript
// May require sex-specific base class
class ModSexTestBase extends ModActionTestBase {
  constructor(config) {
    super({ ...config, testCategory: 'sex' });
  }

  createActorsWithAnatomy(names = ['Alice', 'Bob']) {
    const { actor, target } = this.createCloseActors(names);
    // Add anatomy components as needed
    return { actor, target };
  }
}
```

## Phase 5: Intimacy Category Migration (Week 5)

**Target Files** (27 files):

- 18 action test files (kiss_cheek, hug, cuddle, caress, etc.)
- 9 rule test files

**Migration Challenges**:

- Largest category with most test files
- Highest volume of code duplication
- Most consistent patterns (advantage for migration)
- Various intimacy levels and relationship types

**Scale Validation**:

- Tests infrastructure performance with large number of files
- Validates consistency patterns across many similar tests
- Confirms infrastructure scales to handle project growth

## Migration Tooling and Automation

### Missing Migration Infrastructure

**CRITICAL**: The following migration tooling referenced in this workflow **does not exist** and must be created before migration begins:

#### Required Scripts (Not Present)

1. **`scripts/migrateMod.js`** - Semi-automated migration script
   - **Status**: Missing, needs implementation
   - **Purpose**: Parse existing test files, extract configuration, generate new infrastructure-based tests
   - **Dependencies**: AST parsing, template generation, file I/O utilities

2. **`scripts/validateMigration.js`** - Migration validation script  
   - **Status**: Missing, needs implementation
   - **Purpose**: Compare original vs migrated test behavior, generate validation reports
   - **Dependencies**: Test result comparison, diff utilities, reporting framework

3. **`scripts/compareMigrationResults.js`** - Test result comparison utility
   - **Status**: Missing, needs implementation  
   - **Purpose**: Compare JSON test outputs before/after migration
   - **Dependencies**: JSON diff, test result parsing, performance metrics

#### Available Migration-Related Scripts

Based on actual codebase analysis, these existing scripts could be leveraged:

- `scripts/capture-test-baseline.sh` - Test baseline capture (exists)
- `scripts/validate-*-migration.js` (multiple) - Domain-specific validation scripts (exist)
- `scripts/update-test-references.js` - Test reference updates (exists)

#### Required Infrastructure Before Migration

**Templates Directory**: `scripts/templates/` (missing)
- Action test template
- Rule test template  
- ModActionTestBase configuration template

**Migration Utilities**: `scripts/lib/migration/` (missing)
- AST parsing utilities
- Test file transformation logic
- Configuration extraction tools
- Backup and rollback utilities

### Tooling Implementation Priority

**Pre-Migration (Week 0)**:
1. Create `scripts/migrateMod.js` with basic file parsing
2. Implement `scripts/compareMigrationResults.js` for validation
3. Create migration templates in `scripts/templates/`
4. Test tooling with 1-2 sample files before full migration

**During Migration**: 
- Use existing validation scripts where applicable
- Manual migration for complex cases where tooling insufficient

### Required Migration Templates (Missing)

**Action Test Template** (`scripts/templates/action-test.js.template`):

```javascript
// Template for generating migrated action tests
import { ModActionTestBase } from '../../../common/mods/ModActionTestBase.js';
import {{actionId}}Rule from '../../../../data/mods/{{modId}}/rules/handle_{{actionId}}.rule.json';
import eventIsAction{{ActionId}} from '../../../../data/mods/{{modId}}/conditions/event-is-action-{{actionId}}.condition.json';

class {{ActionId}}ActionTest extends ModActionTestBase {
  constructor() {
    super('{{modId}}', '{{modId}}:{{actionId}}', {{actionId}}Rule, eventIsAction{{ActionId}});
  }
}

describe('{{ModId}}: {{ActionName}} Action', () => {
  const testSuite = new {{ActionId}}ActionTest();
  testSuite.createTestSuite();
});
```

**Note**: Template uses actual ModActionTestBase pattern observed in codebase, not the fictional ModTestFixture.forCategoryAction() pattern originally referenced.

## Rollback and Recovery Strategy

### Rollback Plan

Each migration phase includes rollback capability:

1. **Backup Strategy**: Original files backed up before migration
2. **Branch Strategy**: Migration work done in feature branches
3. **Validation Gates**: Migration only proceeds after validation passes
4. **Rollback Scripts**: Automated rollback if issues discovered

### Recovery Process

**Manual Rollback Process** (since `scripts/rollbackMigration.js` does not exist):

1. **Git-based rollback**: `git checkout HEAD~1 -- tests/integration/mods/<category>/`
2. **Backup restoration**: Restore from manual backups if available
3. **Test validation**: `npm run test:integration tests/integration/mods/<category>/`
4. **Issue documentation**: Document rollback reasons in migration log
5. **Remediation planning**: Analyze failures and plan alternative approach

**Recommendation**: Implement proper rollback tooling before beginning migration phases.

## Implementation Timeline (Revised for Actual Scope)

### Week 0: Pre-Migration Setup (NEW)

- **Day 1-2**: Create missing migration tooling (`scripts/migrateMod.js`, `scripts/validateMigration.js`) 
- **Day 3**: Create migration templates in `scripts/templates/`
- **Day 4**: Test migration tooling with 2-3 sample files
- **Day 5**: Validate tooling and finalize migration process

### Week 1: Exercise Category (Phase 1)

- **Day 1**: Migrate show_off_biceps_action.test.js (schema validation pattern)
- **Day 2**: Infrastructure validation and pattern documentation
- **Day 3-5**: Address any infrastructure gaps discovered during first migration

### Week 2-3: Violence Category (Phase 2)

- **Week 2**: Migrate violence action tests (4 files with complex entity setups)  
- **Week 3**: Validation, pattern refinement, and performance testing

### Week 3-4: Positioning Category (Phase 3)

- **Week 3 (partial) - Week 4**: Migrate positioning tests (13 files with complex component relationships)
- **Focus**: ADD_COMPONENT handler patterns and positioning relationships

### Week 5-6: Sex Category (Phase 4)  

- **Week 5-6**: Migrate sex category tests (10 files with complex anatomy requirements)
- **Focus**: Anatomy component patterns and explicit content validation

### Week 6-8: Intimacy Category (Phase 5)

- **Week 6-8**: Migrate intimacy tests (27 files - largest category)
- **Focus**: Scale validation and performance optimization
- **Buffer time**: Additional week for largest category complexity

**Total Timeline**: 8 weeks (vs original 5 weeks) due to:
- Missing tooling requirements (+1 week)
- 40% larger scope (56 vs 48 files, 21,600+ vs 1,920 lines) (+2 weeks)
- More complex patterns than originally assumed

## Success Criteria and Validation

### Phase Success Criteria

Each phase must meet these criteria before proceeding:

**Functional Criteria**:

- [ ] All migrated tests pass with identical behavior to originals
- [ ] No test behavior regressions introduced
- [ ] All entity and event patterns maintained
- [ ] Error scenarios handled identically

**Quality Criteria**:

- [ ] Code reduction target achieved (>70% duplication elimination)
- [ ] Performance within acceptable thresholds (<20% regression)
- [ ] Test reliability maintained or improved
- [ ] Pattern consistency achieved across category

**Process Criteria**:

- [ ] Migration process documented and repeatable
- [ ] Rollback capability validated and available
- [ ] Team feedback incorporated and addressed
- [ ] Infrastructure improvements identified and implemented

### Final Migration Validation (Revised Metrics)

**Code Reduction Metrics**:

- **Target**: 85-90% reduction in duplicated code (revised for scale)
- **Measurement**: Line count before/after migration  
- **Success**: From 21,600+ lines to <1,500 lines of unique code

**Performance Validation**:

- **Target**: No more than 30% performance regression (adjusted for scale)
- **Measurement**: Test suite execution time comparison
- **Success**: All test categories execute within revised performance thresholds

**Developer Experience**:

- **Target**: Easier test maintenance and development
- **Measurement**: Developer feedback and new test creation time
- **Success**: 70%+ reduction in time to create/modify tests (improved with infrastructure maturity)

**Migration Completion**:

- **Target**: All 56 files successfully migrated within 8-week timeline
- **Measurement**: File migration count and timeline adherence
- **Success**: 100% migration completion with no rollbacks required

## Risk Mitigation

### Identified Risks and Mitigations

**CRITICAL: Missing Tooling Risk**:

- **Risk**: Required migration scripts (`migrateMod.js`, `validateMigration.js`, templates) do not exist
- **Impact**: HIGH - Cannot execute automated migration without tooling
- **Mitigation**: Implement missing tooling in Week 0 before migration begins
- **Contingency**: Manual migration with increased timeline (7-8 weeks vs 5 weeks)

**Scale Underestimation Risk**:

- **Risk**: Original scope (48 files/1,920 lines) vs actual (56 files/21,600+ lines) - 40% larger
- **Impact**: HIGH - Timeline and resource requirements significantly underestimated  
- **Mitigation**: Revised timeline with additional phases and realistic estimates
- **Contingency**: Phased delivery approach, deferring non-critical categories

**Behavior Change Risk**:

- **Risk**: Migration introduces subtle test behavior changes
- **Impact**: MEDIUM - Could break existing test assumptions
- **Mitigation**: Comprehensive baseline capture and validation per phase
- **Contingency**: Git-based rollback capability (automated tooling missing)

**Performance Regression Risk**:

- **Risk**: New infrastructure significantly slows test execution (21,600+ lines vs 1,920)
- **Impact**: MEDIUM - Developer productivity impact
- **Mitigation**: Performance benchmarking and optimization, staged rollout
- **Contingency**: Performance tuning or selective infrastructure adoption

**Development Disruption Risk**:

- **Risk**: Migration blocks ongoing development work
- **Impact**: MEDIUM - Team productivity during 7-8 week migration
- **Mitigation**: Feature branch strategy with gradual integration
- **Contingency**: Parallel development tracks during migration

**Infrastructure Compatibility Risk**:

- **Risk**: Infrastructure bugs discovered during large-scale migration
- **Impact**: HIGH - Could halt migration mid-stream
- **Mitigation**: MODTESTREF-006 comprehensive testing, phased approach
- **Contingency**: Infrastructure fixes with migration pause/resume capability

## Success Metrics

### Quantitative Metrics

**Code Reduction Achievement**:

- **Baseline**: 21,600+ lines of duplicated code across 56 files
- **Target**: <1,500 lines of unique code (based on ModActionTestBase pattern)
- **Success**: >90% reduction in code duplication

**Performance Validation**:

- **Baseline**: Current test execution times per category
- **Target**: No more than 30% increase in execution time (adjusted for scale)
- **Success**: All categories meet performance requirements

**Migration Efficiency**:

- **Target**: Average 8-10 files migrated per week during active migration (revised)
- **Success**: All 56 files migrated within 7-8 week timeline (includes tooling setup)

### Qualitative Metrics

**Developer Satisfaction**:

- **Measurement**: Developer feedback surveys and adoption rate
- **Success**: Positive feedback and preference for new infrastructure

**Test Quality Improvement**:

- **Measurement**: Test reliability and consistency analysis
- **Success**: Reduced test flakiness and increased consistency

**Maintenance Improvement**:

- **Measurement**: Time required to make infrastructure changes
- **Success**: Single-location updates instead of multi-file changes

## Post-Migration Activities

### Cleanup and Optimization

1. **Remove Legacy Patterns**: Clean up any remaining old pattern usage
2. **Documentation Updates**: Update all test documentation with new patterns
3. **Performance Optimization**: Address any performance issues discovered
4. **Infrastructure Refinement**: Enhance infrastructure based on migration learnings

### Knowledge Transfer and Training

1. **Migration Report**: Document lessons learned and best practices
2. **Developer Training**: Train team on new infrastructure usage
3. **Community Documentation**: Prepare documentation for community mod developers
4. **Pattern Library**: Create library of common test patterns and examples

## Next Steps

Upon completion, the migration will:

1. **Enable MODTESTREF-008**: Provide foundation for comprehensive documentation
2. **Support Future Growth**: Infrastructure ready for thousands of mod tests
3. **Enable Community Development**: Clear patterns for community mod testing
4. **Establish Foundation**: Scalable architecture for long-term project growth

This phased migration approach ensures systematic, low-risk conversion of all existing mod integration tests while validating the infrastructure at each step and providing opportunities for iterative improvement.
