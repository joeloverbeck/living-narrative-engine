# Test Suite AI Migration Guidelines Specification

## Overview

This specification provides comprehensive guidelines for migrating Living Narrative Engine mod test suites from legacy patterns to the new testing infrastructure using AI assistance rather than automated migration scripts. This approach leverages the intelligence and context-awareness of AI systems to perform thoughtful, high-quality migrations that preserve test behavior while maximizing code reduction and maintainability.

**Note:** This specification has been validated and corrected against the actual codebase. Several assumptions about API methods and patterns have been updated to reflect the real implementation.

## Rationale for AI-Assisted Migration

### Why Not Automated Scripts?

While automated migration tooling could theoretically be created including:
- AST parsing scripts for code analysis
- Template generation systems
- Automated validation frameworks
- Batch migration utilities

This approach has significant drawbacks when AI assistance is available:

1. **Unnecessary Complexity**: AI can understand code patterns without AST parsing
2. **Rigid Templates**: AI can adapt to unique patterns better than templates
3. **Maintenance Burden**: Migration scripts themselves require testing and maintenance
4. **Limited Intelligence**: Scripts cannot make context-aware decisions like AI can
5. **One-Time Use**: Migration scripts become obsolete after migration completes

### Benefits of AI-Assisted Migration

1. **Context Awareness**: AI understands the broader codebase and can make intelligent decisions
2. **Pattern Recognition**: AI can identify and preserve important patterns without explicit programming
3. **Adaptive Approach**: Each test file can be migrated optimally based on its specific needs
4. **Quality Focus**: AI can ensure code quality and consistency throughout migration
5. **Documentation**: AI can explain decisions and document changes as part of the process

## Migration Principles

### Core Objectives

1. **Behavior Preservation**: Migrated tests must maintain identical test coverage and validation
2. **Code Reduction**: Target 80-90% reduction in duplicated code
3. **Infrastructure Utilization**: Maximize use of existing test helpers and base classes
4. **Maintainability**: Improve test readability and maintainability
5. **Performance**: Maintain or improve test execution performance

### Guiding Principles

- **Understand Before Migrating**: Analyze existing test structure and intent before changes
- **Preserve Test Intent**: Maintain the original test's validation goals
- **Follow Existing Patterns**: Use established patterns from already-migrated tests
- **Incremental Validation**: Verify each migrated test executes correctly before proceeding
- **Document Decisions**: Comment on non-obvious migration choices

## Test Infrastructure Components

### Available Infrastructure

The following infrastructure components should be utilized during migration:

**Note:** Current tests use complex handler creation patterns with direct imports. Migration should simplify these while preserving behavior.

#### Core Test Helpers
- **ModTestHandlerFactory**: Factory for creating test handlers with consistent setup
- **ModTestFixture**: Comprehensive test fixture with auto-loading capabilities
- **ModEntityBuilder**: Fluent API for creating test entities with components
- **ModAssertionHelpers**: Standardized assertions for common test scenarios

#### Base Classes
- **ModActionTestBase**: Base class for action tests with standard test suite generation
- **ModRuleTestBase**: Base class for rule tests (if created)

#### Test Utilities
- **createRuleTestEnvironment()**: Creates isolated test environment for rule testing
- **validateDependency()**: Ensures proper dependency injection (from `src/utils/dependencyUtils.js`)
- **Event capture and validation helpers**
- **expandMacros()**: Expands macro definitions in rules (from `src/utils/macroUtils.js`)

## Category-Specific Migration Guidelines

### Exercise Category (2 files)
**Pattern**: Schema validation tests

**Current Structure** (as seen in `show_off_biceps_action.test.js`):
- Direct JSON imports of action files (`import showOffBicepsAction from '...'`)
- Manual property assertions using Jest expect statements
- Visual styling validation (color accessibility checks)
- Prerequisites checking with detailed JSON Logic validation
- Test organization into describe blocks by feature area

