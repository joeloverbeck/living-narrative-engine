# EXEPHAMIG-017: Migrate Intimacy Category Test Files

## Overview

Execute migration of Intimacy category test files as Phase 5, the final and largest phase of the systematic migration strategy. Intimacy represents the ultimate scale challenge with 27 files featuring consistent patterns, proven infrastructure capability, and the culmination of all previous migration learnings.

## Background Context

Intimacy category represents the final validation of migration strategy success:
- **27 files total** (largest category - almost 50% of total migration)
- **Scale Validation** - Ultimate test of infrastructure capability and batch processing
- **Pattern Consistency** - Most consistent patterns across files (leveraging all previous learnings)
- **Strategy Completion** - Final phase completing 56-file migration from 21,600+ lines to <1,500 lines

**Target Files**:
- 25 action test files (various intimate actions with established patterns)
- 2 rule test files (intimacy-related rules with proven integration patterns)

## Technical Requirements

### 1. Large-Scale Infrastructure Application

#### Proven Infrastructure Utilization
```javascript
// Leveraging all established ModActionTestBase patterns
class ModActionTestBase {
  /**
   * Apply all learned patterns from previous phases
   */
  setupIntimacyScenario(actors = ['Alice', 'Bob']) {
    // Leverage positioning patterns (Phase 3)
    const { actor, target } = this.setupPositioningScenario(actors);
    
    // Apply anatomy patterns (Phase 4) when needed
    if (this.requiresAnatomy()) {
      this.addAnatomyComponents(actor.id, this.getRequiredActorAnatomy());
      this.addAnatomyComponents(target.id, this.getRequiredTargetAnatomy());
    }
    
    // Add intimacy-specific relationship components
    this.addIntimacyRelationshipComponents(actor.id, target.id);
    
    return { actor, target };
  }

  /**
   * Add intimacy relationship components
   */
  addIntimacyRelationshipComponents(actorId, targetId) {
    this.addComponent(actorId, 'intimacy:relationship', {
      partners: [targetId],
      trust_level: 'high',
      emotional_state: 'receptive'
    });
    this.addComponent(targetId, 'intimacy:relationship', {
      partners: [actorId],
      trust_level: 'high',
      emotional_state: 'receptive'
    });
  }

  /**
   * Assert intimacy-specific outcomes combining all patterns
   */
  assertIntimacyActionOutcome(actorId, targetId, expectedMessage, additionalComponents = []) {
    this.assertActionSuccess(expectedMessage);
    
    // Validate relationship components updated
    this.assertComponentUpdated(actorId, 'intimacy:relationship');
    this.assertComponentUpdated(targetId, 'intimacy:relationship');
    
    // Check additional components if needed
    additionalComponents.forEach(component => {
      this.assertComponentAdded(actorId, component.id, component.data);
    });
  }
}
```

#### Intimacy-Specific Template
```javascript
// intimacy-action.template (leveraging all previous template learnings)
import { ModActionTestBase } from '../../../common/mods/ModActionTestBase.js';

class {{ActionId}}ActionTest extends ModActionTestBase {
  constructor() {
    super('intimacy', 'intimacy:{{actionId}}', {{actionId}}Rule, eventIsAction{{ActionId}});
  }

  setupIntimacyTest() {
    const { actor, target } = this.setupIntimacyScenario(['{{actorName}}', '{{targetName}}']);
    
    {{#if requiresAnatomy}}
    // Apply anatomy patterns from sex category
    this.addAnatomyComponents(actor.id, [{{#each actorAnatomy}}'{{this}}'{{#unless @last}}, {{/unless}}{{/each}}]);
    this.addAnatomyComponents(target.id, [{{#each targetAnatomy}}'{{this}}'{{#unless @last}}, {{/unless}}{{/each}}]);
    {{/if}}
    
    return { actor, target };
  }
}

describe('Intimacy: {{ActionName}} Action', () => {
  const testSuite = new {{ActionId}}ActionTest();
  testSuite.createTestSuite();

  it('should handle intimacy relationship requirements', async () => {
    const { actor, target } = testSuite.setupIntimacyTest();
    
    await testSuite.executeAction(actor.id, target.id);
    testSuite.assertIntimacyActionOutcome(
      actor.id, 
      target.id, 
      '{{expectedMessage}}',
      [{{#each additionalComponents}}
        { id: '{{id}}', data: {{{data}}} }{{#unless @last}},{{/unless}}
      {{/each}}]
    );
  });

  {{#if hasFailureScenarios}}
  it('should handle missing relationship components gracefully', async () => {
    const { actor, target } = testSuite.createCloseActors(['Alice', 'Bob']);
    // No intimacy relationship components added
    
    await testSuite.executeAction(actor.id, target.id);
    testSuite.assertActionFailure('{{relationshipMissingMessage}}');
  });
  {{/if}}

  {{#if requiresAnatomy}}
  it('should handle anatomy requirements for intimate actions', async () => {
    const { actor, target } = testSuite.setupIntimacyTest();
    
    await testSuite.executeAction(actor.id, target.id);
    testSuite.assertAnatomyActionOutcome(
      actor.id, 
      target.id, 
      [{{#each requiredAnatomy}}'{{this}}'{{#unless @last}}, {{/unless}}{{/each}}],
      '{{expectedMessage}}'
    );
  });
  {{/if}}
});
```

### 2. Large-Scale Migration Execution Strategy

