# Mod Integration Test Utilities

This directory contains the new mod integration test architecture that eliminates code duplication and provides consistent testing patterns across all mod categories.

## Overview

The new architecture reduces test code by 70-80% while improving maintainability and consistency. Instead of copying 40-60 lines of boilerplate setup in every test file, you can now create comprehensive mod tests with just a few lines of code.

## Key Components

### Base Classes

- **`ModActionTestBase`** - Base class for action integration tests
- **`ModRuleTestBase`** - Base class for rule integration tests (extends ModActionTestBase)

### Test Fixtures

- **`ModTestFixture`** - Factory for creating test environments
- **`ModTestHandlerFactory`** - Centralized handler creation
- **`ModEntityBuilder`** - Fluent API for entity creation
- **`ModAssertionHelpers`** - Specialized assertions

## Quick Start

### Basic Action Test

```javascript
import { ModTestFixture } from '../common/mods/index.js';
import ruleFile from '../../../data/mods/kissing/rules/kiss_cheek.rule.json';
import conditionFile from '../../../data/mods/kissing/conditions/event-is-action-kiss-cheek.condition.json';

describe('intimacy:kiss_cheek action integration', () => {
  let testFixture;

  beforeEach(() => {
    testFixture = ModTestFixture.forAction(
      'kissing',
      'intimacy:kiss_cheek',
      ruleFile,
      conditionFile
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('successfully executes kiss cheek action', async () => {
    const { actor, target } = testFixture.createCloseActors(['Alice', 'Bob']);

    await testFixture.executeAction(actor.id, target.id);

    testFixture.assertActionSuccess(
      "Alice leans in to kiss Bob's cheek softly."
    );
  });
});
```

### Using Base Classes

```javascript
import { ModActionTestBase } from '../common/mods/index.js';

class KissCheekActionTest extends ModActionTestBase {
  constructor() {
    super(
      'kissing',
      'intimacy:kiss_cheek',
      kissCheekRule,
      eventIsActionKissCheek
    );
  }

  // Override for custom success message
  getExpectedSuccessMessage(actorName, targetName) {
    return `${actorName} leans in to kiss ${targetName}'s cheek softly.`;
  }
}

// Use the test class
describe('intimacy:kiss_cheek action integration', () => {
  const testSuite = new KissCheekActionTest();
  testSuite.runStandardTests();
});
```

### Entity Creation

```javascript
// Simple actor-target pair
const { actor, target } = testFixture.createStandardActorTarget([
  'Alice',
  'Bob',
]);

// Close actors (for intimacy actions)
const { actor, target } = testFixture.createCloseActors(['Alice', 'Bob']);

// Multi-actor scenario with observers
const scenario = testFixture.createMultiActorScenario([
  'Alice',
  'Bob',
  'Charlie',
]);

// Anatomy scenario (for body-related actions)
const scenario = testFixture.createAnatomyScenario(
  ['Alice', 'Bob'],
  ['torso', 'breast', 'breast']
);

// Custom entities with builder
const actor = new ModEntityBuilder('actor1')
  .withName('Alice')
  .atLocation('room1')
  .closeToEntity('target1')
  .withComponent('custom:component', { value: 'test' })
  .build();
```

### Specialized Assertions

```javascript
// Standard action success
testFixture.assertActionSuccess('Expected success message');

// Perceptible event validation
testFixture.assertPerceptibleEvent({
  descriptionText: 'Expected description',
  locationId: 'room1',
  actorId: 'actor1',
  targetId: 'target1',
});

// Component addition (for positioning actions)
testFixture.assertComponentAdded('actor1', 'deference-states:kneeling_before', {
  entityId: 'target1',
});