**Migration Approach**:
```javascript
// Before: Direct JSON import and manual assertions
import showOffBicepsAction from '../../../../data/mods/exercise/actions/show_off_biceps.action.json';

it('should have correct action properties', () => {
  expect(showOffBicepsAction.id).toBe('exercise:show_off_biceps');
  expect(showOffBicepsAction.name).toBe('Show Off Biceps');
  expect(showOffBicepsAction.targets).toBe('none');
  expect(showOffBicepsAction.template).toBe('show off your muscular arms');
  // ... more manual assertions
});

// After: Using ModTestFixture and standardized patterns
import { ModTestFixture } from '../../common/mods/ModTestFixture.js';

beforeEach(() => {
  testFixture = ModTestFixture.forAction('exercise', 'exercise:show_off_biceps', ruleFile, conditionFile);
});

it('should have correct action properties', () => {
  // Direct property assertions remain similar but with better setup
  const actionData = testFixture.getActionData();
  expect(actionData.id).toBe('exercise:show_off_biceps');
  expect(actionData.name).toBe('Show Off Biceps');
  expect(actionData.targets).toBe('none');
  expect(actionData.template).toBe('show off your muscular arms');
});
```

### Violence Category (4 files)
**Pattern**: Runtime integration with entity relationships

**Current Structure**:
- Entity creation and positioning
- Action execution
- Event validation
- Relationship verification

**Migration Approach**:
- Extend ModActionTestBase
- Use ModEntityBuilder for entity setup (note: uses constructor directly, not createActor())
- Leverage assertActionSuccess() for validation
- Use ModEntityBuilder's atLocation() and closeToEntity() for positioning

### Positioning Category (13 files)
**Pattern**: Component addition and positioning state changes

**Current Structure**:
- Complex entity positioning setup
- Component addition verification
- State transition validation
- Multi-entity interactions

**Migration Approach**:
- Use ModTestFixture for comprehensive setup
- Implement custom positioning helpers
- Verify component changes with assertComponentAdded()
- Validate state transitions systematically

### Sex Category (10 files)
**Pattern**: Anatomy requirements and explicit content validation

**Current Structure**:
- Anatomy component setup
- Clothing state management
- Action prerequisites based on anatomy
- Complex multi-component validation

**Migration Approach**:
- Create setupAnatomyComponents() helper method
- Use ModEntityBuilder's withComponent() for anatomy setup
- Use ModEntityBuilder's withClothing() for clothing components
- Validate with standard assertions and custom anatomy checks

### Intimacy Category (27 files)
**Pattern**: Standard runtime integration with relationship validation

**Current Structure** (as seen in `kiss_cheek_action.test.js`):
- Complex handler creation with manual dependency injection
- Rule and condition file imports with macro expansion
- createRuleTestEnvironment() usage for setup
- Extensive manual handler mocking (QueryComponentHandler, DispatchEventHandler, etc.)
- Entity creation and positioning through test helpers
- Event validation through captured event arrays

**Migration Approach**:
- Extend ModActionTestBase to replace manual handler setup
- Use ModTestFixture to replace createRuleTestEnvironment() complexity
- Apply assertActionSuccess() for event validation
- Replace manual handler mocking with test fixture abstractions
- Minimize custom code through base class usage

## Migration Process

### Phase 1: Pre-Migration Analysis

1. **Identify Test Pattern**
   - Determine if test is schema validation or runtime integration
   - Identify entity setup requirements
   - Note custom assertions or validations
   - Document any unique test behaviors

2. **Map to Infrastructure**
   - Determine appropriate base class (ModActionTestBase, etc.)
   - Identify needed assertion helpers
   - Plan entity setup approach
   - Consider custom helper requirements

3. **Review Dependencies**
   - Check for required JSON imports
   - Identify rule and condition files
   - Note any external dependencies

### Phase 2: Migration Execution

