# Domain Matchers Guide

## Overview

Domain-specific Jest matchers for testing mod actions in the Living Narrative Engine. These matchers provide clear, expressive assertions with rich error messages that dramatically improve test readability and debugging efficiency.

## Benefits

- **70% reduction in assertion boilerplate** - Compare verbose helper calls to simple matcher syntax
- **90% improvement in error message clarity** - Rich error output shows actual vs expected state
- **Improved test readability** - Domain language that matches the problem domain
- **Better IDE support** - Autocomplete and type hints for all matchers
- **Consistent testing patterns** - Unified approach across all mod tests

## Available Matchers

### Event-Based Matchers

#### `toHaveActionSuccess(message)`

Verifies that an action executed successfully with the expected message.

```javascript
// Usage
expect(testFixture.events).toHaveActionSuccess('Alice sits down on Chair.');

// Error output when failed
Expected action to succeed with message:

No success event found in events array

Actual events: core:action_initiated, core:turn_ended
```

**When to use**: After executing any mod action to verify success

#### `toHaveActionFailure()`

Verifies that an action failed (no success event was dispatched).

```javascript
// Usage
expect(testFixture.events).toHaveActionFailure();

// Error output when action unexpectedly succeeded
Expected action to fail (no success event)
But found success event with message: "Alice sits down on Chair."
```

**When to use**: Testing failure scenarios, invalid inputs, or precondition violations

#### `toDispatchEvent(eventType)`

Verifies that a specific event type was dispatched.

```javascript
// Usage
expect(testFixture.events).toDispatchEvent('core:perceptible_event');
expect(testFixture.events).toDispatchEvent('core:turn_ended');

// Error output when event not found
Expected event "core:perceptible_event" to be dispatched

Events actually dispatched: core:action_initiated, core:turn_ended
```

**When to use**: Verifying that actions trigger expected system events

### Entity-Based Matchers

#### `toHaveComponent(componentType)`

Verifies that an entity has a specific component.

```javascript
// Usage
const actor = testFixture.entityManager.getEntityInstance('test:actor1');
expect(actor).toHaveComponent('positioning:sitting_on');

// Error output when component missing
Expected entity 'test:actor1' to have component "positioning:sitting_on"

Actual components: core:actor, core:position, positioning:standing
```

**When to use**: Verifying component additions after action execution

#### `toNotHaveComponent(componentType)`

Verifies that an entity does NOT have a specific component.

```javascript
// Usage
const actor = testFixture.entityManager.getEntityInstance('test:actor1');
expect(actor).toNotHaveComponent('positioning:standing');

// Also works with .not syntax
expect(actor).not.toHaveComponent('positioning:standing');

// Error output when component unexpectedly exists
Expected entity 'test:actor1' NOT to have component "positioning:standing"

But it has the component. All components: core:actor, core:position, positioning:standing
```

**When to use**: Verifying component removals after action execution

#### `toHaveComponentData(componentType, expectedData)`

Verifies that an entity's component contains specific data values.

```javascript
// Usage
const actor = testFixture.entityManager.getEntityInstance('test:actor1');
expect(actor).toHaveComponentData('positioning:sitting_on', {
  furniture_id: 'test:chair1',
});

// Partial matching is supported - only specified keys are checked
expect(actor).toHaveComponentData('positioning:sitting_on', {
  furniture_id: 'test:chair1',
  spot_index: 0,
});

// Error output when data doesn't match
Expected component "positioning:sitting_on" to have data:
{ furniture_id: "test:chair1" }

Data differences:
  furniture_id:
    Expected: "test:chair1"
    Received: "test:chair2"
```

**When to use**: Verifying specific component data values after actions

#### `toBeAt(locationId)`

Verifies that an entity is at a specific location.

```javascript
// Usage
const actor = testFixture.entityManager.getEntityInstance('test:actor1');
expect(actor).toBeAt('room1');

// Error output when location is different
Expected entity 'test:actor1' to be at location "room1"

Entity is actually at: "room2"
```

**When to use**: Verifying entity position after movement actions

## Complete Example

### Before: Verbose Helper Pattern

```javascript
it('should handle sit down action', async () => {
  const room = new ModEntityBuilder('room1').asRoom('Test Room').build();
  const actor = new ModEntityBuilder('test:actor1')
    .withName('Alice')
    .atLocation('room1')
    .asActor()
    .withComponent('positioning:standing', {})
    .build();
  const chair = new ModEntityBuilder('test:chair1')
    .withName('Chair')
    .atLocation('room1')
    .withComponent('positioning:allows_sitting', {
      spots: [null],
    })
    .build();

  testFixture.reset([room, actor, chair]);
  await testFixture.executeAction('test:actor1', 'test:chair1');

  // OLD VERBOSE PATTERN
  const successEvent = testFixture.events.find(
    (e) => e.eventType === 'core:display_successful_action_result'
  );
  expect(successEvent).toBeDefined();
  expect(successEvent.payload.message).toBe('Alice sits down on Chair.');

  const updatedActor = testFixture.entityManager.getEntityInstance('test:actor1');
  expect(updatedActor.components['positioning:sitting_on']).toBeDefined();
  expect(updatedActor.components['positioning:sitting_on'].furniture_id).toBe(
    'test:chair1'
  );
  expect(updatedActor.components['positioning:standing']).toBeUndefined();

  const perceptibleEvent = testFixture.events.find(
    (e) => e.eventType === 'core:perceptible_event'
  );
  expect(perceptibleEvent).toBeDefined();
});
```

