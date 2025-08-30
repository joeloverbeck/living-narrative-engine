# MODTESTREF-008: Create Documentation & Patterns

## Overview

Create comprehensive documentation, best practices guides, and development patterns for the mod test infrastructure. This includes migration guides, API documentation, usage examples, troubleshooting guides, and templates for future mod development.

## Problem Statement

### Documentation Requirements

After implementing and migrating to the new mod test infrastructure, developers need:

- **API Documentation**: Complete reference for all infrastructure components
- **Migration Guides**: Step-by-step instructions for future migrations
- **Best Practices**: Established patterns for mod test development
- **Troubleshooting**: Diagnostic guides for common issues
- **Templates**: Standardized templates for new mod tests
- **Community Guides**: Documentation for community mod developers

### Knowledge Transfer Needs

The infrastructure represents significant architectural knowledge that must be:

- **Preserved**: Documentation that survives team changes
- **Accessible**: Clear guidance for developers of all skill levels
- **Maintainable**: Living documentation that stays current
- **Comprehensive**: Complete coverage of all use cases and patterns

### Future Development Support

Documentation must support:

- **New Team Members**: Fast onboarding with clear examples
- **Community Developers**: External mod development
- **Infrastructure Evolution**: Guidelines for extending the system
- **Troubleshooting**: Self-service problem resolution

## Technical Requirements

### Documentation Structure

**Directory Structure**:

```
docs/
├── mod-testing/
│   ├── README.md                           # Overview and quick start
│   ├── architecture/
│   │   ├── infrastructure-overview.md      # High-level architecture
│   │   ├── component-interactions.md       # How components work together
│   │   └── design-decisions.md             # ADRs and rationale
│   ├── api-reference/
│   │   ├── ModTestHandlerFactory.md        # Handler factory API
│   │   ├── ModEntityBuilder.md             # Entity builder API
│   │   ├── ModAssertionHelpers.md          # Assertion helpers API
│   │   ├── ModActionTestBase.md            # Action test base API
│   │   ├── ModRuleTestBase.md              # Rule test base API
│   │   └── ModTestFixture.md               # Test fixture API
│   ├── guides/
│   │   ├── quick-start.md                  # Getting started guide
│   │   ├── migration-guide.md              # How to migrate existing tests
│   │   ├── creating-new-tests.md           # How to create new mod tests
│   │   ├── category-specific-testing.md    # Category-specific patterns
│   │   └── advanced-usage.md               # Advanced patterns and customization
│   ├── best-practices/
│   │   ├── testing-patterns.md             # Established testing patterns
│   │   ├── performance-guidelines.md       # Performance best practices
│   │   ├── error-handling.md               # Error handling patterns
│   │   └── maintenance.md                  # Maintenance and evolution
│   ├── troubleshooting/
│   │   ├── common-issues.md                # FAQ and common problems
│   │   ├── debugging-guide.md              # How to debug test issues
│   │   ├── performance-troubleshooting.md  # Performance issue resolution
│   │   └── migration-issues.md             # Migration-specific problems
│   ├── examples/
│   │   ├── simple-action-test.md           # Basic example
│   │   ├── complex-positioning-test.md     # Complex example
│   │   ├── multi-entity-scenario.md        # Advanced scenario
│   │   └── error-scenario-testing.md       # Error handling examples
│   └── templates/
│       ├── action-test-template.js         # Template for action tests
│       ├── rule-test-template.js           # Template for rule tests
│       ├── category-test-template.js       # Category-specific template
│       └── custom-test-template.js         # Advanced customization template
```

### Core Documentation Files

## README.md - Overview and Quick Start

````markdown
# Mod Test Infrastructure

## Overview

The Mod Test Infrastructure provides a unified, scalable framework for testing mod integration in the Living Narrative Engine. It eliminates code duplication, standardizes testing patterns, and provides a simple API for creating robust mod tests.

## Quick Start

### Creating a Simple Action Test

```javascript
import { ModTestFixture } from '../common/mods/ModTestFixture.js';

describe('my_mod:my_action integration', () => {
  let test;

  beforeEach(() => {
    test = ModTestFixture.forAction('my_mod', 'my_action');
    test.beforeEach();
  });

  it('should execute action successfully', async () => {
    const { actor, target } = test.createCloseActors(['Alice', 'Bob']);
    test.resetWithEntities([actor, target]);

    await test.executeAction(actor.id, target.id);
    test.assertActionSuccess('Alice performs action on Bob');
  });
});
```
````

