# MODTESTREF-007: Execute Phased Migration Strategy

## Overview

Execute the systematic migration of 48 existing mod integration test files to use the new infrastructure (ModTestHandlerFactory, ModEntityBuilder, ModAssertionHelpers, ModActionTestBase, ModTestFixture). Migration will proceed by category in phases to minimize risk and allow for iterative improvement.

## Problem Statement

### Migration Challenge

The project currently has 48 mod integration test files across 5 categories with:

- **1,920+ lines** of duplicated code that needs to be eliminated
- **Inconsistent patterns** that need to be standardized
- **Different complexity levels** requiring category-specific migration approaches
- **Production dependencies** requiring zero-downtime migration

### File Distribution for Migration

```
tests/integration/mods/
├── exercise/ (2 files) - Simplest category
│   ├── show_off_biceps_action.test.js
│   └── rules/showOffBicepsRule.integration.test.js
├── violence/ (4 files) - Low complexity
│   ├── slap_action.test.js
│   ├── sucker_punch_action.test.js
│   └── rules/ (2 rule test files)
├── positioning/ (8 files) - Medium complexity
│   ├── 6 action test files
│   └── rules/ (2 rule test files)
├── sex/ (9 files) - Medium-high complexity
│   ├── 8 action test files
│   └── rules/pressAgainstBackRule.integration.test.js
└── intimacy/ (25 files) - Highest volume
    ├── 16 action test files
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

1. **Phase 1**: Exercise (2 files) - Validation phase
2. **Phase 2**: Violence (4 files) - Pattern establishment
3. **Phase 3**: Positioning (8 files) - Complexity validation
4. **Phase 4**: Sex (9 files) - Edge case testing
5. **Phase 5**: Intimacy (25 files) - Scale validation

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

**Before** (current manual pattern):

```javascript
import { createRuleTestEnvironment } from '../../common/engine/systemLogicTestEnv.js';
import { QueryComponentHandler } from '../../../src/entities/components/operations/queryComponentHandler.js';
// ... 15+ imports

function createHandlers(entityManager, eventBus, logger) {
  // 30+ lines of identical handler creation
  const safeDispatcher = {
    dispatch: jest.fn((eventType, payload) => {
      eventBus.dispatch(eventType, payload);
      return Promise.resolve(true);
    }),
  };
  return {
    QUERY_COMPONENT: new QueryComponentHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeDispatcher,
    }),
    // ... 6 more handlers
  };
}

describe('exercise:show_off_biceps action integration', () => {
  let testEnv;

  beforeEach(() => {
    // 20+ lines of setup
    const macros = { 'core:logSuccessAndEndTurn': logSuccessMacro };
    const expanded = expandMacros(showOffBicepsRule.actions, {
      get: (type, id) => (type === 'macros' ? macros[id] : undefined),
    });

    const dataRegistry = {
      getAllSystemRules: jest
        .fn()
        .mockReturnValue([{ ...showOffBicepsRule, actions: expanded }]),
      getConditionDefinition: jest.fn((id) =>
        id === 'exercise:event-is-action-show-off-biceps'
          ? eventIsActionShowOffBiceps
          : undefined
      ),
    };

    testEnv = createRuleTestEnvironment({
      createHandlers,
      entities: [],
      rules: [{ ...showOffBicepsRule, actions: expanded }],
      dataRegistry,
    });
  });

  it('should successfully execute show off biceps action', async () => {
    testEnv.reset([
      {
        id: 'actor1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Alice' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
        },
      },
    ]);

    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      eventName: 'core:attempt_action',
      actorId: 'actor1',
      actionId: 'exercise:show_off_biceps',
      originalInput: 'show_off_biceps',
    });

    const successEvent = testEnv.events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent).toBeDefined();
    expect(successEvent.payload.message).toContain(
      'Alice shows off her biceps'
    );

    const perceptibleEvent = testEnv.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();

    const turnEndedEvent = testEnv.events.find(
      (e) => e.eventType === 'core:turn_ended'
    );
    expect(turnEndedEvent).toBeDefined();
  });
});
```

**After** (using new infrastructure):

```javascript
import { ModTestFixture } from '../../common/mods/ModTestFixture.js';