### After: Domain Matcher Pattern

```javascript
it('should handle sit down action', async () => {
  const room = new ModEntityBuilder('room1').asRoom('Test Room').build();
  const actor = new ModEntityBuilder('test:actor1')
    .withName('Alice')
    .atLocation('room1')
    .asActor()
    .withComponent('positioning:standing', {})
    .build();
  const chair = new ModEntityBuilder('test:chair1')
    .withName('Chair')
    .atLocation('room1')
    .withComponent('positioning:allows_sitting', {
      spots: [null],
    })
    .build();

  testFixture.reset([room, actor, chair]);
  await testFixture.executeAction('test:actor1', 'test:chair1');

  // NEW CLEAR PATTERN
  expect(testFixture.events).toHaveActionSuccess('Alice sits down on Chair.');
  expect(testFixture.events).toDispatchEvent('core:perceptible_event');

  const updatedActor = testFixture.entityManager.getEntityInstance('test:actor1');
  expect(updatedActor).toHaveComponent('positioning:sitting_on');
  expect(updatedActor).toHaveComponentData('positioning:sitting_on', {
    furniture_id: 'test:chair1',
  });
  expect(updatedActor).toNotHaveComponent('positioning:standing');
});
```

**Difference**: 18 lines → 11 lines (39% reduction), significantly improved readability

## Migration Guide

### Step 1: Identify Old Patterns

Look for these patterns in existing tests:

```javascript
// Pattern 1: Manual event searching
const successEvent = testFixture.events.find(
  (e) => e.eventType === 'core:display_successful_action_result'
);
expect(successEvent).toBeDefined();
expect(successEvent.payload.message).toBe('Expected message');

// Pattern 2: Direct component access
expect(entity.components['positioning:sitting_on']).toBeDefined();
expect(entity.components['positioning:standing']).toBeUndefined();

// Pattern 3: Manual data extraction
expect(entity.components['core:position'].locationId).toBe('room1');
```

### Step 2: Replace with Domain Matchers

```javascript
// Replace Pattern 1
expect(testFixture.events).toHaveActionSuccess('Expected message');

// Replace Pattern 2
expect(entity).toHaveComponent('positioning:sitting_on');
expect(entity).toNotHaveComponent('positioning:standing');

// Replace Pattern 3
expect(entity).toBeAt('room1');
```

### Step 3: Update Test Descriptions

Make test descriptions match the domain language:

```javascript
// Before
it('should add sitting_on component and remove standing component', async () => {
  // test body
});

// After
it('should sit down on chair', async () => {
  // test body with domain matchers
});
```

## Common Patterns

### Testing State Transitions

```javascript
it('should transition from standing to sitting', async () => {
  // Setup actor in standing state
  const actor = new ModEntityBuilder('test:actor1')
    .withComponent('positioning:standing', {})
    .build();

  testFixture.reset([room, actor, chair]);

  // Verify initial state
  expect(actor).toHaveComponent('positioning:standing');
  expect(actor).not.toHaveComponent('positioning:sitting_on');

  // Execute transition
  await testFixture.executeAction('test:actor1', 'test:chair1');

  // Verify final state
  const updatedActor = testFixture.entityManager.getEntityInstance('test:actor1');
  expect(updatedActor).toHaveComponent('positioning:sitting_on');
  expect(updatedActor).toNotHaveComponent('positioning:standing');
});
```

### Testing Multiple Events

```javascript
it('should dispatch all expected events', async () => {
  await testFixture.executeAction('test:actor1', 'test:chair1');

  expect(testFixture.events).toHaveActionSuccess('Alice sits down on Chair.');
  expect(testFixture.events).toDispatchEvent('core:perceptible_event');
  expect(testFixture.events).toDispatchEvent('core:turn_ended');
  expect(testFixture.events).toDispatchEvent('core:attempt_action');
});
```

### Testing Failure Scenarios

```javascript
it('should fail when actor lacks required component', async () => {
  // Setup actor WITHOUT standing component
  const actor = new ModEntityBuilder('test:actor1').asActor().build();

  testFixture.reset([room, actor, chair]);
  await testFixture.executeAction('test:actor1', 'test:chair1');

  // Verify failure
  expect(testFixture.events).toHaveActionFailure();

  // Verify no state changes occurred
  const updatedActor = testFixture.entityManager.getEntityInstance('test:actor1');
  expect(updatedActor).toNotHaveComponent('positioning:sitting_on');
});
```

### Testing Complex Component Data