### Key Benefits

- **70-80% Less Code**: Eliminates duplicated setup patterns
- **Consistent Testing**: Standardized patterns across all mod categories
- **Easy Maintenance**: Single location for infrastructure updates
- **Better Reliability**: Robust error handling and validation
- **Developer Friendly**: Simple API with helpful error messages

## Components

- **[ModTestFixture](api-reference/ModTestFixture.md)**: Main entry point for creating tests
- **[ModActionTestBase](api-reference/ModActionTestBase.md)**: Base class for action tests
- **[ModEntityBuilder](api-reference/ModEntityBuilder.md)**: Fluent API for entity creation
- **[ModAssertionHelpers](api-reference/ModAssertionHelpers.md)**: Specialized assertion utilities

## Getting Started

1. Read the [Quick Start Guide](guides/quick-start.md)
2. Check out [Examples](examples/) for your use case
3. Follow [Best Practices](best-practices/) for optimal results
4. Consult [Troubleshooting](troubleshooting/) if you encounter issues

## Migration

Existing tests can be migrated using the [Migration Guide](guides/migration-guide.md). The process typically reduces test code by 70-80% while maintaining identical behavior.

````

## API Reference Documentation

### ModTestFixture.md - Primary API Reference

```markdown
# ModTestFixture API Reference

## Overview

`ModTestFixture` is the primary factory for creating mod test instances. It provides auto-detection, file loading, and configuration management for all test scenarios.

## Static Methods

### forAction(modId, actionId, options)

Creates a test fixture for a mod action with auto-detection and configuration.

**Parameters:**
- `modId` (string): The mod identifier (e.g., 'intimacy', 'positioning')
- `actionId` (string): The action identifier (e.g., 'kiss_cheek', 'kneel_before')
- `options` (object, optional): Configuration overrides

**Returns:** Configured test instance (ModActionTestBase or category-specific subclass)

**Example:**
```javascript
const test = ModTestFixture.forAction('intimacy', 'kiss_cheek');
test.beforeEach();

const { actor, target } = test.createCloseActors(['Alice', 'Bob']);
test.resetWithEntities([actor, target]);

await test.executeAction(actor.id, target.id);
test.assertActionSuccess('Alice leans in to kiss Bob\'s cheek softly.');
````

**Auto-Detection Features:**

- **Category Detection**: Automatically detects category based on mod ID and action patterns
- **File Loading**: Loads rule and condition files using convention-based paths
- **Handler Configuration**: Selects appropriate handlers based on category
- **Default Configuration**: Applies category-specific defaults

### forRule(modId, ruleId, options)

Creates a test fixture for rule testing scenarios.

**Parameters:**

- `modId` (string): The mod identifier
- `ruleId` (string): The rule identifier
- `options` (object, optional): Configuration overrides

**Returns:** ModRuleTestBase instance configured for rule testing

### Category-Specific Methods

#### forPositioningAction(actionId, options)

Shorthand for positioning category actions.

#### forIntimacyAction(actionId, options)

Shorthand for intimacy category actions.

#### forSexAction(actionId, options)

Shorthand for sex category actions.

#### forViolenceAction(actionId, options)

Shorthand for violence category actions.

#### forExerciseAction(actionId, options)

Shorthand for exercise category actions.

## Configuration Options

### Basic Options

```javascript
{
  category: 'positioning',           // Override auto-detection
  ruleFile: customRuleObject,       // Provide custom rule file
  conditionFile: customCondition,   // Provide custom condition file
  handlerType: 'positioning',       // Override handler type
  testCategory: 'positioning'       // Set test category
}
```

### Advanced Options

```javascript
{
  customMacros: {                    // Additional macros beyond core
    'mod:custom_macro': macroObject
  },
  customHandlers: {                  // Additional operation handlers
    'CUSTOM_OPERATION': handlerInstance
  },
  defaultLocation: 'custom_room',    // Override default location
  requiresCloseness: false,          // Override closeness requirement
  requiresAnatomy: true              // Override anatomy requirement
}
```