// Rule selectivity (action only fires for correct ID)
testFixture.assertOnlyExpectedEvents(['core:attempt_action']);
```

### Sex Mod Scenario Helpers

- **`sex/straddlingPenisMilkingFixtures.js`** – Provides `buildStraddlingMilkingScenario` and
  `installStraddlingMilkingScopeOverrides` for reusable straddling penetration setups that ensure
  anatomy, clothing coverage, and scope resolution mirror in-game expectations.

## Migration Guide

### Converting Existing Tests

1. **Replace Handler Creation**

   ```javascript
   // OLD: 30+ lines
   function createHandlers(entityManager, eventBus, logger) {
     // ... lots of boilerplate
   }

   // NEW: Automatic
   testFixture = ModTestFixture.forAction(...);
   ```

2. **Replace Entity Setup**

   ```javascript
   // OLD: Manual object construction
   testEnv.reset([
     {
       id: 'actor1',
       components: {
         [NAME_COMPONENT_ID]: { text: 'Alice' },
         [POSITION_COMPONENT_ID]: { locationId: 'room1' },
         'positioning:closeness': { partners: ['target1'] },
       },
     },
     // ... more entities
   ]);

   // NEW: Fluent entity creation
   const { actor, target } = testFixture.createCloseActors(['Alice', 'Bob']);
   ```

3. **Replace Action Execution**

   ```javascript
   // OLD: Manual event dispatch
   await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
     eventName: 'core:attempt_action',
     actorId: 'actor1',
     actionId: 'intimacy:kiss_cheek',
     targetId: 'target1',
     originalInput: 'kiss_cheek target1',
   });

   // NEW: Simple execution
   await testFixture.executeAction(actor.id, target.id);
   ```

4. **Replace Assertions**

   ```javascript
   // OLD: Manual event filtering and assertions
   const successEvent = testEnv.events.find(
     (e) => e.eventType === 'core:display_successful_action_result'
   );
   expect(successEvent).toBeDefined();
   expect(successEvent.payload.message).toBe(expectedMessage);
   // ... more manual assertions

   // NEW: Comprehensive assertion
   testFixture.assertActionSuccess(expectedMessage);
   ```

### Migration Checklist

- [ ] Import new mod utilities
- [ ] Replace createHandlers function with ModTestFixture
- [ ] Replace manual entity creation with scenario builders
- [ ] Replace manual event dispatch with executeAction()
- [ ] Replace manual assertions with helper methods
- [ ] Test converted file to ensure identical behavior
- [ ] Remove old imports and unused code

## Category-Specific Patterns

### Intimacy/Sex Actions

- Usually require closeness between actors
- Use `createCloseActors()` for entity setup
- May need anatomy components for certain actions

### Positioning Actions

- May add components during execution (use ADD_COMPONENT handler)
- Often change entity state (kneeling, facing, etc.)
- Use `createPositioningScenario()` for specialized setups

### Violence Actions

- Simple actor-target interactions
- Use standard entity setup
- Focus on damage or status effects

### Exercise Actions

- Often self-targeted or simple interactions
- May have equipment or stat requirements

## Advanced Usage

### Custom Test Scenarios

```javascript
class CustomActionTest extends ModActionTestBase {
  // Override for specific requirements
  requiresCloseness() {
    return true;
  }

  requiresAnatomy() {
    return this.actionName.includes('fondle');
  }

  // Custom entity setup
  createCustomScenario() {
    return new ModEntityBuilder('actor1')
      .withName('Alice')
      .atLocation('special_room')
      .withComponent('special:requirement', { met: true })
      .build();
  }

  // Custom test
  runSpecialTest() {
    it('handles special scenario', async () => {
      const entity = this.createCustomScenario();
      this.testFixture.reset([entity]);

      // Custom test logic
      await this.executeAction(entity.id, 'special_target');
      // Custom assertions
    });
  }
}
```

### Performance and Scalability

The new architecture provides:

- **70-80% code reduction** across all mod tests
- **Centralized maintenance** - changes in one place
- **Consistent patterns** - same structure everywhere
- **Easy scaling** - supports thousands of mod tests
- **Better debugging** - standardized error handling

### Best Practices

1. **Use appropriate scenario builders** for your action type
2. **Override base class methods** for custom behavior
3. **Add custom tests** for edge cases specific to your action
4. **Keep test descriptions clear** and action-specific
5. **Group related tests** in logical describe blocks
6. **Use helper methods** instead of repeating assertion logic

## Examples

See `examples/kiss_cheek_action_converted.test.js` for a complete before/after comparison showing how a real test file converts to the new architecture.

## Support

For questions about migrating existing tests or implementing new patterns, refer to the detailed analysis report at `reports/mod-integration-test-architecture-analysis.md`.
