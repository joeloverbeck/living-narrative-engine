# EXEPHAMIG-002: Create Migration Templates and Utilities

## Overview

Create the migration templates and utility infrastructure required to systematically convert existing mod integration test files to use the new testing infrastructure. This includes action test templates, rule test templates, and reusable migration patterns.

## Background Context

The Living Narrative Engine project requires migration of 56 test files across 5 mod categories (exercise, violence, positioning, sex, intimacy) from legacy patterns to new infrastructure using ModActionTestBase, ModEntityScenarios, ModAssertionHelpers, and related components.

Each category has different complexity levels and patterns:
- **Exercise** (2 files): Schema validation patterns
- **Violence** (4 files): Runtime integration patterns  
- **Positioning** (13 files): Mixed patterns with dynamic components
- **Sex** (10 files): Complex anatomy requirements
- **Intimacy** (27 files): Large-scale runtime integration

## Problem Statement

The migration scripts (EXEPHAMIG-001) require structured templates and utilities to generate consistent, correct test files. These templates currently **do not exist** and must be created to support:

- Action test file generation
- Rule test file generation
- Category-specific patterns and configurations
- Reusable migration utilities for common transformations

## Technical Requirements

### 1. Create Template Directory Structure

**Required Directory Structure**:
```
scripts/
├── templates/
│   ├── action-test.js.template          # Action test template
│   ├── rule-test.js.template            # Rule test template
│   ├── category-specific/
│   │   ├── exercise-action.template     # Schema validation pattern
│   │   ├── violence-action.template     # Runtime integration pattern
│   │   ├── positioning-action.template  # Component addition pattern
│   │   ├── sex-action.template          # Anatomy requirement pattern
│   │   └── intimacy-action.template     # Standard runtime pattern
│   └── utilities/
│       ├── common-imports.template      # Standard import patterns
│       ├── test-setup.template          # BeforeEach/afterEach patterns
│       └── assertion-patterns.template  # Common assertion patterns
└── lib/
    └── migration/
        ├── templateEngine.js            # Template processing engine
        ├── patternMatcher.js           # Pattern recognition utilities
        └── categoryDetector.js         # Category-specific logic
```

### 2. Action Test Template

**File**: `scripts/templates/action-test.js.template`

**Template Content**:
```javascript
import { ModActionTestBase } from '../../../common/mods/ModActionTestBase.js';
import {{actionId}}Rule from '../../../../data/mods/{{modId}}/rules/handle_{{actionId}}.rule.json';
import eventIsAction{{ActionId}} from '../../../../data/mods/{{modId}}/conditions/event-is-action-{{actionId}}.condition.json';

class {{ActionId}}ActionTest extends ModActionTestBase {
  constructor() {
    super('{{modId}}', '{{modId}}:{{actionId}}', {{actionId}}Rule, eventIsAction{{ActionId}});
  }

  {{#if hasCustomSetup}}
  setupCustomEntities() {
    {{customSetupCode}}
  }
  {{/if}}

  {{#if hasAnatomyRequirements}}
  setupAnatomyComponents() {
    {{anatomySetupCode}}
  }
  {{/if}}
}

describe('{{ModId}}: {{ActionName}} Action', () => {
  const testSuite = new {{ActionId}}ActionTest();
  testSuite.createTestSuite();

  {{#each customTests}}
  {{testDescription}}
  {{testCode}}
  {{/each}}
});
```

**Template Variables**:
- `{{modId}}` - Mod identifier (e.g., 'violence')
- `{{actionId}}` - Action identifier (e.g., 'slap') 
- `{{ActionId}}` - PascalCase action identifier (e.g., 'Slap')
- `{{ModId}}` - PascalCase mod identifier (e.g., 'Violence')
- `{{ActionName}}` - Human-readable action name (e.g., 'Slap Action')
- `{{customSetupCode}}` - Category-specific setup code
- `{{anatomySetupCode}}` - Anatomy component setup
- `{{customTests}}` - Array of additional test cases

### 3. Rule Test Template

**File**: `scripts/templates/rule-test.js.template`

**Template Content**:
```javascript
import { ModRuleTestBase } from '../../../common/mods/ModRuleTestBase.js';
import {{ruleId}}Rule from '../../../../data/mods/{{modId}}/rules/{{ruleId}}.rule.json';
import {{conditionId}}Condition from '../../../../data/mods/{{modId}}/conditions/{{conditionId}}.condition.json';

class {{RuleId}}RuleTest extends ModRuleTestBase {
  constructor() {
    super('{{modId}}', {{ruleId}}Rule, {{conditionId}}Condition);
  }
}

describe('{{ModId}}: {{RuleName}} Rule', () => {
  const testSuite = new {{RuleId}}RuleTest();
  testSuite.createTestSuite();
});
```

