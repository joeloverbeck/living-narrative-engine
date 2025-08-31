# EXEPHAMIG-008: Migrate Violence Category Test Files

## Overview

Execute the migration of Violence category test files to new testing infrastructure as Phase 2 of the systematic mod test migration strategy. Violence category introduces runtime integration patterns and entity relationship complexity beyond the schema validation patterns of Exercise category.

## Background Context

The Living Narrative Engine project has 4 test files in the Violence category representing the next complexity level in the migration progression. Violence category serves as the bridge between simple schema validation (Exercise) and complex component manipulation (Positioning).

**Migration Progression**:
- **Phase 1 Complete**: Exercise (2 files) - Schema validation patterns ✓
- **Phase 2 Current**: Violence (4 files) - Runtime integration patterns
- **Phase 3-5 Pending**: Positioning (13), Sex (10), Intimacy (27 files)

Violence category introduces key complexity factors:
- **Runtime Integration**: Tests execute actual game logic, not just schema validation
- **Entity Relationships**: Tests set up attacker/victim relationships
- **Action Execution**: Tests validate actual action execution and results
- **Component Dependencies**: Tests may include anatomy components for body-related violence

## Problem Statement

The Violence category contains legacy test files that require migration from manual entity setup and execution patterns to new infrastructure:

**Target Files for Migration**:
1. `tests/integration/mods/violence/slap_action.test.js` - Basic violence action with positioning
2. `tests/integration/mods/violence/sucker_punch_action.test.js` - Violence action with surprise element
3. `tests/integration/mods/violence/rules/slapRule.integration.test.js` - Rule processing for slap action
4. `tests/integration/mods/violence/rules/suckerPunchRule.integration.test.js` - Rule processing for sucker punch

**Current Issues**:
- Manual entity setup with 50+ lines of boilerplate per test
- Direct event dispatching instead of infrastructure abstractions
- Duplicated attacker/victim relationship patterns
- Manual assertion patterns instead of infrastructure helpers

## Technical Requirements

### 1. File Migration Specifications

#### Target File 1: `slap_action.test.js` (Representative Pattern)

**Current Pattern** (Manual Runtime Integration):
```javascript
// 50+ lines of manual setup and execution
describe('Violence: Slap Action', () => {
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
    const aliceEntity = testEnv.entityManager.getEntity('actor1');
    const bobEntity = testEnv.entityManager.getEntity('target1');
    // ... extensive manual validation
  });
});
```

**Target Pattern** (Using New Infrastructure):
```javascript
import { ModActionTestBase } from '../../../common/mods/ModActionTestBase.js';
import slapRule from '../../../../data/mods/violence/rules/handle_slap.rule.json';
import eventIsActionSlap from '../../../../data/mods/violence/conditions/event-is-action-slap.condition.json';

class SlapActionTest extends ModActionTestBase {
  constructor() {
    super('violence', 'violence:slap', slapRule, eventIsActionSlap);
  }
  
  setupViolenceScenario() {
    const { actor, target } = this.createCloseActors(['Alice', 'Bob']);
    
    // Add violence-specific positioning requirements
    this.ensureActorsInSameLocation(actor.id, target.id);
    this.ensureActorsCanReachEachOther(actor.id, target.id);
    
    return { actor, target };
  }
}

describe('Violence: Slap Action', () => {
  const testSuite = new SlapActionTest();
  testSuite.createTestSuite();
  
  // Custom tests for violence-specific scenarios
  it('should handle positioning requirements correctly', async () => {
    const { actor, target } = testSuite.setupViolenceScenario();
    
    await testSuite.executeAction(actor.id, target.id);
    testSuite.assertActionSuccess('Alice slaps Bob');
    testSuite.assertEntityStateChanged(target.id, 'received_violence', true);
  });
});
```

**Migration Characteristics**:
- **Pattern Type**: Runtime integration with entity relationships
- **Code Reduction**: 50+ lines → 15-20 lines (60-70% reduction expected)
- **Infrastructure Usage**: ModActionTestBase with violence-specific extensions
- **Complexity Level**: Medium (introduces runtime patterns)