## Error Handling

### File Loading Errors

When mod files cannot be loaded, `ModTestFixture` provides detailed error messages:

```javascript
// Error: Could not load rule file for intimacy:kiss_cheek. Tried:
// - data/mods/intimacy/rules/kissCheekRule.rule.json
// - data/mods/intimacy/actions/kiss_cheek.rule.json
// - data/mods/intimacy/rules/kiss_cheek.rule.json
```

### Configuration Errors

Configuration validation provides clear guidance:

```javascript
// Error: ModTestFixture.forAction: Mod ID is required and cannot be blank
// Error: ModTestFixture.forAction: Action ID is required and cannot be blank
```

## Auto-Detection Logic

### Category Detection

1. Check explicit mod name (positioning, intimacy, sex, violence, exercise)
2. Check action pattern matching (kneel → positioning, kiss → intimacy)
3. Analyze mod file locations for category hints
4. Default to 'standard' category

### File Path Conventions

```javascript
// Primary paths tried for rule files:
data/mods/{modId}/rules/{actionId}Rule.rule.json
data/mods/{modId}/actions/{actionId}.rule.json
data/mods/{modId}/rules/{actionId}.rule.json

// Primary paths tried for condition files:
data/mods/{modId}/conditions/eventIsAction{ActionId}.condition.json
data/mods/{modId}/conditions/{actionId}.condition.json
data/mods/{modId}/conditions/eventIsAction{actionId}.condition.json
```

## Best Practices

1. **Use Auto-Detection**: Let the fixture detect category and load files automatically
2. **Override Only When Needed**: Only provide explicit configuration when auto-detection fails
3. **Follow Naming Conventions**: Use standard file naming for automatic loading
4. **Category-Specific Methods**: Use `forPositioningAction()` etc. for clarity
5. **Test File Organization**: Keep test files organized by category for maintainability

````

## Guide Documentation

### migration-guide.md - Comprehensive Migration Instructions

```markdown
# Migration Guide

## Overview

This guide walks through migrating existing mod integration tests to use the new infrastructure. The process typically reduces code by 70-80% while maintaining identical test behavior.

## Before You Start

1. **Backup**: Ensure your tests are backed up or committed to version control
2. **Baseline**: Run existing tests to establish baseline behavior
3. **Choose Phase**: Pick appropriate migration phase based on complexity

## Migration Process

### Step 1: Identify Test Pattern

Look at your existing test to identify the pattern:

**Action Test Pattern**:
- Tests single mod actions (kiss_cheek, kneel_before, etc.)
- Uses `ATTEMPT_ACTION_ID` event dispatch
- Validates success, perceptible, and turn ended events

**Rule Test Pattern**:
- Tests rule execution logic
- May test rules directly or via action execution
- Validates rule-specific behavior

### Step 2: Choose Migration Approach

**Simple Migration** (recommended for most tests):
Use `ModTestFixture.forAction()` for automatic setup.

**Custom Migration** (for complex tests):
Use base classes directly with custom configuration.

### Step 3: Convert Test Structure

**Before** (manual setup):
```javascript
import { createRuleTestEnvironment } from '../../common/engine/systemLogicTestEnv.js';
// ... many imports

function createHandlers(entityManager, eventBus, logger) {
  // 30+ lines of handler creation
}

describe('mod:action integration', () => {
  let testEnv;

  beforeEach(() => {
    // 20+ lines of setup
  });

  it('should execute action', async () => {
    testEnv.reset([/* manual entity setup */]);
    await testEnv.eventBus.dispatch(/* manual dispatch */);
    /* manual assertions */
  });
});
````

**After** (fixture-based):

```javascript
import { ModTestFixture } from '../common/mods/ModTestFixture.js';

describe('mod:action integration', () => {
  let test;

  beforeEach(() => {
    test = ModTestFixture.forAction('mod', 'action');
    test.beforeEach();
  });

  it('should execute action', async () => {
    const { actor, target } = test.createCloseActors(['Alice', 'Bob']);
    test.resetWithEntities([actor, target]);

    await test.executeAction(actor.id, target.id);
    test.assertActionSuccess('expected message');
  });
});
```

### Step 4: Validate Migration

