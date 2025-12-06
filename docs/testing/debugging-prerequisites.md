# Debugging Prerequisite Evaluation

## Overview

This guide explains how to debug prerequisite evaluation failures using enhanced error messages and debug mode.

## Quick Start

### Enable Debug Mode

```javascript
beforeEach(async () => {
  fixture = await ModTestFixture.forAction('mod', 'action', null, null, {
    debugPrerequisites: true, // Enable detailed prerequisite logging
  });
});
```

Alternatively, you can enable it programmatically:

```javascript
beforeEach(async () => {
  fixture = await ModTestFixture.forAction('mod', 'action');
  fixture.enablePrerequisiteDebug();
  // Note: If the environment is already initialized, you may need to recreate the fixture
});
```

### Read Enhanced Error Messages

When a prerequisite fails, you'll see:

```
Action 'seduction:grab_crotch_draw_attention' not discovered
  Prerequisite #3 failed: {"hasOtherActorsAtLocation":["actor"]}
  Expected: true
  Actual: false
  Entity State:
    actorId: "actor-1"
    actorLocation: "room1"
    entitiesAtLocation: 1
  💡 Hint: Only the actor is at this location. Add other actors to the scene.
```

## Error Message Components

### 1. Action Identification

```
Action 'seduction:grab_crotch_draw_attention' not discovered
```

**What it tells you:** Which action failed discovery

### 2. Failed Prerequisite

```
Prerequisite #3 failed: {"hasOtherActorsAtLocation":["actor"]}
```

**What it tells you:**