1. **Create New Test Structure**
   ```javascript
   // Standard structure for action tests
   class [ActionId]ActionTest extends ModActionTestBase {
     constructor() {
       super('[modId]', '[modId]:[actionId]', [actionId]Rule, eventIsAction[ActionId]);
     }
     
     // Add custom setup methods as needed
   }
   ```

2. **Migrate Test Cases**
   - Preserve all existing test cases
   - Convert to use infrastructure helpers
   - Maintain test descriptions and intent
   - Ensure coverage remains complete

3. **Optimize and Reduce**
   - Remove duplicated setup code
   - Leverage base class functionality
   - Consolidate similar assertions
   - Eliminate redundant validations

### Phase 3: Validation

1. **Execute Tests**
   ```bash
   npm run test:integration tests/integration/mods/[category]/[testfile].test.js
   ```

2. **Verify Coverage**
   - Ensure all original test cases are preserved
   - Confirm no validation is lost
   - Check edge cases still covered

3. **Performance Check**
   - Compare execution time before/after
   - Ensure no significant regression (>30%)
   - Optimize if necessary

### Phase 4: Documentation

1. **Document Migration Decisions**
   - Add comments for non-obvious changes
   - Explain custom helper usage
   - Note any behavioral differences

2. **Update Test Descriptions**
   - Ensure test names remain clear
   - Update descriptions if structure changed
   - Maintain consistency across suite

## Quality Assurance Checklist

### Pre-Migration Verification
- [ ] Original test executes successfully
- [ ] Test purpose and coverage understood
- [ ] Infrastructure components identified
- [ ] Migration approach planned

### During Migration
- [ ] Test structure follows conventions
- [ ] Proper base class extended
- [ ] Assertion helpers utilized appropriately
- [ ] Entity setup uses ModEntityBuilder
- [ ] Event validation uses standard helpers

### Post-Migration Validation
- [ ] All tests pass successfully
- [ ] Coverage maintained or improved
- [ ] Performance within acceptable range
- [ ] Code reduction achieved (target: 80-90%)
- [ ] Documentation updated

### Code Quality
- [ ] Follows project naming conventions
- [ ] Proper dependency injection used
- [ ] Error handling appropriate
- [ ] No hardcoded values
- [ ] Comments explain complex logic

## Current Codebase Reality vs. Target Patterns

### Observed Current Patterns

**Exercise Category** - Schema validation tests are simpler, using direct JSON imports:
- File naming: `[action_name]_action.test.js`
- Structure: Direct property assertions with detailed validation
- Focus: Static JSON structure validation, not runtime behavior

**Intimacy Category** - Complex runtime integration tests:
- File naming: `[action_name]_action.test.js` 
- Structure: Extensive handler creation, macro expansion, rule testing
- Focus: Full rule engine integration with mocked handlers

**Key Observations**:
- Tests currently don't use ModActionTestBase pattern widely
- ModEntityBuilder exists but may not have all methods shown in examples
- ModAssertionHelpers exists but with different API than spec assumed
- Complex manual setup is common, indicating migration opportunity

## Common Patterns and Examples

### Pattern 1: Simple Action Test

```javascript
// Legacy Pattern
describe('Mod: Action Test', () => {
  let testEnvironment;
  
  beforeEach(() => {
    testEnvironment = createTestEnvironment();
    // Manual entity setup
    // Manual component addition
  });
  
  it('should execute action', () => {
    // Manual action execution
    // Manual event validation
    // Multiple expect statements
  });
});

// Migrated Pattern
class ActionTest extends ModActionTestBase {
  constructor() {
    super('modId', 'modId:actionId', actionRule, actionCondition);
  }
}

describe('Mod: Action Test', () => {
  const testSuite = new ActionTest();
  testSuite.createTestSuite(); // Generates standard test cases
});
```

### Pattern 2: Complex Entity Setup