1. **Run Migrated Test**: Ensure it passes
2. **Compare Behavior**: Use migration validation tools to compare behavior
3. **Check Performance**: Verify no significant performance regression
4. **Review Code**: Ensure migration follows best practices

## Category-Specific Migration Patterns

### Intimacy Tests

```javascript
// Use intimacy-specific fixture
test = ModTestFixture.forIntimacyAction('kiss_cheek');

// Create intimate partners
const { actor, target } = test.createIntimatePartners(['Alice', 'Bob']);

// Assert intimate action
test.assertIntimateAction('Alice', 'Bob', 'leans in to kiss');
```

### Positioning Tests

```javascript
// Use positioning-specific fixture
test = ModTestFixture.forPositioningAction('kneel_before');

// Assert position change
test.assertPositionChanged(actor.id, 'kneeling_before');

// Or use positioning-specific assertion
test.assertKneelingPosition(actor.id, target.id);
```

### Sex/Violence Tests

```javascript
// May need anatomy components
const actor = test.createActorWithAnatomy('Alice');

// Or create with custom anatomy
const actor = new test.ModEntityBuilder('actor1')
  .withName('Alice')
  .atLocation('room1')
  .withCustomAnatomy({ body: { root: 'torso1' } })
  .build();
```

## Common Migration Issues

### Issue: Files Not Found

**Problem**: `Could not load rule file for mod:action`

**Solution**: Check file paths and naming conventions:

- Rule file: `data/mods/{mod}/rules/{action}Rule.rule.json`
- Condition file: `data/mods/{mod}/conditions/eventIsAction{Action}.condition.json`

### Issue: Handler Type Mismatch

**Problem**: Test fails because wrong handlers are created

**Solution**: Specify handler type explicitly:

```javascript
test = ModTestFixture.forAction('mod', 'action', {
  handlerType: 'positioning', // or 'intimacy', 'standard'
});
```

### Issue: Entity Setup Differences

**Problem**: Migrated entities don't match original setup

**Solution**: Use custom entity creation:

```javascript
const actor = new test.ModEntityBuilder('actor1')
  .withName('Alice')
  .atLocation('room1')
  .withComponent('custom:component', { data: 'value' })
  .build();
```

## Rollback Procedure

If migration causes issues:

1. **Restore Original**: Copy backup file back
2. **Identify Issue**: Determine what caused the problem
3. **Report Bug**: If infrastructure issue, report for fixing
4. **Plan Retry**: Address issue and retry migration

## Validation Tools

### Migration Validator

```bash
node scripts/validateMigration.js original.test.js migrated.test.js
```

### Performance Comparison

```bash
node scripts/comparePerformance.js category-name
```

### Behavior Diff Tool

```bash
node scripts/compareBehavior.js original-results.json migrated-results.json
```

````

### creating-new-tests.md - New Test Development Guide

```markdown
# Creating New Mod Tests

## Overview

This guide covers creating new mod integration tests using the infrastructure. New tests are significantly easier to create than with the old manual approach.

## Quick Start

### 1. Choose Your Approach

**For Standard Patterns** (recommended):
Use `ModTestFixture.forAction()` for automatic setup and configuration.

**For Custom Requirements**:
Use base classes directly for maximum control.

### 2. Create Test File

Create your test file in the appropriate category directory:
````

tests/integration/mods/{category}/{action_name}.test.js

````

### 3. Basic Test Structure

```javascript
import { ModTestFixture } from '../common/mods/ModTestFixture.js';

describe('my_mod:my_action integration', () => {
  let test;

  beforeEach(() => {
    test = ModTestFixture.forAction('my_mod', 'my_action');
    test.beforeEach();
  });

  it('should execute action successfully', async () => {
    const { actor, target } = test.createCloseActors(['Alice', 'Bob']);
    test.resetWithEntities([actor, target]);

    await test.executeAction(actor.id, target.id);
    test.assertActionSuccess('Expected success message');
  });

  it('should handle error scenarios', async () => {
    // Test failure cases
    const actor = test.createActor('Alice');
    const target = test.createTarget('Bob', 'different_room');
    test.resetWithEntities([actor, target]);

    await test.executeAction(actor.id, target.id);
    test.assertActionFailure('Distance too great');
  });
});
````

## Entity Creation Patterns

### Simple Entities