#### Phase 5A: Infrastructure Integration (Days 1-2)
- Integrate all patterns from previous phases (positioning, anatomy, complex prerequisites)
- Create intimacy-specific templates leveraging proven approaches
- Enhance ModActionTestBase with intimacy relationship components

#### Phase 5B: Batch Migration Execution (Days 3-6)
- Execute large-scale batch migration of all 27 files
- Apply learned batch processing optimizations from positioning phase
- Implement progress tracking and validation for large batch

#### Phase 5C: Comprehensive Validation (Days 7-8)
- Execute comprehensive validation across all 27 files
- Performance validation for largest category
- Integration testing across entire migration

## Implementation Specifications

### Expected Code Reduction (Largest Impact)
- **Before**: ~2,400-2,700 lines across 27 files (most content)
- **After**: ~600-800 lines (70%+ reduction - best efficiency due to pattern consistency)
- **Pattern**: Intimacy complexity → infrastructure abstractions (most mature patterns)

### Performance Targets (Scaled for Volume)
- **Individual file**: <50 seconds migration time (pattern efficiency gains)
- **Batch processing**: <18 minutes for all 27 files (based on positioning scaling)
- **Test execution**: <40% performance regression acceptable (mature infrastructure)

### Large-Scale Batch Processing Strategy
```bash
# Large-scale intimacy category migration
node scripts/migrateMod.js \
  --category intimacy \
  --batch \
  --template intimacy-action \
  --progress-tracking \
  --validate \
  --parallel-processing

# Enhanced batch with all learned optimizations
node scripts/migrateMod.js \
  --category intimacy \
  --batch \
  --template intimacy-action \
  --anatomy-detection \
  --relationship-components \
  --progress-reporting \
  --comprehensive-validation \
  --parallel-optimization
```

## Acceptance Criteria

### Migration Success Criteria
- [ ] All 27 intimacy files successfully migrated
- [ ] Intimacy relationship components handled correctly
- [ ] Pattern consistency maintained across large scale
- [ ] Code reduction targets exceeded (70%+ due to pattern maturity)

### Large-Scale Infrastructure Validation
- [ ] Batch processing handles 27 files efficiently
- [ ] All previous phase patterns successfully applied
- [ ] Infrastructure demonstrates complete capability across all complexity levels
- [ ] Memory usage remains stable throughout large batch

### Quality and Performance Criteria
- [ ] Generated tests pass and behave identically to originals
- [ ] Performance targets met despite large scale
- [ ] Pattern consistency results in highest efficiency gains
- [ ] Professional standards maintained across all intimate content

## Dependencies

**Prerequisites**:
- EXEPHAMIG-016: Document Sex Migration Patterns (completed - anatomy patterns available)
- EXEPHAMIG-013: Document Positioning Migration Patterns (completed - batch processing patterns available)
- EXEPHAMIG-010: Document Violence Migration Patterns (completed - runtime integration patterns available)

**Enables**:
- EXEPHAMIG-018: Validate Intimacy Migration Results
- EXEPHAMIG-019: Document Intimacy Migration Patterns
- Complete migration strategy success

## Risk Mitigation

### Large-Scale Processing Risk
- **Risk**: 27-file batch processing overwhelms infrastructure
- **Mitigation**: Proven batch processing from positioning (13 files), incremental approach available
- **Contingency**: Sub-batch processing in groups of 10-15 files if needed

### Pattern Application Risk
- **Risk**: Complex patterns from previous phases don't integrate well
- **Mitigation**: All patterns validated through previous phases, systematic integration approach
- **Contingency**: Phase-specific pattern application if integration issues arise

### Performance Risk
- **Risk**: Large-scale migration impacts performance unacceptably
- **Mitigation**: Performance optimizations from all previous phases, monitoring throughout
- **Contingency**: Performance tuning specific to intimacy patterns

### Quality Risk
- **Risk**: Quality degradation with large scale and pattern complexity
- **Mitigation**: Comprehensive validation framework proven through all previous phases
- **Contingency**: Enhanced quality gates specific to intimacy requirements

## Success Metrics

### Quantitative Success
- **Migration Success**: 100% (all 27 files)
- **Code Reduction**: 70%+ (highest efficiency due to pattern consistency)
- **Performance**: <18 minutes batch processing time
- **Behavioral Preservation**: 100% identical behavior

### Qualitative Success
- **Scale Mastery**: Infrastructure handles largest category successfully
- **Pattern Integration**: All previous learnings successfully applied
- **Strategy Completion**: 56-file migration strategy successfully completed
- **Professional Standards**: Intimate content handled with established professional patterns

## Timeline

**Estimated Duration**: 8 days

**Critical Success Factor**: Intimacy category success completes the 56-file migration strategy, validating the infrastructure capability to handle enterprise-scale mod test migrations and achieving the 90% code reduction goal (21,600+ → <1,500 lines).

## Migration Strategy Completion Impact

### Final Validation
- **Infrastructure Capability**: Proven across all complexity levels (schema → runtime → component → anatomy → intimacy)
- **Scale Capability**: Proven from 2-file categories to 27-file categories
- **Pattern Maturity**: All patterns established and reusable for future mod categories
- **Professional Standards**: Mature approach to all content types

### Enterprise Readiness
- **Batch Processing**: Scales from individual files to 27-file batches
- **Quality Standards**: Maintains 100% behavioral preservation across all categories
- **Performance Standards**: Achieves acceptable performance across all complexity and scale levels
- **Documentation Standards**: Complete patterns available for all migration scenarios