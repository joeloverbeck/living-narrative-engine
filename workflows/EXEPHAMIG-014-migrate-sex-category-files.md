# EXEPHAMIG-014: Migrate Sex Category Test Files

## Overview

Execute migration of Sex category test files as Phase 4, representing the most complex migration phase with anatomy component requirements, explicit content validation, and complex entity relationships.

## Background Context

Sex category introduces the highest complexity factors:
- **10 files total** - 9 action tests, 1 rule test
- **Complex anatomy requirements** - Tests require specific body parts and anatomy components
- **Explicit content validation** - Category-specific validation patterns
- **Complex prerequisites** - Most complex prerequisite logic in the project

**Target Files**:
- 9 action test files: fondle_breasts, rub_penis, pump_penis, fondle_penis, press_against_back, etc.
- 1 rule test file: pressAgainstBackRule.integration.test.js

## Technical Requirements

### 1. Anatomy Component Infrastructure

#### ModActionTestBase Anatomy Extensions
```javascript
class ModActionTestBase {
  /**
   * Setup entities with required anatomy components
   */
  setupAnatomyScenario(actorAnatomy, targetAnatomy) {
    const { actor, target } = this.createCloseActors(['Alice', 'Bob']);
    
    // Add anatomy components based on requirements
    if (actorAnatomy) {
      this.addAnatomyComponents(actor.id, actorAnatomy);
    }
    if (targetAnatomy) {
      this.addAnatomyComponents(target.id, targetAnatomy);
    }
    
    return { actor, target };
  }

  /**
   * Add anatomy components to entity
   */
  addAnatomyComponents(entityId, anatomyList) {
    anatomyList.forEach(anatomy => {
      this.addComponent(entityId, `anatomy:${anatomy}`, { 
        present: true,
        accessible: true 
      });
    });
  }

  /**
   * Assert anatomy-specific action outcomes
   */
  assertAnatomyActionOutcome(actorId, targetId, requiredAnatomy, expectedMessage) {
    this.assertActionSuccess(expectedMessage);
    
    // Validate anatomy requirements were checked
    const targetEntity = this.entityManager.getEntity(targetId);
    requiredAnatomy.forEach(anatomy => {
      expect(targetEntity.components[`anatomy:${anatomy}`]).toBeDefined();
    });
  }
}
```

### 2. Sex-Specific Template Creation

#### Sex Action Template with Anatomy Support
```javascript
// sex-action.template
import { ModActionTestBase } from '../../../common/mods/ModActionTestBase.js';

class {{ActionId}}ActionTest extends ModActionTestBase {
  constructor() {
    super('sex', 'sex:{{actionId}}', {{actionId}}Rule, eventIsAction{{ActionId}});
  }

  setupSexScenario() {
    return this.setupAnatomyScenario(
      {{#if actorAnatomy}}[{{#each actorAnatomy}}'{{this}}'{{#unless @last}}, {{/unless}}{{/each}}]{{else}}null{{/if}},
      {{#if targetAnatomy}}[{{#each targetAnatomy}}'{{this}}'{{#unless @last}}, {{/unless}}{{/each}}]{{else}}null{{/if}}
    );
  }
}

describe('Sex: {{ActionName}} Action', () => {
  const testSuite = new {{ActionId}}ActionTest();
  testSuite.createTestSuite();

  {{#if hasAnatomyRequirements}}
  it('should handle anatomy requirements correctly', async () => {
    const { actor, target } = testSuite.setupSexScenario();
    
    await testSuite.executeAction(actor.id, target.id);
    testSuite.assertAnatomyActionOutcome(
      actor.id, 
      target.id, 
      [{{#each requiredAnatomy}}'{{this}}'{{#unless @last}}, {{/unless}}{{/each}}],
      '{{expectedMessage}}'
    );
  });
  {{/if}}

  {{#if hasFailureScenarios}}
  it('should handle missing anatomy gracefully', async () => {
    const { actor, target } = testSuite.createCloseActors(['Alice', 'Bob']);
    // No anatomy components added
    
    await testSuite.executeAction(actor.id, target.id);
    testSuite.assertActionFailure('{{anatomyMissingMessage}}');
  });
  {{/if}}
});
```

### 3. Complex Migration Challenges