```javascript
// Single actor
const actor = test.createActor('Alice');

// Actor-target pair
const { actor, target } = test.createStandardActorTarget(['Alice', 'Bob']);

// Close actors (with positioning:closeness)
const { actor, target } = test.createCloseActors(['Alice', 'Bob']);
```

### Custom Entities

```javascript
// Using the fluent builder
const actor = new test.ModEntityBuilder('actor1')
  .withName('Alice')
  .atLocation('room1')
  .closeToEntity('target1')
  .withComponent('custom:component', { value: 42 })
  .build();

// With anatomy (for sex/violence tests)
const actor = test.createActorWithAnatomy('Alice');

// Custom anatomy
const actor = new test.ModEntityBuilder('actor1')
  .withName('Alice')
  .withCustomAnatomy({ body: { root: 'torso1' } })
  .build();
```

### Multi-Entity Scenarios

```javascript
// Three actors (actor, target, observer)
const actors = [
  test.createActor('Alice'),
  test.createTarget('Bob'),
  test.createObserver('Charlie'),
];

// All in same location with relationships
actors.forEach((actor) => {
  actor.components[POSITION_COMPONENT_ID] = { locationId: 'room1' };
});

test.resetWithEntities(actors);
```

## Action Execution Patterns

### Basic Execution

```javascript
// Simple action
await test.executeAction(actor.id, target.id);

// Action without target
await test.executeAction(actor.id);

// Custom input
await test.executeActionWithInput(actor.id, 'custom command text');
```

### Advanced Execution

```javascript
// With options
await test.executeAction(actor.id, target.id, {
  actionId: 'custom_action',
  originalInput: 'custom input format',
  customParameter: 'value',
});
```

## Assertion Patterns

### Standard Assertions

```javascript
// Success workflow
test.assertActionSuccess('Expected success message');

// Failure scenario
test.assertActionFailure('Expected error message');

// Component changes
test.assertComponentAdded(actor.id, 'positioning:kneeling_before');
test.assertComponentModified(actor.id, 'component:id', { expected: 'data' });
```

### Advanced Assertions

```javascript
// Complete workflow validation
test.assertCompleteActionWorkflow(test.getEvents(), {
  successMessage: 'Action succeeded',
  componentChanges: [
    {
      entityManager: test.getEntityManager(),
      entityId: actor.id,
      componentId: 'positioning:kneeling_before',
    },
  ],
});

// Event sequence validation
test.assertEventSequence(test.getEvents(), [
  'core:display_successful_action_result',
  'core:perceptible_event',
  'core:turn_ended',
]);
```

## Category-Specific Patterns

### Positioning Tests

```javascript
beforeEach(() => {
  test = ModTestFixture.forPositioningAction('kneel_before');
  test.beforeEach();
});

it('should add positioning component', async () => {
  const { actor, target } = test.createCloseActors(['Alice', 'Bob']);
  test.resetWithEntities([actor, target]);

  await test.executeAction(actor.id, target.id);

  test.assertActionSuccess();
  test.assertKneelingPosition(actor.id, target.id); // Positioning-specific
});
```

### Intimacy Tests

```javascript
beforeEach(() => {
  test = ModTestFixture.forIntimacyAction('kiss_cheek');
  test.beforeEach();
});

it('should execute intimate action', async () => {
  const { actor, target } = test.createIntimatePartners(['Alice', 'Bob']);
  test.resetWithEntities([actor, target]);

  await test.executeAction(actor.id, target.id);
  test.assertIntimateAction('Alice', 'Bob', 'leans in to kiss'); // Intimacy-specific
});
```

## Error Testing Patterns

### Missing Prerequisites

```javascript
it('should fail when actors not close enough', async () => {
  // Create actors in different locations
  const actor = test.createActor('Alice', 'room1');
  const target = test.createTarget('Bob', 'room2');
  test.resetWithEntities([actor, target]);

  await test.executeAction(actor.id, target.id);
  test.assertActionFailure('Actors must be close');
});
```

### Missing Components

```javascript
it('should fail when anatomy missing', async () => {
  // Create actors without anatomy for anatomy-requiring action
  const { actor, target } = test.createCloseActors(['Alice', 'Bob']);
  test.resetWithEntities([actor, target]);

  await test.executeAction(actor.id, target.id);
  test.assertActionFailure('Missing required anatomy');
});
```