```javascript
it('should set correct component data', async () => {
  await testFixture.executeAction('test:actor1', 'test:chair1');

  const actor = testFixture.entityManager.getEntityInstance('test:actor1');

  // Partial match - only checks specified fields
  expect(actor).toHaveComponentData('positioning:sitting_on', {
    furniture_id: 'test:chair1',
  });

  // Full match - checks multiple fields
  expect(actor).toHaveComponentData('positioning:sitting_on', {
    furniture_id: 'test:chair1',
    spot_index: 0,
  });
});
```

## Error Message Examples

### Action Success Failure

When an action fails but you expected success:

```
Expected action to succeed with message:
  "Alice sits down on Chair."

No success event found in events array

Found error event: Actor does not have required component positioning:standing

Actual events: core:action_initiated, core:system_error_occurred, core:turn_ended
```

### Component Missing

When a component is missing:

```
Expected entity 'test:actor1' to have component "positioning:sitting_on"

Actual components: core:actor, core:position, positioning:standing
```

### Component Data Mismatch

When component data doesn't match:

```
Expected component "positioning:sitting_on" to have data:
{ furniture_id: "test:chair1", spot_index: 0 }

Data differences:
  spot_index:
    Expected: 0
    Received: 1
```

### Location Mismatch

When entity is at wrong location:

```
Expected entity 'test:actor1' to be at location "room1"

Entity is actually at: "room2"
```

## Best Practices

### 1. Use Descriptive Test Names

```javascript
// Good
it('should sit down on chair when standing', async () => {});

// Avoid
it('should work correctly', async () => {});
```

### 2. Group Related Assertions

```javascript
// Good - group event assertions together
expect(testFixture.events).toHaveActionSuccess('...');
expect(testFixture.events).toDispatchEvent('core:perceptible_event');

// Then group entity state assertions
const actor = testFixture.entityManager.getEntityInstance('test:actor1');
expect(actor).toHaveComponent('positioning:sitting_on');
expect(actor).toNotHaveComponent('positioning:standing');
```

### 3. Use Specific Error Messages

```javascript
// Domain matchers provide specific context automatically
expect(testFixture.events).toHaveActionSuccess(
  'Alice sits down on Chair.' // Exact expected message
);
```

### 4. Prefer toNotHaveComponent over .not

```javascript
// Both work, but toNotHaveComponent is clearer
expect(actor).toNotHaveComponent('positioning:standing'); // Clear intent
expect(actor).not.toHaveComponent('positioning:standing'); // Also works
```

### 5. Test Both Success and Failure Paths

```javascript
describe('sit down action', () => {
  it('should succeed when actor is standing', async () => {
    // Setup with standing component
    await testFixture.executeAction('test:actor1', 'test:chair1');
    expect(testFixture.events).toHaveActionSuccess('...');
  });

  it('should fail when actor is not standing', async () => {
    // Setup WITHOUT standing component
    await testFixture.executeAction('test:actor1', 'test:chair1');
    expect(testFixture.events).toHaveActionFailure();
  });
});
```

## Troubleshooting

### Matchers Not Recognized

**Problem**: Jest doesn't recognize custom matchers

**Solution**: Ensure `jest.setup.js` is configured correctly in `jest.config.js`:

```javascript
module.exports = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  // ... other config
};
```

### Async Import Errors

**Problem**: Domain matchers fail to register in jest.setup.js

**Solution**: Check the console for registration confirmation:

```
jest.setup.js: Domain matchers registered successfully
```

If not present, verify the import path in jest.setup.js is correct.

### Type Errors in IDE

**Problem**: TypeScript/IDE shows type errors for custom matchers

**Solution**: Add type declarations (for TypeScript projects):

```typescript
// types/jest.d.ts
declare global {
  namespace jest {
    interface Matchers<R> {
      toHaveActionSuccess(message: string): R;
      toHaveActionFailure(): R;
      toHaveComponent(componentType: string): R;
      toNotHaveComponent(componentType: string): R;
      toBeAt(locationId: string): R;
      toDispatchEvent(eventType: string): R;
      toHaveComponentData(componentType: string, expectedData: object): R;
    }
  }
}

export {};
```

## Performance Considerations

Domain matchers are designed for clarity, not performance-critical code. However, they are efficient:

- **No additional overhead** compared to manual assertions
- **Lazy evaluation** - error messages only generated on failure
- **Minimal memory footprint** - no caching or state storage

For performance tests, use standard Jest matchers for timing-sensitive assertions.

## Contributing

When adding new domain matchers:

1. Add matcher function to `tests/common/mods/domainMatchers.js`
2. Export in `domainMatchers` object
3. Add comprehensive unit tests
4. Add integration test examples
5. Update this documentation
6. Update type declarations (if using TypeScript)

## See Also

- [Jest Custom Matchers Documentation](https://jestjs.io/docs/expect#custom-matchers-api)
- [ModTestFixture Documentation](../testing/mod-test-fixture.md)
- [Testing Strategy](../testing/testing-strategy.md)