- Which prerequisite failed (index #3 means 4th prerequisite, 0-indexed)
- The exact prerequisite logic that was evaluated

### 3. Expected vs Actual

```
Expected: true
Actual: false
```

**What it tells you:**

- What the prerequisite should have returned
- What it actually returned

### 4. Entity State

```
Entity State:
  actorId: "actor-1"
  actorLocation: "room1"
  entitiesAtLocation: 1
```

**What it tells you:**

- Relevant entity state at evaluation time
- Operator-specific context (varies by operator)

### 5. Debugging Hint

```
💡 Hint: Only the actor is at this location. Add other actors to the scene.
```

**What it tells you:**

- Actionable suggestion for fixing the test
- Common remediation steps

## Operator-Specific State

### hasPartOfType

**State Provided:**

- `actorId` / `targetId`: Entity IDs
- `bodyParts`: Array of body part types the entity has

**Example:**

```
Entity State:
  actorId: "actor-1"
  bodyParts: ["head", "torso", "arm"] (3 items)
💡 Hint: Actor does not have any body parts of type "breast"
```

**Fix:** Add required anatomy to actor's `anatomy:body` component

### hasOtherActorsAtLocation

**State Provided:**

- `actorId`: Actor ID
- `actorLocation`: Actor's location ID
- `entitiesAtLocation`: Count of entities at same location

**Example:**

```
Entity State:
  actorId: "actor-1"
  actorLocation: "room1"
  entitiesAtLocation: 1
💡 Hint: Only the actor is at this location. Add other actors
```

**Fix:** Add other actors to the same location

### hasClothingInSlot

**State Provided:**

- `actorId` / `targetId`: Entity IDs
- `wornItems`: Array of occupied clothing slots

**Example:**

```
Entity State:
  actorId: "actor-1"
  wornItems: ["head", "feet"] (2 items)
💡 Hint: No clothing in slot "chest". Add worn_items component
```

**Fix:** Add clothing to required slot in `clothing:worn_items` component

### component_present

**State Provided:**

- `actorId` / `targetId`: Entity IDs
- `hasComponent`: Boolean indicating component presence

**Example:**

```
Entity State:
  actorId: "actor-1"
  hasComponent: false
💡 Hint: Entity missing component "positioning:sitting"
```

**Fix:** Add required component to entity

## Debug Mode Levels

```javascript
// No debugging (default)
const debugger = new PrerequisiteDebugger({ logger, debugLevel: DebugLevel.NONE });

// Log only errors
const debugger = new PrerequisiteDebugger({ logger, debugLevel: DebugLevel.ERROR });

// Log errors and warnings
const debugger = new PrerequisiteDebugger({ logger, debugLevel: DebugLevel.WARN });

// Log everything
const debugger = new PrerequisiteDebugger({ logger, debugLevel: DebugLevel.DEBUG });
```

## Best Practices

### 1. Enable Debug Mode Only When Needed

```javascript
it('should discover action', async () => {
  // Only enable if test is failing
  // fixture.enablePrerequisiteDebug();

  const actions = await fixture.discoverActions(actor.id);
  expect(actions).toContainAction('mod:action');
});
```

### 2. Read Error Messages Top to Bottom

1. **Action ID** - Confirms which action failed
2. **Prerequisite** - Identifies which logic to fix
3. **Entity State** - Shows what data was missing
4. **Hint** - Provides remediation steps

### 3. Use Structured Logging

```javascript
it('should log prerequisite failures', async () => {
  try {
    await fixture.discoverActions(actor.id);
  } catch (error) {
    // Error is PrerequisiteEvaluationError with toJSON()
    console.log(JSON.stringify(error.toJSON(), null, 2));
  }
});
```

## Common Patterns

### Missing Anatomy

**Error:**

```
💡 Hint: Actor does not have any body parts of type "breast"
```

**Fix:**

```javascript
const actor = fixture.createEntity({
  components: {
    'anatomy:body': {
      body: {
        parts: {
          'breast-left': 'breast-left-id',
          'breast-right': 'breast-right-id',
        },
      },
    },
  },
});
```

### Missing Other Actors

**Error:**

```
💡 Hint: Only the actor is at this location. Add other actors
```

**Fix:**

```javascript
const actors = fixture.createStandardActorTarget(['Actor', 'Target']);
// Both actors now at same location
```

### Missing Components

**Error:**

```
💡 Hint: Entity missing component "positioning:sitting"
```

**Fix:**

```javascript
fixture.entityManager.addComponent(actor.id, 'positioning:sitting', {
  furniture_id: 'couch',
});
```

## Advanced Usage

### Programmatic Control

```javascript
describe('My Test Suite', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction('mod', 'action');
  });

  it('should debug specific test', async () => {
    // Enable debug mode for this test only
    fixture.enablePrerequisiteDebug();

    const actions = await fixture.discoverActions(actor.id);
    expect(actions).toContainAction('mod:action');

    // Disable for subsequent tests
    fixture.disablePrerequisiteDebug();
  });
});
```

### Integration with Test Environment

```javascript
import { createRuleTestEnvironment } from '../common/engine/systemLogicTestEnv.js';

const testEnv = createRuleTestEnvironment({
  createHandlers: myHandlerFactory,
  entities: [],
  rules: myRules,
  actions: myActions,
  conditions: myConditions,
  debugPrerequisites: true, // Enable enhanced error messages
});
```

## Troubleshooting

### Debug Mode Not Working

**Problem:** Debug messages not appearing in test output

**Solutions:**

1. Ensure you're enabling debug mode before the test environment is created
2. Check that your logger is configured to show debug messages
3. Verify the `entityManager` is being passed to `PrerequisiteEvaluationService`

### Missing Entity State

**Problem:** Entity state section is empty or missing expected data

**Solutions:**

1. Ensure the entity exists before evaluation
2. Check that components are properly attached to entities
3. Verify the operator type is recognized by the debugger

### Hints Not Helpful

**Problem:** Generic "Review prerequisite logic" hint

**Solutions:**

1. The operator may not have specialized hint generation
2. Check if entity state extraction failed
3. Consider extending the debugger with custom hint logic for your operator

## References

- **Error Class:** `src/actions/validation/errors/prerequisiteEvaluationError.js`
- **Debugger:** `src/actions/validation/prerequisiteDebugger.js`
- **Evaluation Service:** `src/actions/validation/prerequisiteEvaluationService.js`
- **Tests:** `tests/unit/actions/validation/prerequisiteErrorMessages.test.js`
- **Mod Testing Guide:** `docs/testing/mod-testing-guide.md`