### 4. Category-Specific Templates

#### Exercise Category Template
**File**: `scripts/templates/category-specific/exercise-action.template`

**Pattern**: Schema validation focused
```javascript
// Schema validation pattern for exercise category
import { ModAssertionHelpers } from '../../common/mods/ModAssertionHelpers.js';

describe('Exercise Mod: {{ActionName}} Action', () => {
  let actionData;

  beforeEach(async () => {
    actionData = await ModAssertionHelpers.loadActionData('exercise', '{{actionId}}');
  });

  describe('Action Properties', () => {
    it('should have correct action properties', () => {
      ModAssertionHelpers.assertActionStructure(actionData, {
        id: 'exercise:{{actionId}}',
        name: '{{ActionName}}',
        targets: '{{targets}}',
        template: '{{template}}'
      });
    });

    {{#if hasVisualStyling}}
    it('should use correct visual styling', () => {
      ModAssertionHelpers.assertVisualStyling(actionData.visual, {
        backgroundColor: '{{backgroundColor}}',
        textColor: '{{textColor}}',
        hoverBackgroundColor: '{{hoverBackgroundColor}}',
        hoverTextColor: '{{hoverTextColor}}'
      });
    });
    {{/if}}

    {{#if hasPrerequisites}}
    it('should have correct prerequisites', () => {
      ModAssertionHelpers.assertPrerequisites(actionData.prerequisites, {
        count: {{prerequisiteCount}},
        logicType: '{{logicType}}',
        conditions: {{prerequisiteConditions}}
      });
    });
    {{/if}}
  });
});
```

#### Violence Category Template  
**File**: `scripts/templates/category-specific/violence-action.template`

**Pattern**: Runtime integration with entity relationships
```javascript
import { ModActionTestBase } from '../../../common/mods/ModActionTestBase.js';

class {{ActionId}}ActionTest extends ModActionTestBase {
  constructor() {
    super('violence', 'violence:{{actionId}}', {{actionId}}Rule, eventIsAction{{ActionId}});
  }

  setupEntityRelationships() {
    const { actor, target } = this.createCloseActors(['{{actorName}}', '{{targetName}}']);
    
    // Add positioning relationships for violence
    this.addComponent(actor.id, 'positioning:closeness', { 
      partners: [target.id] 
    });
    this.addComponent(target.id, 'positioning:closeness', { 
      partners: [actor.id] 
    });

    return { actor, target };
  }
}

describe('Violence: {{ActionName}} Action', () => {
  const testSuite = new {{ActionId}}ActionTest();
  testSuite.createTestSuite();
});
```

#### Positioning Category Template
**File**: `scripts/templates/category-specific/positioning-action.template`

**Pattern**: Component addition and positioning relationships
```javascript
import { ModActionTestBase } from '../../../common/mods/ModActionTestBase.js';

class {{ActionId}}ActionTest extends ModActionTestBase {
  constructor() {
    super('positioning', 'positioning:{{actionId}}', {{actionId}}Rule, eventIsAction{{ActionId}});
  }

  setupPositioningTest() {
    const { actor, target } = this.createCloseActors(['{{actorName}}', '{{targetName}}']);
    return { actor, target };
  }

  validatePositioningComponent(actorId, expectedComponent, expectedData) {
    this.assertComponentAdded(actorId, expectedComponent, expectedData);
  }
}

describe('Positioning: {{ActionName}} Action', () => {
  const testSuite = new {{ActionId}}ActionTest();
  testSuite.createTestSuite();

  it('should add {{positioningComponent}} component', async () => {
    const { actor, target } = testSuite.setupPositioningTest();
    
    await testSuite.executeAction(actor.id, target.id);
    testSuite.assertActionSuccess();
    testSuite.validatePositioningComponent(actor.id, '{{positioningComponent}}', {
      {{expectedComponentData}}
    });
  });
});
```

### 5. Template Processing Engine

**File**: `scripts/lib/migration/templateEngine.js`

**Core Functionality**:
```javascript
class TemplateEngine {
  /**
   * Process template with variable substitution
   */
  static processTemplate(templatePath, variables) {
    // Load template file
    // Replace template variables using handlebars-style syntax
    // Handle conditional blocks {{#if condition}}
    // Handle loops {{#each array}}
    // Validate output syntax
  }

  /**
   * Select appropriate template based on category and file type
   */
  static selectTemplate(category, fileType, characteristics) {
    // fileType: 'action' | 'rule'
    // characteristics: { hasAnatomy, hasPositioning, isSchemaOnly, etc. }
    // Returns: template path
  }

  /**
   * Extract variables from existing test file
   */
  static extractVariables(existingTestPath, astData) {
    // Parse existing test structure
    // Extract test descriptions, entity names, action IDs
    // Identify patterns and characteristics
    // Return variable mapping object
  }
}
```