#### Violence Category Specific Patterns

**Entity Relationship Patterns**:
```javascript
// Common violence test patterns
class ViolenceTestBase extends ModActionTestBase {
  setupAttackerVictim(names = ['Alice', 'Bob']) {
    const { actor, target } = this.createCloseActors(names);
    
    // Ensure actors can interact violently
    this.ensureActorsInSameLocation(actor.id, target.id);
    this.addComponent(actor.id, 'positioning:closeness', { 
      partners: [target.id] 
    });
    this.addComponent(target.id, 'positioning:closeness', { 
      partners: [actor.id] 
    });
    
    return { attacker: actor, victim: target };
  }

  assertViolentAction(attackerId, victimId, expectedMessage) {
    this.assertActionSuccess(expectedMessage);
    this.assertEntityExists(attackerId);
    this.assertEntityExists(victimId);
    // Additional violence-specific assertions
  }
}
```

### 2. Infrastructure Requirements for Violence Category

#### ModActionTestBase Extensions Needed
```javascript
// Violence-specific extensions to ModActionTestBase
class ModActionTestBase {
  // Existing base functionality...
  
  /**
   * Ensure actors can reach each other for violence
   */
  ensureActorsCanReachEachOther(actorId, targetId) {
    // Validate positioning allows interaction
    // Add necessary components for reachability
  }

  /**
   * Setup attacker/victim relationship for violence tests
   */
  setupViolenceRelationship(attackerId, victimId) {
    this.ensureActorsInSameLocation(attackerId, victimId);
    this.ensureActorsCanReachEachOther(attackerId, victimId);
    
    // Add positioning closeness components
    this.addComponent(attackerId, 'positioning:closeness', { 
      partners: [victimId] 
    });
    this.addComponent(victimId, 'positioning:closeness', { 
      partners: [attackerId] 
    });
  }

  /**
   * Assert violence action outcomes
   */
  assertViolenceOutcome(attackerId, victimId, expectedBehavior) {
    this.assertActionSuccess();
    this.assertEntityStateChanged(victimId, 'received_action', true);
    // Violence-specific outcome validation
  }
}
```

#### Template Enhancements for Violence
```javascript
// Violence-specific template additions
const violenceActionTemplate = `
import { ModActionTestBase } from '../../../common/mods/ModActionTestBase.js';
import {{actionId}}Rule from '../../../../data/mods/violence/rules/handle_{{actionId}}.rule.json';
import eventIsAction{{ActionId}} from '../../../../data/mods/violence/conditions/event-is-action-{{actionId}}.condition.json';

class {{ActionId}}ActionTest extends ModActionTestBase {
  constructor() {
    super('violence', 'violence:{{actionId}}', {{actionId}}Rule, eventIsAction{{ActionId}});
  }
  
  setupViolenceScenario() {
    const { attacker, victim } = this.setupAttackerVictim(['{{attackerName}}', '{{victimName}}']);
    return { attacker, victim };
  }
}