#### Anatomy Component Detection and Migration
```javascript
// Enhanced migration script for anatomy pattern detection
class SexCategoryMigrator extends ModMigrator {
  /**
   * Detect anatomy requirements from existing test
   */
  static detectAnatomyRequirements(astData) {
    const anatomyPatterns = [
      'anatomy:breasts',
      'anatomy:penis', 
      'anatomy:vagina',
      'anatomy:buttocks'
    ];
    
    const detectedAnatomy = [];
    astData.traverse(node => {
      if (node.type === 'StringLiteral') {
        anatomyPatterns.forEach(pattern => {
          if (node.value.includes(pattern)) {
            detectedAnatomy.push(pattern.replace('anatomy:', ''));
          }
        });
      }
    });
    
    return detectedAnatomy;
  }

  /**
   * Extract failure scenario patterns
   */
  static extractFailureScenarios(astData) {
    // Look for tests that verify missing anatomy handling
    const failureTests = astData.testCases.filter(test => 
      test.description.includes('missing') || 
      test.description.includes('not present') ||
      test.description.includes('unavailable')
    );
    
    return failureTests.map(test => ({
      scenario: test.description,
      expectedFailure: this.extractExpectedFailureMessage(test)
    }));
  }
}
```

### 4. Migration Execution Process

#### Phase 4A: Anatomy Infrastructure Development (Days 1-2)
```bash
# Extend ModActionTestBase with anatomy support
# Create sex-specific templates with anatomy patterns
# Enhance migration scripts for anatomy detection
```

#### Phase 4B: Complex File Migration (Days 3-5)
```bash
# Migrate anatomy-heavy files (fondle_breasts, rub_penis, etc.)
node scripts/migrateMod.js \
  --category sex \
  --batch \
  --template sex-action \
  --anatomy-detection \
  --validate

# Migrate rule test with complex prerequisites
node scripts/migrateMod.js \
  --file tests/integration/mods/sex/rules/pressAgainstBackRule.integration.test.js \
  --template sex-rule \
  --complex-prerequisites
```

#### Phase 4C: Explicit Content Validation (Days 6-7)
```bash
# Validate explicit content handling
# Ensure appropriate content validation patterns
# Test failure scenarios for missing anatomy
```

## Implementation Specifications

### Expected Complexity and Code Reduction
- **Before**: ~1,200-1,400 lines across 10 files (highest complexity)
- **After**: ~400-500 lines (65-70% reduction despite complexity)
- **Pattern**: Complex anatomy setup → infrastructure abstractions

### Performance Expectations
- **Individual File**: <60 seconds (highest complexity files)
- **Batch Processing**: ~12-15 minutes for all 10 files
- **Test Execution**: <50% performance regression acceptable (anatomy complexity)

## Acceptance Criteria

### Migration Success Criteria
- [ ] All 10 sex category files successfully migrated
- [ ] Anatomy component requirements handled correctly
- [ ] Complex prerequisite logic preserved
- [ ] Explicit content validation patterns maintained

### Infrastructure Validation Criteria
- [ ] Anatomy extensions to ModActionTestBase work correctly
- [ ] Sex-specific templates generate valid tests
- [ ] Failure scenario handling works for missing anatomy
- [ ] Migration scripts detect anatomy patterns accurately

### Quality and Performance Criteria
- [ ] Code reduction targets achieved despite complexity
- [ ] Generated tests pass and behave identically to originals
- [ ] Performance within acceptable thresholds for complex category
- [ ] Explicit content handled appropriately and professionally

## Dependencies

**Prerequisites**:
- EXEPHAMIG-013: Document Positioning Migration Patterns (completed - component patterns available)

**Enables**:
- EXEPHAMIG-015: Validate Sex Migration Results
- EXEPHAMIG-016: Document Sex Migration Patterns

## Risk Mitigation

### Anatomy Complexity Risk
- **Risk**: Anatomy component requirements more complex than anticipated
- **Mitigation**: Incremental approach, start with simpler anatomy tests
- **Contingency**: Create specialized anatomy test base class if needed

### Explicit Content Risk
- **Risk**: Explicit content creates development or validation challenges
- **Mitigation**: Professional, technical approach to content validation
- **Contingency**: Additional review processes for explicit content handling

### Performance Risk
- **Risk**: Complex anatomy tests significantly impact performance
- **Mitigation**: Performance optimization during migration, accept reasonable tradeoffs
- **Contingency**: Anatomy-specific performance optimizations

## Success Metrics

### Quantitative Success
- **Migration Success**: 100% (all 10 files)
- **Code Reduction**: 65-70% despite anatomy complexity
- **Performance**: <50% regression (allowing for anatomy complexity)
- **Behavioral Preservation**: 100% identical behavior

### Qualitative Success
- **Infrastructure Maturity**: Anatomy patterns handled professionally and effectively
- **Complexity Management**: Complex requirements managed through infrastructure
- **Pattern Reusability**: Anatomy patterns available for any future anatomy-related categories
- **Professional Standards**: Explicit content handled appropriately

## Timeline

**Estimated Duration**: 7 days

**Critical Success Factor**: Sex category success validates infrastructure capability to handle the most complex requirements in the project. Success here ensures Intimacy category (27 files) can be completed confidently using established patterns.