```javascript
// Use ModEntityBuilder for complex scenarios
setupCustomEntities() {
  const actor = new ModEntityBuilder('actor1')
    .withName('TestActor')
    .atLocation('test-location')
    .withComponent('anatomy:chest', { /* data */ })
    .withClothing({ /* clothing data */ })
    .build();
    
  const target = new ModEntityBuilder('target1')
    .withName('TestTarget')
    .inSameLocationAs(actor)
    .withComponent('positioning:orientation', { facing: 'away' })
    .build();
    
  return { actor, target };
}
```

### Pattern 3: Event Validation

```javascript
// Use ModAssertionHelpers for consistent validation
it('should generate correct events', async () => {
  const { actor, target } = this.setupEntities();
  
  await this.executeAction(actor.id, target.id);
  
  ModAssertionHelpers.assertActionSuccess(
    this.capturedEvents,
    'Expected success message',
    { shouldEndTurn: true, shouldHavePerceptibleEvent: true }
  );
  
  ModAssertionHelpers.assertComponentAdded(
    this.entityManager,  // Note: requires entityManager instance
    actor.id,
    'componentName',
    expectedData
  );
});
```

## Anti-Patterns to Avoid

### Don't: Manual Event Filtering
```javascript
// Avoid
const successEvent = events.filter(e => e.type === 'success')[0];
expect(successEvent).toBeDefined();
```

### Do: Use Assertion Helpers
```javascript
// Prefer
ModAssertionHelpers.assertActionSuccess(events, expectedMessage);
```

### Don't: Duplicate Entity Setup
```javascript
// Avoid repeating entity setup in each test
it('test 1', () => {
  const actor = createEntity();
  // ... setup
});

it('test 2', () => {
  const actor = createEntity();
  // ... same setup
});
```

### Do: Create Reusable Setup Methods
```javascript
// Prefer
setupTestEntities() {
  return this.entityBuilder.createStandardActors();
}
```

## Success Criteria

### Quantitative Metrics

1. **Code Reduction**
   - Target: 80-90% reduction in test code
   - Measurement: Line count before/after migration
   - Acceptable range: 70-95% reduction

2. **Performance**
   - Target: No regression >30%
   - Measurement: Test execution time
   - Acceptable range: -20% to +30%

3. **Coverage**
   - Target: 100% preservation of test cases
   - Measurement: Number of test cases
   - Requirement: No test cases lost

### Qualitative Metrics

1. **Readability**
   - Tests should be easier to understand
   - Clear test intent and structure
   - Reduced cognitive load

2. **Maintainability**
   - Easier to modify and extend
   - Consistent patterns across suite
   - Clear separation of concerns

3. **Reusability**
   - Maximum use of shared infrastructure
   - Minimal custom code
   - Patterns applicable to new tests

## Migration Priority

Recommended migration order based on complexity and learning curve:

1. **Phase 1: Exercise** (2 files) - Simplest, schema validation
2. **Phase 2: Violence** (4 files) - Basic runtime integration
3. **Phase 3: Intimacy** (27 files) - Standard patterns, high volume
4. **Phase 4: Sex** (10 files) - Complex anatomy requirements
5. **Phase 5: Positioning** (13 files) - Most complex patterns

## Troubleshooting Guide

### Common Issues and Solutions

**Issue**: Test fails after migration
- Verify all setup steps preserved
- Check event capture timing
- Ensure proper async/await usage
- Validate entity relationships

**Issue**: Performance regression
- Profile test execution
- Reduce unnecessary setup
- Optimize entity creation
- Cache reusable data

**Issue**: Missing assertions
- Review original test thoroughly
- Check for implicit validations
- Ensure helper methods cover all cases
- Add custom assertions if needed

## Conclusion

This specification provides comprehensive guidelines for AI-assisted migration of test suites. By following these guidelines, AI assistants can perform intelligent, context-aware migrations that:

1. Preserve test behavior and coverage
2. Maximize code reduction and maintainability
3. Leverage existing infrastructure effectively
4. Maintain or improve performance
5. Follow consistent patterns and conventions

The AI-assisted approach eliminates the need for complex migration scripts while delivering superior results through intelligent decision-making and context awareness.