## Performance Considerations

### Efficient Entity Creation

```javascript
// Good: Reuse entity patterns
const { actor, target } = test.createCloseActors(['Alice', 'Bob']);

// Avoid: Manual entity creation for standard patterns
const actor = new test.ModEntityBuilder('actor1')
  .withName('Alice')
  .atLocation('room1')
  .closeToEntity('target1')
  .build();
// ... when createCloseActors() would work
```

### Test Organization

```javascript
// Good: Group related tests
describe('intimacy:kiss_cheek integration', () => {
  describe('success scenarios', () => {
    // Success tests
  });

  describe('error scenarios', () => {
    // Error tests
  });
});

// Avoid: Single large test file with unrelated tests
```

## Best Practices

1. **Use Auto-Detection**: Let fixtures detect category and configuration
2. **Follow Naming Conventions**: Use standard file and test naming
3. **Test Both Success and Failure**: Always include error scenario testing
4. **Use Category-Specific Methods**: Take advantage of specialized helpers
5. **Keep Tests Focused**: One test per scenario or behavior
6. **Use Descriptive Names**: Test names should clearly describe the scenario
7. **Validate Complete Workflow**: Don't just test success, validate the entire event flow

````

## Template Files

### action-test-template.js - Standard Action Test Template

```javascript
/**
 * Template for creating mod action integration tests
 *
 * Usage:
 * 1. Replace {{MOD_ID}} with your mod identifier
 * 2. Replace {{ACTION_ID}} with your action identifier
 * 3. Replace {{CATEGORY}} with appropriate category (positioning, intimacy, etc.)
 * 4. Customize test scenarios as needed
 * 5. Update expected messages and behaviors
 */

import { ModTestFixture } from '../common/mods/ModTestFixture.js';

describe('{{MOD_ID}}:{{ACTION_ID}} action integration', () => {
  let test;

  beforeEach(() => {
    // Auto-detect category and configuration
    test = ModTestFixture.forAction('{{MOD_ID}}', '{{ACTION_ID}}');

    // Or use category-specific method:
    // test = ModTestFixture.for{{CATEGORY}}Action('{{ACTION_ID}}');

    test.beforeEach();
  });

  describe('success scenarios', () => {
    it('should execute {{ACTION_ID}} action successfully', async () => {
      // Create entities appropriate for your action
      const { actor, target } = test.createCloseActors(['Alice', 'Bob']);
      test.resetWithEntities([actor, target]);

      // Execute action
      await test.executeAction(actor.id, target.id);

      // Validate success
      test.assertActionSuccess('{{EXPECTED_SUCCESS_MESSAGE}}');
    });

    // Add more success scenarios as needed
    it('should handle {{SPECIFIC_SUCCESS_CASE}}', async () => {
      // Specific test scenario
    });
  });

  describe('error scenarios', () => {
    it('should fail when {{ERROR_CONDITION}}', async () => {
      // Create scenario that should fail
      const actor = test.createActor('Alice');
      const target = test.createTarget('Bob', 'different_room'); // Example: different location
      test.resetWithEntities([actor, target]);

      // Execute action
      await test.executeAction(actor.id, target.id);

      // Validate failure
      test.assertActionFailure('{{EXPECTED_ERROR_MESSAGE}}');
    });

    // Add more error scenarios as needed
  });

  describe('component changes', () => {
    it('should add/modify components as expected', async () => {
      const { actor, target } = test.createCloseActors(['Alice', 'Bob']);
      test.resetWithEntities([actor, target]);

      await test.executeAction(actor.id, target.id);

      test.assertActionSuccess();

      // Validate component changes (if applicable)
      // test.assertComponentAdded(actor.id, '{{EXPECTED_COMPONENT_ID}}');
      // test.assertPositionChanged(actor.id, '{{EXPECTED_POSITION}}'); // For positioning
    });
  });
});
````

## Troubleshooting Documentation

### common-issues.md - FAQ and Problem Resolution

````markdown
# Common Issues and Solutions

## File Loading Issues

### Issue: "Could not load rule file"

**Symptoms**: `ModTestFixture.forAction()` throws file loading error

**Common Causes**:

1. Rule file not in expected location
2. Incorrect file naming convention
3. Malformed JSON in rule file

**Solutions**:

```javascript
// Check file paths - expected locations:
data/mods/{modId}/rules/{actionId}Rule.rule.json
data/mods/{modId}/actions/{actionId}.rule.json

