# EXEPHAMIG-011: Migrate Positioning Category Test Files

## Overview

Execute migration of Positioning category test files as Phase 3 of the systematic migration strategy. Positioning represents the largest complexity increase, with 13 files featuring dynamic component addition patterns and complex positioning relationships.

## Background Context

Positioning category introduces the most complex patterns yet encountered:
- **13 files total** (largest category so far)
- **Component addition patterns** - Tests add positioning components dynamically
- **Complex entity relationships** - Multi-entity positioning scenarios
- **Mixed patterns** - Combination of action execution and component validation

**Target Files**:
- 11 action test files (kneel_before, stand_behind, turn_around, get_close, step_back, etc.)
- 2 rule test files (turnAroundRule, stepBackRule integration tests)

## Technical Requirements

### 1. Component Addition Pattern Migration

#### New Infrastructure Requirements
```javascript
// Extension to ModActionTestBase for component addition
class ModActionTestBase {
  /**
   * Assert that a component was added to an entity
   */
  assertComponentAdded(entityId, componentId, expectedData) {
    const entity = this.entityManager.getEntity(entityId);
    expect(entity.components[componentId]).toBeDefined();
    if (expectedData) {
      expect(entity.components[componentId]).toMatchObject(expectedData);
    }
  }

  /**
   * Setup positioning test scenario
   */
  setupPositioningScenario(names = ['Alice', 'Bob']) {
    const { actor, target } = this.createCloseActors(names);
    
    // Ensure actors are positioned for interaction
    this.ensureActorsInSameLocation(actor.id, target.id);
    this.addComponent(actor.id, 'positioning:closeness', { 
      partners: [target.id] 
    });
    this.addComponent(target.id, 'positioning:closeness', { 
      partners: [actor.id] 
    });
    
    return { actor, target };
  }
}
```

#### Positioning-Specific Template
```javascript
// positioning-action.template
import { ModActionTestBase } from '../../../common/mods/ModActionTestBase.js';

class {{ActionId}}ActionTest extends ModActionTestBase {
  constructor() {
    super('positioning', 'positioning:{{actionId}}', {{actionId}}Rule, eventIsAction{{ActionId}});
  }

  setupPositioningTest() {
    const { actor, target } = this.setupPositioningScenario(['{{actorName}}', '{{targetName}}']);
    return { actor, target };
  }
}

describe('Positioning: {{ActionName}} Action', () => {
  const testSuite = new {{ActionId}}ActionTest();
  testSuite.createTestSuite();

  it('should add {{positioningComponent}} component', async () => {
    const { actor, target } = testSuite.setupPositioningTest();
    
    await testSuite.executeAction(actor.id, target.id);
    testSuite.assertActionSuccess();
    testSuite.assertComponentAdded(actor.id, '{{positioningComponent}}', {
      {{expectedComponentData}}
    });
  });
});
```

### 2. Migration Execution Strategy

#### Phase 3A: Infrastructure Extensions (Days 1-2)
- Extend ModActionTestBase with component addition validation
- Create positioning-specific templates
- Implement positioning scenario setup methods

#### Phase 3B: File Migration (Days 3-5)
- Migrate 11 action test files using batch processing
- Migrate 2 rule test files
- Validate each migration before proceeding

#### Phase 3C: Validation and Refinement (Days 6-7)
- Comprehensive behavioral validation
- Performance testing with larger file count
- Template and infrastructure refinement

## Implementation Specifications

### Expected Code Reduction
- **Before**: ~800-900 lines across 13 files
- **After**: ~300-400 lines (65-70% reduction)
- **Pattern**: Component addition boilerplate → infrastructure methods

### Performance Targets
- **Individual file**: <45 seconds migration time
- **Batch processing**: <10 minutes for all 13 files
- **Test execution**: <40% performance regression acceptable

## Acceptance Criteria

### Migration Success
- [ ] All 13 positioning files successfully migrated
- [ ] Component addition patterns work correctly
- [ ] Complex positioning relationships preserved
- [ ] Code reduction targets achieved (65-70%)

### Infrastructure Validation
- [ ] ModActionTestBase extensions handle positioning complexity
- [ ] Templates generate correct component addition tests
- [ ] Batch processing works efficiently for larger category

### Quality Standards
- [ ] Generated tests pass when executed
- [ ] Positioning-specific patterns captured and reusable
- [ ] Performance within acceptable thresholds
- [ ] Documentation ready for subsequent complex categories

## Dependencies

**Prerequisites**:
- EXEPHAMIG-010: Document Violence Migration Patterns (completed)
- Violence category infrastructure and patterns available

**Enables**:
- EXEPHAMIG-012: Validate Positioning Migration Results
- EXEPHAMIG-013: Document Positioning Migration Patterns

## Timeline

**Estimated Duration**: 7 days

**Risk Factors**: Largest category so far, new component addition patterns, batch processing requirements

**Success Impact**: Validates approach for remaining complex categories (Sex: 10 files, Intimacy: 27 files)