describe('Violence: {{ActionName}} Action', () => {
  const testSuite = new {{ActionId}}ActionTest();
  testSuite.createTestSuite();
  
  {{#if hasCustomScenarios}}
  {{#each customScenarios}}
  it('{{description}}', async () => {
    const { attacker, victim } = testSuite.setupViolenceScenario();
    
    await testSuite.executeAction(attacker.id, victim.id);
    testSuite.assertViolenceOutcome(attacker.id, victim.id, '{{expectedBehavior}}');
  });
  {{/each}}
  {{/if}}
});
`;
```

### 3. Migration Execution Process

#### Phase 2A: Infrastructure Preparation
1. **Extend ModActionTestBase**:
   ```bash
   # Add violence-specific methods to ModActionTestBase
   # Implement setupAttackerVictim, assertViolenceOutcome methods
   # Test infrastructure extensions with sample scenarios
   ```

2. **Create Violence Templates**:
   ```bash
   # Create violence-action.template with runtime integration patterns
   # Create violence-rule.template for rule test patterns
   # Validate templates with sample data
   ```

#### Phase 2B: File Migration Execution
1. **Migrate Action Tests**:
   ```bash
   # Migrate slap_action.test.js
   node scripts/migrateMod.js \
     --category violence \
     --file tests/integration/mods/violence/slap_action.test.js \
     --template violence-action \
     --validate

   # Migrate sucker_punch_action.test.js  
   node scripts/migrateMod.js \
     --category violence \
     --file tests/integration/mods/violence/sucker_punch_action.test.js \
     --template violence-action \
     --validate
   ```

2. **Migrate Rule Tests**:
   ```bash
   # Migrate rule test files
   node scripts/migrateMod.js \
     --category violence \
     --file tests/integration/mods/violence/rules/slapRule.integration.test.js \
     --template violence-rule \
     --validate
   ```

#### Phase 2C: Validation and Testing
1. **Behavior Validation**:
   ```bash
   # Capture baselines and validate behavior preservation
   npm run test:integration tests/integration/mods/violence/ -- --reporter=json > violence-baseline.json
   # Compare with migrated results
   node scripts/compareMigrationResults.js violence-baseline.json violence-migrated.json
   ```

2. **Performance Testing**:
   ```bash
   # Validate performance within acceptable thresholds
   node scripts/measurePerformanceImpact.js --category violence --threshold 30
   ```

### 4. Success Validation Criteria

#### Functional Requirements
- [ ] All 4 Violence category files successfully migrated
- [ ] All migrated tests pass when executed independently
- [ ] Runtime integration patterns work correctly with infrastructure
- [ ] Entity relationship setup functions correctly

#### Behavioral Requirements  
- [ ] Migrated tests produce identical results to original tests
- [ ] Action execution behavior preserved exactly
- [ ] Entity state changes match original test expectations
- [ ] Error scenarios handled identically

#### Quality Requirements
- [ ] Code reduction targets achieved (60-70% reduction)
- [ ] Generated code follows project conventions
- [ ] Infrastructure components used correctly and consistently
- [ ] Violence-specific patterns captured and reusable

#### Performance Requirements
- [ ] Test execution time within 30% of baseline
- [ ] Migration process completes within expected timeframe
- [ ] No memory leaks or performance regressions introduced

## Implementation Specifications

### File Structure Impact
```
tests/integration/mods/violence/
├── slap_action.test.js                        [MIGRATED]
├── slap_action.test.js.backup                 [BACKUP]
├── sucker_punch_action.test.js                [MIGRATED]  
├── sucker_punch_action.test.js.backup         [BACKUP]
└── rules/
    ├── slapRule.integration.test.js           [MIGRATED]
    ├── slapRule.integration.test.js.backup    [BACKUP]
    ├── suckerPunchRule.integration.test.js    [MIGRATED]
    └── suckerPunchRule.integration.test.js.backup [BACKUP]
```

### Migration Challenges and Solutions

#### Challenge: Complex Entity Setup
- **Problem**: Violence tests require specific attacker/victim positioning
- **Solution**: Create standardized setupViolenceScenario() methods
- **Validation**: Ensure entity relationships work correctly

#### Challenge: Runtime Integration Testing  
- **Problem**: Tests execute actual game logic, not just schema validation
- **Solution**: Extend ModActionTestBase with runtime execution capabilities
- **Validation**: Verify action execution produces expected outcomes

#### Challenge: Anatomy Component Dependencies
- **Problem**: Some violence tests may require anatomy components
- **Solution**: Conditional anatomy setup in templates
- **Validation**: Ensure anatomy requirements handled correctly

## Acceptance Criteria

### Migration Success Criteria
- [ ] All 4 Violence category test files successfully migrated using tooling
- [ ] Generated tests use ModActionTestBase infrastructure correctly
- [ ] Violence-specific patterns captured in reusable components
- [ ] Code reduction targets achieved (60-70% line reduction)

### Behavioral Preservation Criteria
- [ ] All migrated tests pass when executed
- [ ] Test behavior identical to original tests (validated by framework)
- [ ] Action execution outcomes preserved exactly
- [ ] Entity relationship setup works correctly

### Infrastructure Enhancement Criteria
- [ ] ModActionTestBase extensions implemented and tested
- [ ] Violence-specific templates created and validated
- [ ] Template processing handles violence patterns correctly
- [ ] Infrastructure supports runtime integration testing

### Process Validation Criteria
- [ ] Migration tooling handles runtime integration patterns correctly
- [ ] Validation framework accurately detects behavioral differences
- [ ] Performance meets expectations for more complex category
- [ ] Process insights captured for subsequent phases

## Dependencies

**Prerequisites**:
- EXEPHAMIG-005: Exercise Category Migration (completed - patterns established)
- EXEPHAMIG-006: Exercise Migration Validation (completed - tooling validated)  
- EXEPHAMIG-007: Exercise Pattern Documentation (completed - learnings captured)

**Enables**:
- EXEPHAMIG-009: Validate Violence Migration Results
- EXEPHAMIG-010: Document Violence Migration Patterns
- EXEPHAMIG-011: Phase 3 Positioning Category Migration

## Risk Mitigation

### Runtime Complexity Risk
- **Risk**: Runtime integration more complex than schema validation
- **Mitigation**: Start with simpler slap_action, build complexity gradually
- **Contingency**: Manual migration for complex scenarios, improve tooling iteratively

### Infrastructure Gap Risk
- **Risk**: ModActionTestBase lacks needed violence-specific capabilities
- **Mitigation**: Implement infrastructure extensions before migration
- **Contingency**: Create violence-specific base class if needed

### Behavior Preservation Risk  
- **Risk**: Runtime integration makes behavior preservation more challenging
- **Mitigation**: Comprehensive baseline capture and validation
- **Contingency**: Manual validation and adjustment for any behavioral differences

### Performance Risk
- **Risk**: Runtime tests may have significant performance impact
- **Mitigation**: Performance measurement and optimization during migration
- **Contingency**: Accept reasonable performance tradeoffs for maintainability gains

## Success Metrics

### Quantitative Metrics
- **Migration Success Rate**: 100% (all 4 files successfully migrated)
- **Code Reduction**: 60-70% reduction in total line count
- **Behavioral Preservation**: 100% identical test behavior
- **Performance Impact**: <30% increase in test execution time

### Qualitative Metrics
- **Infrastructure Maturity**: Violence patterns integrate smoothly with infrastructure
- **Process Refinement**: Migration process handles increased complexity effectively
- **Pattern Reusability**: Violence patterns captured for reuse in future categories
- **Team Confidence**: High confidence in approach for remaining complex phases

## Timeline

**Estimated Duration**: 4-5 days

**Detailed Schedule**:
- **Day 1**: Infrastructure extension and template creation
  - Morning: Extend ModActionTestBase with violence-specific methods
  - Afternoon: Create and validate violence-specific templates
- **Day 2**: Migration execution
  - Morning: Migrate action test files (slap_action, sucker_punch_action)
  - Afternoon: Migrate rule test files
- **Day 3**: Validation and testing
  - Morning: Execute behavioral validation and comparison
  - Afternoon: Performance testing and analysis
- **Day 4**: Issue resolution and refinement
  - Morning: Address any issues discovered during validation
  - Afternoon: Refine templates and infrastructure based on results
- **Day 5** (if needed): Final validation and documentation prep
  - Address remaining issues and prepare for validation phase

## Next Steps

Upon successful completion:
1. **EXEPHAMIG-009**: Validate Violence Migration Results (comprehensive validation)
2. **EXEPHAMIG-010**: Document Violence Migration Patterns (capture runtime integration learnings)
3. **Phase 3 Preparation**: Apply violence migration learnings to positioning category preparation

**Critical Success Factor**: Violence migration validates the infrastructure's ability to handle runtime integration patterns. Success here proves the approach can scale to the complex positioning and anatomy requirements in subsequent phases.