// Provide explicit file path:
test = ModTestFixture.forAction('my_mod', 'my_action', {
  ruleFile: require('../../data/mods/my_mod/custom/path.rule.json')
});

// Validate JSON syntax with:
node -e "console.log(JSON.parse(require('fs').readFileSync('path/to/file.json', 'utf8')))"
```
````

### Issue: "Could not load condition file"

**Solutions**: Similar to rule file - check paths and provide explicit file if needed

## Category Detection Issues

### Issue: Wrong category detected

**Symptoms**: Test uses wrong handlers or configuration

**Solutions**:

```javascript
// Specify category explicitly:
test = ModTestFixture.forAction('my_mod', 'my_action', {
  category: 'positioning',
});

// Or use category-specific method:
test = ModTestFixture.forPositioningAction('my_action');
```

## Entity Creation Issues

### Issue: "Entity name is required"

**Cause**: Empty or undefined name passed to entity builder

**Solution**:

```javascript
// Ensure names are provided:
const { actor, target } = test.createCloseActors(['Alice', 'Bob']); // Not ['', '']
```

### Issue: Entities missing required components

**Symptoms**: Test fails because entities don't have expected components

**Solutions**:

```javascript
// For positioning actions, ensure closeness:
const { actor, target } = test.createCloseActors(['Alice', 'Bob']);

// For anatomy-requiring actions:
const actor = test.createActorWithAnatomy('Alice');

// Custom components:
const actor = new test.ModEntityBuilder('actor1')
  .withName('Alice')
  .withComponent('required:component', { data: 'value' })
  .build();
```

## Action Execution Issues

### Issue: "Actor ID is required"

**Cause**: Empty or undefined actor ID passed to `executeAction()`

**Solution**:

```javascript
// Ensure entity has ID:
const actor = test.createActor('Alice');
console.log(actor.id); // Should be defined
await test.executeAction(actor.id, target.id);
```

### Issue: Action not found or not executing

**Cause**: Action ID mismatch or rule not properly loaded

**Solutions**:

```javascript
// Check action ID format:
await test.executeAction(actor.id, target.id, {
  actionId: 'correct_mod:correct_action', // Ensure proper format
});

// Verify rule file contains correct action definition
```

## Assertion Issues

### Issue: "Success event not found"

**Cause**: Action execution didn't produce expected success event

**Debugging**:

```javascript
// Check all events produced:
const events = test.getEvents();
console.log(
  'All events:',
  events.map((e) => e.eventType)
);

// Look for error events:
const errorEvent = events.find(
  (e) => e.eventType === 'core:system_error_occurred'
);
if (errorEvent) {
  console.log('Error:', errorEvent.payload);
}
```

### Issue: Assertion helper errors

**Solutions**:

```javascript
// Use more specific assertions:
test.assertActionSuccess(); // Instead of checking manually

// Or debug with manual checks:
const events = test.getEvents();
const successEvent = events.find(
  (e) => e.eventType === 'core:display_successful_action_result'
);
console.log('Success event:', successEvent);
```

## Performance Issues

### Issue: Tests running slowly

**Causes**:

1. Inefficient entity creation
2. Complex test environment setup
3. Large number of events/entities

**Solutions**:

```javascript
// Use efficient entity creation patterns:
const { actor, target } = test.createCloseActors(['Alice', 'Bob']); // Good
// Instead of manual builder when standard pattern works

// Avoid creating unnecessary entities:
const actor = test.createActor('Alice'); // For single-actor tests
// Instead of actor-target pair when target not needed
```

## Infrastructure Issues

### Issue: Handler not found errors

**Cause**: Test requires handler that isn't created by factory

**Solutions**:

```javascript
// Use correct handler type:
test = ModTestFixture.forAction('my_mod', 'my_action', {
  handlerType: 'positioning', // For ADD_COMPONENT handler
});