describe('exercise:show_off_biceps action integration', () => {
  let test;

  beforeEach(() => {
    test = ModTestFixture.forExerciseAction('show_off_biceps');
    test.beforeEach();
  });

  it('should successfully execute show off biceps action', async () => {
    const actor = test.createActor('Alice');
    test.resetWithEntities([actor]);

    await test.executeAction(actor.id);
    test.assertActionSuccess('Alice shows off her biceps');
  });
});
```

**Code Reduction**: 55+ lines → 15 lines (73% reduction)

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
it('should successfully execute slap action', async () => {
  const { actor, target } = test.createCloseActors(['Alice', 'Bob']);
  test.resetWithEntities([actor, target]);

  await test.executeAction(actor.id, target.id);
  test.assertActionSuccess('Alice slaps Bob');
});
```

## Phase 3: Positioning Category Migration (Week 3)

**Target Files** (8 files):

- 6 action test files (kneel_before, stand_behind, turn_around, etc.)
- 2 rule test files

**Migration Challenges**:

- Tests require ADD_COMPONENT handler for dynamic positioning components
- Complex positioning relationship management
- Component addition verification patterns

**Infrastructure Usage**:

```javascript
beforeEach(() => {
  test = ModTestFixture.forPositioningAction('kneel_before');
  test.beforeEach();
});

it('should add kneeling position component', async () => {
  const { actor, target } = test.createCloseActors(['Alice', 'Bob']);
  test.resetWithEntities([actor, target]);

  await test.executeAction(actor.id, target.id);
  test.assertActionSuccess();
  test.assertComponentAdded(actor.id, 'positioning:kneeling_before', {
    target: target.id,
  });
});
```

## Phase 4: Sex Category Migration (Week 4)

**Target Files** (9 files):

- 8 action test files (fondle_breasts, rub_penis, pump_penis, etc.)
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

**Target Files** (25 files):

- 16 action test files (kiss_cheek, hug, cuddle, caress, etc.)
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

### Migration Scripts

**File**: `scripts/migrateMod.js`

```javascript
#!/usr/bin/env node

/**
 * Semi-automated migration script for mod test files
 * Usage: node scripts/migrateMod.js <category> <testFile>
 */

class ModTestMigrator {
  static async migrateFile(category, filePath) {
    // 1. Parse existing test file
    // 2. Extract configuration (mod ID, action ID, etc.)
    // 3. Generate new test file using infrastructure
    // 4. Validate behavior matches original
    // 5. Create backup and replace original
  }

  static generateMigratedTest(config) {
    // Generate new test file content using templates
  }

  static validateMigration(originalPath, migratedPath) {
    // Run validation checks
  }
}
```

**File**: `scripts/validateMigration.js`

```javascript
#!/usr/bin/env node

/**
 * Validation script to compare original vs migrated test behavior
 */

class MigrationValidator {
  static async validatePhase(phase) {
    // Run all tests in phase and compare results
    // Generate validation report
    // Highlight any behavioral differences
  }
}
```

### Migration Templates

**Action Test Template**:

```javascript
// Template for generating migrated action tests
import { ModTestFixture } from '../../common/mods/ModTestFixture.js';

describe('{{modId}}:{{actionId}} action integration', () => {
  let test;

  beforeEach(() => {
    test = ModTestFixture.for{{Category}}Action('{{actionId}}');
    test.beforeEach();
  });

  {{#tests}}
  it('{{description}}', async () => {
    {{testBody}}
  });
  {{/tests}}
});
```

## Rollback and Recovery Strategy

### Rollback Plan

Each migration phase includes rollback capability:

1. **Backup Strategy**: Original files backed up before migration
2. **Branch Strategy**: Migration work done in feature branches
3. **Validation Gates**: Migration only proceeds after validation passes
4. **Rollback Scripts**: Automated rollback if issues discovered

### Recovery Process

```javascript
// scripts/rollbackMigration.js
class MigrationRollback {
  static async rollbackPhase(phase) {
    // 1. Restore original test files from backup
    // 2. Validate original tests still pass
    // 3. Document rollback reasons
    // 4. Plan remediation approach
  }
}
```

## Implementation Timeline

### Week 1: Exercise Category (Phase 1)

- **Day 1-2**: Infrastructure setup and validation tooling
- **Day 3**: Migrate show_off_biceps_action.test.js
- **Day 4**: Migrate showOffBicepsRule.integration.test.js
- **Day 5**: Validation, performance testing, and phase review

### Week 2: Violence Category (Phase 2)

- **Day 1**: Migrate slap_action.test.js
- **Day 2**: Migrate sucker_punch_action.test.js
- **Day 3**: Migrate violence rule test files
- **Day 4-5**: Validation and pattern refinement

### Week 3: Positioning Category (Phase 3)

- **Day 1-2**: Migrate positioning action tests (6 files)
- **Day 3**: Migrate positioning rule tests (2 files)
- **Day 4-5**: Complex positioning scenario validation

### Week 4: Sex Category (Phase 4)

- **Day 1-3**: Migrate sex action tests (8 files)
- **Day 4**: Migrate pressAgainstBackRule.integration.test.js
- **Day 5**: Anatomy component validation and edge case testing

### Week 5: Intimacy Category (Phase 5)

- **Day 1-3**: Migrate intimacy action tests (16 files)
- **Day 4**: Migrate intimacy rule tests (9 files)
- **Day 5**: Scale validation and final performance testing

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

### Final Migration Validation

**Code Reduction Metrics**:

- **Target**: 70-80% reduction in duplicated code
- **Measurement**: Line count before/after migration
- **Success**: From 1,920+ lines to <500 lines of unique code

**Performance Validation**:

- **Target**: No more than 20% performance regression
- **Measurement**: Test suite execution time comparison
- **Success**: All test categories execute within performance thresholds

**Developer Experience**:

- **Target**: Easier test maintenance and development
- **Measurement**: Developer feedback and new test creation time
- **Success**: 60%+ reduction in time to create/modify tests

## Risk Mitigation

### Identified Risks and Mitigations

**Behavior Change Risk**:

- **Risk**: Migration introduces subtle test behavior changes
- **Mitigation**: Comprehensive baseline capture and validation
- **Contingency**: Rollback capability with automated restoration

**Performance Regression Risk**:

- **Risk**: New infrastructure significantly slows test execution
- **Mitigation**: Performance benchmarking and optimization
- **Contingency**: Performance tuning or infrastructure optimization

**Development Disruption Risk**:

- **Risk**: Migration blocks ongoing development work
- **Mitigation**: Feature branch strategy with gradual integration
- **Contingency**: Parallel development tracks during migration

**Infrastructure Bug Risk**:

- **Risk**: Infrastructure bugs discovered during migration
- **Mitigation**: MODTESTREF-006 comprehensive testing
- **Contingency**: Infrastructure fixes with migration pause/resume

## Success Metrics

### Quantitative Metrics

**Code Reduction Achievement**:

- **Baseline**: 1,920+ lines of duplicated code across 48 files
- **Target**: <400 lines of unique code
- **Success**: >80% reduction in code duplication

**Performance Validation**:

- **Baseline**: Current test execution times per category
- **Target**: No more than 20% increase in execution time
- **Success**: All categories meet performance requirements

**Migration Efficiency**:

- **Target**: Average 2-3 files migrated per day during active migration
- **Success**: All 48 files migrated within 5-week timeline

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
