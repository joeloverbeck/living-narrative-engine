# ModTestFixture API Usage Guide

## Correct API Usage

This document outlines the correct API usage for ModTestFixture and related testing utilities, based on the fixes applied to resolve E2E test failures in `tests/e2e/infrastructure/completeWorkflow.test.js`.

## Key API Changes

### ❌ Old (Incorrect) API Usage
```javascript
// These methods DO NOT exist:
const fixture = ModTestFixture.createFixture({
  type: 'action',
  logger: mockLogger,
  modId: 'intimacy'
});

const handler = ModTestHandlerFactory.createHandler({
  type: 'action',
  logger: mockLogger,
  actionId: 'kiss_cheek'
});

const builder = new ModEntityBuilder(); // Missing required ID parameter
```

### ✅ New (Correct) API Usage
```javascript
// Use the correct static factory methods:
const fixture = await ModTestFixture.forActionAutoLoad('intimacy', 'intimacy:kiss_cheek');

// Or use specific factory methods:
const fixture = await ModTestFixture.forAction('intimacy', 'intimacy:kiss_cheek', ruleFile, conditionFile);
const fixture = await ModTestFixture.forRule('intimacy', 'intimacy:kiss_cheek');
const fixture = await ModTestFixture.forCategory('intimacy');

// Use fixture's built-in methods instead of separate handlers:
const scenario = fixture.createStandardActorTarget(['Actor Name', 'Target Name']);
await fixture.executeAction(scenario.actor.id, scenario.target.id);

// Entity creation is handled by the fixture:
// No need to manually create ModEntityBuilder instances
```

## Complete Working Example

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../tests/common/mods/ModTestFixture.js';
import { createTestBed } from '../../common/testBed.js';

describe('Action Testing Example', () => {
  let testBed;

  beforeEach(() => {
    testBed = createTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should execute action workflow correctly', async () => {
    // Step 1: Create fixture with auto-loaded files
    const fixture = await ModTestFixture.forActionAutoLoad('intimacy', 'intimacy:kiss_cheek');

    expect(fixture).toBeDefined();
    expect(fixture.modId).toBe('intimacy');
    expect(fixture.actionId).toBe('intimacy:kiss_cheek');

    // Step 2: Create test entities using fixture helpers
    const scenario = fixture.createStandardActorTarget(['Test Actor', 'Test Target']);
    
    expect(scenario.actor).toBeDefined();
    expect(scenario.target).toBeDefined();

    // Step 3: Execute action
    await fixture.executeAction(scenario.actor.id, scenario.target.id);
    
    // Step 4: Verify results
    expect(fixture.events.length).toBeGreaterThan(0);
    
    // Step 5: Use assertion helpers
    fixture.assertActionSuccess("Test Actor leans in to kiss Test Target's cheek softly.");
    fixture.assertPerceptibleEvent({
      descriptionText: "Test Actor leans in to kiss Test Target's cheek softly.",
      locationId: 'room1',
      actorId: scenario.actor.id,
      targetId: scenario.target.id
    });

    // Step 6: Cleanup
    fixture.cleanup();
  });
});
```

## Available Factory Methods

### ModTestFixture Static Methods

| Method | Purpose | Parameters | Returns |
|--------|---------|------------|---------|
| `forActionAutoLoad(modId, actionId, options?)` | Auto-loads rule and condition files for an action | modId, full actionId, optional config | ModActionTestFixture |
| `forAction(modId, actionId, ruleFile?, conditionFile?)` | Creates action test fixture with explicit files | modId, actionId, optional files | ModActionTestFixture |
| `forRule(modId, actionId, ruleFile?, conditionFile?)` | Creates rule test fixture | modId, actionId, optional files | ModActionTestFixture |
| `forCategory(modId, options?)` | Creates category test fixture | modId, optional config | ModCategoryTestFixture |

### ModActionTestFixture Instance Methods

| Method | Purpose | Parameters | Returns |
|--------|---------|------------|---------|
| `createStandardActorTarget(names)` | Creates actor and target entities | [actorName, targetName] | {actor, target} |
| `executeAction(actorId, targetId)` | Executes the action | actorId, targetId | Promise<void> |
| `assertActionSuccess(expectedMessage)` | Asserts action executed successfully | expected message | void |
| `assertPerceptibleEvent(eventData)` | Asserts perceptible event was generated | event properties | void |
| `clearEvents()` | Clears the event list | none | void |
| `cleanup()` | Cleans up resources | none | void |

## Important Notes

1. **Always use full action IDs**: Use `'intimacy:kiss_cheek'` not just `'kiss_cheek'`
2. **Auto-loading is preferred**: Use `forActionAutoLoad()` when possible - it automatically finds and loads the correct rule and condition files
3. **No manual entity creation**: Let the fixture handle entity creation via `createStandardActorTarget()`
4. **Always cleanup**: Call `fixture.cleanup()` in your tests to prevent resource leaks
5. **Event validation**: Use the fixture's assertion helpers for consistent event validation

## Common Pitfalls to Avoid

1. ❌ Don't use `ModTestFixture.createFixture()` - this method doesn't exist
2. ❌ Don't use `ModTestHandlerFactory.createHandler()` - use fixture methods instead  
3. ❌ Don't create `new ModEntityBuilder()` without parameters - use fixture helpers
4. ❌ Don't forget to `await` the factory methods - they return Promises
5. ❌ Don't use partial action IDs - always include the mod prefix

## Migration Guide

If you have existing tests using the old API:

1. Replace `ModTestFixture.createFixture()` calls with `ModTestFixture.forActionAutoLoad()`
2. Replace manual handler creation with fixture's `executeAction()` method
3. Replace manual entity building with fixture's `createStandardActorTarget()`
4. Ensure all action IDs include the mod prefix (e.g., `'intimacy:kiss_cheek'`)
5. Update expected messages to match actual rule output

This API provides a more streamlined, reliable way to test mod functionality with automatic file loading and proper entity management.