// Or add custom handler:
test = ModTestFixture.forAction('my_mod', 'my_action', {
  customHandlers: {
    CUSTOM_HANDLER: customHandlerInstance,
  },
});
```

### Issue: Event ordering problems

**Cause**: Infrastructure changes event timing

**Solutions**:

```javascript
// Use event sequence validation:
test.assertEventSequence(test.getEvents(), [
  'expected_first_event',
  'expected_second_event',
]);

// Or check for presence without ordering:
test.assertActionSuccess(); // Checks for success + related events
```

```

## Implementation Steps

### Step 1: Create Documentation Structure
1. Create `docs/mod-testing/` directory structure
2. Set up documentation organization and navigation
3. Create README.md with overview and quick start
4. Establish documentation standards and templates

### Step 2: Write API Reference Documentation
1. Document ModTestFixture API with all methods and options
2. Create API docs for ModActionTestBase and ModRuleTestBase
3. Document ModEntityBuilder fluent API patterns
4. Create ModAssertionHelpers reference with examples
5. Document all configuration options and parameters

### Step 3: Create Usage Guides
1. Write comprehensive migration guide with examples
2. Create new test development guide with patterns
3. Document category-specific testing approaches
4. Create advanced usage guide for complex scenarios
5. Write best practices guide with established patterns

### Step 4: Add Examples and Templates
1. Create example tests for each category
2. Build reusable templates for common scenarios
3. Document complex multi-entity examples
4. Create error handling and edge case examples
5. Build template library for rapid development

### Step 5: Create Troubleshooting Resources
1. Compile common issues and solutions from migration experience
2. Create debugging guides with diagnostic techniques
3. Document performance troubleshooting approaches
4. Build issue resolution decision trees
5. Create community support resources

## Validation & Testing

### Documentation Quality Assurance

**Content Validation**:
- [ ] All code examples tested and verified working
- [ ] API documentation complete and accurate
- [ ] Examples cover all major use cases and patterns
- [ ] Troubleshooting solutions verified effective
- [ ] Migration guides tested with real scenarios

**Usability Testing**:
- [ ] New developers can follow guides successfully
- [ ] Migration process completable following documentation
- [ ] API reference provides sufficient detail for development
- [ ] Examples are clear and demonstrate best practices
- [ ] Troubleshooting guides resolve common issues

**Maintenance Setup**:
- [ ] Documentation integrated with code review process
- [ ] Examples automatically tested with CI/CD
- [ ] Version control tracks documentation changes
- [ ] Update process defined for infrastructure changes
- [ ] Community contribution process established

## Success Criteria

### Developer Onboarding
- **Target**: New developers can create mod tests within 30 minutes
- **Measurement**: Onboarding time tracking and developer feedback
- **Success**: >90% of new developers successfully create tests using documentation

### Migration Success
- **Target**: Existing test migration completable using guides
- **Measurement**: Migration success rate and time to completion
- **Success**: >95% of migrations successful following documentation

### Self-Service Support
- **Target**: Common issues resolvable using troubleshooting guides
- **Measurement**: Support request volume and resolution rate
- **Success**: 80% of issues resolved without direct support

### Community Adoption
- **Target**: Community mod developers can use infrastructure
- **Measurement**: Community contribution rate and feedback
- **Success**: Active community usage and positive feedback

## Long-Term Maintenance

### Living Documentation
- Documentation updated with every infrastructure change
- Examples automatically tested with CI/CD pipeline
- Community feedback integrated into improvements
- Regular reviews for completeness and accuracy

### Knowledge Transfer
- Documentation serves as primary knowledge transfer mechanism
- Architectural decisions recorded and explained
- Evolution path documented for future development
- Community contribution guidelines established

### Scaling Support
- Documentation supports growth to thousands of mod tests
- Patterns established for new mod categories
- Infrastructure extension guidelines provided
- Community mod development enabled

## Next Steps

Upon completion, this documentation will:
1. **Enable Community Development**: Clear guides for external mod developers
2. **Support Long-Term Maintenance**: Comprehensive reference for ongoing development
3. **Facilitate Knowledge Transfer**: Complete architectural and usage documentation
4. **Scale Infrastructure Adoption**: Resources to support project growth to thousands of tests

This comprehensive documentation package will be the foundation for sustainable mod test development and will enable the Living Narrative Engine project to scale effectively while maintaining high quality testing standards.
```