### 6. Pattern Recognition Utilities

**File**: `scripts/lib/migration/patternMatcher.js`

**Core Functionality**:
```javascript
class PatternMatcher {
  /**
   * Identify test patterns in existing files
   */
  static identifyPatterns(astData) {
    // Detect: schema validation vs runtime integration
    // Identify: entity setup patterns
    // Recognize: assertion patterns
    // Catalog: import patterns
  }

  /**
   * Match patterns to appropriate templates
   */
  static matchToTemplate(patterns, category) {
    // Map detected patterns to template selection
    // Handle category-specific logic
    // Return template recommendation with confidence
  }

  /**
   * Extract reusable code patterns
   */
  static extractReusablePatterns(astData) {
    // Find common setup code
    // Identify assertion patterns
    // Extract entity creation logic
    // Return reusable code blocks
  }
}
```

## Implementation Specifications

### Template Syntax

**Variable Substitution**: `{{variableName}}`
**Conditional Blocks**: `{{#if condition}}...{{/if}}`
**Loops**: `{{#each items}}...{{/each}}`
**Nested Variables**: `{{object.property}}`

### Category Detection Logic

**Exercise**: Schema validation patterns, no entity setup
**Violence**: Entity relationships, basic runtime integration
**Positioning**: Component addition, complex positioning logic
**Sex**: Anatomy components, explicit content validation
**Intimacy**: Standard runtime patterns, relationship validation

## Acceptance Criteria

### Template Quality
- [ ] All templates generate syntactically correct JavaScript
- [ ] Templates handle all identified pattern variations
- [ ] Category-specific templates match observed patterns in existing tests
- [ ] Generated tests pass when provided with valid input data

### Template Engine Functionality
- [ ] Template engine processes all template syntax correctly
- [ ] Variable substitution handles nested objects and arrays
- [ ] Conditional blocks and loops work correctly
- [ ] Error handling for invalid templates and data

### Integration Requirements
- [ ] Templates integrate seamlessly with migration scripts (EXEPHAMIG-001)
- [ ] Pattern matching correctly identifies appropriate templates
- [ ] Generated files follow project coding conventions
- [ ] Templates support all 5 mod categories

### Testing Requirements
- [ ] Unit tests for template engine functionality
- [ ] Integration tests with real migration scenarios
- [ ] Validation against generated test files
- [ ] Template syntax validation

## Dependencies

**Prerequisites**:
- EXEPHAMIG-001: Migration Scripts Infrastructure (must be completed first)

**Enables**:
- EXEPHAMIG-003: Migration Validation Framework
- EXEPHAMIG-004: Validate and Test Migration Tooling
- All migration phase tickets (005-019)

## Risk Mitigation

### Template Complexity Risk
- **Risk**: Templates become too complex to maintain
- **Mitigation**: Keep templates modular, use composition over complexity
- **Contingency**: Break complex templates into smaller, reusable components

### Pattern Recognition Risk
- **Risk**: Pattern matching fails for edge cases
- **Mitigation**: Extensive testing with real files from each category
- **Contingency**: Manual template selection fallback for complex cases

### Template Accuracy Risk
- **Risk**: Generated tests don't match expected behavior
- **Mitigation**: Validate generated tests against known good examples
- **Contingency**: Manual review and adjustment capability

## Success Metrics

### Quantitative Metrics
- **Template Coverage**: Templates exist for all 5 categories and both file types (10 total)
- **Generation Success**: 95% of template processing succeeds without errors
- **Pattern Recognition**: 90% accuracy in automatic template selection

### Qualitative Metrics
- **Code Quality**: Generated code follows project conventions and standards
- **Maintainability**: Templates are easy to understand and modify
- **Extensibility**: Template system can be extended for future categories

## Timeline

**Estimated Duration**: 4-5 days

**Milestones**:
- Day 1: Basic template engine and action test template
- Day 2: Rule test template and category-specific templates
- Day 3: Pattern recognition and template selection logic
- Day 4: Integration testing and refinement
- Day 5: Documentation and validation

## Next Steps

Upon completion, this ticket enables:
1. EXEPHAMIG-003: Migration Validation Framework
2. EXEPHAMIG-004: Testing and validation of complete migration tooling
3. All migration phase executions with consistent, reliable template generation

**Critical Success Factor**: Template quality directly impacts the success of all migration phases. Templates must generate correct, maintainable test files that preserve existing test behavior.